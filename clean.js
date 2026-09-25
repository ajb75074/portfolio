// clean.js — header menu on phones + card view of projects in recruiter mode.
// Load after air-cabin.js and ife.js.
(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const toggle = header?.querySelector('[data-nav-toggle]');
  const menu = header?.querySelector('[data-nav-menu]');
  const phone = matchMedia('(max-width: 760px)');

  // ── Phone menu ────────────────────────────────────────────────────────
  const setOpen = open => {
    if (!header || !toggle) return;
    header.classList.toggle('is-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle?.addEventListener('click', () => setOpen(!header.classList.contains('is-menu-open')));
  menu?.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  document.addEventListener('click', e => { if (header && !header.contains(e.target)) setOpen(false); });
  phone.addEventListener('change', () => setOpen(false));

  // Day/night lives in the corner pill on desktop and in the menu on phones.
  // Moving the one button keeps its click handler (air-clouds.js) intact.
  const sky = document.querySelector('[data-sky-toggle]');
  const dock = document.querySelector('[data-cabin-dock]');
  const utils = document.querySelector('[data-nav-utils]');
  const placeSky = () => {
    if (!sky || !dock || !utils) return;
    if (phone.matches) utils.prepend(sky);
    else dock.querySelector('.cabin-sound')?.before(sky);
  };
  placeSky();
  phone.addEventListener('change', placeSky);

  // Phones are always in recruiter mode (set before first paint in index.html).
  // If a desktop window is squeezed down to phone width, switch it over too.
  phone.addEventListener('change', e => {
    if (!e.matches || root.dataset.fast === 'on') return;
    root.dataset.fast = 'on';
    document.querySelector('[data-fast-toggle]')?.setAttribute('aria-pressed', 'true');
    document.dispatchEvent(new Event('avanie:fast'));
  });

  // ── Projects as cards (built from the IFE's own data, so one source) ───
  const section = document.getElementById('projects');
  const cards = section ? [...section.querySelectorAll('[data-ife-card]')] : [];
  if (!section || !cards.length) return;
  const LABELS = {
    'case-study': 'Case study', medium: 'Read on Medium', slides: 'View slides',
    project: 'View wireframes', dashboard: 'View dashboard',
  };
  const list = document.createElement('ul');
  list.className = 'rm-projects';
  list.setAttribute('aria-label', 'Projects');
  cards.forEach((card, i) => {
    const d = card.dataset;
    const li = document.createElement('li');
    const a = document.createElement(d.disabled === 'true' ? 'div' : 'a');
    a.className = 'rm-card';
    if (a.tagName === 'A') {
      a.href = d.href || '#';
      if (d.external === 'true') { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    }
    const icon = document.createElement('span');
    icon.className = `rm-card-icon ife-poster--${d.color || 'a'}`;
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = card.querySelector('.ife-card-poster')?.innerHTML || '';
    const cat = document.createElement('span');
    cat.className = 'rm-card-cat';
    cat.textContent = d.cat || '';
    const title = document.createElement('h3');
    title.className = 'rm-card-title';
    title.textContent = d.title || '';
    const desc = document.createElement('p');
    desc.className = 'rm-card-desc';
    desc.textContent = d.desc || '';
    const foot = document.createElement('span');
    foot.className = 'rm-card-foot';
    const role = document.createElement('span');
    role.className = 'rm-card-role';
    role.textContent = d.role || '';
    const cta = document.createElement('span');
    cta.className = 'rm-card-cta';
    cta.textContent = d.disabled === 'true' ? 'Coming soon' : `${LABELS[d.linkType] || LABELS['case-study']} →`;
    foot.append(role, cta);
    a.append(icon, cat, title, desc, foot);
    li.append(a);
    list.append(li);
  });
  (section.querySelector('.ife-lead') || section.firstElementChild)?.after(list);
})();
