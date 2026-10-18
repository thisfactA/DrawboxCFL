# API and data model

All JSON responses are no-store. No public drawing-list endpoint exists. `/health` checks/migrates storage; the legacy moderation label is informational and does not enable a visitor gallery.

## Public submission

`POST /api/drawings`, Content-Type application/json, allowed Origin required. Body: `{strokes:[...],message:"",website:""}`. `website` is a honeypot and must be empty. Optional legacy `name` is trimmed to40 characters. A stroke contains color `#rrggbb`, size1-40, and normalized `[x,y]` points in0-1. Omit tool for brush/erase; erasing is a white brush. Set `tool:"fill"` for a single-point fill. The widget slider offers1-30.

Limits:220,000 request bytes,300 strokes,2,000 points per stroke,20,000 total points and8,000,000 estimated raster-work units. Message is optional plain text, up to1,000 UTF-16 code units, with disallowed control characters rejected. Coordinates are rounded to four decimals. Request rejection does not erase the local draft.

Success201 `{id,status:"pending"}` means saved in D1. Error400 invalid input,403 origin/IP verification failure,415 content type,429 cooldown/quota,409 capacity full,503 service/configuration failure. Public responses do not expose visitor identifiers. Cloudflare Connecting-IP must be present; local Worker testing may need a test header in an isolated development environment.

Admission: at least60 seconds between submissions per daily visitor identity, five per rolling hour,500 globally per rolling day. Current/yesterday HMAC identities are checked across midnight. Capacity includes Trash:5,000 drawings and200,000,000 serialized-stroke bytes. Messages/indexes/metadata are additional database storage.

## Private inbox

`GET /api/inbox` with `Authorization: Bearer <INBOX_TOKEN>` returns up to20 drawings plus next cursor. Follow next.before and next.id together for older pages. Each row includes id, created_at milliseconds, name, serialized strokes JSON, approved legacy status, message, and optional trashed_at milliseconds. Visitor hashes are excluded. approved0 is active inbox, -1 is Trash, and1 is a legacy approval value; no visitor gallery is supplied.

`POST /api/inbox` with the same authentication and JSON `{id,action}` supports trash, restore, delete. delete executes only if approved<0; absent or restored items return409. Custom management clients should confirm irreversible deletion. Unauthenticated requests return401; missing service secrets/config can return503.

## Tables

- drawings: primary row, creation timestamp, name, stroke JSON, approved status, HMAC visitor identifier.
- drawing_capacity: one-row record/serialized-stroke ledger maintained by insert/delete/update triggers.
- drawing_messages: one optional message per drawing.
- drawing_trash: time of entry into Trash, with indexed expiry lookup and transition/cleanup triggers.
- drawing_mail: delivery state, attempt count, first/next attempt, lease, provider ID, concise error.
- drawing_mail_attempts: daily attempt slots retained32 days, independent of drawing deletion.

Use schema.sql for fresh databases. Worker ensureStorage performs additive idempotent initialization in a D1 transaction. It does not reset a database or discard existing drawings to admit another. Back up your own database before migrations.
