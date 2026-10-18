import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {buildPreview} from '../examples/build-preview.mjs';
const root=path.resolve(import.meta.dirname,'..'),backend=path.join(root,'backend');
const read=name=>fs.readFile(path.join(root,name),'utf8');
const [template,css,js]=await Promise.all(['drawbox.html','drawbox.css','drawbox.js'].map(read));
if(!template.includes('<link rel="stylesheet" href="drawbox.css">')||!template.includes('<script src="drawbox.js"></script>'))throw Error('Keep the stylesheet and script markers in drawbox.html');
const html=template.replace('<link rel="stylesheet" href="drawbox.css">',()=>'<style>\n'+css+'\n</style>').replace('<script src="drawbox.js"></script>',()=>'<script>\n'+js+'\n</script>');
await fs.writeFile(path.join(backend,'widget.html'),html);
await fs.copyFile(path.join(root,'config.json'),path.join(backend,'config.json'));
execFileSync(process.execPath,['build.mjs'],{cwd:backend,stdio:'inherit'});
const output=path.join(root,'website-files');await fs.mkdir(output,{recursive:true});

const {workerOrigin}=JSON.parse(await read('config.json'));
await fs.writeFile(path.join(output,'drawbox-embed.mjs'),(await fs.readFile(path.join(backend,'embed-frame.mjs'),'utf8')).replaceAll('https://drawbox.example.invalid',workerOrigin));
await fs.writeFile(path.join(output,'embed.html'),`<!-- Upload drawbox-embed.mjs to your website root and paste this block into your page. -->\n<style>.main-drawbox{width:480px;max-width:100%}.main-drawbox iframe{display:block;width:100%;height:510px;border:0}</style>\n<aside class="main-drawbox"><iframe src="${workerOrigin}/" title="Draw me something" loading="lazy" referrerpolicy="no-referrer"></iframe></aside>\n<script type="module">import {installDrawboxResizing} from '/drawbox-embed.mjs';installDrawboxResizing(window);</script>\n`);
const embed=await fs.readFile(path.join(output,'embed.html'),'utf8');
await fs.writeFile(path.join(output,'example.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DrawBoxCFL website example</title><style>body{margin:24px}</style>'+embed+'</html>');
console.log('Website files ready in website-files/.');

await buildPreview();
