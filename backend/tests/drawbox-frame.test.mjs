import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {installDrawboxResizing} from '../embed-frame.mjs';

test('warning expands its own trusted frame and shrinks after clearing',async()=>{
 const w=new Window({url:'https://example.invalid/'});
 w.document.body.innerHTML='<aside class="main-drawbox"><iframe src="https://drawbox.example.invalid/" height="510"></iframe></aside><iframe id="other" src="https://example.com/"></iframe>';
 const frame=w.document.querySelector('.main-drawbox iframe'),source=frame.contentWindow;
 installDrawboxResizing(w);installDrawboxResizing(w);
 const send=(height,origin='https://drawbox.example.invalid',sender=source)=>w.dispatchEvent(new w.MessageEvent('message',{origin,source:sender,data:{type:'canvasstudio-drawbox-size',height}}));
 send(539.2);assert.equal(frame.style.height,'540px');assert.equal(frame.height,'540');
 send(486);assert.equal(frame.style.height,'486px');
 send(900,'https://example.com');assert.equal(frame.style.height,'486px');
 send(900,undefined,w.document.getElementById('other').contentWindow);assert.equal(frame.style.height,'486px');
 for(const height of [NaN,Infinity,'550',0,5000]){send(height);assert.equal(frame.style.height,'486px')}
 await w.happyDOM.close();
});

test('popup room follows available viewport without changing unrelated frames',async()=>{
 const w=new Window({url:'https://example.invalid/',width:1200});
 w.document.body.innerHTML='<aside class="main-drawbox"><iframe src="https://drawbox.example.invalid/"></iframe></aside>';
 const frame=w.document.querySelector('iframe');let left=100;frame.getBoundingClientRect=()=>({left});
 installDrawboxResizing(w);assert.equal(frame.style.width,'700px');left=800;w.dispatchEvent(new w.Event('resize'));assert.equal(frame.style.width,'384px');
 left=1300;w.dispatchEvent(new w.Event('resize'));assert.equal(frame.style.width,'0px');await w.happyDOM.close();
});
