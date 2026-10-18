// Floating, collapsible control panel for tuning the prototype: a Motion tab for the three
// interactive components and a Graphics tab for how the strings, paper tear, member glow, dialog
// box and final-scene lights look. Every change writes to Tuning.live, which the components read
// as they move or redraw, and redraws the panel's own mini-previews. "Try it" jumps the prototype
// to that step so it can be felt directly.
(() => {
  "use strict";
  const T = window.Tuning;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (v, f) => (f.type === 'color' ? v : f.type === 'select' ? v : f.step < 1 ? (+v).toFixed(1) : String(Math.round(v)));
  const withUnit = (v, f) => (f.unit ? `${fmt(v, f)} ${f.unit}` : fmt(v, f));
  const TABS = { motion: 'Motion', graphics: 'Graphics', transitions: 'Transitions' };

  /* ---------- markup ---------- */
  function field(g, k, f) {
    const id = `tune-${g}-${k}`;
    if (f.type === 'color') return `
            <div class="tune-row tune-row-inline">
              <label for="${id}">${f.label}</label>
              <div class="tune-ctl">
                <output for="${id}"></output>
                <input type="color" id="${id}" data-group="${g}" data-key="${k}" title="${f.label}">
              </div>
            </div>`;
    if (f.type === 'select') return `
            <div class="tune-row">
              <label for="${id}">${f.label}<span class="tune-range">${f.options.length} options</span></label>
              <div class="tune-ctl">
                <select id="${id}" data-group="${g}" data-key="${k}" title="${f.hint || ''}">
                  ${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}
                </select>
              </div>
            </div>`;
    return `
            <div class="tune-row">
              <label for="${id}">${f.label}<span class="tune-range">${f.min}–${f.max}${f.unit ? ' ' + f.unit : ''}</span></label>
              <div class="tune-ctl">
                <input type="range" id="${id}" data-group="${g}" data-key="${k}" min="${f.min}" max="${f.max}" step="${f.step}" title="${f.hint}">
                <output for="${id}"></output>
              </div>
            </div>`;
  }
  const section = (g, sec) => `
        <section class="tune-sec" data-group="${g}">
          <div class="tune-sec-head">
            <h3>${sec.title}</h3>
            <div class="tune-sec-btns">
              ${g === 'stringsLook' ? '<button type="button" class="tune-try" id="tune-hear">Hear chord</button>' : ''}
              <button type="button" class="tune-try" data-step="${sec.step}">Try it</button>
            </div>
          </div>
          ${g === 'glow'
            ? `<div class="tune-preview tune-glow-box"><img class="tune-glow-demo" src="assets/images/band-member-0.svg" alt="" draggable="false"></div>`
            : `<canvas class="tune-preview" data-group="${g}" aria-label="${sec.title} preview"></canvas>`}
          ${g === 'stringsLook' ? '<p class="tune-notes" aria-live="polite"></p>' : ''}
          ${Object.entries(sec.fields).map(([k, f]) => field(g, k, f)).join('')}
          <div class="tune-row">
            <span class="tune-label">Motion${sec.motion !== g ? `<span class="tune-range">shared with ${T.SCHEMA[sec.motion].title} motion</span>` : ''}</span>
            <div class="tune-chips" role="radiogroup" aria-label="${sec.title} motion">
              ${T.MOTIONS.map(m => `<button type="button" role="radio" class="tune-chip" data-group="${sec.motion}" data-motion="${m}">${m}</button>`).join('')}
            </div>
          </div>
        </section>`;
  const panel = document.createElement('aside');
  panel.id = 'tune';
  panel.setAttribute('aria-label', 'Prototype controls');
  panel.innerHTML = `
    <div class="tune-head">
      <h2>Controls</h2>
      <button type="button" class="tune-toggle" aria-expanded="true" aria-controls="tune-body" title="Collapse panel">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="tune-body" id="tune-body">
      <div class="tune-tabs" role="tablist" aria-label="Control groups">
        ${Object.entries(TABS).map(([t, name]) => `<button type="button" role="tab" class="tune-tab" id="tune-tab-${t}" data-tab="${t}" aria-controls="tune-pane-${t}">${name}</button>`).join('')}
      </div>
      ${Object.keys(TABS).map(t => `
      <div class="tune-pane" id="tune-pane-${t}" role="tabpanel" aria-labelledby="tune-tab-${t}" data-tab="${t}">
        ${Object.entries(T.SCHEMA).filter(([, sec]) => sec.tab === t).map(([g, sec]) => section(g, sec)).join('')}
      </div>`).join('')}
      <div class="tune-actions">
        <button type="button" class="tune-btn" id="tune-restore">Restore defaults</button>
        <button type="button" class="tune-btn is-primary" id="tune-copy">Copy settings</button>
      </div>
      <p class="tune-status" role="status" aria-live="polite"></p>
      <textarea class="tune-copytext" id="tune-copytext" readonly hidden aria-label="Settings to copy"></textarea>
    </div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('.tune-body'), status = panel.querySelector('.tune-status');

  /* ---------- collapse and tab (remembered per viewer) ---------- */
  const toggle = panel.querySelector('.tune-toggle');
  function setCollapsed(c) {
    panel.classList.toggle('is-collapsed', c);
    toggle.setAttribute('aria-expanded', String(!c));
    toggle.title = c ? 'Open controls' : 'Collapse panel';
    try { localStorage.setItem('tune-collapsed', c ? '1' : '0'); } catch (e) {}
  }
  toggle.addEventListener('click', () => setCollapsed(!panel.classList.contains('is-collapsed')));
  try { if (localStorage.getItem('tune-collapsed') === '1') setCollapsed(true); } catch (e) {}
  let tab = 'motion';
  function setTab(t) {
    tab = t;
    panel.querySelectorAll('.tune-tab').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    panel.querySelectorAll('.tune-pane').forEach(p => { p.hidden = p.dataset.tab !== t; });
    try { localStorage.setItem('tune-tab', t); } catch (e) {}
  }
  panel.querySelectorAll('.tune-tab').forEach(b => {
    b.addEventListener('click', () => setTab(b.dataset.tab));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const ts = Object.keys(TABS), n = ts[(ts.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : ts.length - 1)) % ts.length];
      setTab(n); panel.querySelector(`#tune-tab-${n}`).focus();
    });
  });
  try { const t = localStorage.getItem('tune-tab'); setTab(TABS[t] ? t : 'motion'); } catch (e) { setTab('motion'); }

  /* ---------- controls ⇄ Tuning.live ---------- */
  const inputs = [...panel.querySelectorAll('input[data-key], select[data-key]')];
  const chips = [...panel.querySelectorAll('.tune-chip')];
  const notes = panel.querySelector('.tune-notes');
  function sync() {
    inputs.forEach(i => {
      const g = i.dataset.group, f = T.SCHEMA[g].fields[i.dataset.key], v = T.live[g][i.dataset.key];
      i.value = v;
      const changed = v !== T.SAVED[g][i.dataset.key];
      i.classList.toggle('is-changed', changed);
      const out = i.parentElement.querySelector('output');
      if (out) out.textContent = withUnit(v, f);
      if (i.type === 'range') i.style.setProperty('--p', ((v - f.min) / (f.max - f.min) * 100).toFixed(1) + '%');
      if (out) out.classList.toggle('is-changed', changed);
    });
    chips.forEach(c => {
      const on = T.live[c.dataset.group].motion === c.dataset.motion;
      c.classList.toggle('is-on', on); c.setAttribute('aria-checked', String(on));
    });
    const L = T.live.stringsLook;
    notes.textContent = T.NOTES[L.chord].slice(0, L.count).join(' · ');
  }
  // restart every preview that shows this group (motion groups are shared between sections)
  const restartFor = grp => Object.entries(T.SCHEMA).forEach(([g, sec]) => { if (g === grp || sec.motion === grp) restartPreview(g); });
  inputs.forEach(i => i.addEventListener('input', () => {
    const f = T.SCHEMA[i.dataset.group].fields[i.dataset.key];
    T.set(i.dataset.group, i.dataset.key, f.type ? i.value : +i.value); sync(); restartFor(i.dataset.group);
  }));
  chips.forEach(c => c.addEventListener('click', () => {
    T.set(c.dataset.group, 'motion', c.dataset.motion); sync(); restartFor(c.dataset.group);
  }));
  panel.querySelectorAll('.tune-try[data-step]').forEach(b => b.addEventListener('click', () => window.Sequence && Sequence.jump(b.dataset.step)));
  panel.querySelector('#tune-hear').addEventListener('click', () => window.Sequence && Sequence.strumChord());
  panel.querySelector('#tune-restore').addEventListener('click', () => {
    T.restore(); sync(); Object.keys(T.SCHEMA).forEach(restartPreview);
    say('Restored the saved defaults.');
  });

  /* ---------- copy settings ---------- */
  function settingsText() {
    const lines = [];
    for (const t of Object.keys(TABS)) {
      lines.push(`${TABS[t].toUpperCase()}`, '');
      for (const [g, sec] of Object.entries(T.SCHEMA)) {
        if (sec.tab !== t) continue;
        lines.push(`${sec.title} (${g})`);
        for (const [k, f] of Object.entries(sec.fields)) lines.push(`- ${f.label}: ${withUnit(T.live[g][k], f)}`);
        // a shared motion curve is listed once, under the section that owns it
        if (sec.motion === g) lines.push(`- Motion: ${T.live[g].motion}`);
        lines.push('');
      }
    }
    lines.push('Apply these values as the prototype’s saved defaults. Retain the panel code for later adjustments. Commit and push the changes.');
    return lines.join('\n');
  }
  let sayTimer = 0;
  function say(msg) { status.textContent = msg; clearTimeout(sayTimer); sayTimer = setTimeout(() => { status.textContent = ''; }, 4000); }
  panel.querySelector('#tune-copy').addEventListener('click', () => {
    const text = settingsText(), box = panel.querySelector('#tune-copytext');
    const fallback = () => {
      box.value = text; box.hidden = false; box.focus(); box.select();
      say('Copying isn’t allowed here. The settings are selected below; press Ctrl+C (⌘C) to copy them.');
    };
    try {
      navigator.clipboard.writeText(text).then(() => { box.hidden = true; say('Copied the settings and instruction.'); }, fallback);
    } catch (e) { fallback(); }
  });

  /* ---------- mini previews ---------- */
  const cvs = Object.fromEntries([...panel.querySelectorAll('canvas.tune-preview')].map(c => [c.dataset.group, c]));
  const t0 = {};
  function restartPreview(g) { t0[g] = performance.now(); }
  Object.keys(T.SCHEMA).forEach(restartPreview);
  function fitCanvas(c) {
    const r = c.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
    return [g, r.width, r.height];
  }
  const css = getComputedStyle(document.documentElement);
  const col = name => css.getPropertyValue(name).trim();

  // play key: presses over the holding duration, rests, rebounds over the rebound duration
  function drawKey(now) {
    const [g, w, h] = fitCanvas(cvs.key), K = T.live.key, E = T.ease('key');
    const press = reduce ? 400 : K.hold, hold = 450, reb = K.rebound, rest = 700;
    let t = (now - t0.key) % (press + hold + reb + rest), depth, label;
    if (t < press) { depth = E(t / press); label = 'pressing'; }
    else if ((t -= press) < hold) { depth = 1; label = 'held'; }
    else if ((t -= hold) < reb) { depth = 1 - E(t / reb); label = 'rebound'; }
    else { depth = 0; label = 'rest'; }
    g.clearRect(0, 0, w, h);
    const px = w / 2 - 18, top = 16, scale = 1.6, d = K.travel * scale * Math.max(-.3, Math.min(1.25, depth));
    // metal panel and the slot the key sits in
    g.fillStyle = col('--tune-metal'); g.fillRect(px - 26, 8, 88, h - 16);
    g.fillStyle = '#0a0507'; g.fillRect(px, top, 36, 52 + K.travel * scale);
    // key cap: light plastic with the dark window, sinking by the travel distance
    const grd = g.createLinearGradient(0, top + d, 0, top + d + 52);
    grd.addColorStop(0, '#f1f1f1'); grd.addColorStop(1, '#a5a5a5');
    g.fillStyle = grd; g.fillRect(px, top + Math.max(-6, d), 36, 52);
    g.fillStyle = '#1d1a1a'; g.fillRect(px, top + Math.max(-6, d) + 30, 36, 22);
    g.fillStyle = '#3a3535'; g.fillRect(px + 8, top + Math.max(-6, d) + 35, 20, 13);
    // travel scale
    g.strokeStyle = col('--tune-dim'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(px + 52, top); g.lineTo(px + 52, top + K.travel * scale); g.stroke();
    g.fillStyle = col('--tune-ink'); g.font = '11px Raleway, sans-serif'; g.textAlign = 'left';
    g.fillText(`${K.travel} px`, px + 58, top + 9);
    g.fillStyle = col('--tune-dim'); g.fillText(label, 10, h - 10);
  }

  // strings: one is pulled to the maximum, released, and fades over the decay time
  function drawStrings(now) {
    const [g, w, h] = fitCanvas(cvs.strings), S = T.live.strings, E = T.ease('strings');
    const pull = 450, decay = S.decay * 1000, rest = 500;
    const t = (now - t0.strings) % (pull + decay + rest);
    g.clearRect(0, 0, w, h);
    const x0 = 14, x1 = w - 14, ys = [h * .3, h * .52, h * .74], maxPx = S.maxPull / 140 * h * .42;
    ys.forEach((y, i) => {
      g.beginPath();
      for (let k = 0; k <= 60; k++) {
        const u = k / 60, x = x0 + (x1 - x0) * u;
        let off = 0;
        if (i === 1) {
          if (t < pull) { const p = E(t / pull), grab = .42; off = maxPx * p * (u < grab ? u / grab : (1 - u) / (1 - grab)); }
          else if (t < pull + decay) {
            const r = (t - pull) / decay, env = (1 - E(r)) * S.amplitude / 100;
            off = maxPx * env * Math.sin(Math.PI * u) * Math.cos((t - pull) / 1000 * Math.PI * 2 * 7);
          }
        }
        k ? g.lineTo(x, y + off) : g.moveTo(x, y + off);
      }
      g.strokeStyle = i === 1 ? col('--tune-pink') : col('--tune-string'); g.lineWidth = i === 1 ? 2 : 1.4;
      g.shadowColor = i === 1 ? col('--tune-pink') : 'transparent'; g.shadowBlur = i === 1 ? 6 : 0;
      g.stroke(); g.shadowBlur = 0;
    });
    g.fillStyle = col('--tune-dim'); g.font = '11px Raleway, sans-serif';
    g.fillText(t < pull ? 'pulling' : t < pull + decay ? `vibrating · ${((t - pull) / 1000).toFixed(1)} s` : 'at rest', 10, h - 8);
  }

  // paper: a torn edge (roughness) and a flap that lifts and settles back, casting its shadow
  const tearNoise = Array.from({ length: 80 }, (_, i) => Math.sin(i * 12.9898) * 43758.5453 % 1);
  function drawPaper(now) {
    const [g, w, h] = fitCanvas(cvs.paper), P = T.live.paper, E = T.ease('paper');
    const lift = 650, hold = 300, settle = 700, rest = 500;
    let t = (now - t0.paper) % (lift + hold + settle + rest), fold;
    if (t < lift) fold = E(t / lift);
    else if ((t -= lift) < hold) fold = 1;
    else if ((t -= hold) < settle) fold = 1 - E(t / settle);
    else fold = 0;
    g.clearRect(0, 0, w, h);
    // what shows through the hole
    const sky = g.createLinearGradient(0, 0, w, 0); sky.addColorStop(0, '#2cb3de'); sky.addColorStop(1, '#e8248c');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // the torn edge: jagged by roughness, with a white fibrous rim
    const r = P.roughness / 100, edge = [];
    for (let i = 0; i < tearNoise.length; i++) {
      const x = i / (tearNoise.length - 1) * w;
      edge.push([x, h * .52 + (Math.abs(tearNoise[i]) - .5) * 18 * r + Math.sin(i * .7) * 4 * r]);
    }
    const paperPath = () => { g.beginPath(); g.moveTo(0, h); edge.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(w, h); g.closePath(); };
    g.save(); paperPath(); g.clip();
    g.fillStyle = col('--tune-paper'); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.05)';
    for (let i = 0; i < 160; i++) g.fillRect((i * 37) % w, h * .5 + (i * 53) % (h * .5), 1.2, 1.2);
    g.restore();
    g.beginPath(); edge.forEach(([x, y], i) => i ? g.lineTo(x, y + 1.5 + 2 * r) : g.moveTo(x, y + 1.5 + 2 * r));
    g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2.5 + 1.5 * r; g.stroke();
    // the curled flap and its shadow
    const fx = w * .62, fw = 64, curl = 8 + 30 * fold, sh = P.shadow / 100;
    g.save();
    g.shadowColor = `rgba(0,0,0,${sh})`; g.shadowBlur = (6 + 12 * fold) * (.4 + sh); g.shadowOffsetY = 3 + 6 * fold;
    g.beginPath(); g.moveTo(fx - fw / 2, h * .52); g.quadraticCurveTo(fx, h * .52 - curl * 1.2, fx + fw / 2, h * .52);
    g.lineTo(fx + fw / 2 - 6, h * .52 - curl); g.lineTo(fx - fw / 2 + 6, h * .52 - curl); g.closePath();
    const fg = g.createLinearGradient(0, h * .52, 0, h * .52 - curl); fg.addColorStop(0, '#a9a9a9'); fg.addColorStop(1, '#efefef');
    g.fillStyle = fg; g.fill(); g.restore();
    // drag distance needed, against the full range
    const fd = T.SCHEMA.paper.fields.tearDistance, frac = (P.tearDistance - fd.min) / (fd.max - fd.min);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(10, h - 12, w - 20, 4);
    g.fillStyle = col('--tune-pink'); g.fillRect(10, h - 12, (w - 20) * (.08 + .92 * frac), 4);
    g.fillStyle = '#fff'; g.font = '11px Raleway, sans-serif'; g.fillText(`pull ${P.tearDistance} px to open`, 10, 16);
  }

  /* graphics previews */
  const mix = (a, b, u) => {
    const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
    const c = s => Math.round(((p >> s) & 255) * (1 - u) + ((q >> s) & 255) * u);
    return `rgb(${c(16)},${c(8)},${c(0)})`;
  };

  // strings: the drawn strings at their length, width and color, strummed over and over
  function drawStringsLook(now) {
    const [g, w, h] = fitCanvas(cvs.stringsLook), L = T.live.stringsLook, S = T.live.strings;
    const notesHz = T.CHORDS[L.chord], cycle = Math.max(1600, S.decay * 600), t = (now - t0.stringsLook) % cycle;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#3a2418'; g.fillRect(0, 10, w, h - 20); // the neck
    const span = (w - 60) * L.length / 100, x0 = 44 + (w - 60 - span) / 2, x1 = x0 + span;
    const base = [2.6, 2.2, 1.9, 1.5, 1.2, 1];
    for (let j = 0; j < L.count; j++) {
      const y = h - 18 - j * (h - 36) / 5, start = j * 40, age = (t - start) / 1000;
      const env = age > 0 ? Math.exp(-age * 4.6 / S.decay) * S.amplitude / 100 : 0;
      g.beginPath();
      for (let k = 0; k <= 50; k++) {
        const u = k / 50, x = x0 + (x1 - x0) * u;
        const off = reduce ? 0 : 3.5 * env * Math.sin(Math.PI * u) * Math.sin(age * notesHz[j] / 6);
        k ? g.lineTo(x, y + off) : g.moveTo(x, y + off);
      }
      g.strokeStyle = T.stringColor(j); g.lineWidth = base[j] * L.width / 100; g.stroke();
      g.fillStyle = col('--tune-dim'); g.font = '10px Raleway, sans-serif'; g.textAlign = 'left';
      g.fillText(T.NOTES[L.chord][j], 8, y + 3);
    }
  }

  // paper tear: the torn rim and its loose fibres, swaying a little
  const fibreSeed = Array.from({ length: 200 }, (_, i) => [Math.abs(Math.sin(i * 7.31) * 9301 % 1), Math.abs(Math.sin(i * 3.17) * 4973 % 1)]);
  function drawPaperLook(now) {
    const [g, w, h] = fitCanvas(cvs.paperLook), P = T.live.paperLook, E = T.ease('paper');
    g.clearRect(0, 0, w, h);
    const sky = g.createLinearGradient(0, 0, w, 0); sky.addColorStop(0, '#2cb3de'); sky.addColorStop(1, '#e8248c');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    const edgeY = x => h * .55 + Math.sin(x * .09) * 4 + Math.sin(x * .23) * 2.5;
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) g.lineTo(x, edgeY(x));
    g.lineTo(w, h); g.closePath();
    g.fillStyle = col('--tune-paper'); g.fill();
    g.beginPath(); for (let x = 0; x <= w; x += 4) x ? g.lineTo(x, edgeY(x) + 1.5) : g.moveTo(x, edgeY(x) + 1.5);
    g.strokeStyle = T.rgba(P.paperColor, .95); g.lineWidth = 4; g.stroke();
    // the panel shows the fibres at their real pixel size, a share of them across this strip
    const n = Math.round(P.fibres * w / 990 * 2.5), sway = reduce ? 0 : Math.sin((now - t0.paperLook) / 700);
    g.strokeStyle = P.fibreColor; g.lineWidth = P.fibreWidth; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const [a, b] = fibreSeed[i], x = a * w, y = edgeY(x), len = P.fibreLength * (.5 + b);
      const bend = E(.5 + .5 * sway * (b - .5));
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + (b - .5) * len, y - len * .6, x + (bend - .5) * len * 1.2, y - len);
      g.stroke();
    }
    g.lineCap = 'butt';
    g.fillStyle = '#fff'; g.font = '11px Raleway, sans-serif'; g.textAlign = 'left';
    g.fillText(`${P.fibres} fibres · ${P.fibreLength} px long`, 10, 16);
  }

  // dialog box: pops in with its motion curve, at its width, frame and colors, with the eyes on its corners
  function drawDialog(now) {
    const [g, w, h] = fitCanvas(cvs.dialog), D = T.live.dialog, E = T.ease('dialog');
    const dur = 420, cycle = 2400, t = (now - t0.dialog) % cycle;
    const s = reduce ? 1 : .6 + .4 * E(Math.min(1, t / dur));
    g.clearRect(0, 0, w, h);
    const bw = (w - 70) * D.width / 960, bh = 38, cx = w / 2, cy = h / 2 + 4, k = .45;
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.globalAlpha = Math.min(1, t / dur * 1.6);
    g.strokeStyle = mix(D.cyan, '#ffffff', .45); g.lineWidth = D.border * k;
    g.strokeRect(-bw / 2 + 6, -bh / 2 + 6, bw, bh);
    g.fillStyle = '#fff'; g.fillRect(-bw / 2, -bh / 2, bw, bh);
    g.strokeStyle = D.pink; g.lineWidth = D.border * k * 2; g.strokeRect(-bw / 2, -bh / 2, bw, bh);
    g.fillStyle = D.pink; g.font = '14px Raleway, sans-serif'; g.textAlign = 'center';
    g.fillText('Hi! I play the bass.', 0, 5);
    // the eyes on the corners, at the box's scale
    const ps = bw / D.width, L = -bw / 2, R = bw / 2, Tp = -bh / 2, B = bh / 2;
    const eye = new Path2D(Looks.eyePath(D.eyeShape, D.eyeWidth * ps, D.eyeHeight * ps));
    [[L + 30 * ps, Tp - 6 * ps], [R, B], [R - 30 * ps, Tp - 6 * ps], [L, B]].slice(0, D.eyes).forEach(([x, y]) => {
      g.save(); g.translate(x, y);
      g.fillStyle = D.eyeColor; g.fill(eye);
      g.save(); g.clip(eye); g.fillStyle = D.pupilColor; g.beginPath(); g.arc(0, 0, D.pupil * ps / 2, 0, Math.PI * 2); g.fill(); g.restore();
      g.strokeStyle = D.pupilColor; g.lineWidth = Math.max(1, 5 * ps); g.lineJoin = 'round'; g.stroke(eye);
      g.restore();
    });
    g.restore();
  }

  // room spotlights: the beams sweeping over a small TV
  function drawSpots(now) {
    const [g, w, h] = fitCanvas(cvs.spots), S = T.live.spots, t = (now - t0.spots) / 1000;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1c0d1e'; g.fillRect(0, 0, w, h);
    const k = w / 2000, tvx = 997 * k, tvy = h * .62;
    g.fillStyle = '#4a3a3c'; g.fillRect(tvx - 22, tvy - 16, 44, 32); g.fillStyle = '#a7c9cc'; g.fillRect(tvx - 17, tvy - 12, 30, 22);
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = S.brightness / 100; g.filter = 'blur(3px)';
    for (let i = 0; i < S.count; i++) {
      const [x] = Spots.source(i, S.count), a = Spots.angle(i, S.count, t) * Math.PI / 180, c = i % 2 ? S.colorB : S.colorA;
      g.save(); g.translate(x * k, -4); g.rotate(a);
      const gr = g.createLinearGradient(0, 0, 0, h * 1.2); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-3, 0); g.lineTo(3, 0); g.lineTo(S.width * k * 1.6, h * 1.2); g.lineTo(-S.width * k * 1.6, h * 1.2); g.closePath(); g.fill();
      g.restore();
    }
    g.restore();
    g.fillStyle = col('--tune-dim'); g.font = '11px Raleway, sans-serif'; g.textAlign = 'left';
    g.fillText(`${S.count} beam${S.count === 1 ? '' : 's'} · ±${S.sweep}°`, 10, h - 10);
  }

  // transitions: scene A changes into scene B with the chosen method, curve and duration
  function drawTransition(id, now) {
    const [g, w, h] = fitCanvas(cvs[id]), C = T.live[id], E = T.ease(id);
    const hold = 600, cyc = C.duration + hold * 2, tt = (now - t0[id]) % cyc;
    const p = tt < hold ? 0 : tt > hold + C.duration ? 1 : E((tt - hold) / C.duration);
    const scene = (label, c1, c2) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = '15px Raleway, sans-serif'; g.textAlign = 'center'; g.fillText(label, w / 2, h / 2 + 5); };
    const [from, to] = { toTv: ['Room', 'TV'], toStrings: ['Band', 'Strings'], toInside: ['Tear', 'World inside'], toRestart: ['Ending', 'Room'] }[id];
    const A = () => scene(from, '#3a1d3c', '#7a3a6c'), B = () => scene(to, '#1f8fb0', '#e8248c');
    const ox = w / 2, oy = h / 2, q = Math.max(0, Math.min(1, p));
    g.save(); g.clearRect(0, 0, w, h); g.textAlign = 'center';
    switch (C.method) {
      case 'Fade': A(); g.globalAlpha = q; B(); break;
      case 'Iris': A(); g.beginPath(); g.arc(ox, oy, Math.max(0, p) * Math.hypot(w, h) * .6, 0, Math.PI * 2); g.clip(); B(); break;
      case 'Wipe': A(); g.beginPath(); g.rect(0, 0, w * Math.max(0, p), h); g.clip(); B(); break;
      case 'Slide': g.save(); g.translate(-w * p, 0); A(); g.restore(); g.translate(w * (1 - p), 0); B(); break;
      case 'Blur': g.filter = `blur(${(q * 10).toFixed(1)}px)`; g.globalAlpha = 1 - q; A(); g.filter = `blur(${((1 - q) * 10).toFixed(1)}px)`; g.globalAlpha = q; B(); break;
      case 'Flash': { const f = 1 - Math.abs(q - .5) * 2; (q < .5 ? A : B)(); g.globalAlpha = f; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); break; }
      default: // Zoom
        g.save(); g.translate(ox, oy); g.scale(1 + 2 * p, 1 + 2 * p); g.translate(-ox, -oy); A(); g.restore();
        g.globalAlpha = Math.max(0, Math.min(1, (p - .35) / .45)); g.translate(ox, oy); g.scale(.4 + .6 * p, .4 + .6 * p); g.translate(-ox, -oy); B();
    }
    g.restore();
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(10, h - 12, w - 20, 4);
    g.fillStyle = col('--tune-cyan'); g.fillRect(10, h - 12, (w - 20) * Math.min(1, Math.max(0, (tt - hold) / C.duration)), 4);
    g.fillStyle = '#fff'; g.font = '11px Raleway, sans-serif'; g.textAlign = 'left';
    g.fillText(`${C.method} · ${C.duration} ms`, 10, 16);
  }

  // character effects: a simple figure with its shapes moving around it, at the guitarist's proportions
  function drawNotes(now) {
    const [g, w, h] = fitCanvas(cvs.notes), S = T.live.notes, t = (now - t0.notes) / 1000;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1a0c1f'; g.fillRect(0, 0, w, h);
    const k = h / 300, cx = w / 2, cy = h * .42, cw = 300 * k * .55;
    // the figure: a star head over a body
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(cx - cw * .3, cy - 4, cw * .6, h);
    g.fillStyle = 'rgba(240,71,140,.55)'; g.beginPath();
    for (let i = 0; i <= 10; i++) { const r = i % 2 ? 7 : 17, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(cx + r * Math.cos(a), cy - 18 + r * Math.sin(a)); }
    g.fill();
    if (Math.floor(t / .833) !== Math.floor((t - 1 / 60) / .833)) restartPop = now;
    const pop = Math.exp(-(now - (restartPop || 0)) / 150);
    const rx = cw * S.orbitWidth / 200, ry = cw * S.orbitHeight / 200;
    const items = Array.from({ length: S.count }, (_, i) => ({ i, p: Notes.place(i, S.count, t, 1, rx, ry) })).sort((a, b) => a.p.depth - b.p.depth);
    if (!S.count) { g.fillStyle = col('--tune-dim'); g.font = '11px Raleway, sans-serif'; g.textAlign = 'left'; g.fillText('Amount is 0: no effect', 10, h - 10); }
    g.save();
    if (S.glow) { g.shadowColor = T.rgba(S.colorA, .9); g.shadowBlur = S.glow * .8; }
    items.forEach(({ i, p }) => {
      const s = S.size * k * 1.4 * p.scale * (1 + .35 * pop);
      g.save();
      g.translate(cx + p.x, cy + p.y);
      g.rotate((reduce ? 0 : 14 * Math.sin(t * 2 + i)) * Math.PI / 180); g.scale(s, s);
      g.globalAlpha = p.alpha; g.fillStyle = i % 2 ? S.colorB : S.colorA;
      g.fill(new Path2D(Notes.path(S.shape, i, S.effect)), 'evenodd');
      g.restore();
    });
    g.restore();
  }
  let restartPop = 0;

  // final-scene lights: the floor equalizer and a ring from the star, in their colors
  function drawEffects(now) {
    const [g, w, h] = fitCanvas(cvs.effects), F = T.live.effects, E = T.ease('effects');
    const t = (now - t0.effects) / 1000;
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#1a0c1f'; g.fillRect(0, 0, w, h);
    // a beat every 1.6 s: rings per beat ripple from each origin (hands at the guitarist's spots)
    const at = { 'Strumming hand': [[.3, .55]], 'Fretting hand': [[.7, .35]], 'Both hands': [[.3, .55], [.7, .35]], 'Star head': [[.5, .15]] }[F.ringOrigin];
    for (let k = 0; k < F.ringsPerBeat; k++) {
      const p = ((t - k * .14) % 1.6 + 1.6) % 1.6 / 1.6, r = 4 + E(p) * w * .3 * F.ringSize / 100 * (1 - k * .12);
      g.strokeStyle = T.rgba(Math.floor(t / 1.6) % 2 ? F.colorB : F.colorA, (1 - p) * .8);
      g.lineWidth = F.ringWidth * .2;
      at.forEach(([x, y]) => { g.beginPath(); g.arc(w * x, h * y, r, 0, Math.PI * 2); g.stroke(); });
    }
    // equalizer: the real column count across the strip, dots sized like the stage at panel scale
    const cols = F.columns, gap = (w - 20) / cols, rowGap = (h - 30) / F.rows, rad = Math.min(gap * .45, rowGap * .45, F.dotSize * .35);
    for (let c = 0; c < cols; c++) {
      const lvl = reduce ? .5 : .5 + .5 * Math.sin(t * 3.1 + c * .45) * Math.sin(t * 1.3 + c * .17);
      const lit = Math.max(1, Math.round(lvl * F.rows)), x = 10 + gap * (c + .5);
      g.fillStyle = mix(F.colorA, F.colorB, c / Math.max(1, cols - 1));
      for (let k = 0; k < lit; k++) { g.beginPath(); g.arc(x, h - 8 - k * rowGap, rad * (1 - k / F.rows * .4), 0, Math.PI * 2); g.fill(); }
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (panel.classList.contains('is-collapsed') || document.hidden) return;
    if (tab === 'motion') { drawKey(now); drawStrings(now); drawPaper(now); }
    else if (tab === 'graphics') { drawSpots(now); drawStringsLook(now); drawPaperLook(now); drawDialog(now); drawEffects(now); drawNotes(now); }
    else ['toTv', 'toStrings', 'toInside', 'toRestart'].forEach(id => drawTransition(id, now));
  }

  sync();
  requestAnimationFrame(loop);
})();
