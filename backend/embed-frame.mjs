// Only the known widget may resize its own iframe.
export function installDrawboxResizing(target) {
  if (target.__canvasstudioDrawboxSizing) return;
  target.__canvasstudioDrawboxSizing = true;
  const origin = 'https://drawbox.example.invalid';
  const frames = () => [...target.document.querySelectorAll('.main-drawbox iframe, iframe.main-drawbox-editor')];
  const trusted = frame => {
    try { return new target.URL(frame.src, target.location.href).origin === origin; }
    catch { return false; }
  };
  target.addEventListener('message', event => {
    if (event.origin !== origin || event.data?.type !== 'canvasstudio-drawbox-size') return;
    const height = event.data.height;
    if (!Number.isFinite(height) || height < 100 || height > 1200) return;
    const frame = frames().find(item => trusted(item) && item.contentWindow === event.source);
    if (!frame) return;
    frame.style.height = Math.ceil(height) + 'px';
    frame.height = String(Math.ceil(height));
  });
  const measure = frame => {
    if (!trusted(frame)) return;
    // Reserve popup space without widening the canvas or the text column.
    const left = Math.max(0, frame.getBoundingClientRect().left);
    frame.style.width = Math.max(0, Math.min(700, target.innerWidth - left - 16)) + 'px';
    frame.style.maxWidth = 'none';
    frame.contentWindow?.postMessage({type:'canvasstudio-drawbox-measure'}, origin);
  };
  target.addEventListener('resize', () => frames().forEach(measure));
  frames().forEach(measure);
  target.document.addEventListener('load', event => {
    if (event.target?.matches?.('.main-drawbox iframe, iframe.main-drawbox-editor')) measure(event.target);
  }, true);
}
