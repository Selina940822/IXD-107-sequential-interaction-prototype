// Shared Web Audio context for the study sound effects, and the Lilacs music chain.
// Outside the TV the music runs through a low-pass filter (slightly muffled); inside it opens up.
window.Sound = (() => {
  "use strict";
  let ctx = null, filter = null, gain = null, source = null;
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
      source.connect(filter).connect(gain).connect(a.destination);
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

  return { audio, startMusic, clearMusic, stopMusic };
})();
