# DrawboxCFL

A simple drawing box for your website. Visitors can leave a drawing and a little message, and you can receive both privately through Cloudflare (or by email if you want).

This version uses Cloudflare Workers and D1 instead of Google Forms, Sheets and Imgur. It includes a pen, eraser, fill tool, undo/redo and a custom color picker. No desktop app needed.

![Drawbox with a sample drawing and optional message](docs/images/drawbox-desktop.jpg)

<details><summary>Custom color picker</summary>

![Hue, saturation, brightness and hex controls](docs/images/color-picker.jpg)

</details>

## Setup

You’ll need Node.js 22.13+, a Cloudflare account, and access to edit your website. There’s a bit of setup the first time, but after that you mostly just edit the three Drawbox files.

1. Install dependencies and create a database:

   ```sh
   npm ci
   npx wrangler login
   npx wrangler d1 create canvas-drawings
   ```

2. Edit two files:

   - `config.json`: set `allowedOrigins` to your exact website origin, such as `https://your-site.example`. Set `workerOrigin` to your planned Worker address. Use no trailing slashes or page paths.
   - `backend/wrangler.jsonc`: choose your Worker name and replace the D1 database ID. Keep the `DB` binding. Use the database name you created above.

3. Initialize D1, add a private inbox key, and deploy:

   ```sh
   npx wrangler d1 execute canvas-drawings --remote --file backend/schema.sql --config backend/wrangler.jsonc
   npx wrangler secret put INBOX_TOKEN --config backend/wrangler.jsonc
   npm run deploy
   ```

   Create a long random INBOX_TOKEN in a password manager and save it privately. Never put it in your public website. Adjust the database name in the command if you renamed it.

4. Upload `website-files/drawbox-embed.mjs` to your website root. Copy the contents of `website-files/embed.html` into your page where you want the drawing box.

The build creates website-files/. Keep the sizing script with the iframe so expanding messages and the color picker fit. Direct visits to the Worker are intentionally blank. Test on your configured website. Hosting policies must permit the Worker iframe and your local module.

## Make it your own

| File | Purpose |
| --- | --- |
| drawbox.html | Canvas, controls and SVG icons |
| drawbox.css | Colors, spacing and responsive layout |
| drawbox.js | Drawing, picker, message and send behavior |
| config.json | Website and Worker origins |
| backend/ | Worker, database, email and tests |

After editing, run `npm test`, then `npm run deploy`. Existing Google Forms/Imgur drawings are not imported automatically. Email stays off until you set it up.

## Optional features

- [Email drawings to yourself](docs/EMAIL.md)
- [Read and save drawings in your browser](docs/INBOX.md)
- [Backend API and limits](docs/API.md)
- [Security and maintenance](docs/SECURITY.md)

The browser inbox is read/save only. Trusted API clients can Trash, restore and permanently delete items already in Trash. Trash expires after seven days. Keep the five-minute scheduled trigger for cleanup and mail retries. Storage and request limits apply; review your provider's account quotas before public use.

## Development

`npm run build` generates the Worker and embed files. `npm test` runs local regression tests. `npm run dev` starts a local Worker; see [local preview](docs/DEVELOPMENT.md). Deployment and email need your own account settings.

Inspired by [vv0ltz/Drawbox](https://github.com/vv0ltz/Drawbox) and the original drawbox.nekoweb.org project. This version replaces the original frontend and backend with the Cloudflare implementation. Source is MIT licensed; dependencies keep their own licenses. See LICENSE and THIRD_PARTY_NOTICES.md.
