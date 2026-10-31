// Local A/B log. Averages are over full swings. Putts count toward
// shots, good strikes, and time, and they stay out of the carry average.
const KEY = 'vl-swing-stats';

function blank() {
  return { shots: 0, full: 0, carryAbs: 0, lateralAbs: 0, good: 0, timeMs: 0 };
}

export function createStats(storage) {
  const mem = {};
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
  });

  function load() {
    try {
      const raw = store.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }
  function save(all) {
    try { store.setItem(KEY, JSON.stringify(all)); } catch (_) {}
  }

  return {
    record(id, shot) {
      const all = load();
      const s = all[id] || blank();
      s.shots += 1;
      s.timeMs += shot.ms || 0;
      if (shot.grade === 'perfect' || shot.grade === 'good') s.good += 1;
      if (!shot.putt) {
        s.full += 1;
        s.carryAbs += Math.abs((shot.carryYd || 0) - (shot.stockYd || 0));
        s.lateralAbs += Math.abs(shot.offlineYd || 0);
      }
      all[id] = s;
      save(all);
    },
    summary(id) {
      const s = load()[id];
      if (!s || !s.shots) return null;
      return {
        shots: s.shots,
        avgCarryErrorYd: s.full ? s.carryAbs / s.full : null,
        avgLateralYd: s.full ? s.lateralAbs / s.full : null,
        goodPct: (100 * s.good) / s.shots,
        avgTimeSec: s.timeMs / s.shots / 1000,
      };
    },
    exportRows(methods) {
      const all = load();
      const rows = {};
      for (const m of methods) {
        const s = all[m.meta.id];
        rows[m.meta.id] = {
          name: m.meta.name,
          shots: s ? s.shots : 0,
          avgCarryErrorYd: s && s.full ? +(s.carryAbs / s.full).toFixed(2) : null,
          avgLateralYd: s && s.full ? +(s.lateralAbs / s.full).toFixed(2) : null,
          goodPct: s && s.shots ? +((100 * s.good) / s.shots).toFixed(1) : null,
          avgTimeSec: s && s.shots ? +(s.timeMs / s.shots / 1000).toFixed(2) : null,
        };
      }
      return rows;
    },
  };
}

export function formatSummary(s) {
  if (!s) return 'No shots yet';
  const carry = s.avgCarryErrorYd == null ? '—' : `carry ±${s.avgCarryErrorYd.toFixed(1)} yd`;
  const side = s.avgLateralYd == null ? '—' : `side ${s.avgLateralYd.toFixed(1)} yd`;
  return `${s.shots} shots · ${carry} · ${side} · ${s.goodPct.toFixed(0)}% good · ${s.avgTimeSec.toFixed(1)}s`;
}
