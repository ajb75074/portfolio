const intro = document.querySelector('.air-intro');
const stage = intro.querySelector('.air-stage');
const ticket = intro.querySelector('.air-ticket');
const controls = intro.querySelector('.air-controls');
const open = intro.querySelector('[data-open]');
const skip = intro.querySelector('[data-skip]');
const label = intro.querySelector('.air-label');
const status = intro.querySelector('[role=status]');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const key = 'avanie-air-intro-v1';
let scene, generation = 0;
function completed() { try { return localStorage.getItem(key) === 'done'; } catch { return false; } }
function finish(focus = true) {
  generation++;
  scene?.dispose(); scene = null;
  stage.replaceChildren(); stage.hidden = true;
  controls.hidden = skip.hidden = label.hidden = true;
  ticket.hidden = false; intro.dataset.state = 'complete';
  document.body.classList.remove('air-boarding');
  document.documentElement.classList.remove('air-boarding');
  try { localStorage.setItem(key, 'done'); } catch { /* Private browsing still works. */ }
  if (focus) ticket.querySelector('.air-ticket-replay')?.focus({ preventScroll: true });
  window.ScrollTrigger?.refresh();
}
async function start() {
  if (motion.matches) { finish(false); return; }
  const run = ++generation;
  document.body.classList.add('air-boarding');
  document.documentElement.classList.add('air-boarding');
  ticket.hidden = true; stage.hidden = controls.hidden = skip.hidden = label.hidden = false;
  intro.dataset.state = 'loading'; open.disabled = true; status.textContent = 'Preparing your window seat…';
  const timeout = setTimeout(() => { if (run === generation) finish(); }, 15000);
  try {
    const { createWindow } = await import('./air-scene.js');
    if (run !== generation) return;
    const loaded = await createWindow(stage, () => open.click());
    if (run !== generation) { loaded.dispose(); return; }
    scene = loaded; intro.dataset.state = 'ready'; open.disabled = false;
    status.textContent = "Curious what's outside?";
  } catch (error) {
    console.warn('Window intro unavailable; showing boarding pass.', error);
    if (run === generation) finish();
  } finally { clearTimeout(timeout); }
}
open.addEventListener('click', async () => {
  if (!scene || intro.dataset.state !== 'ready') return;
  intro.dataset.state = 'opening'; open.disabled = true; status.textContent = 'Enjoy the view.';
  const run = generation;
  try { await scene.open(); if (run === generation) finish(); }
  catch { if (run === generation) finish(); }
});
skip.addEventListener('click', () => finish());
stage.addEventListener('scene-unavailable', () => finish());
intro.querySelector('[data-replay]').addEventListener('click', () => { intro.scrollIntoView({ behavior: 'instant' }); start(); skip.focus({ preventScroll: true }); });
motion.addEventListener('change', () => { if (motion.matches) finish(false); });
// The intro is always the entry point regardless of the URL: an inline
// head script already strips any #hash before the browser can jump to it.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (completed() || motion.matches) finish(false); else start();
