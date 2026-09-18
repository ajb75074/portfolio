# UX Portfolio Homepage

A modern, animation-focused UX portfolio homepage built with pure HTML, CSS, and JavaScript using GSAP.

## Files

- `index.html` — semantic page structure
- `styles.css` — dark, responsive visual system
- `script.js` — GSAP load + scroll reveal animations

## Quick Preview (macOS / zsh)

From the project folder:

```zsh
cd /Users/avaniebaptiste/Desktop/avanie.co
python3 -m http.server 5500
```

Then open:

- http://localhost:5500

## Features

- Fullscreen centered hero section
- Top navigation with animated underline hover
- Responsive project card grid (3/2/1 columns)
- GSAP hero entrance animation
- GSAP scroll reveal for project cards
- Smooth scroll behavior

## Avanie Air homepage intro

Serve this static site with `python3 -m http.server 8000`, then visit
`http://localhost:8000`. No build step is required. Existing case-study routes
and portfolio content remain standard HTML.

- `index.html`: quick boarding-pass intro with project/passport links, and a single
  two-page Passenger Passport replacing both old About introductions. Keeps `#about`
  navigation and uses the existing photo; the booklet stacks on small screens.
- `air-intro.css`: ivory styling, continuous fixed CSS landscape, responsive card,
  reduced-motion overrides, boarding-pass reveal, booklet pages, and skill stamps.
- `air-intro.js`: lazy loading, opening/skip/replay state, storage, focus handling,
  reduced-motion and load/WebGL failure fallbacks.
- `air-scene.js`: Three.js scene, model-boundary-fitted procedural shade and pull
  handle, raised beveled ivory trim, recessed rim, feathered inner-edge shadow,
  GSAP opening/expansion, resize handling, and GPU cleanup. The supplied
  GLB contains a cabin wall only, with no shade or animation clips; the procedural
  shade is intentional. The transparent canvas reveals the same CSS landscape
  used behind the page. Neither the camera nor landscape moves during expansion.
- `public/models/air-window.glb`: supplied 54 KB model, copied with a clean name.
  Because this is a plain static site, its URL includes `public/`.
- `script.js`: skips existing GSAP effects for reduced motion or unavailable GSAP.
- `package.json` / `package-lock.json`: pin the sole new dependency, Three.js.
- `vendor/three/`: local Three.js modules, GLTFLoader, BufferGeometryUtils, and
  license; checked in so static hosting needs no npm build or runtime CDN for 3D.
- `.gitignore`: excludes `node_modules`.

Completion uses `avanie-air-intro-v1` in localStorage. The boarding pass's replay
button intentionally restarts the intro, except when reduced motion is enabled.
The renderer runs only during interaction/resize and is disposed after completion.
The existing GSAP CDN is reused, with a requestAnimationFrame fallback if unavailable.

Verification: JS syntax, model parsing, HTTP asset delivery, and mocked controller
lifecycle checks pass. A real-browser visual/mobile/WebGL pass is still required;
no browser connection was available in the implementation session.

### Boarding-pass visual refinement

`index.html` now uses an editable ticket main panel and decorative right stub,
with Start your journey → `#projects` and Meet the passenger → `#about`.
`air-intro.css` supplies the offset paper sheet, subtle grain, cocoa/Fredoka
wordmark, lavender boarding label, serif details, cobalt action, curved
perforation, miniature window and barcode. The stub hides on mobile. Existing
window scene, landscape, passport and project content are unchanged. Browser
visual verification is recorded as blocked in `design-qa.md`.
