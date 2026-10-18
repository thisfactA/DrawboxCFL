# Connect DrawBoxCFL to Cloudflare

Cloudflare stores the drawings and runs the small service that receives them. You only need to do this setup once. After that, changes to the drawing box can be uploaded with `npm run deploy`.

The screenshots show the real dashboard, cropped to the fields you need. The names are examples, and no account details or keys are included. Cloudflare may move things around over time, but the settings below are the ones that matter.

## 1. Get the project ready

Download the project ZIP from GitHub and unzip it, or clone the repository. Install Node.js 22.13 or newer, then open a terminal in the project folder and run:

```sh
npm ci
npx wrangler login
```

Wrangler is Cloudflare’s command-line tool. The second command opens a browser so you can sign in to your own Cloudflare account. Come back to the terminal when it finishes.

## 2. Create a database

In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **Storage & databases → D1 SQLite Database → Create Database**. If your sidebar looks different, use the dashboard search to find D1.

![Name the database and leave the default location selected](images/cloudflare-d1.jpg)

1. Name it **canvas-drawings**.
2. Leave the default **Location** selected unless you have a reason to choose another region.
3. Scroll down and click **Create**.

Copy the new database’s **Database ID** or **UUID**. Open `backend/wrangler.jsonc` in a text editor and replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` with that ID. Keep the quotes around it. Leave the binding name as **DB** and the database name as **canvas-drawings**.

Already created it with `npx wrangler d1 create canvas-drawings` from the README? Use that database instead. You do not need a second one.

## 3. Set your website and Worker addresses

Open `config.json`. Replace the example addresses with your own:

```json
{
  "allowedOrigins": ["https://your-site.example"],
  "workerOrigin": "https://canvas-drawbox.YOUR-SUBDOMAIN.workers.dev"
}
```

**allowedOrigins** is your website’s address, without a trailing slash or page path. For example, use `https://your-name.neocities.org`, not a link to an individual page. Add another address only if you use it too.

**workerOrigin** is the address of your DrawBoxCFL Worker. The Worker name in `backend/wrangler.jsonc` starts as `canvas-drawbox`. Its workers.dev subdomain belongs to your Cloudflare account; you can find it in **Workers & Pages**.

If you do not know the Worker address yet, leave its example address for the first deployment. Wrangler will print the real address. Put that address in `config.json`, then run `npm run deploy` again before embedding the box.

## 4. Add the database tables and private key

Back in your terminal, run:

```sh
npx wrangler d1 execute canvas-drawings --remote --file backend/schema.sql --config backend/wrangler.jsonc
npx wrangler secret put INBOX_TOKEN --config backend/wrangler.jsonc
```

The first command creates the tables in your new database. The second asks for a private inbox key. Generate a long random password in your password manager, paste it into the prompt, and keep a copy. You’ll use the same key to open your private inbox later.

You can also add secrets from the dashboard under **Workers & Pages → your Worker → Settings → Runtime variables and secrets → Add variable**. This is what that form looks like:

![Enter a secret name and turn on Secret](images/cloudflare-secret.jpg)

Use **INBOX_TOKEN** as the name for the inbox key. For the optional email key, use **RESEND_API_KEY**. The image uses `YOUR_SECRET_NAME` as a placeholder; do not use that name in your real setup. Paste the value privately, turn on **Secret**, and save it. The terminal command above is the simpler option.

Do not put either key in `config.json`, your website, or a public repository.

## 5. Deploy DrawBoxCFL

```sh
npm run deploy
```

This builds the widget and uploads the Worker. Wrangler prints its address when done. If you left the example Worker address in step 3, replace it now and deploy again.

Open your Worker in **Workers & Pages → Settings**. Under **Bindings**, you should see a D1 database named **DB**. The project config adds this binding for you. Keep the five-minute scheduled trigger too; it handles cleanup and email retries.

## 6. Put the box on your website

The build creates a folder called `website-files/`:

1. Upload **drawbox-embed.mjs** from that folder to the root of your website, beside your main HTML file.
2. Open **embed.html** in a text editor and copy its contents.
3. Paste that block into your website’s HTML where you want the drawing box, then upload the edited page.

Keep both the iframe and its script. The script gives the color picker and expanding message box enough room.

Visit the page on your actual website and try a small drawing. Opening the Worker address by itself is intentionally blank. Once a drawing sends, you can [open the private inbox](INBOX.md), or [set up email](EMAIL.md).

## If it does not show or send

- **Blank on your website:** check that `allowedOrigins` matches the website address exactly. Also check whether your host allows the Worker iframe and script.
- **Database error:** check the database ID, the **DB** binding, and that you ran the schema command.
- **Clipped message box:** make sure you uploaded the sizing module and kept its script beside the iframe.
- **Please wait before sending again:** that is the cooldown. The drawing stays there so you can send it later.

More detail: [Cloudflare’s D1 setup guide](https://developers.cloudflare.com/d1/get-started/) and the project’s [API and limits](API.md).
