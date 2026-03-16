import { AUTH_MAX_AGE_SECONDS } from "@/lib/auth"

type SessionPayload = {
  username: string
  exp: number
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] as number)
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(input: string): Uint8Array | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/")
  const paddingLength = (4 - (normalized.length % 4 || 4)) % 4
  const padded = normalized + "=".repeat(paddingLength)

  try {
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

function getSessionSecret(): string | null {
  const secret = process.env.AUTH_SESSION_SECRET?.trim() || process.env.AUTH_PASSWORD?.trim() || null
  return secret && secret.length >= 16 ? secret : null
}

async function signData(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data))
  return toBase64Url(new Uint8Array(signature))
}

async function verifyData(data: string, signature: string, secret: string): Promise<boolean> {
  const signatureBytes = fromBase64Url(signature)
  if (!signatureBytes) {
    return false
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )

  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes as unknown as BufferSource,
    new TextEncoder().encode(data)
  )
}

export async function createSignedSessionToken(username: string): Promise<string> {
  const secret = getSessionSecret()
  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET (or strong AUTH_PASSWORD) in server environment")
  }

  const payload: SessionPayload = {
    username,
    exp: Math.floor(Date.now() / 1000) + AUTH_MAX_AGE_SECONDS,
  }

  const payloadText = JSON.stringify(payload)
  const payloadBase64 = toBase64Url(new TextEncoder().encode(payloadText))
  const signature = await signData(payloadBase64, secret)

  return `${payloadBase64}.${signature}`
}

export async function verifySignedSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) {
    return null
  }

  const secret = getSessionSecret()
  if (!secret) {
    return null
  }

  const [payloadBase64, signature] = token.split(".")
  if (!payloadBase64 || !signature) {
    return null
  }

  const valid = await verifyData(payloadBase64, signature, secret)
  if (!valid) {
    return null
  }

  const payloadBytes = fromBase64Url(payloadBase64)
  if (!payloadBytes) {
    return null
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload
    if (!payload || typeof payload.username !== "string" || typeof payload.exp !== "number") {
      return null
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null
    }

    return payload
  } catch {
    return null
  }
}
