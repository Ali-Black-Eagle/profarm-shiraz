import crypto from 'crypto';

// OWASP Recommended minimum iterations for PBKDF2-HMAC-SHA256 (2024+)
export const CURRENT_PBKDF2_ITERATIONS = 210000;
const KEY_LEN = 32;
const DIGEST = 'sha256';

/**
 * Hashes a password using standard PBKDF2 with SHA-256 and a random 16-byte salt.
 * Formatted as: pbkdf2$<iterations>$<saltHex>$<hashHex>
 */
export function hashPassword(password: string): string {
  const clean = password.trim();
  if (!clean) throw new Error('رمز عبور نمی‌تواند خالی باشد.');

  if (typeof crypto === 'undefined' || !crypto.randomBytes || !crypto.pbkdf2Sync) {
    throw new Error('محیط رمزنگاری امن در دسترس نیست.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(clean, salt, CURRENT_PBKDF2_ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `pbkdf2$${CURRENT_PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

// Legacy pfh_ hashes are completely disabled and rejected for cryptographic security
export const PFH_DEPRECATED = true;

/**
 * Checks if a stored hash needs to be upgraded (e.g. legacy hash or lower iteration count)
 */
export function needsPasswordRehash(storedHash?: string | null): boolean {
  if (!storedHash) return true;
  if (storedHash.startsWith('pfh_')) return true; // Legacy 32-bit hash MUST be rejected/upgraded
  if (!storedHash.startsWith('pbkdf2$')) return true;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return true;
  const iterations = parseInt(parts[1], 10) || 0;
  return iterations < CURRENT_PBKDF2_ITERATIONS;
}

/**
 * Cryptographically verifies a password against a stored hash.
 * Uses constant-time buffer comparison to resist timing attacks.
 * Note: Plaintext fallback and legacy 32-bit FNV hashes (pfh_) are completely removed.
 */
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!password || !storedHash) return false;
  const clean = password.trim();

  // Legacy 32-bit hashes are strictly rejected for security
  if (storedHash.startsWith('pfh_')) {
    console.warn('[Security Alert] Attempted login with rejected legacy pfh_ hash.');
    return false;
  }

  // 1. PBKDF2 standard verification
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$');
    if (parts.length === 4) {
      const [, iterStr, salt, expectedHash] = parts;
      const iterations = parseInt(iterStr, 10) || CURRENT_PBKDF2_ITERATIONS;
      if (typeof crypto !== 'undefined' && crypto.pbkdf2Sync) {
        try {
          const actualHash = crypto.pbkdf2Sync(clean, salt, iterations, KEY_LEN, DIGEST).toString('hex');
          if (crypto.timingSafeEqual) {
            const bufA = Buffer.from(actualHash);
            const bufB = Buffer.from(expectedHash);
            if (bufA.length === bufB.length) {
              return crypto.timingSafeEqual(bufA, bufB);
            }
          }
          return actualHash === expectedHash;
        } catch {
          return false;
        }
      }
    }
  }

  return false;
}
