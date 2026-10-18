import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parse} from 'jsonc-parser';
import {setup, httpsOrigin, websiteOrigins} from '../../scripts/setup.mjs';

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'drawbox-setup-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  await fs.mkdir(path.join(root, 'backend'));
  await fs.writeFile(path.join(root, 'config.json'), JSON.stringify({allowedOrigins: ['https://example.invalid'], workerOrigin: 'https://drawbox.example.invalid', extra: true}));
  await fs.writeFile(path.join(root, 'backend/wrangler.jsonc'), '// Keep this comment\n'+JSON.stringify({name:'canvas-drawbox',d1_databases:[{binding:'DB',database_name:'canvas-drawings',database_id:'REPLACE_ME'}],triggers:{crons:['*/5 * * * *']},vars:{MAIL_TO:''}}));
  return root;
}
const id = '12345678-1234-1234-1234-123456789abc';

test('setup rejects unsafe or placeholder addresses and accepts HTTPS origins', () => {
  for (const value of ['http://site.test','https://site.test/post','https://site.test/?x=1','https://site.test/#x','https://user:pass@site.test','https://example.invalid']) assert.throws(() => httpsOrigin(value));
  assert.equal(httpsOrigin('https://SITE.test/'), 'https://site.test');
  assert.deepEqual(websiteOrigins('https://site.test, https://other.test/, https://site.test'), ['https://site.test','https://other.test']);
});

test('setup preserves comments and other settings, backs up originals and supports a second run', async t => {
  const root=await fixture(t), answers=['http://wrong.test','https://site.test,https://other.test','','','bad-id',id,''];
  const before=await fs.readFile(path.join(root,'backend/wrangler.jsonc'),'utf8');
  await setup(root, async()=>{assert.ok(answers.length);return answers.shift();},()=>{});
  const config=JSON.parse(await fs.readFile(path.join(root,'config.json'),'utf8'));
  assert.deepEqual(config.allowedOrigins,['https://site.test','https://other.test']);assert.equal(config.extra,true);
  const text=await fs.readFile(path.join(root,'backend/wrangler.jsonc'),'utf8'), worker=parse(text);
  assert.ok(text.startsWith('// Keep this comment'));assert.equal(worker.d1_databases[0].database_id,id);assert.deepEqual(worker.triggers.crons,['*/5 * * * *']);
  const backups=await fs.readdir(path.join(root,'.setup-backups'));assert.equal(backups.length,1);assert.equal(await fs.readFile(path.join(root,'.setup-backups',backups[0],'wrangler.jsonc'),'utf8'),before);
  const second=['','','','','https://canvas-drawbox.demo.workers.dev/'];
  await setup(root,async()=>{assert.ok(second.length);return second.shift();},()=>{});
  assert.equal(JSON.parse(await fs.readFile(path.join(root,'config.json'),'utf8')).workerOrigin,'https://canvas-drawbox.demo.workers.dev');
});

test('canceling prompts leaves both files untouched', async t => {
  const root=await fixture(t),files=['config.json','backend/wrangler.jsonc'];
  const before=await Promise.all(files.map(f=>fs.readFile(path.join(root,f),'utf8')));
  await assert.rejects(setup(root,async()=>{throw Error('Canceled');},()=>{}),/Canceled/);
  assert.deepEqual(await Promise.all(files.map(f=>fs.readFile(path.join(root,f),'utf8'))),before);
  await assert.rejects(fs.stat(path.join(root,'.setup-backups')), {code:'ENOENT'});
});
