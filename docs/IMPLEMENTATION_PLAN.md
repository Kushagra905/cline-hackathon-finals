# LoanClear: implementation plan

Scope is in SCOPE.md, design in ARCHITECTURE.md, live status in HANDOFF.md. Do not create a competing plan; edit this one.

| Milestone | Exit condition | Status |
|---|---|---|
| M0 SDK spike | Real SDK model call, real image extraction on labelled synthetic fixtures, bounded custom tool call, all recorded with model ID | Prepared. Blocked on credentials (see HANDOFF.md) |
| M1 Schema and finance | zod schemas and finance module pass tests | Code exists (written earlier). Partly tested; comparison, gating and fuller edge tests still to do |
| M2 Extraction pipeline | Both documents extract separately, output validates, EN and HI fixtures pass a manual check | Not started |
| M3 Review UI and corrections | Confirm/correct flow; state machine rejects early calculate | Not started |
| M4 Calculate, compare, results | Results show rupee cost, sourced diffs, caveats; EN/HI explanations | Not started |
| M5 Injection, errors, limits | Injection fixture passes; size and rate limits; readable errors | Not started |
| M6 Deploy and submission | Public URL; README; actual PPT; recorded demo video; public repo with no secrets | Not started |

Rules: M0 is the only active milestone. Cut stretch goals before the confirmation gate. No APR, verdicts, recommendations or extra integrations.

## Fallback if the SDK cannot do images or auth
Try `@cline/llms` gateway, then the OpenAI-compatible endpoint with the same key, and disclose it clearly because SDK use is a requirement. Do not decide this until the M0 run has actually failed.

## Test plan (finance, Vitest)
Net credited minus nothing double counted; principal-only gives `missing_net_credited`; paise parsing (Indian grouping, Hindi digits); repayment below net credited errors; unsupported structures; gating of critical keys; comparison of equivalent concepts only; qualifier carried through; mocked-LLM route tests that never count as SDK verification.
