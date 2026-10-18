# Try it locally

For a quick look at the drawing tools, run these commands from the project folder:

```sh
npm ci
npm run build
python3 -m http.server 4327 --bind 127.0.0.1
```

Open http://127.0.0.1:4327/examples/preview.html. You can draw, change colors and try the controls. This simple preview cannot save submissions because it is only serving files. Stop the server with Ctrl+C.

## Check your changes

Run `npm test`. It builds the widget first, then checks drawing, sending, email retries, request limits, resizing and Trash cleanup using sample data. The tests do not send real email or change a live database.

Edit `drawbox.html`, `drawbox.css` and `drawbox.js`. The files assembled in backend/ are generated, so change the source and rebuild instead of editing those copies.

## Test submissions locally

For a full local setup, start `npm run dev` in another terminal. Wrangler prints its local Worker address. Initialize its separate local database:

```sh
npx wrangler d1 execute canvas-drawings --local --file backend/schema.sql --config backend/wrangler.jsonc
```

Put a development INBOX_TOKEN in an untracked `backend/.dev.vars` file. Add your local website address to config.json, rebuild, then point the preview iframe at the local Worker and use the sizing module configured for that same address. Keep local test settings separate from your deployed settings and restore the production addresses before deploying.
