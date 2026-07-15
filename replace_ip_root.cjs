const fs = require('fs');
const path = require('path');

const OLD_IP = '179.197.76.174';
const NEW_IP = '179.197.76.174';

function walkSync(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (['node_modules', '.git', 'dist', 'scratch', 'uploads', '.manus'].includes(file)) continue;
      walkSync(fullPath, callback);
    } else {
      callback(fullPath);
    }
  }
}

let count = 0;
walkSync(__dirname, (filePath) => {
  if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.lock') || filePath.includes('pnpm')) return;
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(OLD_IP)) {
      content = content.split(OLD_IP).join(NEW_IP);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated IP in: ${filePath}`);
      count++;
    }
  } catch (e) { }
});
console.log(`Replaced IP in ${count} files.`);
