// In-flight entertainment: the original Projects carousel. Scoped to the
// screen, so it also works when air-cabin.js moves this section into the seat panel.
(() => {
  const screen = document.querySelector('[data-ife-screen]');
  if (!screen) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const track = screen.querySelector('[data-ife-track]');
  const cards = Array.from(screen.querySelectorAll('[data-ife-card]'));
  const prevBtn = screen.querySelector('[data-ife-prev]');
  const nextBtn = screen.querySelector('[data-ife-next]');
  const wrap = screen.querySelector('.ife-carousel-wrap');
  const progressFill = screen.querySelector('[data-ife-progress]');
  const clockEl = screen.querySelector('[data-ife-clock]');

  const art = screen.querySelector('[data-ife-art]');
  const catEl = screen.querySelector('[data-ife-cat]');
  const titleEl = screen.querySelector('[data-ife-title]');
  const roleEl = screen.querySelector('[data-ife-role]');
  const descEl = screen.querySelector('[data-ife-desc]');
  const skillsEl = screen.querySelector('[data-ife-skills]');
  const ctaEl = screen.querySelector('[data-ife-cta]');
  const ctaLabel = ctaEl ? ctaEl.querySelector('[data-ife-cta-label]') : null;

  let currentIndex = 0;
  let scrollRAF = null;
  let suppressScrollSync = false;
  let suppressTimer = null;

  const LINK_TYPE_LABELS = {
    'case-study': 'View case study',
    medium: 'View case study on Medium',
    slides: 'View case study slides',
    project: 'View wireframes',
    dashboard: 'View Dashboard',
  };

  function updateArrows() {
    if (prevBtn) prevBtn.disabled = currentIndex === 0;
    if (nextBtn) nextBtn.disabled = currentIndex === cards.length - 1;
  }

  function updateProgress() {
    if (!progressFill) return;
    const pct = ((currentIndex + 1) / cards.length) * 100;
    progressFill.style.width = `${pct}%`;
  }

  const selectedLabel = screen.querySelector('[data-ife-selected-label]');
  // One "Now playing" badge that follows whichever project is selected.
  const badge = screen.querySelector('.ife-card-badge');
  badge?.setAttribute('aria-hidden', 'true');
  function updateInfo(card) {
    const d = card.dataset;
    if (badge && badge.parentNode !== card) card.prepend(badge);
    if (selectedLabel) selectedLabel.textContent = 'Now playing';
    if (catEl) catEl.textContent = d.cat || '';
    if (titleEl) titleEl.textContent = d.title || '';
    if (roleEl) roleEl.textContent = d.role || '';
    if (descEl) descEl.textContent = d.desc || '';

    if (skillsEl) {
      skillsEl.innerHTML = '';
      (d.skills || '').split(',').forEach((skill) => {
        const trimmed = skill.trim();
        if (!trimmed) return;
        const li = document.createElement('li');
        li.textContent = trimmed;
        skillsEl.appendChild(li);
      });
    }

    if (art) {
      art.className = `ife-info-art ife-poster--${d.color || 'a'}`;
      const poster = card.querySelector('.ife-card-poster');
      art.innerHTML = poster ? poster.innerHTML : '';
    }

    if (ctaEl) {
      if (d.disabled === 'true') {
        if (ctaLabel) ctaLabel.textContent = 'Case study coming soon';
        ctaEl.removeAttribute('href');
        ctaEl.removeAttribute('target');
        ctaEl.removeAttribute('rel');
        ctaEl.setAttribute('aria-disabled', 'true');
        ctaEl.classList.add('is-disabled');
      } else {
        if (ctaLabel) ctaLabel.textContent = LINK_TYPE_LABELS[d.linkType] || LINK_TYPE_LABELS['case-study'];
        ctaEl.href = d.href || '#';
        if (d.external === 'true') {
          ctaEl.target = '_blank';
          ctaEl.rel = 'noopener noreferrer';
        } else {
          ctaEl.removeAttribute('target');
          ctaEl.removeAttribute('rel');
        }
        ctaEl.removeAttribute('aria-disabled');
        ctaEl.classList.remove('is-disabled');
      }
    }
  }

  function selectCard(index, { scrollIntoView = true, focus = false } = {}) {
    const clamped = Math.max(0, Math.min(cards.length - 1, index));
    currentIndex = clamped;

    cards.forEach((card, i) => {
      const selected = i === clamped;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });

    updateInfo(cards[clamped]);
    updateArrows();
    updateProgress();

    if (scrollIntoView) {
      suppressScrollSync = true;
      if (suppressTimer) clearTimeout(suppressTimer);
      cards[clamped].scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        inline: 'center',
        block: 'nearest',
      });
      suppressTimer = window.setTimeout(() => {
        suppressScrollSync = false;
      }, 500);
    }
    if (focus) cards[clamped].focus();
  }

  cards.forEach((card, i) => {
    card.addEventListener('click', () => selectCard(i, { scrollIntoView: true }));
  });

  if (prevBtn) prevBtn.addEventListener('click', () => selectCard(currentIndex - 1, { focus: true }));
  if (nextBtn) nextBtn.addEventListener('click', () => selectCard(currentIndex + 1, { focus: true }));

  if (wrap) {
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        selectCard(currentIndex + 1, { focus: true });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        selectCard(currentIndex - 1, { focus: true });
      }
    });
  }

  if (track) {
    track.addEventListener(
      'wheel',
      (e) => {
        if (track.scrollWidth <= track.clientWidth) return;
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        track.scrollLeft += e.deltaY;
        e.preventDefault();
      },
      { passive: false }
    );

    track.addEventListener(
      'scroll',
      () => {
        if (suppressScrollSync) return;
        if (scrollRAF) return;
        scrollRAF = requestAnimationFrame(() => {
          scrollRAF = null;
          const trackRect = track.getBoundingClientRect();
          const center = trackRect.left + trackRect.width / 2;
          let closest = 0;
          let closestDist = Infinity;
          cards.forEach((card, i) => {
            const r = card.getBoundingClientRect();
            const dist = Math.abs(r.left + r.width / 2 - center);
            if (dist < closestDist) {
              closestDist = dist;
              closest = i;
            }
          });
          if (closest !== currentIndex) selectCard(closest, { scrollIntoView: false });
        });
      },
      { passive: true }
    );
  }

  if (clockEl) {
    const updateClock = () => {
      clockEl.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    updateClock();
    setInterval(updateClock, 30000);
  }

  selectCard(0, { scrollIntoView: false });

  // One constant size: the device is as tall as its longest project, so it never
  // grows or shrinks with the text and nothing is cut off. Every project's info
  // is measured at the current width and the tallest becomes the minimum height.
  const info = screen.querySelector('.ife-info');
  function lockInfoHeight() {
    if (!info || !info.offsetWidth) return;              // hidden right now (panel closed): keep the last size
    info.style.boxSizing = 'border-box';
    info.style.minHeight = '';
    const keep = currentIndex;
    let tallest = 0;
    cards.forEach((card) => { updateInfo(card); tallest = Math.max(tallest, info.getBoundingClientRect().height); });
    updateInfo(cards[keep]);
    info.style.minHeight = `${Math.ceil(tallest)}px`;
  }
  lockInfoHeight();
  document.fonts?.ready.then(lockInfoHeight);
  let lockRAF = 0;
  addEventListener('resize', () => { cancelAnimationFrame(lockRAF); lockRAF = requestAnimationFrame(lockInfoHeight); });

  if (!reduceMotion) {
    const rect = screen.getBoundingClientRect();
    const alreadyVisible = rect.top < window.innerHeight * 0.65;
    if (!alreadyVisible) screen.classList.add('is-priming');

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            screen.classList.remove('is-priming');
            screen.classList.add('is-booting');
            window.setTimeout(() => screen.classList.add('is-booted'), 650);
            io.disconnect();
          });
        },
        { threshold: 0.3 }
      );
      io.observe(screen);
    } else {
      screen.classList.remove('is-priming');
    }
  }
})();
