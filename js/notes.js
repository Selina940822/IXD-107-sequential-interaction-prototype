// Effects around the characters in the world inside the TV: the star-headed guitarist and the
// four members on the small TV. Notes, sparkles, hearts, stars, bubbles or petals that orbit,
// rise, burst outward or twinkle. Everything comes from Tuning.live.notes; the movement follows
// the section's motion curve, and the shapes pop on each beat.
window.Notes = (() => {
  "use strict";
  const T = window.Tuning, NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = () => T.live.notes;

  // note symbols as paths, one unit tall, centred on 0,0 (y down)
  const head = dx => `M${-.16 + dx} .438A.17 .12 -20 1 0 ${.16 + dx} .322A.17 .12 -20 1 0 ${-.16 + dx} .438Z`;
  const stem = dx => `M${.13 + dx} .36V-.5H${.17 + dx}V.36Z`;
  const beam = (y, a, b) => `M${a} ${y}H${b}V${y + .12}H${a}Z`;
  const SHAPES = {
    'Eighth note': head(0) + stem(0) + 'M.17 -.5C.2 -.3 .42 -.25 .36 .02C.34 -.18 .25 -.22 .17 -.25Z',
    'Beamed notes': head(-.28) + stem(-.28) + head(.28) + stem(.28) + beam(-.5, -.15, .45),
    'Quarter note': head(0) + stem(0),
    'Sixteenth notes': head(-.28) + stem(-.28) + head(.28) + stem(.28) + beam(-.5, -.15, .45) + beam(-.3, -.15, .45)
  };
  const KINDS = Object.keys(SHAPES);
  const notePath = (shape, i) => SHAPES[shape === 'Mixed' ? KINDS[i % KINDS.length] : shape] || SHAPES['Eighth note'];
  // the other effects' shapes, also one unit tall (bubbles are rings: fill them even-odd)
  const star = (R, r) => { let d = ''; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r : R; d += `${k ? 'L' : 'M'}${(q * Math.cos(a)).toFixed(3)} ${(q * Math.sin(a) + .04).toFixed(3)}`; } return d + 'Z'; };
  const OTHER = {
    'Sparkles': 'M0 -.5C.05 -.1 .1 -.05 .5 0C.1 .05 .05 .1 0 .5C-.05 .1 -.1 .05 -.5 0C-.1 -.05 -.05 -.1 0 -.5Z',
    'Hearts': 'M0 .45C-.2 .3 -.5 .1 -.5 -.15C-.5 -.4 -.2 -.5 0 -.25C.2 -.5 .5 -.4 .5 -.15C.5 .1 .2 .3 0 .45Z',
    'Stars': star(.5, .2),
    'Bubbles': 'M-.45 0A.45 .45 0 1 0 .45 0A.45 .45 0 1 0 -.45 0ZM-.36 0A.36 .36 0 1 1 .36 0A.36 .36 0 1 1 -.36 0ZM-.25 -.2A.1 .07 -40 1 0 -.1 -.3A.1 .07 -40 1 0 -.25 -.2Z',
    'Petals': 'M0 -.5C.3 -.3 .3 .25 0 .5C-.3 .25 -.3 -.3 0 -.5Z'
  };
  const MIX = ['Hearts', 'Stars', 'Sparkles', 'Bubbles', 'Petals'];
  // the shape for item i: a note, or the chosen effect's shape
  function path(shape, i, effect = 'Orbiting notes') {
    if (effect === 'Orbiting notes') return notePath(shape, i);
    if (effect === 'Mixed shapes') return i % 6 === 5 ? notePath('Mixed', i) : OTHER[MIX[i % 6 % 5]];
    return OTHER[effect] || notePath(shape, i);
  }

  // the guitarist in the performance picture, in stage pixels (orbit centred on the upper body)
  const GUITARIST = { x: 300, y: 60, w: 300, h: 1000 };

  let chars = [], raf = 0, pulse = 0, t0 = 0, built = '';
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };

  function layers() {
    let front = document.getElementById('inside-notes'), tv = document.querySelector('#inside-tv .tv-notes');
    if (!tv) {
      tv = document.createElementNS(NS, 'svg');
      tv.setAttribute('class', 'tv-notes'); tv.setAttribute('viewBox', '0 0 990 740');
      tv.setAttribute('preserveAspectRatio', 'none'); tv.setAttribute('aria-hidden', 'true');
      document.querySelector('#inside-tv .mini-band').after(tv);
    }
    return { front, tv };
  }

  // one group of notes per character; rebuilt when the count or shape changes
  function build() {
    const S = N(), { front, tv } = layers();
    front.replaceChildren(); tv.replaceChildren();
    chars = [{ svg: front, cx: GUITARIST.x + GUITARIST.w / 2, cy: GUITARIST.y + GUITARIST.h * .32, w: GUITARIST.w, scale: 1, dir: 1 }];
    document.querySelectorAll('#inside-tv .fig').forEach((f, k) => chars.push({
      svg: tv, cx: f.offsetLeft + f.offsetWidth / 2, cy: f.offsetTop + f.offsetHeight * .4,
      w: f.offsetWidth, scale: f.offsetWidth / GUITARIST.w * 1.4, dir: k % 2 ? -1 : 1
    }));
    chars.forEach(c => {
      c.g = el('g', {}, c.svg);
      c.notes = Array.from({ length: S.count }, (_, i) => el('path', { d: path(S.shape, i, S.effect), 'fill-rule': 'evenodd' }, c.g));
    });
    built = key();
    style();
  }
  function style() {
    const S = N();
    chars.forEach(c => {
      c.g.style.filter = S.glow ? `drop-shadow(0 0 ${(S.glow * Math.min(1, c.scale * 1.6)).toFixed(1)}px ${T.rgba(S.colorA, .9)})` : '';
      c.notes.forEach((n, i) => n.setAttribute('fill', i % 2 ? S.colorB : S.colorA));
    });
  }

  const key = () => { const S = N(); return `${S.count}|${S.shape}|${S.effect}`; };
  const frac = v => v - Math.floor(v);
  // where item i of n sits at time t (seconds), as an offset from the character's centre inside an
  // rx × ry area, with its opacity and scale; depth 0 (back) to 1 (front) for the orbit
  function place(i, n, t, dir, rx, ry) {
    const S = N(), E = T.ease('notes'), lap = reduce ? 0 : t / S.lap;
    if (S.pattern === 'Rise') {
      // float up from below the centre, wobbling, fading in and out
      const u = E(frac(lap + i / n)), x = Math.sin(i * 2.4 + u * 4) * rx * .7;
      return { x, y: ry - u * (ry + rx * 1.1), alpha: Math.sin(Math.PI * Math.min(1, u)), scale: .8 + .3 * u, depth: 1 };
    }
    if (S.pattern === 'Burst') {
      // fly outward from the centre in all directions, fading
      const a = Math.PI * 2 * i / n + i * .3, u = E(frac(lap + (i % 3) / 3));
      return { x: Math.cos(a) * rx * 1.2 * u, y: Math.sin(a) * ry * 1.2 * u, alpha: Math.max(0, 1 - u), scale: .5 + .6 * u, depth: 1 };
    }
    if (S.pattern === 'Twinkle') {
      // scattered around the character, each one fading in and out on its own beat
      const a = i * 2.4, r = .35 + .65 * frac(i * .618), p = E(frac(lap + i * .618));
      const tw = Math.max(0, Math.sin(Math.PI * Math.min(1, p)));
      return { x: Math.cos(a) * rx * r, y: Math.sin(a) * Math.max(ry, rx * .5) * r, alpha: tw, scale: .5 + .6 * tw, depth: 1 };
    }
    const a = dir * (E(frac(lap)) + i / n) * Math.PI * 2, depth = (Math.sin(a) + 1) / 2;
    return { x: Math.cos(a) * rx, y: Math.sin(a) * ry, alpha: .45 + .55 * depth, scale: .7 + .3 * depth, depth };
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const S = N(), t = (now - t0) / 1000;
    if (built !== key()) build();
    pulse *= .9;
    chars.forEach(c => c.notes.forEach((n, i) => {
      const p = place(i, c.notes.length, t, c.dir, c.w * S.orbitWidth / 200, c.w * S.orbitHeight / 200);
      const s = S.size * c.scale * p.scale * (1 + .35 * pulse);
      const tilt = reduce ? 0 : 14 * Math.sin(t * 2 + i);
      n.setAttribute('transform', `translate(${(c.cx + p.x).toFixed(1)} ${(c.cy + p.y).toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(${s.toFixed(2)})`);
      n.setAttribute('opacity', p.alpha.toFixed(2));
    }));
  }

  function start() { built = ''; t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  function stop() { cancelAnimationFrame(raf); chars.forEach(c => c.g.remove()); chars = []; }
  T.onChange(g => { if ((g === null || g === 'notes') && chars.length) style(); });

  return { start, stop, pulse: () => { pulse = 1; }, path, place };
})();
