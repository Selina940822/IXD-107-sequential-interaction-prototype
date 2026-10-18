// Applies the panel's graphics settings that live in CSS: the band member glow and the dialog
// box (width, frame, colors, doodles and entrance curve). Re-applied on every change.
(() => {
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
    // doodles appear in this order as the count goes up
    const order = ['star', 'bolt', 'eyes', 'lines'];
    document.querySelectorAll('.doodle').forEach(d => {
      d.style.display = order.indexOf(d.dataset.doodle) < D.doodles ? '' : 'none';
    });
  }
  T.onChange((g) => { if (g === null || g === 'glow' || g === 'dialog') apply(); });
  apply();
})();
