# Optional Resend delivery

Off by default: no RESEND_API_KEY and an empty MAIL_TO. The recipient is an operator-controlled Worker variable, never visitor input. The sender is MAIL_FROM, default `drawing <onboarding@resend.dev>`. The fixed subject is `drawing`. The body contains only an inline 250-by-250 PNG and the escaped optional message.

Create your own Resend account, verify it, and use a sending-only API key. With the onboarding sender, Resend restricts delivery to the account owner's verified address. A verified sending domain is required for broader destinations. Check current provider terms and free limits before using this setup for a public website.

Set MAIL_TO in backend/wrangler.jsonc to the permitted recipient address. Set MAIL_FROM if you own a verified sender domain. Save the key using a secret prompt:

```sh
npx wrangler secret put RESEND_API_KEY --config backend/wrangler.jsonc
npm run deploy
```

Never put this key in the website, browser viewer or source archive. The owner must authorize sharing visitor drawings/messages with the email provider; publish an appropriate visitor notice.

Every accepted drawing is saved atomically with its message and, when configured, a mail job. A background waitUntil dispatches jobs; the five-minute cron retries them. Claims use a one-minute lease. Retries reuse `drawing/<drawing UUID>` as a Resend idempotency key. At most 90 attempts per UTC day, including retries, are admitted by this app. Provider-account usage from other apps is separate. Excess jobs stay queued.

After five failed attempts, a permanent provider rejection, or a 23-hour retry window, jobs move to review. This avoids blindly retrying beyond the provider's 24-hour idempotency window. Inspect provider logs and D1 before resending uncertain mail. `sent` means the API accepted it and returned an ID; it is not proof that a person saw it.

If mail fails, visitors still have a saved drawing in the private inbox; the public UI reports successful storage rather than falsely claiming delivery. The textarea and canvas clear together after successful storage; both remain on submission failure. PNG generation is local to the Worker, without a third-party raster endpoint. Base64 here is attachment transport, not embedded website media.
