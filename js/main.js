// The sequence: one linear path through the room, the TV, the band, the guitar, the tear and
// the performance space. Each step unlocks only when the previous one has finished.
(() => {
  "use strict";
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const scenes = { room: $('scene-room'), tv: $('scene-tv'), guitar: $('scene-guitar'), inside: $('scene-inside') };

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
  buildDeco(dialog.querySelector('.dialog-deco'));
  function say(text, ending = false) {
    dialogText.textContent = text;
    dialog.classList.toggle('is-ending', ending);
    dialog.hidden = false;
    dialog.classList.remove('is-in'); void dialog.offsetWidth; dialog.classList.add('is-in');
  }
  function hush() { dialog.hidden = true; dialog.classList.remove('is-in'); }

  // the doodles around the reference dialog box: a scribbled glowing star, a lightning bolt,
  // two eyes on the frame corners and a thin line running through
  function buildDeco(svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    const defs = el('defs', {});
    const glow = el('filter', { id: 'deco-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: '4', result: 'b' }, glow);
    const merge = el('feMerge', {}, glow); el('feMergeNode', { in: 'b' }, merge); el('feMergeNode', { in: 'SourceGraphic' }, merge);

    // thin line through the left and right of the box
    el('path', { d: 'M-230 120 C-120 118 -60 124 0 120', stroke: 'rgba(255,255,255,.7)', 'stroke-width': 2, fill: 'none' });
    el('ellipse', { cx: -40, cy: 146, rx: 70, ry: 9, stroke: 'rgba(255,255,255,.55)', 'stroke-width': 1.5, fill: 'none' });
    el('path', { d: 'M760 112 C820 110 880 108 960 106', stroke: 'rgba(255,255,255,.6)', 'stroke-width': 2, fill: 'none' });

    // scribbled star: several jittery passes, with pink/cyan misregistration
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const cx = -80, cy = 20, R = 100, r = 40;
    const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    const scribble = () => {
      let d = '';
      for (let pass = 0; pass < 4; pass++) pts.concat([pts[0]]).forEach(([x, y], i) => { d += `${i || pass ? 'L' : 'M'}${(x + (rnd() - .5) * 18).toFixed(1)} ${(y + (rnd() - .5) * 18).toFixed(1)} `; });
      for (let h = 0; h < 14; h++) { const y = cy - 60 + h * 9; d += `M${cx - 55 + rnd() * 20} ${y} L${cx + 35 + rnd() * 20} ${y + 30} `; }
      return d;
    };
    const g = el('g', { filter: 'url(#deco-glow)', fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    el('path', { d: scribble(), stroke: 'rgba(143,227,232,.85)', 'stroke-width': 2.4, transform: 'translate(-3 2)' }, g);
    el('path', { d: scribble(), stroke: 'rgba(240,140,179,.85)', 'stroke-width': 2.4, transform: 'translate(3 -2)' }, g);
    el('path', { d: scribble(), stroke: '#fff', 'stroke-width': 2.6 }, g);
    // a dangling red cord
    el('path', { d: 'M-70 -80 C-90 -120 -60 -160 -40 -170 M-40 -170 C-20 -150 -20 -120 -45 -110', stroke: '#c0263a', 'stroke-width': 2.5, fill: 'none' });

    // lightning bolt
    el('polygon', { points: '70,-150 150,-75 110,-72 160,-20 60,-60 100,-64', fill: '#fff', filter: 'url(#deco-glow)' });
    // eyes on the frame corners
    const eye = (x, y) => {
      el('path', { d: `M${x - 34} ${y} Q${x} ${y - 30} ${x + 34} ${y} Q${x} ${y + 30} ${x - 34} ${y} Z`, fill: '#fff', stroke: '#222', 'stroke-width': 6 });
      el('circle', { cx: x, cy: y, r: 11, fill: '#222' });
    };
    eye(30, -6);
    // the second eye sits on the box's bottom-right corner, whatever the box size
    const corner = document.createElementNS(NS, 'svg');
    corner.setAttribute('viewBox', '-40 -40 80 80'); corner.setAttribute('class', 'dialog-eye'); corner.setAttribute('aria-hidden', 'true');
    svg.parentNode.querySelector('.dialog-box').appendChild(corner);
    el('path', { d: 'M-34 0 Q0 -30 34 0 Q0 30 -34 0 Z', fill: '#fff', stroke: '#222', 'stroke-width': 6 }, corner);
    el('circle', { cx: 0, cy: 0, r: 11, fill: '#222' }, corner);
  }

  /* ---------- 1. room ---------- */
  const tvHotspot = $('tv-hotspot');
  tvHotspot.addEventListener('click', async () => {
    if (step !== 'room') return;
    step = 'zooming'; const t = token;
    Sound.audio();
    tvHotspot.hidden = true;
    const img = scenes.room.querySelector('.scene-bg');
    // the room photo zooms about the point that maps it onto the close-up photo of the same TV
    await animate(img, [{ transform: 'scale(1)' }, { transform: 'scale(3.05)' }], { duration: 2600, easing: 'cubic-bezier(.55,0,.25,1)' });
    if (!alive(t)) return;
    await crossfade(scenes.room, scenes.tv, 500);
    if (!alive(t)) return;
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
  const members = [...document.querySelectorAll('.member')];
  let memberIx = 0;
  function nextMember(i) {
    memberIx = i;
    members.forEach((m, j) => { m.classList.toggle('is-next', j === i); m.tabIndex = j === i ? 0 : -1; });
    if (members[i]) members[i].focus({ preventScroll: true });
  }
  function memberTick() {
    const a = Sound.audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(90, t + .06);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .09);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + .1);
  }
  members.forEach(m => m.addEventListener('click', async () => {
    const i = +m.dataset.i;
    if (step !== 'band' || i !== memberIx) return;
    const t = token;
    memberTick();
    say(INTROS[i]);
    if (i < members.length - 1) { nextMember(i + 1); return; }
    // the guitarist: zoom into the guitar
    nextMember(-1);
    step = 'zoom-guitar';
    await wait(1800);
    if (!alive(t)) return;
    hush();
    scenes.tv.style.transformOrigin = '980px 760px';
    await animate(scenes.tv, [{ transform: 'scale(1)' }, { transform: 'scale(3.2)' }], { duration: 1900, easing: 'cubic-bezier(.55,0,.3,1)' });
    if (!alive(t)) return;
    strum.start();
    const p = crossfade(scenes.tv, scenes.guitar, 700);
    animate(scenes.guitar, [{ transform: 'scale(.9)', transformOrigin: '1000px 560px' }, { transform: 'scale(1)', transformOrigin: '1000px 560px' }], { duration: 900, easing: 'cubic-bezier(.2,.7,.3,1)' });
    await p;
    if (!alive(t)) return;
    step = 'strum';
  }));

  /* ---------- 4. strum → 5. tear ---------- */
  const strum = Strum.create($('strum'), {
    onDone: () => {
      if (step !== 'strum') return;
      step = 'tear';
      tear.start();
      scenes.guitar.classList.add('is-tearing');
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
      scenes.inside.classList.add('is-active');
      scenes.guitar.style.zIndex = 2;
      animate(scenes.inside, [{ transform: 'scale(1.06)', transformOrigin: '1000px 560px' }, { transform: 'scale(1)', transformOrigin: '1000px 560px' }], { duration: 2200, easing: 'cubic-bezier(.2,.7,.3,1)' });
      await animate(scenes.guitar, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.35)', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.4,0,.2,1)' });
      if (!alive(t)) return;
      scenes.guitar.classList.remove('is-active');
      scenes.guitar.style.zIndex = '';
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

  /* ---------- restart ---------- */
  let step = 'room';
  $('restart').addEventListener('click', restart);
  function restart() {
    token++;
    step = 'room';
    Sound.stopMusic();
    hush();
    $('ending').hidden = true; $('ending').classList.remove('is-in');
    strum.reset(); tear.reset();
    press.reset();
    nextMember(-1); memberIx = 0;
    running.splice(0).forEach(a => a.cancel());
    Object.values(scenes).forEach(s => { s.style.transform = ''; s.style.opacity = ''; s.style.zIndex = ''; s.style.pointerEvents = ''; });
    scenes.guitar.classList.remove('is-tearing');
    tvHotspot.hidden = false;
    show('room');
    tvHotspot.focus({ preventScroll: true });
  }
})();
