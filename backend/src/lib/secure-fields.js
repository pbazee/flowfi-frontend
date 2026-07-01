const crypto = require('crypto')

const SECRET_MASK = '••••••••••••'
const ENCRYPTED_PREFIX = 'enc:v1'

function getEncryptionKey() {
  const secret = String(process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '').trim()
  if (!secret) {
    throw new Error('JWT_SECRET or NEXTAUTH_SECRET is required to encrypt/decrypt sensitive fields')
  }

  return crypto.createHash('sha256').update(secret).digest()
}

function isEncryptedValue(value) {
  return String(value || '').startsWith(`${ENCRYPTED_PREFIX}:`)
}

function isMaskedSecretValue(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return false

  return normalized === SECRET_MASK || /^[•*]{6,}$/.test(normalized)
}

function encryptSecretValue(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return null
  if (isEncryptedValue(normalized)) return normalized

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${ENCRYPTED_PREFIX}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptSecretValue(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return ''
  if (!isEncryptedValue(normalized)) return normalized

  const [, , ivHex, tagHex, encryptedHex] = normalized.split(':')
  if (!ivHex || !tagHex || !encryptedHex) {
    console.error('Stored secret is malformed', normalized)
    return ''
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(ivHex, 'hex')
    )
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedHex, 'hex')),
      decipher.final(),
    ])

    return decrypted.toString('utf8')
  } catch (err) {
    console.error('Failed to decrypt payment secret:', err.message)
    return ''
  }
}

function maskSecretValue(value) {
  return String(value || '').trim() ? SECRET_MASK : ''
}

module.exports = {
  ENCRYPTED_PREFIX,
  SECRET_MASK,
  decryptSecretValue,
  encryptSecretValue,
  isEncryptedValue,
  isMaskedSecretValue,
  maskSecretValue,
}
