import { createHaptics } from './haptics.js';
import { createStats, formatSummary } from './stats.js';
import * as m01 from './01-three-click.js';
import * as m02 from './02-two-tap.js';
import * as m03 from './03-power-ring.js';
import * as m04 from './04-golf-clash.js';
import * as m05 from './05-slingshot.js';
import * as m06 from './06-flick.js';
import * as m07 from './07-double-swipe.js';
import * as m08 from './08-tempo-hold.js';
import * as m09 from './09-rhythm-taps.js';
import * as m10 from './10-arc-trace.js';
import * as m11 from './11-dial.js';
import * as m12 from './12-two-thumb.js';
import * as m13 from './13-clock.js';
import * as m14 from './14-pendulum.js';
import * as m15 from './15-shrink-ring.js';
import * as m16 from './16-sweet-band.js';
import * as m17 from './17-pinch.js';
import * as m18 from './18-fader.js';
import * as m19 from './19-lag.js';
import * as m20 from './20-one-tap.js';

export const METHODS = [m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19, m20];

const ID_KEY = 'vl-swing';
const RAND_KEY = 'vl-swing-random';

function read(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch (_) {}
}

export function createSwingApp({ root, pickBtn, sheet, onStrike, ready }) {
  const feel = createHaptics();
  const stats = createStats();
  const list = sheet.querySelector('#methodList');
  const randomBox = sheet.querySelector('#randomHole');
  const exportBtn = sheet.querySelector('#exportStats');
  let view = null;
  let id = 1;
  let random = read(RAND_KEY) === '1';
  let armed = performance.now();
  randomBox.checked = random;

  function current() { return METHODS[id - 1]; }

  function renderList() {
    list.innerHTML = '';
    for (const m of METHODS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'method' + (!random && m.meta.id === id ? ' on' : '');
      const sum = stats.summary(m.meta.id);
      b.innerHTML = `<b>${m.meta.id}. ${m.meta.name}</b><span>${m.meta.blurb}</span><small>${formatSummary(sum)}</small>`;
      b.addEventListener('click', () => {
        random = false;
        randomBox.checked = false;
        write(RAND_KEY, '0');
        select(m.meta.id, true);
        close();
      });
      list.append(b);
    }
  }

  function label() {
    pickBtn.textContent = random ? 'Swing: Random' : `Swing: ${current().meta.name}`;
  }

  function mount() {
    view?.destroy();
    armed = performance.now();
    view = current().mount({
      root,
      feel,
      emit(strike) {
        if (ready && !ready()) return;
        const ms = performance.now() - armed;
        armed = performance.now();
        feel.pulse([8, 16, 22]);
        onStrike(strike, ms, id);
      },
    });
    label();
  }

  function select(next, save) {
    id = Math.max(1, Math.min(METHODS.length, next | 0));
    if (save) write(ID_KEY, String(id));
    mount();
    if (!sheet.classList.contains('hidden')) renderList();
  }

  function roll() {
    select(1 + Math.floor(Math.random() * METHODS.length), false);
  }

  function open() {
    renderList();
    sheet.classList.remove('hidden');
    root.closest('#hud')?.classList.add('sheet-open');
  }
  function close() {
    sheet.classList.add('hidden');
    root.closest('#hud')?.classList.remove('sheet-open');
  }

  pickBtn.addEventListener('click', () => {
    if (sheet.classList.contains('hidden')) open();
    else close();
  });
  randomBox.addEventListener('change', () => {
    random = randomBox.checked;
    write(RAND_KEY, random ? '1' : '0');
    if (random) roll();
    else {
      write(ID_KEY, String(id));
      label();
      renderList();
    }
  });
  exportBtn.addEventListener('click', async () => {
    const text = JSON.stringify({ randomPerHole: random, methods: stats.exportRows(METHODS) }, null, 2);
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
      ta.remove();
    }
    exportBtn.textContent = copied ? 'Copied' : 'Copy failed';
    setTimeout(() => { exportBtn.textContent = 'Copy stats JSON'; }, 1400);
  });

  const q = new URLSearchParams(location.search).get('swing');
  const urlId = q != null && +q >= 1 && +q <= METHODS.length ? +q : 0;
  if (urlId) select(urlId, true);
  else if (random) roll();
  else {
    const saved = +(read(ID_KEY) || 1);
    select(saved >= 1 && saved <= METHODS.length ? saved : 1, false);
  }

  return {
    stats,
    methods: METHODS,
    tick(dt) { view?.tick?.(dt); },
    reroll() { if (random) roll(); },
    refresh() { if (!sheet.classList.contains('hidden')) renderList(); },
    close,
    get id() { return id; },
    setId(n) {
      random = false;
      randomBox.checked = false;
      write(RAND_KEY, '0');
      select(n, true);
    },
    exportText() {
      return JSON.stringify({ randomPerHole: random, methods: stats.exportRows(METHODS) }, null, 2);
    },
  };
}
