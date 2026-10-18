// Floating, collapsible control panel for tuning the three interactive components.
// Every change writes to Tuning.live, which the components read as they move, and redraws the
// panel's own mini-previews. "Try it" jumps the prototype to that step so it can be felt directly.
(() => {
  "use strict";
  const T = window.Tuning;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STEPS = { key: 'play', strings: 'strum', paper: 'tear' };
  const fmt = (v, f) => (f.step < 1 ? (+v).toFixed(1) : String(Math.round(v)));

  /* ---------- markup ---------- */
  const panel = document.createElement('aside');
  panel.id = 'tune';
  panel.setAttribute('aria-label', 'Motion controls');
  panel.innerHTML = `
    <div class="tune-head">
      <h2>Motion controls</h2>
      <button type="button" class="tune-toggle" aria-expanded="true" aria-controls="tune-body" title="Collapse panel">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>
    <div class="tune-body" id="tune-body">
      ${Object.entries(T.SCHEMA).map(([g, sec]) => `
        <section class="tune-sec" data-group="${g}">
          <div class="tune-sec-head">
            <h3>${sec.title}</h3>
            <button type="button" class="tune-try" data-step="${STEPS[g]}">Try it</button>
          </div>
          <canvas class="tune-preview" data-group="${g}" aria-label="${sec.title} preview"></canvas>
          ${Object.entries(sec.fields).map(([k, f]) => `
            <div class="tune-row">
              <label for="tune-${g}-${k}">${f.label}<span class="tune-range">${f.min}–${f.max} ${f.unit}</span></label>
              <div class="tune-ctl">
                <input type="range" id="tune-${g}-${k}" data-group="${g}" data-key="${k}" min="${f.min}" max="${f.max}" step="${f.step}" title="${f.hint}">
                <output for="tune-${g}-${k}"></output>
              </div>
            </div>`).join('')}
          <div class="tune-row">
            <span class="tune-label">Motion</span>
            <div class="tune-chips" role="radiogroup" aria-label="${sec.title} motion">
              ${T.MOTIONS.map(m => `<button type="button" role="radio" class="tune-chip" data-group="${g}" data-motion="${m}">${m}</button>`).join('')}
            </div>
          </div>
        </section>`).join('')}
      <div class="tune-actions">
        <button type="button" class="tune-btn" id="tune-restore">Restore defaults</button>
        <button type="button" class="tune-btn is-primary" id="tune-copy">Copy settings</button>
      </div>
      <p class="tune-status" role="status" aria-live="polite"></p>
      <textarea class="tune-copytext" id="tune-copytext" readonly hidden aria-label="Settings to copy"></textarea>
    </div>`;
  document.body.appendChild(panel);
  const body = panel.querySelector('.tune-body'), status = panel.querySelector('.tune-status');

  /* ---------- collapse (remembered per viewer) ---------- */
  const toggle = panel.querySelector('.tune-toggle');
  function setCollapsed(c) {
    panel.classList.toggle('is-collapsed', c);
    toggle.setAttribute('aria-expanded', String(!c));
    toggle.title = c ? 'Open motion controls' : 'Collapse panel';
    try { localStorage.setItem('tune-collapsed', c ? '1' : '0'); } catch (e) {}
  }
  toggle.addEventListener('click', () => setCollapsed(!panel.classList.contains('is-collapsed')));
  try { if (localStorage.getItem('tune-collapsed') === '1') setCollapsed(true); } catch (e) {}

  /* ---------- controls ⇄ Tuning.live ---------- */
  const inputs = [...panel.querySelectorAll('input[type=range]')];
  const chips = [...panel.querySelectorAll('.tune-chip')];
  function sync() {
    inputs.forEach(i => {
      const f = T.SCHEMA[i.dataset.group].fields[i.dataset.key], v = T.live[i.dataset.group][i.dataset.key];
      i.value = v;
      i.nextElementSibling.textContent = `${fmt(v, f)} ${f.unit}`;
      i.style.setProperty('--p', ((v - f.min) / (f.max - f.min) * 100).toFixed(1) + '%');
      i.classList.toggle('is-changed', v !== T.SAVED[i.dataset.group][i.dataset.key]);
    });
    chips.forEach(c => {
      const on = T.live[c.dataset.group].motion === c.dataset.motion;
      c.classList.toggle('is-on', on); c.setAttribute('aria-checked', String(on));
    });
  }
  inputs.forEach(i => i.addEventListener('input', () => {
    T.set(i.dataset.group, i.dataset.key, +i.value); sync(); restartPreview(i.dataset.group);
  }));
  chips.forEach(c => c.addEventListener('click', () => {
    T.set(c.dataset.group, 'motion', c.dataset.motion); sync(); restartPreview(c.dataset.group);
  }));
  panel.querySelectorAll('.tune-try').forEach(b => b.addEventListener('click', () => window.Sequence && Sequence.jump(b.dataset.step)));
  panel.querySelector('#tune-restore').addEventListener('click', () => {
    T.restore(); sync(); Object.keys(T.SCHEMA).forEach(restartPreview);
    say('Restored the saved defaults.');
  });

  /* ---------- copy settings ---------- */
  function settingsText() {
    const lines = [];
    for (const [g, sec] of Object.entries(T.SCHEMA)) {
      lines.push(sec.title);
      for (const [k, f] of Object.entries(sec.fields)) lines.push(`- ${f.label}: ${fmt(T.live[g][k], f)} ${f.unit}`);
      lines.push(`- Motion: ${T.live[g].motion}`, '');
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
  const cvs = Object.fromEntries([...panel.querySelectorAll('.tune-preview')].map(c => [c.dataset.group, c]));
  const t0 = {};
  function restartPreview(g) { t0[g] = performance.now(); }
  Object.keys(cvs).forEach(restartPreview);
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

  function loop(now) {
    requestAnimationFrame(loop);
    if (panel.classList.contains('is-collapsed') || document.hidden) return;
    drawKey(now); drawStrings(now); drawPaper(now);
  }
  sync();
  requestAnimationFrame(loop);
})();
