import fs from 'node:fs/promises';
import path from 'node:path';

// Generate a self-contained example without changing the deployed widget.
export async function buildPreview() {
  const root = path.resolve(import.meta.dirname, '..');
  const read = name => fs.readFile(path.join(root, name), 'utf8');
  const [template, css, source] = await Promise.all(
    ['drawbox.html', 'drawbox.css', 'drawbox.js'].map(read),
  );
  const script = source.replace('canvasstudio-drawing-draft-v1', 'drawbox-example-draft-v1');
  const previewOnly = `
const previewSend = document.getElementById('send');
previewSend.disabled = true;
previewSend.title = 'Preview only. Sending is disabled.';
previewSend.setAttribute('aria-label', 'Send (preview only)');
previewSend.onclick = null;
`;
  const child = template
    .replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; base-uri \'none\'; form-action \'none\'">')
    .replace('<link rel="stylesheet" href="drawbox.css">', () => `<style>${css}</style>`)
    .replace('<script src="drawbox.js"></script>', () => `<script>${script}\n${previewOnly}</script>`);
  const attribute = child.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DrawBoxCFL preview</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: #fff; }
  main { width: 480px; max-width: 100%; margin: 0 auto; }
  iframe { display: block; width: 100%; height: 510px; border: 0; }
</style>
<main><iframe title="DrawBoxCFL preview" srcdoc="${attribute}"></iframe></main>
<script>
(() => {
  const frame = document.querySelector('iframe');
  // This example has one inline frame. File URLs have an opaque origin, so
  // trust the frame window itself rather than relaxing production origin checks.
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || event.data?.type !== 'canvasstudio-drawbox-size') return;
    const height = event.data.height;
    if (Number.isFinite(height) && height >= 100 && height <= 1200) frame.style.height = Math.ceil(height) + 'px';
  });
  const measure = () => {
    frame.style.width = Math.max(0, Math.min(700, innerWidth - frame.getBoundingClientRect().left - 16)) + 'px';
    frame.contentWindow?.postMessage({type:'canvasstudio-drawbox-measure'}, '*');
  };
  frame.addEventListener('load', measure);
  window.addEventListener('resize', measure);
  measure();
})();
</script>
</html>
`;
  await fs.writeFile(path.join(root, 'examples/preview.html'), html);
}
