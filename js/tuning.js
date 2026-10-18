// Tunable motion settings for the three interactive components. The SAVED values are the
// prototype's defaults; the control panel (js/panel.js) edits a live copy, and the components
// read it every time they move, so changes show immediately.
window.Tuning = (() => {
  "use strict";

  const SAVED = {
    key: { hold: 400, travel: 6, rebound: 150, motion: 'Ease In-Out' },
    strings: { maxPull: 39, amplitude: 70, decay: 4.7, motion: 'Ease In' },
    paper: { tearDistance: 1000, roughness: 60, shadow: 30, motion: 'Ease In' }
  };

  // what each value means, for the panel and the copied settings
  const SCHEMA = {
    key: {
      title: 'Play key',
      fields: {
        hold: { label: 'Holding duration', unit: 'ms', min: 400, max: 4000, step: 50, hint: 'how long to hold until the key bottoms out' },
        travel: { label: 'Sink distance', unit: 'px', min: 4, max: 30, step: 1, hint: 'how far the key sinks into the panel' },
        rebound: { label: 'Rebound duration', unit: 'ms', min: 150, max: 2000, step: 10, hint: 'how long the key takes to rise after release' }
      }
    },
    strings: {
      title: 'Strings',
      fields: {
        maxPull: { label: 'Maximum pull', unit: 'px', min: 30, max: 140, step: 1, hint: 'how far a string bends before it slips' },
        amplitude: { label: 'Vibration amplitude', unit: '%', min: 25, max: 200, step: 5, hint: 'how wide the string swings when released' },
        decay: { label: 'Vibration decay time', unit: 's', min: .5, max: 8, step: .1, hint: 'how long the vibration takes to fade out' }
      }
    },
    paper: {
      title: 'Paper screen',
      fields: {
        tearDistance: { label: 'Drag to complete tear', unit: 'px', min: 400, max: 4000, step: 50, hint: 'total outward pull needed to rip the screen open' },
        roughness: { label: 'Tear edge roughness', unit: '%', min: 0, max: 250, step: 5, hint: 'how jagged and fibrous the torn edge is' },
        shadow: { label: 'Fold shadow', unit: '%', min: 0, max: 100, step: 5, hint: 'darkness of the shadow under the curled flap' }
      }
    }
  };

  const MOTIONS = ['Linear', 'Ease In', 'Ease Out', 'Ease In-Out', 'Spring/Bounce'];
  // each curve maps progress 0..1 to 0..1; Spring overshoots and settles
  const EASE = {
    'Linear': t => t,
    'Ease In': t => t * t * t,
    'Ease Out': t => 1 - Math.pow(1 - t, 3),
    'Ease In-Out': t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    'Spring/Bounce': t => t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(t * Math.PI * 3.5)
  };

  const clone = o => JSON.parse(JSON.stringify(o));
  const live = clone(SAVED);
  const listeners = new Set();

  function set(group, key, value) {
    live[group][key] = value;
    listeners.forEach(fn => fn(group, key, value));
  }
  function restore() {
    for (const g in SAVED) for (const k in SAVED[g]) live[g][k] = SAVED[g][k];
    listeners.forEach(fn => fn(null));
  }
  const ease = group => EASE[live[group].motion] || EASE.Linear;
  // the progress at which a curve first reaches value v (for continuing a move part-way)
  function invert(fn, v) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; fn(m) < v ? lo = m : hi = m; }
    return (lo + hi) / 2;
  }

  return { SAVED, SCHEMA, MOTIONS, EASE, live, set, restore, ease, invert, onChange: fn => listeners.add(fn) };
})();
