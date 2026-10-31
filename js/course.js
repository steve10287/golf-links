// Course definition: signed-distance shapes, height field and surface types.
// Pure JS (no three.js) so it can be unit-tested in node.

// ---------- seeded random + simplex noise ----------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const grad3 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
function makeSimplex(seed) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = grad3[perm[ii + perm[jj]] & 7]; t0 *= t0; n0 = t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = grad3[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n1 = t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = grad3[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n2 = t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * (n0 + n1 + n2); // ~[-1,1]
  };
}
const N = makeSimplex(1337);
const N2 = makeSimplex(4242);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
const mix = (a, b, t) => a + (b - a) * t;

function sdEllipse(x, z, cx, cz, rx, rz, ang) {
  let dx = x - cx, dz = z - cz;
  const c = Math.cos(ang), s = Math.sin(ang);
  const px = c * dx - s * dz, pz = s * dx + c * dz;
  const k = Math.hypot(px / rx, pz / rz);
  const len = Math.hypot(px, pz);
  if (k < 1e-6) return -Math.min(rx, rz);
  return (k - 1) * len / k;
}
function sdSegment(x, z, ax, az, bx, bz) {
  const pax = x - ax, paz = z - az, bax = bx - ax, baz = bz - az;
  const h = clamp((pax * bax + paz * baz) / (bax * bax + baz * baz), 0, 1);
  return [Math.hypot(pax - bax * h, paz - baz * h), h];
}
function sdRoundBox(x, z, cx, cz, hx, hz, r) {
  const qx = Math.abs(x - cx) - hx + r, qz = Math.abs(z - cz) - hz + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

// ---------- layout (metres; tee at origin, hole plays toward -Z) ----------
export const WATER_LEVEL = -0.45;
export const TEE = { x: 0, z: 0 };
export const PIN = { x: 4.5, z: -151.5 };
export const DROP_ZONE = { x: 10, z: -96 };
export const PAR = 3;
export const BOUNDS = { minX: -170, maxX: 170, minZ: -330, maxZ: 70 };

const BUNKERS = [
  { cx: 19.5, cz: -142, rx: 6.5, rz: 3.4, a: -0.7 },
  { cx: -11.5, cz: -165.5, rx: 8, rz: 3.3, a: 0.35 },
  { cx: 17, cz: -163, rx: 3.6, rz: 2.6, a: 0.2 },
  { cx: 19, cz: -92, rx: 4.2, rz: 2.8, a: 0.5 },
];

export function sdGreen(x, z) { return sdEllipse(x, z, 3, -151, 13.5, 16.5, 0.28) + N(x * 0.07, z * 0.07) * 1.6; }
export function sdFairway(x, z) {
  const [d, h] = sdSegment(x, z, 3, -40, 4, -140);
  const hw = 11.5 + 3.0 * N(x * 0.03 + 7, z * 0.03) - 3 * (1 - h);
  return d - hw;
}
export function sdPond(x, z) {
  const a = sdEllipse(x, z, -13, -112, 18, 12, 0.45);
  const b = sdEllipse(x, z, -33, -88, 15, 12, -0.25);
  return smin(a, b, 6) + N(x * 0.05 + 3, z * 0.05) * 2.2;
}
export function sdBunker(x, z) {
  let d = 1e9;
  for (const b of BUNKERS) d = Math.min(d, sdEllipse(x, z, b.cx, b.cz, b.rx, b.rz, b.a));
  return d + N2(x * 0.25, z * 0.25) * 0.7;
}
export function sdTee(x, z) { return sdRoundBox(x, z, 0, 0, 5, 7.5, 2); }
export function sdOcean(x, z) {
  const d1 = x - (-82 + 12 * N(3, z * 0.012) + 4 * N(9, z * 0.05));      // west shore
  const d2 = z - (-232 + 14 * N(x * 0.012, 5) + 4 * N(x * 0.05, 1));     // north shore
  const d3 = (150 + 10 * N(7, z * 0.015)) - x;                          // east shore
  const d4 = (55 + 6 * N(x * 0.02, 11)) - z;                            // south shore
  return smin(smin(d1, d2, 25), smin(d3, d4, 25), 25);
}
function beachWidth(x, z) { return 9 + 4 * N(x * 0.03, z * 0.03); }

export function rawHeight(x, z) {
  let h = 0.9 + 1.3 * N(x / 70, z / 70) + 0.45 * N(x / 22 + 9, z / 22) + 0.08 * N(x / 6, z / 6);
  const sf = sdFairway(x, z);
  const fw = smoothstep(8, -2, sf);
  h = mix(h, 0.55 + 0.55 * N(x / 45, z / 45) + 0.06 * N(x / 9, z / 9), fw * 0.75);
  const sg = sdGreen(x, z);
  // collar mounds around the green, taller at back
  const back = smoothstep(-140, -165, z) * 0.7 + 0.3;
  h += 1.7 * back * Math.exp(-((sg - 6) ** 2) / 14);
  const gh = 0.75 + 0.024 * (-z - 151) + 0.011 * (3 - x) + 0.09 * Math.sin(x * 0.27 + 1) * Math.cos(z * 0.21);
  h = mix(h, gh, smoothstep(3.5, -1.2, sg));
  // tee box raised
  h = mix(h, 1.9, smoothstep(2.5, -0.5, sdTee(x, z)));
  // bunkers
  const sb = sdBunker(x, z);
  h -= 0.8 * smoothstep(0.6, -2.0, sb);
  h += 0.22 * Math.exp(-((sb - 0.7) ** 2) / 0.35);
  // pond
  const hp = Math.max(WATER_LEVEL - 0.06 + sdPond(x, z) * 0.3, WATER_LEVEL - 2.4);
  h = smin(h, hp, 0.6);
  // ocean & beach
  const so = sdOcean(x, z);
  const ho = Math.max(WATER_LEVEL - 0.05 + so * 0.11, WATER_LEVEL - 5);
  h = smin(h, ho, 1.2);
  return h;
}

export const SURF = { WATER: 0, GREEN: 1, FRINGE: 2, FAIRWAY: 3, ROUGH: 4, BUNKER: 5, TEE: 6, SAND: 7 };
export const SURF_NAME = ['Water', 'Green', 'Fringe', 'Fairway', 'Rough', 'Bunker', 'Tee', 'Beach sand'];

// Height grid (render mesh + physics share it so the ball sits exactly on the mesh)
export function buildGrid(nx = 300, nz = 352) {
  const w = BOUNDS.maxX - BOUNDS.minX, d = BOUNDS.maxZ - BOUNDS.minZ;
  const heights = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) {
    const z = BOUNDS.minZ + (j / nz) * d;
    for (let i = 0; i <= nx; i++) {
      const x = BOUNDS.minX + (i / nx) * w;
      heights[j * (nx + 1) + i] = rawHeight(x, z);
    }
  }
  return { nx, nz, w, d, heights };
}

