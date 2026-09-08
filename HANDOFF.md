# HANDOFF: Privacute Privacy Pulse survey

Handoff for a developer or a Claude Code session picking up this project. Read this first, then `README.md` for the deploy mechanics.

## What this is
A single-page, role-adaptive survey for **customer persona research** for Privacute (a healthcare privacy company). A respondent picks their role, answers a short tailored branch, gets a live scored result, and the answers are written to a Google Sheet the owner controls. It also runs as a lightweight lead capture (optional name/email).

Audiences: physician/practice owners, office/practice managers, hospital compliance, IT/security pros, and vendors/business associates (RCM, AI scribe, VA firms).

## Architecture (and why)
Static page on **GitHub Pages** posts each submission to a **Google Apps Script Web App**, which appends a row to a **Google Sheet**. Both accounts are ones the owner already has; nothing is paid, no third-party form service.

This path exists because two other options were ruled out, do not reopen them without reason:
- A Claude-hosted artifact cannot capture external responses: its sandbox blocks outbound POST, and the storage-enabled variant is locked to the owner's org so outside prospects cannot open it.
- The connected HubSpot app lacks the forms/CMS scope, so forms/landing pages cannot be created through it. CRM contact write does work, so a later enhancement could sync rows into HubSpot.

## Files
- `index.html` - the entire survey (HTML, CSS, JS inline). No build step, no dependencies except Google Fonts.
- `apps-script.gs` - the collector. Lives in the Google Sheet's Apps Script project, not served from the repo.
- `README.md` - end-user deploy steps (about 10 minutes).
- `HANDOFF.md` - this file.

