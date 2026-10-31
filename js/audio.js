// Small WebAudio bed: strike, landing, breeze, birds, waves, applause.
// No sample files. A mute toggle lives in settings.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let started = false;
  const beds = [];

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }

  function noise(seconds, color = 'white') {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'brown') {
        b0 = (b0 + 0.02 * w) / 1.02;
        d[i] = b0 * 3.5;
      } else if (color === 'pink') {
        b0 = 0.997 * b0 + 0.029 * w;
        b1 = 0.985 * b1 + 0.032 * w;
        d[i] = b0 + b1;
      } else d[i] = w;
    }
    return buf;
  }

  function envGain(t, a, h, r, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(peak * 0.6, t + a + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + r);
    return g;
  }

  function unlock() {
    ensure();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) {
      started = true;
      startBeds();
    }
  }

  function startBeds() {
    if (!ctx || beds.length) return;
    const t = ctx.currentTime;
    // breeze: filtered noise loop
    const breeze = ctx.createBufferSource();
    breeze.buffer = noise(2.5, 'pink');
    breeze.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = 'lowpass';
    bf.frequency.value = 700;
    const bg = ctx.createGain();
    bg.gain.value = 0.045;
    breeze.connect(bf); bf.connect(bg); bg.connect(master);
    breeze.start(t);
    // distant waves
    const wave = ctx.createBufferSource();
    wave.buffer = noise(3.2, 'brown');
    wave.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'lowpass';
    wf.frequency.value = 280;
    const wg = ctx.createGain();
    wg.gain.value = 0.06;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG); lfoG.connect(wg.gain);
    wave.connect(wf); wf.connect(wg); wg.connect(master);
    wave.start(t); lfo.start(t);
    beds.push(breeze, wave, lfo);
    // occasional bird
    const chirp = () => {
      if (!ctx || muted) return;
      const now = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(1800 + Math.random() * 900, now);
      o.frequency.exponentialRampToValueAtTime(2400 + Math.random() * 600, now + 0.08);
      const g = envGain(now, 0.01, 0.04, 0.12, 0.04);
      o.connect(g); g.connect(master);
      o.start(now); o.stop(now + 0.2);
      setTimeout(chirp, 4000 + Math.random() * 7000);
    };
    setTimeout(chirp, 1500);
  }

  function setMuted(on) {
    muted = on;
    ensure();
    if (master) master.gain.value = on ? 0 : 0.7;
  }

  function strike(pure) {
    unlock();
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(pure ? 220 : 140, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
    const g = envGain(t, 0.004, 0.02, 0.12, pure ? 0.45 : 0.28);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.2);
    const src = ctx.createBufferSource();
    src.buffer = noise(0.12, 'white');
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = pure ? 1200 : 600;
    const ng = envGain(t, 0.002, 0.01, 0.08, pure ? 0.35 : 0.2);
    src.connect(f); f.connect(ng); ng.connect(master);
    src.start(t); src.stop(t + 0.12);
  }

  function land(surface) {
    unlock();
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const soft = surface === 'green' || surface === 'fringe';
    const sand = surface === 'bunker' || surface === 'sand';
    const water = surface === 'water';
    const src = ctx.createBufferSource();
    src.buffer = noise(water ? 0.45 : 0.2, water ? 'brown' : 'white');
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = water ? 500 : sand ? 900 : soft ? 1400 : 2200;
    const g = envGain(t, 0.005, water ? 0.12 : 0.02, water ? 0.3 : 0.1, water ? 0.22 : soft ? 0.16 : 0.2);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + (water ? 0.45 : 0.2));
  }

  function applause(big) {
    unlock();
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise(big ? 1.6 : 0.9, 'white');
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.Q.value = 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(big ? 0.28 : 0.14, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.6 : 0.9));
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + (big ? 1.6 : 0.9));
  }

  return { unlock, setMuted, strike, land, applause, get muted() { return muted; } };
}
