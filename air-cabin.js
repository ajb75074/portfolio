// Avanie Air boarding: one scroll-driven story inside #home.
//
//   door    boarding pass in the doorway
//   walk    down the aisle (drawn on a <canvas> with a tiny perspective
//           renderer: no DOM 3D, so no seams, gaps or sorting glitches).
//           Cabin announcements introduce Avanie along the way.
//   sit     turn left into 01A
//   seat    the seat is the site menu. Items open their content in a panel
//           over the seat, so nothing navigates away.
//   window  lean in: the Three.js window (air-scene.js) opens and zooms out
//   flight  the page continues over the moving sky
//
// You can scroll in but not back out: once seated, the door and aisle are
// removed from the scroll range (sessionStorage remembers it for this visit).
// Fast track mode (html[data-fast="on"]) skips everything.

const root = document.documentElement;
const section = document.querySelector('[data-cabin]');

// Timeline in viewport-height units of scrolling.
const U = { door: 22, walk: 86, sit: 28, seat: 70, lean: 18, window: 96 };
const T = {};
{ let t = 0; for (const k of Object.keys(U)) { T[k] = t; t += U[k]; } T.end = t; }

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (t, a, b) => clamp((t - a) / (b - a));
const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

// ── Cabin geometry (world units ≈ CSS px; x right, y down, -z forward) ─────
const W = 520, AISLE = 92, FLOOR = 250, CEIL = -360, BIN_Y = -150, BIN_X = 330;
// A 2+2 cabin of four rows: fewer, larger, more deliberate seats.
const ROWS = 4, PITCH = 360, REAR = 420;
const rowZ = k => -170 - (ROWS - k) * PITCH;           // back face of row k
const BLOCK_IN = AISLE + 16, BLOCK_OUT = W - 34;         // seat pair spans |x| between these
const FRONT = rowZ(1) - 440;                            // bulkhead
const STAND_Z = rowZ(1) + 230;                       // just behind row 01
const SEAT = { x: -(W - 132), y: 96, z: rowZ(1) - 90 };
const NEAR = 6;

const PALETTES = {
  night: {
    ceiling: '#cdc4d3', mood: '#e2d2f0', wall: '#b9aebb', wallLo: '#978ba3', bin: '#cfc5d1', binLo: '#a99eb2',
    floor: '#2d2636', aisle: '#463b56', aisleLine: '#b99ad0', seat: '#2c3552', seatHi: '#46527c', seatSide: '#232b44',
    headrest: '#cbbbdb', bulk: '#c2b8c6', bulkLo: '#a79cae', fog: '#3a3148', glassTop: '#1b2b47', glassBot: '#7f98b6',
    brand: '#5b4636', sign: '#ffd38a',
  },
  day: {
    ceiling: '#fbf7ef', mood: '#fff4dc', wall: '#f1e9da', wallLo: '#dccfb9', bin: '#f7f1e5', binLo: '#e3d7c3',
    floor: '#4a3f55', aisle: '#665777', aisleLine: '#d8c5e9', seat: '#34416b', seatHi: '#57679c', seatSide: '#2a3558',
    headrest: '#efe5f6', bulk: '#efe6d6', bulkLo: '#ddd0bb', fog: '#e8e0d4', glassTop: '#2a6bb3', glassBot: '#cfe2f4',
    brand: '#6e5642', sign: '#ffc766',
  },
};
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb = (c, t, fog) => {
  const a = hex(c), b = hex(fog);
  return `rgb(${a.map((v, i) => Math.round(mix(v, b[i], t))).join(',')})`;
};

