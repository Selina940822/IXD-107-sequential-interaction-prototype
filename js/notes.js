// Music notes orbiting the characters in the world inside the TV: the star-headed guitarist and
// the four members on the small TV. Count, shape, size, orbit, speed, glow and colors come from
// Tuning.live.notes; the orbit follows the section's motion curve, and notes pop on each beat.
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
  const path = (shape, i) => SHAPES[shape === 'Mixed' ? KINDS[i % KINDS.length] : shape] || SHAPES['Eighth note'];

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
      c.notes = Array.from({ length: S.count }, (_, i) => el('path', { d: path(S.shape, i) }, c.g));
    });
    built = `${S.count}|${S.shape}`;
    style();
  }
  function style() {
    const S = N();
    chars.forEach(c => {
      c.g.style.filter = S.glow ? `drop-shadow(0 0 ${(S.glow * Math.min(1, c.scale * 1.6)).toFixed(1)}px ${T.rgba(S.colorA, .9)})` : '';
      c.notes.forEach((n, i) => n.setAttribute('fill', i % 2 ? S.colorB : S.colorA));
    });
  }

  // where note i of n sits at time t (seconds): angle, depth 0 (back) to 1 (front)
  function place(i, n, t, dir) {
    const S = N(), lap = reduce ? 0 : (t / S.lap) % 1;
    const a = dir * (T.ease('notes')(lap) + i / n) * Math.PI * 2;
    return { a, x: Math.cos(a), y: Math.sin(a), depth: (Math.sin(a) + 1) / 2 };
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const S = N(), t = (now - t0) / 1000;
    if (built !== `${S.count}|${S.shape}`) build();
    pulse *= .9;
    chars.forEach(c => c.notes.forEach((n, i) => {
      const p = place(i, c.notes.length, t, c.dir);
      const rx = c.w * S.orbitWidth / 200, ry = c.w * S.orbitHeight / 200;
      const s = S.size * c.scale * (.7 + .3 * p.depth) * (1 + .35 * pulse);
      const tilt = reduce ? 0 : 14 * Math.sin(t * 2 + i);
      n.setAttribute('transform', `translate(${(c.cx + rx * p.x).toFixed(1)} ${(c.cy + ry * p.y).toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(${s.toFixed(2)})`);
      n.setAttribute('opacity', (.45 + .55 * p.depth).toFixed(2));
    }));
  }

  function start() { built = ''; t0 = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  function stop() { cancelAnimationFrame(raf); chars.forEach(c => c.g.remove()); chars = []; }
  T.onChange(g => { if ((g === null || g === 'notes') && chars.length) style(); });

  return { start, stop, pulse: () => { pulse = 1; }, path, place };
})();
