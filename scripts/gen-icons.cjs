const sharp = require('sharp')
const fs = require('fs')

async function main() {
  const logo = fs.readFileSync('public/logo.svg')
  await sharp(logo).resize(512, 512).png().toFile('public/img/icons/icon-512.png')
  await sharp(logo).resize(192, 192).png().toFile('public/img/icons/icon-192.png')
  await sharp(logo).resize(180, 180).png().toFile('public/img/icons/apple-touch-icon.png')
  await sharp(logo).resize(180, 180).png().toFile('public/apple-touch-icon.png')
  await sharp(logo).resize(32, 32).png().toFile('public/favicon-32.png')

  // Variante transparente (solo trazo Lucide utensils)
  const transparent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <g fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(96 96) scale(13.333)">
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
    <path d="M7 2v20"/>
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
  </g>
</svg>`
  await sharp(Buffer.from(transparent)).png().toFile('public/img/icons/walletW.png')

  console.log('icons generated')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
