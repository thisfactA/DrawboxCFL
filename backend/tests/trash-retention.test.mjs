import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {worker} from './worker-module.mjs';
function setup(legacy=false){
 const sql=new DatabaseSync(':memory:');const schema=fs.readFileSync('schema.sql','utf8');sql.exec(legacy?schema.split('CREATE TABLE IF NOT EXISTS drawing_trash')[0]:schema);
 const prepare=(query,args=[])=>({query,args,bind(...args){return prepare(query,args)},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}},async all(){return{results:sql.prepare(query).all(...args)}}});
 const db={prepare,async batch(items){sql.exec('BEGIN');try{for(const item of items)sql.prepare(item.query).run(...item.args);sql.exec('COMMIT')}catch(e){sql.exec('ROLLBACK');throw e}}};
 const id='00000000-0000-0000-0000-000000000001';sql.prepare('INSERT INTO drawings VALUES(?,?,?,?,?,?)').run(id,1,'','[]',0,'visitor');
 const env={DB:db,INBOX_TOKEN:'test'};
 const action=(action,token='test')=>worker.inbox(new Request('https://example.test/api/inbox',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({id,action})}),env,new URL('https://example.test/api/inbox'));
 return{sql,db,id,action};
}
test('Trash starts a seven-day timer; repeated trash preserves it; restore and re-trash reset it',async()=>{
 const s=setup();assert.equal((await s.action('trash')).status,200);
 const first=s.sql.prepare('SELECT trashed_at FROM drawing_trash').get().trashed_at;assert.ok(Math.abs(first-Date.now())<2000);
 s.sql.prepare('UPDATE drawing_trash SET trashed_at=?').run(first-10000);await s.action('trash');assert.equal(s.sql.prepare('SELECT trashed_at FROM drawing_trash').get().trashed_at,first-10000);
 await worker.purgeExpiredTrash(s.db,first-10000+worker.TRASH_RETENTION_MS-1);assert.equal(s.sql.prepare('SELECT count(*) AS n FROM drawings').get().n,1);
 await s.action('restore');assert.equal(s.sql.prepare('SELECT count(*) AS n FROM drawing_trash').get().n,0);
 await worker.purgeExpiredTrash(s.db,first+worker.TRASH_RETENTION_MS+10000);assert.equal(s.sql.prepare('SELECT count(*) AS n FROM drawings').get().n,1);
 await s.action('trash');assert.ok(s.sql.prepare('SELECT trashed_at FROM drawing_trash').get().trashed_at>=first);s.sql.close();
});
test('expired Trash purges messages, mail jobs and capacity; active inbox is protected',async()=>{
 const s=setup();await s.action('trash');const time=s.sql.prepare('SELECT trashed_at FROM drawing_trash').get().trashed_at;
 s.sql.prepare('INSERT INTO drawing_messages VALUES(?,?)').run(s.id,'private');s.sql.prepare('INSERT INTO drawing_mail(drawing_id) VALUES(?)').run(s.id);
 await worker.purgeExpiredTrash(s.db,time+worker.TRASH_RETENTION_MS);assert.equal(s.sql.prepare('SELECT count(*) AS n FROM drawings').get().n,0);
 for(const table of ['drawing_messages','drawing_mail','drawing_trash'])assert.equal(s.sql.prepare('SELECT count(*) AS n FROM '+table).get().n,0);
 assert.deepEqual({...s.sql.prepare('SELECT records,bytes FROM drawing_capacity').get()},{records:0,bytes:0});s.sql.close();
});
test('permanent delete authenticates and accepts only drawings still in Trash',async()=>{
 const s=setup();assert.equal((await s.action('delete','wrong')).status,401);assert.equal((await s.action('delete')).status,409);
 await s.action('trash');await s.action('restore');assert.equal((await s.action('delete')).status,409);
 await s.action('trash');assert.equal((await s.action('delete')).status,200);assert.equal((await s.action('delete')).status,409);s.sql.close();
});
test('legacy Trash receives a fresh timer at migration instead of expiring from creation date',async()=>{
 const s=setup(true);s.sql.prepare('UPDATE drawings SET approved=-1').run();
 await worker.ensureStorage(s.db);assert.ok(Math.abs(s.sql.prepare('SELECT trashed_at FROM drawing_trash').get().trashed_at-Date.now())<2000);s.sql.close();
});
