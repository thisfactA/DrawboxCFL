# Connect DrawBoxCFL to Cloudflare

You’ll need Node.js 22.13 or newer, a Cloudflare account, and a website you can edit. Run the commands below from the project folder. The setup command fills in the config files for you.

## 1. Install the project tools

Download and unzip the project, then open a terminal in its folder:

```sh
npm ci
npx wrangler login
```

Wrangler opens a browser for you to sign in to Cloudflare. Return to the terminal once you’re signed in.

**You should now see:** a message confirming that Wrangler is logged in.

## 2. Create the database

```sh
npx wrangler d1 create canvas-drawings
```

Copy the **database_id** from the output. Keep the name `canvas-drawings` to use the rest of the commands as written. If you already created this database, use its existing ID instead.

**You should now see:** the database name and an ID made of letters, numbers, and hyphens.

<details>
<summary>Prefer creating the database in the dashboard?</summary>

Open the [Cloudflare dashboard](https://dash.cloudflare.com/), then **Storage & databases → D1 SQLite Database → Create Database**.

![Name the database and leave the default location selected](images/cloudflare-d1.jpg)

Name it **canvas-drawings**, leave the default **Location** selected, and click **Create**. Open its **Overview** tab and copy the Database ID above the charts:

![Copy the Database ID from the database Overview tab](images/cloudflare-database-id.jpg)

Continue with step 3. You only need one database.

</details>

## 3. Run the setup command

```sh
npm run setup
```

It asks for:

- **Your website address**, such as `https://your-name.neocities.org`. Use the main address, without a page path. Extra website addresses can be separated with commas.
- **Worker name** and **database name**. Press Enter to keep the defaults. The database name must match the one from step 2.
- **Database ID**, which you just copied.
- **Worker address**. Leave this blank for now if you haven’t deployed yet.

Setup updates `config.json` and `backend/wrangler.jsonc`. It keeps copies of the previous files in `.setup-backups/`. It does not deploy anything or ask for secret keys. You don’t need to edit `worker.mjs` or paste backend code into Cloudflare.

**You should now see:** “Saved config.json and backend/wrangler.jsonc.”

<details>
<summary>Want to edit the config files yourself?</summary>

In `config.json`, set `allowedOrigins` to your website addresses and `workerOrigin` to your Worker address. Use bare HTTPS addresses without page paths or trailing slashes.

In `backend/wrangler.jsonc`, set `name`, `database_name`, and `database_id`. Keep the binding named **DB** and leave the other settings as they are.

If you don’t know the Worker address yet, leave its placeholder in place until step 5.

</details>

## 4. Create the Worker

Add the database tables, then deploy:

```sh
npx wrangler d1 execute canvas-drawings --remote --file backend/schema.sql --config backend/wrangler.jsonc
npm run deploy
```

If you chose a different database name, use it in the first command. Wrangler builds and uploads the Worker. It may ask you to select your account or choose a workers.dev subdomain.

Copy the Worker address printed when deployment finishes. It will look like:

```text
https://canvas-drawbox.YOUR-SUBDOMAIN.workers.dev
```

The Worker now exists, but you still need to finish its address settings and add an inbox key.

**You should now see:** a successful deployment and your Worker’s HTTPS address.

<details>
<summary>Where can I find the Worker in the dashboard?</summary>

Open **Workers & Pages**, then your Worker. Its **Overview** tab shows the address at the top. Under **Deployments**, look for **Active deployment**:

![Worker address location and active deployment with 100 percent traffic](images/cloudflare-deployment.jpg)

This shows an existing deployment with its address hidden. Copy your own address from the terminal or dashboard.

</details>

## 5. Save your Worker address

Run setup again:

```sh
npm run setup
```

Press Enter to keep your previous answers. At **Worker address**, paste the address from step 4. This is different from your website address: the website displays the drawing box, while the Worker receives drawings.

**You should now see:** the saved-files message again, with your Worker address filled in when you next run setup.

## 6. Add your private inbox key

Create a long random password in your password manager and save it. Then run:

```sh
npx wrangler secret put INBOX_TOKEN --config backend/wrangler.jsonc
```

Paste the password when Wrangler asks for the secret value. You’ll use it to open your private inbox. Keep it out of your website and public files.

Apply the address settings you saved in step 5:

```sh
npm run deploy
```

**You should now see:** confirmation that the secret was saved, followed by another successful deployment.

<details>
<summary>Prefer adding the key in the dashboard?</summary>

Open **Workers & Pages → your Worker → Settings → Runtime variables and secrets → Add variable**.

![Open the Settings tab on your Worker](images/cloudflare-worker-settings.jpg)

Enter **INBOX_TOKEN** in the name field shown as `YOUR_SECRET_NAME`, turn on **Secret**, paste your password into the value field, and save it.

![Enter a secret name and turn on Secret](images/cloudflare-secret.jpg)

The list should show **Secret** and **Value encrypted** beside **INBOX_TOKEN**. Ignore **RESEND_API_KEY** for now; it’s only for optional email delivery.

![Saved secrets appear with encrypted values](images/cloudflare-secrets-list.jpg)

Run `npm run deploy` afterward to apply your website settings, as shown above.

</details>

## 7. Check the connection

Open your Worker address with `/health` at the end, for example:

```text
https://canvas-drawbox.YOUR-SUBDOMAIN.workers.dev/health
```

**You should now see:** a response containing `"ok":true`. That confirms the database connection works. Email comes later.

Opening the Worker address without `/health` shows a blank page. The drawing box appears inside your website.

<details>
<summary>Check the database binding and cleanup schedule</summary>

In your Worker’s **Settings**, scroll to **Bindings**. The database should be connected as **DB**:

![Check that D1 is connected with the binding name DB](images/cloudflare-binding.jpg)

Check that the selected database is the one from step 2.

Under **Trigger events → Cron triggers**, **Runs** should say **Every 5 minutes**. The config adds this for you. It handles cleanup and, if enabled later, email retries. Keep the `*/5 * * * *` schedule.

![Cron triggers shows that cleanup runs every five minutes](images/cloudflare-cron.jpg)

If the trigger is already there, you don’t need to add another. The next run time will depend on when you check.

</details>

## 8. Add it to your website and try it

Deployment creates a `website-files/` folder on your computer:

1. Upload **drawbox-embed.mjs** from that folder to your website root, beside your main HTML file.
2. Open **embed.html** in a text editor and copy its contents.
3. Paste that block inside your page’s `<body>`, where you want the drawing box, then upload the edited page.

![Paste the full generated embed block inside the HTML body](images/website-embed-placement.jpg)

The red box shows where the embed goes. Copy from your own `website-files/embed.html` so it uses your Worker address. Keep both the iframe and the script; the script makes room for the color picker and expanding message box.

Visit your website and send a small drawing. Follow the [inbox guide](INBOX.md) to open your private inbox.

**You should now see:** your drawing, its optional message, and a **Save PNG** button.

![A received drawing and its message in the browser inbox](images/inbox-received-drawing.jpg)

This example uses a test drawing received through a local Worker. Check that your own drawing arrives from your live website too.

## Optional: receive drawings by email

Once your first drawing arrives in the inbox, you’re ready to add email if you want it. Follow the separate [Resend guide](EMAIL.md). The drawing box works without this step.

## If something does not work

- **Blank on your website:** run `npm run setup` and check your website address. It must match exactly. Your host must also allow the Worker iframe and script.
- **Database error:** check the database ID and name, and make sure you ran the schema command in step 4.
- **Service not configured:** make sure **INBOX_TOKEN** is saved on the correct Worker.
- **Clipped message box:** upload the sizing module and keep its script with the iframe.
- **Please wait before sending again:** that is the cooldown. Your drawing stays there so you can send it later.
- **Changed a setting but nothing happened:** deploy again, then upload the newly generated website module and embed block.

Use `examples/preview.html` to try the tools without a backend. Sending is disabled there; use the generated website embed for real submissions.

More detail: [Cloudflare’s D1 setup guide](https://developers.cloudflare.com/d1/get-started/), [Worker deployment guide](https://developers.cloudflare.com/workers/get-started/guide/) and the project’s [API and limits](API.md).
