// The sequence: one linear path through the room, the TV, the band, the guitar, the tear and
// the performance space. Each step unlocks only when the previous one has finished.
(() => {
  "use strict";
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const scenes = { room: $('scene-room'), tv: $('scene-tv'), inside: $('scene-inside') };
  const screen = $('screen');

  /* ---------- stage fit ---------- */
  function fit() {
    const s = Math.min(innerWidth / 2000, innerHeight / 1127);
    stage.style.setProperty('--fit', s);
  }
  addEventListener('resize', fit);
  fit();

  /* ---------- helpers ---------- */
  let token = 0;                                   // bumped on restart; stale steps stop
  const wait = ms => new Promise(r => setTimeout(r, reduce ? Math.min(ms, 150) : ms));
  const alive = t => t === token;
  const running = [];                              // every scripted animation, so restart can undo them
  function animate(el, keyframes, opts) {
    const a = el.animate(keyframes, { fill: 'forwards', easing: 'cubic-bezier(.65,0,.35,1)', ...opts, duration: reduce ? 1 : opts.duration });
    running.push(a);
    return a.finished.catch(() => {});
  }
  function show(name) {
    for (const [k, el] of Object.entries(scenes)) el.classList.toggle('is-active', k === name);
  }
  function crossfade(from, to, ms = 600) {
    to.style.opacity = 0;
    to.classList.add('is-active');
    from.style.pointerEvents = 'none';
    const p = animate(to, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease' });
    return p.then(() => { from.classList.remove('is-active'); from.style.pointerEvents = ''; to.style.opacity = ''; });
  }

  /* ---------- dialog ---------- */
  const dialog = $('dialog'), dialogText = dialog.querySelector('.dialog-text');
  // anchor: [x, y] in stage pixels; the dialog's lower-left corner sits there (a band member's upper right)
  function say(text, ending = false, anchor = null) {
    dialogText.textContent = text;
    dialog.classList.toggle('is-ending', ending);
    dialog.classList.toggle('is-intro', !!anchor);
    dialog.style.left = anchor ? `${Math.min(anchor[0], 2000 - 560)}px` : '';
    dialog.style.top = anchor ? 'auto' : '';
    dialog.style.bottom = anchor ? `${1127 - anchor[1]}px` : '';
    dialog.hidden = false;
    dialog.classList.remove('is-in'); void dialog.offsetWidth; dialog.classList.add('is-in');
  }
  function hush() { dialog.hidden = true; dialog.classList.remove('is-in'); }
  // fade the dialog out instead of cutting it
  function fadeHush(ms = 400) {
    if (dialog.hidden) return Promise.resolve();
    return dialog.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(8px)' }], { duration: reduce ? 1 : ms, easing: 'ease' })
      .finished.catch(() => {}).then(hush);
  }

  const tvHotspot = $('tv-hotspot');
  tvHotspot.addEventListener('click', async () => {
    if (step !== 'room') return;
    step = 'zooming'; const t = token;
    Sound.audio(); Sound.loadClick();
    tvHotspot.hidden = true;
    const img = scenes.room.querySelector('.scene-bg');
    // the room photo zooms about the point that maps it onto the close-up photo of the same TV;
    // the sharper close-up rides the same zoom (scaled down by the same factor) and fades in
    // part-way, so the view never ends on an enlarged, soft room photo
    const ZOOM = 3.05, timing = { duration: 2600, easing: 'cubic-bezier(.55,0,.25,1)' };
    scenes.tv.style.transformOrigin = '997.6px 586px';
    scenes.tv.style.pointerEvents = 'none';
    scenes.tv.classList.add('is-active');
    animate(scenes.tv, [
      { transform: `scale(${1 / ZOOM})`, opacity: 0, offset: 0 },
      { opacity: 0, offset: .4 },
      { opacity: 1, offset: .78 },
      { transform: 'scale(1)', opacity: 1, offset: 1 }
    ], timing);
    await animate(img, [{ transform: 'scale(1)' }, { transform: `scale(${ZOOM})` }], timing);
    if (!alive(t)) return;
    scenes.room.classList.remove('is-active');
    scenes.tv.style.pointerEvents = '';
    step = 'play';
    press.arm();
    $('play').focus({ preventScroll: true });
  });
  scenes.room.querySelector('.scene-bg').style.transformOrigin = '997.6px 586px';

  /* ---------- 2. play ---------- */
  const press = Press.create({
    play: $('play'), cap: $('play-cap'), well: $('play-well'),
    left: $('curtain-left'), right: $('curtain-right'), dim: $('screen-dim'),
    onPress: () => { Sound.startMusic(); },
    onPowered: () => { step = 'band'; nextMember(0); }
  });

  /* ---------- 3. band ---------- */
  const INTROS = ['The bassist of the band', 'The drummer of the band', 'The keyboardist of the band', 'The guitarist of the band'];
  // each member's upper-right corner in stage pixels (screen offset + member box, see css)
  const ANCHORS = [[623, 459], [1037, 326], [1330, 451], [1110, 559]];
  const members = [...document.querySelectorAll('.member')];
  let memberIx = 0;
  function nextMember(i) {
    memberIx = i;
    members.forEach((m, j) => { m.classList.toggle('is-next', j === i); m.tabIndex = j === i ? 0 : -1; });
    if (members[i]) members[i].focus({ preventScroll: true });
  }
  members.forEach(m => m.addEventListener('click', async () => {
    const i = +m.dataset.i;
    if (step !== 'band' || i !== memberIx) return;
    const t = token;
    Sound.playClick();
    say(INTROS[i], false, ANCHORS[i]);
    if (i < members.length - 1) { nextMember(i + 1); return; }
    // the guitarist: zoom into the guitar
    nextMember(-1);
    step = 'zoom-guitar';
    await wait(1600);
    if (!alive(t)) return;
    fadeHush();
    // one continuous zoom straight into the guitar: the band picture dives in on the guitarist's
    // guitar while the strum view (the close-up with its strings) grows out of that same point,
    // so the camera lands directly on the strings
    const band = $('band'), strumView = $('strum');
    const G = '560px 610px', Z = 4, zoom = { duration: 2400, easing: 'cubic-bezier(.6,0,.25,1)' };
    strum.start();
    await strum.loaded;
    if (!alive(t)) return;
    band.style.transformOrigin = G; strumView.style.transformOrigin = G;
    strumView.style.visibility = 'visible';
    animate(band, [{ transform: 'scale(1)' }, { transform: `scale(${Z})` }], zoom);
    const grow = strumView.animate([
      { transform: `scale(${1 / Z})`, opacity: 0, offset: 0 },
      { opacity: 0, offset: .3 },
      { opacity: 1, offset: .7 },
      { transform: 'scale(1)', opacity: 1, offset: 1 }
    ], { ...zoom, duration: reduce ? 1 : zoom.duration });
    running.push(grow);
    await grow.finished.catch(() => {});
    if (!alive(t)) return;
    grow.cancel();                                    // the canvas rests at its natural size; nothing to hold
    strumView.style.visibility = '';
    screen.classList.add('is-strum');
    step = 'strum';
  }));

  /* ---------- 4. strum → 5. tear ---------- */
  const strum = Strum.create($('strum'), {
    onDone: () => {
      if (step !== 'strum') return;
      step = 'tear';
      tear.start();
      screen.classList.add('is-tearing');
      strum.stop();
    }
  });
  const tear = Tear.create($('tear'), {
    onDone: async () => {
      if (step !== 'tear') return;
      step = 'entering'; const t = token;
      tear.stop();
      // through the hole: the paper lifts away, the music clears
      Sound.clearMusic(2400);
      // the camera dives into the TV screen while the world inside comes up around you
      const Z = 2.1, tx = 1000 - 890 * Z, ty = 563.5 - 565 * Z;
      scenes.tv.style.transformOrigin = '0 0';
      animate(scenes.tv, [{ transform: 'none' }, { transform: `translate(${tx}px, ${ty}px) scale(${Z})` }], { duration: 2000, easing: 'cubic-bezier(.6,0,.3,1)' });
      scenes.inside.style.opacity = 0;
      scenes.inside.classList.add('is-active');
      fx.start();
      animate(scenes.inside, [{ opacity: 0, transform: 'scale(1.1)', transformOrigin: '1000px 560px' }, { opacity: 1, transform: 'scale(1)', transformOrigin: '1000px 560px' }], { duration: 1500, delay: 700, easing: 'cubic-bezier(.3,.6,.3,1)' });
      await wait(2200);
      if (!alive(t)) return;
      scenes.inside.style.opacity = '';
      scenes.tv.classList.remove('is-active');
      step = 'inside';
      // 6. a short settle, then the ending
      await wait(5000);
      if (!alive(t)) return;
      step = 'ending';
      say('You have reached the other side of the screen', true);
      $('ending').hidden = false;
      $('ending').classList.add('is-in');
      $('restart').focus({ preventScroll: true });
    }
  });

  /* ---------- 6. the performance space comes alive ---------- */
  // spotlights sweep, stage lights wander the wall, the TV glows, a dot equalizer rises from the
  // floor, and the pink star sends out rings
  // and glows on the beat of Lilacs (an even 72 bpm pulse stands in if the music can't be read)
  const fx = (() => {
    const svg = $('inside-fx'), NS = 'http://www.w3.org/2000/svg';
    const STAR = [425, 185];                       // the guitarist's star head, in stage pixels
    let built = false, raf = 0, glow = null, beams = [], spots = [], tvGlow = null;
    const FX = () => Tuning.live.effects;           // equalizer size, ring width, colors, ring curve
    let eqDots = [], eqGroup = null;
    const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    const starPts = (r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`; }).join(' ');
    function build() {
      built = true;
      const defs = el('defs', {});
      const lg = (id, c, o) => { const g = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs); el('stop', { offset: 0, 'stop-color': c, 'stop-opacity': o }, g); el('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 }, g); };
      lg('fx-beam-pink', '#ffd3ea', .55); lg('fx-beam-cyan', '#c9fbff', .45);
      const rg = el('radialGradient', { id: 'fx-glow' }, defs);
      el('stop', { offset: 0, 'stop-color': '#ff4f9a', 'stop-opacity': .9 }, rg); el('stop', { offset: 1, 'stop-color': '#ff4f9a', 'stop-opacity': 0 }, rg);
      beams = [
        el('polygon', { class: 'beam', points: '400,-40 470,-40 680,900 180,900', fill: 'url(#fx-beam-pink)', opacity: .5 }),
        el('polygon', { class: 'beam b2', points: '960,-40 1020,-40 1190,900 790,900', fill: 'url(#fx-beam-cyan)', opacity: .35 })
      ];
      glow = el('circle', { cx: STAR[0], cy: STAR[1], r: 230, fill: 'url(#fx-glow)', opacity: .3 });
      el('g', { id: 'fx-rings' });
      // stage lights wandering over the back wall
      const spot = (id, c) => { const g = el('radialGradient', { id }, defs); el('stop', { offset: 0, 'stop-color': c, 'stop-opacity': .85 }, g); el('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 }, g); };
      spot('fx-spot-cyan', '#7ff6ff'); spot('fx-spot-pink', '#ff7ac0'); spot('fx-spot-violet', '#c79bff');
      spots = ['cyan', 'pink', 'violet'].map(c => el('ellipse', { rx: 300, ry: 200, fill: `url(#fx-spot-${c})`, opacity: .5 }));
      // the TV glows with the band playing on it
      const tg = el('radialGradient', { id: 'fx-tv' }, defs);
      el('stop', { offset: 0, 'stop-color': '#c9fbff', 'stop-opacity': .95 }, tg); el('stop', { offset: 1, 'stop-color': '#c9fbff', 'stop-opacity': 0 }, tg);
      tvGlow = el('ellipse', { cx: 966, cy: 566, rx: 330, ry: 260, fill: 'url(#fx-tv)', opacity: .25 });
      // a halftone-dot equalizer along the floor, following the music
      eqGroup = el('g', {});
      buildEq();
    }
    let n = 0;
    // the floor equalizer: rebuilt whenever its number of columns, height, dot size or colors change
    function buildEq() {
      if (!eqGroup) return;
      eqGroup.replaceChildren(); eqDots = [];
      const { columns, rows, dotSize, colorA, colorB } = FX(), gap = dotSize * 2.6;
      for (let c = 0; c < columns; c++) {
        const col = [], x = 25 + c * (1950 / (columns - 1));
        for (let r = 0; r < rows; r++) col.push(el('circle', { cx: x.toFixed(1), cy: (1105 - r * gap).toFixed(1), r: Math.max(1, dotSize * (1 - r / rows * .55)).toFixed(2), fill: c % 2 ? colorB : colorA, opacity: 0 }, eqGroup));
        eqDots.push(col);
      }
    }
    Tuning.onChange(g => { if (g === null || g === 'effects') buildEq(); });
    function ring(strong) {
      const c = el('circle', { cx: STAR[0], cy: STAR[1], r: 100, fill: 'none', stroke: n++ % 2 ? FX().colorB : FX().colorA }, $('fx-rings'));
      c.style.transformBox = 'fill-box'; c.style.transformOrigin = 'center';
      const a = c.animate([
        { transform: 'scale(.6)', opacity: strong ? .85 : .6, strokeWidth: FX().ringWidth },
        { transform: 'scale(6)', opacity: 0, strokeWidth: 3 }
      ], { duration: reduce ? 1 : 2200, easing: Tuning.cssEase('effects') });
      a.onfinish = () => c.remove();
    }
    function start() {
      if (!built) build();
      cancelAnimationFrame(raf);
      let avg = .2, last = 0, pulse = 0;
      const tick = now => {
        raf = requestAnimationFrame(tick);
        const lv = Sound.level();
        let beat = false, l;
        if (lv === null) { l = .3 + .25 * Math.max(0, Math.sin(now / 833 * Math.PI * 2)); beat = now - last > 833; }
        else { l = lv; avg = avg * .96 + lv * .04; beat = lv > avg * 1.18 && lv > .15 && now - last > 330; }
        if (beat) { last = now; pulse = 1; Notes.pulse(); if (!reduce) ring(l > avg * 1.35); }
        pulse *= .9;
        glow.setAttribute('opacity', (.16 + l * .3 + pulse * .3).toFixed(3));
        glow.setAttribute('r', (210 + pulse * 50).toFixed(1));
        beams[0].setAttribute('opacity', (.14 + l * .16 + pulse * .1).toFixed(3));
        beams[1].setAttribute('opacity', (.1 + l * .14).toFixed(3));
        tvGlow.setAttribute('opacity', (.14 + l * .25 + pulse * .2).toFixed(3));
        // stage lights drift along slow figure-of-eight paths
        const T = now / 1000;
        [[.11, .07, 0], [.08, .13, 2.1], [.06, .09, 4.2]].forEach(([fx_, fy, ph], i) => {
          spots[i].setAttribute('cx', (1000 + 820 * Math.sin(T * fx_ * Math.PI * 2 + ph)).toFixed(1));
          spots[i].setAttribute('cy', (380 + 230 * Math.sin(T * fy * Math.PI * 2 + ph * 1.7)).toFixed(1));
          spots[i].setAttribute('opacity', (.32 + l * .3).toFixed(3));
        });
        // equalizer: each column lights as many dots as its band is loud (a gentle wave without audio)
        const cols = eqDots.length, rows = FX().rows, b = Sound.bands(cols);
        eqDots.forEach((col, c) => {
          const v = b ? Math.min(1, b[Math.min(cols - 1, Math.abs(c - cols / 2) * 2 | 0)] * 1.35)
                      : .35 + .3 * Math.sin(T * 3 + c * .45) * Math.sin(T * 1.3 + c * .2);
          const lit = v * rows;
          col.forEach((d, r) => d.setAttribute('opacity', r < lit ? (.75 - r / rows * .45).toFixed(2) : '0'));
        });
      };
      raf = requestAnimationFrame(tick);
      Notes.start();
    }
    function stop() { cancelAnimationFrame(raf); Notes.stop(); if (built) $('fx-rings').replaceChildren(); }
    return { start, stop };
  })();

  /* ---------- restart ---------- */
  let step = 'room';
  $('restart').addEventListener('click', restart);
  function resetAll() {
    token++;
    step = 'room';
    Sound.stopMusic();
    fx.stop();
    $('strum').style.visibility = '';
    hush();
    $('ending').hidden = true; $('ending').classList.remove('is-in');
    strum.reset(); tear.reset();
    press.reset();
    nextMember(-1); memberIx = 0;
    running.splice(0).forEach(a => a.cancel());
    Object.values(scenes).forEach(s => { s.style.transform = ''; s.style.opacity = ''; s.style.zIndex = ''; s.style.pointerEvents = ''; });
    screen.classList.remove('is-strum', 'is-tearing');
  }
  function restart() {
    Sound.playClick();
    resetAll();
    tvHotspot.hidden = false;
    show('room');
    animate(scenes.room, [{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease' });
    tvHotspot.focus({ preventScroll: true });
  }

  // jump straight to one interactive step (used by the control panel's "Try it" buttons)
  function jump(to) {
    resetAll();
    Sound.audio();
    tvHotspot.hidden = true;
    show('tv');
    if (to === 'play') { step = 'play'; press.arm(); $('play').focus({ preventScroll: true }); return; }
    press.openNow();
    Sound.startMusic();
    if (to === 'band') { step = 'band'; nextMember(0); return; }
    if (to === 'inside') {
      show('inside'); fx.start(); Sound.clearMusic(10); step = 'inside';
      return;
    }
    if (to === 'strum') { strum.start(); screen.classList.add('is-strum'); step = 'strum'; }
    if (to === 'tear') { tear.start(); screen.classList.add('is-strum', 'is-tearing'); step = 'tear'; }
  }
  window.Sequence = { jump, restart, strumChord: () => strum.strumChord() };
})();
