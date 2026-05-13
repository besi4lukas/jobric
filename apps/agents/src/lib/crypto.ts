// AES-256-GCM decryption for refresh_token at rest. Keep wire format in sync
// with apps/web/src/lib/crypto.ts (the encrypt side): payload is
// base64( iv || ciphertext+tag ); iv is 12 bytes; key is base64-decoded 32 bytes.
//
// The agents Worker only needs to decrypt — encryption happens in the web
// callback. We deliberately don't expose an encrypt() here.

const AES_GCM_IV_BYTES = 12
const AES_KEY_BYTES = 32

const importedKeyCache = new Map<string, Promise<CryptoKey>>()

export async function decryptRefreshToken(
  encryptedPayload: string,
  base64Key: string,
): Promise<string> {
  const key = await getKey(base64Key)
  const payloadBytes = base64ToBytes(encryptedPayload)
  if (payloadBytes.byteLength <= AES_GCM_IV_BYTES) {
    throw new Error('encrypted payload is too short to contain iv + ciphertext')
  }
  const iv = payloadBytes.subarray(0, AES_GCM_IV_BYTES)
  const ciphertext = payloadBytes.subarray(AES_GCM_IV_BYTES)
  const plaintextBytes = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(plaintextBytes)
}

function getKey(base64Key: string): Promise<CryptoKey> {
  let cached = importedKeyCache.get(base64Key)
  if (!cached) {
    cached = (async () => {
      const keyBytes = base64ToBytes(base64Key)
      if (keyBytes.byteLength !== AES_KEY_BYTES) {
        throw new Error(
          `GMAIL_TOKEN_KEY must decode to ${AES_KEY_BYTES} bytes (got ${keyBytes.byteLength})`,
        )
      }
      return crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
      )
    })()
    importedKeyCache.set(base64Key, cached)
  }
  return cached
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
