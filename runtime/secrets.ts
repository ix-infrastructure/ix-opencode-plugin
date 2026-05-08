/**
 * Secret detection and redaction for Ix runtime payloads.
 *
 * Ported from ix-cursor-plugin/mcp/shared/secrets.ts.
 * Applied to all outbound runtime API payloads and inbound response strings
 * to prevent accidental transmission or surfacing of credentials.
 */

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{20,}/g,
  /glpat-[A-Za-z0-9_-]{20,}/g,
  /sk-[A-Za-z0-9-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /ASIA[0-9A-Z]{16}/g,
  /AIza[0-9A-Za-z\-_]{20,}/g,
  /(?:api|auth|access|secret|session|refresh|id)[-_]?(?:key|token)\s*[:=]\s*["']?[^\s"'&]+/gi,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g,
];

function isHighEntropySecret(token: string): boolean {
  if (token.length < 24) return false;
  const alnum = (token.match(/[A-Za-z0-9+/=_-]/g) ?? []).length;
  if (alnum / token.length < 0.9) return false;
  const hasDigit = /[0-9]/.test(token);
  const hasMixedCase = /[A-Z]/.test(token) && /[a-z]/.test(token);
  const hasSpecial = /[+/=_-]/.test(token);
  return hasDigit && (hasMixedCase || hasSpecial);
}

function redactHighEntropyTokens(text: string): string {
  return text.replace(/[A-Za-z0-9+/=_-]{24,}/g, (token) =>
    isHighEntropySecret(token) ? "[REDACTED]" : token
  );
}

export function containsSecret(text: string): boolean {
  if (!text) return false;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      pattern.lastIndex = 0;
      return true;
    }
  }
  const tokens = text.match(/[A-Za-z0-9+/=_-]{24,}/g) ?? [];
  return tokens.some(isHighEntropySecret);
}

export function redactSecrets(text: string): string {
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redactHighEntropyTokens(redacted);
}

/**
 * Scrub a JSON-serializable payload object by redacting secret-like strings
 * in all string values. Returns a new object safe to transmit.
 */
export function scrubPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(redactSecrets(JSON.stringify(payload))) as Record<string, unknown>;
}
