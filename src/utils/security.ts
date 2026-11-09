/**
 * Security and Cryptographic Utilities
 * Provides offline SHA-256 salted password hashing using standard Web Crypto API.
 */

export function generateSalt(length = 16): string {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt + 'IBMS_GHANA_SECURE_SALT_V1');
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const calculatedHash = await hashPassword(password, salt);
  return calculatedHash === storedHash;
}

// Session timeout: 30 minutes of inactivity
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
