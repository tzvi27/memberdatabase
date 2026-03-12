# Processing Rules Review + Open-Source Benchmark Notes

## Why this file
You asked for a deeper look at the **information processing rules** (imports, matching, dedupe, confirmations) before narrowing UX fixes.

This review focuses on:
1. Is the current processing logic solid?
2. Where could data quality break?
3. What ideas from similar open-source systems are worth copying?

---

## 1) What is solid already

- **Preview → Confirm flow exists** for imports, which is the right foundation for safety.
- **Duplicate checks exist** using external transaction IDs before confirming imports.
- **Manual match flow exists** and can create a reusable match rule for future records.
- **Rerun matching exists**, so old unmatched records can be reprocessed after new members/donors are added.

These are all good building blocks and better than many early-stage internal tools.

---

## 2) Biggest processing risks to fix first

### A) Import preview state is global in memory (cross-user risk)
Current behavior keeps one global `pendingData` object on the server.

Why this matters:
- If two admins import at the same time, one person’s preview can overwrite the other’s.
- Confirming may process the wrong file preview.
- Restarting server loses pending preview.

Impact: **high** (data integrity + trust risk).

### B) AI fallback is used for file type detection
When rule-based detection fails, the first chunk of uploaded content can be sent to Anthropic for classification.

Why this matters:
- Privacy/compliance concern for financial/member data.
- Not deterministic enough for critical import routing.

Impact: **high** in organizations with strict data handling expectations.

### C) Dangerous clear endpoints rely mostly on UI warnings
`clear-all` and `clear-credit-card` are powerful operations.

Why this matters:
- If a token/session is compromised or a user clicks wrong, data loss is immediate.
- Server-side guardrails are minimal (no second factor, no typed confirmation token at API layer).

Impact: **high** (irreversible destructive operations).

### D) Matching logic is mostly exact-name and can miss real matches
Matching works mainly by exact email/name and wife-name maps.

Why this matters:
- Real donation data often has spelling variance, initials, punctuation, swapped names.
- More records stay unmatched, creating manual cleanup burden.

Impact: **medium-high** (operations overhead).

### E) Per-record import writes are not transaction-batched
Confirm flows loop and create records one-by-one.

Why this matters:
- If import fails in the middle, partial imports can happen.
- Harder to re-run safely if no run-level import checkpoint exists.

Impact: **medium-high** (consistency/recovery concerns).

---

## 3) Recommended rule hardening (practical order)

### Priority 1 (do now)
1. Replace global `pendingData` with per-user/import-session records in DB.
2. Add server-side protection for destructive routes:
   - role check,
   - short-lived confirmation nonce,
   - optional typed phrase in API payload.
3. Add import run IDs and atomic boundaries (batch transaction or chunk + checkpoint).
4. Add a simple “processing audit trail” per import run:
   - file hash,
   - uploader,
   - preview counts,
   - confirmed counts,
   - timestamp.

### Priority 2
1. Normalize names before matching (case, punctuation, extra spaces, common prefixes).
2. Add confidence scoring to matches (`high`, `medium`, `low`) and auto-match only high.
3. Keep medium/low in review queue with reasons (“matched by wife name”, “matched by exact name only”).

### Priority 3
1. Add dry-run reprocessing mode for unmatched queue.
2. Add reversible “unmatch last batch” for operations safety.

---

## 4) Open-source benchmark ideas that apply well here

I was unable to directly fetch web pages from this environment (proxy tunnel returned 403), so the notes below are based on established open-source CRM/ERP patterns commonly used in projects like CiviCRM / ERPNext / Odoo ecosystems.

### Pattern: staged imports with explicit job records
Common approach:
- create an import job,
- parse into staging table,
- present conflicts,
- commit with job ID,
- keep full job history.

Why to copy:
- Solves cross-user preview collisions.
- Gives rollback/traceability.

### Pattern: rule-based + confidence matching
Common approach:
- deterministic normalization rules first,
- weighted scoring for candidate matches,
- human review queue for anything below threshold.

Why to copy:
- Reduces false positives and manual work.
- Gives users confidence labels instead of silent assumptions.

### Pattern: immutable audit + reversible admin operations
Common approach:
- every sensitive operation gets an audit entry with actor, before/after, reason,
- destructive operations require stronger confirmation,
- batch operations can be reverted when possible.

Why to copy:
- Better admin trust and easier incident recovery.

### Pattern: idempotency keys for imports
Common approach:
- each import row has a stable external key/hash,
- repeats are ignored safely.

Why to copy:
- Makes re-importing safe when files are rerun.

---

## 5) Bottom line
Your current processing rules are a good foundation, but to be “solid” for long-term operational trust, the biggest upgrades are:

1. **Per-user import sessions in DB (not global memory)**
2. **Stronger server guardrails on destructive actions**
3. **Import job/audit model with checkpointing**
4. **Confidence-based matching instead of only exact matching**

If you want, next step I can turn this into a very short “Fix Plan” with:
- must-do this week,
- should-do this month,
- nice-to-have later.
