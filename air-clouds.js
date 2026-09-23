// Generates the moonlit cloud-deck textures behind the whole homepage.
// Each texture tiles horizontally (periodic noise), so the CSS strips in
// air-intro.css can drift forever without a seam. Nothing is downloaded:
// the textures are painted once on a canvas, handed to CSS as blob URLs,
// and the canvases are thrown away.
(() => {
  const sky = document.querySelector('.air-sky');
  if (!sky || !document.createElement('canvas').getContext) return;

  // Deterministic PRNG so the sky looks the same on every visit.
  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Value noise on a lattice that wraps every `period` cells in x.
  function makeNoise(seed) {
    const rand = mulberry32(seed);
    const size = 256, table = new Float32Array(size * size);
    for (let i = 0; i < table.length; i++) table[i] = rand();
    const fade = t => t * t * (3 - 2 * t);
    return (x, y, period) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = fade(x - xi), yf = fade(y - yi);
      const x0 = ((xi % period) + period) % period, x1 = (x0 + 1) % period;
      const y0 = yi & 255, y1 = (yi + 1) & 255;
      const a = table[y0 * size + x0], b = table[y0 * size + x1];
      const c = table[y1 * size + x0], d = table[y1 * size + x1];
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
  }

  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;

  // Night: moonlit, cool shadowed undersides and silver tops.
  // Day: sunlit, bright white tops with soft blue-gray shadows.
  const PALETTES = {
    night: { SHADOW: [58, 74, 102], BODY: [118, 138, 168], LIT: [226, 232, 242] },
    day: { SHADOW: [150, 172, 202], BODY: [218, 228, 241], LIT: [255, 255, 255] },
  };

  function paint({ width, height, seed, cells, stretch, octaves, cover, soft, fadeTop, fadeBottom }, mode) {
    const { SHADOW, BODY, LIT } = PALETTES[mode];
    const noise = makeNoise(seed);
    const density = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0, amp = .55, norm = 0;
        for (let o = 0; o < octaves; o++) {
          const f = cells * (1 << o);
          // Clouds seen at a grazing angle look squashed vertically.
          sum += amp * noise(x / width * f, y / width * f * stretch + o * 17.3, f);
          norm += amp; amp *= .5;
        }
        density[y * width + x] = sum / norm;
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    const data = image.data, lift = Math.max(2, Math.round(height * .025));
    for (let y = 0; y < height; y++) {
      const v = y / (height - 1);
      const mask = smooth(0, fadeTop, v) * (1 - smooth(1 - fadeBottom, 1, v));
      for (let x = 0; x < width; x++) {
        const d = density[y * width + x];
        const alpha = smooth(cover, cover + soft, d) * mask;
        // Light comes from above: a cell brighter than the one above it is a lit top.
        const above = density[Math.max(0, y - lift) * width + x];
        const light = Math.min(1, Math.max(0, .5 + (d - above) * 7));
        const thick = smooth(cover, cover + .35, d);
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const base = mix(SHADOW[c], BODY[c], thick);
          data[i + c] = mix(base, LIT[c], light * light * .9);
        }
        data[i + 3] = alpha * 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob && URL.createObjectURL(blob)), 'image/png'));
  }

  const layers = [
    { name: '--cloud-far', layer: 'far', width: 1024, height: 128, seed: 11, cells: 14, stretch: 2.6, octaves: 5, cover: .42, soft: .22, fadeTop: .35, fadeBottom: .3 },
    { name: '--cloud-mid', layer: 'mid', width: 1024, height: 224, seed: 29, cells: 8, stretch: 1.7, octaves: 5, cover: .44, soft: .2, fadeTop: .3, fadeBottom: .3 },
    { name: '--cloud-near', layer: 'near', width: 1024, height: 288, seed: 47, cells: 4, stretch: 1.3, octaves: 5, cover: .4, soft: .18, fadeTop: .25, fadeBottom: 0 },
  ];
  const idle = window.requestIdleCallback ? fn => requestIdleCallback(fn, { timeout: 300 }) : fn => setTimeout(fn, 1);
  const cache = { day: {}, night: {} };
  let run = 0;
  // Paint one layer per idle slot so first paint and the window intro stay
  // smooth. Each mode's textures are painted once, then reused from the cache.
  function applyClouds(mode) {
    const current = ++run;
    (function next(i) {
      if (current !== run) return;
      if (i >= layers.length) { sky.dataset.clouds = 'ready'; return; }
      const layer = layers[i];
      const show = url => {
        if (current !== run || !url) return;
        sky.style.setProperty(layer.name, `url("${url}")`);
        sky.querySelector(`[data-layer="${layer.layer}"]`)?.setAttribute('data-ready', '');
      };
      if (cache[mode][layer.name]) { show(cache[mode][layer.name]); next(i + 1); return; }
      idle(async () => {
        try { show(cache[mode][layer.name] = await paint(layer, mode)); }
        catch (error) { console.warn('Cloud layer skipped', error); }
        next(i + 1);
      });
    })(0);
  }

  const root = document.documentElement;
  const skyMode = () => (root.dataset.sky === 'day' ? 'day' : 'night');
  applyClouds(skyMode());
  // Once the visible sky is painted, quietly prepare the other one so the
  // toggle swaps instantly.
  function warm(mode) {
    const todo = layers.filter(layer => !cache[mode][layer.name]);
    (function next(i) {
      if (i >= todo.length) return;
      setTimeout(() => idle(async () => {
        try { cache[mode][todo[i].name] ??= await paint(todo[i], mode); } catch { /* skipped */ }
        next(i + 1);
      }), 400);
    })(0);
  }
  setTimeout(() => warm(skyMode() === 'day' ? 'night' : 'day'), 2500);

  // Header day/night toggle. The choice is remembered for later visits.
  const toggle = document.querySelector('[data-sky-toggle]');
  function label() {
    if (!toggle) return;
    const next = skyMode() === 'day' ? 'night' : 'day';
    toggle.setAttribute('aria-label', `Switch to ${next} sky`);
    toggle.title = `Switch to ${next} sky`;
  }
  function setSky(mode) {
    const apply = () => { root.dataset.sky = mode; label(); applyClouds(mode); };
    try { localStorage.setItem('avanie-air-sky', mode); } catch { /* Private browsing still works. */ }
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (document.startViewTransition && !still) document.startViewTransition(apply); else apply();
  }
  label();
  toggle?.addEventListener('click', () => setSky(skyMode() === 'day' ? 'night' : 'day'));

  // Let the wing sink and dim as the visitor scrolls past the hero.
  const wing = sky.querySelector('.air-wing');
  if (wing) {
    let queued = false;
    const cabin = document.querySelector('[data-cabin]');
    const deckLayers = [...sky.querySelectorAll('.air-deck-layer')];
    const depth = { far: .012, mid: .03, near: .06 };
    const update = () => {
      queued = false;
      // The flight starts where the boarding section ends (or at the top in Fast track).
      const start = cabin && root.dataset.fast !== 'on' ? cabin.offsetTop + cabin.offsetHeight - innerHeight : 0;
      const flown = Math.max(0, scrollY - start);
      const sink = Math.min(1, flown / (innerHeight * .9));
      wing.style.setProperty('--wing-sink', sink.toFixed(3));
      // Scroll parallax: nearer cloud layers slide up faster than distant ones.
      for (const layer of deckLayers) {
        const k = depth[layer.dataset.layer] || 0;
        layer.style.transform = `translate3d(0, ${(-Math.min(flown, 4000) * k).toFixed(1)}px, 0)`;
      }
    };
    document.addEventListener('avanie:fast', update);
    addEventListener('resize', update);
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
})();
