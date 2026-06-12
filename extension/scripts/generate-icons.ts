import { createCanvas } from 'canvas'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const sizes = [16, 48, 128]
const outDir = join(__dirname, '../public/icons')

if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true })
}

for (const size of sizes) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#10b981' // Emerald 500
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.2)
  ctx.fill()

  // Text
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${size * 0.6}px sans-serif`
  ctx.fillText('L', size / 2, size / 2 + size * 0.05)

  writeFileSync(join(outDir, `icon${size}.png`), canvas.toBuffer('image/png'))
  console.log(`Generated icon${size}.png`)
}
