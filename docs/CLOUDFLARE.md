# Connect DrawBoxCFL to Cloudflare

Cloudflare runs the Worker that receives drawings and the D1 database that stores them. The Worker is the small backend service; D1 is its storage. You’ll create both here, then connect the drawing box to your website.

The screenshots show real setup screens, cropped to the relevant fields. Names are examples, and no account details or keys are shown.

## 1. Install the project tools

Download and unzip the project, then open a terminal in its folder. You’ll need Node.js 22.13 or newer.

```sh
npm ci
npx wrangler login
```

Wrangler is Cloudflare’s command-line tool. The login command opens a browser so you can sign in to your own Cloudflare account. Return to the terminal when it finishes.

## 2. Create the D1 database

In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Storage & databases → D1 SQLite Database → Create Database**. You can also find D1 through the dashboard search.

![Name the database and leave the default location selected](images/cloudflare-d1.jpg)

1. Name it **canvas-drawings**.
2. Leave the default **Location** selected unless you need another region.
3. Scroll down and click **Create**.

Copy its **Database ID**, also called its **UUID**. If you already created this database with the README’s `wrangler d1 create` command, use that one instead of creating another.

## 3. Connect the database and choose a Worker name

Open `backend/wrangler.jsonc` in a text editor. These are the fields to change:

```json
"name": "canvas-drawbox",
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "canvas-drawings",
    "database_id": "PASTE_YOUR_DATABASE_ID_HERE"
  }
]
```

This is an excerpt, not a replacement for the whole file. Keep the other settings already there.

- **name** is the Worker’s name. Keeping `canvas-drawbox` is fine.
- **database_name** must match the database you created.
- **database_id** is the ID you just copied. Keep the quotes around it.
- **binding** must stay **DB**. That is how the code finds the database.

Add the tables to your new database:

```sh
npx wrangler d1 execute canvas-drawings --remote --file backend/schema.sql --config backend/wrangler.jsonc
```

Use your database name in the command if you changed it.

## 4. Create the Worker

Run:

```sh
npm run deploy
```

This command builds the code and creates the Worker in your Cloudflare account. You do not need to create a Hello World Worker or paste code into the dashboard first. If Wrangler asks which account to use or asks you to choose a workers.dev subdomain, follow its prompts.

When deployment finishes, copy the Worker address it prints. It will look like:

```text
https://canvas-drawbox.YOUR-SUBDOMAIN.workers.dev
```

This first deployment creates the service so you can finish its settings. The example origins are deliberately unconfigured at this point, so it is not ready for visitors yet.

You can now find the Worker under **Workers & Pages** in the dashboard. Open it, then choose **Settings** in the top row:

![Open the Settings tab on your Worker](images/cloudflare-worker-settings.jpg)

Scroll to **Bindings**. It should show a **D1 database** with the binding name **DB** and your database selected. Wrangler adds this from the config file.

![Check that D1 is connected with the binding name DB](images/cloudflare-binding.jpg)

The database name is hidden in this screenshot. Yours should match the database you created in step 2.

## 5. Connect your website

Open `config.json` and replace both example addresses:

```json
{
  "allowedOrigins": ["https://your-site.example"],
  "workerOrigin": "https://canvas-drawbox.YOUR-SUBDOMAIN.workers.dev"
}
```

For **allowedOrigins**, use your website address without a trailing slash or page path. For example, use `https://your-name.neocities.org`, not a link to a post. Add another address only if you use that website too.

For **workerOrigin**, paste the actual Worker address from the deployment, also without a trailing slash.

## 6. Add your private inbox key

Generate a long random password in your password manager. Save it, then run:

```sh
npx wrangler secret put INBOX_TOKEN --config backend/wrangler.jsonc
```

Paste that password into Wrangler’s private prompt. This key protects the private inbox and is also needed to accept drawings. Keep it out of your website and public source files.

You can add it from the dashboard instead, under **Workers & Pages → your Worker → Settings → Runtime variables and secrets → Add variable**:

![Enter a secret name and turn on Secret](images/cloudflare-secret.jpg)

Use **INBOX_TOKEN** as the name and turn on **Secret**. The image uses `YOUR_SECRET_NAME` only to show where the name goes. Paste the value privately and save it. For optional email, the separate secret is named **RESEND_API_KEY**.

After saving, the list should show **Secret** and **Value encrypted**. You only need **INBOX_TOKEN** for the inbox. **RESEND_API_KEY** appears here too if you set up optional email.

![Saved secrets appear with encrypted values](images/cloudflare-secrets-list.jpg)

Finish by deploying your website settings:

```sh
npm run deploy
```

## 7. Check the Worker settings

Open your Worker’s **Settings** in Cloudflare:

- **Bindings:** D1 should be connected as **DB**.
- **Runtime variables and secrets:** **INBOX_TOKEN** should be stored as a secret. Its value should not be visible.
- **Trigger events → Cron triggers:** keep `*/5 * * * *`. This runs cleanup and optional email retries every five minutes. The config adds it for you.

Scroll to **Trigger events** to check the schedule. **Runs** should say **Every 5 minutes**, as shown below. The next run time will be different on your screen. You do not need to add another trigger if this one is already there.

![Cron triggers shows that cleanup runs every five minutes](images/cloudflare-cron.jpg)

You can also open `https://YOUR-WORKER-ADDRESS/health`. A response containing `"ok":true` confirms the database check worked. It does not confirm that email is configured or delivered.

The Worker’s main address is intentionally blank when opened on its own. That is expected; the drawing box appears inside your website.

## 8. Add DrawBoxCFL to your website

The build creates `website-files/`:

1. Upload **drawbox-embed.mjs** from that folder to your website root, beside your main HTML file.
2. Open **embed.html** in a text editor and copy its contents.
3. Paste that block into your website’s HTML where you want the drawing box, then upload the edited page.

Keep both the iframe and its script. The script gives the color picker and expanding message box enough room.

Visit the page on your actual website and send a small drawing. Confirm it appears in the [private inbox](INBOX.md). If you want drawings by email too, follow the [Resend guide](EMAIL.md).

## If something does not work

- **Blank on your website:** check that `allowedOrigins` matches its address exactly. Your host must also allow the Worker iframe and the script.
- **Database error:** check the database ID, the **DB** binding and that you ran the schema command.
- **Service not configured:** make sure **INBOX_TOKEN** is saved on the correct Worker.
- **Clipped message box:** upload the sizing module and keep its script with the iframe.
- **Please wait before sending again:** that is the cooldown. Your drawing stays there so you can send it later.
- **Works locally but not online:** after changing an address or source file, deploy again and upload the newly generated website module and embed block.

The file in `examples/preview.html` is a separate visual preview. It has no backend connection and cannot send drawings. Use the generated website embed for the real box.

More detail: [Cloudflare’s D1 setup guide](https://developers.cloudflare.com/d1/get-started/), [Worker deployment guide](https://developers.cloudflare.com/workers/get-started/guide/) and the project’s [API and limits](API.md).
