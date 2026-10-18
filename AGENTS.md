# Agent quick start

Read README.md. Run `npm ci` and `npm test`.

Edit drawbox.html for markup/icons, drawbox.css for appearance, drawbox.js for interactions, and config.json for origins. Backend code and tests live in backend/. `npm run build` assembles the widget, bundles the Worker and generates website-files/. Never edit backend/widget.html, backend/settings.mjs or backend/deploy.js directly.

Keep the 250-pixel logical canvas and saved stroke format compatible. Preserve frame origin/source checks, render budgets, atomic storage, email retry idempotency and authenticated Trash-only permanent deletion. Failed sends must preserve drawing/message drafts. Keep secrets outside public files and archives.

Run `npm test` after changes. Local mocks do not prove live account settings or email delivery. Deploy and perform live destructive operations only within the operator's authorization. No real account or credentials are included.
