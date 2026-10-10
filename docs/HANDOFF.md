# LoanClear: handoff

Last updated after the recovery session. Active milestone: M0 only.

## Status: Milestone 0 verified; first vertical slice runs locally

### Run
```
npm install
copy .env.example .env.local      # then fill CLINE_API_KEY and CLINE_MODEL_ID locally (git-ignored; never commit/print)
npm run build                     # typecheck + client build
npm start                         # http://127.0.0.1:8787
npm test                          # vitest
npm run sdk:smoke                 # real SDK auth/image/tool check
npm run e2e                       # browser flow vs the running server (live AI; needs Edge/Chrome)
npm run fixtures:make             # regenerate synthetic sample PNGs (Windows PowerShell)
```

### M0 results (real calls, no mocks): `npm run sdk:smoke`
- SDK `@cline/sdk` 0.0.92, `providerId: "cline"`, key from `CLINE_API_KEY`. Model: `anthropic/claude-sonnet-5.5`.
- Auth + model call: PASSED (29 in / 5 out tokens, cost $0.000108).
- Image extraction (offer, KFS synthetic PNGs via SDK image part): PASSED; offer net credited 950000 paise with principal/repayment missing; KFS 1000000/800000/200000/1050000 paise and 30 days.
- Custom tool (`loanclear_ping`, executed once): PASSED. Total cost across the four calls was about $0.009.
- No SDK repair attempts were needed.

### Built-in tools check
The server records the tool names the SDK sends to the model (`beforeModel` hook). Observed: only `submit_extraction`. Also exposed at `/api/status` as `toolsExposedToModel`. No shell, file or browsing tools were exposed in these runs. No document is written to disk by the app; `scripts/out/` (ignored) only holds smoke-test output. Whether the SDK itself writes session files elsewhere was not inspected.

### Working features (verified by `npm run e2e`, 22/22 PASS on live AI)
- Two PNG/JPEG uploads (offer optional, final terms required) plus labelled synthetic samples (`fixtures/`, served at `/samples`). Bytes validated by magic bytes, 8 MB limit, held in memory only.
- Real server-side extraction through the SDK, one model call per document, with supporting text and explicit missing/ambiguous. Responses carry `source: live-ai`; the UI badge only shows for those.
- Editable facts and per-field user confirmation. Confirmation exists only in browser state set by a click; the model has no tool to set it. Edits un-confirm a field and clear the result.
- Deterministic paise calculation (existing finance module): net credited, total repayment, borrowing cost, duration. Missing/unconfirmed net credited, repayment or tenure (or unreviewed separate-charge/repayment-count flags) block the number.
- Comparison of equivalent quantities with evidence from both documents; principal is never treated as net credit; one-sided concepts are "not comparable".
- English/Hindi toggle with result templates.
- Tests: 23 passing (finance, comparison and gating, server normalisation, image validation, M0 validator). Typecheck and build pass.

### Remaining / not done
- Hindi-language document fixtures were not created or run (AC11 unverified); Hindi UI only.
- Mobile layout checked by CSS only, not in a browser.
- Server calculation is stateless: it trusts the browser's confirmed keys (no login or sessions, per scope). So "AI cannot confirm" is enforced because the model never writes browser state.
- No PPT, demo video, README or deploy yet (submission phase). No rate-limit/injection fixture test yet.
- Cost/usage per request is returned by the SDK but not displayed.

## Recovery notes (history)
The repo was recovered from a Git stash (`6a210bc`): package files, `src/finance/money.ts`, `calculate.ts` and `src/shared/schema.ts` were preserved. The ~10K Source Control entries were `node_modules`, now ignored along with build output and secret env files (`.env.example` stays tracked). Single local setup path: `.env.local`.

## Next single action
Commit is done for this slice. Next: add Hindi-document fixtures and an injection fixture, run them through live extraction, then README, PPT and demo video.