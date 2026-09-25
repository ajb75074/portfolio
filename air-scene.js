import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

function paneTexture() {
  const w = 256, h = 400, canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  // Seal shadow around the edge.
  const edge = ctx.createRadialGradient(w / 2, h / 2, h * .28, w / 2, h / 2, h * .56);
  edge.addColorStop(0, 'rgba(20, 28, 44, 0)'); edge.addColorStop(1, 'rgba(20, 28, 44, .32)');
  ctx.fillStyle = edge; ctx.fillRect(0, 0, w, h);
  // Two diagonal reflections of the cabin lights.
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-.55);
  for (const [x, width, alpha] of [[-70, 46, .13], [-12, 14, .08], [60, 26, .05]]) {
    const band = ctx.createLinearGradient(x - width, 0, x + width, 0);
    band.addColorStop(0, 'rgba(255, 250, 238, 0)'); band.addColorStop(.5, `rgba(255, 250, 238, ${alpha})`); band.addColorStop(1, 'rgba(255, 250, 238, 0)');
    ctx.fillStyle = band; ctx.fillRect(x - width, -h, width * 2, h * 2);
  }
  ctx.restore();
  // Frost creeping up from the bottom seal.
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 900; i++) {
    const x = rand() * w, y = h - Math.pow(rand(), 2.6) * h * .22, r = rand() * 1.4 + .3;
    ctx.fillStyle = `rgba(236, 244, 255, ${(.05 + rand() * .22) * (1 - (h - y) / (h * .22))})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// createWindow(host, onOpen, { anchored }):
//   default   fills `host` and frames the window itself (the original behaviour).
//   anchored  the canvas is a large piece of the cabin wall (the seat scene's
//             world) and the caller places the window in it with place(). The
//             shade (setShade) and the lean-in (setZoom) are then driven
//             separately, so this one model is the only window on the page.
export async function createWindow(host, onOpen, options = {}) {
  const anchored = !!options.anchored;
  const gltf = await new GLTFLoader().loadAsync('./public/models/air-window.glb');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 100);
  camera.position.set(0, 0, 20);
  const group = new THREE.Group(); scene.add(group);
  gltf.scene.rotation.x = Math.PI / 2;
  group.add(gltf.scene);
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb0a18c, 1.7));
  const light = new THREE.DirectionalLight(0xfff3db, 2.6);
  light.position.set(-3, 5, 8); scene.add(light);

  // This export lies in X/Z. Read its inner boundary so the shade fits the
  // actual rounded opening, rather than approximating it with an ellipse.
  const points = new Map();
  gltf.scene.traverse(node => {
    if (!node.isMesh) return;
    const position = node.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = -position.getZ(i);
      if (Math.abs(x) < 2 && Math.abs(y) < 2) points.set(`${x.toFixed(5)},${y.toFixed(5)}`, new THREE.Vector2(x, y));
    }
  });
  const boundary = [...points.values()].sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  const ext = boundary.reduce((e, p) => ({ x0: Math.min(e.x0, p.x), x1: Math.max(e.x1, p.x), y0: Math.min(e.y0, p.y), y1: Math.max(e.y1, p.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  const apW = ext.x1 - ext.x0, apH = ext.y1 - ext.y0;
  // Keep the imported cabin intact. These concentric details follow its exact
  // aperture, adding a raised molding and recessed lip to the flat wall export.
  function ringShape(outer, inner) {
    const shape = new THREE.Shape(boundary.map(p => p.clone().multiplyScalar(outer)));
    shape.holes.push(new THREE.Path(boundary.map(p => p.clone().multiplyScalar(inner)).reverse()));
    return shape;
  }
  function molding(outer, inner, z, depth, bevel, color, roughness) {
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(outer, inner), {
      depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel,
      bevelSegments: 5, steps: 1,
    }), new THREE.MeshStandardMaterial({ color, roughness, metalness: .025 }));
    mesh.position.z = z;
    group.add(mesh);
    return mesh;
  }
  const trim = molding(1.24, 1.045, -.065, .13, .035, 0xfff4df, .32);
  const rim = molding(1.045, .975, -.14, .045, .012, 0xc6b99f, .48);
  // Feather the recessed edge without shadow maps or texture downloads. The
  // center stays entirely transparent, revealing the persistent CSS landscape.
  for (let i = 0; i < 7; i++) {
    const outer = .982 - i * .007;
    const shadow = new THREE.Mesh(new THREE.ShapeGeometry(ringShape(outer, outer - .008)),
      new THREE.MeshBasicMaterial({ color: 0x665540, transparent: true,
        opacity: .16 * (1 - i / 7), depthWrite: false }));
    shadow.position.z = -.18;
    group.add(shadow);
  }
  const outline = new THREE.Shape(boundary.map(p => p.clone().multiplyScalar(1.025)));
  const shade = new THREE.Group(); shade.position.z = -.37; group.add(shade);
  const cream = new THREE.MeshStandardMaterial({ color: 0xf1e6d0, roughness: .42, metalness: .03 });
  const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: .035, bevelEnabled: true, bevelSize: .025, bevelThickness: .015, bevelSegments: 3, steps: 1 }), cream);
  shade.add(panel);
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .32, 5, 12), new THREE.MeshStandardMaterial({ color: 0xd6c4a6, roughness: .3 }));
  handle.rotation.z = Math.PI / 2; handle.position.set(0, -1.15, .085); shade.add(handle);
  // Acrylic window pane behind the shade: faint cabin-light reflections, a
  // darkened edge where the pane meets its seal, and a little frost along the
  // bottom edge. It fades out as the window zooms open (see render).
  const pane = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(boundary.map(p => p.clone().multiplyScalar(.99)))),
    new THREE.MeshBasicMaterial({ map: paneTexture(), transparent: true, depthWrite: false }));
  {
    const uv = pane.geometry.attributes.uv, pos = pane.geometry.attributes.position;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) { minX = Math.min(minX, pos.getX(i)); maxX = Math.max(maxX, pos.getX(i)); minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - minX) / (maxX - minX), (pos.getY(i) - minY) / (maxY - minY));
    uv.needsUpdate = true;
  }
  pane.position.z = -.45; group.add(pane);
  // Extend the cabin beyond the exported wall for ultrawide screens.
  const surround = new THREE.Shape([new THREE.Vector2(-100,-100),new THREE.Vector2(100,-100),new THREE.Vector2(100,100),new THREE.Vector2(-100,100)]);
  surround.holes.push(new THREE.Path(boundary));
  let wallMaterial;
  gltf.scene.traverse(n => { if (n.isMesh) wallMaterial = n.material; });
  const extension = new THREE.Mesh(new THREE.ShapeGeometry(surround), wallMaterial);
  extension.position.z = -.305; group.add(extension);
  let disposed = false, frame = 0, tween, pending;
  const render = () => {
    if (disposed) return;
    // Fade the pane details as the cabin scales past the camera, so frost and
    // reflections never balloon into large specks mid-zoom.
    pane.material.opacity = Math.max(0, 1 - (group.scale.x - 1) / 1.2);
    renderer.render(scene, camera);
  };
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    const aspect = width / Math.max(height, 1);
    // Reserve real space for the headline and controls, including wrapped text.
    // The full raised frame is about 4.1 world units tall. Keep it inside the
    // centered safe area instead of sizing it to a percentage of the viewport.
    const parent = host.parentElement;
    const label = parent?.querySelector('.air-label');
    const controls = parent?.querySelector('.air-controls');
    const top = host.getBoundingClientRect?.().top ?? 0;
    const labelBottom = label ? label.getBoundingClientRect().bottom - top : 64;
    const controlsTop = controls ? controls.getBoundingClientRect().top - top : height - 150;
    const reserve = Math.max(labelBottom + 16, height - controlsTop + 16);
    const frameHeight = Math.max(100, Math.min(460, height - 2 * reserve));
    const viewHeight = Math.max(4.1 * height / frameHeight, 3.1 / aspect);
    camera.left = -viewHeight * aspect / 2; camera.right = -camera.left;
    camera.top = viewHeight / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix();
    renderer.setSize(width, height); render();
  }
  let observer = null;
  if (!anchored) {
    observer = new ResizeObserver(resize); observer.observe(host);
    for (const element of host.parentElement?.querySelectorAll('.air-label, .air-controls') ?? []) observer.observe(element);
    resize();
  } else {
    Object.assign(renderer.domElement.style, { display: 'block', position: 'absolute', left: '0', top: '0' });
  }
  const raycaster = new THREE.Raycaster();
  function click(event) {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1, -(event.clientY-r.top)/r.height*2+1), camera);
    if (raycaster.intersectObjects([panel, handle, trim, rim]).length) onOpen?.();
  }
  if (onOpen) renderer.domElement.addEventListener('click', click);
  const lost = event => { event.preventDefault(); host.dispatchEvent(new Event('scene-unavailable')); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  function animate(target, values, duration) {
    return new Promise(resolve => {
      pending = resolve;
      if (window.gsap) {
        tween = gsap.to(target, { ...values, duration, ease: 'power2.inOut', onUpdate: render, onComplete: resolve });
      } else {
        const start = performance.now(), from = Object.fromEntries(Object.keys(values).map(k => [k, target[k]]));
        function tick(now) {
          if (disposed) return;
          const p = Math.min((now-start)/(duration*1000),1), ease = p*p*(3-2*p);
          for (const k in values) target[k] = from[k]+(values[k]-from[k])*ease;
          render(); if(p < 1) frame = requestAnimationFrame(tick); else resolve();
        }
        frame = requestAnimationFrame(tick);
      }
    });
  }
  // ── Anchored mode ──────────────────────────────────────────────────────────
  let px = 1, zoomMax = 1, lastZoom = -1;
  function place({ width, height, cx, cy, aperturePx, view }) {
    px = aperturePx / apH;                                    // pixels per model unit
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75, Math.sqrt(8e6 / (width * height))));
    renderer.setSize(width, height);
    // The window's centre sits at pixel (cx, cy) of the canvas.
    camera.left = -cx / px; camera.right = (width - cx) / px; camera.top = cy / px; camera.bottom = -(height - cy) / px;
    camera.updateProjectionMatrix();
    // Zoom until the opening covers the screen, from wherever the window sits in it.
    const dx = view.w / 2, dy = Math.max(view.cy, view.h - view.cy);
    zoomMax = Math.max(dx / px / (apW / 2), dy / px / (apH / 2)) * 1.3;
    lastZoom = -1;
    render();
  }
  function setZoom(z) {
    if (disposed || z === lastZoom) return;
    lastZoom = z;
    const scale = 1 + (zoomMax - 1) * z * z;                  // ease in hard, like leaning to the glass
    group.scale.set(scale, scale, 1);
    render();
  }
  function setShade(open, animated = true) {
    if (disposed) return Promise.resolve();
    tween?.kill();
    if (!animated) { shade.position.y = open ? 3.4 : 0; render(); return Promise.resolve(); }
    return animate(shade.position, { y: open ? 3.4 : 0 }, .4);
  }

  return {
    aspect: apW / apH, place, setZoom, setShade,
    async open() {
      await animate(shade.position, { y: 3.4 }, 1.35);
      if (disposed) return;
      // Scale the physical cabin around its opening. The camera and sky never move.
      const scale = Math.max(camera.right / .65, camera.top / 1.1) * 1.3;
      await animate(group.scale, { x: scale, y: scale, z: 1 }, 1.8);
    },
    // Scroll-driven version of open(): p 0-.4 raises the shade, .4-1 scales the
    // cabin wall past the camera. Fully reversible, so scrolling back up closes it.
    setProgress(p) {
      if (disposed) return;
      const clamp = v => Math.min(1, Math.max(0, v));
      const smooth = t => t * t * (3 - 2 * t);
      const raise = smooth(clamp(p / .4));
      const zoom = clamp((p - .4) / .6);
      shade.position.y = 3.4 * raise;
      const target = Math.max(camera.right / .65, camera.top / 1.1) * 1.3;
      // Ease in hard so the approach feels like leaning toward the glass.
      const scale = 1 + (target - 1) * zoom * zoom;
      group.scale.set(scale, scale, 1);
      render();
    },
    dispose() {
      disposed = true; tween?.kill(); cancelAnimationFrame(frame); pending?.(); observer?.disconnect();
      renderer.domElement.removeEventListener('click', click);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set(), materials = new Set();
      scene.traverse(node => { if (node.geometry) geometries.add(node.geometry); if (node.material) materials.add(node.material); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => { m.map?.dispose(); m.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}
