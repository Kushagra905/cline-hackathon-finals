import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { calculateBorrowingCost } from "../src/finance/calculate.js";
import { compareDocuments } from "../src/finance/compare.js";
import { missingCriticalKeys, toConfirmedFacts, type DocFields } from "../src/finance/facts.js";
import { ExtractedField, FieldKey } from "../src/shared/schema.js";
import { ExtractionError, extractDocument, isConfigured, lastToolsExposed } from "./cline/client.js";
import { checkImageBytes, MAX_IMAGE_BYTES } from "./image.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFile = join(root, ".env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile); // loads into process.env; contents never printed

const app = express();
app.disable("x-powered-by");
// behind a hosting proxy (Render, Railway, Fly...) req.ip must come from X-Forwarded-For
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

// --- protection for the paid endpoint (protects credits) ---
// per-IP: 12 extractions/minute; global: EXTRACT_MAX_PER_HOUR (default 120) across all users.
const hits = new Map<string, number[]>();
const globalHits: number[] = [];
const GLOBAL_MAX_PER_HOUR = Number(process.env.EXTRACT_MAX_PER_HOUR ?? 120);
function rateLimit(ip: string, max = 12, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5_000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k); // bound memory
  while (globalHits.length && now - globalHits[0] >= 3_600_000) globalHits.shift();
  if (arr.length > max || globalHits.length >= GLOBAL_MAX_PER_HOUR) return false;
  globalHits.push(now);
  return true;
}

app.get("/api/status", (_req, res) => {
  res.json({
    aiConfigured: isConfigured(),
    maxImageMb: MAX_IMAGE_BYTES / 1024 / 1024,
    toolsExposedToModel: lastToolsExposed.names, // null until the first extraction
  });
});

/**
 * POST /api/extract/:kind  (kind = offer | kfs)
 * Body: raw image bytes (Content-Type: application/octet-stream). Held in memory only.
 */
app.post(
  "/api/extract/:kind",
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES + 1024 }),
  async (req, res) => {
    const kind = req.params.kind;
    if (kind !== "offer" && kind !== "kfs") return void res.status(400).json({ error: "bad_kind" });
    if (!rateLimit(req.ip ?? "local")) return void res.status(429).json({ error: "rate_limited" });
    const body = req.body as Buffer | undefined;
    const check = checkImageBytes(body ? new Uint8Array(body) : new Uint8Array());
    if (!check.ok) return void res.status(400).json({ error: check.reason });
    try {
      const { extraction, meta } = await extractDocument(kind, new Uint8Array(body as Buffer), check.mediaType);
      res.json({ extraction, source: "live-ai", modelId: meta.modelId, toolsExposed: meta.toolsExposed, toolCalls: meta.toolCalls });
    } catch (e) {
      const err = e instanceof ExtractionError ? e : new ExtractionError("model_failed", "Extraction failed.");
      const status = err.code === "not_configured" ? 503 : err.code === "timeout" ? 504 : 502;
      res.status(status).json({ error: err.code, message: err.message });
    }
  },
);

// --- stateless calculate: the browser sends fields + the keys the USER confirmed ---
const DocPayload = z.object({
  fields: z.array(ExtractedField),
  confirmedKeys: z.array(FieldKey),
});
const CalcPayload = z.object({ offer: DocPayload.optional(), kfs: DocPayload });

app.post("/api/calculate", express.json({ limit: "256kb" }), (req, res) => {
  const p = CalcPayload.safeParse(req.body);
  if (!p.success) return void res.status(400).json({ error: "bad_request" });
  const offer: DocFields | undefined = p.data.offer;
  const kfs: DocFields = p.data.kfs;
  const comparison = compareDocuments(offer, kfs);
  const blocking = missingCriticalKeys(kfs);
  if (blocking.length > 0) {
    // Missing/unconfirmed critical facts block any numerical conclusion.
    return void res.json({ blocked: true, missing: blocking, comparison });
  }
  const calculation = calculateBorrowingCost(toConfirmedFacts("kfs", kfs));
  res.json({ blocked: false, calculation, comparison });
});

// synthetic sample documents (clearly labelled fixtures; contain no real data)
app.use("/samples", express.static(join(root, "fixtures"), { index: false, extensions: ["png"] }));

// --- static client (built by `npm run build`) ---
const dist = join(root, "dist", "client");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dist, "index.html")));
}

// Locally binds to loopback only. Hosting platforms set PORT, so then bind all interfaces (override with HOST).
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const server = app.listen(port, host, () => {
  console.log(`LoanClear server on http://${host}:${port} (AI ${isConfigured() ? "configured" : "NOT configured"})`);
});
// the extraction itself times out at 90 s (server/cline/client.ts); cap whole requests a little above that
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
