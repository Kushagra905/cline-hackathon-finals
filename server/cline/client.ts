/**
 * The ONLY module that imports the Cline SDK. Extraction adapter:
 *   extractDocument(kind, bytes, mediaType) -> DocumentExtraction (via a real SDK model call)
 * Credentials: process.env.CLINE_API_KEY (server only). Model: process.env.CLINE_MODEL_ID.
 * Image bytes are held in memory for the call only and are never written to disk.
 */
import { Agent, createTool } from "@cline/sdk";
import type { DocumentExtraction, DocumentKind } from "../../src/shared/schema.js";
import { ModelExtraction, normalizeExtraction } from "./normalize.js";
import { EXTRACTION_SYSTEM_PROMPT, userInstruction } from "./prompts.js";

type AgentInstance = InstanceType<typeof Agent>;
type RunInput = Parameters<AgentInstance["run"]>[0];
type RunResult = Awaited<ReturnType<AgentInstance["run"]>>;

const MAX_ITERATIONS = 3;
const TIMEOUT_MS = 90_000;

export class ExtractionError extends Error {
  constructor(
    public code: "not_configured" | "model_failed" | "bad_output" | "timeout",
    message: string,
  ) {
    super(message);
  }
}

export interface ExtractionMeta {
  modelId: string;
  /** tool names the SDK actually sent to the model on the last call (to inspect built-ins) */
  toolsExposed: string[];
  /** how many times the app-specific submit_extraction tool actually executed in this run */
  toolCalls: number;
  usage?: unknown;
}

export const lastToolsExposed: { names: string[] | null } = { names: null };

export function isConfigured(): boolean {
  return Boolean(process.env.CLINE_API_KEY?.trim() && process.env.CLINE_MODEL_ID?.trim());
}

function redact(msg: string): string {
  const k = process.env.CLINE_API_KEY?.trim();
  return k ? msg.split(k).join("[redacted]") : msg;
}

export async function extractDocument(
  kind: DocumentKind,
  bytes: Uint8Array,
  mediaType: "image/png" | "image/jpeg",
): Promise<{ extraction: DocumentExtraction; meta: ExtractionMeta }> {
  const apiKey = process.env.CLINE_API_KEY?.trim();
  const modelId = process.env.CLINE_MODEL_ID?.trim();
  if (!apiKey || !modelId) {
    throw new ExtractionError("not_configured", "AI extraction is not configured on the server.");
  }

  let captured: unknown;
  let calls = 0;
  const toolsExposed = new Set<string>();

  // The only tool: submit structured fields. It has no side effects and cannot confirm anything.
  const submit = createTool({
    name: "submit_extraction",
    description: "Submit the extracted fields for the single document in the image. Call exactly once.",
    inputSchema: ModelExtraction,
    lifecycle: { completesRun: true },
    timeoutMs: 10_000,
    execute: async (input: ModelExtraction) => {
      calls += 1;
      if (calls === 1) captured = input;
      return { received: true };
    },
  });

  const agent = new Agent({
    providerId: "cline",
    modelId,
    apiKey,
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    tools: [submit],
    maxIterations: MAX_ITERATIONS,
    completionPolicy: { requireCompletionTool: true },
    hooks: {
      beforeModel: (ctx: { request: { tools: readonly { name: string }[] } }) => {
        for (const t of ctx.request.tools) toolsExposed.add(t.name);
        return undefined;
      },
    },
  });

  const message = {
    id: `doc-${kind}`,
    role: "user",
    createdAt: Date.now(),
    content: [
      { type: "text", text: userInstruction(kind) },
      { type: "image", image: bytes, mediaType },
    ],
  };

  let timer: NodeJS.Timeout | undefined;
  try {
    const run = agent.run(message as unknown as RunInput) as Promise<RunResult>;
    const timeout = new Promise<never>((_, rej) => {
      timer = setTimeout(() => {
        agent.abort("timeout");
        rej(new ExtractionError("timeout", "The AI model took too long to respond."));
      }, TIMEOUT_MS);
    });
    const r = await Promise.race([run, timeout]);
    lastToolsExposed.names = [...toolsExposed];
    if (captured === undefined) {
      throw new ExtractionError(
        "model_failed",
        `The model did not return structured fields (${r.status}${r.error ? ": " + redact(r.error.message) : ""}).`,
      );
    }
    let extraction: DocumentExtraction;
    try {
      extraction = normalizeExtraction(captured, kind);
    } catch (e) {
      throw new ExtractionError("bad_output", (e as Error).message);
    }
    return { extraction, meta: { modelId, toolsExposed: [...toolsExposed], toolCalls: calls, usage: r.usage } };
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError("model_failed", redact(e instanceof Error ? e.message : String(e)));
  } finally {
    if (timer) clearTimeout(timer);
  }
}
