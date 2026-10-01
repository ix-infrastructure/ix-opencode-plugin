// Copyright 2026 Ix Infrastructure Inc.

/**
 * Recognising an Ix error result, in either output format.
 *
 * Since Ix v0.12.0 (Ix#733) a read command that cannot answer says so on
 * stdout, in the format it was asked for, and exits 1:
 *
 *   --format json   {"error":"workspace_not_mapped","message":"...","next":"..."}
 *                   {"error":"unresolved_target","message":"...",
 *                    "graph":{"status":"empty","reason":"no_nodes","fix":"ix map"}}
 *   --format llm    error code=unresolved_target message="..."
 *                   graph status=empty reason=no_nodes fix="ix map"
 *
 * `safeRun`/`runIx` keep stdout on a non-zero exit on purpose (the record IS
 * the answer), so every tool has to recognise this shape before it reads the
 * body as a result. A JSON error record has none of the fields a success record
 * has, and a tool that reads it as one reports "nothing found", "clean" or
 * "safe" -- the opposite of what Ix said.
 *
 * This is a different failure from "ix is not installed" or "ix timed out":
 * there Ix said nothing; here it answered, and the answer is an error.
 */

import type { IxRun } from "./cli.ts";
import { isLlmErrorLine } from "./llm.ts";

export interface IxError {
  /** Ix's stable slug: `workspace_not_mapped`, `unresolved_target`, ... */
  code: string;
  /** Ix's one-sentence description of the failure. */
  message: string;
  /** The command that repairs it, when Ix named one (`graph.fix`). */
  fix?: string;
  /** Ix's guidance (`next` in JSON, `hint` in llm). */
  hint?: string;
  /** `graph.status` when Ix attached a graph health verdict: `empty`, `degraded`, ... */
  graphStatus?: string;
  /** `graph.reason`: `no_nodes`, `hollow`, `orphaned_target`, ... */
  graphReason?: string;
  /** The record's own `reason`, e.g. `file_not_found`. */
  reason?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * An Ix error record from an already-parsed JSON value, else null.
 *
 * The test is a string `error` key on an object: no success record Ix emits
 * has one, and every error record does.
 */
export function ixErrorFromJson(value: unknown): IxError | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const code = str(record["error"]);
  if (!code) return null;

  const graph =
    record["graph"] && typeof record["graph"] === "object"
      ? (record["graph"] as Record<string, unknown>)
      : undefined;

  const err: IxError = { code, message: str(record["message"]) ?? code };
  const fix = str(graph?.["fix"]) ?? str(record["fix"]);
  const hint = str(record["next"]) ?? str(record["hint"]);
  const graphStatus = str(graph?.["status"]);
  const graphReason = str(graph?.["reason"]);
  const reason = str(record["reason"]);
  if (fix) err.fix = fix;
  if (hint) err.hint = hint;
  if (graphStatus) err.graphStatus = graphStatus;
  if (graphReason) err.graphReason = graphReason;
  if (reason) err.reason = reason;
  return err;
}

/**
 * Split one llm record into its kind and fields.
 *
 * The wire format (Ix docs/llm-format.md): `kind key=value key="quoted value"`,
 * where a quoted value escapes `\` and `"` with a backslash and encodes
 * newline/CR/tab as `\n`/`\r`/`\t`.
 */
export function parseLlmRecord(line: string): { kind: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};
  const text = line.trim();
  const space = text.indexOf(" ");
  const kind = space === -1 ? text : text.slice(0, space);
  let i = space === -1 ? text.length : space + 1;

  while (i < text.length) {
    while (text[i] === " ") i++;
    const eq = text.indexOf("=", i);
    if (eq === -1) break;
    const key = text.slice(i, eq);
    i = eq + 1;
    let value = "";
    if (text[i] === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === "\\" && i + 1 < text.length) {
          const next = text[i + 1]!;
          value += next === "n" ? "\n" : next === "r" ? "\r" : next === "t" ? "\t" : next;
          i += 2;
        } else {
          value += text[i];
          i++;
        }
      }
      i++; // closing quote
    } else {
      const end = text.indexOf(" ", i);
      value = text.slice(i, end === -1 ? text.length : end);
      i = end === -1 ? text.length : end;
    }
    if (key) fields[key] = value;
  }
  return { kind, fields };
}

