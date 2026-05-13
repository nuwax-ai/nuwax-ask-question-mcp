import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { Server } from "http";
import { McpAskRespondRequestSchema } from "./types.js";
import type { PendingAskStore } from "./pendingStore.js";

const MAX_BODY_SIZE = 1024 * 1024;

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      body += chunk.toString("utf8");
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, X-Nuwax-Internal-Secret",
  });
  res.end(JSON.stringify(payload));
}

function getHeader(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function statusFromResult(result: { ok: boolean; error?: { code: string } }) {
  if (result.ok) return 200;
  switch (result.error?.code) {
    case "not_found":
      return 404;
    case "revision_mismatch":
    case "already_resolved_conflict":
      return 409;
    case "unauthorized":
      return 401;
    case "bad_request":
      return 400;
    default:
      return 500;
  }
}

export function startHttpServer(options: {
  store: PendingAskStore;
  port: number;
  secret?: string;
}): Promise<Server> {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        pending: options.store.listPending(),
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/respond") {
      if (options.secret) {
        const secret = getHeader(req, "X-Nuwax-Internal-Secret");
        if (secret !== options.secret) {
          sendJson(res, 401, {
            ok: false,
            error: {
              code: "unauthorized",
              message: "invalid internal secret",
            },
          });
          return;
        }
      }

      try {
        const body = await readJson(req);
        const parsed = McpAskRespondRequestSchema.safeParse(body);
        if (!parsed.success) {
          sendJson(res, 400, {
            ok: false,
            error: {
              code: "bad_request",
              message: parsed.error.message,
            },
          });
          return;
        }

        const result = options.store.respond(parsed.data);
        sendJson(res, statusFromResult(result), result);
      } catch (error) {
        sendJson(res, 500, {
          ok: false,
          error: {
            code: "internal_error",
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
      return;
    }

    sendJson(res, 404, {
      ok: false,
      error: {
        code: "not_found",
        message: `path not found: ${url.pathname}`,
      },
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}
