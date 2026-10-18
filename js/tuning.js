// Tunable settings for the prototype. The SAVED values are the prototype's defaults; the
// control panel (js/panel.js) edits a live copy, and the components read it every time they
// move or redraw, so changes show immediately.
window.Tuning = (() => {
  "use strict";

  const SAVED = {
    // motion
    key: { hold: 400, travel: 6, rebound: 150, motion: 'Spring/Bounce' },
    strings: { maxPull: 39, amplitude: 70, decay: 4.7, motion: 'Linear' },
    paper: { tearDistance: 1000, roughness: 60, shadow: 30, motion: 'Ease In' },
    // graphics
    spots: { count: 1, width: 800, sweep: 0, lap: 7, brightness: 50, colorA: '#ff7ac0', colorB: '#7ff6ff', motion: 'Ease In-Out' },
    stringsLook: { count: 6, length: 100, width: 60, colorMode: 'Single', color: '#d6dede', colorB: '#f0478c', glowColor: '#ff96c4', chord: 'D minor' },
    paperLook: { fibres: 35, fibreLength: 6, fibreWidth: 1, paperColor: '#eeeeee', fibreColor: '#fafafa' },
    glow: { layers: 3, spread: 11, width: 1.5, color: '#fbffcc', motion: 'Ease In-Out' },
    dialog: { width: 480, border: 3, pink: '#f08cb3', cyan: '#5fb9c0', eyes: 2, eyeShape: 'Almond', eyeWidth: 68, eyeHeight: 30, pupil: 25, eyeColor: '#ffffff', pupilColor: '#222222', motion: 'Spring/Bounce' },
    effects: { columns: 80, rows: 9, dotSize: 7, ringOrigin: 'Strumming hand', ringsPerBeat: 0, ringSize: 100, ringWidth: 15, colorA: '#ff6fae', colorB: '#6ff3fb', motion: 'Ease Out' },
    notes: { effect: 'Orbiting notes', pattern: 'Rise', count: 3, shape: 'Mixed', size: 47, orbitWidth: 275, orbitHeight: 25, lap: 6, glow: 7, colorA: '#ffffff', colorB: '#ff6fae', motion: 'Linear' },
    // transitions between scenes
    toTv: { method: 'Zoom', duration: 2600, motion: 'Ease In-Out' },
    toStrings: { method: 'Zoom', duration: 2400, motion: 'Ease In-Out' },
    toInside: { method: 'Zoom', duration: 2200, motion: 'Ease In-Out' },
    toRestart: { method: 'Fade', duration: 900, motion: 'Ease Out' }
  };

  // the six notes of each chord, low E string first
  const CHORD_NOTES = {
    'Open strings': 'E2 A2 D3 G3 B3 E4',
    'E major': 'E2 B2 E3 G#3 B3 E4',
    'E minor': 'E2 B2 E3 G3 B3 E4',
    'E7': 'E2 B2 D3 G#3 B3 E4',
    'Em7': 'E2 B2 D3 G3 B3 E4',
    'A major': 'E2 A2 E3 A3 C#4 E4',
    'A minor': 'E2 A2 E3 A3 C4 E4',
    'A7': 'E2 A2 E3 G3 C#4 E4',
    'Asus2': 'E2 A2 E3 A3 B3 E4',
    'C major': 'E2 C3 E3 G3 C4 E4',
    'C7': 'E2 C3 E3 A#3 C4 E4',
    'Cadd9': 'E2 C3 E3 G3 D4 E4',
    'D major': 'D2 A2 D3 A3 D4 F#4',
    'D minor': 'D2 A2 D3 A3 D4 F4',
    'Dsus4': 'D2 A2 D3 A3 D4 G4',
    'F major': 'F2 C3 F3 A3 C4 F4',
    'G major': 'G2 B2 D3 G3 B3 G4',
    'G7': 'G2 B2 D3 G3 B3 F4',
    'B minor': 'F#2 B2 F#3 B3 D4 F#4',
    'E5 power chord': 'E2 B2 E3 B3 E4 B4'
  };
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const hz = n => { const m = /^([A-G])(#?)(\d)$/.exec(n); return +(440 * Math.pow(2, (12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] ? 1 : 0) - 69) / 12)).toFixed(2); };
  const NOTES = Object.fromEntries(Object.entries(CHORD_NOTES).map(([k, v]) => [k, v.split(' ').map(x => x.replace('#', '♯'))]));
  const CHORDS = Object.fromEntries(Object.entries(CHORD_NOTES).map(([k, v]) => [k, v.split(' ').map(hz)]));

  const TRANSITIONS = ['Zoom', 'Fade', 'Iris', 'Wipe', 'Slide', 'Blur', 'Flash'];

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
    spots: {
      title: 'Room spotlights', tab: 'graphics', motion: 'spots', step: 'room',
      fields: {
        count: { label: 'Number of spotlights', unit: '', min: 0, max: 6, step: 1, hint: 'beams shining down on the TV in the first room' },
        width: { label: 'Beam width', unit: 'px', min: 100, max: 800, step: 10, hint: 'width of each beam where it reaches the floor' },
        sweep: { label: 'Sweep angle', unit: '°', min: 0, max: 45, step: 1, hint: 'how far each beam swings to either side' },
        lap: { label: 'Sweep time', unit: 's', min: 2, max: 20, step: .5, hint: 'time for one swing across and back' },
        brightness: { label: 'Brightness', unit: '%', min: 10, max: 100, step: 5, hint: 'strength of the light' },
        colorA: { label: 'Color A', type: 'color' },
        colorB: { label: 'Color B', type: 'color' }
      }
    },
    stringsLook: {
      title: 'Strings', tab: 'graphics', motion: 'strings', step: 'strum',
      fields: {
        count: { label: 'Number of strings', unit: '', min: 1, max: 6, step: 1, hint: 'how many of the six strings are drawn and playable' },
        length: { label: 'String length', unit: '%', min: 40, max: 100, step: 5, hint: 'length along the neck, shortened from both ends' },
        width: { label: 'String width', unit: '%', min: 50, max: 300, step: 10, hint: 'thickness of every string' },
        colorMode: { label: 'Color style', type: 'select', options: ['Single', 'Gradient', 'Rainbow'], hint: 'one color, a blend from color to second color across the strings, or a rainbow' },
        color: { label: 'String color', type: 'color' },
        colorB: { label: 'Second color (gradient)', type: 'color' },
        glowColor: { label: 'Glow color', type: 'color' },
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
        width: { label: 'Box width', unit: 'px', min: 480, max: 960, step: 10, hint: 'width of the box before it is scaled next to a member' },
        border: { label: 'Border thickness', unit: 'px', min: 1, max: 8, step: .5, hint: 'thickness of the pink frame' },
        pink: { label: 'Frame and text color', type: 'color' },
        cyan: { label: 'Offset frame color', type: 'color' },
        eyes: { label: 'Eyes on the corners', unit: '', min: 0, max: 4, step: 1, hint: 'top left, bottom right, top right, bottom left, added in that order' },
        eyeShape: { label: 'Eye shape', type: 'select', options: ['Almond', 'Round', 'Half-closed'], hint: 'the outline of each eye' },
        eyeWidth: { label: 'Eye width', unit: 'px', min: 30, max: 140, step: 2, hint: 'width of each eye' },
        eyeHeight: { label: 'Eye height', unit: 'px', min: 12, max: 80, step: 2, hint: 'height of each eye when open' },
        pupil: { label: 'Pupil size', unit: 'px', min: 6, max: 40, step: 1, hint: 'diameter of the pupil' },
        eyeColor: { label: 'Eye color', type: 'color' },
        pupilColor: { label: 'Pupil and outline color', type: 'color' }
      }
    },
    effects: {
      title: 'Final-scene lights', tab: 'graphics', motion: 'effects', step: 'inside',
      fields: {
        columns: { label: 'Equalizer columns', unit: '', min: 12, max: 96, step: 1, hint: 'number of dot columns along the floor' },
        rows: { label: 'Column height', unit: 'dots', min: 3, max: 16, step: 1, hint: 'how many dots a column can light' },
        dotSize: { label: 'Dot size', unit: 'px', min: 3, max: 14, step: .5, hint: 'radius of the largest dots' },
        ringOrigin: { label: 'Ring layout', type: 'select', options: ['Strumming hand', 'Fretting hand', 'Both hands', 'Star head'], hint: 'where the beat rings start' },
        ringsPerBeat: { label: 'Rings per beat', unit: '', min: 0, max: 5, step: 1, hint: 'how many rings ripple out on each beat' },
        ringSize: { label: 'Ring size', unit: '%', min: 30, max: 200, step: 5, hint: 'how far the rings spread' },
        ringWidth: { label: 'Ring width', unit: 'px', min: 4, max: 40, step: 1, hint: 'line width of the rings' },
        colorA: { label: 'Color A', type: 'color' },
        colorB: { label: 'Color B', type: 'color' }
      }
    },
    notes: {
      title: 'Character effects', tab: 'graphics', motion: 'notes', step: 'inside',
      fields: {
        effect: { label: 'Effect', type: 'select', options: ['Orbiting notes', 'Sparkles', 'Hearts', 'Stars', 'Bubbles', 'Petals', 'Mixed shapes'], hint: 'what moves around the guitarist and each member on the small TV' },
        pattern: { label: 'Movement', type: 'select', options: ['Orbit', 'Rise', 'Burst', 'Twinkle'], hint: 'circle the character, float upward, fly outward, or twinkle in place' },
        count: { label: 'Amount per character', unit: '', min: 0, max: 16, step: 1, hint: 'how many shapes each character gets' },
        shape: { label: 'Note shape', type: 'select', options: ['Eighth note', 'Beamed notes', 'Quarter note', 'Sixteenth notes', 'Mixed'], hint: 'which note symbol, when the effect is Orbiting notes' },
        size: { label: 'Size', unit: 'px', min: 12, max: 80, step: 1, hint: 'height of a shape at the guitarist; smaller around the TV band' },
        orbitWidth: { label: 'Spread width', unit: '%', min: 60, max: 300, step: 5, hint: 'width of the area the shapes move in, against the character’s width' },
        orbitHeight: { label: 'Spread height', unit: '%', min: 10, max: 150, step: 5, hint: 'height of that area, against the character’s width' },
        lap: { label: 'Cycle time', unit: 's', min: 2, max: 20, step: .5, hint: 'how long one orbit, rise, burst or twinkle takes' },
        glow: { label: 'Glow', unit: 'px', min: 0, max: 20, step: 1, hint: 'soft light around each shape' },
        colorA: { label: 'Color A', type: 'color' },
        colorB: { label: 'Color B', type: 'color' }
      }
    },
    toTv: {
      title: 'Room → TV', tab: 'transitions', motion: 'toTv', step: 't-toTv',
      fields: {
        method: { label: 'Transition', type: 'select', options: TRANSITIONS, hint: 'how one scene changes into the next' },
        duration: { label: 'Duration', unit: 'ms', min: 300, max: 5000, step: 100, hint: 'how long the change takes' }
      }
    },
    toStrings: {
      title: 'Guitarist → strings', tab: 'transitions', motion: 'toStrings', step: 't-toStrings',
      fields: {
        method: { label: 'Transition', type: 'select', options: TRANSITIONS, hint: 'how one scene changes into the next' },
        duration: { label: 'Duration', unit: 'ms', min: 300, max: 5000, step: 100, hint: 'how long the change takes' }
      }
    },
    toInside: {
      title: 'Tear → world inside', tab: 'transitions', motion: 'toInside', step: 't-toInside',
      fields: {
        method: { label: 'Transition', type: 'select', options: TRANSITIONS, hint: 'how one scene changes into the next' },
        duration: { label: 'Duration', unit: 'ms', min: 300, max: 5000, step: 100, hint: 'how long the change takes' }
      }
    },
    toRestart: {
      title: 'Restart → room', tab: 'transitions', motion: 'toRestart', step: 't-toRestart',
      fields: {
        method: { label: 'Transition', type: 'select', options: TRANSITIONS, hint: 'how one scene changes into the next' },
        duration: { label: 'Duration', unit: 'ms', min: 300, max: 5000, step: 100, hint: 'how long the change takes' }
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
  // color of string i (0 = low E) for the chosen style
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  function stringColor(i) {
    const L = live.stringsLook, u = i / 5;
    if (L.colorMode === 'Rainbow') { const h = i * 55, f = n => { const k = (n + h / 30) % 12; return 255 * (.72 - .26 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return hex(f(0), f(8), f(4)); }
    if (L.colorMode === 'Gradient') { const p = parseInt(L.color.slice(1), 16), q = parseInt(L.colorB.slice(1), 16), c = s => (p >> s & 255) * (1 - u) + (q >> s & 255) * u; return hex(c(16), c(8), c(0)); }
    return L.color;
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };

  return { SAVED, SCHEMA, MOTIONS, EASE, CHORDS, NOTES, TRANSITIONS, stringColor, live, set, restore, ease, cssEase, invert, rgba, onChange: fn => listeners.add(fn) };
})();
