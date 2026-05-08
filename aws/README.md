# Swavey AWS Backend

Serverless backend for Swavey Services bookings + apparel orders. Replaces
the old "Apps Script as form-intake" path. Form submissions still trigger an
admin notification email — but now they go through API Gateway → Lambda →
DynamoDB first, and the email is fired by Lambda calling the
`apps-script/email-sender.gs` Web App.

## Architecture

```
Static site form submit ─► API Gateway ─► Lambda ─► DynamoDB
                                              └──► Apps Script (email-sender.gs)

admin.html ─► API Gateway ─► Lambda (admin-list / admin-update)
                                  └──► DynamoDB
                                  └──► Apps Script (confirmation/deny emails)
```

- **Region:** us-east-1
- **Runtime:** Node.js 20.x ESM, arm64
- **Table:** `SwaveyBookings` (single-table, two GSIs)
- **Auth:** admin endpoints require `x-admin-password` header (sha256
  constant-time compared)

## Files

```
aws/
├── template.yaml             SAM template — five resources, four functions
├── handlers/
│   ├── submit-photoshoot.mjs Public POST /photoshoot
│   ├── submit-apparel.mjs    Public POST /apparel
│   ├── admin-list.mjs        Admin GET /admin/list?type=&view=
│   ├── admin-update.mjs      Admin POST /admin/update {id, action, …}
│   └── lib/
│       ├── auth.mjs          sha256 constant-time password verify
│       ├── ddb.mjs           shared DynamoDBDocumentClient
│       ├── cors.mjs          response helpers
│       ├── ids.mjs           uuid + GSI key builders
│       └── parse-date.mjs    free-text date → YYYY-MM-DD
```

## Admin password

The user-chosen password is **`Munroe123!`**. This is what you'll type into
the unlock screen on `admin.html`.

Its sha256 hex (deploy-time parameter `AdminPasswordHash`):

```
fa1b1ed336a5d615fa5a7feb9006705aee4df11ed2ec3ac3c9b44032bf38caf9
```

If you ever change the password, regenerate the hash with:

```bash
printf 'NewPasswordHere' | shasum -a 256 | awk '{print $1}'
```

…and redeploy with the new value of `AdminPasswordHash`. The plaintext
password is **never** stored in source — only the hash. Client-side JS
prompts for it on the admin page.

## One-time setup

1. **Install AWS CLI v2 and SAM CLI** if you don't have them. `aws
   configure` with credentials that can create CloudFormation stacks,
   IAM roles, DynamoDB tables, Lambda functions, and HTTP APIs.
2. **Deploy and configure the email-sender Apps Script** first — see
   `apps-script/README.md` (Part C: Unified Email Sender). You'll need the
   resulting Web App URL and shared secret for step 4.
3. **Pick a strong shared secret.** Lambda passes this to the Apps Script
   on every email call. Store it once — Apps Script script-property and
   the SAM parameter must match.

## Deploy

```bash
cd aws
sam build
sam deploy --guided
```

When prompted by `--guided`:

- **Stack name:** `swavey-bookings`
- **AWS Region:** `us-east-1`
- **Parameter `AdminPasswordHash`:** paste
  `fa1b1ed336a5d615fa5a7feb9006705aee4df11ed2ec3ac3c9b44032bf38caf9`
- **Parameter `EmailScriptUrl`:** paste the deployed email-sender Web App
  URL (looks like `https://script.google.com/macros/s/AKfycb…/exec`).
- **Parameter `EmailScriptSharedSecret`:** paste the same long string you
  set as the `EMAIL_SCRIPT_SHARED_SECRET` script property.
- **Confirm changes before deploy:** `Y`
- **Allow SAM CLI IAM role creation:** `Y`
- **Disable rollback:** `N`
- **Save arguments to configuration file:** `Y` (creates `samconfig.toml`,
  which is git-ignored — subsequent deploys can use plain `sam deploy`)

After it finishes, the Outputs section prints `ApiUrl`. Copy it; you'll
wire it into three HTML files in the next step.

## Wire the API URL into the static site

Three places need the same URL (`https://abc123.execute-api.us-east-1.amazonaws.com`):

1. `book-photoshoot.html` — search for `API_BASE_URL` near the bottom of
   the file. Replace `<TODO_REPLACE_AFTER_FIRST_SAM_DEPLOY>` with the
   `ApiUrl` value.
2. `order-apparel.html` — same swap.
3. `admin.html` — search for `API_BASE` near the top of the inline
   admin script. Replace the same TODO value.

Commit and push. The static site will start hitting the Lambda backend.

## Routes summary

| Method | Path             | Auth                  | Notes                                           |
|--------|------------------|-----------------------|-------------------------------------------------|
| POST   | /photoshoot      | none (public)         | wizard submit; writes pending; fires admin email |
| POST   | /apparel         | none (public)         | order submit; writes pending; fires admin email  |
| GET    | /admin/list      | x-admin-password      | `?type=photoshoot\|apparel\|all&view=pending\|upcoming\|past\|denied\|archived` |
| POST   | /admin/update    | x-admin-password      | body `{id, action: approve\|edit\|deny\|delete\|archive, updates?, sendEmail?}` |

Throttling: 10 burst / 5 sustained per second per route.
CORS allows `swaveyp.github.io`, `swavey.biz`, `www.swavey.biz`, and
`localhost:8080`/`127.0.0.1:8080` for local development.

## DynamoDB schema (single-table)

| Attribute  | Example                                            |
|------------|----------------------------------------------------|
| pk         | `BOOKING#<uuid>`                                   |
| sk         | `META`                                             |
| type       | `photoshoot` \| `apparel`                          |
| status     | `pending` \| `confirmed` \| `denied` \| `archived` |
| submittedAt| ISO-8601                                           |
| eventDate  | `YYYY-MM-DD` (or `""`)                             |
| gsi1pk     | `STATUS#<status>`                                  |
| gsi1sk     | `<submittedAt>#<pk>`                               |
| gsi2pk     | `STATUS#confirmed#TYPE#<type>` (only when confirmed AND eventDate)|
| gsi2sk     | `<eventDate>#<pk>`                                 |

All form fields are stored as plain item attributes; `shootSpecific` is a
Map. Admin metadata: `confirmedAt`, `deniedAt`, `archivedAt`, `adminNotes`,
`sourceIp`, `userAgent`.

## Local invoke (optional)

```bash
sam local invoke SubmitPhotoshootFn -e events/photoshoot.json
```

(create your own `events/*.json` from API Gateway test payloads).

## Troubleshooting

- **CloudFormation says "Resource limit exceeded — DynamoDB Point-in-time
  Recovery."** Older SAM/CFN runtimes use a different shape for PITR. If
  your `aws-cli` complains about `PointInTimeRecoverySpecification`, swap
  the field for the legacy
  `PointInTimeRecoveryEnabled: true` block; both work in `us-east-1`.
- **CORS preflight fails from the static site.** Check the OAuth-style
  origin list in `template.yaml` `CorsConfiguration.AllowOrigins`.
  Add your custom domain there and `sam deploy` again.
- **"Unauthorized" on every admin call.** Confirm
  `AdminPasswordHash` matches `printf 'Munroe123!' | shasum -a 256`.
- **Email never arrives but DynamoDB has the row.** That's by design —
  Lambda swallows email-sender errors so a bad Apps Script never blocks
  user submission. Check CloudWatch Logs for the function and Apps Script
  execution log.
- **AWS SDK v3 missing import errors.** The `@aws-sdk/*` libraries are
  built into the Node 20 runtime; no `package.json` is needed in the
  handlers folder.
