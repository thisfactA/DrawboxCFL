# Private browser inbox

Python 3 is needed only for this optional viewer. Save the same INBOX_TOKEN used by the Worker outside the repository:

```sh
python3 - <<'PY'
from pathlib import Path
from getpass import getpass
p = Path.home() / '.config/drawbox/inbox-key'
p.parent.mkdir(parents=True, exist_ok=True)
p.write_text(getpass('Private inbox key: ').strip() + '\n')
p.chmod(0o600)
PY
python3 backend/viewer.py
```

Open http://127.0.0.1:4319/. The Python proxy keeps the key out of browser JavaScript. Keep the loopback binding and Host/Origin checks. DRAWBOX_INBOX_KEY_FILE can override the key location; DRAWBOX_INBOX_URL can override the trusted HTTPS endpoint.

The browser viewer reads drawings/messages and saves PNG files. Management actions use the authenticated backend API. See API.md. Do not publish the viewer key, database backup or received content.
