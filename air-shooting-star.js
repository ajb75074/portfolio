(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  const sky = document.querySelector('.air-sky');
  const intro = document.querySelector('.air-intro');
  if (!sky || !intro) return;

  let heroVisible = false;
  let firstStarDone = false;

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          heroVisible = entry.isIntersecting;
          sky.dataset.heroVisible = String(heroVisible);
        });
      },
      { threshold: 0.15 }
    );
    io.observe(intro);
  } else {
    heroVisible = true;
    sky.dataset.heroVisible = 'true';
  }

  function randomInterval() {
    return (45 + Math.random() * 45) * 1000;
  }

  // `constrained` keeps the streak near the window's visible aperture while
  // the cabin wall is still on screen (during the open animation); once the
  // boarding pass is up, the sky is fully exposed so it can roam more widely.
  function spawnShootingStar({ constrained = false } = {}) {
    const goingRight = Math.random() < 0.5;
    const angle = goingRight ? 15 + Math.random() * 30 : 150 - Math.random() * 30;
    // Constrained range targets where the round window aperture actually
    // sits on screen (roughly centered, mid-viewport), not just "upper sky".
    const dist = constrained ? 90 + Math.random() * 70 : 200 + Math.random() * 140;
    const startX = constrained ? 38 + Math.random() * 24 : 5 + Math.random() * 65;
    const startY = constrained ? 30 + Math.random() * 16 : 3 + Math.random() * 22;
    const duration = (0.8 + Math.random() * 0.4).toFixed(2);

    const star = document.createElement('div');
    star.className = 'air-shooting-star';
    star.setAttribute('aria-hidden', 'true');
    star.style.setProperty('--sx', `${startX}%`);
    star.style.setProperty('--sy', `${startY}%`);
    star.style.setProperty('--angle', `${angle}deg`);
    star.style.setProperty('--dist', `${dist}px`);
    star.style.setProperty('--dur', `${duration}s`);
    star.addEventListener('animationend', () => star.remove());
    sky.appendChild(star);
  }

  function scheduleNext(delayMs) {
    window.setTimeout(() => {
      if (heroVisible && !document.hidden) spawnShootingStar();
      scheduleNext(randomInterval());
    }, delayMs);
  }

  // Fires once, either mid-way through the window-open animation (so it
  // passes by the moon before the boarding pass appears) or, if the intro
  // was skipped entirely, shortly after the page settles instead.
  function runFirstStar(delayMs, options) {
    if (firstStarDone) return;
    firstStarDone = true;
    window.setTimeout(() => {
      spawnShootingStar(options);
      scheduleNext(randomInterval());
    }, delayMs);
  }

  function handleState(state) {
    if (firstStarDone) return;
    if (state === 'opening') {
      runFirstStar(900, { constrained: true });
    } else if (state === 'complete') {
      runFirstStar(800 + Math.random() * 700, { constrained: false });
    }
  }

  handleState(intro.dataset.state);
  if (!firstStarDone) {
    const stateObserver = new MutationObserver(() => {
      handleState(intro.dataset.state);
      if (firstStarDone) stateObserver.disconnect();
    });
    stateObserver.observe(intro, { attributes: true, attributeFilter: ['data-state'] });
  }
})();
