/**
 * Tool-result size cap.
 *
 * Long tool outputs (Gmail search dumps, deployment logs, search analytics
 * rows, …) blow up the model's context budget and increase latency for every
 * subsequent step. We hard-cap each result at ~32KB serialized.
 *
 * Strategy: serialize, measure, and if over budget recursively truncate the
 * largest leaves (long strings, long arrays) while preserving structure, then
 * re-serialize. A `__truncated: true` flag plus a hint string is appended so
 * the model knows to refine its query / paginate.
 */

const DEFAULT_MAX_BYTES = 32_000;

export interface CapResult {
  result: unknown;
  truncated: boolean;
  hint?: string;
}

function byteLen(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function truncate(value: unknown, budget: number): unknown {
  if (value == null || typeof value !== "object") {
    if (typeof value === "string" && value.length > budget) {
      return value.slice(0, Math.max(0, budget - 32)) + "…[truncated]";
    }
    return value;
  }
  if (Array.isArray(value)) {
    // Keep the first N items, where N shrinks until under budget.
    let n = value.length;
    let trimmed: unknown[] = value;
    while (n > 0 && byteLen(trimmed) > budget) {
      n = Math.max(1, Math.floor(n * 0.6));
      trimmed = value.slice(0, n);
    }
    if (n < value.length) {
      return [
        ...trimmed.map((item) => truncate(item, Math.floor(budget / Math.max(1, n)))),
        { __omitted: value.length - n, __hint: "more items omitted; paginate or refine your query" },
      ];
    }
    return trimmed.map((item) => truncate(item, Math.floor(budget / Math.max(1, n))));
  }
  // Object: shrink each field proportionally.
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return obj;
  const per = Math.max(256, Math.floor(budget / keys.length));
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    out[key] = truncate(obj[key], per);
  }
  return out;
}

export function capToolResult(value: unknown, maxBytes: number = DEFAULT_MAX_BYTES): CapResult {
  const initial = byteLen(value);
  if (initial <= maxBytes) {
    return { result: value, truncated: false };
  }
  const trimmed = truncate(value, maxBytes);
  let envelope: Record<string, unknown>;
  if (trimmed && typeof trimmed === "object" && !Array.isArray(trimmed)) {
    envelope = { ...(trimmed as Record<string, unknown>), __truncated: true };
  } else {
    envelope = { result: trimmed, __truncated: true };
  }
  envelope.__hint = `Response was ${initial} bytes (cap ${maxBytes}). Refine your query, paginate, or request fewer fields.`;
  return { result: envelope, truncated: true, hint: String(envelope.__hint) };
}
