// Distance, stroke, club, wind. Restart is the only other control.
export function createHud(root) {
  root.innerHTML = `
    <div id="read"><b id="toPin">—</b><span id="stroke">Stroke 1</span></div>
    <div id="wind"><i id="windArrow">➤</i><span id="windVal">0</span></div>
    <button id="restart" type="button">Restart</button>
    <div id="club">
      <button id="clubPrev" type="button">‹</button>
      <div id="clubName"><b id="clubId">7i</b><span id="clubCarry"></span></div>
      <button id="clubNext" type="button">›</button>
    </div>
    <div id="note" class="hidden"></div>
    <div id="swing"><div id="guide"></div><div id="meter"></div><div id="dot"></div></div>`;
  let noteT = 0;
  return {
    swingEl: root.querySelector('#swing'),
    els: {
      toPin: root.querySelector('#toPin'),
      stroke: root.querySelector('#stroke'),
      windArrow: root.querySelector('#windArrow'),
      windVal: root.querySelector('#windVal'),
      clubId: root.querySelector('#clubId'),
      clubCarry: root.querySelector('#clubCarry'),
      note: root.querySelector('#note'),
      dot: root.querySelector('#dot'),
      meter: root.querySelector('#meter'),
      restart: root.querySelector('#restart'),
      prev: root.querySelector('#clubPrev'),
      next: root.querySelector('#clubNext'),
    },
    note(text) {
      const n = root.querySelector('#note');
      n.textContent = text;
      n.classList.remove('hidden');
      clearTimeout(noteT);
      noteT = setTimeout(() => n.classList.add('hidden'), 2200);
    },
    hideNote() {
      clearTimeout(noteT);
      root.querySelector('#note').classList.add('hidden');
    },
  };
}
