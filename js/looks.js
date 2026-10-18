// Applies the panel's graphics settings for the band member glow and the dialog box (width,
// frame, colors, entrance curve and the eyes on its corners). Re-applied on every change.
window.Looks = (() => {
  "use strict";
  const T = window.Tuning;
  const style = document.createElement('style');
  style.id = 'looks';
  document.head.appendChild(style);

  // a glow made of `layers` drop-shadows: a tight bright outline, then wider, softer layers
  function glowFilter(G, boost) {
    const parts = [`drop-shadow(0 0 ${(G.width * boost).toFixed(2)}px ${T.rgba(G.color, 1)})`];
    for (let k = 1; k < G.layers; k++) {
      const r = G.spread * boost * k / (G.layers - 1 || 1);
      parts.push(`drop-shadow(0 0 ${r.toFixed(2)}px ${T.rgba(G.color, (.9 - .25 * k / G.layers).toFixed(2))})`);
    }
    return parts.join(' ');
  }

  function apply() {
    const G = T.live.glow, D = T.live.dialog;
    const lo = glowFilter(G, 1), hi = glowFilter(G, 1.7);
    style.textContent = `
      .member.is-next img, .tune-glow-demo { animation: outline-glow 2.2s ${T.cssEase('glow')} infinite alternate; }
      .member.is-next:hover img, .member.is-next:focus-visible img { animation: none; filter: ${glowFilter(G, 2)}; }
      @keyframes outline-glow { from { filter: ${lo}; } to { filter: ${hi}; } }
      @media (prefers-reduced-motion: reduce) {
        .member.is-next img, .tune-glow-demo { animation: none; filter: ${hi}; }
      }
      :root {
        --dlg-width: ${D.width}px;
        --dlg-border: ${D.border}px;
        --dlg-pink: ${D.pink};
        --dlg-cyan: ${D.cyan};
        --dlg-ease: ${T.cssEase('dialog')};
      }`;
    drawEyes(D);
  }

  // the eye outline for a shape, w wide and h tall, centred on 0,0
  function eyePath(shape, w, h) {
    const x = w / 2, y = h / 2;
    if (shape === 'Round') return `M${-x} 0A${x} ${y} 0 1 0 ${x} 0A${x} ${y} 0 1 0 ${-x} 0Z`;
    if (shape === 'Half-closed') return `M${-x} 0Q0 ${-h * .25} ${x} 0Q0 ${h} ${-x} 0Z`;
    return `M${-x} 0Q0 ${-h} ${x} 0Q0 ${h} ${-x} 0Z`;
  }
  // eyes on the box corners, added in this order as the count goes up
  const CORNERS = ['tl', 'br', 'tr', 'bl'];
  function drawEyes(D) {
    const box = document.querySelector('#dialog .dialog-box');
    if (!box) return;
    const NS = 'http://www.w3.org/2000/svg', line = 5, pad = line + 2;
    const w = D.eyeWidth, h = D.eyeHeight, d = eyePath(D.eyeShape, w, h);
    CORNERS.forEach((corner, i) => {
      let svg = box.querySelector(`.dialog-eye[data-corner="${corner}"]`);
      if (!svg) {
        svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'dialog-eye'); svg.setAttribute('data-corner', corner); svg.setAttribute('aria-hidden', 'true');
        box.appendChild(svg);
      }
      svg.style.display = i < D.eyes ? '' : 'none';
      svg.setAttribute('width', w + pad * 2); svg.setAttribute('height', h + pad * 2);
      svg.setAttribute('viewBox', `${-w / 2 - pad} ${-h / 2 - pad} ${w + pad * 2} ${h + pad * 2}`);
      // the pupil is clipped to the eye, so a large pupil fills it instead of spilling out
      svg.innerHTML = `<clipPath id="eye-clip-${corner}"><path d="${d}"/></clipPath>
        <path d="${d}" fill="${D.eyeColor}"/>
        <circle r="${D.pupil / 2}" fill="${D.pupilColor}" clip-path="url(#eye-clip-${corner})"/>
        <path d="${d}" fill="none" stroke="${D.pupilColor}" stroke-width="${line}" stroke-linejoin="round"/>`;
    });
  }
  T.onChange((g) => { if (g === null || g === 'glow' || g === 'dialog') apply(); });
  apply();
  return { eyePath };
})();
