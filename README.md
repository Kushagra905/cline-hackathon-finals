# LoanClear

**Know what you receive. Know what you repay.**

LoanClear compares an advertised loan offer with the final terms / Key Facts Statement (KFS). AI reads the screenshots; **you** confirm every fact; plain code calculates. It gives facts only: no APR, no "scam/safe" verdicts, no recommendations.

> Hackathon prototype. Not deployed publicly yet (see [Deployment](#deployment)). Not validated with real users.

## Problem
A borrower in India often sees a headline offer ("₹9,500 credited") and later receives final terms where charges are withheld at disbursal, so less money arrives than expected, and the repayment total is somewhere else on the page. Working out *how much actually reaches you*, *how much you pay back* and *what changed since the offer* means reading two documents and doing the arithmetic yourself.

**Intended user:** someone comparing a small-ticket digital loan offer with its final terms before they accept, in English or Hindi.

## Workflow
1. **Upload**: final terms / KFS (required) and the advertised offer (optional), as PNG/JPEG screenshots up to 8 MB. You can also use the labelled **synthetic example**.
2. **Extract**: each document is read separately by a live AI call through the Cline SDK. Every value comes with supporting text from the document, or is marked *missing* / *ambiguous*.
3. **Review**: the offer and final-terms values are aligned field by field, each with a plain-language meaning. Edit anything that is wrong; an edited value is labelled **User edited**, and the original quote is shown only as history, never as proof of the edit.
4. **Confirm**: only your clicks confirm facts. Net credited, total repayment and tenure must be confirmed, or no number is shown. Editing a fact removes its confirmation and clears the old result.
5. **Costs**: code calculates **You receive**, **You repay**, **Borrowing cost** (repayment − net credited) and **Repayment period**, and then compares like-for-like quantities between offer and final terms, with evidence from both documents.

Switch between English and हिन्दी at any time; financial values are identical in both.

## Architecture
```
React + Vite (src/web)  ──image bytes──▶  Express API (server/index.ts)
                                            │  PNG/JPEG magic bytes, 8 MB limit, rate limits
                                            ▼
                                  Cline SDK Agent (server/cline/client.ts)
                                    vision model + ONE app tool: submit_extraction
                                            ▼
                                  zod schema + normalisation (server/cline/normalize.ts)
                                            ▼
          browser: user reviews / edits / confirms (confirmation lives only in browser state)
                                            ▼
          POST /api/calculate ─▶ deterministic finance (src/finance/*, integer paise, no AI)
```
- **The model extracts; code calculates.** The model's only tool submits fields. It cannot confirm anything or compute results.
- Money is held in **integer paise** throughout (`src/finance/money.ts`). Principal is never substituted for net credit. Withheld fees are already inside net credited and are never added again.
- Supported structure: one disbursement and one end-of-term repayment. Anything else is reported as unsupported.
- Documents are held in memory for the request only; the app never writes them to disk.

**Stack:** TypeScript, React 19, Vite 8, Express 5, zod 4, `@cline/sdk` 0.0.92, Vitest, puppeteer-core (E2E).
**Runtime model:** `anthropic/claude-sonnet-5.5` via `providerId: "cline"` (set by `CLINE_MODEL_ID`).

## How Cline was used
- **During development:** Cline (in VS Code) did the planning, scope documents (`docs/`), implementation, debugging (SDK auth/image/tool checks in `scripts/sdk-smoke.ts`), the test suites and the UI redesign. Results were recorded in `docs/HANDOFF.md`.
- **Inside the product:** the server embeds the **Cline SDK** (`Agent`, `createTool`). Each document gets one agent run with a vision model and a single custom tool, `submit_extraction`, whose input is a zod schema. The server records which tools the SDK actually offered to the model (observed: only `submit_extraction`) and reports this with the model ID and tool-call count in the app's "How this analysis works" panel.

## Local setup
Requires Node ≥ 22 and a Cline API key.
```bash
npm install
copy .env.example .env.local      # Windows (cp on macOS/Linux); fill CLINE_API_KEY and CLINE_MODEL_ID
npm run build                     # typecheck + client build into dist/client
npm start                         # http://127.0.0.1:8787
```
Credentials are **server-side only**, read from `.env.local` (git-ignored) or real environment variables. `.env.example` contains placeholders only. The key is never sent to the browser or returned by the API.

Other scripts: `npm test` (unit tests), `npm run e2e` (browser flow against a running server; live AI; needs Edge/Chrome; `LC_URL` overrides the URL), `npm run sdk:smoke` (real SDK auth/image/tool check), `npm run dev` (server with watch), `npm run dev:web` (Vite dev server proxying `/api`), `npm run fixtures:make` (regenerate synthetic sample PNGs, Windows).

## Synthetic demo scenario
`fixtures/` contains made-up documents for a fictional "QuickCash Demo" lender, each with a visible *SYNTHETIC TEST FIXTURE – NOT A REAL LENDER* banner:
- **Offer:** "We credit ₹9,500".
- **Final terms:** principal ₹10,000, charges withheld ₹2,000, net credited ₹8,000, total repayment ₹10,500, one payment after 30 days.
- **Result after confirmation:** you receive ₹8,000, you repay ₹10,500, borrowing cost ₹2,500, 30 days. Separately, **₹1,500 less** is credited than the offer stated.
- A third fixture omits net credit, which shows that the calculation is blocked instead of guessing from the principal.

## Verification (latest run)
- `npm run build` (both typechecks + Vite build): pass (exit 0).
- `npm test`: 26/26 pass (finance, comparison and gating, server normalisation, image validation, M0 validator).
- `npm run e2e` on **live AI**, against the server in production mode (`PORT` set, built client): **53/53 pass**. Covers sample → extraction → review → confirmation → result (₹8,000 / ₹10,500 / ₹2,500 / 30 days, with the −₹1,500 change shown separately), missing net credit blocking, edit invalidation and the User-edited label, EN/HI with identical values, keyboard focus, touch targets, and no horizontal overflow at 1366px and 390px.
- Production-mode server check: binds `0.0.0.0` when `PORT` is set, serves the built client, rejects non-image bytes (400), an unknown document kind (400) and >8 MB bodies (413); the browser bundle contains no credential names.

## Deployment
Not deployed yet. The app is one Node service and is ready for any Node host:
- **Build:** `npm ci --include=dev && npm run build` · **Start:** `npm start`
- **Env:** `CLINE_API_KEY` (secret), `CLINE_MODEL_ID`, optional `TRUST_PROXY=1` behind a proxy and `EXTRACT_MAX_PER_HOUR`. `PORT` is read automatically; when it is set the server binds `0.0.0.0`.
- **Render:** `render.yaml` is included. In Render choose *New → Blueprint*, select this repository, enter `CLINE_API_KEY` when prompted, deploy, then open `/api/status` (it should report `aiConfigured: true`).
- **Protection:** 8 MB body limit, magic-byte validation, 12 extractions per IP per minute, a global hourly cap (default 120), a 90 s model timeout and a 120 s request timeout.

## Limitations
- Single-page PNG/JPEG only; no PDF or multi-page documents.
- One disbursement and one final repayment only; instalment schedules are reported as unsupported.
- Hindi *documents* have not been tested (the Hindi UI is). Extraction quality on real lender documents has not been evaluated.
- The calculation endpoint is stateless and trusts the confirmed keys sent by the browser (there are no accounts or sessions, by design).
- Rate limits are held in memory per server instance.

## Future scope
Multi-page / PDF documents, instalment schedules, more Indian languages, and an evaluation set of real (consented, redacted) documents.
