import { compare, hash } from 'bcryptjs';

export function hashPassword(plainPassword: string) {
  return hash(plainPassword, 12);
}

export function verifyPassword(plainPassword: string, passwordHash: string) {
  return compare(plainPassword, passwordHash);
}
