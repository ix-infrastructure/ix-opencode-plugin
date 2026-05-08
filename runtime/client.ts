/**
 * Ix Core Runtime HTTP client.
 *
 * Calls the Ix Core Runtime API (v2) when available.
 * Returns null when the runtime is unavailable — all callers must fall back to CLI.
 *
 * The runtime is the v2 contract target documented in IX_PLUGIN_OVERHAUL_SPEC.md.
 * Until the runtime is deployed (target: 2026-07-15), all tools use the ix CLI directly.
 * This client exists so tools can route through the runtime as soon as it is reachable,
 * without requiring any code changes in the tools themselves.
 */

import { scrubPayload, redactSecrets } from "./secrets.ts";

const RUNTIME_BASE = process.env.IX_RUNTIME_URL ?? "http://127.0.0.1:7743";
const API_VERSION = "2.0";
const SURFACE = "opencode-plugin";
const SURFACE_VERSION = "1.0.0";
const DEFAULT_TIMEOUT_MS = 5000;
const HEALTH_TIMEOUT_MS = 2000;

export type RuntimeResponse = Record<string, unknown>;

export interface RuntimeCallOpts {
  workspaceId?: string;
  dir?: string;
  timeoutMs?: number;
  skill?: string;
}

/**
 * Call the Ix Core Runtime API.
 *
 * Returns the parsed JSON response body, or null if the runtime is unreachable
 * or returns a non-2xx status. Never throws.
 */
export async function callRuntime(
  endpoint: string,
  payload: Record<string, unknown>,
  opts: RuntimeCallOpts = {}
): Promise<RuntimeResponse | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const rawEnvelope = {
    api_version: API_VERSION,
    ...payload,
    workspace: {
      workspace_id: opts.workspaceId ?? opts.dir ?? "local",
      ...(opts.dir ? { root_uri: `file://${opts.dir}` } : {}),
      ...((payload.workspace as Record<string, unknown> | undefined) ?? {}),
    },
    caller: {
      surface: SURFACE,
      surface_version: SURFACE_VERSION,
      ...(opts.skill ? { skill: opts.skill } : {}),
      ...((payload.caller as Record<string, unknown> | undefined) ?? {}),
    },
  };
  const body = JSON.stringify(scrubPayload(rawEnvelope));

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${RUNTIME_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as RuntimeResponse;
    if (typeof json.preview_markdown === "string") {
      json.preview_markdown = redactSecrets(json.preview_markdown);
    }
    return json;
  } catch {
    return null;
  }
}

/**
 * GET variant for endpoints like /v2/status.
 * Returns null on any failure.
 */
export async function getRuntime(
  endpoint: string,
  opts: Pick<RuntimeCallOpts, "timeoutMs"> = {}
): Promise<RuntimeResponse | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${RUNTIME_BASE}${endpoint}`, {
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as RuntimeResponse;
  } catch {
    return null;
  }
}

/**
 * Probe whether the runtime is reachable via GET /v2/status.
 * Returns false on any failure.
 */
export async function isRuntimeAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const res = await fetch(`${RUNTIME_BASE}/v2/status`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  }
}
