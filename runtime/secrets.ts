// Copyright 2026 Ix Infrastructure Inc.

/**
 * Secret redaction for `ix --format llm` output before it reaches the model.
 *
 * Originally ported from ix-cursor-plugin/mcp/shared/secrets.ts, which also
 * redacted any 24+ character run of `[A-Za-z0-9+/=_-]` that held a digit and
 * mixed case or a symbol. On Ix output that rule fires on ordinary data: the
 * llm format is `key=value`, so `=` glued the key to its value, and file paths,
 * identifiers, UUIDs and git SHAs all qualify --
 *
 *   path=packages/server/src/v2/handlers/AuthHandler.ts  -> [REDACTED].ts
 *   OAuth2TokenRefreshScheduler                          -> [REDACTED]
 *   id=ee807471-524c-3ac8-2d5e-a2a34add09e9              -> [REDACTED]
 *
 * so the model was handed broken paths and missing names. What is redacted now
 * is only what is a credential by its form, not by its length:
 *
 *   - provider key formats with a fixed prefix (GitHub, GitLab, OpenAI,
 *     Anthropic, AWS, Google, Slack, Stripe), each anchored at a word boundary
 *     so `task-runner-...` is not an `sk-` key;
 *   - `Bearer <token>` and JSON Web Tokens;
 *   - PEM private key blocks;
 *   - an assignment to a secret-named key (`password=`, `GITHUB_TOKEN=`,
 *     `client_secret:` ...) whose value looks random, so `apiKey = process.env.KEY`
 *     in a code snippet is left alone and `token=ghx7Fq...` is not.
 */

const REDACTED = "[REDACTED]";

/** Whole-match patterns: the match is the secret. */
const SECRET_PATTERNS: RegExp[] = [
  // PEM private key blocks: `-----BEGIN PRIVATE KEY-----` and `BEGIN RSA PRIVATE KEY`.
  /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z0-9]+ )*PRIVATE KEY-----/g,
  // JSON Web Tokens: three base64url segments, the first two JSON objects.
  /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g,
  // GitHub: classic and fine-grained.
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  // OpenAI / Anthropic (`sk-`, `sk-proj-`, `sk-ant-api03-`): the body must hold
  // a digit, which kebab-case names essentially never end in.
  /(?<![A-Za-z0-9_-])sk-(?=[A-Za-z0-9_-]*[0-9])[A-Za-z0-9_-]{20,}/g,
  // Stripe live/test secret and restricted keys.
  /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  // AWS access key ids.
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  // Google API keys.
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  // Slack tokens.
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
];

/**
 * `<secret-named key><sep><value>`. The key may carry a prefix
 * (`GITHUB_TOKEN`, `db_password`, `x-api-key`) but must end in the secret
 * word, so `path=`, `id=` and `tokens_in=` never match.
 */
const ASSIGNMENT =
  /\b([A-Za-z0-9_.-]*?(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|session[_-]?key|credentials?))(["']?\s*[:=]\s*)(["']?)([^\s"'&,;<>]+)/gi;

function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const ch of value) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let bits = 0;
  for (const n of counts.values()) {
    const p = n / value.length;
    bits -= p * Math.log2(p);
  }
  return bits;
}

/**
 * True for a value that reads as a random credential rather than a word, an
 * identifier, an expression or a path: long enough, letters and several
 * digits, and high per-character entropy.
 */
export function isHighEntropyValue(value: string): boolean {
  if (value.length < 12) return false;
  // A property access or call (`process.env.API_KEY`, `getToken()`) or a file
  // path is code, not a credential.
  if (/^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(value)) return false;
  if (/[()]/.test(value)) return false;
  if (/\//.test(value) && /\.[A-Za-z]{1,5}$/.test(value)) return false;
  const letters = (value.match(/[A-Za-z]/g) ?? []).length;
  const digits = (value.match(/[0-9]/g) ?? []).length;
  if (letters < 2 || digits < 2) return false;
  return shannonEntropy(value) >= 3;
}

export function containsSecret(text: string): boolean {
  return Boolean(text) && redactSecrets(text) !== text;
}

export function redactSecrets(text: string): string {
  if (!text) return text;
  let redacted = text;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, REDACTED);
  }
  ASSIGNMENT.lastIndex = 0;
  return redacted.replace(ASSIGNMENT, (match, key: string, sep: string, quote: string, value: string) =>
    value !== REDACTED && isHighEntropyValue(value) ? `${key}${sep}${quote}${REDACTED}` : match,
  );
}