// A rounded-top outline in a z-plane, as 3D points.
function seatOutline(x, hw, top, bottom, z, r) {
  const pts = [[x - hw, bottom, z], [x - hw, top + r, z]];
  for (let i = 1; i < 6; i++) { const a = Math.PI + (i / 6) * Math.PI / 2; pts.push([x - hw + r + r * Math.cos(a), top + r + r * Math.sin(a), z]); }
  pts.push([x + hw - r, top, z]);
  for (let i = 1; i < 6; i++) { const a = -Math.PI / 2 + (i / 6) * Math.PI / 2; pts.push([x + hw - r + r * Math.cos(a), top + r + r * Math.sin(a), z]); }
  pts.push([x + hw, top + r, z], [x + hw, bottom, z]);
  return pts;
}

function cameraAt(t) {
  const walk = smooth(range(t, T.walk - 6, T.sit));
  let x = 0, y = 0, z = mix(REAR - 70, STAND_Z, walk), yaw = 0;
  y += Math.sin(walk * 30) * 3 * Math.sin(Math.PI * walk);   // gentle step bob
  // Settle toward 01A: ease forward, left and down while the seat view fades in.
  const sit = smooth(range(t, T.sit, T.seat));
  if (sit > 0) {
    x = mix(0, -150, sit); y = mix(y, 46, sit); z = mix(STAND_Z, rowZ(1) + 90, sit);
  }
  return { x, y, z, yaw: yaw * Math.PI / 180 };
}

