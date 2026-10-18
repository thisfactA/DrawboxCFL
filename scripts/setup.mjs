import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {parse, modify, applyEdits} from 'jsonc-parser';

export function websiteOrigins(value) {
  const origins = value.split(',').map(value => httpsOrigin(value.trim()));
  return [...new Set(origins)];
}

export function httpsOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Error('Use an HTTPS website address without a page path, query, or login details.');
  }
  if (url.hostname.endsWith('.invalid') || url.hostname.endsWith('.example') || /YOUR-SUBDOMAIN|YOUR-WORKER/i.test(value)) {
    throw Error('Enter your own address, rather than the example address.');
  }
  return url.origin;
}

function name(value) {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(value)) throw Error('Use a name starting with a lowercase letter, followed by lowercase letters, numbers, or hyphens (up to 63 characters).');
  return value;
}

function databaseID(value) {
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)) throw Error('Paste the complete Database ID from Cloudflare.');
  return value;
}

function readJSONC(text) {
  const errors = [];
  const value = parse(text, errors, {allowTrailingComma: true});
  if (errors.length || !value || typeof value !== 'object' || Array.isArray(value)) throw Error('The config file contains invalid JSON. Fix it before running setup.');
  return value;
}

export async function setup(root, ask, log = console.log) {
  const configPath = path.join(root, 'config.json');
  const workerPath = path.join(root, 'backend/wrangler.jsonc');
  const originals = await Promise.all([configPath, workerPath].map(file => fs.readFile(file, 'utf8')));
  const config = readJSONC(originals[0]);
  const worker = readJSONC(originals[1]);
  const dbIndex = worker.d1_databases?.findIndex(db => db.binding === 'DB');
  if (!(dbIndex >= 0)) throw Error('Keep the D1 binding named DB in backend/wrangler.jsonc.');
  const db = worker.d1_databases[dbIndex];
  const prompt = async (label, current, validate) => {
    for (;;) {
      const response = (await ask(`${label}${current ? ` [${current}]` : ''}: `)).trim();
      try { return validate(response || current || ''); }
      catch (error) { log(error.message); }
    }
  };
  log('DrawBoxCFL setup\nThis updates local config files only. It does not deploy or ask for secret keys.\nPress Enter to keep a value shown in brackets.');
  let currentSites = '';
  try { currentSites = websiteOrigins(config.allowedOrigins.join(',')).join(', '); } catch {}
  const sites = await prompt('Your website address (separate extra sites with commas)', currentSites, websiteOrigins);
  const workerName = await prompt('Worker name', worker.name || 'canvas-drawbox', name);
  const dbName = await prompt('Database name', db.database_name || 'canvas-drawings', name);
  let currentID = '';
  try { currentID = databaseID(db.database_id); } catch {}
  const id = await prompt('Database ID', currentID, databaseID);
  let currentOrigin = '';
  try { currentOrigin = httpsOrigin(config.workerOrigin); } catch {}
  const origin = await prompt('Worker address (leave blank if you have not deployed yet)', currentOrigin, value => value ? httpsOrigin(value) : null);
  const edits = (text, changes) => changes.reduce((result, [keys, value]) => applyEdits(result, modify(result, keys, value, {formattingOptions: {insertSpaces: true, tabSize: 2}})), text);
  const updatedConfig = edits(originals[0], [[['allowedOrigins'], sites], [['workerOrigin'], origin || 'https://drawbox.example.invalid']]);
  const updatedWorker = edits(originals[1], [[['name'], workerName], [['d1_databases', dbIndex, 'database_name'], dbName], [['d1_databases', dbIndex, 'database_id'], id]]);
  const backup = path.join(root, '.setup-backups', `${Date.now()}-${randomUUID()}`);
  await fs.mkdir(backup, {recursive: true});
  await Promise.all(originals.map((text, i) => fs.writeFile(path.join(backup, i ? 'wrangler.jsonc' : 'config.json'), text, {mode: 0o600})));
  try {
    await fs.writeFile(configPath, updatedConfig);
    await fs.writeFile(workerPath, updatedWorker);
  } catch (error) {
    await Promise.all([configPath, workerPath].map((file, i) => fs.writeFile(file, originals[i])));
    throw error;
  }
  log(`\nSaved config.json and backend/wrangler.jsonc.\nPrevious copies: ${path.relative(root, backup)}`);
  if (!origin) log('After the first deployment, run npm run setup again and paste the Worker address. Keep the other answers with Enter.');
  log('Continue with the Cloudflare guide. Email can be added after your first drawing arrives.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const terminal = createInterface({input: process.stdin, output: process.stdout});
  try { await setup(path.resolve(import.meta.dirname, '..'), question => terminal.question(question)); }
  catch (error) { console.error(`Setup stopped: ${error.message}`); process.exitCode = 1; }
  finally { terminal.close(); }
}
