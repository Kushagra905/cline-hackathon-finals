# LoanClear: handoff

Last updated after the submission finalisation pass (see "Final state" below).

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

## Final state (submission pass)
- App complete for the supported scope; README.md is the main document.
- Deployment-ready, **not deployed**: binds `0.0.0.0` when `PORT` is set (`HOST` overrides), `TRUST_PROXY`, global hourly extraction cap `EXTRACT_MAX_PER_HOUR` (default 120) on top of 12/min per IP, 120 s request timeout. `render.yaml` Blueprint added (secret `CLINE_API_KEY` set in the dashboard). The UI shows clear EN/HI messages for rate-limit and timeout errors.
- Verified this pass: build exit 0; 26/26 unit tests; `npm run e2e` 53/53 on live AI against a `PORT=8790` production-mode server; 400 for bad bytes or kind, 413 above 8 MB; no credential names in the client bundle.
- Runtime: `@cline/sdk` 0.0.92, model `anthropic/claude-sonnet-5.5`.
- **Deployed:** https://loanclear.onrender.com (Render Blueprint, free plan, auto-deploys from `main`). Verified: `/api/status` 200 with `aiConfigured: true`, client and samples served, bad bytes 400, no credential names in the bundle, and `npm run e2e` **53/53 on live AI against the public URL**.
- Free plan spins down when idle (first request can take ~50 s); open the site before a demo.
- Remaining (not code): restart any local `npm start` to pick up the server changes; submission assets (slides, demo video, form) are outside this repo pass.

## Frontend redesign pass (Arto Plus layout + OOZE typography)
- Shell: sticky top bar (LC wordmark, EN/HI toggle), 212px workflow rail on desktop mapped to the existing 5 steps; compact horizontal progress bar + "Step n of 5" on ≤860px.
- Upload: two panels ("Advertised offer — optional", "Final terms / KFS — required") with drop zone, preview, file name/size, Replace/Remove, per-document reading overlay, client-side PNG/JPEG + 8 MB check (server check unchanged), labelled synthetic example, action bar with next step.
- Review: `ReviewBoard` aligns offer and final-terms cells per field, grouped "What you receive" / "What you repay", each with a plain-language meaning. Edit/confirm logic is unchanged (moved into `useEditor`); "User edited" + original text shown only as history.
- Results: after a successful calculation the summary moves to the top: "You receive" / "You repay" headline figures, then borrowing cost and repayment period, then the separate net-credit change and the comparison. All values come from confirmed data/server calculation (`Money` only styles `money(paise)` output).
- CSS tokens in `styles.base.css`; also `styles.controls.css`, `styles.upload.css`, `styles.results.css`, `styles.components.css` (review + responsive, loaded last).
- Verified: build/typecheck pass, 26/26 unit tests, `npm run e2e` 53/53 on live AI (no selector changes needed). Screenshots: `scripts/out/ui-desktop-3-result-1.png`, `scripts/out/ui-mobile-1-result-1.png`.
- Not done: no manual screen-reader pass; desktop review board between 860–1100px puts the field meaning above the two cells (intended, not separately screenshotted).

## Recovery notes (history)
The repo was recovered from a Git stash (`6a210bc`): package files, `src/finance/money.ts`, `calculate.ts` and `src/shared/schema.ts` were preserved. The ~10K Source Control entries were `node_modules`, now ignored along with build output and secret env files (`.env.example` stays tracked). Single local setup path: `.env.local`.

## Next single action
Commit is done for this slice. Next: add Hindi-document fixtures and an injection fixture, run them through live extraction, then README, PPT and demo video.