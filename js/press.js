// Press the Play Button — adapted from press-the-play-button/index.html.
// Same feel: the key resists, then gives way over a slow travel; it latches with a "ka-cha",
// rests at the bottom, rises with a softer click, and only then the set powers on and the
// curtains part. Releasing early springs the key back with no effect.
window.Press = (() => {
  "use strict";
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TRAVEL = 10;          // how far the cap sinks, in stage px
  const PRESS_MS = 1700;      // slow, laboured travel to the bottom
  const CURVE = 2.2;          // resists at first, then gives way
  const HOLD_MS = 450;        // pause at full depth before it can rise
  const OPEN_SCALE = 0.15;    // gathered curtain width

  function create({ play, cap, well, left, right, dim, onPress, onPowered }) {
    let depth = 0;
    let phase = 'locked';     // locked | idle | pressing | bottomed | returning | powering | on
    let run = 0, scene = 0;

    // ---------- drawing ----------
    function drawButton(p) {
      cap.style.transform = `translateY(${(TRAVEL * p).toFixed(2)}px)`;
      well.style.height = `${(TRAVEL * p).toFixed(2)}px`;
    }
    function drawCurtains(s) {   // s: 1 closed → OPEN_SCALE open
      left.style.transform = `scaleX(${s})`;
      right.style.transform = `scaleX(${s})`;
    }

    // ---------- timing ----------
    const easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
    function tween(ms, step, ease = t => t, lane = 'run') {
      const cur = () => lane === 'run' ? run : scene;
      const id = cur();
      ms = reduce ? Math.min(ms, 120) : ms;
      return new Promise(resolve => {
        const t0 = performance.now();
        const tick = now => {
          if (id !== cur()) return;
          const t = Math.min(1, (now - t0) / ms);
          step(ease(t));
          t < 1 ? requestAnimationFrame(tick) : resolve();
        };
        requestAnimationFrame(tick);
      });
    }
    const wait = ms => new Promise(r => setTimeout(r, ms));

    // ---------- sound ----------
    function noise(ctx, dur) {
      const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource(); s.buffer = b; return s;
    }
    // Crisp "ka-cha": a hard plastic snap, then the catch seating a few ms later.
    function snap(level, gap) {
      const ctx = Sound.audio(); if (!ctx) return;
      const t = ctx.currentTime + 0.005;
      const burst = (at, freq, q, gain, len) => {
        const n = noise(ctx, len + 0.01), f = ctx.createBiquadFilter(), g = ctx.createGain();
        f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.setValueAtTime(gain, at);
        g.gain.exponentialRampToValueAtTime(0.0005, at + len);
        n.connect(f).connect(g).connect(ctx.destination); n.start(t);
      };
      burst(t, 3800, 2.5, level * 1.4, 0.012);           // ka
      burst(t + gap, 6200, 1.2, level, 0.03);            // cha
      const o = ctx.createOscillator(), og = ctx.createGain();   // faint body so it isn't thin
      o.type = 'sine'; o.frequency.value = 900;
      og.gain.setValueAtTime(level * 0.25, t); og.gain.exponentialRampToValueAtTime(0.0005, t + 0.025);
      o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.04);
    }
    const click = () => snap(0.9, 0.022);
    const release = () => snap(0.35, 0.015);

    // ---------- press ----------
    let pressStart = 0;
    function startPress() {
      if (phase !== 'idle' && phase !== 'returning') return;
      Sound.audio();
      run++;                                 // stop any return in progress
      phase = 'pressing';
      play.classList.add('is-contact');
      // continue from the current depth so a re-press mid-return feels continuous
      pressStart = performance.now() - Math.pow(depth, 1 / CURVE) * PRESS_MS;
      const id = run;
      const tick = now => {
        if (id !== run || phase !== 'pressing') return;
        const t = Math.min(1, (now - pressStart) / (reduce ? 400 : PRESS_MS));
        depth = Math.pow(t, CURVE);
        drawButton(depth);
        if (t >= 1) { bottomOut(); return; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    let holdUntil = 0;
    function bottomOut() {
      phase = 'bottomed';
      depth = 1;
      drawButton(1);
      click();
      holdUntil = performance.now() + (reduce ? 0 : HOLD_MS);
    }

    async function endPress() {
      play.classList.remove('is-contact');
      if (phase === 'pressing') {            // released early: spring back
        phase = 'returning';
        const from = depth;
        await tween(500 + 450 * from, k => { depth = from * (1 - k); drawButton(depth); }, easeSine);
        if (phase === 'returning') phase = 'idle';
      } else if (phase === 'bottomed') {     // full press: rise, then power the set
        phase = 'powering';
        const id = run;
        const remain = holdUntil - performance.now();
        if (remain > 0) await wait(remain);      // the button rests at the bottom before letting go
        if (id !== run) return;
        release();
        await tween(520, k => { depth = 1 - k; drawButton(depth); }, easeSine);
        if (id !== run) return;
        play.classList.remove('is-armed');
        play.classList.add('is-spent');
        play.tabIndex = -1;
        onPress && onPress();
        await wait(reduce ? 0 : 180);
        if (id !== run) return;
        await turnOn();
      }
    }

    async function turnOn() {
      phase = 'on';
      scene++;
      const id = scene;
      await tween(3200, k => {
        drawCurtains(1 - (1 - OPEN_SCALE) * k);
        dim.style.opacity = (0.3 * (1 - k)).toFixed(3);
      }, easeInOut, 'scene');
      if (id === scene) onPowered && onPowered();
    }

    // ---------- input ----------
    play.addEventListener('pointerdown', e => {
      if (e.button !== 0 || phase === 'locked') return;
      play.setPointerCapture(e.pointerId);
      startPress();
    });
    play.addEventListener('pointerup', endPress);
    play.addEventListener('pointercancel', endPress);
    play.addEventListener('lostpointercapture', () => { if (phase === 'pressing' || phase === 'bottomed') endPress(); });
    play.addEventListener('keydown', e => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); startPress(); }
    });
    play.addEventListener('keyup', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); endPress(); }
    });
    play.addEventListener('contextmenu', e => e.preventDefault());

    // ---------- arm / reset ----------
    function arm() {
      phase = 'idle';
      play.classList.add('is-armed');
      play.tabIndex = 0;
    }
    function reset() {
      run++; scene++;
      phase = 'locked';
      depth = 0;
      play.classList.remove('is-contact', 'is-spent', 'is-armed');
      play.tabIndex = -1;
      drawButton(0);
      drawCurtains(1);
      dim.style.opacity = 0.3;
    }
    reset();
    return { arm, reset };
  }

  return { create };
})();
