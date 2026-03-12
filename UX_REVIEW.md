# User-Side Experience Review (Plain Language)

## What I looked at
I reviewed the screens and flows from a user point of view (login, dashboard, members, donors, imports, unmatched donations, zelle, profile screens), and I also launched the app to validate behavior.

## Biggest issues to fix first (high impact)

1. **When data cannot load, users get stuck with almost no help.**  
   Example: dashboard only says “Failed to load dashboard.” There is no “Try again” button, no setup message, and no direction on what to do next.

2. **A lot of important actions are hidden behind tiny text links.**  
   Things like adding donations, changing recurring descriptions, downloading receipts, and status actions are easy to miss.

3. **Too many silent failures.**  
   In several places, if something goes wrong, the app just does nothing (or logs in the background). Users need clear success/failure messages.

4. **Risky actions need stronger safety rails.**  
   Permanent delete + merge are available, but users should get clearer warnings, “type to confirm” for deletes, and undo/recovery options where possible.

5. **The app is desktop-first and table-heavy.**  
   It likely feels cramped on smaller laptops/tablets/phones due to many wide tables and fixed columns.

---

## Screen-by-screen feedback

### Login
- Good: simple and fast.
- Annoyance: only “Invalid credentials” is shown; no hint for other issues (server unavailable, setup incomplete, etc.).
- Add:
  - “Show password” toggle.
  - Better error messages (“Can’t connect right now”, “System not configured”, etc.).

### Sidebar / navigation
- Good: clear main sections.
- Annoyance: no quick links for “most common tasks” (like add member, unmatched donations, recent imports).
- Add:
  - A “Quick Add” button always visible.
  - Badge counters in nav (e.g., unmatched count).

### Dashboard
- Good: strong summary cards and donation breakdown concept.
- Annoyances:
  - If loading fails, page feels dead-end.
  - “Custom date range” has no clear “apply/reset” behavior for users.
  - Some cards look clickable while some are not; can be confusing.
- Add:
  - Retry button.
  - Friendly empty/error state with next steps.
  - Clear visual signal for clickable vs non-clickable tiles.

### Members list
- Good: search + pagination + visible monthly amount.
- Annoyances:
  - Row-click navigation can cause accidental opens.
  - Duration column uses symbols like `*` that are not obvious.
  - No multi-select/bulk actions.
- Add:
  - Small help tooltip explaining duration format in plain words.
  - Optional explicit “Open” button per row.
  - Bulk actions (status update, export, notes).

### Member profile
- Good: lots of details in one place.
- Annoyances:
  - Very dense page; easy to miss important controls.
  - Edit mode can feel risky without clear save-confirm feedback.
  - Many small action links (download/receipt/add) are not prominent.
- Add:
  - Toast messages for save success/failure.
  - Sticky action bar with Save/Cancel when editing.
  - Better grouping of “money actions” vs “profile details”.

### Import flow
- Good: strong preview-before-confirm approach.
- Annoyances:
  - Destructive options (“clear all”) feel too close to normal flow.
  - Confirm actions should be even more explicit.
- Add:
  - Separate “Danger Zone” visual block.
  - Extra confirmation text (“type DELETE”).
  - Post-import “what changed” report with links.

### Unmatched donations / Zelle / Donors
- Good: dedicated sections are the right idea.
- Annoyance:
  - If matching fails or data is incomplete, users need guided next steps (not just raw lists).
- Add:
  - “Suggested match” quality labels.
  - One-click “mark reviewed” or “skip for now”.
  - Better filtering chips and saved filters.

---

## Buttons and features that should be added

- Global **Undo last action** (or at least a short rollback window for critical changes).
- **Recent activity panel** (who changed what, when).
- **Saved filters/views** (especially for members and unmatched items).
- **Export current view** button in list pages.
- **Keyboard shortcuts** for power users (search, add member, save).
- **Print-friendly profile** summary.

---

## Overall feeling as a user
The app has strong fundamentals and useful sections, but it currently feels more like an internal tool for expert users than a polished day-to-day system. Main opportunity: make failure states friendlier, make important actions more obvious, and reduce fear around risky actions.
