import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('widget.html','utf8');
function setup(){
 const messages=[],listeners={};
 const field={style:{},disabled:false,focus(){},getBoundingClientRect(){return{height:Number.parseFloat(this.style.height)||64}}};
 const handle={setPointerCapture(){}};
 const window={innerHeight:426,parent:{postMessage(message){messages.push(message)}},addEventListener(type,fn){listeners[type]=fn}};
 const document={body:{getBoundingClientRect(){return{height:362+field.getBoundingClientRect().height}}}};
 vm.runInNewContext(html.slice(html.indexOf('let messageResize=null;'),html.indexOf('new window.ResizeObserver')),{$:id=>id==='message'?field:handle,window,document});
 return{field,handle,window,messages,listeners};
}
test('fast drag waits for host space before painting; release removes reserved space',()=>{
 const s=setup();s.handle.onpointerdown({button:0,clientY:420,pointerId:1,preventDefault(){}});
 s.handle.onpointermove({clientY:1000});assert.equal(s.field.style.height,undefined);
 assert.equal(s.messages.at(-1).height,1200);
 s.window.innerHeight=1200;s.listeners.resize();assert.equal(s.field.style.height,'600px');
 s.handle.onpointerup();assert.equal(s.messages.at(-1).height,962);
});
test('pointer release before delayed host resize still applies final height safely',()=>{
 const s=setup();s.handle.onpointerdown({button:0,clientY:420,pointerId:1,preventDefault(){}});
 s.handle.onpointermove({clientY:620});s.handle.onpointerup();assert.equal(s.field.style.height,undefined);
 s.window.innerHeight=1200;s.listeners.resize();assert.equal(s.field.style.height,'264px');assert.equal(s.messages.at(-1).height,626);
 s.handle.onkeydown({key:'Home',preventDefault(){}});assert.equal(s.field.style.height,'64px');assert.equal(s.messages.at(-1).height,426);
});
