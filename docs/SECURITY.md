# Keep your inbox private

Treat `INBOX_TOKEN` like a password. Anyone with it can read your drawings, move them to Trash, restore them, or permanently delete items already in Trash. Save it through Wrangler’s secret prompt and in the private key file used by your local viewer. Never put it in your website, a public repository, or an iframe URL.

`RESEND_API_KEY` is a separate key for sending email. Keep that in Worker secrets too. The receiving address belongs in `MAIL_TO`, which you control. Visitors cannot choose where email goes.

## What the checks do

The Worker checks drawing sizes, coordinates, colors and message length before saving anything. It also limits how much work a drawing can take to render. Database queries use parameters, and visitor messages are displayed as text or escaped before going into email.

Your website address controls where the widget can be embedded and which browser submissions are accepted. This helps prevent misuse, but it cannot stop someone from making requests outside a browser. Request limits still matter.

Visitor IP addresses are used to make a private daily identifier for cooldowns. Raw IP addresses are not stored in the drawing rows. These identifiers are pseudonymous, not fully anonymous. Changing INBOX_TOKEN changes the identifiers too.

## Local inbox and deleted drawings

The local viewer connects out to your Worker. It listens only on `127.0.0.1` and keeps the secret out of browser JavaScript. Keep those restrictions rather than exposing the viewer to your network or allowing arbitrary browser origins.

Trash is recoverable for seven days. After cleanup or permanent deletion, the drawing is removed from D1 and its related private tables. That does not remove an email or PNG you have already saved. Database space can be reused without the database file immediately shrinking.

No CAPTCHA is included. Distributed spam can still use up the shared quotas. Monitor your account usage before increasing limits. These protections reduce risk; they are not a guarantee against every attack.
