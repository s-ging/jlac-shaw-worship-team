/**
 * Password hashing and token generation on the Workers Web Crypto API.
 *
 * PBKDF2 iterations are deliberately modest. This is an internal tool for ~20
 * people behind Cloudflare, and the realistic threat is a curious teenager with
 * the WiFi password, not an offline attack on a stolen hash dump. The stored
 * format records its own iteration count, so this can be raised later without a
 * migration — old hashes keep verifying at the count they were written with.
 */

const ITERATIONS = 10_000
const KEY_BITS = 256
const SALT_BYTES = 16

const encoder = new TextEncoder()

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits'
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    KEY_BITS
  )
  return new Uint8Array(bits)
}

/**
 * Returns a self-describing hash: `pbkdf2$<iterations>$<salt>$<hash>`.
 * Keeping the parameters alongside the digest is what makes raising the cost
 * later a non-event.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await derive(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`
}

/** Constant-time comparison, so verification time leaks nothing about the hash. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

  const iterations = Number(parts[1])
  if (!Number.isInteger(iterations) || iterations < 1) return false

  try {
    const salt = fromBase64(parts[2])
    const expected = fromBase64(parts[3])
    const actual = await derive(password, salt, iterations)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/** Constant-time string comparison, for comparing secrets. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  return timingSafeEqual(left, right)
}

/** 256 bits of randomness, hex encoded. Used for session tokens. */
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
