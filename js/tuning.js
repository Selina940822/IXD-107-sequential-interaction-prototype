// Tunable settings for the prototype. The SAVED values are the prototype's defaults; the
// control panel (js/panel.js) edits a live copy, and the components read it every time they
// move or redraw, so changes show immediately.
window.Tuning = (() => {
  "use strict";

  const SAVED = {
    // motion
    key: { hold: 400, travel: 6, rebound: 150, motion: 'Ease In-Out' },
    strings: { maxPull: 39, amplitude: 70, decay: 4.7, motion: 'Linear' },
    paper: { tearDistance: 1000, roughness: 60, shadow: 30, motion: 'Ease In' },
    // graphics
    stringsLook: { count: 6, length: 100, width: 60, color: '#d6dede', chord: 'E minor' },
    paperLook: { fibres: 35, fibreLength: 6, fibreWidth: 1, paperColor: '#eeeeee', fibreColor: '#fafafa' },
    glow: { layers: 3, spread: 11, width: 1.5, color: '#fbffcc', motion: 'Ease In-Out' },
    dialog: { doodles: 0, width: 480, border: 3.5, pink: '#f08cb3', cyan: '#5fb9c0', motion: 'Spring/Bounce' },
    effects: { columns: 69, rows: 9, dotSize: 6.5, ringWidth: 32, colorA: '#ff6fae', colorB: '#6ff3fb', motion: 'Ease Out' }
  };

  // the six notes of each chord, low E string first (Hz)
  const CHORDS = {
    'Open strings': [82.41, 110, 146.83, 196, 246.94, 329.63],
    'E major': [82.41, 123.47, 164.81, 207.65, 246.94, 329.63],
    'E minor': [82.41, 123.47, 164.81, 196, 246.94, 329.63],
    'A minor': [82.41, 110, 164.81, 220, 261.63, 329.63],
    'C major': [82.41, 130.81, 164.81, 196, 261.63, 329.63],
    'G major': [98, 123.47, 146.83, 196, 246.94, 392],
    'D major': [73.42, 110, 146.83, 220, 293.66, 369.99]
  };
  const NOTE_NAMES = { 73.42: 'D2', 82.41: 'E2', 98: 'G2', 110: 'A2', 123.47: 'B2', 130.81: 'C3', 146.83: 'D3', 164.81: 'E3', 196: 'G3', 207.65: 'G♯3', 220: 'A3', 246.94: 'B3', 261.63: 'C4', 293.66: 'D4', 329.63: 'E4', 369.99: 'F♯4', 392: 'G4' };

  // what each value means, for the panel and the copied settings, in panel order;
  // `motion` names the group whose motion curve the section shows (shared where it repeats)
  const SCHEMA = {
    key: {
      title: 'Play key', tab: 'motion', motion: 'key', step: 'play',
      fields: {
        hold: { label: 'Holding duration', unit: 'ms', min: 400, max: 4000, step: 50, hint: 'how long to hold until the key bottoms out' },
        travel: { label: 'Sink distance', unit: 'px', min: 4, max: 30, step: 1, hint: 'how far the key sinks into the panel' },
        rebound: { label: 'Rebound duration', unit: 'ms', min: 150, max: 2000, step: 10, hint: 'how long the key takes to rise after release' }
      }
    },
    strings: {
      title: 'Strings', tab: 'motion', motion: 'strings', step: 'strum',
      fields: {
        maxPull: { label: 'Maximum pull', unit: 'px', min: 30, max: 140, step: 1, hint: 'how far a string bends before it slips' },
        amplitude: { label: 'Vibration amplitude', unit: '%', min: 25, max: 200, step: 5, hint: 'how wide the string swings when released' },
        decay: { label: 'Vibration decay time', unit: 's', min: .5, max: 8, step: .1, hint: 'how long the vibration takes to fade out' }
      }
    },
    paper: {
      title: 'Paper screen', tab: 'motion', motion: 'paper', step: 'tear',
      fields: {
        tearDistance: { label: 'Drag to complete tear', unit: 'px', min: 400, max: 4000, step: 50, hint: 'total outward pull needed to rip the screen open' },
        roughness: { label: 'Tear edge roughness', unit: '%', min: 0, max: 250, step: 5, hint: 'how jagged and fibrous the torn edge is' },
        shadow: { label: 'Fold shadow', unit: '%', min: 0, max: 100, step: 5, hint: 'darkness of the shadow under the curled flap' }
      }
    },
    stringsLook: {
      title: 'Strings', tab: 'graphics', motion: 'strings', step: 'strum',
      fields: {
        count: { label: 'Number of strings', unit: '', min: 1, max: 6, step: 1, hint: 'how many of the six strings are drawn and playable' },
        length: { label: 'String length', unit: '%', min: 40, max: 100, step: 5, hint: 'length along the neck, shortened from both ends' },
        width: { label: 'String width', unit: '%', min: 50, max: 300, step: 10, hint: 'thickness of every string' },
        color: { label: 'String color', type: 'color' },
        chord: { label: 'Chord', type: 'select', options: Object.keys(CHORDS), hint: 'the notes the six strings play' }
      }
    },
    paperLook: {
      title: 'Paper tear', tab: 'graphics', motion: 'paper', step: 'tear',
      fields: {
        fibres: { label: 'Loose fibres', unit: '', min: 0, max: 200, step: 5, hint: 'number of paper fibres hanging from the torn edge' },
        fibreLength: { label: 'Fibre length', unit: 'px', min: 2, max: 30, step: 1, hint: 'how far each fibre reaches into the hole' },
        fibreWidth: { label: 'Fibre width', unit: 'px', min: .5, max: 4, step: .5, hint: 'thickness of each fibre' },
        paperColor: { label: 'Torn edge color', type: 'color' },
        fibreColor: { label: 'Fibre color', type: 'color' }
      }
    },
    glow: {
      title: 'Band member glow', tab: 'graphics', motion: 'glow', step: 'band',
      fields: {
        layers: { label: 'Glow layers', unit: '', min: 1, max: 5, step: 1, hint: 'number of stacked glows around the outline' },
        spread: { label: 'Glow spread', unit: 'px', min: 2, max: 30, step: 1, hint: 'how far the glow reaches from the outline' },
        width: { label: 'Outline width', unit: 'px', min: .5, max: 6, step: .5, hint: 'thickness of the bright line along the outline' },
        color: { label: 'Glow color', type: 'color' }
      }
    },
    dialog: {
      title: 'Dialog box', tab: 'graphics', motion: 'dialog', step: 'band',
      fields: {
        doodles: { label: 'Doodles around the box', unit: '', min: 0, max: 4, step: 1, hint: 'star, lightning, eyes and lines, added in that order' },
        width: { label: 'Box width', unit: 'px', min: 480, max: 960, step: 10, hint: 'width of the box before it is scaled next to a member' },
        border: { label: 'Border thickness', unit: 'px', min: 1, max: 8, step: .5, hint: 'thickness of the pink frame' },
        pink: { label: 'Frame and text color', type: 'color' },
        cyan: { label: 'Offset frame color', type: 'color' }
      }
    },
    effects: {
      title: 'Final-scene lights', tab: 'graphics', motion: 'effects', step: 'inside',
      fields: {
        columns: { label: 'Equalizer columns', unit: '', min: 12, max: 96, step: 1, hint: 'number of dot columns along the floor' },
        rows: { label: 'Column height', unit: 'dots', min: 3, max: 16, step: 1, hint: 'how many dots a column can light' },
        dotSize: { label: 'Dot size', unit: 'px', min: 3, max: 14, step: .5, hint: 'radius of the largest dots' },
        ringWidth: { label: 'Ring width', unit: 'px', min: 4, max: 40, step: 1, hint: 'line width of the rings from the star' },
        colorA: { label: 'Color A', type: 'color' },
        colorB: { label: 'Color B', type: 'color' }
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
  // the same curve as a CSS easing, for CSS and Web Animations
  const cssEase = group => {
    const f = ease(group), pts = [];
    for (let i = 0; i <= 32; i++) pts.push(+f(i / 32).toFixed(4));
    return `linear(${pts.join(', ')})`;
  };
  // the progress at which a curve first reaches value v (for continuing a move part-way)
  function invert(fn, v) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; fn(m) < v ? lo = m : hi = m; }
    return (lo + hi) / 2;
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };

  return { SAVED, SCHEMA, MOTIONS, EASE, CHORDS, NOTE_NAMES, live, set, restore, ease, cssEase, invert, rgba, onChange: fn => listeners.add(fn) };
})();
