import widget from './widget.html';
import {allowedOrigins} from './settings.mjs';
import {emailMigrations,drainEmail} from './email-outbox.mjs';
export const MAX_DRAWINGS=5000,MAX_STORAGE_BYTES=200_000_000,MAX_RENDER_WORK=8_000_000;
// Counts include Trash. Never silently discard a received drawing to admit another.
export const TRASH_RETENTION_MS=7*24*60*60*1000;
export const trashMigrations=[
 "CREATE TABLE IF NOT EXISTS drawing_trash (drawing_id TEXT PRIMARY KEY REFERENCES drawings(id) ON DELETE CASCADE, trashed_at INTEGER NOT NULL)",
 "CREATE INDEX IF NOT EXISTS drawing_trash_time ON drawing_trash(trashed_at)",
 // Existing Trash receives a full seven-day recovery period when this feature starts.
 "INSERT OR IGNORE INTO drawing_trash(drawing_id,trashed_at) SELECT id,CAST(strftime('%s','now') AS INTEGER)*1000 FROM drawings WHERE approved<0",
 "CREATE TRIGGER IF NOT EXISTS drawing_trash_enter AFTER UPDATE OF approved ON drawings WHEN NEW.approved<0 AND OLD.approved>=0 BEGIN INSERT INTO drawing_trash(drawing_id,trashed_at) VALUES(NEW.id,CAST(strftime('%s','now') AS INTEGER)*1000) ON CONFLICT(drawing_id) DO UPDATE SET trashed_at=excluded.trashed_at; END",
 "CREATE TRIGGER IF NOT EXISTS drawing_trash_restore AFTER UPDATE OF approved ON drawings WHEN NEW.approved>=0 BEGIN DELETE FROM drawing_trash WHERE drawing_id=NEW.id; END",
 "CREATE TRIGGER IF NOT EXISTS drawing_trash_delete AFTER DELETE ON drawings BEGIN DELETE FROM drawing_trash WHERE drawing_id=OLD.id; END"
];
export async function purgeExpiredTrash(db,now=Date.now()){
 return db.prepare("DELETE FROM drawings WHERE approved<0 AND id IN (SELECT drawing_id FROM drawing_trash WHERE trashed_at<=? ORDER BY trashed_at LIMIT 200)").bind(now-TRASH_RETENTION_MS).run();
}
const migrations=[
 ...trashMigrations,
 ...emailMigrations,
 'CREATE TABLE IF NOT EXISTS drawing_messages (drawing_id TEXT PRIMARY KEY REFERENCES drawings(id) ON DELETE CASCADE, message TEXT NOT NULL DEFAULT \'\')',
 'CREATE TRIGGER IF NOT EXISTS drawing_message_delete AFTER DELETE ON drawings BEGIN DELETE FROM drawing_messages WHERE drawing_id=OLD.id; END',

 'CREATE INDEX IF NOT EXISTS drawings_created ON drawings(created_at)',
 'CREATE TABLE IF NOT EXISTS drawing_capacity (id INTEGER PRIMARY KEY CHECK(id=1), records INTEGER NOT NULL, bytes INTEGER NOT NULL)',
 'INSERT OR IGNORE INTO drawing_capacity SELECT 1,(SELECT COUNT(*) FROM drawings),(SELECT COALESCE(SUM(length(strokes)),0) FROM drawings) WHERE NOT EXISTS(SELECT 1 FROM drawing_capacity WHERE id=1)',
 'CREATE TRIGGER IF NOT EXISTS drawing_capacity_insert AFTER INSERT ON drawings BEGIN UPDATE drawing_capacity SET records=records+1,bytes=bytes+length(NEW.strokes) WHERE id=1; END',
 'CREATE TRIGGER IF NOT EXISTS drawing_capacity_delete AFTER DELETE ON drawings BEGIN UPDATE drawing_capacity SET records=records-1,bytes=bytes-length(OLD.strokes) WHERE id=1; END',
 'CREATE TRIGGER IF NOT EXISTS drawing_capacity_update AFTER UPDATE OF strokes ON drawings BEGIN UPDATE drawing_capacity SET bytes=bytes+length(NEW.strokes)-length(OLD.strokes) WHERE id=1; END'
];
const ready=new WeakMap();
export async function ensureStorage(db){
 let pending=ready.get(db);if(!pending){pending=db.batch(migrations.map(sql=>db.prepare(sql)));ready.set(db,pending)}
 try{await pending}catch(error){ready.delete(db);throw error}
}
export function renderWork(strokes){let work=0;for(const s of strokes){
 if(s.tool==='fill'){work+=62500}else{const n=Math.round(s.size);let steps=1;for(let i=1;i<s.points.length;i++)steps+=Math.max(Math.abs(Math.round(s.points[i][0]*250)-Math.round(s.points[i-1][0]*250)),Math.abs(Math.round(s.points[i][1]*250)-Math.round(s.points[i-1][1]*250)))+1;work+=steps*n*n}
 if(work>MAX_RENDER_WORK)throw Error('Drawing is too complex. Use fewer strokes or a smaller brush.');
 }return work}
