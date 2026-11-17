/**
 * Initial admin password bootstrap (server only).
 *
 * resolveInitialAdminPassword() order of precedence:
 * 1. ADMIN_INITIAL_PASSWORD / ADMIN_PASSWORD from the environment.
 * 2. Development only: the password already stored in "admin userpass.txt" in the project root.
 * 3. Development only: a freshly generated 20-character password (generated = true).
 *    The caller decides whether to persist it with saveGeneratedAdminCredentials().
 * 4. Production without an env password: { password: null }. The caller must not fall back to a known password.
 *
 * The password is never logged. fs/path are loaded with require() so that db-store, which is
 * also bundled for the browser, does not pull node built-ins into the client build.
 */
import crypto from 'crypto';

export const ADMIN_USERPASS_FILENAME = 'admin userpass.txt';
export const ADMIN_BOOTSTRAP_PHONE = '09170000000';

const GENERATED_PASSWORD_LENGTH = 20;
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%';
const LEGACY_DEFAULT_PASSWORDS = new Set(['admin', 'Admin@ProFarm2026!#Shiraz']);

function generatePassword(): string {
  let out = '';
  for (let i = 0; i < GENERATED_PASSWORD_LENGTH; i++) {
    out += PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

/** Reads the password from the Persian "کلمه عبور: ..." line of admin userpass.txt. */
export function parseAdminUserPassFile(content: string): string | null {
  const line = content.split(/\r?\n/).find((l) => l.includes('کلمه عبور'));
  if (!line) return null;
  const idx = line.search(/[:：]/);
  if (idx < 0) return null;
  const value = line.slice(idx + 1).trim();
  return value.length > 0 ? value : null;
}

export interface ResolvedAdminPassword {
  password: string | null;
  /** true when the password was generated now and is not yet saved anywhere */
  generated: boolean;
}

export function resolveInitialAdminPassword(): ResolvedAdminPassword {
  const envPassword = (process.env.ADMIN_INITIAL_PASSWORD || process.env.ADMIN_PASSWORD || '').trim();
  if (envPassword && !LEGACY_DEFAULT_PASSWORDS.has(envPassword)) {
    return { password: envPassword, generated: false };
  }

  if (process.env.NODE_ENV === 'production') {
    return { password: null, generated: false };
  }

  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.join(process.cwd(), ADMIN_USERPASS_FILENAME);

  if (fs.existsSync(filePath)) {
    try {
      const existing = parseAdminUserPassFile(fs.readFileSync(filePath, 'utf-8'));
      if (existing) return { password: existing, generated: false };
    } catch {
      // handled below
    }
    console.warn(
      `[Admin bootstrap] "${ADMIN_USERPASS_FILENAME}" exists but its password could not be read. A new in-memory password was generated and the file was left untouched.`
    );
  }

  return { password: generatePassword(), generated: true };
}

/**
 * Writes a generated admin password to "admin userpass.txt" in the project root.
 * Only creates the file; an existing file is never overwritten. The password is not logged.
 */
export function saveGeneratedAdminCredentials(password: string): void {
  if (process.env.NODE_ENV === 'production') return;
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const filePath = path.join(process.cwd(), ADMIN_USERPASS_FILENAME);
  if (fs.existsSync(filePath)) return;
  const content = `شماره موبایل: ${ADMIN_BOOTSTRAP_PHONE}\r\nکلمه عبور: ${password}\r\n`;
  try {
    fs.writeFileSync(filePath, content, { encoding: 'utf-8', flag: 'wx' });
    console.warn(
      `[Admin bootstrap] Development admin credentials were saved to "${ADMIN_USERPASS_FILENAME}" in the project root.`
    );
  } catch (err) {
    console.warn('[Admin bootstrap] Could not write the admin credentials file:', err);
  }
}
