// Flat range plus a launch-monitor panel. Shots use the same engine as the hole.
import { CLUBS, SURF, launchFromDelivery, launchFromSwing, simulate } from './engine.js';

const YD = 1.0936133;

export function createRange(THREE, scene) {
  const origin = { x: 0, z: -4200 };
  const group = new THREE.Group();
  group.visible = false;
  const fair = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 400),
    new THREE.MeshStandardMaterial({ color: 0x3c7a34, roughness: 0.95 }),
  );
  fair.rotation.x = -Math.PI / 2;
  fair.position.set(origin.x, 0, origin.z - 170);
  fair.receiveShadow = true;
  group.add(fair);
  const green = new THREE.Mesh(
    new THREE.CircleGeometry(18, 40),
    new THREE.MeshStandardMaterial({ color: 0x2f9a48, roughness: 0.9 }),
  );
  green.rotation.x = -Math.PI / 2;
  green.position.set(origin.x, 0.02, origin.z - 155);
  group.add(green);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.6 });
  for (const yds of [50, 100, 150, 200, 250]) {
    const z = origin.z - yds / YD;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.12), postMat);
    post.position.set(origin.x + 18, 0.7, z);
    group.add(post);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.28, 0.04), postMat);
    flag.position.set(origin.x + 18.4, 1.25, z);
    group.add(flag);
  }
  scene.add(group);
  const course = {
    waterLevel: -8,
    cup: null,
    bounds: null,
    heightAt: () => 0,
    normalAt: () => ({ x: 0, y: 1, z: 0 }),
    surfaceAt(x, z) {
      const dx = x - origin.x;
      const dz = z - (origin.z - 155);
      if ((dx * dx) / (18 * 18) + (dz * dz) / (20 * 20) < 1) return SURF.GREEN;
      return SURF.FAIRWAY;
    },
  };
  return {
    group, course,
    tee: { x: origin.x, z: origin.z },
    pin: { x: origin.x, z: origin.z - 155 },
  };
}

