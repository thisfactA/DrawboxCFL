# Security

INBOX_TOKEN grants private inbox reads and management, including deletion of Trash. Keep it server-side and in an owner-only local file. RESEND_API_KEY is separate and sending-only. Never expose either in widget JavaScript, public files or an iframe query string. Use the localhost proxy rather than weakening private CORS.

Inputs are bounded and validated; SQL parameters prevent query injection; messages are rendered as text/escaped HTML. The server rasterizer rejects excessive drawing work. Private auth compares fixed-size SHA-256 digests. Public submission uses Cloudflare's IP to derive a keyed daily visitor identifier. It is pseudonymous, not truly anonymous; token rotation changes that identifier.

Frame CSP and Origin checks reduce browser misuse but are not authentication against arbitrary HTTP clients. No public drawing gallery exists. No code reaches into the owner's laptop through the Worker. The local viewer initiates authenticated outbound retrieval.

The local proxy binds 127.0.0.1 only and checks Host/Origin. No opaque null-origin inbox grant is present. File-origin framing exists for local file previews and does not grant inbox authentication.

Automatic cleanup permanently deletes expired Trash, and manual delete requires actual Trash status. The browser proxy is read-only; management actions require a trusted authenticated API client. Email/saved-image copies are independent. Review your provider's current quotas before public deployment. Source is provided as-is, without a security guarantee.
