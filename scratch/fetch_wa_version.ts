async function fetchWithChromeAgent(url: string) {
  return fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
}

async function main() {
  try {
    const url = "https://web.whatsapp.com/check-update-version?version=2.24.0&platform=web";
    const res = await fetchWithChromeAgent(url);
    const text = await res.text();
    console.log("Check Update Version Response:", text);
    
    const mainPageRes = await fetchWithChromeAgent("https://web.whatsapp.com/");
    const mainPageHtml = await mainPageRes.text();
    
    // Look for version strings in the script tags or html
    const versionMatch = mainPageHtml.match(/manifest-([\d\.]+)\.json/);
    if (versionMatch) {
      console.log("Manifest Version Match:", versionMatch[1]);
    } else {
      const genericMatch = mainPageHtml.match(/v="([\d\.]+)"/);
      console.log("Generic Version Match:", genericMatch ? genericMatch[1] : "not found");
      
      const appVersionMatch = mainPageHtml.match(/appVersion":"([\d\.]+)"/);
      console.log("AppVersion Match:", appVersionMatch ? appVersionMatch[1] : "not found");
      
      // Let's search for "1040" or "main" manifest files in the page content
      const btManifestMatch = mainPageHtml.match(/data-btmanifest="([^"]+)"/);
      console.log("btmanifest Match:", btManifestMatch ? btManifestMatch[1] : "not found");
    }
  } catch (err: any) {
    console.error("Error fetching version:", err.message);
  }
}

main().catch(console.error);
