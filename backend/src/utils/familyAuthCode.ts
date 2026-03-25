export function generateFamilyAuthCode(length = 5): string {
  // Alphanumeric, uppercase, easy to type.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function isValidFamilyAuthCode(code: unknown): code is string {
  return typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code.trim().toUpperCase());
}

