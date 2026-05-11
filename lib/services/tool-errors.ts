/**
 * Structured tool errors. Throwing these (instead of generic `Error`) lets the
 * `/api/tools/execute` route emit machine-readable error payloads that the
 * chat UI can surface as actionable affordances (e.g. a "Connect Stripe"
 * button) rather than raw text.
 */

export type ToolErrorKind =
  | "not_connected"
  | "validation"
  | "rate_limited"
  | "upstream_error"
  | "permission_denied";

export class ToolError extends Error {
  readonly kind: ToolErrorKind;
  readonly provider?: string;
  readonly connectHref?: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(opts: {
    kind: ToolErrorKind;
    message: string;
    provider?: string;
    connectHref?: string;
    status?: number;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = "ToolError";
    this.kind = opts.kind;
    this.provider = opts.provider;
    this.connectHref = opts.connectHref;
    this.status = opts.status;
    this.details = opts.details;
  }

  toJSON() {
    return {
      ok: false,
      error: this.message,
      error_kind: this.kind,
      provider: this.provider,
      connectHref: this.connectHref,
      status: this.status,
      details: this.details,
    };
  }
}

export function notConnectedError(provider: string, label?: string): ToolError {
  return new ToolError({
    kind: "not_connected",
    message: `${label ?? provider} is not connected. Ask the operator to connect it from Dashboard > Settings > Providers.`,
    provider,
    connectHref: `/dashboard/settings/providers#${provider}`,
  });
}
