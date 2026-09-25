(() => {
  const section = document.querySelector('[data-explog-section]');
  if (!section) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const routeWrap = section.querySelector('[data-explog-route-wrap]');
  const fillPath = section.querySelector('[data-explog-fill]');
  const plane = section.querySelector('[data-explog-plane]');
  const stops = Array.from(section.querySelectorAll('[data-explog-stop]'));
  const progressText = section.querySelector('[data-explog-progress]');

  const viewport = section.querySelector('[data-explog-viewport]');
  const slide = section.querySelector('[data-explog-slide]');
  const prevBtn = section.querySelector('[data-explog-prev]');
  const nextBtn = section.querySelector('[data-explog-next]');

  const logoImg = section.querySelector('[data-explog-logo]');
  const catEl = section.querySelector('[data-explog-cat]');
  const titleEl = section.querySelector('[data-explog-title]');
  const roleEl = section.querySelector('[data-explog-role]');
  const metaEl = section.querySelector('[data-explog-meta]');
  const descEl = section.querySelector('[data-explog-desc]');
  const tagsEl = section.querySelector('[data-explog-tags]');
  const closingEl = section.querySelector('[data-explog-closing]');

  if (!fillPath || !plane || !stops.length || !slide) return;

  const total = stops.length;
  const pathLength = fillPath.getTotalLength();
  fillPath.style.strokeDasharray = String(pathLength);

  const VIEW_W = 1000;
  const VIEW_H = 200;

  const points = stops.map((_, i) => {
    const t = total === 1 ? 0 : i / (total - 1);
    const at = t * pathLength;
    const p = fillPath.getPointAtLength(at);
    const ahead = fillPath.getPointAtLength(Math.min(pathLength, at + 1));
    const bearing = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI + 90;
    return {
      x: (p.x / VIEW_W) * 100,
      y: (p.y / VIEW_H) * 100,
      rot: bearing,
    };
  });

  stops.forEach((btn, i) => {
    btn.style.left = `${points[i].x}%`;
    btn.style.top = `${points[i].y}%`;
  });

  // ── Geography: the route crosses an archipelago. Each stop sits on its own
  // island; between stops there are islets, hills, palms and open water.
  // Drawn once into the route SVG (same coordinates as the path), seeded so it
  // looks the same on every visit.
  (function drawGeography() {
    const svg = section.querySelector('.explog-route-svg');
    if (!svg || svg.querySelector('.explog-geo')) return;
    let seed = 20260923;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pts = stops.map((_, i) => fillPath.getPointAtLength(total === 1 ? 0 : (i / (total - 1)) * pathLength));
    // Organic closed shape around (cx, cy), smoothed with Catmull-Rom curves.
    function blob(cx, cy, rx, ry, n = 11, wobble = 0.22) {
      const p = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2, k = 1 - wobble / 2 + rand() * wobble;
        return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
      });
      let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
      for (let i = 0; i < n; i++) {
        const p0 = p[(i - 1 + n) % n], p1 = p[i], p2 = p[(i + 1) % n], p3 = p[(i + 2) % n];
        d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d + 'Z';
    }
    const island = (x, y, rx, ry) =>
      `<path class="geo-shallow" d="${blob(x, y, rx * 1.45, ry * 1.6)}"/>` +
      `<path class="geo-sand" d="${blob(x, y, rx, ry)}"/>` +
      `<path class="geo-land" d="${blob(x - rx * 0.08, y - ry * 0.12, rx * 0.72, ry * 0.6)}"/>`;
    const palm = (x, y) =>
      `<g class="geo-palm" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M0 0 C1 -5 1 -9 -1 -13" /><path d="M-1 -13 c-5 -3 -9 -1 -11 2 M-1 -13 c4 -4 9 -3 11 0 M-1 -13 c-2 -5 -1 -8 2 -10 M-1 -13 c-6 0 -8 3 -8 6"/></g>`;
    const hills = (x, y) =>
      `<path class="geo-hill" d="M${x - 14} ${y} L${x - 5} ${y - 12} L${x + 2} ${y - 4} L${x + 8} ${y - 15} L${x + 17} ${y} Z"/>` +
      `<path class="geo-snow" d="M${x + 5.6} ${y - 11} L${x + 8} ${y - 15} L${x + 10.4} ${y - 11} Z"/>`;
    const wave = (x, y) => `<path class="geo-wave" d="M${x} ${y} q3 -3 6 0 t6 0"/>`;
    // Everything is clipped to the sea so no island can hang over the card.
    let out = '<clipPath id="explog-sea-clip"><rect x="0" y="0" width="1000" height="200" rx="18"/></clipPath><rect class="geo-sea" x="0" y="0" width="1000" height="200" rx="18"/><g clip-path="url(#explog-sea-clip)">';
    // Faint latitude lines.
    for (const y of [40, 100, 160]) out += `<path class="geo-lat" d="M0 ${y} H1000"/>`;
    // Open-water waves, kept away from the route and stops.
    for (let i = 0; i < 26; i++) {
      const x = 30 + rand() * 940, y = 14 + rand() * 172;
      const near = pts.some(p => Math.hypot(p.x - x, (p.y - y) * 2.2) < 70);
      if (!near) out += wave(x, y);
    }
    // Islets, hills and palms between stops (alternating sides of the route).
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const side = i % 2 ? -1 : 1, y = Math.min(172, Math.max(30, my + side * 34));
      const kind = i % 3;
      if (kind === 0) out += island(mx, y, 14, 6) + palm(mx + 2, y - 2);
      else if (kind === 1) out += island(mx, y, 22, 7) + hills(mx - 2, y + 2);
      else out += island(mx - 6, y, 9, 4) + island(mx + 10, y + 3, 7, 3.5);
    }
    // One island per stop (the stop marker sits on it).
    pts.forEach((p, i) => { out += island(p.x, p.y, 30 + (i % 3) * 4, 11 + (i % 2) * 2); });
    // Compass rose.
    out += '<g class="geo-compass" transform="translate(44 34)"><circle r="12"/><path d="M0 -15 L3 0 L0 15 L-3 0 Z"/><path class="geo-compass-ew" d="M-15 0 L0 -3 L15 0 L0 3 Z"/><text y="-18">N</text></g></g>';
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'explog-geo');
    g.innerHTML = out;
    svg.insertBefore(g, svg.firstChild);
  })();

  let currentIndex = 0;

  function setPlanePosition(index, { instant = false } = {}) {
    const p = points[index];
    if (instant) plane.classList.add('is-taxiing');
    plane.style.left = `${p.x}%`;
    plane.style.top = `${p.y}%`;
    plane.style.transform = `translate(-50%, -50%) rotate(${p.rot}deg)`;
    if (instant) {
      // Force a reflow so the position above applies before transitions re-enable.
      // eslint-disable-next-line no-unused-expressions
      plane.offsetHeight;
      plane.classList.remove('is-taxiing');
    }
  }

  function updateRoute(index) {
    const t = total === 1 ? 1 : index / (total - 1);
    fillPath.style.strokeDashoffset = String(pathLength * (1 - t));
    setPlanePosition(index);

    stops.forEach((btn, i) => {
      const active = i === index;
      btn.classList.toggle('is-active', active);
      if (active) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function updateProgress(index) {
    const num = String(index + 1).padStart(2, '0');
    const den = String(total).padStart(2, '0');
    if (progressText) progressText.textContent = `FLIGHT LOG · ${num} / ${den}`;
  }

  function updateArrows(index) {
    if (prevBtn) prevBtn.hidden = index === 0;
    if (nextBtn) nextBtn.hidden = index === total - 1;
  }

  function renderSlide(index) {
    const d = stops[index].dataset;

    if (catEl) catEl.textContent = d.cat || '';
    if (titleEl) titleEl.textContent = d.title || '';
    if (roleEl) roleEl.textContent = d.role || '';
    if (metaEl) metaEl.textContent = d.meta || '';
    if (descEl) descEl.innerHTML = d.desc || '';

    if (tagsEl) {
      tagsEl.innerHTML = '';
      (d.tags || '').split(',').forEach((tag) => {
        const trimmed = tag.trim();
        if (!trimmed) return;
        const li = document.createElement('li');
        li.textContent = trimmed;
        tagsEl.appendChild(li);
      });
    }

    if (logoImg) {
      logoImg.src = d.logo || '';
      logoImg.alt = d.logoAlt || '';
    }

    if (closingEl) closingEl.hidden = d.closing !== 'true';
  }

  // Swap the slide's content. The old slide leaves the way the finger moved;
  // the new one enters from the opposite side.
  function swapSlide(index, dir, wait) {
    slide.classList.remove('to-next', 'to-prev');
    if (dir) slide.classList.add(dir > 0 ? 'to-next' : 'to-prev');
    slide.classList.add('is-changing');
    window.setTimeout(() => {
      renderSlide(index);
      if (dir) {
        // Park the new slide on the far side without animating, then let it settle.
        slide.classList.add('is-dragging');
        slide.classList.remove('to-next', 'to-prev');
        slide.classList.add(dir > 0 ? 'to-prev' : 'to-next');
        slide.offsetHeight;   // eslint-disable-line no-unused-expressions
        slide.classList.remove('is-dragging');
      }
      requestAnimationFrame(() => slide.classList.remove('is-changing'));
    }, wait);
  }

  function selectStop(index, { animate = true, focusStop = false } = {}) {
    const clamped = Math.max(0, Math.min(total - 1, index));
    const changed = clamped !== currentIndex;
    const dir = clamped > currentIndex ? 1 : -1;
    currentIndex = clamped;

    updateRoute(clamped);
    updateProgress(clamped);
    updateArrows(clamped);

    if (animate && changed && !reduceMotion) {
      swapSlide(clamped, dir, 200);
    } else {
      renderSlide(clamped);
      slide.classList.remove('is-changing', 'to-next', 'to-prev');
    }

    if (focusStop) stops[clamped].focus();
  }

  // One entry point for "go to stop i": while the log is pinned, scrolling is
  // the navigation, so fly there by scrolling; otherwise switch directly.
  function goTo(i) {
    const to = Math.max(0, Math.min(total - 1, i));
    if (to === currentIndex) return;
    if (gliding) scrollToStop(to); else selectStop(to);
  }

  stops.forEach((btn, i) => {
    btn.addEventListener('click', () => selectStop(i));
  });

  if (prevBtn) prevBtn.addEventListener('click', () => selectStop(currentIndex - 1, { focusStop: true }));
  if (nextBtn) nextBtn.addEventListener('click', () => selectStop(currentIndex + 1, { focusStop: true }));

  if (viewport) {
    viewport.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(currentIndex - 1);
      }
    });

    // Swipe: the card follows the finger, then commits on a long-enough or
    // fast-enough flick. Vertical gestures are left to the page.
    let startX = 0, startY = 0, startT = 0, axis = null, dragging = false;
    const canSwipe = () => !slide.classList.contains('is-changing');
    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || !canSwipe()) return;
      dragging = true; axis = null;
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; startT = performance.now();
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
      if (!axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (axis !== 'x' || reduceMotion) return;
      // Resist at either end of the route.
      const edge = (dx > 0 && currentIndex === 0) || (dx < 0 && currentIndex === total - 1);
      const shift = dx * (edge ? 0.18 : 0.5);
      slide.classList.add('is-dragging');
      slide.style.transform = `translateX(${shift}px)`;
      slide.style.opacity = String(1 - Math.min(0.5, Math.abs(shift) / 260));
    }, { passive: true });

    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      const touch = e.changedTouches && e.changedTouches[0];
      const dx = touch ? touch.clientX - startX : 0;
      const fast = Math.abs(dx) / Math.max(1, performance.now() - startT) > 0.45;
      const wasDragged = slide.classList.contains('is-dragging');
      slide.classList.remove('is-dragging');
      slide.style.transform = '';
      slide.style.opacity = '';
      if (axis !== 'x' || !(Math.abs(dx) > 56 || (fast && Math.abs(dx) > 24))) return;
      const to = currentIndex + (dx < 0 ? 1 : -1);
      if (to < 0 || to > total - 1) return;
      if (gliding) { goTo(to); return; }
      // Continue the motion the finger started instead of restarting from centre.
      currentIndex = to;
      updateRoute(to); updateProgress(to); updateArrows(to);
      if (wasDragged && !reduceMotion) swapSlide(to, dx < 0 ? 1 : -1, 140);
      else renderSlide(to);
    };
    viewport.addEventListener('touchend', endDrag, { passive: true });
    viewport.addEventListener('touchcancel', endDrag, { passive: true });
  }

  // Drag a finger along the route strip to scrub between stops.
  if (routeWrap) {
    let scrub = false, sx = 0, sy = 0, sAxis = null;
    const nearest = (x) => {
      let best = currentIndex, dist = Infinity;
      stops.forEach((btn, i) => {
        const r = btn.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - x);
        if (d < dist) { dist = d; best = i; }
      });
      return best;
    };
    routeWrap.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      scrub = true; sAxis = null; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    routeWrap.addEventListener('touchmove', (e) => {
      if (!scrub) return;
      const t = e.touches[0];
      if (!sAxis && Math.max(Math.abs(t.clientX - sx), Math.abs(t.clientY - sy)) > 8) sAxis = Math.abs(t.clientX - sx) > Math.abs(t.clientY - sy) ? 'x' : 'y';
      if (sAxis !== 'x') return;
      const to = nearest(t.clientX);
      if (to !== currentIndex) goTo(to);
    }, { passive: true });
    const endScrub = () => { scrub = false; };
    routeWrap.addEventListener('touchend', endScrub, { passive: true });
    routeWrap.addEventListener('touchcancel', endScrub, { passive: true });
  }

  // ── Glide: while the section is pinned in view, scrolling flies the plane
  // along the curved route from stop to stop. Each stop holds for a moment so
  // its story can be read; clicks and arrows scroll to that stop instead.
  const glideWrap = section.closest('[data-explog-glide]');
  const header = document.querySelector('.site-header');
  let gliding = false;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  // Phones scroll the page normally and swipe the card; the pinned glide is for desktop.
  const phone = matchMedia('(max-width: 760px)');
  function glideFits() {
    if (document.documentElement.dataset.fast === 'on' || phone.matches) return false;
    const room = innerHeight - (header ? header.offsetHeight : 0) - 8;
    // Check the tallest stop, not just the current one.
    let tallest = 0;
    stops.forEach((_, i) => { renderSlide(i); tallest = Math.max(tallest, section.offsetHeight); });
    renderSlide(currentIndex);
    return tallest <= room;
  }
  function glideRange() { return Math.max(1, glideWrap.offsetHeight - innerHeight); }
  function glideT() {
    const p = clamp01(-glideWrap.getBoundingClientRect().top / glideRange());
    const raw = p * (total - 1), i = Math.floor(raw), f = raw - i;
    // Hold at each stop, then fly smoothly to the next.
    const k = clamp01((f - 0.3) / 0.7);
    return Math.min(total - 1, i + k * k * (3 - 2 * k));
  }
  function placePlaneAt(t) {
    const at = pathLength * (t / (total - 1));
    const pt = fillPath.getPointAtLength(at);
    const ahead = fillPath.getPointAtLength(Math.min(pathLength, at + 2));
    const behind = fillPath.getPointAtLength(Math.max(0, at - 2));
    const rot = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI + 90;
    plane.style.left = `${(pt.x / VIEW_W) * 100}%`;
    plane.style.top = `${(pt.y / VIEW_H) * 100}%`;
    plane.style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    fillPath.style.strokeDashoffset = String(pathLength * (1 - t / (total - 1)));
  }
  // A small hint under the log says what scrolling does next.
  let hint = null;
  function setHint(idx) {
    if (!hint) return;
    const last = idx >= total - 1;
    const fastMode = document.documentElement.dataset.fast === 'on';
    hint.textContent = !last ? 'Scroll to fly to the next stop · or use ‹ ›'
      : fastMode ? 'Keep scrolling for the Passport' : 'Keep scrolling to head back inside';
  }
  // Never let the hint cover the log: hide it when the card reaches it.
  const dashboard = section.querySelector('[data-explog-dashboard]');
  function fitHint() {
    if (!hint || hint.hidden || !dashboard) return;
    // Tuck it if the card reaches it, or once the log unpins (it would sit on
    // the "Next destination" note below).
    const clash = dashboard.getBoundingClientRect().bottom > innerHeight - 52
      || glideWrap.getBoundingClientRect().bottom < innerHeight + 2;
    hint.classList.toggle('is-tucked', clash);
  }
  function glideFrame() {
    if (!gliding) return;
    const t = glideT();
    placePlaneAt(t);
    const idx = Math.round(t);
    if (hint && hint.dataset.idx !== String(idx)) { hint.dataset.idx = idx; setHint(idx); }
    fitHint();
    if (idx !== currentIndex) {
      const was = currentIndex;
      currentIndex = idx;
      stops.forEach((btn, i) => {
        btn.classList.toggle('is-active', i === idx);
        if (i === idx) btn.setAttribute('aria-current', 'true'); else btn.removeAttribute('aria-current');
      });
      updateProgress(idx);
      updateArrows(idx);
      if (!reduceMotion && was !== idx) {
        slide.classList.add('is-changing');
        setTimeout(() => { renderSlide(currentIndex); fitHint(); requestAnimationFrame(() => slide.classList.remove('is-changing')); }, 200);
      } else renderSlide(idx);
    }
  }
  function scrollToStop(i) {
    const top = glideWrap.getBoundingClientRect().top + scrollY + (Math.max(0, Math.min(total - 1, i)) / (total - 1)) * glideRange();
    scrollTo({ top, behavior: reduceMotion ? 'instant' : 'smooth' });
  }
  function setupGlide() {
    if (!glideWrap) return;
    glideWrap.style.setProperty('--glide-top', `${header ? header.offsetHeight : 0}px`);
    glideWrap.classList.add('is-compact');
    gliding = glideFits() && !reduceMotion;
    if (!gliding) glideWrap.classList.remove('is-compact');

    glideWrap.classList.toggle('is-gliding', gliding);
    plane.classList.toggle('is-taxiing', gliding);
    if (gliding && !hint) {
      hint = document.createElement('p');
      hint.className = 'explog-glide-hint';
      hint.setAttribute('aria-hidden', 'true');
      section.append(hint);   // pinned with the log, near the bottom of the screen
    }
    if (hint) { hint.hidden = !gliding; hint.dataset.idx = ''; }
    if (gliding) glideFrame();
  }
  if (glideWrap) {
    // In glide mode a stop click or arrow flies there by scrolling.
    section.addEventListener('click', event => {
      if (!gliding) return;
      const stop = event.target.closest('[data-explog-stop]');
      const prev = event.target.closest('[data-explog-prev]');
      const next = event.target.closest('[data-explog-next]');
      if (!stop && !prev && !next) return;
      event.stopPropagation();
      scrollToStop(stop ? stops.indexOf(stop) : currentIndex + (next ? 1 : -1));
    }, true);
    let queued = false;
    addEventListener('scroll', () => {
      if (!gliding || queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; glideFrame(); });
    }, { passive: true });
    addEventListener('resize', setupGlide);
    document.addEventListener('avanie:fast', setupGlide);
  }

  // Initial paint: render the first stop and park the route/plane at it.
  renderSlide(0);
  updateProgress(0);
  updateArrows(0);

  stops.forEach((btn, i) => {
    btn.classList.toggle('is-active', i === 0);
  });
  fillPath.style.strokeDashoffset = String(pathLength);
  setPlanePosition(0, { instant: true });

  setupGlide();
  if (gliding) {
    glideFrame();
  } else if (reduceMotion) {
    updateRoute(0);
  } else if ('IntersectionObserver' in window) {
    // Taxi the plane in from the left once the route first comes into view.
    plane.style.left = `${Math.max(0, points[0].x - 10)}%`;
    plane.classList.add('is-taxiing');

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          requestAnimationFrame(() => {
            plane.classList.remove('is-taxiing');
            updateRoute(0);
          });
          io.disconnect();
        });
      },
      { threshold: 0.4 }
    );
    if (routeWrap) io.observe(routeWrap);
    else updateRoute(0);
  } else {
    updateRoute(0);
  }
})();
