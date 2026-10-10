# LoanClear: scope

Single source of truth for product scope. Architecture is in ARCHITECTURE.md, the plan in IMPLEMENTATION_PLAN.md, current state and next action in HANDOFF.md.

## Product
LoanClear compares an advertised loan offer with the final terms / Key Facts Statement (KFS). The borrower uploads PNG/JPEG screenshots, the app extracts each document separately, the borrower confirms critical facts, and only then does deterministic code compute the figures.

## Workflow
1. Upload an advertised offer and a final-terms/KFS image (PNG/JPEG, size-capped, checked by magic bytes).
2. Extract each document separately. Every field carries a value, supporting text, a document ID and a status: `found`, `missing` or `ambiguous`. A field is never silently filled.
3. The borrower reviews each field and can confirm, correct or mark it missing. Original extraction and corrections are stored separately.
4. The borrower confirms the critical facts. The server enforces this; a model cannot claim it.
5. Server code calculates and compares. The results show rupee cost, sourced differences and caveats.

## Financial rules (frozen)
- All money is integer paise. No floats, no LLM arithmetic. The model returns rupee text plus verbatim supporting text; server code parses it.
- A principal alone ("₹10,000 loan") is not a promise of that amount as net credit. With no net-credited figure, net credited stays missing.
- Compare equivalent quantities only (principal vs principal, net credited vs net credited). A concept in only one document is "not comparable", not a difference.
- Qualifiers such as "from" and "up to" are preserved and shown next to the value.
- Withheld fees: borrowing cost = total repayment − net credited. Do not add withheld fees again.
- MVP supports one disbursement and one end-of-term repayment. Separately paid charges or multiple repayments give a clear "unsupported" result with no number.
- Text inside an image is evidence, not instructions.

## Languages
English and Hindi documents; explanations in English and Hindi.

## Out of scope
APR, scam/safe verdicts, scores, lender approval claims, loan recommendations, extra integrations, persistence of uploaded images.

## Acceptance criteria
- AC1 every field has `{value, supportingText, documentId, status}`.
- AC2 original extraction and user corrections stored separately and both viewable.
- AC3 calculation refused until critical facts are confirmed, enforced server-side.
- AC4 integer paise only.
- AC5 principal-only offers leave net credited missing.
- AC6 qualifiers preserved.
- AC7 no double counting of withheld fees.
- AC8 unsupported structures return "unsupported" with no number.
- AC9 injection text in images does not change behaviour.
- AC10 no verdicts, recommendations or scores in UI or prompts.
- AC11 English and Hindi fixtures extract correctly.

## Submission deliverables
Public repository, complete README, an actual PPT, and a recorded demo video. The PPT and video are submission-phase work and do not exist yet.