export function createLab(onStrike) {
  const root = document.createElement('div');
  root.id = 'lab';
  root.className = 'hidden';
  root.innerHTML = `
    <button id="labTab" type="button">Monitor</button>
    <div id="labBody" class="hidden">
      <div id="labRead">Set a strike.</div>
      <canvas id="labPlot" width="280" height="150"></canvas>
      <div id="labSliders"></div>
      <button id="labHit" type="button">Strike with these numbers</button>
      <button id="labClear" type="button">Clear traces</button>
    </div>`;
  document.body.append(root);
  const specs = [
    ['club', 'Club', 2, 0, 6, 1],
    ['speed', 'Club speed', 92, 40, 130, 1],
    ['face', 'Face °', 0, -12, 12, 0.5],
    ['path', 'Path °', 0, -12, 12, 0.5],
    ['attack', 'Attack °', -3.9, -10, 5, 0.1],
    ['loft', 'Loft °', 19.6, 8, 45, 0.1],
    ['impact', 'Toe / heel', 0, -1, 1, 0.1],
    ['wind', 'Wind m/s', 0, 0, 15, 0.5],
    ['windDir', 'Wind °', 0, 0, 360, 5],
    ['temp', 'Temp °C', 20, -5, 40, 1],
    ['alt', 'Altitude m', 0, 0, 2500, 50],
    ['firm', 'Firmness', 0.55, 0, 1, 0.05],
    ['stimp', 'Stimp', 11, 6, 14, 0.5],
  ];
  const sliders = root.querySelector('#labSliders');
  const values = {};
  for (const [id, label, val, min, max, step] of specs) {
    const row = document.createElement('label');
    row.innerHTML = `<span>${label}</span><input id="lab_${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}"><b></b>`;
    sliders.append(row);
    const input = row.querySelector('input');
    const b = row.querySelector('b');
    const show = () => { b.textContent = id === 'club' ? (CLUBS[input.value | 0] || {}).id || '' : input.value; values[id] = +input.value; };
    input.addEventListener('input', show);
    show();
  }
  const rain = document.createElement('label');
  rain.innerHTML = '<span>Rain</span><input id="lab_rain" type="checkbox">';
  sliders.append(rain);
  const plot = root.querySelector('#labPlot');
  const ctx = plot.getContext('2d');
  const traces = [];
  const colors = ['#e8f6ff', '#ffb05a', '#7dffa0', '#ff8ad4', '#ffe14a'];

  function readEnv() {
    const dir = values.windDir * Math.PI / 180;
    return {
      tempC: values.temp, altitudeM: values.alt, humidity: 0.45,
      rain: root.querySelector('#lab_rain').checked,
      firmness: values.firm, stimp: values.stimp,
      wind: { speed: values.wind, dirX: Math.sin(dir), dirZ: -Math.cos(dir), refHeight: 2 },
    };
  }
  function delivery() {
    const club = CLUBS[values.club | 0];
    return {
      club, env: readEnv(),
      launch: launchFromDelivery({
        clubSpeedMph: values.speed, smash: club.smash, dynamicLoft: values.loft,
        attackDeg: values.attack, faceDeg: values.face, pathDeg: values.path,
        impactX: values.impact, aimYaw: 0, lie: SURF.TEE,
      }),
    };
  }
  function draw() {
    const w = plot.width, h = plot.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8,6,16,.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.strokeRect(8, 8, w - 16, h / 2 - 14);
    ctx.strokeRect(8, h / 2 + 4, w - 16, h / 2 - 12);
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = '11px sans-serif';
    ctx.fillText('side', 12, 20);
    ctx.fillText('top', 12, h / 2 + 16);
    let maxX = 50, maxY = 10, maxZ = 10;
    for (const tr of traces) for (const p of tr) {
      maxX = Math.max(maxX, -p.z);
      maxY = Math.max(maxY, p.y);
      maxZ = Math.max(maxZ, Math.abs(p.x));
    }
    const sx = (w - 24) / maxX, sy = (h / 2 - 28) / maxY, sz = (h / 2 - 24) / (maxZ * 2);
    traces.forEach((tr, i) => {
      ctx.strokeStyle = colors[i % colors.length];
      ctx.beginPath();
      tr.forEach((p, k) => {
        const x = 12 + (-p.z) * sx;
        const y = h / 2 - 10 - p.y * sy;
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
      ctx.beginPath();
      tr.forEach((p, k) => {
        const x = w / 2 + p.x * sz;
        const y = h - 10 - (-p.z) * ((h / 2 - 20) / maxX);
        if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      });
      ctx.stroke();
    });
  }
  function strike() {
    const { launch, env, club } = delivery();
    const res = simulate({ heightAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }), surfaceAt: () => SURF.FAIRWAY, waterLevel: -5, cup: null, bounds: null }, { x: 0, y: 0.021, z: 0 }, launch, env);
    traces.push(res.frames.filter((_, i) => i % 3 === 0));
    if (traces.length > 5) traces.shift();
    const m = res.monitor;
    root.querySelector('#labRead').textContent =
      `${m.shape}  ${m.ballSpeedMph.toFixed(0)} mph  ${m.launchDeg.toFixed(1)}°  ${m.spinRpm.toFixed(0)} rpm  axis ${m.spinAxisDeg.toFixed(1)}°\n` +
      `carry ${m.carryYd.toFixed(0)}  total ${m.totalYd.toFixed(0)}  apex ${(m.apexFt).toFixed(0)} ft  land ${m.descentDeg.toFixed(0)}°  offline ${m.offlineYd.toFixed(1)}`;
    draw();
    onStrike({ res, launch, club, env });
  }
  root.querySelector('#labTab').onclick = () => root.querySelector('#labBody').classList.toggle('hidden');
  root.querySelector('#labHit').onclick = strike;
  root.querySelector('#labClear').onclick = () => { traces.length = 0; draw(); };
  return {
    root,
    show() { root.classList.remove('hidden'); },
    hide() { root.classList.add('hidden'); },
    swingLaunch(club, power, faceDeg, pathDeg) {
      return launchFromSwing(club, power, faceDeg, 0, SURF.TEE, { pathDeg });
    },
    env: readEnv,
  };
}
