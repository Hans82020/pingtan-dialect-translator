import sharp from 'sharp'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
fs.mkdirSync(`${root}public/icons`, { recursive: true })
const svg = fs.readFileSync(`${root}public/icon.svg`)
for (const s of [192, 512]) {
  await sharp(svg).resize(s, s).png().toFile(`${root}public/icons/pwa-${s}.png`)
}
console.log('icons generated: pwa-192.png, pwa-512.png')
