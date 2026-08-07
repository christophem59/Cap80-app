// Conversion base64 pour l'API GitHub (§5.2). Les deux sens cassent naïvement :
//  - à l'écriture, btoa(chaîne) échoue dès qu'il y a un accent → passer par TextEncoder ;
//  - à la lecture, le champ `content` renvoyé par l'API contient des retours à la ligne
//    tous les 60 caractères → il FAUT les retirer avant atob, et décoder l'UTF-8.
// Ne jamais utiliser atob/btoa seuls, dans aucun des deux sens.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000 // évite « Maximum call stack » sur les gros tableaux
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s/g, '') // indispensable : retire les sauts de ligne
  const binary = atob(clean)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** Chaîne UTF-8 → base64 (pour le corps d'un PUT de fichier JSON). */
export function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text))
}

/** base64 (champ `content` de l'API) → chaîne UTF-8. */
export function base64ToUtf8(b64: string): string {
  return new TextDecoder().decode(base64ToBytes(b64))
}
