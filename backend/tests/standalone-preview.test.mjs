import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Window} from 'happy-dom';

const html = fs.readFileSync(new URL('../../examples/preview.html', import.meta.url), 'utf8');
function parse() {
  const window = new Window();
  const document = new window.DOMParser().parseFromString(html, 'text/html');
  return {window, document, frame:document.querySelector('iframe')};
}

test('the downloaded example includes its entire widget and no surrounding card or copy', async () => {
  const {window,document,frame} = parse();
  assert.ok(frame.srcdoc.includes('id="pad"'));
  assert.equal(frame.hasAttribute('src'),false);
  assert.equal(document.querySelector('h1,p,section'),null);
  const child = new window.DOMParser().parseFromString(frame.srcdoc,'text/html');
  assert.equal(child.querySelector('[src],link[rel="stylesheet"]'),null);
  assert.match(child.querySelector('meta[http-equiv="Content-Security-Policy"]').content,/connect-src 'none'/);
  await window.happyDOM.close();
});

test('the example keeps production drafts separate and cannot submit a drawing', async () => {
  const {window:parser,frame} = parse();
  const w = new Window({url:'http://127.0.0.1:4329/preview.html'});
  const child = frame.srcdoc;
  w.document.write(child.replace(/<script>[\s\S]*?<\/script>/,''));
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},clearRect(){}});
  let requests=0;
  const original='{"strokes":[],"message":"Production draft"}';
  w.localStorage.setItem('canvasstudio-drawing-draft-v1',original);
  const script=child.match(/<script>([\s\S]*?)<\/script>/)[1].replace("if(window.top===window.self){document.body.replaceChildren();return}",'');
  vm.runInNewContext(script,{window:w,document:w.document,localStorage:w.localStorage,setTimeout,clearTimeout,fetch(){requests++;throw Error('Preview must not submit')}});
  const send=w.document.getElementById('send');
  assert.equal(send.disabled,true);
  assert.equal(send.onclick,null);
  send.click();
  w.document.getElementById('message').value='Example draft';
  w.document.getElementById('message').oninput();
  assert.equal(requests,0);
  assert.equal(w.localStorage.getItem('canvasstudio-drawing-draft-v1'),original);
  assert.equal(JSON.parse(w.localStorage.getItem('drawbox-example-draft-v1')).message,'Example draft');
  await w.happyDOM.close();await parser.happyDOM.close();
});

test('example resizing accepts only its own frame and bounded heights', async () => {
  const {window:w} = parse();
  w.document.write(html.replace(/<script>[\s\S]*?<\/script>/,''));
  const frame=w.document.querySelector('iframe');
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],{window:w,document:w.document,innerWidth:900});
  const send=(height,source)=>w.dispatchEvent(new w.MessageEvent('message',{source,data:{type:'canvasstudio-drawbox-size',height}}));
  send(700,{});assert.equal(frame.style.height,'');
  send(700,frame.contentWindow);assert.equal(frame.style.height,'700px');
  for(const height of [0,1201,NaN,Infinity,'500'])send(height,frame.contentWindow);
  assert.equal(frame.style.height,'700px');
  await w.happyDOM.close();
});
