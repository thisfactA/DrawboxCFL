import {build} from 'esbuild';import fs from 'node:fs/promises';import path from 'node:path';
const root=import.meta.dirname,config=JSON.parse(await fs.readFile(path.join(root,'config.json'),'utf8'));
if(!Array.isArray(config.allowedOrigins)||!config.allowedOrigins.length)throw Error('Configure allowedOrigins');
for(const origin of config.allowedOrigins){const u=new URL(origin),local=['localhost','127.0.0.1'].includes(u.hostname);if((u.protocol!=='https:'&&!(local&&u.protocol==='http:'))||u.origin!==origin||u.username||u.password)throw Error('Use exact HTTPS origins; HTTP only for localhost')}
if(typeof config.workerOrigin!=='string')throw Error('Set workerOrigin');
const workerURL=new URL(config.workerOrigin);const localWorker=['localhost','127.0.0.1'].includes(workerURL.hostname);
if((workerURL.protocol!=='https:'&&!(localWorker&&workerURL.protocol==='http:'))||workerURL.origin!==config.workerOrigin||workerURL.username||workerURL.password)throw Error('workerOrigin must be a bare HTTPS origin; HTTP only for localhost');
await fs.writeFile(path.join(root,'settings.mjs'),'export const allowedOrigins = '+JSON.stringify(config.allowedOrigins)+';\n');
await build({stdin:{contents:"export {default} from './worker.mjs';",resolveDir:root,sourcefile:'worker-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text'},outfile:path.join(root,'deploy.js')});console.log('Built Drawbox with configured origin allowlist');
