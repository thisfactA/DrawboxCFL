# Backend API

This page is for changing the backend or building your own inbox client. For normal setup, start with [Cloudflare](CLOUDFLARE.md) and [email](EMAIL.md).

All JSON responses tell browsers not to cache them. There is no public endpoint for listing received drawings. `/health` checks the database connection and initializes any missing support tables.

## Send a drawing

Send `POST /api/drawings` with `Content-Type: application/json` and an allowed website Origin. The body has these fields:

- `strokes`: the drawing operations.
- `message`: optional plain text, up to 1,000 UTF-16 code units.
- `website`: leave empty. It is a hidden spam-trap field.
- `name`: an optional legacy field, trimmed to 40 characters.

Each stroke has a `color` such as `#345579`, a `size` from 1 to 40, and a list of `[x,y]` points. Coordinates run from 0 to 1 and are rounded to four decimal places. A brush or eraser stroke has no `tool` field; the eraser draws in white. A fill operation uses `tool: "fill"` and exactly one point. The public widget's size slider offers 1 to 30.

The Worker limits each request to 220,000 bytes, 300 strokes, 2,000 points per stroke and 20,000 points in total. It also rejects drawings that exceed 8,000,000 estimated rendering-work units. Invalid control characters are rejected from messages. A rejected request leaves the visitor's local draft intact.

### Responses

| Status | Meaning |
| --- | --- |
| 201 | Saved in D1. The response contains `id` and `status: "pending"`. |
| 400 | Drawing or message is invalid. |
| 403 | Website origin or IP verification failed. |
| 415 | Request is not JSON. |
| 429 | Cooldown or submission limit reached. |
| 409 | Inbox storage is full. |
| 503 | Service or required configuration is unavailable. |

Public responses do not include visitor identifiers. Cloudflare's connecting-IP header is required. Tests can supply a test header in an isolated local environment; do not let visitors choose their own IP identity in production.

### Submission and storage limits

A visitor must wait at least 60 seconds between submissions and can send five drawings per rolling hour. There is also a shared limit of 500 submissions per rolling day. Yesterday's daily visitor identifier is checked around midnight so the cooldown cannot be skipped by crossing into a new day.

Capacity is 5,000 drawings or 200,000,000 bytes of serialized stroke data, whichever is reached first. Trash counts toward both. Messages, indexes and other database records use additional storage beyond that stroke-data limit.

## Read the private inbox

Send `GET /api/inbox` with this header:

```text
Authorization: Bearer <INBOX_TOKEN>
```

The response contains up to 20 drawings and a cursor for the next page. Use both `next.before` and `next.id` when requesting older pages.

Rows include `id`, `created_at`, `name`, serialized `strokes`, `approved`, `message` and, for Trash, `trashed_at`. Timestamps are in milliseconds. Visitor identifiers are excluded. The legacy `approved` field uses `0` for the active inbox, `-1` for Trash and `1` for an older approval state. It does not enable a public gallery.

## Move, restore or delete a drawing

Send `POST /api/inbox` with the same private header and a JSON body containing `id` and `action`. Supported actions are `trash`, `restore` and `delete`.

Permanent deletion only works while the drawing is still in Trash. A missing or restored item returns 409. A custom management interface should ask for confirmation before permanent deletion. Requests without valid authentication return 401; missing service configuration can return 503.

## Database tables

| Table | What it stores |
| --- | --- |
| `drawings` | Drawing data, creation time, legacy status and private visitor identifier. |
| `drawing_capacity` | Record and stroke-byte totals, kept in sync by database triggers. |
| `drawing_messages` | One optional message per drawing. |
| `drawing_trash` | When a drawing entered Trash, used for seven-day expiry. |
| `drawing_mail` | Delivery state, attempts, retry timing and provider response. |
| `drawing_mail_attempts` | Daily email-attempt records, retained for 32 days even if a drawing is deleted. |

Use `backend/schema.sql` for a new database. The Worker's `ensureStorage` function adds missing support tables inside a D1 transaction. It does not reset an existing database or discard old drawings to make room. Back up your database before changing its schema.
