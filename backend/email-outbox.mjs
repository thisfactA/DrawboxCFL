import {drawingEmail} from './drawing-email.mjs';
// Attempts, including retries, count against a conservative free-plan budget.
export const emailMigrations=[
 `CREATE TABLE IF NOT EXISTS drawing_mail (drawing_id TEXT PRIMARY KEY REFERENCES drawings(id) ON DELETE CASCADE, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, first_at INTEGER, next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0, lease TEXT, provider_id TEXT, error TEXT)`,
 `CREATE TABLE IF NOT EXISTS drawing_mail_attempts (id TEXT PRIMARY KEY, day TEXT NOT NULL)`,
 `CREATE INDEX IF NOT EXISTS drawing_mail_attempt_day ON drawing_mail_attempts(day)`,
 `CREATE TRIGGER IF NOT EXISTS drawing_mail_delete AFTER DELETE ON drawings BEGIN DELETE FROM drawing_mail WHERE drawing_id=OLD.id; END`
];
export async function drainEmail(env,send=fetch,now=Date.now()){
 if(!env.RESEND_API_KEY||!env.MAIL_TO)return;
 const db=env.DB,day=new Date(now).toISOString().slice(0,10);
 await db.prepare("UPDATE drawing_mail SET state='review',error='Retry window expired' WHERE state='pending' AND first_at IS NOT NULL AND first_at<=? AND lease_until<=?").bind(now-23*3600000,now).run();
 const rows=await db.prepare("SELECT drawing_id FROM drawing_mail WHERE state='pending' AND next_at<=? AND lease_until<=? ORDER BY next_at,drawing_id LIMIT 3").bind(now,now).all();
 for(const row of rows.results||[]){
  const lease=crypto.randomUUID();
  // D1 batches are transactional. Only the winning claim consumes a daily slot.
  const [claimed]=await db.batch([
   db.prepare("UPDATE drawing_mail SET lease=?,lease_until=?,attempts=attempts+1,first_at=COALESCE(first_at,?) WHERE drawing_id=? AND state='pending' AND next_at<=? AND lease_until<=? AND attempts<5 AND (first_at IS NULL OR first_at>?) AND (SELECT COUNT(*) FROM drawing_mail_attempts WHERE day=?)<90 RETURNING drawing_id,attempts").bind(lease,now+60000,now,row.drawing_id,now,now,now-23*3600000,day),
   db.prepare('INSERT INTO drawing_mail_attempts(id,day) SELECT ?,? FROM drawing_mail WHERE drawing_id=? AND lease=?').bind(lease,day,row.drawing_id,lease)
  ]);
  const job=claimed.results?.[0];if(!job)continue;
  const data=await db.prepare("SELECT d.strokes,COALESCE(m.message,'') AS message FROM drawings d LEFT JOIN drawing_messages m ON m.drawing_id=d.id WHERE d.id=?").bind(row.drawing_id).first();
  if(!data)continue;
  let state='pending',error='Network error',provider=null;
  try{
   const payload={from:env.MAIL_FROM||'drawing <onboarding@resend.dev>',...drawingEmail(JSON.parse(data.strokes),data.message,env.MAIL_TO)};
   const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'drawing/'+row.drawing_id},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   if(response.ok){const body=await response.json();if(typeof body.id!=='string'||!body.id)throw Error('Missing delivery ID');state='sent';provider=body.id;error=null}
   else{error='Resend HTTP '+response.status;if(response.status<500&&![408,429].includes(response.status))state='review';await response.body?.cancel()}
  }catch{/* Keep a bounded retry without exposing provider responses or visitor content. */}
  if(state==='pending'&&job.attempts>=5){state='review';error='Delivery needs review'}
  await db.prepare('UPDATE drawing_mail SET state=?,provider_id=?,error=?,next_at=?,lease_until=0 WHERE drawing_id=? AND lease=?').bind(state,provider,error,now+(error==='Resend HTTP 429'?3600000:300000*job.attempts),row.drawing_id,lease).run();
 }
 // Retain at most 32 days of attempt counters; queued drawing content stays in D1.
 await db.prepare('DELETE FROM drawing_mail_attempts WHERE day<?').bind(new Date(now-32*86400000).toISOString().slice(0,10)).run();
}
