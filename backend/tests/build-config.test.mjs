import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

// Exercise the actual build in isolation, including repeated changes of origin.
test('configured builds keep source files intact and support a local Worker', async t => {
  const project=path.resolve(import.meta.dirname,'../..');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'drawbox-build-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  for(const name of ['scripts','backend','examples']) await fs.cp(path.join(project,name),path.join(root,name),{recursive:true});
  for(const name of ['drawbox.html','drawbox.css','drawbox.js']) await fs.copyFile(path.join(project,name),path.join(root,name));
  await fs.symlink(path.join(project,'node_modules'),path.join(root,'node_modules'),'dir');
  const sources=['backend/embed-frame.mjs','backend/viewer.py','backend/examples/embed.html','backend/tests/drawbox-frame.test.mjs','backend/tests/setup.test.mjs'];
  const before=await Promise.all(sources.map(file=>fs.readFile(path.join(root,file),'utf8')));
  for(const origin of ['https://one.test','https://two.test','http://127.0.0.1:8787']) {
    await fs.writeFile(path.join(root,'config.json'),JSON.stringify({allowedOrigins:['http://127.0.0.1:4327'],workerOrigin:origin}));
    execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'pipe'});
    for(const file of ['website-files/embed.html','website-files/drawbox-embed.mjs','website-files/example.html']) {
      const text=await fs.readFile(path.join(root,file),'utf8');assert.ok(text.includes(origin),file);assert.ok(!text.includes('https://drawbox.example.invalid'),file);
    }
    assert.deepEqual(await Promise.all(sources.map(file=>fs.readFile(path.join(root,file),'utf8'))),before);
  }
  await fs.writeFile(path.join(root,'config.json'),JSON.stringify({allowedOrigins:['https://one.test'],workerOrigin:'http://remote.test'}));
  assert.throws(()=>execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,stdio:'pipe'}),/HTTP only for localhost/);
});
