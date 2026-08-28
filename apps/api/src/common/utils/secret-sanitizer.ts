/**
 * Secret Sanitizer Utility for IRONLOOM OS
 * Redacts sensitive API keys, database connection strings, JWT bearer tokens,
 * and private keys from strings, objects, arrays, and error logs before persistence.
 */

const SECRET_PATTERNS = [
  // Groq API Keys: gsk_...
  /gsk_[a-zA-Z0-9_-]{20,}/g,
  // OpenAI API Keys: sk-...
  /sk-[a-zA-Z0-9_-]{20,}/g,
  // GitHub Tokens: ghp_..., gho_..., github_pat_...
  /(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{20,}/g,
  /github_pat_[a-zA-Z0-9_]{20,}/g,
  // Database Connection URIs: postgres://..., redis://...
  /(postgres|postgresql|mysql|mongodb|redis):\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
  // JWT Bearer Tokens
  /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  // Slack Tokens: xoxb-..., xoxp-...
  /xox[baprs]-[a-zA-Z0-9_-]{10,}/g,
  // AWS Access Key ID: AKIA...
  /AKIA[0-9A-Z]{16}/g,
];

const SENSITIVE_KEY_NAMES = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'access_token',
  'authorization',
  'bearer',
  'servicerolekey',
  'service_role_key',
  'privatekey',
  'private_key',
  'clientsecret',
  'client_secret',
  'credentials',
]);

/**
 * Redacts sensitive strings matching known secret patterns.
 */
export function sanitizeString(val: string): string {
  if (!val || typeof val !== 'string') return val;
  let sanitized = val;
  for (const pattern of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_SECRET]');
  }
  return sanitized;
}

/**
 * Recursively traverses any object, array, or primitive to sanitize sensitive values and keys.
 */
export function sanitizeSecrets<T = any>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return sanitizeString(data) as unknown as T;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeSecrets(item)) as unknown as T;
  }

  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().replace(/[-_]/g, '');
      if (SENSITIVE_KEY_NAMES.has(lowerKey)) {
        cleaned[key] = '[REDACTED_SECRET]';
      } else if (typeof value === 'string') {
        cleaned[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        cleaned[key] = sanitizeSecrets(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned as T;
  }

  return data;
}