export function makeCourse(grid) {
  const { nx, nz, w, d, heights } = grid;
  const dx = w / nx, dz = d / nz;
  function heightAt(x, z) {
    let fx = (x - BOUNDS.minX) / dx, fz = (z - BOUNDS.minZ) / dz;
    fx = clamp(fx, 0, nx - 1e-4); fz = clamp(fz, 0, nz - 1e-4);
    const i = Math.floor(fx), j = Math.floor(fz);
    const u = fx - i, v = fz - j;
    const r = nx + 1;
    const h00 = heights[j * r + i], h10 = heights[j * r + i + 1], h01 = heights[(j + 1) * r + i], h11 = heights[(j + 1) * r + i + 1];
    return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v;
  }
  function normalAt(x, z) {
    const e = 0.25;
    const hx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e);
    const hz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    const l = Math.hypot(hx, 1, hz);
    return { x: -hx / l, y: 1 / l, z: -hz / l };
  }
  function surfaceAt(x, z) {
    if (x < BOUNDS.minX + 2 || x > BOUNDS.maxX - 2 || z < BOUNDS.minZ + 2 || z > BOUNDS.maxZ - 2) return SURF.WATER;
    const h = heightAt(x, z);
    if (h < WATER_LEVEL) return SURF.WATER;
    if (sdBunker(x, z) < 0) return SURF.BUNKER;
    const sg = sdGreen(x, z);
    if (sg < 0) return SURF.GREEN;
    if (sg < 1.6) return SURF.FRINGE;
    if (sdTee(x, z) < 0) return SURF.TEE;
    if (sdOcean(x, z) < beachWidth(x, z)) return SURF.SAND;
    if (sdFairway(x, z) < 0) return SURF.FAIRWAY;
    return SURF.ROUGH;
  }
  function isPondWater(x, z) { return sdPond(x, z) < sdOcean(x, z); }
  return { heightAt, normalAt, surfaceAt, isPondWater, grid };
}

// Surface mask RGBA (R green, G fringe/tee, B fairway, A sand) for the terrain shader
export function buildMask(size = 1024) {
  const data = new Uint8Array(size * size * 4);
  const w = BOUNDS.maxX - BOUNDS.minX, d = BOUNDS.maxZ - BOUNDS.minZ;
  for (let j = 0; j < size; j++) {
    const z = BOUNDS.minZ + ((j + 0.5) / size) * d;
    for (let i = 0; i < size; i++) {
      const x = BOUNDS.minX + ((i + 0.5) / size) * w;
      const o = (j * size + i) * 4;
      const so = sdOcean(x, z);
      let g = 0, f = 0, fw = 0, s = 0;
      if (so > -2) {
        const sg = sdGreen(x, z);
        g = smoothstep(0.2, -0.2, sg);
        f = smoothstep(1.8, 1.35, sg);
        fw = Math.max(smoothstep(0.35, -0.35, sdFairway(x, z)), smoothstep(0.25, -0.25, sdTee(x, z)));
        s = Math.max(smoothstep(0.15, -0.25, sdBunker(x, z)), smoothstep(0.8, -0.8, so - beachWidth(x, z)));
      } else s = 1;
      data[o] = g * 255; data[o + 1] = f * 255; data[o + 2] = fw * 255; data[o + 3] = s * 255;
    }
  }
  return { data, size };
}
