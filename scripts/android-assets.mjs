import sharp from 'sharp'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
const root = 'android/app/src/main/res'
const icon = await readFile('public/icons/icon.svg')
const foreground = Buffer.from(icon.toString().replace(/<rect[^>]*\/>/, '').replace('translate(56 56) scale(10)', 'translate(96 96) scale(8)'))
for (const [density, size, adaptive] of [['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432]]) {
  const dir = path.join(root, `mipmap-${density}`)
  await mkdir(dir, { recursive: true })
  await sharp(icon).resize(size, size).png().toFile(path.join(dir, 'ic_launcher.png'))
  const round = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`)
  await sharp(icon).resize(size, size).composite([{ input: round, blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher_round.png'))
  await sharp(foreground).resize(adaptive, adaptive).png().toFile(path.join(dir, 'ic_launcher_foreground.png'))
}
await writeFile(path.join(root, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?><resources><color name="ic_launcher_background">#1c1227</color></resources>\n')
for (const dir of await readdir(root)) {
  if (!dir.startsWith('drawable')) continue
  const file = path.join(root, dir, 'splash.png')
  let meta
  try { meta = await sharp(file).metadata() } catch { continue }
  const size = Math.round(Math.min(meta.width, meta.height) * 0.32)
  const mark = await sharp(foreground).resize(size, size).png().toBuffer()
  await sharp({ create: { width: meta.width, height: meta.height, channels: 4, background: '#0e0d14' } }).composite([{ input: mark, gravity: 'center' }]).png().toFile(`${file}.tmp`)
  const { rename } = await import('node:fs/promises')
  await rename(`${file}.tmp`, file)
}
console.log('DreamSoul Android icons and launch screens generated.')
