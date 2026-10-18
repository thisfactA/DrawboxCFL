# DrawBoxCFL

A drawing box for your website. Visitors can leave a drawing and a little message, and you can receive both privately through Cloudflare (or by email if you want).

This is based on vv0ltz’s Drawbox, with Cloudflare Workers and D1 handling the storage. It has a pen, eraser, fill tool, undo/redo and a custom color picker.

![Drawbox with a sample drawing and optional message](docs/images/drawbox-desktop.jpg)

<details><summary>Custom color picker</summary>

![Hue, saturation, brightness and hex controls](docs/images/color-picker.jpg)

</details>

## Setup

You’ll need Node.js 22.13+, a Cloudflare account, and access to edit your website. There’s a bit of setup the first time, but after that you mostly just edit the three Drawbox files.

For a walkthrough with screenshots, see [Cloudflare setup](docs/CLOUDFLARE.md).

1. Install dependencies and create a database:

   ```sh
   npm ci
   npx wrangler login
   npx wrangler d1 create canvas-drawings
   ```

2. Edit two files:

   - `config.json`: set `allowedOrigins` to your exact website origin, such as `https://your-site.example`. Set `workerOrigin` to your planned Worker address. Use no trailing slashes or page paths.
   - `backend/wrangler.jsonc`: choose your Worker name and replace the D1 database ID. Keep the `DB` binding. Use the database name you created above.

3. Initialize D1, create the Worker, then add its private inbox key:

   ```sh
   npx wrangler d1 execute canvas-drawings --remote --file backend/schema.sql --config backend/wrangler.jsonc
   npm run deploy
   npx wrangler secret put INBOX_TOKEN --config backend/wrangler.jsonc
   npm run deploy
   ```

   The first deployment creates the Worker. If you did not know its address when editing `config.json`, copy the address Wrangler prints into `workerOrigin` before the final deployment. Create a long random INBOX_TOKEN in a password manager and save it privately. Never put it in your public website. Adjust the database name in the command if you renamed it.

4. Upload `website-files/drawbox-embed.mjs` to your website root. Copy the contents of `website-files/embed.html` into your page where you want the drawing box.

The build creates the `website-files/` folder. Keep the sizing script with the iframe so the message box and color picker have room to open. The Worker address is intentionally blank when visited on its own, so test DrawBoxCFL on your website. Your host must allow the Worker iframe and the script.

## Try the example

Download `examples/preview.html` (use **Download raw file** on GitHub), then open the saved file to try the drawing tools. It is self-contained, so it does not need the project folders or a build first. Sending is disabled in this example; use the website embed above for real submissions.

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

The browser inbox lets you view drawings and save PNGs. Moving drawings to Trash or restoring them needs a private API client. Items in Trash are permanently removed after seven days. Keep the scheduled cleanup enabled, and check your Cloudflare and email limits before sharing the box widely.

## Development

`npm run build` generates the Worker and embed files. `npm test` runs local regression tests. `npm run dev` starts a local Worker; see [local preview](docs/DEVELOPMENT.md). Deployment and email need your own account settings.

Inspired by [vv0ltz/Drawbox](https://github.com/vv0ltz/Drawbox) and the original drawbox.nekoweb.org project. This version replaces the original frontend and backend with the Cloudflare implementation. Source is MIT licensed; dependencies keep their own licenses. See [LICENSE](LICENSE) and [third-party notices](docs/THIRD_PARTY_NOTICES.md).