## Config points (the only things you edit to wire it)
1. `index.html`, near the top of the `<script>` block:
   ```js
   const CONFIG = {
     ENDPOINT: "",      // paste the Apps Script /exec URL here
     CONTACT_EMAIL: ""  // target for the "Reach out to Privacute" button; blank hides it. Visible in public page source.
   };
   ```
   The reach-out button is a plain `mailto:` (prefilled with the respondent's band/score), shown on the result and thank-you screens only when `CONTACT_EMAIL` is set. No backend involved.
2. `apps-script.gs`: `SHEET_NAME` (default `Responses`) and `COLUMNS` (the sheet's column order).

## How the survey engine works
- **Data-driven.** All questions live in one array `Q`. Each item:
  ```js
  { id, type, persona, eyebrow, text, help?, options?, scored?, research?, optional?, scale?, ends?, multiline? }
  ```
  - `type`: `single` | `multi` | `scale` | `text` | `contact`.
  - `persona`: `'all'` or an array of persona keys.
  - `scored: true` counts toward the readiness meter; each option carries `s` (1 = secure/good, 0 = gap). `gapLabel` is shown on the result when that question scored 0.
  - `research: true` is captured but not scored (trigger, budget, decision-maker, etc.).
- **Personas:** `owner`, `manager`, `hospital`, `security`, `vendor`. `owner` and `manager` share the same question path by design.
- **Branching:** `buildOrder()` filters `Q` by the chosen role (`state.answers.role`). Single-select questions auto-advance after ~180ms for momentum.
- **Scoring:** `scoreData()` sums `s` over scored questions and returns `pct = round(got/count*100)`. Denominator is per-persona (branches have different scored counts), so the percentage is already normalized. `bandFor(pct)`: `>=80` strong, `>=45` gaps, else exposed.
- **Result:** `finish()` renders the band, an animated meter, a per-persona intro line, and up to 5 gap items pulled from `gapLabel`. The "not a certification" disclaimer is intentional, keep it.
- **Submit:** `submitToEndpoint()` POSTs the payload (below) to `CONFIG.ENDPOINT`.

## Accessibility / neurodivergent design (do not regress these)
One question per screen; visible progress bar; Back and Skip always available; no timers; everything optional except role; an A+ text-size toggle and a Calm mode that kills motion; `prefers-reduced-motion` honored; ARIA roles on options and scales; focus-visible outlines; large tap targets. If you refactor rendering, preserve all of the above.

## Data contract
Client sends (Content-Type `text/plain;charset=utf-8`, see gotcha below):
```json
{
  "submittedAt": "ISO-8601",
  "persona": "owner|manager|hospital|security|vendor",
  "readiness_pct": 75,
  "name": "", "email": "", "org": "", "consent": "yes|no",
  "gaps": ["short gap label", "..."],
  "answers": { "role": "...", "trigger": "...", "posture": "3", "...": "..." }
}
```
`apps-script.gs` `doPost(e)` parses `e.postData.contents`, flattens top-level fields and `answers` into the `COLUMNS` order, and `appendRow`s. `gaps` is not in `COLUMNS`, so it is ignored by the row build and used only to compose the result email. `doGet()` returns a liveness JSON so you can open the `/exec` URL in a browser to confirm it is up.

## Gotchas (each of these will bite if changed)
- **Content-Type must stay `text/plain`.** It keeps the POST a "simple" request so the browser skips a CORS preflight that Apps Script does not answer. Switching to `application/json` breaks capture silently.
- **Submit is fire-and-forget.** The response is not read (avoids CORS on the response). The thank-you screen always shows. If you need delivery confirmation, you must add proper CORS handling on the Apps Script side and await the result.
- **Redeploying the script:** use Deploy > Manage deployments > edit > New version to keep the same `/exec` URL. A fresh deployment mints a new URL that must be re-pasted into `index.html`.
- **Mail scope needs re-authorization.** Adding `MailApp.sendEmail` requires a scope the row-only version did not. After pasting the current `apps-script.gs`, redeploy (or run `doGet` once from the editor) and approve the new prompt that mentions sending email as you. Skip this and sends fail silently while rows still land. Email goes out as the account that owns the script (Execute as: Me), so watch its daily send quota (consumer Gmail ~100/day, Workspace ~1500/day).
- **Public repo:** the `/exec` URL is visible in page source. Acceptable (endpoint only appends rows). If spammed, redeploy at a new URL or add a shared-secret check in `doPost`.

## Respondent result email (wired)
`doPost` now calls `maybeEmailResult_(data)` after the row is appended. It sends the respondent their result only when an **email is present and `consent === 'yes'`** (the contact step's one checkbox covers both research use and sending the result). The band and copy are built in the script from `readiness_pct` via `bandLabel_()` (thresholds mirror `bandFor()` in `index.html`, keep them in sync); the gap lines come from the client, which already computes them and sends a `gaps` array in the payload. The email is trimmed to the band, score, and gap list on purpose (no full answer recap). It also invites a reply: the mail is sent from the owner's account (Execute as: Me), so a reply lands in their inbox. The send is wrapped in its own try/catch so a mail failure never blocks capture. The client only shows the "on its way to <email>" line when email **and** consent are both present, so the copy stays honest.

To disable emailing, delete the `maybeEmailResult_` call in `doPost`; rows are unaffected.

## Test checklist
- [ ] Complete each of the 5 role paths; confirm only relevant questions appear.
- [ ] Confirm a row lands in the `Responses` tab with correct columns.
- [ ] Confirm `readiness_pct` matches the band shown for a known set of answers.
- [ ] Test on mobile width and with a screen reader / keyboard only.
- [ ] Test A+ and Calm mode.
- [ ] Verify skipping optional questions still submits.

## Possible next steps (not yet built)
- Email the respondent their result (see known gap above).
- Sync rows into HubSpot Contacts (CRM write scope is available; forms scope is not).
- Per-persona AND per-band result copy (currently per-band copy plus a per-persona intro line).
- A shared-secret token on the endpoint if spam appears.
- Owner decision: keep the live score meter visible to respondents, or hide it (a low score can cause disengagement).

## Brand and voice (must hold)
- Colors: primary (dark violet) `#6D28C9`, accent `#8B3FD6`, gradient `135deg, #6D28C9 -> #A855F7`, ink `#141419`, background `#F7F6F3`. On the light ground the deep violets carry text (they meet AA contrast); the brighter `#A855F7` lives in the gradient/fills only. Fonts: Fraunces (display/headings), Hanken Grotesk (body), chosen for a warmer, more human feel. Note: this palette and type diverge from the marketing site's Space Grotesk + Inter and its brighter violet, so reconcile if cross-property brand consistency matters. Tokens are in `:root` in `index.html`.
- Writing conventions for any copy you add: no em dashes; no "not just X but Y"; no hedge-padding or corporate buzzwords; privacy-led framing; vary sentence length.
- The attestation wall is non-negotiable: Privacute gets a practice audit-ready, an independent third party certifies. Never imply the survey certifies anyone. Keep the "self-check, not a certification or legal advice" line on the result.
