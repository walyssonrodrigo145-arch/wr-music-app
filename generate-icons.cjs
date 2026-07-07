const sharp = require('sharp');
const fs = require('fs');

async function generate() {
  try {
    const svg = fs.readFileSync('./client/public/logo.svg');
    await sharp(svg).resize(192, 192).png().toFile('./client/public/icon-192.png');
    await sharp(svg).resize(512, 512).png().toFile('./client/public/icon-512.png');
    await sharp(svg).resize(192, 192).png().toFile('./client/public/favicon.png');
    
    const badgeSvg = fs.readFileSync('./client/public/logo-badge.svg');
    await sharp(badgeSvg).resize(96, 96).png().toFile('./client/public/icon-badge.png');
    
    console.log('Images generated successfully');
  } catch (e) {
    console.error(e);
  }
}
generate();
