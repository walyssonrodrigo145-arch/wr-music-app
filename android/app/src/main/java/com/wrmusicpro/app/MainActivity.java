package com.wrmusicpro.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileSaverPlugin.class);
        super.onCreate(savedInstanceState);
        installDownloadSafetyNet();
    }

    /**
     * Rede de segurança: o WebView do Capacitor não tem fluxo de download.
     * Qualquer download http(s) que não tenha sido tratado pelo JS (FileSaver)
     * é enviado ao DownloadManager, preservando cookies de sessão.
     */
    private void installDownloadSafetyNet() {
        try {
            Bridge bridge = getBridge();
            if (bridge == null || bridge.getWebView() == null) return;

            bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
                if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
                    // blob:/data: não expõem conteúdo aqui — tratados via FileSaverPlugin no JS
                    return;
                }
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                    return;
                }
                try {
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));

                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) request.addRequestHeader("Cookie", cookie);
                    if (userAgent != null) request.addRequestHeader("User-Agent", userAgent);

                    request.setMimeType(mimeType);
                    request.setTitle(fileName);
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "MusicPro/" + fileName);

                    DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (manager != null) {
                        manager.enqueue(request);
                        Toast.makeText(this, "Baixando " + fileName + "...", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception ignored) {
                    // sem handler nativo disponível: o JS já cobre os fluxos conhecidos
                }
            });
        } catch (Exception ignored) {
            // nunca impedir a abertura do app por causa da rede de segurança
        }
    }
}
