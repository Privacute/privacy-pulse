# Privacute Privacy Pulse

A branded, role-adaptive survey that scores each respondent and stores every answer in a Google Sheet you own. Free to run: GitHub Pages hosts the page, Google Apps Script captures the responses. No third-party form service, no paid tier.

## Files
- `index.html` - the survey. This is the whole app.
- `apps-script.gs` - the collector that writes responses to your Google Sheet.
- `README.md` - this file.

## How it works
GitHub Pages serves `index.html`. When someone finishes, the page sends the answers to a Google Apps Script Web App, which appends one row per response to a sheet. GitHub Pages is static (it stores nothing itself), so the Apps Script endpoint is what does the capturing.

---

## Setup, about 10 minutes

### Part 1 - the Google Sheet and collector
1. Go to https://sheets.new and make a new sheet. Name it something like `Privacute Privacy Pulse`.
2. In that sheet: **Extensions > Apps Script**.
3. Delete whatever code is in the editor. Paste in the full contents of `apps-script.gs`. Click the save icon.
4. Click **Deploy > New deployment**.
5. Click the gear next to "Select type" and choose **Web app**.
6. Set **Execute as: Me** and **Who has access: Anyone**. (This lets the survey post to it. It only appends rows; it exposes nothing.)
7. Click **Deploy**. Approve the permission prompt (choose your account, Advanced > Go to project > Allow). This is Google asking if your own script may write to your own sheet and send the result email from your account. If you ever paste in an updated script, redeploy the same way and approve the prompt again, otherwise a newly added permission (like sending email) will not take effect.
8. Copy the **Web app URL**. It ends in `/exec`. Keep it.

### Part 2 - drop your URL into the survey
9. Open `index.html` in any text editor. Near the top of the `<script>` block, find the `CONFIG` block. Paste your `/exec` URL into `ENDPOINT`, and optionally an address into `CONTACT_EMAIL` to switch on the "Reach out to Privacute" button on the result screen:
   ```js
   const CONFIG = {
     ENDPOINT: "https://script.google.com/macros/s/AKfyc.../exec",
     CONTACT_EMAIL: "hello@privacute.com"   // optional; leave "" to hide the button
   };
   ```
   Save the file. `CONTACT_EMAIL` is visible in the public page source, so use an address you are fine publishing.

### Part 3 - publish on GitHub Pages
10. Create a new **public** GitHub repository (for example `privacy-pulse`).
11. Upload `index.html` (uploading the other two files is fine and harmless).
12. In the repo: **Settings > Pages**. Under "Build and deployment", set **Source: Deploy from a branch**, **Branch: main**, folder **/ (root)**. Save.
13. Wait about a minute. Your survey is live at `https://<your-username>.github.io/privacy-pulse/`.

### Part 4 - test it end to end
14. Open the live URL, complete the survey as a test, and submit.
15. Check the sheet. A `Responses` tab appears with a header row and your test row. If it is there, you are done.

---

## Sending it out
- **Email and text:** share the GitHub Pages URL. Consider a short link so it looks clean in a text.
- **Website:** embed it in an `<iframe>` pointing at the same URL, or just link to it.

## Reading the data for persona research
Each row is one respondent. Sort or filter by `persona` and `trigger` to build your personas. `readiness_pct` is their live score. `open` is the free-text answer, usually the most useful column. Email and name are only present when someone opted in.

## Changing the survey later
- **Edit questions or copy:** change `index.html` and push (see "Updating and redeploying" below). No redeploy of the script needed.
- **Add a new question:** give it an `id` in `index.html`, then add that same `id` to the `COLUMNS` list in `apps-script.gs` so it gets its own column.

## Updating and redeploying
This deployment lives in the `braxton-privacute/privacy-pulse` repo and is served by GitHub Pages at https://braxton-privacute.github.io/privacy-pulse/. Pages rebuilds automatically on every push to `main`, so shipping a page change is just a commit and a push:

```bash
git add -A
git commit -m "Update survey copy"
git push
```

Give it about a minute after the push, then hard-refresh the live URL (Pages caches briefly).

- **Page changes** (copy, questions, colors, `CONFIG.ENDPOINT`, `CONFIG.CONTACT_EMAIL`): commit and push as above. Nothing else to do.
- **Script changes** (`apps-script.gs`): the copy in this repo is for reference only. The collector that actually runs is the one pasted into the Google Sheet's Apps Script editor, so after editing you must paste it back there and redeploy: **Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy**. That keeps the same `/exec` URL. If you added a new permission (for example the result email's `MailApp`), approve the prompt again or it will not take effect. A brand-new deployment mints a new `/exec` URL that you would have to paste back into `index.html`.

## Notes worth knowing
- A public repo means anyone can read the page source, including the `/exec` URL. That is normal for this setup and fine: the endpoint only adds rows to your sheet. If you ever get spam rows, the simplest fix is to redeploy at a new URL, or add a shared secret check to the script (ask and I will add it).
- No personal data is required to complete the survey. Name and email are optional and clearly consented, which keeps this clean for a privacy company.
- This is a research and self-check tool, not a certification. That line is on the result screen on purpose.
