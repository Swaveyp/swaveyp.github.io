# Swavey Forms — Apps Script Web App Setup

This folder holds reference copies of the Apps Scripts that power the two
contact forms on the site:

- **`photoshoot-email.gs`** — receives photoshoot wizard submissions from
  `book-photoshoot.html` and emails "New Photoshoot Booking" to
  `support@swavey.biz`.
- **`apparel-email.gs`** — receives apparel order submissions from the form
  on `contact.html` and emails "New Apparel Order" to
  `support@swavey.biz`.

There is **no Google Form** in either setup. Each Web App is the entire
backend. They are deployed as **two separate Apps Script projects** with
**two separate URLs** so they fail and quota independently.

The flow for each:

1. Visitor fills the form.
2. The page POSTs a JSON payload to the Apps Script Web App URL.
3. `doPost(e)` parses the JSON, builds the styled HTML email, and sends it
   via `MailApp.sendEmail`.
4. Optionally, the script also appends a row to a Google Sheet (set
   `SHEET_ID` in the script).

---

# Part A — Photoshoot Booking

---

## 1. Create the Apps Script project

1. Go to https://script.google.com and click **New project**.
2. Replace the contents of `Code.gs` with everything in
   `photoshoot-email.gs` from this folder. Save.
3. Rename the project to "Swavey Photoshoot Booking".

---

## 2. Configure the script

At the top of the script:

- `NOTIFY_TO` — recipient inbox. Default: `support@swavey.biz`.
- `SHEET_ID` — leave as empty string (`''`) to email-only. To also log every
  submission to a spreadsheet, paste the spreadsheet's ID (the long string
  in the URL between `/d/` and `/edit`).
- `SHEET_TAB` — tab name for appended rows. Default: `Submissions`. Will be
  created if it doesn't exist.

---

## 3. Deploy as a Web App

1. In the Apps Script editor, click **Deploy** > **New deployment**.
2. Click the gear icon next to "Select type" and pick **Web app**.
3. Settings:
   - Description: `v1` (or any label)
   - **Execute as: Me** (your Google account — emails will send from your
     Gmail).
   - **Who has access: Anyone** (so the static site can POST to it).
4. Click **Deploy**.
5. Authorize when prompted: choose your Google account, click **Advanced**,
   then **Go to Swavey Photoshoot Booking (unsafe)**, then **Allow**.
   This grants the script permission to send email and (if `SHEET_ID` is set)
   read/write the Sheet.
6. Copy the **Web app URL**. It looks like
   `https://script.google.com/macros/s/AKfycb…/exec`. You'll need this in
   step 4.

When you change the script later, you must redeploy. To keep the same URL,
go to **Deploy** > **Manage deployments** > pencil icon > set Version to
**New version** > Deploy. To get a fresh URL, choose **New deployment**
instead, and update `WEB_APP_URL` in `book-photoshoot.html` to match.

---

## 4. Wire the URL into `book-photoshoot.html`

Open `book-photoshoot.html` and find the integration shim near the bottom:

```js
var WEB_APP_URL = 'https://script.google.com/macros/s/REPLACE_DEPLOYMENT_ID/exec';
```

Replace it with the URL you copied in step 3. Save and reload.

---

## 5. Test end-to-end

1. Open `book-photoshoot.html` in the browser.
2. Fill the wizard with realistic test data and submit.
3. Confirm:
   - The success card appears in place of the wizard.
   - An email arrives at `NOTIFY_TO` with the expected fields, the white
     Swavey logo on the gradient hero, and clickable email/phone/links.
   - Replying to the email goes to the client's address.
   - If `SHEET_ID` is set, a new row appears in the spreadsheet.

You can also paste the Web app URL into a browser to hit `doGet()` — it
returns `{ "ok": true, "service": "Swavey photoshoot booking", ... }` as a
quick sanity check.

---

## 6. Troubleshooting

**The browser shows "Failed to fetch" / CORS error.**
- Make sure the deployment is set to "Anyone" access (step 3.3).
- The integration shim sends `Content-Type: text/plain;charset=utf-8` to
  avoid a CORS preflight. Don't change that — Apps Script doesn't handle
  preflight cleanly.

**The browser POST succeeds but no email arrives.**
- Open the script editor > **Executions** (clock icon, then "Executions"
  on the left). Look for failed runs and read the error.
- Check Gmail's daily MailApp quota: free Gmail = 100/day, Workspace = 1500/day.

**Emails arrive but `replyTo` is the script's account, not the client.**
- The integration shim must include the client's `email` field in the
  payload. Check the Network tab to confirm.

**Anyone with the URL can spam the endpoint.**
- True. Apps Script Web Apps deployed with "Anyone" access are public.
  Mitigations if it ever becomes a problem:
  - Add a shared secret check in `doPost` (the wizard sends an extra body
    field that must match a constant in the script).
  - Add reCAPTCHA to the wizard.
  None of this is needed for v1.

**The deployment URL changed after I redeployed.**
- "New deployment" creates a new URL. To keep the same URL while updating
  code, use **Manage deployments** > pencil icon > set Version to
  **New version** > Deploy. Update `WEB_APP_URL` only when you intentionally
  make a fresh deployment.

---

## Notes (Photoshoot)

- The Apps Script project is the source of truth. `photoshoot-email.gs` in
  this folder is a checked-in reference copy. When you change the script,
  update both.
- The wizard's submit button shows an error if the script returns
  `{ ok: false, ... }` or if the network fails. The script returns
  `{ ok: true }` on success.

---

# Part B — Apparel Orders

