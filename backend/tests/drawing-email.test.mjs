import test from 'node:test';import assert from 'node:assert/strict';import {inflateSync} from 'node:zlib';import {drawingPNG,drawingEmail} from '../drawing-email.mjs';
test('mail contains only drawing image and escaped optional message, with fixed subject/recipient',()=>{
 const s=[{tool:'fill',color:'#ce4848',size:1,points:[[0,0]]}];const png=Buffer.from(drawingPNG(s));assert.equal(png.subarray(1,4).toString(),'PNG');let at=8,idat=[];
 while(at<png.length){const n=png.readUInt32BE(at),type=png.subarray(at+4,at+8).toString();if(type==='IDAT')idat.push(png.subarray(at+8,at+8+n));at+=n+12}
 const raw=inflateSync(Buffer.concat(idat));assert.equal(raw.length,250250);assert.deepEqual([...raw.subarray(1,5)],[206,72,72,255]);assert.deepEqual([...raw.subarray(-4)],[206,72,72,255]);
 const mail=drawingEmail(s,'<script>hi</script>\nhello');assert.equal(mail.subject,'drawing');assert.deepEqual(mail.to,['owner@example.invalid']);assert.ok(mail.html.includes('&lt;script&gt;'));assert.ok(!mail.html.includes('<script>'));assert.equal(mail.attachments[0].filename,'drawing.png');assert.deepEqual(Buffer.from(mail.attachments[0].content,'base64'),png);assert.ok(!drawingEmail(s).html.includes('<p'));
});
test('server PNG rejects expensive strokes before replay',()=>{assert.throws(()=>drawingPNG([{color:'#000000',size:40,points:Array.from({length:1000},(_,i)=>[i%2,i%2])}]),/complex/)});
