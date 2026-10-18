import {build} from 'esbuild';import fs from 'node:fs/promises';import path from 'node:path';
const root=import.meta.dirname,config=JSON.parse(await fs.readFile(path.join(root,'config.json'),'utf8'));
if(!Array.isArray(config.allowedOrigins)||!config.allowedOrigins.length)throw Error('Configure allowedOrigins');
for(const origin of config.allowedOrigins){const u=new URL(origin),local=['localhost','127.0.0.1'].includes(u.hostname);if((u.protocol!=='https:'&&!(local&&u.protocol==='http:'))||u.origin!==origin||u.username||u.password)throw Error('Use exact HTTPS origins; HTTP only for localhost')}
if(typeof config.workerOrigin!=='string')throw Error('Set workerOrigin');
const workerURL=new URL(config.workerOrigin);if(workerURL.protocol!=='https:'||workerURL.origin!==config.workerOrigin)throw Error('workerOrigin must be a bare HTTPS origin');
let previous='https://drawbox.example.invalid';try{previous=JSON.parse(await fs.readFile(path.join(root,'.configured.json'),'utf8')).workerOrigin}catch{}
async function replaceOrigin(folder){for(const entry of await fs.readdir(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory()){await replaceOrigin(file);continue}if(!/\.(?:mjs|html|py)$/.test(entry.name))continue;await fs.writeFile(file,(await fs.readFile(file,'utf8')).split(previous).join(config.workerOrigin))}}
for(const file of ['embed-frame.mjs','viewer.py'])await fs.writeFile(path.join(root,file),(await fs.readFile(path.join(root,file),'utf8')).split(previous).join(config.workerOrigin));
await replaceOrigin(path.join(root,'examples'));await replaceOrigin(path.join(root,'tests'));
await fs.writeFile(path.join(root,'.configured.json'),JSON.stringify({workerOrigin:config.workerOrigin})+'\n');
await fs.writeFile(path.join(root,'settings.mjs'),'export const allowedOrigins = '+JSON.stringify(config.allowedOrigins)+';\n');
await build({stdin:{contents:"export {default} from './worker.mjs';",resolveDir:root,sourcefile:'worker-entry.mjs'},bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text'},outfile:path.join(root,'deploy.js')});console.log('Built Drawbox with configured origin allowlist');
