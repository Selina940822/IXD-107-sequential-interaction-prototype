// Spotlights in the first room: beams from above that sweep across the TV. Count, width,
// sweep, speed, brightness and colors come from Tuning.live.spots; the swing follows its curve.
window.Spots = (() => {
  "use strict";
  const T = window.Tuning, NS = 'http://www.w3.org/2000/svg';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const svg = document.getElementById('room-spots'), room = document.getElementById('scene-room');
  const TV = [997, 586];                          // the beams aim at the TV, in stage pixels
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  let beams = [], built = '', t0 = performance.now();

  // where spotlight i of n hangs, and its swing angle (degrees) at time t (seconds)
  const source = (i, n) => [2000 * (i + 1) / (n + 1), -40];
  function angle(i, n, t) {
    const S = T.live.spots, [x, y] = source(i, n);
    const aim = Math.atan2(TV[0] - x, TV[1] - y) * -180 / Math.PI;
    if (reduce) return aim;
    // back and forth: each half of the swing follows the motion curve
    const u = ((t / S.lap) + i * .37) % 1, half = u < .5 ? u * 2 : 2 - u * 2;
    return aim + S.sweep * (2 * T.ease('spots')(half) - 1);
  }

  function build() {
    const S = T.live.spots;
    svg.replaceChildren();
    const defs = el('defs', {}, svg);
    const blur = el('filter', { id: 'spot-blur', x: '-20%', y: '-5%', width: '140%', height: '110%' }, defs);
    el('feGaussianBlur', { stdDeviation: 14 }, blur);
    beams = Array.from({ length: S.count }, (_, i) => {
      const c = i % 2 ? S.colorB : S.colorA, id = `spot-g${i}`;
      const g = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: 0, 'stop-color': c, 'stop-opacity': .95 }, g);
      el('stop', { offset: .75, 'stop-color': c, 'stop-opacity': .35 }, g);
      el('stop', { offset: 1, 'stop-color': c, 'stop-opacity': 0 }, g);
      const [x, y] = source(i, S.count), L = 1300, w = S.width / 2;
      const grp = el('g', {}, svg);
      el('polygon', { points: `${x - 14},${y} ${x + 14},${y} ${x + w},${y + L} ${x - w},${y + L}`, fill: `url(#${id})`, filter: 'url(#spot-blur)' }, grp);
      el('ellipse', { cx: x, cy: y + 4, rx: 30, ry: 14, fill: c, opacity: .9 }, grp);
      return { grp, x, y };
    });
    built = `${S.count}|${S.width}|${S.colorA}|${S.colorB}`;
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (!room.classList.contains('is-active') || document.hidden) return;
    const S = T.live.spots;
    if (built !== `${S.count}|${S.width}|${S.colorA}|${S.colorB}`) build();
    svg.style.opacity = S.brightness / 100;
    const t = (now - t0) / 1000;
    beams.forEach((b, i) => b.grp.setAttribute('transform', `rotate(${angle(i, beams.length, t).toFixed(2)} ${b.x} ${b.y})`));
  }
  requestAnimationFrame(tick);
  return { source, angle };
})();
