import { describe, it, expect } from 'vitest'
import { utf8ToBase64, base64ToUtf8, bytesToBase64, base64ToBytes } from './base64'

describe('base64 (§5.2)', () => {
  it('aller-retour UTF-8 avec accents et emoji', () => {
    const s = 'poids: 97,4 kg — séance à 8 h, œufs 🥚 déjà pesés'
    expect(base64ToUtf8(utf8ToBase64(s))).toBe(s)
  })

  it('décode un contenu avec retours à la ligne (comme l’API GitHub)', () => {
    const s = JSON.stringify({ schemaVersion: 1, records: [{ id: 'é' }] })
    // L'API insère un \n tous les 60 caractères : on simule ça.
    const withNewlines = utf8ToBase64(s).replace(/(.{60})/g, '$1\n')
    expect(base64ToUtf8(withNewlines)).toBe(s)
  })

  it('aller-retour binaire exact', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128, 64])
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })
})
