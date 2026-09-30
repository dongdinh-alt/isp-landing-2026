/* =========================================================
   ISP Landing 2026 — Roadmap background map (three.js)
   Upper half of a dotted globe on a geodesic (hexagonal) lattice, sitting under the
   "Lộ trình đào tạo" content. Phase 1: Vietnam glows red. Scrolling into phase 2 rotates
   the globe in 3D to Taiwan, which lights up purple with a ripple from Tân Bắc.
   Driven by window.ISP_ROUTE.progress (0..1) from the roadmap scroll timeline in main.js.
   ========================================================= */
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const section = document.querySelector('.roadmap');
const canvas = section && section.querySelector('.roadmap__map');
const route = (window.ISP_ROUTE = window.ISP_ROUTE || { progress: 0 });
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const HCM = { lat: 10.78, lon: 106.69 };   // UEH.ISB
const TPE = { lat: 25.04, lon: 121.43 };   // Fu Jen
const D2R = Math.PI / 180;
const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const webgl = (() => {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
})();

// phones skip the globe entirely (the canvas is hidden there by CSS)
const phone = window.matchMedia('(max-width: 767px)').matches;

if (canvas && webgl && !phone) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    init().catch(err => { console.warn('[roadmap-map] disabled:', err); canvas.remove(); });
  }, { rootMargin: '1200px 0px' });
  io.observe(section);
}

/* x = cosφ·cosλ, y = sinφ, z = −cosφ·sinλ  (mirrored by tools/build-hex-map.py) */
function ll2v(lat, lon) {
  const p = lat * D2R, l = lon * D2R;
  return [Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l)];
}

/* Rebuild the geodesic lattice in the exact order used by the build script. */
function buildLattice(F, emit) {
  const t = (1 + Math.sqrt(5)) / 2;
  const V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const FACES = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  const edgeSet = new Map();
  FACES.forEach(f => [[f[0], f[1]], [f[1], f[2]], [f[2], f[0]]].forEach(([a, b]) => {
    const e = a < b ? [a, b] : [b, a];
    edgeSet.set(e[0] * 100 + e[1], e);
  }));
  const EDGES = [...edgeSet.values()].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  V.forEach(v => emit(v[0], v[1], v[2]));
  for (const [a, b] of EDGES) {
    const A = V[a], B = V[b];
    for (let k = 1; k < F; k++) { const u = k / F; emit(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u); }
  }
  for (const [a, b, c] of FACES) {
    const A = V[a], B = V[b], C = V[c];
    for (let i = 1; i < F - 1; i++) {
      const u = i / F;
      for (let j = 1; j < F - i; j++) {
        const w = j / F;
        emit(A[0] + (B[0] - A[0]) * u + (C[0] - A[0]) * w, A[1] + (B[1] - A[1]) * u + (C[1] - A[1]) * w, A[2] + (B[2] - A[2]) * u + (C[2] - A[2]) * w);
      }
    }
  }
}

function decodeKinds(b64, total) {
  const bin = atob(b64);
  const out = new Uint8Array(total);
  let pos = 0, n = 0, shift = 0;
  for (let i = 0; i < bin.length; i++) {
    const c = bin.charCodeAt(i);
    n |= (c & 0x7f) << shift; shift += 7;
    if (!(c & 0x80)) { const run = n >>> 2, kind = n & 3; out.fill(kind, pos, pos + run); pos += run; n = 0; shift = 0; }
  }
  return out;
}

