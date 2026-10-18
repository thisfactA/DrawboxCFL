import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {worker as w} from './worker-module.mjs';
const stroke={color:'#000000',size:3,points:[[0,0],[.5,.5]]};
test('normal strokes and fills remain valid; pathological replay is rejected',()=>{
 assert.equal(w.validateDrawing({strokes:[stroke]}).strokes.length,1);
 assert.equal(w.validateDrawing({strokes:[{...stroke,size:30,points:[[.1,.1],[.11,.12]]}]}).strokes.length,1);
 const points=Array.from({length:1000},(_,i)=>[i%2,i%2]);
 assert.throws(()=>w.validateDrawing({strokes:[{...stroke,size:40,points}]}),/complex/);
 assert.throws(()=>w.validateDrawing({strokes:Array.from({length:129},()=>({...stroke,tool:'fill',points:[[0,0]]}))}),/complex/);
 assert.equal(w.MAX_DRAWINGS,5000);assert.equal(w.MAX_STORAGE_BYTES,200000000);
});
test('opaque origins receive no inbox CORS grant; authenticated clients and same-origin proxy still authenticate',async()=>{
 const env={INBOX_TOKEN:'test',DB:{async batch(){},prepare(){return{bind(){return{all:async()=>({results:[]})}}}}}};
 for(const origin of ['null','https://evil.example','http://127.0.0.1:4318','http://127.0.0.1:4319']){
  const url=new URL('https://example.test/api/inbox');const r=await w.inbox(new Request(url,{headers:{Origin:origin,Authorization:'Bearer test'}}),env,url);
  assert.equal(r.status,200);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin.endsWith(':4319')?origin:null);
 }
});
test('storage migration is once per binding, retries failure, uses atomic batch',async()=>{
 let calls=0;const db={prepare(sql){return sql},async batch(statements){calls++;assert.ok(statements.some(x=>x.includes('AFTER INSERT')));if(calls===1)throw Error('transient')}};
 await assert.rejects(w.ensureStorage(db));await Promise.all([w.ensureStorage(db),w.ensureStorage(db)]);assert.equal(calls,2);
});
test('submission uses HMAC, indexed quota predicates, atomic capacity guard, and distinguishes full inbox',async()=>{
 let bound;const env={INBOX_TOKEN:'test',DB:{async batch(){return [{meta:{changes:0}},{meta:{changes:0}}]},prepare(sql){return{bind(...args){if(sql.startsWith('INSERT INTO drawings'))bound={sql,args};return{run:async()=>({meta:{changes:0}})}},first:async()=>({records:5000,bytes:1})}}}};
 const req=new Request('https://example.test/api/drawings',{method:'POST',headers:{Origin:'https://example.test','Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({strokes:[stroke]})});
 const response=await w.default.fetch(req,env);assert.equal(response.status,409);
 assert.match(bound.sql,/EXISTS\(SELECT 1 FROM drawing_capacity/);assert.match(bound.sql,/visitor IN \(\?,\?\)/);
 const rawHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(new Date().toISOString().slice(0,10)+':192.0.2.1'))).toString('hex');
 assert.notEqual(bound.args[4],rawHash);assert.equal(bound.args[4].length,64);
});


test('optional messages are bounded plain text and normalized without affecting strokes',()=>{
 const drawing=w.validateDrawing({strokes:[stroke],message:'  hello\r\n<test>  '});assert.equal(drawing.message,'hello\n<test>');assert.equal(w.validateDrawing({strokes:[stroke]}).message,'');
 for(const message of [null,{},'x'.repeat(1001),'bad\u0000text'])assert.throws(()=>w.validateDrawing({strokes:[stroke],message}));
});
