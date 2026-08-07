// Génère les icônes PWA sans aucune dépendance : encodeur PNG maison (zlib natif).
// Design : anneau blanc sur fond bleu accent, cohérent avec les anneaux de
// progression de l'écran Aujourd'hui (§7.1). Régénérer avec `npm run icons`.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const BLUE = [37, 99, 235] // #2563eb — accent (§11)
const WHITE = [255, 255, 255]

// CRC32 (table calculée une fois) pour les chunks PNG.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // profondeur 8 bits
  ihdr[9] = 6 // RGBA
  // Scanlines : chaque ligne préfixée d'un octet de filtre (0 = None).
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Distance signée à un rectangle centré à coins arrondis.
function roundedRectSDF(px, py, halfW, halfH, r) {
  const qx = Math.abs(px) - (halfW - r)
  const qy = Math.abs(py) - (halfH - r)
  const ax = Math.max(qx, 0)
  const ay = Math.max(qy, 0)
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r
}

function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4)
  const c = size / 2
  // Anneau : plus petit et bien centré pour tenir dans la zone sûre maskable (80 %).
  const ringOuter = size * (maskable ? 0.3 : 0.36)
  const ringInner = ringOuter * 0.58
  // Fond : plein cadre pour maskable (le masque système découpe la forme),
  // rectangle arrondi sinon.
  const bgHalf = size / 2
  const bgRadius = maskable ? 0 : size * 0.22
  const SS = 3 // super-échantillonnage 3×3 pour lisser les bords

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - c
          const py = y + (sy + 0.5) / SS - c
          let sr = 0
          let sg = 0
          let sb = 0
          let sa = 0
          // Fond bleu (dans le rectangle arrondi / plein cadre).
          if (roundedRectSDF(px, py, bgHalf, bgHalf, bgRadius) <= 0) {
            sr = BLUE[0]
            sg = BLUE[1]
            sb = BLUE[2]
            sa = 255
          }
          // Anneau blanc par-dessus.
          const dist = Math.hypot(px, py)
          if (dist >= ringInner && dist <= ringOuter) {
            sr = WHITE[0]
            sg = WHITE[1]
            sb = WHITE[2]
            sa = 255
          }
          r += sr
          g += sg
          b += sb
          a += sa
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      rgba[i] = Math.round(r / n)
      rgba[i + 1] = Math.round(g / n)
      rgba[i + 2] = Math.round(b / n)
      rgba[i + 3] = Math.round(a / n)
    }
  }
  return encodePng(size, size, rgba)
}

const targets = [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['icon-maskable-192.png', 192, { maskable: true }],
  ['icon-maskable-512.png', 512, { maskable: true }],
]
for (const [name, size, opts] of targets) {
  const png = drawIcon(size, opts)
  writeFileSync(join(OUT, name), png)
  console.log(`écrit ${name} (${size}px, ${png.length} octets)`)
}