/**
 * An Ix error record from `--format llm` output, else null.
 *
 * The first non-blank line must be `error code=...`; a following `graph` record
 * (the graph health verdict Ix attaches to a miss on an empty graph) is folded
 * in.
 */
export function ixErrorFromLlm(text: string): IxError | null {
  if (!isLlmErrorLine(text)) return null;
  const lines = text.trim().split("\n");
  const { fields } = parseLlmRecord(lines[0]!);
  const code = str(fields["code"]);
  if (!code) return null;

  const err: IxError = { code, message: str(fields["message"]) ?? code };
  if (str(fields["hint"])) err.hint = fields["hint"];
  if (str(fields["fix"])) err.fix = fields["fix"];
  if (str(fields["reason"])) err.reason = fields["reason"];

  for (const line of lines.slice(1)) {
    const record = parseLlmRecord(line);
    if (record.kind === "graph") {
      if (str(record.fields["status"])) err.graphStatus = record.fields["status"];
      if (str(record.fields["reason"])) err.graphReason = record.fields["reason"];
      if (str(record.fields["fix"])) err.fix = record.fields["fix"];
    } else if (record.kind === "hint" && !err.hint && str(record.fields["text"])) {
      err.hint = record.fields["text"];
    }
  }
  return err;
}

/**
 * An Ix error record from raw stdout in either format, else null.
 *
 * Text that is neither -- a success record, or something unparseable -- is
 * null, and the caller carries on with its own parse.
 */
export function parseIxError(output: string | null | undefined): IxError | null {
  if (!output) return null;
  const text = output.trim();
  if (!text) return null;
  if (text.startsWith("{")) {
    try {
      return ixErrorFromJson(JSON.parse(text));
    } catch {
      return null;
    }
  }
  return ixErrorFromLlm(text);
}

/**
 * True when the error means there is no usable graph for this project: it was
 * never mapped, the backend holds nothing for it, or what it holds has lost its
 * edges. All three have the same remedy from the agent's side.
 */
export function needsMap(err: IxError): boolean {
  return (
    err.code === "workspace_not_mapped" ||
    err.graphStatus === "empty" ||
    err.graphStatus === "degraded"
  );
}

/**
 * The body a tool returns in place of a result when Ix answered with an error.
 *
 * Names the code and message, says plainly that this is not an empty result,
 * and passes on Ix's own fix. Lines only: each tool puts its own header above.
 */
export function ixErrorLines(err: IxError): string[] {
  const lines = [`**Ix returned an error** (\`${err.code}\`): ${err.message}`, ""];

  if (needsMap(err)) {
    const state =
      err.code === "workspace_not_mapped"
        ? "This project is not mapped in Ix"
        : err.graphStatus === "empty"
          ? "This project's Ix graph is empty"
          : "This project's Ix graph is incomplete (hollow)";
    lines.push(
      `${state}, so this is not an empty result — there is no graph to answer from.`,
      "Run `ix map` from the project root (or call the `ix-ingest` tool with `refresh: true`), then retry.",
    );
  } else {
    lines.push("This is an error from Ix, not an empty result.");
  }

  if (err.fix) lines.push("", `Ix's fix: \`${err.fix}\``);
  if (err.hint) lines.push("", `Ix says: ${err.hint}`);
  return lines;
}

/** `ixErrorLines` under a tool's header. */
export function formatIxError(header: string, err: IxError): string {
  return [header, "", ...ixErrorLines(err)].join("\n");
}

/** Why a run produced no answer at all: not installed, timed out, or silent. */
export type IxRunFailure = "not_installed" | "timeout" | "no_output";

export function runFailure(run: IxRun | null): IxRunFailure | null {
  if (!run) return "not_installed";
  if (run.timedOut) return "timeout";
  if (!run.stdout.trim()) return "no_output";
  return null;
}
