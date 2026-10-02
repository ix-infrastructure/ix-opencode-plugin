// Copyright 2026 Ix Infrastructure Inc.

/**
 * The secret redactor.
 *
 * It runs over every `--format llm` body before the model sees it, so a false
 * positive is not a harmless over-redaction: it hands the model a broken path
 * or a missing name. Both sides are pinned here -- real credential formats are
 * redacted, and the ordinary data in Ix output is not.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { containsSecret, isHighEntropyValue, redactSecrets } from "../runtime/secrets.ts";

// Assembled at runtime so the repo's secret scanner does not flag the test
// vectors themselves; none of them is a live credential.
const j = (...parts: string[]) => parts.join("");

describe("redactSecrets passes ordinary Ix output through", () => {
  const unchanged = [
    "path=packages/server/src/v2/handlers/AuthHandler.ts",
    "OAuth2TokenRefreshScheduler",
    "ref name=OAuth2TokenRefreshScheduler kind=class path=src/auth/OAuth2TokenRefreshScheduler.ts",
    "id=ee807471-524c-3ac8-2d5e-a2a34add09e9",
    "entity id=ee807471-524c-3ac8-2d5e-a2a34add09e9 name=runIx",
    "commit=5ce416cdfc7d2eca7a41967543771b734a6ba422",
    "rev 9737f56 fix: report Ix error records",
    "sha256:e1131bdaea1d38b2977c88529cf4d80469b7b23e2556eabe26dd91a41e7a577a",
    "file path=src/task-runner-for-background-jobs-v2.ts",
    "match path=src/config.ts line=12 snippet=\"const apiKey = process.env.OPENAI_API_KEY;\"",
    "snippet=\"const token = await getAccessToken(session2);\"",
    "snippet=\"password: string;\"",
    "snippet=\"refresh_token: tokens.refresh_token\"",
    "member name=parseJwtClaims path=src/auth/jwt.ts lines=10-42",
    "base64 helper: toBase64Url(bytes)",
  ];
  for (const text of unchanged) {
    test(JSON.stringify(text), () => {
      expect(redactSecrets(text)).toBe(text);
      expect(containsSecret(text)).toBe(false);
    });
  }

  test("every real llm fixture survives unchanged", () => {
    const fixtures = path.resolve(import.meta.dir, "fixtures/ix-v0.12.0");
    let checked = 0;
    for (const dir of ["success", "empty-repo", "empty-graph", "unmapped"]) {
      for (const file of readdirSync(path.join(fixtures, dir))) {
        if (!file.endsWith(".txt")) continue;
        const text = readFileSync(path.join(fixtures, dir, file), "utf8");
        expect(redactSecrets(text)).toBe(text);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });
});

describe("redactSecrets still redacts credentials", () => {
  const cases: [string, string, string][] = [
    ["GitHub classic token", j("token: ", "ghp_", "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"), "token: [REDACTED]"],
    ["GitHub fine-grained token", j("github_pat_", "11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789"), "[REDACTED]"],
    ["GitLab token", j("glpat-", "xY7zA1bC2dE3fG4hI5jK"), "[REDACTED]"],
    ["OpenAI key", j("key is ", "sk-", "proj-", "Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z"), "key is [REDACTED]"],
    ["Anthropic key", j("sk-", "ant-", "api03-", "Zx9Yw8Vu7Ts6Rq5Po4Nm3Lk2Ji1Hg0Fe"), "[REDACTED]"],
    ["AWS access key id", j("aws ", "AKIA", "IOSFODNN7EXAMPLE"), "aws [REDACTED]"],
    ["Google API key", j("AIza", "SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q"), "[REDACTED]"],
    ["Slack token", j("xoxb-", "123456789012-abcdefGHIJKL"), "[REDACTED]"],
    ["Stripe secret key", j("sk_", "live_", "51HxYzAbCdEfGhIjKlMn"), "[REDACTED]"],
    [
      "JWT",
      j("auth=", "eyJhbGciOiJIUzI1NiJ9", ".", "eyJzdWIiOiIxMjM0NTY3ODkwIn0", ".", "dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"),
      "auth=[REDACTED]",
    ],
    ["Bearer header", j("Authorization: Bearer ", "a8f3K2m9Q1x7Z4c6V0b5N3m8L2k9J7h4"), "Authorization: [REDACTED]"],
    ["password assignment", j("password=", "Xk9#mQ2!vL7pR4zT"), "password=[REDACTED]"],
    ["token assignment", j("GITHUB_TOKEN=", "f8c2a91e7d4b3a6c5e0f9d8b7a6c5e4d3b2a1f0e"), "GITHUB_TOKEN=[REDACTED]"],
    ["quoted JSON secret", j('"client_secret": "', "9fK2xQ7mL4pZ8vB1nC6tR3wE", '"'), '"client_secret": "[REDACTED]"'],
    ["api key in a URL query", j("https://x.test/v1?api_key=", "Q8w7E6r5T4y3U2i1O0pA9s8D", "&page=2"), "https://x.test/v1?api_key=[REDACTED]&page=2"],
  ];
  for (const [label, input, expected] of cases) {
    test(label, () => {
      expect(redactSecrets(input)).toBe(expected);
      expect(containsSecret(input)).toBe(true);
    });
  }

  test("PEM private key blocks, with and without an algorithm", () => {
    for (const algo of ["", "RSA ", "EC ", "OPENSSH "]) {
      const pem = j(`-----BEGIN ${algo}PRIVATE KEY-----\n`, "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n", `-----END ${algo}PRIVATE KEY-----`);
      expect(redactSecrets(`key:\n${pem}\ndone`)).toBe("key:\n[REDACTED]\ndone");
    }
  });

  test("redaction is idempotent", () => {
    const once = redactSecrets(j("password=", "Xk9#mQ2!vL7pR4zT ", "ghp_", "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"));
    expect(redactSecrets(once)).toBe(once);
  });

  test("isHighEntropyValue separates random values from words and code", () => {
    expect(isHighEntropyValue("Xk9mQ2vL7pR4zT8a")).toBe(true);
    expect(isHighEntropyValue("f8c2a91e7d4b3a6c5e0f9d8b7a6c5e4d3b2a1f0e")).toBe(true);
    expect(isHighEntropyValue("process.env.OPENAI_API_KEY")).toBe(false);
    expect(isHighEntropyValue("OAuth2TokenRefreshScheduler")).toBe(false);
    expect(isHighEntropyValue("hunter2")).toBe(false);
    expect(isHighEntropyValue("src/v2/handlers/AuthHandler.ts")).toBe(false);
  });
});
