import type {
  McpAskRespondRequest,
  McpAskUserToolInput,
  McpAskUserToolResult,
  PendingMcpAsk,
  RespondResult,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

function resultForAction(
  payload: McpAskRespondRequest,
): McpAskUserToolResult {
  if (payload.action === "submit") {
    return {
      status: "answered",
      formData: payload.formData ?? {},
      answeredBy: payload.answeredBy,
      answeredAt: payload.answeredAt ?? Date.now(),
    };
  }

  const status =
    payload.action === "cancel"
      ? "cancelled"
      : payload.action === "skip"
        ? "skipped"
        : "expired";

  return {
    status,
    answeredBy: payload.answeredBy,
    answeredAt: payload.answeredAt ?? Date.now(),
  };
}

function sameResult(
  a: McpAskUserToolResult | undefined,
  b: McpAskUserToolResult | undefined,
): boolean {
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export class PendingAskStore {
  private readonly pending = new Map<string, PendingMcpAsk>();
  private readonly terminal = new Map<
    string,
    { revision: number; result: McpAskUserToolResult }
  >();

  waitForAnswer(input: McpAskUserToolInput): Promise<McpAskUserToolResult> {
    const existing = this.pending.get(input.requestId);
    if (existing) {
      return Promise.resolve({
        status: "cancelled",
      });
    }

    return new Promise<McpAskUserToolResult>((resolve) => {
      const pending: PendingMcpAsk = {
        interventionId: input.requestId,
        revision: input.revision,
        sessionId: input.sessionId,
        ui: input.ui,
        status: "pending",
        resolve,
        createdAt: Date.now(),
      };

      const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      pending.timer = setTimeout(() => {
        this.resolve(input.requestId, input.revision, {
          status: "expired",
          answeredAt: Date.now(),
        });
      }, timeoutMs);

      this.pending.set(input.requestId, pending);
    });
  }

  respond(payload: McpAskRespondRequest): RespondResult {
    const pending = this.pending.get(payload.interventionId);
    const response = resultForAction(payload);

    if (!pending) {
      const resolved = this.terminal.get(payload.interventionId);
      if (!resolved) {
        return {
          ok: false,
          hostStatus: "gone",
          error: {
            code: "not_found",
            message: "pending question not found",
          },
        };
      }
      if (resolved.revision !== payload.revision) {
        return {
          ok: false,
          hostStatus: "superseded",
          error: {
            code: "revision_mismatch",
            message: "question revision mismatch",
          },
        };
      }
      if (sameResult(resolved.result, response)) {
        return {
          ok: true,
          hostStatus: "already_resolved",
          result: resolved.result,
        };
      }
      return {
        ok: false,
        hostStatus: "superseded",
        error: {
          code: "already_resolved_conflict",
          message: "question already resolved with different response",
        },
      };
    }

    if (pending.revision !== payload.revision) {
      return {
        ok: false,
        hostStatus: "superseded",
        error: {
          code: "revision_mismatch",
          message: "question revision mismatch",
        },
      };
    }

    this.resolve(payload.interventionId, payload.revision, response);
    return { ok: true, hostStatus: "resolved", result: response };
  }

  listPending(): Array<{
    interventionId: string;
    revision: number;
    sessionId: string;
    status: string;
    createdAt: number;
  }> {
    return Array.from(this.pending.values()).map((item) => ({
      interventionId: item.interventionId,
      revision: item.revision,
      sessionId: item.sessionId,
      status: item.status,
      createdAt: item.createdAt,
    }));
  }

  cancelAll(): void {
    for (const item of this.pending.values()) {
      this.resolve(item.interventionId, item.revision, {
        status: "cancelled",
        answeredAt: Date.now(),
      });
    }
  }

  private resolve(
    interventionId: string,
    revision: number,
    result: McpAskUserToolResult,
  ): void {
    const pending = this.pending.get(interventionId);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    pending.status = result.status;
    pending.result = result;
    this.pending.delete(interventionId);
    this.terminal.set(interventionId, { revision, result });
    pending.resolve(result);
  }
}
