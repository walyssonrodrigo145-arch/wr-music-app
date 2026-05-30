import fs from "fs";
import path from "path";

function searchDir(dir: string, query: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, query);
    } else if (file.endsWith(".ts") || file.endsWith(".js")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      if (content.includes(query)) {
        console.log(`Found in: ${fullPath}`);
        // Print lines containing query
        const lines = content.split("\n");
        lines.forEach((line, idx) => {
          if (line.includes(query)) {
            console.log(`  L${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

console.log("Searching for fetchLatestWaWebVersion in src...");
searchDir("c:\\Users\\walysson\\Downloads\\meu-bot-whatsapp\\src", "fetchLatestWaWebVersion");
searchDir("c:\\Users\\walysson\\Downloads\\meu-bot-whatsapp\\src", "fetchLatestBaileysVersion");
searchDir("c:\\Users\\walysson\\Downloads\\meu-bot-whatsapp\\src", "fallback");