The apparel form on `contact.html` uses an identical Web App pattern. Repeat
the steps from Part A with these differences:

## B1. Create a separate Apps Script project

1. Go to https://script.google.com and click **New project**.
2. Paste the contents of `apparel-email.gs` into `Code.gs`. Save.
3. Rename the project to "Swavey Apparel Orders".

This is a **separate project** from the photoshoot one. Don't reuse the
same project — each project supports one Web App URL.

## B2. Configure the script

Same constants as the photoshoot script:

- `NOTIFY_TO` — default `support@swavey.biz`.
- `SHEET_ID` — empty by default. Set to a different spreadsheet (or a
  different tab on the same spreadsheet via `SHEET_TAB`) than the
  photoshoot one if you want both logged.
- `SHEET_TAB` — default `Orders`.

## B3. Deploy as a Web App

Identical to step 3 of Part A — Deploy > New deployment > Web app, Execute
as Me, Anyone access. Authorize, copy the new URL.

## B4. Wire the URL into `contact.html`

Open `contact.html` and find the apparel script block:

```js
var WEB_APP_URL = 'https://script.google.com/macros/s/REPLACE_DEPLOYMENT_ID/exec';
```

Replace it with your apparel deployment URL. (This is a different URL from
the photoshoot one — don't paste the same URL into both.)

## B5. Test

1. Open `contact.html` in the browser.
2. Click "Place Your Order" on the apparel card, fill the form, submit.
3. Confirm an email arrives at `NOTIFY_TO` styled like the photoshoot
   one but with shipping details if applicable.

## Notes (Apparel)

- The apparel form's required fields (Name, Email, Phone) are enforced by
  the browser via the `required` attribute. Optional fields (inquiry,
  details, shipping) are sent as empty strings if blank.
- The shipping section in the email only renders the address block when
  the customer chose "Yes" to shipping. Otherwise it shows
  "Local pickup / no shipping required."
- The old Google Form
  (`docs.google.com/forms/d/e/1FAIpQLSdmu8PjKuTAP6e9hFL1Cd85mzhwHe4mgn3N3wMtT7Z7XxgI4w/`)
  is no longer referenced by the site. You can delete it from your Google
  Forms account or keep it as a historical archive — it doesn't matter.

---

# Part C — Unified Email Sender (`email-sender.gs`)

After the AWS backend lands, the two form-intake scripts above (Parts A & B)
are no longer the email path. They're kept as historical reference. The
**new** Apps Script is `email-sender.gs` — it's called by AWS Lambda over
HTTPS to send admin notifications, client confirmations (with `.ics`
attachments), and decline emails.

## C1. Create the project

1. Go to https://script.google.com and click **New project**.
2. Replace the contents of `Code.gs` with everything in `email-sender.gs`.
   Save.
3. Rename the project to "Swavey Email Sender".

## C2. Set the shared secret

This is what Lambda includes in every payload. The script rejects any POST
without a matching secret.

1. In the Apps Script editor, click the gear icon (Project settings).
2. Scroll to **Script properties** and click **Add script property**.
3. Property: `EMAIL_SCRIPT_SHARED_SECRET`. Value: a long random string
   (≥40 chars). Generate one with
   `openssl rand -base64 48` or any password manager. **Save it** — you'll
   paste the same value into the SAM `EmailScriptSharedSecret` parameter.
4. Click **Save script properties**.

The secret is **never** in the source. It lives only in script properties
+ AWS SAM parameters.

## C3. Deploy as a Web App

1. Click **Deploy** > **New deployment**.
2. Gear icon > **Web app**.
3. Settings:
   - Description: `v1`
   - **Execute as: Me** (your Google account — emails will send from your
     Gmail)
   - **Who has access: Anyone**
4. **Deploy** and authorize when prompted (Advanced > Go to … (unsafe) >
   Allow). The script needs `gmail.send` and `script.external_request`
   scopes.
5. Copy the **Web app URL** (`https://script.google.com/macros/s/AKfycb…/exec`).
   You'll paste it into the SAM `EmailScriptUrl` parameter.

## C4. Verify

Hit the Web App URL in a browser — it should respond
`{"ok":true,"service":"swavey email sender"}` (that's `doGet`).

A POST without a matching secret returns `{"ok":false,"error":"Unauthorized"}`.

## C5. Quotas

`GmailApp.sendEmail` is subject to your Google account's daily send quota
(100/day for free Gmail, 1500/day for Workspace). Each form submission
fires 1 admin notify; each approve fires 2 emails (admin + client) +
1 .ics attachment.

## C6. Troubleshooting

- **Lambda fires but no email arrives.** Check the Apps Script
  **Executions** log for failed runs. Most common cause: scope not
  authorized (the script's Gmail permission was revoked or never granted).
- **`Unauthorized` returned to Lambda.** Script property
  `EMAIL_SCRIPT_SHARED_SECRET` doesn't match the SAM
  `EmailScriptSharedSecret` parameter the Lambda uses. They must be
  byte-for-byte identical.
- **`.ics` attaches but Gmail won't show "Add to Calendar" UI.** That UI
  appears only when the MIME type is exactly
  `text/calendar; method=PUBLISH; charset=UTF-8` and the file extension
  is `.ics`. The script sends both. If the recipient is on
  Outlook.com/Yahoo, the UI may differ but the file still imports cleanly.
- **Updating the script after deploy.** Use **Deploy** > **Manage
  deployments** > pencil > **New version** to keep the same URL. If you
  change the URL, redeploy AWS with the new `EmailScriptUrl` parameter.
