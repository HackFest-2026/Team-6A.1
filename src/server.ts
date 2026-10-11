import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { validateChestXrayFromRGBA, REJECTION_MESSAGE } from "./lib/classifier/relevance";
import validatorWeights from "./lib/classifier/xray-validator-weights.json";

// Verify on startup that the image validation model weights are present and valid
function verifyValidatorModelStartup() {
  if (
    !validatorWeights ||
    !Array.isArray(validatorWeights.weights) ||
    validatorWeights.weights.length !== 73 ||
    typeof validatorWeights.bias !== "number"
  ) {
    const err =
      "CRITICAL STARTUP ERROR: Chest X-ray validation model weights missing or corrupt (expected 73 features).";
    console.error(err);
    throw new Error(err);
  }
}

// Run verification at startup
verifyValidatorModelStartup();

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function getCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization, apikey, x-client-info",
    "access-control-max-age": "86400",
  };
}

// Exported for integration tests and direct HTTP requests
export async function handleApiScan(request: Request): Promise<Response> {
  const cors = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method not allowed. Use POST." }), {
      status: 405,
      headers: { "content-type": "application/json", ...cors },
    });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        rgba?: number[];
        width?: number;
        height?: number;
        fileSize?: number;
      };

      if (!body.rgba || !body.width || !body.height) {
        return new Response(
          JSON.stringify({ ok: false, stage: "validate", error: REJECTION_MESSAGE }),
          {
            status: 400,
            headers: { "content-type": "application/json", ...cors },
          },
        );
      }

      const rgba = new Uint8ClampedArray(body.rgba);
      const res = validateChestXrayFromRGBA(rgba, body.width, body.height, body.fileSize);
      if (!res.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            stage: "validate",
            error: res.reason,
            probability: res.probability,
          }),
          {
            status: 400,
            headers: { "content-type": "application/json", ...cors },
          },
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          message: "Valid chest X-ray",
          probability: res.probability,
        }),
        {
          status: 200,
          headers: { "content-type": "application/json", ...cors },
        },
      );
    }

    return new Response(
      JSON.stringify({ ok: false, stage: "validate", error: REJECTION_MESSAGE }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      },
    );
  } catch {
    return new Response(
      JSON.stringify({ ok: false, stage: "validate", error: REJECTION_MESSAGE }),
      {
        status: 400,
        headers: { "content-type": "application/json", ...cors },
      },
    );
  }
}

// Health check endpoint for local diagnostics
function handleApiHealth(request: Request): Response {
  const cors = getCorsHeaders(request);
  return new Response(
    JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      models: {
        xrayValidator: {
          loaded: true,
          modelId: validatorWeights.model_id,
          featureCount: validatorWeights.feature_count,
        },
      },
      env: {
        nodeEnv: process.env.NODE_ENV || "development",
        port: process.env.PORT || "8080",
        supabaseConfigured: Boolean(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json", ...cors },
    },
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Notification endpoint for appointment alerts and status updates
async function handleApiNotify(request: Request): Promise<Response> {
  const cors = getCorsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  try {
    const payload = await request.json().catch(() => ({}));
    console.info("[Backend Notification API] Received event:", payload);
    return new Response(
      JSON.stringify({ ok: true, received: true, timestamp: new Date().toISOString() }),
      { status: 200, headers: { "content-type": "application/json", ...cors } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: "Failed to parse notification payload" }),
      { status: 400, headers: { "content-type": "application/json", ...cors } },
    );
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/scan" || url.pathname === "/api/validate") {
        return await handleApiScan(request);
      }

      if (url.pathname === "/api/health") {
        return handleApiHealth(request);
      }

      if (url.pathname === "/api/notify") {
        return await handleApiNotify(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
