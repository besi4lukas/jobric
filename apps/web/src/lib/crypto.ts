import { env } from '../env'

// AES-256-GCM for refresh_token at rest. Key comes from GMAIL_TOKEN_KEY
// (base64-encoded 32 bytes). The stored payload is base64( iv || ciphertext ),
// where Web Crypto's AES-GCM appends the 16-byte auth tag to the ciphertext.

const AES_GCM_IV_BYTES = 12
const AES_KEY_BYTES = 32

let importedKeyPromise: Promise<CryptoKey> | null = null

function getEncryptionKey(): Promise<CryptoKey> {
  if (importedKeyPromise) return importedKeyPromise
  importedKeyPromise = (async () => {
    const keyBytes = base64ToBytes(env.GMAIL_TOKEN_KEY)
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
      ['encrypt', 'decrypt'],
    )
  })()
  return importedKeyPromise
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  )
  const payload = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  payload.set(iv, 0)
  payload.set(ciphertext, iv.byteLength)
  return bytesToBase64(payload)
}

export async function decrypt(encryptedPayload: string): Promise<string> {
  const key = await getEncryptionKey()
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
