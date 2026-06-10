import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const CACHE_FILE = path.join(process.cwd(), "server", "data", "gemini_cache.json");

interface GeminiFileCache {
  [hash: string]: {
    uri: string;
    name: string;
    mimeType: string;
    uploadedAt: string;
  };
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not set. Gemini File sync won't work.");
}

function getCache(): GeminiFileCache {
  try {
    if (!fs.existsSync(path.dirname(CACHE_FILE))) {
      fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading gemini_cache.json", e);
  }
  return {};
}

function saveCache(cache: GeminiFileCache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.error("Error writing gemini_cache.json", e);
  }
}

function getFileHash(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function syncFolderToGemini(folderPath: string): Promise<{ uri: string; mimeType: string; name: string }[]> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const uploadedFiles: { uri: string; mimeType: string; name: string }[] = [];
  const cache = getCache();
  
  if (!fs.existsSync(folderPath)) {
    console.warn(`Folder not found: ${folderPath}`);
    return [];
  }

  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    if (!file.toLowerCase().endsWith(".pdf")) continue;
    
    const fullPath = path.join(folderPath, file);
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) continue;

    console.log(`Syncing ${file} (${(stat.size / 1024 / 1024).toFixed(2)} MB)...`);

    try {
      const hash = getFileHash(fullPath);
      
      // Check cache
      if (cache[hash]) {
        console.log(`Using cached version for ${file}`);
        uploadedFiles.push(cache[hash]);
        continue;
      }

      console.log(`Uploading ${file} to Gemini... This may take a while depending on size.`);
      
      // Native File API Upload logic
      const fileStats = fs.statSync(fullPath);
      
      // 1. Initiate upload
      const initRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key=${apiKey}`, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": fileStats.size.toString(),
          "X-Goog-Upload-Header-Content-Type": "application/pdf",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ file: { displayName: file } })
      });

      if (!initRes.ok) {
        throw new Error(`Failed to initiate upload: ${await initRes.text()}`);
      }

      const uploadUrl = initRes.headers.get("x-goog-upload-url");
      if (!uploadUrl) {
        throw new Error("No upload URL returned from Gemini API");
      }

      // 2. Upload file contents
      const fileBuffer = fs.readFileSync(fullPath);
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Length": fileStats.size.toString(),
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize"
        },
        body: fileBuffer
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload file chunk: ${await uploadRes.text()}`);
      }

      const uploadResult = await uploadRes.json();
      console.log(`Uploaded! File URI: ${uploadResult.file.uri}`);

      const fileData = {
        uri: uploadResult.file.uri,
        name: uploadResult.file.name,
        mimeType: uploadResult.file.mimeType,
        uploadedAt: new Date().toISOString()
      };

      cache[hash] = fileData;
      saveCache(cache);
      
      uploadedFiles.push(fileData);
    } catch (e: any) {
      console.error(`Error uploading ${file}:`, e.message);
    }
  }

  return uploadedFiles;
}