// ── Canvas renderer ─────────────────────────────────────────────────────────
function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, F = 800, cam, basis;

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    F = Math.max(w * .62, h * .5);
  }
  const toCam = ([x, y, z]) => {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    return [dx * basis.rx + dz * basis.rz, dy, dx * basis.fx + dz * basis.fz];
  };
  const project = ([x, y, z]) => [w / 2 + x * F / z, h * .46 + y * F / z];
  // Clip a camera-space polygon against the near plane (Sutherland–Hodgman).
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) { const k = (NEAR - a[2]) / (b[2] - a[2]); out.push([mix(a[0], b[0], k), mix(a[1], b[1], k), NEAR]); }
    }
    return out;
  }
  function facing(normal, p) {
    return normal[0] * (cam.x - p[0]) + normal[1] * (cam.y - p[1]) + normal[2] * (cam.z - p[2]) > 0;
  }
  function poly(points, fill, normal) {
    if (normal && !facing(normal, points[0])) return null;
    const c = clipNear(points.map(toCam));
    if (c.length < 3) return null;
    const s = c.map(project);
    ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
    for (let i = 1; i < s.length; i++) ctx.lineTo(s[i][0], s[i][1]);
    ctx.closePath();
    ctx.fillStyle = typeof fill === 'function' ? fill(s) : fill;
    ctx.fill();
    return s;
  }
  const depth = p => toCam(p)[2];
  const fogAt = d => clamp((d - 250) / 2400) * .62;
  const quadX = (x, y0, y1, z0, z1) => [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]];
  const quadY = (y, x0, x1, z0, z1) => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  const quadXYZ = (x0, x1, y0, y1, z) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
  const vGrad = (top, bottom) => s => {
    const ys = s.map(p => p[1]), g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    g.addColorStop(0, top); g.addColorStop(1, bottom); return g;
  };
  function label(p, text, size, color, bg) {
    const c = toCam(p); if (c[2] < 40 || Math.abs(cam.yaw) > .3) return;
    const [sx, sy] = project(c), fs = size * F / c[2];
    if (fs < 3) return;
    ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
    if (bg) {
      const tw = ctx.measureText(text).width + fs * 1.4, th = fs * 2;
      ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(sx - tw / 2, sy - th / 2, tw, th, fs * .4); ctx.fill();
    }
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, sx, sy);
  }

  function draw(camera) {
    cam = camera;
    basis = { rx: Math.cos(cam.yaw), rz: Math.sin(cam.yaw), fx: -Math.sin(cam.yaw), fz: -Math.cos(cam.yaw) };
    const P = PALETTES[root.dataset.sky === 'day' ? 'day' : 'night'];
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = P.ceiling; ctx.fillRect(0, 0, w, h);

    // Shell: every face is one polygon, clipped at the camera. No seams.
    poly(quadY(CEIL, -W, W, REAR, FRONT), P.ceiling);
    poly(quadY(CEIL + .5, -46, 46, REAR, FRONT), P.mood);
    for (const side of [-1, 1]) poly(quadX(side * W, BIN_Y, FLOOR, REAR, FRONT), vGrad(P.wall, P.wallLo));
    // Windows, far to near: a bezel and a pane of sky each.
    const wins = [];
    for (let k = 1; k <= ROWS; k++) for (const side of [-1, 1]) wins.push({ side, z: rowZ(k) - 80, d: depth([side * W, 0, rowZ(k) - 80]) });
    wins.sort((a, b) => b.d - a.d);
    for (const { side, z, d } of wins) {
      if (d < NEAR) continue;
      const t = fogAt(d), x = side * (W - 1);
      const ring = (ry, rz) => Array.from({ length: 28 }, (_, i) => { const a = i / 28 * Math.PI * 2; return [x, -12 + ry * Math.sin(a), z + rz * Math.cos(a)]; });
      poly(ring(64, 48), rgb(P.bin, t, P.fog), [-side, 0, 0]);
      poly(ring(52, 37), vGrad(rgb(P.glassTop, t, P.fog), rgb(P.glassBot, t, P.fog)), [-side, 0, 0]);
    }
    poly(quadY(FLOOR, -W, W, REAR, FRONT), P.floor);
    poly(quadY(FLOOR - .5, -AISLE + 4, AISLE - 4, REAR, FRONT), P.aisle);
    for (const side of [-1, 1]) poly(quadY(FLOOR - 1, side * (AISLE - 4) - 2, side * (AISLE - 4) + 2, REAR, FRONT), P.aisleLine);
    for (const side of [-1, 1]) {
      poly(quadY(BIN_Y, side * W, side * BIN_X, REAR, FRONT), P.binLo);
      poly(quadX(side * BIN_X, CEIL, BIN_Y, REAR, FRONT), vGrad(P.bin, P.binLo));
      poly(quadX(side * BIN_X - side * .5, BIN_Y - 5, BIN_Y, REAR, FRONT), P.mood);
      for (let k = 0; k <= ROWS; k++) {
        const z = rowZ(k + 1) + PITCH / 2 - 60;
        poly(quadX(side * BIN_X - side * .5, CEIL + 20, BIN_Y - 8, z + 1.5, z - 1.5), rgb(P.binLo, .3, '#000000'));
      }
    }
    // Bulkhead: brand and seatbelt sign, no screen.
    const bd = depth([0, 0, FRONT]);
    if (bd > NEAR) {
      poly([[-W, CEIL, FRONT], [W, CEIL, FRONT], [W, FLOOR, FRONT], [-W, FLOOR, FRONT]], vGrad(P.bulk, P.bulkLo), [0, 0, 1]);
      poly([[-W, CEIL, FRONT + .5], [W, CEIL, FRONT + .5], [W, CEIL + 34, FRONT + .5], [-W, CEIL + 34, FRONT + .5]], P.mood, [0, 0, 1]);
      for (const sx of [-BIN_X, BIN_X]) poly(quadXYZ(sx - 1.5, sx + 1.5, CEIL + 34, FLOOR - 1, FRONT + .8), P.bulkLo, [0, 0, 1]);
      label([0, -290, FRONT + 1], 'FASTEN SEATBELT', 10, P.sign, '#1d1a24');
      label([0, -150, FRONT + 1], 'AVANIE AIR', 42, P.brand);
      // Distance haze toward the far end of the cabin.
      const fogA = clamp((bd - 500) / 1600) * .38;
      if (fogA > .01) {
        const vp = project([0, 0, 1]), g = ctx.createRadialGradient(vp[0], vp[1], 0, vp[0], vp[1], w * .36);
        const [r, gg, b] = hex(P.fog); g.addColorStop(0, `rgba(${r},${gg},${b},${fogA})`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }
    // Seats, far to near. Each side of a row is one seat pair: a single
    // silhouette (two rounded backs on a shared base, so no gaps), headrest
    // covers, a quiet seam, an attached aisle armrest and a soft floor shadow.
    const objs = [];
    for (let k = 1; k <= ROWS; k++) for (const side of [-1, 1]) {
      const z = rowZ(k), xc = side * (BLOCK_IN + BLOCK_OUT) / 2;
      objs.push({ k, side, z, d: depth([xc, 160, z - 50]) });
    }
    objs.sort((a, b) => b.d - a.d);
    const TOP = 62, R = 36, PAN = 176;
    for (const o of objs) {
      if (o.d < -260) continue;
      const t = fogAt(Math.max(o.d, 0)), f = c => rgb(c, t, P.fog);
      const x0 = Math.min(o.side * BLOCK_IN, o.side * BLOCK_OUT), x1 = Math.max(o.side * BLOCK_IN, o.side * BLOCK_OUT);
      const xm = (x0 + x1) / 2, xIn = o.side * BLOCK_IN, z = o.z;
      const shade = `rgba(12, 10, 20, ${(.26 * (1 - t)).toFixed(3)})`;
      // Soft shadow pooled on the carpet.
      poly(quadY(FLOOR - .6, x0 - 10, x1 + 10, z + 26, z - 150), shade);
      const backs = (zz, n) => {
        poly(quadXYZ(x0, x1, PAN - 40, FLOOR - 1, zz), f(P.seat), n);                       // shared base
        poly(seatOutline((x0 + xm) / 2, (xm - x0) / 2, TOP, PAN, zz, R), vGrad(f(P.seatHi), f(P.seat)), n);
        poly(seatOutline((xm + x1) / 2, (x1 - xm) / 2, TOP, PAN, zz, R), vGrad(f(P.seatHi), f(P.seat)), n);
        poly(quadXYZ(xm - 1.2, xm + 1.2, TOP + 30, PAN + 10, zz + n[2] * .5), f(P.seatSide), n);    // seam
        for (const cx of [(x0 + xm) / 2, (xm + x1) / 2]) {
          const hw = (xm - x0) / 2;
          poly(seatOutline(cx, hw * .74, TOP + 8, TOP + 48, zz + n[2] * .8, 18), f(P.headrest), n);
          poly(quadXYZ(cx - hw * .7, cx + hw * .7, PAN - 34, PAN + 6, zz + n[2] * .6), rgb(P.seat, Math.min(1, t + .08), '#000000'), n);
        }
      };
      if (o.k === 1) {                                            // row 01 is seen from the front as you sit
        for (const cx of [(x0 + xm) / 2, (xm + x1) / 2]) poly(quadY(PAN, cx - (xm - x0) / 2 + 10, cx + (xm - x0) / 2 - 10, z - 14, z - 124), f(P.seatHi), [0, -1, 0]);
        for (const ax of [x0 + 7, xm, x1 - 7]) poly(quadY(PAN - 26, ax - 8, ax + 8, z - 10, z - 112), f(P.seatSide), [0, -1, 0]);
        backs(z - 10, [0, 0, -1]);
      }
      // Aisle side: seatback edge, side fairing and the armrest, all touching.
      poly(quadX(xIn, TOP + 34, FLOOR - 1, z, z - 22), f(P.seatSide), [-o.side, 0, 0]);
      poly(quadX(xIn, PAN, FLOOR - 1, z - 22, z - 118), rgb(P.seatSide, Math.min(1, t + .1), '#000000'), [-o.side, 0, 0]);
      poly(quadX(xIn + -o.side * .5, PAN - 28, PAN - 10, z - 4, z - 116), f(P.seatHi), [-o.side, 0, 0]);
      backs(z, [0, 0, 1]);
    }
    // Row placards: just the row number and its seat letters, counting down to 01.
    for (let k = 1; k <= ROWS; k++) for (const side of [-1, 1])
      label([side * (W - 110), BIN_Y + 16, rowZ(k) - 80], `${String(k).padStart(2, '0')} ${side < 0 ? 'AB' : 'CD'}`, 10, 'rgba(250, 245, 255, .95)', 'rgba(43, 36, 51, .7)');
  }
  return { resize, draw };
}

// ── Controller ───────────────────────────────────────────────────────────────
if (section) {
  const canvas = section.querySelector('[data-cabin-canvas]');
  const door = section.querySelector('[data-cabin-door]');
  const seat = section.querySelector('[data-cabin-seat]');
  const windowHost = section.querySelector('[data-cabin-window]');
  const cue = section.querySelector('[data-cabin-cue]');
  const notes = [...section.querySelectorAll('[data-cabin-announce] > li')];
  const renderer = createRenderer(canvas);

  let boarded = false;
  try { boarded = sessionStorage.getItem('avanie-air-boarded') === '1'; } catch { /* fine */ }
  let target = 0, current = 0, raf = 0, scene = null, loading = null, lastCue = '', lastDraw = '';
  const fast = () => root.dataset.fast === 'on';
  const vh = () => innerHeight / 100;
  const startUnit = () => (boarded ? T.seat : 0);

  function layout() {
    section.style.height = `${(T.end - startUnit()) * vh() + innerHeight}px`;
    section.classList.toggle('is-boarded', boarded);
    placeHole();
  }
  // Cut the wall's window hole where the glass actually sits (undoing any lean scale).
  const glass = seat.querySelector('.seat-window-glass');
  function placeHole() {
    const scale = 1 + (parseFloat(seat.style.getPropertyValue('--lean')) || 0) * 1.4;
    const s = seat.getBoundingClientRect(), g = glass.getBoundingClientRect();
    if (!g.width) return;
    seat.style.setProperty('--hole-x', `${((g.left + g.width / 2 - s.left) / scale).toFixed(1)}px`);
    seat.style.setProperty('--hole-y', `${((g.top + g.height / 2 - s.top) / scale).toFixed(1)}px`);
    seat.style.setProperty('--hole-rx', `${(g.width / 2 / scale + 10).toFixed(1)}px`);
    seat.style.setProperty('--hole-ry', `${(g.height / 2 / scale + 10).toFixed(1)}px`);
  }
  const timeAt = () => clamp(startUnit() + (scrollY - section.offsetTop) / vh(), startUnit(), T.end);
  function scrollToUnit(u, behavior = 'smooth') {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    scrollTo({ top: section.offsetTop + (u - startUnit()) * vh(), behavior: reduce ? 'instant' : behavior });
  }

  // Once seated, drop the door and aisle from the scroll range: you can
  // scroll in, but not back out. The view does not jump.
  function board() {
    if (boarded) return;
    const y = scrollY;
    boarded = true;
    try { sessionStorage.setItem('avanie-air-boarded', '1'); } catch { /* fine */ }
    layout();
    scrollTo({ top: Math.max(0, y - T.seat * vh()), behavior: 'instant' });
    window.avanieCabinSound?.ding();
  }
  function reboard() {
    closePanel(false);
    boarded = false;
    try { sessionStorage.removeItem('avanie-air-boarded'); } catch { /* fine */ }
    layout();
    scrollTo({ top: section.offsetTop, behavior: 'instant' });
    current = target = timeAt(); render();
  }

  async function ensureWindow() {
    if (scene || loading) return loading;
    loading = import('./air-scene.js')
      .then(({ createWindow }) => createWindow(windowHost, () => scrollToUnit(T.end)))
      .then(created => { scene = created; loading = null; render(); return created; })
      .catch(error => { console.warn('3D window unavailable', error); loading = null; });
    return loading;
  }
  function setCue(text) { if (text !== lastCue) cue.textContent = lastCue = text; }

  function render() {
    if (fast()) return;
    const t = current;
    const seatIn = smooth(range(t, T.seat - 16, T.seat));
    const lean = smooth(range(t, T.lean, T.window));

    // Aisle canvas, drawn only while visible and only when the camera moved.
    // The canvas stays opaque under the fading seat view, then hides so the
    // seat window's glass looks straight onto the real sky.
    canvas.style.opacity = (1 - range(seatIn, .6, 1)).toFixed(3);
    canvas.style.visibility = seatIn >= 1 ? 'hidden' : 'visible';
    if (seatIn < 1) {
      const cam = cameraAt(t);
      const key = `${cam.x.toFixed(1)},${cam.y.toFixed(1)},${cam.z.toFixed(1)},${cam.yaw.toFixed(4)},${root.dataset.sky}`;
      if (key !== lastDraw) { renderer.draw(cam); lastDraw = key; }
    }

    // Door: the pass sits in the doorway, then you step through.
    const out = smooth(range(t, 10, T.walk));
    door.style.setProperty('--out', out.toFixed(3));
    door.style.visibility = out >= 1 ? 'hidden' : 'visible';

    // Cabin announcements, spread along the aisle.
    const span = (T.sit - T.walk + 4) / Math.max(notes.length, 1);
    notes.forEach((note, i) => {
      const a = T.walk - 6 + i * span, b = a + span;
      const v = Math.min(smooth(range(t, a, a + span * .25)), 1 - smooth(range(t, b - span * .25, b)));
      note.style.opacity = v.toFixed(3);
      note.style.transform = `translateY(${((1 - v) * 14).toFixed(1)}px)`;
      note.setAttribute('aria-hidden', v > .5 ? 'false' : 'true');
    });

    // Seat hub, then the lean into the window.
    seat.style.setProperty('--in', seatIn.toFixed(3));
    seat.style.setProperty('--lean', lean.toFixed(3));
    seat.classList.toggle('is-live', seatIn > .6 && lean < .4);
    section.classList.toggle('is-seated', t >= T.seat - 2 && t < T.lean);

    // 3D window: preload during the sit, fade in on the lean, then scrub it.
    if (t > T.sit - 10) ensureWindow();
    const winIn = smooth(range(t, T.lean + 4, T.window)), winOut = range(t, T.end - 3, T.end);
    windowHost.style.opacity = (winIn * (1 - winOut)).toFixed(3);
    windowHost.style.visibility = winIn > 0 && winOut < 1 ? 'visible' : 'hidden';
    scene?.setProgress(range(t, T.window, T.end - 3));
    root.classList.toggle('cabin-window', t > T.lean + 4 && t < T.end - 1);
    section.dataset.state = t >= T.window && t < T.end - 3 ? 'opening' : t >= T.end - 3 ? 'flight' : 'cabin';

    // Every step says what scrolling does next.
    if (t < 10) setCue('Scroll to board');
    else if (t < T.sit) {
      const row = clamp(Math.round((cameraAt(t).z - rowZ(1)) / PITCH) + 1, 1, ROWS);
      setCue(`Row ${String(row).padStart(2, '0')} · keep scrolling to seat 01A`);
    } else if (t < T.lean) setCue('Tap to explore · scroll to look outside');
    else if (t < T.end - 3) setCue(t < T.window ? 'Keep scrolling to open the window' : 'Keep scrolling to fly into the Experience Log');
    else setCue('');
    cue.style.opacity = t < T.end - 3 ? '1' : '0';
  }

  function tick() {
    raf = 0;
    const diff = target - current;
    current = Math.abs(diff) < .02 ? target : current + diff * .3;
    render();
    if (current !== target) raf = requestAnimationFrame(tick);
  }
  function onScroll() {
    if (fast()) return;
    target = timeAt();
    if (!boarded && target >= T.seat + 3) { board(); target = timeAt(); current = Math.max(current, T.seat); }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // ── Panels: seat items open their content over the seat ─────────────────
  const panel = document.querySelector('[data-cabin-panel]');
  const panelBody = panel?.querySelector('[data-cabin-panel-body]');
  const panelTitle = panel?.querySelector('[data-cabin-panel-title]');
  let opened = null, returnFocus = null, contactNode = null;
  function buildContact() {
    if (contactNode) return contactNode;
    contactNode = document.createElement('div');
    contactNode.className = 'cabin-contact';
    contactNode.innerHTML = '<p class="cabin-contact-kicker">Call attendant</p><h2>Say hello</h2><p>I\'m open to full-time early-career roles, apprenticeships and rotational programs across UX, product and front-end development.</p><a class="cabin-contact-email" href="mailto:avaniebaptiste@gmail.com">avaniebaptiste@gmail.com</a>';
    const socials = document.querySelector('.footer-socials')?.cloneNode(true);
    if (socials) contactNode.append(socials);
    return contactNode;
  }
  function openPanel(id, trigger) {
    if (!panel || fast()) return false;
    const content = id === 'contact' ? buildContact() : document.getElementById(id);
    if (!content) return false;
    closePanel(false);
    if (!boarded) board();
    const t = timeAt();
    if (t < T.seat || t > T.lean) scrollToUnit(T.seat + 6, 'instant');   // take your seat first
    const placeholder = document.createComment('cabin-panel');
    if (content.parentNode) content.parentNode.insertBefore(placeholder, content);
    panelBody.append(content);
    opened = { content, placeholder };
    panelTitle.textContent = trigger?.dataset.panelTitle || '';
    panel.hidden = false;
    root.classList.add('cabin-panel-open');
    returnFocus = trigger || document.activeElement;
    panelBody.scrollTop = 0;
    requestAnimationFrame(() => { panel.classList.add('is-open'); panel.querySelector('[data-cabin-panel-close]').focus({ preventScroll: true }); });
    dispatchEvent(new Event('resize'));             // let carousels measure their new home
    return true;
  }
  function closePanel(restoreFocus = true) {
    if (!opened) return;
    const { content, placeholder } = opened;
    if (placeholder.parentNode) placeholder.parentNode.replaceChild(content, placeholder); else content.remove();
    opened = null;
    panel.classList.remove('is-open'); panel.hidden = true;
    root.classList.remove('cabin-panel-open');
    dispatchEvent(new Event('resize'));
    if (restoreFocus) returnFocus?.focus({ preventScroll: true });
  }
  panel?.querySelector('[data-cabin-panel-close]')?.addEventListener('click', () => closePanel());
  panel?.addEventListener('click', event => { if (event.target === panel) closePanel(); });
  addEventListener('keydown', event => { if (event.key === 'Escape' && opened) closePanel(); });
  document.querySelectorAll('[data-panel]').forEach(el => el.addEventListener('click', event => {
    if (openPanel(el.dataset.panel, el)) event.preventDefault();
  }));
  // Header links open the same panels instead of jumping down the page.
  document.querySelectorAll('.nav-links a[href^="#"]:not([data-no-panel])').forEach(link => link.addEventListener('click', event => {
    link.dataset.panelTitle ||= link.textContent.trim();
    if (openPanel(link.getAttribute('href').slice(1), link)) event.preventDefault();
  }));

  // ── End of the flight: head back inside ─────────────────────────────────
  // After the Flight Log the page does not continue. Scrolling on past the end
  // (or the button) jumps to the open window and eases back: the window closes
  // and you are seated in 01A again.
  let returning = false, pull = 0, touchY = null;
  const meter = document.querySelector('[data-cabin-return-meter]');
  const setMeter = v => { if (meter) meter.style.width = `${Math.round(Math.min(1, v) * 100)}%`; };
  function returnToSeat() {
    if (returning || fast()) return;
    returning = true; pull = 0; setMeter(0);
    closePanel(false);
    if (!boarded) board();
    scrollTo({ top: section.offsetTop + (T.end - startUnit()) * vh(), behavior: 'instant' });
    current = target = T.end; render();
    // Drive the glide ourselves, frame by frame, and hold the seat afterwards
    // until the wheel/trackpad has been quiet for a moment. Browsers ignore
    // preventDefault on trackpad momentum, so this is what stops the pull
    // from carrying on past the seat.
    const unitY = u => section.offsetTop + (u - startUnit()) * vh();
    const from = unitY(T.end), to = unitY(T.seat + 6);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = reduce ? 0 : 1300;
    const t0 = performance.now();
    const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const step = now => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      scrollTo({ top: from + (to - from) * ease(k), behavior: 'instant' });
      if (k < 1 || now - lastWheel < 500) requestAnimationFrame(step);
      else returning = false;
    };
    requestAnimationFrame(step);
  }
  const atBottom = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 6;
  const tug = amount => {
    if (fast() || opened || returning) return;
    if (!atBottom()) { pull = 0; setMeter(0); return; }
    pull += amount; setMeter(pull / 480);
    if (pull >= 480) returnToSeat();
  };
  // While heading back, swallow leftover wheel/trackpad momentum so it cannot
  // interrupt the glide into the seat.
  let lastWheel = 0;
  addEventListener('wheel', e => {
    lastWheel = performance.now();
    if (returning) { e.preventDefault(); return; }
    if (e.deltaY > 0) tug(e.deltaY); else { pull = 0; setMeter(0); }
  }, { passive: false });
  addEventListener('touchstart', e => { touchY = e.touches[0]?.clientY ?? null; }, { passive: true });
  addEventListener('touchmove', e => {
    if (returning) { if (e.cancelable) e.preventDefault(); return; }
    if (touchY == null) return;
    const y = e.touches[0]?.clientY ?? touchY;
    if (touchY - y > 0) tug((touchY - y) * 2.2);
    touchY = y;
  }, { passive: false });
  addEventListener('keydown', e => { if (['ArrowDown', 'PageDown', ' ', 'End'].includes(e.key)) tug(160); });
  document.querySelector('[data-cabin-return]')?.addEventListener('click', returnToSeat);

  section.querySelector('[data-cabin-go="seat"]')?.addEventListener('click', event => {
    if (fast()) return; event.preventDefault(); scrollToUnit(T.seat + 6);
  });
  section.querySelector('[data-cabin-go="window"]')?.addEventListener('click', () => scrollToUnit(T.end));
  section.querySelector('[data-cabin-reboard]')?.addEventListener('click', reboard);
  seat.addEventListener('focusin', () => { const t = timeAt(); if (t < T.seat || t > T.lean) scrollToUnit(T.seat + 6, 'instant'); });

  document.fonts?.ready.then(placeHole);
  function start() {
    if (fast()) { closePanel(false); section.style.height = ''; scene?.dispose(); scene = null; root.classList.remove('cabin-window'); return; }
    layout(); renderer.resize(); lastDraw = '';
    current = target = timeAt(); render();
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { if (fast() || opened) return; layout(); renderer.resize(); lastDraw = ''; onScroll(); });
  new MutationObserver(() => { lastDraw = ''; render(); }).observe(root, { attributes: true, attributeFilter: ['data-sky'] });
  document.addEventListener('avanie:fast', start);
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  start();
}

// ── Fast track toggle (header) ───────────────────────────────────────────────
const fastButton = document.querySelector('[data-fast-toggle]');
if (fastButton) {
  const sync = () => {
    const on = root.dataset.fast === 'on';
    fastButton.setAttribute('aria-pressed', String(on));
    fastButton.title = on ? 'Turn the boarding walk back on' : 'Skip the boarding walk';
  };
  sync();
  fastButton.addEventListener('click', () => {
    const on = root.dataset.fast !== 'on';
    root.dataset.fast = on ? 'on' : 'off';
    try { localStorage.setItem('avanie-air-fast', on ? '1' : '0'); } catch { /* Private browsing still works. */ }
    sync();
    scrollTo({ top: 0, behavior: 'instant' });
    document.dispatchEvent(new Event('avanie:fast'));
  });
}
