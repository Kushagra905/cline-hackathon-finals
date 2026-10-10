# LoanClear: architecture

Planned design. Status of each piece is tracked in HANDOFF.md; "exists" below means present in the repo now.

## Stack
One TypeScript app on Node >= 22: Express server plus Vite/React front end (not yet installed), Vitest for tests, zod for schemas. No database. Sessions are an in-memory Map with a TTL; uploaded images are never persisted.

## Layout
| Path | Purpose | Status |
|---|---|---|
| `src/shared/schema.ts` | zod schemas and shared types (field, extraction, correction, session, confirmed facts, results) | exists |
| `src/finance/money.ts` | rupee-string to paise parsing (Indian grouping, Hindi digits), formatting, day difference | exists |
| `src/finance/calculate.ts` | pure borrowing-cost calculation | exists |
| `src/finance/calculate.test.ts` | tests for the above | exists |
| `scripts/sdk-smoke.ts`, `scripts/m0-validate.ts` | Milestone 0 SDK spike and its validator | exists, not yet run against a real model |
| `scripts/make-fixtures.ps1`, `fixtures/` | synthetic labelled PNG fixtures and expected values | exists |
| `server/` (Express routes, store, `cline/client.ts`, `cline/tools.ts`, prompts) | API and the only place that imports the SDK | planned |
| `src/finance/compare.ts` | cross-document comparison | planned |
| `src/web/` | React UI | planned (not in Milestone 0) |

## SDK facts verified from installed typings (@cline/sdk 0.0.92)
- `@cline/sdk` re-exports `@cline/core` only. `Agent`, `createAgentRuntime` and `createTool` are exported from it. The `AgentMessage`/`AgentRunResult` types are not; derive them from `Agent` (see `scripts/sdk-smoke.ts`).
- `new Agent({ providerId, modelId, apiKey?, baseUrl?, headers?, systemPrompt?, tools?, maxIterations?, completionPolicy? })`. `agent.run(input)` takes `string | AgentMessage | AgentMessage[]` and returns `{ status, iterations, outputText, messages, usage, error? }`.
- Image input is a message content part `{ type: "image", image: string | Uint8Array | ArrayBuffer | URL, mediaType? }` alongside `{ type: "text", text }`.
- `createTool({ name, description, inputSchema: zodSchema, execute, lifecycle: { completesRun }, timeoutMs })`.
- Provider ID `"cline"` exists; its provider metadata lists `CLINE_API_KEY` as the API key env var and base URL `https://api.cline.bot/api/v1`.
- Not yet verified at runtime: that the key authenticates, that the chosen model accepts images, and whether `Agent` registers any built-in tools or writes to disk. Only tools passed in `tools` are intended to be available.

## Trust boundaries
- Documents go in a user turn; the system prompt states they are untrusted evidence.
- Model output is zod-validated; `found` needs non-empty supporting text.
- No tool sets confirmation. Confirmation exists only as a UI-driven server route.
- The extraction agent has no calculation tool. Calculation reads server-held confirmed facts.
- The API key is read server-side only from `process.env.CLINE_API_KEY`; never sent to the browser, logged, or committed.

## Session states
created, uploaded, extracting, extracted, reviewing, confirmed, calculated, failed. Correcting after `confirmed` returns to `reviewing`. `confirmed` is rejected unless every critical key is confirmed.
