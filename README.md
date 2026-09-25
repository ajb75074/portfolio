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

### Realistic cruise view (window-seat pass)

- `air-clouds.js`: paints three tileable, moonlit cloud-deck textures on a
  canvas at load (no downloads) and hands them to CSS as blob URLs. Also sets
  `--wing-sink` on scroll so the wing settles lower and dims past the hero.
- `air-intro.css`: the flat hills are replaced by a night sky, horizon haze,
  moon glint on the cloud tops, three parallax cloud layers drifting toward the
  tail, and an SVG port wing (seat 2A). During the intro the wing leans into the window
  aperture; it settles back when the boarding pass appears. Cabin lighting
  (warm reading light + dim corners) sits over the 3D wall during the intro.
- `air-scene.js`: adds an acrylic pane behind the shade with cabin-light
  reflections, seal shadow, bottom-edge frost and a breather hole.
- `air-cabin-sound.js` + header button: optional engine drone and vent hiss
  synthesized with Web Audio. Off by default; pauses in background tabs.
- Reduced motion: drift, flex and the wing transition are disabled.

### Day / night sky

- An inline script in `<head>` sets `html[data-sky]` before first paint: the
  visitor's saved choice (`avanie-air-sky` in localStorage), otherwise their
  local time (day 6am–7pm).
- The sun/moon button in the header flips it (with a View Transition
  crossfade where supported) and remembers the choice.
- Day: deep high-altitude blue, the moon element restyled as the sun, sunlit
  white clouds (`air-clouds.js` paints a day palette and caches both sets), a
  white wing, no stars, and a soft shadow on cream headings for contrast.

### Boarding story (scroll to seat)

`#home` is one scroll-driven sequence (`air-cabin.js` + `air-cabin.css`):

1. **Door**: the boarding pass sits in boarding door 2L.
2. **Aisle**: six rows drawn on a `<canvas>` by a small perspective renderer in
   `air-cabin.js` (near-plane clipping, back-face culling, painter's order).
   No DOM 3D, so no seams or gaps. Five cabin announcements (the `<ol
   data-cabin-announce>` in `index.html`, edit freely) introduce you on the way.
3. **Seat 2A**: the seatback in front of you is the menu. Its screen opens the
   real in-flight entertainment (Projects); the storage pouch holds the
   Passport (About), Latest Trip and Resume. Items open in a panel over the
   seat (the section itself is moved into the panel and put back on close), so
   nothing navigates away. Header links for Projects and About do the same.
   The walk stops at row 2, with row 1's seatbacks and a small crew door on
   the far wall ahead of you.
   The hub is one wide cabin wall with a fixed camera (`data-view` on
   `.cabin-seat`): **forward** (the seat) and **look left** (the window, shade
   closed until you press Open Shade, which flies out to the Flight Path and
   drifts down to it on desktop). Arrow keys switch views too.
4. **Scroll in, not out**: once you reach the seat, the door and aisle leave
   the scroll range for this visit (sessionStorage `avanie-air-boarded`).
   "Board again from the door" replays it.
5. **Window**: keep scrolling and the view leans into the window; the
   Three.js window (`air-scene.js` `setProgress`) opens and zooms out.
6. **Flight**: the rest of the page scrolls over the sky, with cloud parallax.

**Fast track** (header button, or `?fast=1`) skips all of it and is
remembered; reduced-motion visitors get it by default. With cabin sound on, a
seatbelt chime plays when you sit. `air-intro.js` is no longer loaded and can
be deleted.

### Homepage refinement (positioning + IA)

- Positioning: "UX / Product Designer & Software Engineer" on the boarding pass,
  in the single welcome announcement, and in the Passenger Passport.
- Latest Trip postcard: Wishlist as an editorial pick, with an
  "Explore case study →" CTA plus Design / Engineering tracks.
- In-flight entertainment (`#projects`): the original poster carousel and
  "Now selected" panel; Wishlist is first with a "Now playing" badge.
- Naming: **Flight Path** is the whole experience section (the window label and
  the eyebrow), **Career Journey** is its heading, and **Flight Log** is each
  individual stop. The header link stays "Experience". (The "FLIGHT LOG · 01 / 09"
  counter was removed from the card.)
- Window: the seat's window is the Blender model (`public/models/air-window.glb`,
  drawn by `air-scene.js` in "anchored" mode as part of the cabin wall). The shade,
  the lean-in zoom and the sky behind it are all that one object. If WebGL is
  unavailable a plain closed-shade window stands in.
- Projects device (`ife.js`): its height is locked to the tallest project's info
  at the current width, so it never changes size and never clips text.
- Flight Log (`#experiences`, `experience-log.js`): the original Experience
  Log is the first thing out the window. While it is pinned, scrolling glides
  the plane along the route from stop to stop (compact layout in `ife.css`;
  it falls back to click/arrow mode if a screen is too short). The "Next
  destination" note sits just after it.
- Seat items open as a full-page sheet that scrolls like the page.
- Passenger Passport: 8 rubber-stamp impressions in priority order (speckled
  ink mask, rounded/oval shapes, a small second line on each).

### Two modes

- **Cabin (default):** door → aisle → seat 2A → window → Flight Log → back
  inside. The Latest Trip, Projects and Passport sections are not in the page
  flow here; they open from the seat. At the end of the Flight Log, scrolling
  on (or "Return to seat 2A") jumps to the open window and eases back into
  the seat.
- **Fast track / recruiter mode (`?fast=1`):** the original homepage in its
  original order (boarding pass, Latest Trip, In-Flight Entertainment,
  Experience Log with Previous/Next, Passport, footer) over the new sky. By
  day, section headings sit on a soft dark plate so cream text stays readable.
- Flight Log map: an archipelago drawn under the route (`experience-log.js`,
  seeded so it is stable): an island per stop, islets, hills, palms, waves and
  a compass rose. Previous/Next stay available while gliding.
- Cabin: 2+2 layout, four rows, seat pairs drawn as one silhouette with
  attached armrests and floor shadows; row placards show only the row number
  and seat letters (04 AB / 04 CD … 01). NMI Dossier removed from the nav.

### Recruiter mode naming

- The seat view has no ceiling bar, big title or status chip; "Seat 2A" only
  appears on the boarding pass and in small print.
- Contact is an outlined pill at the end of the header (opens the contact
  sheet in the cabin, scrolls to the footer in recruiter mode). On phones the
  header has two rows: links, then controls.
- "Fast track" is now labelled "Recruiter mode".
- Scroll hints: a small light label at the bottom says what scrolling does at
  each step (board, find your seat, look outside, open the window, fly
  through the Flight Log, head back inside).
- Postcard: two equal case-study buttons (Product Design / UX, Software
  Engineering); it keeps its landscape width in recruiter mode.
