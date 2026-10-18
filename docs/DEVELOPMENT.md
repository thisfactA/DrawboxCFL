# Local development

Run `npm ci` and `npm run build`. Start `python3 -m http.server 4327 --bind 127.0.0.1` and open http://127.0.0.1:4327/examples/preview.html. The preview loads the actual assembled widget in an iframe. Drawing and tools work; submission needs the Worker rather than this static server.

Run `npm test` for synthetic widget, renderer, quota, authentication, queue, resize and retention checks. No real mail is sent by these tests.

For end-to-end local submissions, run `npm run dev`, initialize local D1 with `npx wrangler d1 execute canvas-drawings --local --file backend/schema.sql --config backend/wrangler.jsonc`, and use an untracked backend/.dev.vars for INBOX_TOKEN. Add the local website origin to config.json, rebuild, point the preview iframe at the local Worker address and use the matching parent resize module. Restore the deployed URLs before deployment.

Generated backend files are ignored by Git. The frontend stays in three editable files. Tests read the assembled backend/widget.html, so build before invoking tests directly. The root npm test command does this for you.
