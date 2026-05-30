async function main() {
  try {
    const res = await fetch("https://web.whatsapp.com/sw.js", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const text = await res.text();
    console.log("--- sw.js ---");
    console.log(text);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

main().catch(console.error);
