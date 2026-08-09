// Génère les icônes PWA depuis le favicon fourni (public/favicon-source.png) :
//  - icon-192/512 (purpose any) : favicon aplati sur crème
//  - icon-maskable-192/512 : favicon centré à ~78 % sur un carré crème plein (zone sûre)
// Sans dépendance : décodage PNG (zlib) + redimensionnement bilinéaire + encodage PNG.
import { inflateSync, deflateSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const CREAM = [250, 250, 249] // #FAFAF9

// ---- Décodage PNG (RGBA, 8 bits, non entrelacé) ----
function decodePng(buf) {
  let p = 8
  const idat = []
  let width = 0
  let height = 0
  let colorType = 0
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    p += 12 + len
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(width * height * 4)
  const prev = Buffer.alloc(stride)
  let cur = Buffer.alloc(stride)
  let rp = 0
  const paeth = (a, b, c) => {
    const pp = a + b - c
    const pa = Math.abs(pp - a)
    const pb = Math.abs(pp - b)
    const pc = Math.abs(pp - c)
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]
    for (let i = 0; i < stride; i++) {
      const x = raw[rp++]
      const a = i >= channels ? cur[i - channels] : 0
      const b = prev[i]
      const c = i >= channels ? prev[i - channels] : 0
      let v = x
      if (filter === 1) v = x + a
      else if (filter === 2) v = x + b
      else if (filter === 3) v = x + ((a + b) >> 1)
      else if (filter === 4) v = x + paeth(a, b, c)
      cur[i] = v & 0xff
    }
    for (let xp = 0; xp < width; xp++) {
      const s = xp * channels
      const d = (y * width + xp) * 4
      out[d] = cur[s]
      out[d + 1] = channels >= 3 ? cur[s + 1] : cur[s]
      out[d + 2] = channels >= 3 ? cur[s + 2] : cur[s]
      out[d + 3] = channels === 4 ? cur[s + 3] : 255
    }
    prev.set(cur)
    cur = Buffer.alloc(stride)
  }
  return { width, height, rgba: out }
}

// ---- Redimensionnement bilinéaire (RGBA) ----
function resize(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const sy = ((y + 0.5) * sh) / dh - 0.5
    const y0 = Math.max(0, Math.floor(sy))
    const y1 = Math.min(sh - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < dw; x++) {
      const sx = ((x + 0.5) * sw) / dw - 0.5
      const x0 = Math.max(0, Math.floor(sx))
      const x1 = Math.min(sw - 1, x0 + 1)
      const fx = sx - x0
      const d = (y * dw + x) * 4
      for (let c = 0; c < 4; c++) {
        const p00 = src[(y0 * sw + x0) * 4 + c]
        const p10 = src[(y0 * sw + x1) * 4 + c]
        const p01 = src[(y1 * sw + x0) * 4 + c]
        const p11 = src[(y1 * sw + x1) * 4 + c]
        const top = p00 + (p10 - p00) * fx
        const bot = p01 + (p11 - p01) * fx
        out[d + c] = Math.round(top + (bot - top) * fy)
      }
    }
  }
  return out
}

// ---- Encodage PNG RGBA ----
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(b) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// ---- Composition ----
function creamCanvas(size) {
  const out = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    out[i * 4] = CREAM[0]
    out[i * 4 + 1] = CREAM[1]
    out[i * 4 + 2] = CREAM[2]
    out[i * 4 + 3] = 255
  }
  return out
}
/** Colle `src` (dw×dh) sur `dst` (size×size) à l'offset (ox,oy), en alpha-blend sur crème. */
function paste(dst, size, src, dw, dh, ox, oy) {
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const s = (y * dw + x) * 4
      const a = src[s + 3] / 255
      const d = ((oy + y) * size + (ox + x)) * 4
      dst[d] = Math.round(src[s] * a + dst[d] * (1 - a))
      dst[d + 1] = Math.round(src[s + 1] * a + dst[d + 1] * (1 - a))
      dst[d + 2] = Math.round(src[s + 2] * a + dst[d + 2] * (1 - a))
      dst[d + 3] = 255
    }
  }
}

const srcBuf = readFileSync(join(PUBLIC, 'favicon-source.png'))
const src = decodePng(srcBuf)

for (const size of [192, 512]) {
  // « any » : favicon plein cadre, aplati sur crème.
  const any = creamCanvas(size)
  paste(any, size, resize(src.rgba, src.width, src.height, size, size), size, size, 0, 0)
  writeFileSync(join(PUBLIC, `icon-${size}.png`), encodePng(size, size, any))

  // maskable : favicon à 78 % centré sur carré crème (zone sûre).
  const inner = Math.round(size * 0.78)
  const off = Math.round((size - inner) / 2)
  const mask = creamCanvas(size)
  paste(mask, size, resize(src.rgba, src.width, src.height, inner, inner), inner, inner, off, off)
  writeFileSync(join(PUBLIC, `icon-maskable-${size}.png`), encodePng(size, size, mask))
}
// Favicon d'onglet (48 px).
const fav = creamCanvas(48)
paste(fav, 48, resize(src.rgba, src.width, src.height, 48, 48), 48, 48, 0, 0)
writeFileSync(join(PUBLIC, 'favicon-48.png'), encodePng(48, 48, fav))

console.log('icônes générées depuis favicon-source.png')
