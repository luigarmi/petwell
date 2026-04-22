import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function deriveKey(secret: string) {
  return createHash('sha256').update(secret).digest();
}

export function encryptString(plainText: string, secret: string) {
  const iv = randomBytes(12);
  const key = deriveKey(secret);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptString(payload: string, secret: string) {
  const decoded = Buffer.from(payload, 'base64');
  const iv = decoded.subarray(0, 12);
  const tag = decoded.subarray(12, 28);
  const encrypted = decoded.subarray(28);
  const key = deriveKey(secret);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
