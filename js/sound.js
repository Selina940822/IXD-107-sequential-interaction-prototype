// Shared Web Audio context for the study sound effects, and the Lilacs music chain.
// Outside the TV the music runs through a low-pass filter (slightly muffled); inside it opens up.
window.Sound = (() => {
  "use strict";
  let ctx = null, filter = null, gain = null, source = null, analyser = null, bins = null;
  const music = document.getElementById('music');
  const MUFFLED_HZ = 950, CLEAR_HZ = 20000;

  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function chain() {
    const a = audio(); if (!a || source) return a;
    try {
      source = a.createMediaElementSource(music);
      filter = a.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = .7; filter.frequency.value = MUFFLED_HZ;
      gain = a.createGain(); gain.gain.value = .85;
      analyser = a.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = .6;
      bins = new Uint8Array(analyser.frequencyBinCount);
      source.connect(filter).connect(gain).connect(analyser).connect(a.destination);
    } catch (e) { source = null; }
    return a;
  }

  function startMusic() {
    const a = chain();
    if (a && filter) {
      filter.frequency.cancelScheduledValues(a.currentTime);
      filter.frequency.setValueAtTime(MUFFLED_HZ, a.currentTime);
      gain.gain.setValueAtTime(.85, a.currentTime);
    }
    music.currentTime = 0;
    const p = music.play(); if (p && p.catch) p.catch(() => {});
  }

  // entering the TV world: the filter opens over a couple of seconds
  function clearMusic(ms = 2400) {
    const a = audio(); if (!a || !filter) return;
    const t = a.currentTime;
    filter.frequency.cancelScheduledValues(t);
    filter.frequency.setValueAtTime(filter.frequency.value, t);
    filter.frequency.exponentialRampToValueAtTime(CLEAR_HZ, t + ms / 1000);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(1, t + ms / 1000);
  }

  function stopMusic() {
    music.pause();
    music.currentTime = 0;
    if (ctx && filter) {
      filter.frequency.cancelScheduledValues(ctx.currentTime);
      filter.frequency.setValueAtTime(MUFFLED_HZ, ctx.currentTime);
    }
  }

  // the "ka-da" click taken from the reference recording (tools/extract-click.py)
  let clickBuf = null, clickLoad = null;
  function loadClick() {
    const a = audio(); if (!a || clickLoad) return clickLoad;
    clickLoad = fetch('assets/audio/dialog-click.mp3').then(r => r.arrayBuffer())
      .then(b => new Promise((res, rej) => a.decodeAudioData(b, res, rej)))
      .then(buf => { clickBuf = buf; return buf; })
      .catch(() => { clickLoad = null; });
    return clickLoad;
  }
  function playClick() {
    const a = audio(); if (!a) return;
    const go = buf => { const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; g.gain.value = .9; s.connect(g).connect(a.destination); s.start(); };
    if (clickBuf) go(clickBuf); else { const p = loadClick(); if (p) p.then(b => b && go(b)); }
  }

  // the music's low-end energy right now, 0..1 (null when there is no audio to measure)
  function level() {
    if (!analyser || music.paused) return null;
    analyser.getByteFrequencyData(bins);
    let s = 0; for (let i = 1; i < 10; i++) s += bins[i];
    return s / (9 * 255);
  }

  // the spectrum split into n bands, each 0..1 (null when there is no audio to measure)
  function bands(n) {
    if (!analyser || music.paused) return null;
    analyser.getByteFrequencyData(bins);
    const out = new Array(n), top = 120;               // bins above ~11 kHz carry little in this track
    for (let i = 0; i < n; i++) {
      const a = Math.floor(Math.pow(i / n, 1.6) * top) + 1, b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.6) * top) + 1);
      let s = 0; for (let j = a; j < b; j++) s += bins[j];
      out[i] = s / ((b - a) * 255);
    }
    return out;
  }

  return { audio, startMusic, clearMusic, stopMusic, loadClick, playClick, level, bands };
})();
