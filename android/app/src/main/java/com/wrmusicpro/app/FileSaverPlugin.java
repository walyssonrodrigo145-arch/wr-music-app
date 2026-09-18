package com.wrmusicpro.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Correção definitiva do download no app Android (Capacitor WebView não tem
 * fluxo de download nativo): recebe o arquivo em base64 do JS e salva em
 * Downloads/MusicPro (API 29+) ou compartilha via chooser do Android.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    private static final String FOLDER = "MusicPro";

    private String cleanBase64(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        int comma = value.indexOf(',');
        if (value.startsWith("data:") && comma > 0) value = value.substring(comma + 1);
        return value.replaceAll("\\s", "");
    }

    private String sanitizeFileName(String name, String fallback) {
        String value = (name == null || name.trim().isEmpty()) ? fallback : name.trim();
        return value.replaceAll("[\\\\/:*?\"<>|]", "_");
    }

    private String mimeOrDefault(PluginCall call, String fallback) {
        String mime = call.getString("mimeType");
        return (mime == null || mime.trim().isEmpty()) ? fallback : mime.trim();
    }

    private Uri saveToDownloads(byte[] bytes, String fileName, String mimeType) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + FOLDER);
        ContentValues pending = new ContentValues(values);
        pending.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, pending);
        if (uri == null) throw new Exception("MediaStore indisponível");

        try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
            if (os == null) throw new Exception("Não foi possível abrir o arquivo para escrita");
            os.write(bytes);
            os.flush();
        }

        ContentValues done = new ContentValues();
        done.put(MediaStore.MediaColumns.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, done, null, null);
        return uri;
    }

    private Uri shareFromCache(byte[] bytes, String fileName) throws Exception {
        File dir = new File(getContext().getCacheDir(), "shared");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Não foi possível criar a pasta de cache");
        File file = new File(dir, fileName);
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(bytes);
            fos.flush();
        }
        return FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
    }

    @PluginMethod
    public void saveBase64(PluginCall call) {
        String base64 = cleanBase64(call.getString("base64"));
        if (base64 == null || base64.isEmpty()) {
            call.reject("Arquivo vazio");
            return;
        }
        String fileName = sanitizeFileName(call.getString("fileName"), "arquivo.pdf");
        String mimeType = mimeOrDefault(call, "application/pdf");

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Salvamento direto não suportado nesta versão do Android");
            return;
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Uri uri = saveToDownloads(bytes, fileName, mimeType);
            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            ret.put("folder", "Downloads/" + FOLDER);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Falha ao salvar o arquivo", e);
        }
    }

    @PluginMethod
    public void shareBase64(PluginCall call) {
        String base64 = cleanBase64(call.getString("base64"));
        if (base64 == null || base64.isEmpty()) {
            call.reject("Arquivo vazio");
            return;
        }
        String fileName = sanitizeFileName(call.getString("fileName"), "arquivo.pdf");
        String mimeType = mimeOrDefault(call, "application/pdf");

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Uri uri = shareFromCache(bytes, fileName);

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Context context = getContext();
            Intent chooser = Intent.createChooser(intent, "Salvar ou compartilhar arquivo");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Falha ao compartilhar o arquivo", e);
        }
    }
}
