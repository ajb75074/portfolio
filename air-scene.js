import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function createWindow(host, onOpen) {
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
  // Extend the cabin beyond the exported wall for ultrawide screens.
  const surround = new THREE.Shape([new THREE.Vector2(-100,-100),new THREE.Vector2(100,-100),new THREE.Vector2(100,100),new THREE.Vector2(-100,100)]);
  surround.holes.push(new THREE.Path(boundary));
  let wallMaterial;
  gltf.scene.traverse(n => { if (n.isMesh) wallMaterial = n.material; });
  const extension = new THREE.Mesh(new THREE.ShapeGeometry(surround), wallMaterial);
  extension.position.z = -.305; group.add(extension);
  let disposed = false, frame = 0, tween, pending;
  const render = () => { if (!disposed) renderer.render(scene, camera); };
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
  const observer = new ResizeObserver(resize); observer.observe(host);
  for (const element of host.parentElement?.querySelectorAll('.air-label, .air-controls') ?? []) observer.observe(element);
  resize();
  const raycaster = new THREE.Raycaster();
  function click(event) {
    const r = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX-r.left)/r.width*2-1, -(event.clientY-r.top)/r.height*2+1), camera);
    if (raycaster.intersectObjects([panel, handle, trim, rim]).length) onOpen();
  }
  renderer.domElement.addEventListener('click', click);
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
  return {
    async open() {
      await animate(shade.position, { y: 3.4 }, 1.35);
      if (disposed) return;
      // Scale the physical cabin around its opening. The camera and sky never move.
      const scale = Math.max(camera.right / .65, camera.top / 1.1) * 1.3;
      await animate(group.scale, { x: scale, y: scale, z: 1 }, 1.8);
    },
    dispose() {
      disposed = true; tween?.kill(); cancelAnimationFrame(frame); pending?.(); observer.disconnect();
      renderer.domElement.removeEventListener('click', click);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      const geometries = new Set(), materials = new Set();
      scene.traverse(node => { if (node.geometry) geometries.add(node.geometry); if (node.material) materials.add(node.material); });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      renderer.dispose(); renderer.domElement.remove();
    }
  };
}
