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
  const VIEW_H = 160;

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

  function selectStop(index, { animate = true, focusStop = false } = {}) {
    const clamped = Math.max(0, Math.min(total - 1, index));
    const changed = clamped !== currentIndex;
    currentIndex = clamped;

    updateRoute(clamped);
    updateProgress(clamped);
    updateArrows(clamped);

    if (animate && changed && !reduceMotion) {
      slide.classList.add('is-changing');
      window.setTimeout(() => {
        renderSlide(clamped);
        requestAnimationFrame(() => slide.classList.remove('is-changing'));
      }, 260);
    } else {
      renderSlide(clamped);
      slide.classList.remove('is-changing');
    }

    if (focusStop) stops[clamped].focus();
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
        selectStop(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectStop(currentIndex - 1);
      }
    });

    let touchStartX = 0;
    let touchStartY = 0;
    let touching = false;

    viewport.addEventListener(
      'touchstart',
      (e) => {
        if (!e.touches.length) return;
        touching = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );

    viewport.addEventListener(
      'touchend',
      (e) => {
        if (!touching) return;
        touching = false;
        const touch = e.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) selectStop(currentIndex + 1);
        else selectStop(currentIndex - 1);
      },
      { passive: true }
    );
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

  if (reduceMotion) {
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