async function init() {
  const [THREE, data] = await Promise.all([import(THREE_URL), import('./hex-map-data.js')]);
  const F = data.F, total = 10 * F * F + 2;
  const kinds = decodeKinds(data.default, total);

  const vHCM = new THREE.Vector3(...ll2v(HCM.lat, HCM.lon));
  const vTPE = new THREE.Vector3(...ll2v(TPE.lat, TPE.lon));
  const vMID = vHCM.clone().add(vTPE).normalize();
  const capCos = Math.cos(88 * D2R);  // only the side of the globe that can ever face the camera

  // Collect points: position on the unit sphere, kind, angular distance to its country's campus (for ripples)
  const pos = [], kind = [], dist = [];
  let idx = 0;
  buildLattice(F, (x, y, z) => {
    const k = kinds[idx++];
    const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
    if (x * vMID.x + y * vMID.y + z * vMID.z < capCos) return;
    pos.push(x, y, z); kind.push(k);
    const ref = k === 3 ? vTPE : vHCM;
    dist.push(Math.acos(Math.min(1, x * ref.x + y * ref.y + z * ref.z)));
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('kind', new THREE.Float32BufferAttribute(kind, 1));
  geo.setAttribute('dist', new THREE.Float32BufferAttribute(dist, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: {
      uSize: { value: 2.2 }, uDpr: { value: 1 }, uAlpha: { value: 0 },
      uVN: { value: 0 }, uTW: { value: 0 }, uTime: { value: 0 }
    },
    vertexShader: /* glsl */`
      attribute float kind; attribute float dist;
      uniform float uSize, uDpr, uAlpha, uVN, uTW, uTime;
      varying vec4 vCol;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * position);
        float facing = dot(n, normalize(-mv.xyz));          // 1 facing the camera, 0 at the rim
        float vis = smoothstep(0.02, 0.35, facing);

        float isLand = step(0.5, kind);
        float isVN = step(1.5, kind) * step(kind, 2.5);
        float isTW = step(2.5, kind);

        // ripple reveal from each campus: Vietnam spans ~0.3 rad from HCMC, Taiwan ~0.04 rad from Tân Bắc
        float vnR = uVN * 0.34, twR = uTW * 0.07;
        float vn = isVN * smoothstep(vnR + 0.02, vnR - 0.02, dist) * step(0.001, uVN);
        float tw = isTW * smoothstep(twR + 0.012, twR - 0.012, dist) * step(0.001, uTW);
        float front = isVN * (1.0 - smoothstep(0.0, 0.035, abs(dist - vnR))) * (1.0 - step(0.999, uVN)) * step(0.001, uVN)
                    + isTW * (1.0 - smoothstep(0.0, 0.012, abs(dist - twR))) * (1.0 - step(0.999, uTW)) * step(0.001, uTW);

        // very light grays: a texture, not content — keeps text contrast over the map intact
        vec3 sea  = vec3(0.80, 0.81, 0.83);
        vec3 land = vec3(0.74, 0.75, 0.78);
        vec3 red  = vec3(0.89, 0.13, 0.11);
        vec3 purp = vec3(0.42, 0.23, 0.90);
        vec3 col = mix(sea, land, isLand);
        float a = mix(0.18, 0.7, isLand);    // faint sea, light land
        col = mix(col, red, vn);  a = mix(a, 1.0, vn);
        col = mix(col, purp, tw); a = mix(a, 1.0, tw);
        col += front * 0.25;
        float hi = max(vn, tw);
        // gentle breathing on the highlighted country
        float breathe = 1.0 + 0.12 * hi * sin(uTime * 2.2 - dist * 40.0);
        vCol = vec4(col, a * vis * uAlpha);
        gl_PointSize = uSize * uDpr * (1.0 + 0.7 * vn + 1.3 * tw + 0.6 * front) * breathe / -mv.z;  // Taiwan is small: bigger dots
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec4 vCol;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vCol.rgb, vCol.a * smoothstep(0.5, 0.32, d));
      }`
  });

  const globe = new THREE.Points(geo, mat);
  const pivot = new THREE.Group();
  pivot.add(globe);
  const scene = new THREE.Scene();
  scene.add(pivot);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);

  // Orientation that puts a place at a given elevation on the dome, north up
  // The highlighted country is anchored at (azimuth, elevation) on the dome: bottom-left, in the free band under phase 1
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  // shift: lens shift as a fraction of width (dome moves left) · dist: camera distance in phase 1 (smaller = closer zoom)
  // twZoom: extra zoom-in for Taiwan (small island) · size: dot size
  // Countries sit near the TOP rim of the globe; the globe itself stays in the free band under the content
  const anchor = { az: 0, el: 74 * D2R, elTW: 71 * D2R, shift: 0, dist: 2.4, twZoom: 0.3, size: 4.2, look: 1.31, fov: 26,
                   distN: 2.6, twZoomN: 0.3, sizeN: 3.6, lookN: 1.08, fovN: 30, elN: 64 * D2R, elTWN: 62 * D2R };
  const orient = (v, el = anchor.el) => {
    const g = Math.atan2(-v.x, v.z);
    const lat = Math.asin(v.y);
    return new THREE.Quaternion().setFromAxisAngle(Y, anchor.az)
      .multiply(new THREE.Quaternion().setFromAxisAngle(X, lat - el))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Y, g));
  };
  // Center Vietnam a bit north of HCMC so the whole country sits on the dome
  const vVNc = new THREE.Vector3(...ll2v(15.5, 106.5));
  const elVN = () => (narrow ? anchor.elN : anchor.el);
  const elTWc = () => (narrow ? anchor.elTWN : anchor.elTW);
  const qVN = orient(vVNc);
  const qTW = orient(vTPE, anchor.elTW);   // Taiwan is small: it can sit lower, clear of the text
  const qTmp = new THREE.Quaternion(), qTilt = new THREE.Quaternion(), qYaw = new THREE.Quaternion();

  let W = 1, H = 1, narrow = false;
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    narrow = window.innerWidth < 768;   // phone layout (canvas is a short band there, so aspect alone can't tell)
    // globe centred horizontally on all screens
    qVN.copy(orient(vVNc, elVN())); qTW.copy(orient(vTPE, elTWc()));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = narrow ? anchor.fovN : anchor.fov;
    camera.updateProjectionMatrix();
    mat.uniforms.uDpr.value = dpr;
    mat.uniforms.uSize.value = narrow ? anchor.sizeN : anchor.size;
    draw(performance.now(), true);
  };

  let px = 0, tpx = 0;
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    section.addEventListener('pointermove', e => { tpx = e.clientX / window.innerWidth - 0.5; });
    section.addEventListener('pointerleave', () => { tpx = 0; });
  }

  let sp = 0, last = performance.now(), born = performance.now(), visible = true, raf = 0;
  function draw(now, force) {
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000)); last = now;
    const target = clamp01(route.progress);
    sp += (target - sp) * (force ? 1 : 1 - Math.exp(-dt * 6));
    px += (tpx - px) * (1 - Math.exp(-dt * 2.5));
    const t = now / 1000;

    // intro: dome rises & fades in, Vietnam ripples out from HCMC
    const intro = reduced ? 1 : smooth(0, 1, (now - born) / 1600);
    // phase 1 → 2 (matches the content crossfade in the roadmap timeline)
    const s = smooth(0.22, 0.42, sp);   // aligned with the plane crossing into phase 2 (~.27 of the timeline)

    // 3D transition: slerp VN → TW, with a pitch dip + yaw swing + zoom-out at mid-flight
    const mid = Math.sin(Math.PI * s);
    qTmp.copy(qVN).slerp(qTW, s);
    qTilt.setFromAxisAngle(X, 0.22 * mid);
    qYaw.setFromAxisAngle(Y, -0.18 * mid + px * 0.08 + Math.sin(t * 0.18) * 0.012);
    pivot.quaternion.copy(qTilt).multiply(qYaw).multiply(qTmp);

    const R = 1;
    // zoom in a little on Taiwan (small island), pull back mid-flight for the 3D swing
    const dist = (narrow ? anchor.distN : anchor.dist) - (narrow ? anchor.twZoomN : anchor.twZoom) * s + 0.3 * mid;
    // keep the anchored country on the same screen spot while zooming:
    // screen offset ∝ (sin el − lookY) / (dist − cos el) is held at its base-distance value
    const baseDist = narrow ? anchor.distN : anchor.dist, baseLook = narrow ? anchor.lookN : anchor.look;
    const elNow = lerp(elVN(), elTWc(), s);
    const se = Math.sin(elNow), ce = Math.cos(elNow);
    const lookY = se - (se - baseLook) / (baseDist - ce) * (dist - ce);
    pivot.position.set(0, lerp(-0.55, 0, intro), 0);
    pivot.scale.setScalar(R);
    camera.position.set(0, lookY, dist);
    camera.lookAt(0, lookY, 0);
    // lens shift: slide the whole dome sideways without changing perspective (country stays north-up)
    if (anchor.shift) camera.setViewOffset(W, H, W * anchor.shift, 0, W, H); else camera.clearViewOffset();

    mat.uniforms.uAlpha.value = intro;
    mat.uniforms.uVN.value = intro * (1 - smooth(0.1, 0.55, s));
    mat.uniforms.uTW.value = smooth(0.4, 1.0, s);
    mat.uniforms.uTime.value = t;

    renderer.render(scene, camera);
    if (!force && visible && !reduced) raf = requestAnimationFrame(draw);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible && !reduced) { last = performance.now(); raf = requestAnimationFrame(draw); }
  }).observe(section);

  // reduced motion: a still frame (Vietnam), redrawn only on resize / scroll phase change
  if (reduced) {
    sp = 0;
    window.addEventListener('scroll', () => draw(performance.now(), true), { passive: true });
  }
  // debug: render a given scroll progress immediately, e.g. ISP_MAP_DEBUG(0.8)
  window.ISP_MAP_DEBUG = (p, azDeg, elDeg, extra) => {
    if (azDeg != null) { anchor.az = azDeg * D2R; anchor[narrow ? 'elN' : 'el'] = elDeg * D2R; }
    if (extra) {
      Object.assign(anchor, extra);
      if (extra.elTWdeg != null) anchor[narrow ? 'elTWN' : 'elTW'] = extra.elTWdeg * D2R;
      mat.uniforms.uSize.value = narrow ? anchor.sizeN : anchor.size;
      camera.fov = narrow ? anchor.fovN : anchor.fov; camera.updateProjectionMatrix();
    }
    qVN.copy(orient(vVNc, elVN())); qTW.copy(orient(vTPE, elTWc()));
    route.progress = p; sp = p; born = -1e9; draw(performance.now(), true);
  };
  resize();
  canvas.classList.add('is-ready');
}
