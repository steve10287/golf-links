// Visual world: sky, lighting, terrain, water, palms, grass, skyline, flag.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import * as C from './course.js';

const rand = C.mulberry32(99);

// ---------- procedural textures ----------
function tileNoise(size, periods, seed) {
  const r = C.mulberry32(seed);
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (const P of periods) {
    const lat = new Float32Array(P * P).map(() => r());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = x / size * P, fy = y / size * P;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      let u = fx - ix, v = fy - iy; u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
      const a = lat[(iy % P) * P + (ix % P)], b = lat[(iy % P) * P + ((ix + 1) % P)];
      const c = lat[((iy + 1) % P) * P + (ix % P)], d = lat[((iy + 1) % P) * P + ((ix + 1) % P)];
      out[y * size + x] += amp * ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v);
    }
    total += amp; amp *= 0.55;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}
function noiseTexture() {
  const S = 256;
  const a = tileNoise(S, [4, 8, 16, 32], 1), b = tileNoise(S, [8, 16, 32, 64], 2), c = tileNoise(S, [32, 64, 128], 3);
  const data = new Uint8Array(S * S * 4);
  for (let i = 0; i < S * S; i++) { data[i * 4] = a[i] * 255; data[i * 4 + 1] = b[i] * 255; data[i * 4 + 2] = c[i] * 255; data[i * 4 + 3] = 255; }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true;
  return t;
}
function waterNormals() {
  const S = 256;
  const h = tileNoise(S, [6, 12, 24, 48], 7);
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hl = h[y * S + ((x - 1 + S) % S)], hr = h[y * S + ((x + 1) % S)];
    const hd = h[((y - 1 + S) % S) * S + x], hu = h[((y + 1) % S) * S + x];
    let nx = (hl - hr) * 9, ny = (hd - hu) * 9, nz = 1; const l = Math.hypot(nx, ny, nz);
    const o = (y * S + x) * 4;
    data[o] = (nx / l * 0.5 + 0.5) * 255; data[o + 1] = (ny / l * 0.5 + 0.5) * 255; data[o + 2] = (nz / l * 0.5 + 0.5) * 255; data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}
function canvasTex(w, h, draw, srgb = true) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function frondTexture() {
  return canvasTex(128, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      const y = 14 + i / 70 * (h - 24);
      const len = (w / 2 - 4) * Math.sin(Math.PI * Math.min(1, (y / h) * 1.15)) * (0.85 + Math.random() * 0.2);
      const droop = 26 + Math.random() * 10;
      for (const side of [-1, 1]) {
        const grd = g.createLinearGradient(w / 2, y, w / 2 + side * len, y + droop);
        grd.addColorStop(0, '#6f9a2e'); grd.addColorStop(0.6, '#5c8a26'); grd.addColorStop(1, '#a8b84a');
        g.strokeStyle = grd; g.lineWidth = 4.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + side * len * 0.6, y + droop * 0.2, w / 2 + side * len, y + droop); g.stroke();
      }
    }
    g.strokeStyle = '#a99a55'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  });
}
function bladeTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = 10 + Math.random() * (w - 20), ht = h * (0.45 + Math.random() * 0.55), lean = (Math.random() - 0.5) * 30;
      const grd = g.createLinearGradient(0, h, 0, h - ht);
      grd.addColorStop(0, '#3e5a1a'); grd.addColorStop(1, Math.random() < 0.3 ? '#a8b860' : '#6f9430');
      g.fillStyle = grd; g.beginPath(); g.moveTo(x - 3, h); g.quadraticCurveTo(x + lean * 0.4, h - ht * 0.5, x + lean, h - ht); g.quadraticCurveTo(x + lean * 0.4 + 1, h - ht * 0.5, x + 3, h); g.fill();
    }
  });
}
function windowTexture() {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const cols = ['#ffd9a0', '#ffb070', '#ff7ac8', '#8ff6ff', '#fff2d0'];
    for (let y = 4; y < h - 4; y += 8) for (let x = 4; x < w - 4; x += 8) {
      if (Math.random() < 0.42) { g.fillStyle = cols[Math.floor(Math.random() * cols.length)]; g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 5, 5); }
    }
    g.globalAlpha = 1;
  });
}

function makeSkyMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: sunDir.clone() }, uTime: { value: 0 }, uClouds: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uSun; uniform float uTime; uniform float uClouds;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5;} return s; }
      void main(){
        vec3 d = normalize(vDir);
        float el = d.y;
        float sd = max(dot(d, uSun), 0.);
        float az = dot(normalize(vec2(d.x,d.z)+1e-5), normalize(vec2(uSun.x,uSun.z)));
        float toward = az*.5+.5;
        // gradient: horizon gold/orange near sun, hot pink away, purple/indigo zenith
        vec3 hor = mix(vec3(1.0,0.36,0.42), vec3(1.25,0.62,0.22), pow(toward, 2.0));
        vec3 mid = mix(vec3(0.62,0.20,0.50), vec3(0.95,0.32,0.38), pow(toward,2.0));
        vec3 zen = vec3(0.10,0.07,0.30);
        float e = max(el, 0.);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.16, e));
        col = mix(col, zen, smoothstep(0.12, 0.75, e));
        // sun glow + disc (HDR for bloom)
        col += vec3(1.4,0.7,0.3) * pow(sd, 14.) * 0.6;
        col += vec3(1.0,0.55,0.25) * pow(sd, 90.) * 2.0;
        col += vec3(6.,4.2,2.6) * smoothstep(0.99955, 0.9997, sd);
        // clouds: stretched streaks lit from below by the sun
        if (el > 0.0 && uClouds > 0.) {
          vec2 uv = d.xz / (el + 0.12);
          uv.x *= 0.45;
          float n = fbm(uv * 1.3 + vec2(uTime*0.004, 0.));
          float n2 = fbm(uv * 3.1 - vec2(uTime*0.006, 0.));
          float c = smoothstep(0.50, 0.78, n * 0.75 + n2 * 0.35) * smoothstep(0.0, 0.08, el) * (1. - smoothstep(0.35, 0.7, el));
          vec3 cloudLit = mix(vec3(1.3,0.45,0.55), vec3(1.6,0.85,0.4), pow(toward, 3.0));
          vec3 cloudDark = vec3(0.32,0.12,0.34);
          vec3 cc = mix(cloudDark, cloudLit, smoothstep(0.4, 0.9, n2) * 0.7 + pow(sd, 6.) * 0.6);
          col = mix(col, cc, c * 0.85 * uClouds);
        }
        // below horizon: hazy ocean tone (hidden by water mostly)
        if (el < 0.) col = mix(hor * 0.6, vec3(0.15,0.08,0.18), smoothstep(0., -0.2, el));
        gl_FragColor = vec4(col, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildWorld(renderer, scene, opts) {
  const W = {};
  const mobile = opts.mobile;

  // ---------- sky + sun ----------
  const sunDir = new THREE.Vector3(-0.62, 0.035, -0.78).normalize();
  W.sunDir = sunDir;
  const lightDir = new THREE.Vector3(-0.6, 0.32, -0.74).normalize();
  const skyMat = makeSkyMaterial(sunDir);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(9000, 48, 24), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);
  W.sky = sky;

  // environment from the sky for PBR
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envMat = makeSkyMaterial(sunDir); envMat.uniforms.uClouds.value = 0.5;
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(9000, 32, 16), envMat));
  // fake ground in env so reflections underneath are green-dark, not sky
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(8000, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1a2a10 }));
  envGround.position.y = -20; envScene.add(envGround);
  const envRT = pmrem.fromScene(envScene, 0, 1, 10000);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  W.skyTime = skyMat.uniforms.uTime;

  scene.fog = new THREE.FogExp2(0xc8687a, 0.0010);

  const sun = new THREE.DirectionalLight(0xffcf9e, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  const sc = sun.shadow.camera; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 1; sc.far = 700;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  W.sun = sun;
  W.setShadowCenter = (x, z) => {
    sun.target.position.set(x, 0, z);
    sun.position.set(x + lightDir.x * 350, lightDir.y * 350, z + lightDir.z * 350);
  };
  W.setShadowCenter(0, -80);
  const hemi = new THREE.HemisphereLight(0xffd0e4, 0x6a8a48, 0.75);
  scene.add(hemi);
  W.hemi = hemi;
  W.fog = scene.fog;

  // ---------- terrain ----------
  const grid = C.buildGrid(mobile ? 260 : 320, mobile ? 306 : 376);
  const course = C.makeCourse(grid);
  W.course = course;
  const { nx, nz, w, d, heights } = grid;
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i;
    pos[k * 3] = C.BOUNDS.minX + i / nx * w; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = C.BOUNDS.minZ + j / nz * d;
  }
  const idx = new Uint32Array(nx * nz * 6);
  let q = 0;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1;
    idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = e;
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tg.setIndex(new THREE.BufferAttribute(idx, 1));
  tg.computeVertexNormals();
  const mask = C.buildMask(mobile ? 768 : 1024);
  const maskTex = new THREE.DataTexture(mask.data, mask.size, mask.size, THREE.RGBAFormat);
  maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter; maskTex.needsUpdate = true;
  const noiseTex = noiseTexture();
  W.noiseTex = noiseTex;
  const tm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0, envMapIntensity: 0.55 });
  tm.onBeforeCompile = (sh) => {
    sh.uniforms.uMask = { value: maskTex }; sh.uniforms.uNoise = { value: noiseTex };
    sh.uniforms.uBMin = { value: new THREE.Vector2(C.BOUNDS.minX, C.BOUNDS.minZ) };
    sh.uniforms.uBSize = { value: new THREE.Vector2(w, d) };
    sh.uniforms.uWater = { value: C.WATER_LEVEL };
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWPos;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWPos = transformed;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `
      uniform sampler2D uMask; uniform sampler2D uNoise; uniform vec2 uBMin; uniform vec2 uBSize; uniform float uWater;
      varying vec3 vWPos; float tRough;
      void main() {`)
      .replace('#include <map_fragment>', `
      {
        vec2 muv = (vWPos.xz - uBMin) / uBSize;
        vec4 m = texture2D(uMask, muv);
        float n1 = texture2D(uNoise, vWPos.xz * 0.011).r;
        float n2 = texture2D(uNoise, vWPos.xz * 0.09).g;
        float n3 = texture2D(uNoise, vWPos.xz * 0.7).b;
        float n4 = texture2D(uNoise, vWPos.xz * 3.1).b;
        float n5 = texture2D(uNoise, vWPos.xz * 11.0).g;
        vec3 rough = mix(vec3(0.045, 0.125, 0.015), vec3(0.110, 0.200, 0.025), smoothstep(0.3, 0.7, n1));
        rough *= 0.72 + 0.55 * n2; rough *= 0.8 + 0.4 * n4;
        float sw = abs(fract(vWPos.x / 11.0 + 0.25) - 0.5) * 2.0;
        float st = smoothstep(0.46, 0.54, sw);
        vec3 fair = mix(vec3(0.070, 0.230, 0.022), vec3(0.150, 0.360, 0.045), st);
        fair *= 0.88 + 0.22 * n2; fair *= 0.92 + 0.16 * n4;
        float g1 = smoothstep(0.46, 0.54, abs(fract((vWPos.x + vWPos.z) / 7.0) - 0.5) * 2.0);
        float g2 = smoothstep(0.46, 0.54, abs(fract((vWPos.x - vWPos.z) / 7.0) - 0.5) * 2.0);
        vec3 grn = mix(vec3(0.100, 0.310, 0.035), vec3(0.165, 0.400, 0.055), 0.5 * (g1 + g2));
        grn *= 0.94 + 0.1 * n3;
        vec3 fringe = mix(vec3(0.080, 0.225, 0.032), vec3(0.11, 0.26, 0.04), n3) * (0.9 + 0.2 * n2);
        vec3 sand = vec3(0.86, 0.74, 0.56) * (0.86 + 0.18 * n2) * (0.88 + 0.24 * n4);
        vec3 col = rough;
        float det = 0.86 + 0.28 * n5;
        col = mix(col, fair, m.b);
        col = mix(col, fringe, m.g);
        col = mix(col, grn, m.r);
        col = mix(col, sand, m.a);
        float wet = smoothstep(uWater + 0.4, uWater - 0.05, vWPos.y);
        col = mix(col, col * vec3(0.45, 0.42, 0.38), wet);
        col *= mix(det, 1.0, m.a * 0.6);
        diffuseColor.rgb *= col;
        tRough = mix(0.95, 0.78, max(m.r, m.b * 0.6));
        tRough = mix(tRough, 1.0, m.a);
        tRough = mix(tRough, 0.35, wet * 0.8);
      }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * tRough;');
  };
  const terrain = new THREE.Mesh(tg, tm);
  terrain.receiveShadow = true;
  scene.add(terrain);
  W.terrain = terrain;

  // outer seabed so the ocean has depth colour
  // ---------- water ----------
  const wn = waterNormals();
  const water = new Water(new THREE.PlaneGeometry(8000, 8000), {
    textureWidth: mobile ? 384 : 768, textureHeight: mobile ? 384 : 768,
    waterNormals: wn, sunDirection: sunDir.clone(), sunColor: 0xffc79a, waterColor: 0x0a3d52,
    distortionScale: 2.2, fog: true, alpha: 1.0,
  });
  water.rotation.x = -Math.PI / 2; water.position.y = C.WATER_LEVEL;
  water.material.uniforms.size.value = 6;
  scene.add(water);
  W.water = water;

  // ---------- palms ----------
  const palmMats = {
    trunk: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
    frond: new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, color: 0xffffff }),
  };
  function palmGeo(bend, H) {
    // trunk
    const ringN = 16, radN = 9;
    const tp = [], tc = [], ti = [], tn = [];
    const curve = (t) => new THREE.Vector3(bend * t * t, H * t, 0);
    for (let r = 0; r <= ringN; r++) {
      const t = r / ringN, c = curve(t);
      const tan = new THREE.Vector3(2 * bend * t, H, 0).normalize();
      const side = new THREE.Vector3(0, 0, 1), bin = new THREE.Vector3().crossVectors(tan, side).normalize();
      let rad = 0.26 * (1 - t) + 0.15 * t + 0.16 * Math.exp(-t * 14);
      const band = 0.5 + 0.5 * Math.sin(t * H * 5.5);
      for (let k = 0; k <= radN; k++) {
        const a = k / radN * Math.PI * 2;
        const nrm = new THREE.Vector3().addScaledVector(bin, Math.cos(a)).addScaledVector(side, Math.sin(a));
        const rr = rad * (1 + 0.05 * band);
        tp.push(c.x + nrm.x * rr, c.y + nrm.y * rr, c.z + nrm.z * rr); tn.push(nrm.x, nrm.y, nrm.z);
        const v = 0.32 + 0.12 * band + 0.08 * t;
        tc.push(v * 0.40, v * 0.35, v * 0.30);
      }
    }
    for (let r = 0; r < ringN; r++) for (let k = 0; k < radN; k++) {
      const a = r * (radN + 1) + k, b = a + 1, c = a + radN + 1, e = c + 1;
      ti.push(a, c, b, b, c, e);
    }
    const trunk = new THREE.BufferGeometry();
    trunk.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    trunk.setAttribute('normal', new THREE.Float32BufferAttribute(tn, 3));
    trunk.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
    trunk.setIndex(ti);
    // fronds
    const top = curve(1);
    const fp = [], fu = [], fi = [];
    const nF = 12;
    for (let f = 0; f < nF; f++) {
      const ang = f / nF * Math.PI * 2 + rand() * 0.3;
      const L = 3.6 + rand() * 1.4;
      const lift = 0.35 + rand() * 0.55;
      const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const segs = 10, base = fp.length / 3;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const spine = top.clone().addScaledVector(dir, L * t);
        spine.y += L * (lift * t - (0.55 + lift * 0.6) * t * t);
        const wid = 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) + 0.05;
        const twist = 0.25 * t;
        for (let k = 0; k < 3; k++) {
          const u = k / 2, o = (u - 0.5) * 2 * wid;
          const p = spine.clone().addScaledVector(side, o);
          p.y += (k === 1 ? 0.12 * wid : -0.1 * wid) + o * twist * 0.3;
          fp.push(p.x, p.y, p.z); fu.push(u, 1 - t);
        }
      }
      for (let s = 0; s < segs; s++) for (let k = 0; k < 2; k++) {
        const a = base + s * 3 + k, b = a + 1, c = a + 3, e = c + 1;
        fi.push(a, c, b, b, c, e);
      }
    }
    const frond = new THREE.BufferGeometry();
    frond.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    frond.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
    frond.setIndex(fi); frond.computeVertexNormals();
    // bend normals upward a touch for nicer canopy lighting
    const nrm = frond.attributes.normal;
    for (let i = 0; i < nrm.count; i++) { const y = Math.abs(nrm.getY(i)); nrm.setXYZ(i, nrm.getX(i) * 0.5, y + 0.6, nrm.getZ(i) * 0.5); }
    nrm.normalize ? null : null;
    return { trunk, frond };
  }
  const variants = [palmGeo(1.2, 9.5), palmGeo(2.4, 11), palmGeo(0.5, 7.5)];
  const spots = [];
  const tryPlace = (x, z) => {
    if (C.sdFairway(x, z) < 7 || C.sdGreen(x, z) < 12 || C.sdPond(x, z) < 3 || C.sdTee(x, z) < 6 || C.sdBunker(x, z) < 3) return false;
    const h = course.heightAt(x, z); if (h < C.WATER_LEVEL + 0.25) return false;
    for (const s of spots) if ((s.x - x) ** 2 + (s.z - z) ** 2 < 25) return false;
    // keep the line of play clear in front of the tee
    if (z < -8 && z > -150 && Math.abs(x - 3) < 18) return false;
    spots.push({ x, z, h }); return true;
  };
  // beach line
  for (let i = 0; i < 900 && spots.length < 70; i++) {
    const x = C.BOUNDS.minX + rand() * 340, z = C.BOUNDS.minZ + rand() * 400;
    const so = C.sdOcean(x, z);
    if (so > 4 && so < 20) tryPlace(x, z);
  }
  // clusters behind green and around tee + sides
  const clusters = [[-6, -190, 14, 9], [24, -178, 9, 6], [-28, -150, 9, 5], [26, -118, 10, 6], [-14, 18, 10, 6], [16, 14, 8, 5], [36, -60, 14, 7], [-42, -40, 14, 7], [-50, -128, 10, 5]];
  for (const [cx, cz, r, n] of clusters) { let k = 0; for (let i = 0; i < 80 && k < n; i++) { if (tryPlace(cx + (rand() - 0.5) * 2 * r, cz + (rand() - 0.5) * 2 * r)) k++; } }
  for (let v = 0; v < variants.length; v++) {
    const list = spots.filter((_, i) => i % variants.length === v);
    const im1 = new THREE.InstancedMesh(variants[v].trunk, palmMats.trunk, list.length);
    const im2 = new THREE.InstancedMesh(variants[v].frond, palmMats.frond, list.length);
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3();
    list.forEach((s, i) => {
      const sc = 0.85 + rand() * 0.4;
      qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
      m.compose(new THREE.Vector3(s.x, s.h - 0.15, s.z), qq, sv.set(sc, sc, sc));
      im1.setMatrixAt(i, m); im2.setMatrixAt(i, m);
    });
    for (const im of [im1, im2]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); }
  }
  W.palms = spots;

  // ---------- grass tufts ----------
  const bladeMap = bladeTexture();
  const tuftGeo = new THREE.BufferGeometry();
  {
    const p = [], u = [], n = [], ii = [];
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI, cx = Math.cos(a) * 0.3, cz = Math.sin(a) * 0.3, b = p.length / 3;
      p.push(-cx, 0, -cz, cx, 0, cz, cx, 0.42, cz, -cx, 0.42, -cz); u.push(0, 0, 1, 0, 1, 1, 0, 1);
      n.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); ii.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    tuftGeo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    tuftGeo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); tuftGeo.setIndex(ii);
  }
  const tuftMat = new THREE.MeshStandardMaterial({ map: bladeMap, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9, color: 0xc8d890 });
  const timeU = { value: 0 };
  W.timeU = timeU;
  tuftMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = timeU;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
      vec3 ip = instanceMatrix[3].xyz;
      #else
      vec3 ip = vec3(0.);
      #endif
      float sway = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.21) * 0.07 * position.y / 0.42;
      transformed.x += sway; transformed.z += sway * 0.5;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
      normal = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);`);
  };
  const tufts = [];
  const nT = mobile ? 5000 : 9000;
  for (let i = 0; i < nT * 4 && tufts.length < nT; i++) {
    const x = -70 + rand() * 150, z = 30 - rand() * 240;
    const sf = C.sdFairway(x, z), sg = C.sdGreen(x, z), sb = C.sdBunker(x, z);
    if (sf < 2.5 || sg < 4 || sb < 0.4 || C.sdTee(x, z) < 0.8 || C.sdPond(x, z) < 1.2) continue;
    const so = C.sdOcean(x, z); if (so < 14) continue;
    // denser near edges of short grass
    const edge = Math.min(sf, sg, sb + 1);
    if (rand() > 0.25 + 0.75 * Math.exp(-edge / 8)) continue;
    tufts.push([x, z]);
  }
  const tuftIM = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
  {
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3();
    tufts.forEach(([x, z], i) => {
      const s = 0.45 + rand() * 0.6;
      qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
      m.compose(new THREE.Vector3(x, course.heightAt(x, z) - 0.02, z), qq, sv.set(s, s * (0.8 + rand() * 0.5), s));
      tuftIM.setMatrixAt(i, m);
    });
  }
  tuftIM.receiveShadow = true; tuftIM.computeBoundingSphere();
  scene.add(tuftIM);

  // ---------- Miami skyline across the bay ----------
  {
    const winTex = windowTexture();
    winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping; winTex.repeat.set(1, 2); winTex.anisotropy = 4;
    const bmat = new THREE.MeshStandardMaterial({ color: 0x8a5a92, roughness: 0.9, metalness: 0.0, emissive: 0xffd8c0, emissiveMap: winTex, emissiveIntensity: 0.55, fog: false });
    bmat.envMapIntensity = 0.4;
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const N = 46;
    const im = new THREE.InstancedMesh(geo, bmat, N);
    const neonGeo = new THREE.BoxGeometry(1, 1, 1);
    const neonPink = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.6, 2.4), toneMapped: false, fog: false });
    const neonCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.2, 3.6), toneMapped: false, fog: false });
    const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), sv = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const a = THREE.MathUtils.lerp(0.32, 1.25, i / N + rand() * 0.02);
      const dist = 1300 + rand() * 250 + (i % 3) * 80;
      const x = Math.sin(a) * dist, z = -Math.cos(a) * dist - 80;
      const wdt = 30 + rand() * 45, ht = 45 + Math.pow(rand(), 1.6) * 240 * (1 - Math.abs(i / N - 0.45));
      qq.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a + rand() * 0.3);
      m.compose(new THREE.Vector3(x, C.WATER_LEVEL, z), qq, sv.set(wdt, ht, wdt * (0.6 + rand() * 0.6)));
      im.setMatrixAt(i, m);
      if (rand() < 0.55) {
        const nm = new THREE.Mesh(neonGeo, rand() < 0.5 ? neonPink : neonCyan);
        nm.position.set(x, C.WATER_LEVEL + ht * (rand() < 0.5 ? 1.0 : 0.6), z); nm.quaternion.copy(qq);
        nm.scale.set(wdt * 1.02, 3.0, wdt * 0.9); scene.add(nm);
      }
    }
    im.computeBoundingSphere(); scene.add(im);
  }

  // ---------- flag, pin, cup ----------
  const pinH = course.heightAt(C.PIN.x, C.PIN.z);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 2.3, 8), poleMat);
  pole.position.set(C.PIN.x, pinH + 1.12, C.PIN.z); pole.castShadow = true; scene.add(pole);
  const flagGeo = new THREE.PlaneGeometry(0.8, 0.52, 14, 6); flagGeo.translate(0.4, 0, 0);
  const flagTex = canvasTex(256, 168, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff2f9a'); gr.addColorStop(1, '#ff7a3c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff'; g.font = 'bold 120px Rajdhani, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('1', w / 2, h / 2 + 6);
  });
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7, emissive: 0x551030, emissiveIntensity: 0.4 }));
  flag.position.set(C.PIN.x + 0.012, pinH + 2.0, C.PIN.z); flag.castShadow = true; scene.add(flag);
  const flagBase = flagGeo.attributes.position.array.slice();
  W.flag = flag;
  W.updateFlag = (t, windAng) => {
    const a = flagGeo.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const x = flagBase[i * 3], y = flagBase[i * 3 + 1];
      const k = x / 0.8;
      a.setZ(i, Math.sin(x * 9 - t * 7.5 + y * 2) * 0.07 * k + Math.sin(x * 4 - t * 3.1) * 0.03 * k);
      a.setY(i, y - k * k * 0.04);
    }
    a.needsUpdate = true; flagGeo.computeVertexNormals();
    flag.rotation.y = windAng;
  };
  // cup: dark disc conformed to the green + white liner ring
  const cupGeo = new THREE.CircleGeometry(0.054, 24); cupGeo.rotateX(-Math.PI / 2);
  const cup = new THREE.Mesh(cupGeo, new THREE.MeshBasicMaterial({ color: 0x050505, polygonOffset: true, polygonOffsetFactor: -4 }));
  cup.position.set(C.PIN.x, pinH + 0.004, C.PIN.z); scene.add(cup);
  const n = course.normalAt(C.PIN.x, C.PIN.z); cup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n.x, n.y, n.z));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.054, 0.062, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xdddddd, polygonOffset: true, polygonOffsetFactor: -4 }));
  ring.position.copy(cup.position); ring.quaternion.copy(cup.quaternion); scene.add(ring);

  // tee markers (neon)
  const teeMat = new THREE.MeshStandardMaterial({ color: 0xff3fa4, emissive: 0xff3fa4, emissiveIntensity: 1.5, roughness: 0.3 });
  for (const sx of [-2.6, 2.6]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), teeMat); s.position.set(sx, course.heightAt(sx, -4.0) + 0.08, -4.0); s.castShadow = true; scene.add(s); }

  return W;
}