const allowed=new Set(allowedOrigins);
export function validateDrawing(body){
 if(!body||typeof body!=='object'||body.website)throw Error('Invalid submission.');
 const name=String(body.name||'').trim().slice(0,40),list=body.strokes;
 if(body.message!==undefined&&(typeof body.message!=='string'||body.message.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.message)))throw Error('Message must be at most 1,000 characters.');
 const message=(body.message||'').replace(/\r\n?/g,'\n').trim();
 if(!Array.isArray(list)||!list.length||list.length>300)throw Error('Use between 1 and 300 strokes.');
 let points=0;const strokes=list.map(s=>{if(!s||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.size)||s.size<1||s.size>40||!Array.isArray(s.points)||!s.points.length||s.points.length>2000)throw Error('Invalid drawing.');points+=s.points.length;if(points>20000)throw Error('Drawing is too detailed.');if(s.tool!==undefined&&s.tool!=='fill')throw Error('Invalid drawing tool.');if(s.tool==='fill'&&s.points.length!==1)throw Error('Invalid fill.');return {...(s.tool?{tool:s.tool}:{}),color:s.color,size:s.size,points:s.points.map(p=>{if(!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1))throw Error('Invalid drawing coordinates.');return p.map(n=>Math.round(n*10000)/10000)})}});
 renderWork(strokes);return {name,strokes,message};
}
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
async function readBody(request){const reader=request.body?.getReader();if(!reader)throw Error('Empty drawing.');let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>220000){await reader.cancel();throw Error('Drawing is too large.')}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(bytes))}
// Inbox access is separate from public drawing submission and exposes no visitor hashes.
export async function inbox(request,env,url){
 const origin=request.headers.get('Origin');
 const cors=origin==='http://127.0.0.1:4319'?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...cors}});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed.'},405);
 if(!env.INBOX_TOKEN)return reply({error:'Private inbox is not connected yet.'},503);
 const supplied=request.headers.get('Authorization')||'';
 const hash=async value=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
 const [a,b]=await Promise.all([hash(supplied),hash('Bearer '+env.INBOX_TOKEN)]);let different=0;for(let i=0;i<a.length;i++)different|=a[i]^b[i];
 if(different)return reply({error:'The inbox key is not valid.'},401);
 if(request.method==='POST'){
  let body;try{body=await readBody(request)}catch{return reply({error:'Invalid inbox action.'},400)}
  if(!body||!['trash','restore','delete'].includes(body.action)||typeof body.id!=='string'||!/^[0-9a-f-]{36}$/i.test(body.id))return reply({error:'Invalid inbox action.'},400);
  await ensureStorage(env.DB);
  if(body.action==='delete'){
   const deleted=await env.DB.prepare('DELETE FROM drawings WHERE id=? AND approved<0').bind(body.id).run();
   return (deleted.meta?.changes??deleted.changes)?reply({ok:true}):reply({error:'Only drawings in Trash can be permanently deleted.'},409);
  }
  const result=await env.DB.prepare('UPDATE drawings SET approved=? WHERE id=?').bind(body.action==='trash'?-1:0,body.id).run();
  return reply({ok:!!(result.meta?.changes??result.changes)});
 }
 const before=Number(url.searchParams.get('before')||Number.MAX_SAFE_INTEGER),id=url.searchParams.get('id')||'~';
 if(!Number.isSafeInteger(before)||before<0||id.length>100)return reply({error:'Invalid page.'},400);
 await ensureStorage(env.DB);
 const data=await env.DB.prepare("SELECT d.id,d.created_at,d.name,d.strokes,d.approved,COALESCE(m.message,'') AS message,t.trashed_at FROM drawings d LEFT JOIN drawing_messages m ON m.drawing_id=d.id LEFT JOIN drawing_trash t ON t.drawing_id=d.id WHERE d.created_at<? OR (d.created_at=? AND d.id<?) ORDER BY d.created_at DESC,d.id DESC LIMIT 20").bind(before,before,id).all();
 const rows=data.results||[],last=rows.at(-1);return reply({drawings:rows,next:rows.length===20?{before:last.created_at,id:last.id}:null});
}
export default {async scheduled(event,env,ctx){await ensureStorage(env.DB);await purgeExpiredTrash(env.DB);await drainEmail(env)},async fetch(request,env,ctx){
 const url=new URL(request.url),own=url.origin;
 try{
 if(url.pathname==='/'&&request.method==='GET'&&request.headers.get('Sec-Fetch-Dest')==='document')return new Response('',{status:404,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
 if(url.pathname==='/'&&request.method==='GET')return new Response(widget,{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors "+allowedOrigins.join(' ')+" file:; base-uri 'none'; form-action 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
 if(!env.DB)return json({error:'Storage is not configured.'},503);
 if(url.pathname==='/api/inbox')return await inbox(request,env,url);
 if(url.pathname==='/health'&&request.method==='GET') {await ensureStorage(env.DB);await env.DB.prepare('SELECT id FROM drawings LIMIT 1').all();return json({ok:true,moderation:'approval-required'})}
 if(url.pathname==='/api/drawings'&&request.method==='POST'){
  if(![own,...allowed].includes(request.headers.get('Origin')))return json({error:'Submission origin is not allowed.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'Expected a drawing.'},415);
  let drawing;try{drawing=validateDrawing(await readBody(request))}catch(e){return json({error:e.message},400)}
  if(!env.INBOX_TOKEN)return json({error:'Drawing service is not configured.'},503);
  await ensureStorage(env.DB);
  const now=Date.now(),ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'Could not verify submission.'},403);
  // Domain-separated HMAC prevents offline guessing of IP addresses from database hashes.
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.INBOX_TOKEN),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const visitorFor=async time=>[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('drawbox-visitor-v2:'+new Date(time).toISOString().slice(0,10)+':'+ip)))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const [visitor,previous]=await Promise.all([visitorFor(now),visitorFor(now-86400000)]);
  const id=crypto.randomUUID(),serialized=JSON.stringify(drawing.strokes);
  const admission=env.DB.prepare('INSERT INTO drawings(id,created_at,name,strokes,approved,visitor) SELECT ?,?,?,?,0,? WHERE EXISTS(SELECT 1 FROM drawing_capacity WHERE id=1 AND records<? AND bytes+?<=?) AND (SELECT COUNT(*) FROM drawings WHERE created_at>?)<500 AND NOT EXISTS(SELECT 1 FROM drawings WHERE visitor IN (?,?) AND created_at>?) AND (SELECT COUNT(*) FROM drawings WHERE visitor IN (?,?) AND created_at>?)<5').bind(id,now,drawing.name,serialized,visitor,MAX_DRAWINGS,serialized.length,MAX_STORAGE_BYTES,now-86400000,visitor,previous,now-60000,visitor,previous,now-3600000);
  const statements=[admission,env.DB.prepare('INSERT INTO drawing_messages(drawing_id,message) SELECT id,? FROM drawings WHERE id=?').bind(drawing.message,id)];
  if(env.RESEND_API_KEY&&env.MAIL_TO)statements.push(env.DB.prepare('INSERT INTO drawing_mail(drawing_id) SELECT id FROM drawings WHERE id=?').bind(id));
  const [result]=await env.DB.batch(statements);
  if(!(result.meta?.changes??result.changes)){
   const capacity=await env.DB.prepare('SELECT records,bytes FROM drawing_capacity WHERE id=1').first();
   if(capacity&&(capacity.records>=MAX_DRAWINGS||capacity.bytes+serialized.length>MAX_STORAGE_BYTES))return json({error:'The drawing inbox is full. Please try another day.'},409);
   return json({error:'Please wait before sending another drawing.'},429);
  }
  if(env.RESEND_API_KEY&&env.MAIL_TO&&ctx)ctx.waitUntil(drainEmail(env).catch(()=>console.error('Drawing email queue needs retry')));
  return json({id,status:'pending'},201);
 }
 return json({error:'Not found.'},404);
 }catch{return json({error:'Drawing service is temporarily unavailable. Please try again later.'},503)}
}};
