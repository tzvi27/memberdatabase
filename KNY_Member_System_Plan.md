# Khal Nachlas Yakov — Member Management System
## Complete Project Plan

---

## Overview

A web-based member management system for Khal Nachlas Yakov. Tracks member profiles, donations (recurring, one-time, Zelle), bills/purchases, and generates invoices and tax-deductible donation receipts. Single login, used by a small team/board.

**Tech Stack:** React + Node.js/Express + PostgreSQL, hosted on Railway
**AI Integration:** Anthropic Claude API for data parsing, smart matching, content generation, and free-text cleanup

---

## Data Model

### Member Profile

**Required fields:**
- First name, last name
- Email

**Optional fields:**
- Phone
- Address (street, city, state, zip, country)
- Notes (free text)
- Status (active / inactive)
- Name for aliyah
- Wife's name (for mi shebeirach)
- Assigned seat (number, e.g. 25)

### Transactions (linked to member)

**Recurring donations** (imported from Banquest):
- Amount, frequency (monthly/annual), status, start date, next due date, description

**One-time donations** (manual entry):
- Amount, date, source (Zelle/cash/check/credit card/other), description, notes

**Zelle donations** (parsed from email uploads):
- Amount, date, sender name, transaction number, matched member

**Bills / purchases:**
- Line items (item name + amount), total, date, status (paid/unpaid/partial), notes

### Documents

**Invoices:** Generated from existing bills, itemized PDF, tracks paid/unpaid status
**Donation receipts:** Per-donation and annual summary (custom date range), PDF, includes 501c3 tax info

---

## Phase 1 — Foundation

### Feature 1.1 — Database & Member Model
- PostgreSQL database on Railway
- Member table with all fields listed above
- Unique ID auto-generated per member
- Claude API cleans messy data during import (name casing, formatting)

### Feature 1.2 — Single Login Auth
- One username + password protects the entire app
- No user roles, no multiple accounts

### Feature 1.3 — Banquest Import
- Upload Banquest export file (.txt)
- Claude API parses and cleans the data
- System matches to existing members by email
- Auto-imports: creates new members, updates changed fields on existing, attaches recurring donations
- Duplicate Banquest rows for the same person (same email) become one profile with multiple subscriptions
- Flags issues for review: no email match but similar name, missing data, anomalies
- On re-import: only fields that actually changed get updated

### Feature 1.4 — Member List View
- Table showing: name, email, status, total monthly amount, last payment date
- Search bar (by name or email)
- Click a member to open their profile

### Feature 1.5 — Member Profile View
- Top section: name, email, phone, address, status, seat number, aliyah name, wife's name
- Recurring donations section: all Banquest subscriptions (amount, frequency, description, status, start date, next due date)
- Notes section: free text, add/edit
- Actions: edit profile info, add a note

**At the end of Phase 1:** You can log in, import Banquest data, browse all members, and view individual profiles.

---

## Phase 2 — Transactions & Zelle Parsing

### Feature 2.1 — Manual One-Time Donation Entry
- Add from inside a member's profile
- Fields: amount, date, source (Zelle/cash/check/cc/other), description, notes
- Description is free text — Claude API cleans it into professional language (e.g. "kiddush spnsor shabbos parshas noach" → "Kiddush Sponsorship - Shabbos Parshas Noach")

### Feature 2.2 — Bills / Purchases
- Create from inside a member's profile
- Free text input — Claude API parses into clean itemized line items with totals (e.g. "3 chumashim $12 each, 1 siddur $8" → structured items)
- Status tracking: paid / unpaid / partial
- Internal tracking only, no member notifications

### Feature 2.3 — Zelle Email Parsing
- Upload email files or screenshots (single or batch)
- Claude API extracts: sender name, amount, date, memo/note, transaction number
- System tries to match sender to existing member
- If confident match → auto-logs to that member's profile
- If unsure → flags for review
- Free text box to override member name if Zelle sender differs from actual member (e.g. wife's name on Zelle)

### Feature 2.4 — Transaction History on Member Profile
- Separated into tabs: Donations, Bills, Recurring
- Each entry shows: date, type, description, amount, source/method, status
- Profile shows running totals:
  - Total of all donations
  - Balance owed (from unpaid bills)

**At the end of Phase 2:** You can track everything a member gives or owes, all in one profile, with Zelle auto-parsing.

---

## Phase 3 — Documents

### Feature 3.1 — Invoice Generation
- Generate from an existing bill on a member's profile
- One standard professional template
- Includes: shul logo (uploaded during setup), shul name/address, member name/address, itemized line items, total, date issued, payment status
- Output: PDF download
- Tracks paid/unpaid status

### Feature 3.2 — Donation Receipts

**Per-donation receipt:**
- Generated from a member's profile for a specific donation
- Redesigned version of existing template (cleaner, same info)
- Includes: shul logo, "OFFICIAL TAX-DEDUCTIBLE DONATION RECEIPT", member name, amount, date, payment method/transaction info
- Tax language: "No goods or services were provided in return for the contribution."
- Tax info: "Khal Nachlas Yakov is a tax-exempt charity under the IRS code section 501c3, Tax ID# 82-5289705"
- Output: PDF download

**Annual summary receipt:**
- Generated from a member's profile
- Custom date range (you pick start and end dates)
- Lists all donations within that range (recurring + one-time + Zelle) with dates and amounts
- Grand total
- Same tax language and org info
- Output: PDF download

**At the end of Phase 3:** You can produce professional invoices and tax-deductible receipts.

---

## Phase 4 — Dashboard & Polish

### Feature 4.1 — Dashboard Page
Four summary cards:
1. Total active members
2. Monthly recurring revenue
3. Failed / needs attention count
4. Outstanding unpaid bills

Clean, at-a-glance view. No charts or graphs — just the numbers.

### Feature 4.2 — App Navigation
- Two main pages: Dashboard and Members
- Navigation between them (sidebar or top nav — will be decided during design)
- Clean, minimal, professional design

### Feature 4.3 — Member List (already built in Phase 1, now polished)
- Lives on its own page/tab separate from dashboard

**At the end of Phase 4:** The full product is live — dashboard, member management, transactions, documents, all polished.

---

## Claude API Usage Summary

| Use Case | What It Does |
|---|---|
| Banquest import parsing | Cleans messy data, normalizes names/addresses, structures records |
| Smart matching | Identifies duplicate members, links donations to correct profiles by email/name |
| Zelle email parsing | Reads email files/screenshots, extracts sender, amount, date, transaction number |
| Free text cleanup | Cleans donation descriptions and bill line items into professional language |
| Invoice/receipt content | Formats document content for PDF generation |

---

## Build Approach

MVP approach: get a working version with everything basic across all phases, then polish. No phase needs to be perfect before moving to the next — functional first, refined later.
