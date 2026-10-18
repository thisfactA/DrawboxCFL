import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const result=await build({entryPoints:[fileURLToPath(new URL('../worker.mjs',import.meta.url))],bundle:true,format:'esm',platform:'browser',target:'es2022',loader:{'.html':'text'},write:false});
export const worker=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
