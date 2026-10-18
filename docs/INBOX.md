# Private browser inbox

You can view received drawings in your browser and save them as PNG files. You’ll need Python 3 and the INBOX_TOKEN you saved during Cloudflare setup.

The viewer reads your Worker address from `config.json`. Run this from the project folder. It asks for the key without showing it and saves it outside the project:

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

Open http://127.0.0.1:4319/. Leave the terminal running while you use the inbox; press Ctrl+C when finished. Python connects to the Worker for you, so your browser does not receive the secret key.

If you need a different key file or Worker, set `DRAWBOX_INBOX_KEY_FILE` or `DRAWBOX_INBOX_URL` before starting the viewer. Keep the server restricted to your own computer.

This viewer does not include Trash or Restore buttons. Those actions are available through the [private API](API.md). Keep the key, received drawings and database backups private.
