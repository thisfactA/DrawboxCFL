import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {emailMigrations,drainEmail} from '../email-outbox.mjs';
import {worker} from './worker-module.mjs';
const stroke={color:'#000000',size:3,points:[[.1,.1],[.2,.2]]};
function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync('schema.sql','utf8'));for(const sql of emailMigrations)sqlite.exec(sql);
 const statement=(sql,args=[])=>({sql,args,bind(...args){return statement(sql,args)},async run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}},async all(){return{results:sqlite.prepare(sql).all(...args)}},async first(){return sqlite.prepare(sql).get(...args)}});
 const db={prepare:statement,async batch(items){sqlite.exec('BEGIN');try{const result=items.map(s=>{if(/RETURNING/.test(s.sql))return{results:sqlite.prepare(s.sql).all(...s.args)};return{meta:{changes:Number(sqlite.prepare(s.sql).run(...s.args).changes)}}});sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 function add(id='a'){sqlite.prepare('INSERT INTO drawings VALUES(?,?,?,?,?,?)').run(id,1,'',JSON.stringify([stroke]),0,'visitor');sqlite.prepare('INSERT INTO drawing_messages VALUES(?,?)').run(id,'hello <img>');sqlite.prepare('INSERT INTO drawing_mail(drawing_id) VALUES(?)').run(id)}
 return{sqlite,db,add,env:{DB:db,RESEND_API_KEY:'test-key',MAIL_TO:'owner@example.invalid',INBOX_TOKEN:'test-inbox'}};
}
test('delivery is fixed-recipient, idempotent, and safe under concurrent drains',async()=>{
 const s=setup();s.add();let calls=0;
 const send=async(url,options)=>{calls++;const mail=JSON.parse(options.body);assert.equal(url,'https://api.resend.com/emails');assert.deepEqual(mail.to,['owner@example.invalid']);assert.equal(mail.subject,'drawing');assert.equal(options.headers['Idempotency-Key'],'drawing/a');assert.match(mail.html,/&lt;img&gt;/);return Response.json({id:'delivery-id'})};
 await Promise.all([drainEmail(s.env,send,100000000),drainEmail(s.env,send,100000000)]);
 assert.equal(calls,1);assert.equal(s.sqlite.prepare('SELECT state FROM drawing_mail').get().state,'sent');
 await drainEmail(s.env,send,100300000);assert.equal(calls,1);s.sqlite.close();
});
test('network failures retry same key; confirmed rejection and expired retries need review',async()=>{
 const s=setup();s.add();let calls=0;const fail=async()=>{calls++;throw Error('offline')};
 await drainEmail(s.env,fail,100000000);assert.equal(s.sqlite.prepare('SELECT state FROM drawing_mail').get().state,'pending');
 await drainEmail(s.env,async()=>new Response('',{status:403}),100300000);assert.equal(s.sqlite.prepare('SELECT state FROM drawing_mail').get().state,'review');
 s.add('b');await drainEmail(s.env,fail,100400000);await drainEmail(s.env,fail,100400000+24*3600000);assert.equal(calls,2);assert.equal(s.sqlite.prepare("SELECT state FROM drawing_mail WHERE drawing_id='b'").get().state,'review');s.sqlite.close();
});
test('90 attempts per UTC day defer excess jobs without losing drawings',async()=>{
 const s=setup();s.add();const now=100000000,day=new Date(now).toISOString().slice(0,10);for(let i=0;i<90;i++)s.sqlite.prepare('INSERT INTO drawing_mail_attempts VALUES(?,?)').run(String(i),day);
 let calls=0;const send=async()=>{calls++;return Response.json({id:'ok'})};await drainEmail(s.env,send,now);assert.equal(calls,0);assert.equal(s.sqlite.prepare('SELECT attempts FROM drawing_mail').get().attempts,0);
 await drainEmail(s.env,send,now+86400000);assert.equal(calls,1);s.sqlite.close();
});
test('submission atomically saves drawing, message and mail job; rejected submissions leave no orphans',async()=>{
 const s=setup(),pending=[];const submit=()=>worker.default.fetch(new Request('https://example.test/api/drawings',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({strokes:[stroke],message:'hello'})}),s.env,{waitUntil(p){pending.push(p)}});
 // Disable actual delivery in this test while retaining queue insertion.
 const originalFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({id:'mock'});
 try{assert.equal((await submit()).status,201);await Promise.all(pending);assert.equal((await submit()).status,429);assert.equal(s.sqlite.prepare('SELECT count(*) AS n FROM drawing_messages').get().n,1);assert.equal(s.sqlite.prepare('SELECT count(*) AS n FROM drawing_mail').get().n,1);s.sqlite.exec('DELETE FROM drawings');assert.equal(s.sqlite.prepare('SELECT count(*) AS n FROM drawing_mail').get().n,0);assert.equal(s.sqlite.prepare('SELECT count(*) AS n FROM drawing_messages').get().n,0)}finally{globalThis.fetch=originalFetch;s.sqlite.close()}
});
