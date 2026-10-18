// Server-side PNG encoding. No visitor HTML, remote image URLs, or external raster service.
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
const u32=n=>Uint8Array.of(n>>>24,n>>>16,n>>>8,n);
function join(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length}return out}
function chunk(type,data){const name=new TextEncoder().encode(type),body=join([name,data]);let crc=0xffffffff;for(const n of body)crc=crcTable[(crc^n)&255]^(crc>>>8);return join([u32(data.length),body,u32((crc^0xffffffff)>>>0)])}
function zlibStore(data){const parts=[Uint8Array.of(0x78,0x01)];let a=1,b=0;for(const n of data){a=(a+n)%65521;b=(b+a)%65521}for(let at=0;at<data.length;at+=65535){const block=data.subarray(at,at+65535),n=block.length;parts.push(Uint8Array.of(at+n===data.length?1:0,n&255,n>>>8,(~n)&255,((~n)>>>8)&255),block)}parts.push(u32((b*65536+a)>>>0));return join(parts)}
export function drawingPNG(strokes){
 if(!Array.isArray(strokes)||!strokes.length||strokes.length>300)throw Error('Invalid drawing');
 let total=0,work=0;for(const s of strokes){
  if(!s||!/^#[0-9a-f]{6}$/i.test(s.color)||!Number.isFinite(s.size)||s.size<1||s.size>40||!Array.isArray(s.points)||!s.points.length||s.points.length>2000||s.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||n<0||n>1))||(s.tool!==undefined&&s.tool!=='fill'))throw Error('Invalid drawing');
  total+=s.points.length;if(total>20000)throw Error('Invalid drawing');
  if(s.tool==='fill'){if(s.points.length!==1)throw Error('Invalid fill');work+=62500}else{let steps=1;for(let i=1;i<s.points.length;i++)steps+=Math.max(Math.abs(Math.round(s.points[i][0]*250)-Math.round(s.points[i-1][0]*250)),Math.abs(Math.round(s.points[i][1]*250)-Math.round(s.points[i-1][1]*250)))+1;work+=steps*Math.round(s.size)**2}if(work>8000000)throw Error('Drawing too complex');
 }
 const pixels=new Uint32Array(62500);pixels.fill(0xffffffff);const position=p=>[Math.min(249,Math.round(p[0]*250)),Math.min(249,Math.round(p[1]*250))];
 for(const s of strokes){const color=(parseInt(s.color.slice(1),16)*256+255)>>>0,n=Math.round(s.size),mid=n/2-.5,r=n/2;
  const paint=(x,y)=>{for(let dy=0;dy<n;dy++)for(let dx=0;dx<n;dx++){const xx=x-Math.floor(n/2)+dx,yy=y-Math.floor(n/2)+dy;if(xx>=0&&xx<250&&yy>=0&&yy<250&&(dx-mid)**2+(dy-mid)**2<=r*r+.1)pixels[yy*250+xx]=color}};
  if(s.tool==='fill'){const [x,y]=position(s.points[0]),start=y*250+x,target=pixels[start];if(target===color)continue;const queue=new Int32Array(62500);let head=0,tail=0;const add=i=>{if(pixels[i]!==target)return;pixels[i]=color;queue[tail++]=i};add(start);while(head<tail){const i=queue[head++];if(i%250>0)add(i-1);if(i%250<249)add(i+1);if(i>=250)add(i-250);if(i<62250)add(i+250)}continue}
  let [x,y]=position(s.points[0]);paint(x,y);for(const p of s.points.slice(1)){const [tx,ty]=position(p),dx=Math.abs(tx-x),sx=x<tx?1:-1,dy=-Math.abs(ty-y),sy=y<ty?1:-1;let err=dx+dy;while(true){paint(x,y);if(x===tx&&y===ty)break;const e=2*err;if(e>=dy){err+=dy;x+=sx}if(e<=dx){err+=dx;y+=sy}}}
 }
 const raw=new Uint8Array(250*(250*4+1));for(let y=0;y<250;y++)for(let x=0;x<250;x++){const c=pixels[y*250+x],at=y*1001+1+x*4;raw.set([c>>>24,(c>>>16)&255,(c>>>8)&255,c&255],at)}
 return join([Uint8Array.of(137,80,78,71,13,10,26,10),chunk('IHDR',join([u32(250),u32(250),Uint8Array.of(8,6,0,0,0)])),chunk('IDAT',zlibStore(raw)),chunk('IEND',new Uint8Array())]);
}
export function drawingEmail(strokes,message='',recipient='owner@example.invalid'){
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))throw Error('Invalid recipient');
 if(typeof message!=='string'||message.length>1000)throw Error('Invalid message');
 const bytes=drawingPNG(strokes);let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
 const escaped=message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return {to:[recipient],subject:'drawing',html:'<img src="cid:drawing" width="250" height="250" alt="">'+(message?'<p style="white-space:pre-wrap">'+escaped+'</p>':''),attachments:[{filename:'drawing.png',content:btoa(binary),content_id:'drawing'}]};
}
