// Strum the Strings — adapted from strum-the-strings/index.html.
// Same behaviour: grab a string and bend it (elastic limit), release to pluck (Karplus–Strong
// tone, brighter the further it was bent); sweep across several strings to strum; pull too far
// and the string slips into a strum. A full pluck or a strong strum makes the paper behind the
// strings tear open along a slit. Changes here: the photo keeps its colour, the strings glow
// softly, the cursor is the pink star (with shards over the strings), and the sequence moves on
// once the slit has fully opened.
window.Strum = (() => {
  "use strict";
  const IW = 1393, IH = 1011;                 // the frame the string geometry is drawn in
  const FW = 990, FH = 740;                   // the TV screen the canvas fills
  const S = Math.max(FW / IW, FH / IH);       // cover-fit of that frame into the screen
  const OX = (FW - IW * S) / 2, OY = (FH - IH * S) / 2;
  // draws the vector close-up at an exact pixel size, so the canvas never scales a bitmap up
  function svgImage(text, w, h){
    const doc = text.replace(/<svg([^>]*?) width="[\d.]+" height="[\d.]+"/, `<svg$1 width="${Math.round(w)}" height="${Math.round(h)}"`);
    const url = URL.createObjectURL(new Blob([doc], { type: 'image/svg+xml' }));
    // rendered once into an offscreen canvas, so the vector file isn't re-drawn every frame
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c);
    }; im.onerror = rej; im.src = url; });
  }
  const STAR = 'url("assets/images/cursor-star.svg") 16 16, pointer';
  const SHARDS = 'url("assets/images/cursor-star-shards.svg") 24 24, pointer';

  function create(canvas, { onDone }) {
    const ctx = canvas.getContext('2d');

    /* ---------- strings (geometry comes from the SVG) ---------- */
    const N = 72;                      // nodes per string
    const MAX_D = 72;                  // bend limit (image px)
    const PLUCK_MIN = 30;              // bend needed for a full pluck
    const FREQS = [82.41,110,146.83,196,246.94,329.63];
    let strings = [], surface = null, ready = false, running = false, finished = false;

    function makeString(i, x1, y1, x2, y2, w){
      const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx,dy);
      return { i, x1, y1, x2, y2, w, len, ux:dx/len, uy:dy/len, nx:-dy/len, ny:dx/len,
        y:new Float32Array(N), v:new Float32Array(N), steps: 9 + i*1.6, damp: .9988 - i*.00008,
        hover:0, held:false, grabT:.5, d:0, raw:0, moved:0 };
    }

    const loaded = fetch('assets/images/guitar-closeup-strings.svg').then(r => r.text()).then(txt => {
      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      const paths = [...doc.querySelectorAll('[id^="string-"]')];
      strings = paths.map((p,i) => {
        const n = (p.getAttribute('d').match(/-?\d+(\.\d+)?/g) || []).map(Number);
        return makeString(i, n[0], n[1], n[2], n[3], parseFloat(p.getAttribute('stroke-width')) || 2);
      });
      return fetch('assets/images/guitar-closeup.svg').then(r => r.text());
    }).then(text => {
      guitarSVG = text; ready = true; resize();
    }).catch(err => console.error('Could not load the guitar close-up', err));
    let guitarSVG = null, rasterW = 0;
    function rerender(){
      const w = canvas.width; if(!guitarSVG || !w || w === rasterW) return;
      rasterW = w; const c = w / FW;
      svgImage(guitarSVG, IW * S * c, IH * S * c).then(im => { if(canvas.width === w) surface = im; });
    }

    /* ---------- slit ---------- */
    let slit = 0, slitTarget = 0, slitStart = 0;
    function slitCenter(){
      const a = strings[2], b = strings[3];
      return { x:(a.x1+a.x2+b.x1+b.x2)/4, y:(a.y1+a.y2+b.y1+b.y2)/4, ang:Math.atan2(a.y2-a.y1, a.x2-a.x1) };
    }

    /* ---------- torn-paper slit ---------- */
    const TM = 160, TEAR_L = 250, TEAR_W = 26;
    let tear = null;
    function makeTear(){
      const c = new Float32Array(TM), nT = new Float32Array(TM), nB = new Float32Array(TM), fT = new Float32Array(TM), fB = new Float32Array(TM);
      let w = 0, v = 0;
      for(let m=0;m<TM;m++){ v = v*.82 + (Math.random()-.5)*1.6; w += v; c[m] = w; }
      const mean = c.reduce((a,b)=>a+b,0)/TM; for(let m=0;m<TM;m++) c[m] = (c[m]-mean)*.55;
      let jag = 0;
      for(let m=0;m<TM;m++){
        if(Math.random() < .35) jag = (Math.random()-.5)*5.5;      // sharp zig-zag steps
        c[m] += jag;
        nT[m] = (Math.random()-.5)*1.4; nB[m] = (Math.random()-.5)*1.4;
        fT[m] = 1.2 + Math.random()*Math.random()*6.5;             // white fibrous margin (wider on top)
        fB[m] = .6 + Math.random()*Math.random()*3;
      }
      // smooth the margins a little so they read as torn fibre, not noise
      for(const a of [fT,fB]) for(let r=0;r<2;r++) for(let m=1;m<TM-1;m++) a[m] = (a[m-1]+a[m]*2+a[m+1])/4;
      const hairs = [];
      for(let h=0;h<46;h++) hairs.push({ m: Math.floor(Math.random()*TM), top: Math.random() < .6, len: 1.5 + Math.random()*5, ang: (Math.random()-.5)*1.2 });
      return { c, nT, nB, fT, fB, hairs };
    }
    function drawTear(X, Y, k){
      if(!tear) tear = makeTear();
      const T = tear, ctr = slitCenter();
      const reach = Math.min(1, slit*1.3);                    // how far the tear has run along
      const open = slit*slit*(3-2*slit);                       // how wide it has parted
      const top = [], bot = [], outT = [], outB = [];
      let first = -1, last = -1;
      for(let m=0;m<TM;m++){
        const u = m/(TM-1)*2 - 1, au = Math.abs(u);
        if(au > reach){ continue; }
        if(first < 0) first = m; last = m;
        const env = Math.pow(Math.max(0, 1 - Math.pow(au/reach, 2)), .75);
        const half = TEAR_W*.5*open*env + .35;
        const x = u*TEAR_L, cy = T.c[m]*(.4 + .6*Math.min(1, reach*1.5));
        const ty = cy - half + T.nT[m]*open, by = cy + half + T.nB[m]*open;
        top.push([x, ty]); bot.push([x, by]);
        outT.push([x, ty - T.fT[m]*(.35 + .65*open)*Math.min(1, env*3)]);
        outB.push([x, by + T.fB[m]*(.35 + .65*open)*Math.min(1, env*3)]);
      }
      if(top.length < 2) return;
      ctx.save();
      ctx.translate(X(ctr.x), Y(ctr.y)); ctx.rotate(ctr.ang); ctx.scale(k, k);
      const path = (a, b, close) => { ctx.beginPath(); a.forEach(([x,y],n) => n ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); for(let n=b.length-1;n>=0;n--) ctx.lineTo(b[n][0], b[n][1]); if(close) ctx.closePath(); };
      // lifted paper casts a soft shadow onto the surface
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 10*k; ctx.shadowOffsetY = 2*k;
      path(outT, outB, true); ctx.fillStyle = '#e9e9e9'; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      // the hole
      path(top, bot, true);
      const gr = ctx.createLinearGradient(0, -TEAR_W*.5, 0, TEAR_W*.5);
      gr.addColorStop(0, '#050505'); gr.addColorStop(.5, '#2a2a2a'); gr.addColorStop(1, '#0a0a0a');
      ctx.fillStyle = gr; ctx.fill();
      // depth: the torn lips shade the inside
      ctx.save(); path(top, bot, true); ctx.clip();
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.beginPath(); top.forEach(([x,y],n) => n ? ctx.lineTo(x,y+1.5) : ctx.moveTo(x,y+1.5)); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); bot.forEach(([x,y],n) => n ? ctx.lineTo(x,y-1) : ctx.moveTo(x,y-1)); ctx.stroke();
      ctx.restore();
      // ragged fibre rims
      for(const [edge, out] of [[top, outT],[bot, outB]]){
        path(edge, out, true); ctx.fillStyle = 'rgba(245,245,245,.92)'; ctx.fill();
        ctx.beginPath(); out.forEach(([x,y],n) => n ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
        ctx.lineWidth = .7; ctx.strokeStyle = 'rgba(120,120,120,.55)'; ctx.stroke();
      }
      // loose fibres reaching across the gap
      ctx.lineWidth = .55; ctx.strokeStyle = 'rgba(250,250,250,.85)'; ctx.lineCap = 'round';
      for(const h of T.hairs){
        const n = h.m - first; if(n < 0 || h.m > last) continue;
        const [x,y] = h.top ? top[n] : bot[n], dir = h.top ? 1 : -1, L = h.len*(.4 + .6*open);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(h.ang)*L, y + dir*Math.cos(h.ang)*L); ctx.stroke();
      }
      // hairline crack running ahead of the tear
      if(reach < 1){
        ctx.lineWidth = .9; ctx.strokeStyle = 'rgba(20,20,20,.7)';
        for(const sgn of [-1, 1]){
          const m0 = sgn < 0 ? first : last, m1 = Math.max(0, Math.min(TM-1, m0 + sgn*8));
          ctx.beginPath(); ctx.moveTo((m0/(TM-1)*2-1)*TEAR_L, T.c[m0]*.6); ctx.lineTo((m1/(TM-1)*2-1)*TEAR_L, T.c[m1]*.6); ctx.stroke();
        }
      }
      ctx.restore();
    }
    function ripSound(intensity){
      const a = Sound.audio(); if(!a) return;
      const t = a.currentTime, dur = .05 + intensity*.12;
      if(!ripSound.buf){ const b = a.createBuffer(1, a.sampleRate*.4, a.sampleRate), d = b.getChannelData(0); for(let n=0;n<d.length;n++) d[n] = (Math.random()*2-1) * (Math.random() < .15 ? 1 : .25); ripSound.buf = b; }
      const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
      src.buffer = ripSound.buf; bp.type = 'bandpass'; bp.frequency.value = 1800 + Math.random()*2200; bp.Q.value = .8;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.18*intensity, t+.008); g.gain.exponentialRampToValueAtTime(.0001, t+dur);
      src.connect(bp).connect(g).connect(a.destination); src.start(t, Math.random()*.2, dur+.02);
    }

    /* ---------- audio: Karplus–Strong ---------- */
    const bufs = [];
    function ksBuffer(actx, f){
      const sr = actx.sampleRate, len = Math.floor(sr*3.2), b = actx.createBuffer(1, len, sr), out = b.getChannelData(0);
      const P = Math.max(2, Math.round(sr/f)), ring = new Float32Array(P);
      let prev = 0; for(let k=0;k<P;k++){ const r = Math.random()*2-1; ring[k] = (r+prev)*.5; prev = r; }
      let idx = 0, last = 0;
      for(let n=0;n<len;n++){ const cur = ring[idx], nxt = ring[(idx+1)%P]; const val = .4985*(cur+nxt); out[n] = cur; ring[idx] = val*.999 + last*.001; last = val; idx = (idx+1)%P; }
      return b;
    }
    function pluckSound(i, amp){
      const a = Sound.audio(); if(!a) return;
      if(!bufs[i]) bufs[i] = ksBuffer(a, FREQS[i]);
      const s = a.createBufferSource(), g = a.createGain(), lp = a.createBiquadFilter();
      s.buffer = bufs[i]; lp.type = 'lowpass'; lp.frequency.value = 1400 + amp*3600;
      g.gain.value = .25 + amp*.55;
      s.connect(lp).connect(g).connect(a.destination); s.start();
    }
    function tick(){
      const a = Sound.audio(); if(!a) return;
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(90, t+.06);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t+.004); g.gain.exponentialRampToValueAtTime(.0001, t+.09);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t+.1);
    }

    /* ---------- geometry helpers ---------- */
    function project(s, px, py){
      const rx = px - s.x1, ry = py - s.y1;
      return { t:(rx*s.ux + ry*s.uy)/s.len, off: rx*s.nx + ry*s.ny };
    }
    function triangle(s, t, d){
      const k = Math.max(1, Math.min(N-2, Math.round(t*(N-1))));
      for(let j=0;j<N;j++) s.y[j] = j<=k ? d*j/k : d*(N-1-j)/(N-1-k);
      s.y[0] = 0; s.y[N-1] = 0;
    }
    function nearest(px, py, tol){
      let best = null, bd = tol;
      for(const s of strings){ const p = project(s, px, py); if(p.t < .02 || p.t > .98) continue; const dd = Math.abs(p.off - s.y[Math.round(p.t*(N-1))]); if(dd < bd){ bd = dd; best = s; } }
      return best;
    }
    // the band the six strings occupy, with some margin: the star cursor gains its shards here
    function overStrings(px, py){
      if(!strings.length) return false;
      const a = project(strings[0], px, py), b = project(strings[strings.length-1], px, py);
      if(a.t < .01 || a.t > .99) return false;
      const gap = Math.abs(project(strings[strings.length-1], strings[0].x1, strings[0].y1).off);
      return Math.abs(a.off) + Math.abs(b.off) <= gap + 2*46;
    }
    function setCursor(x, y){ canvas.style.cursor = (held || strum || hovered || overStrings(x, y)) ? SHARDS : STAR; }

    /* ---------- pointer ---------- */
    let held = null, hovered = null, downAt = null, dpr = 1, scale = 1;
    function toImg(e){ const r = canvas.getBoundingClientRect(); return [ ((e.clientX-r.left)/r.width*FW - OX)/S, ((e.clientY-r.top)/r.height*FH - OY)/S ]; }
    const tol = () => Math.max(9, 18/scale);

    let strum = null;   // {x,y,t,count} while sweeping across the strings
    function revealSlit(){ if(slitTarget === 0){ slitTarget = 1; slitStart = performance.now() + 380; } }
    function sweep(x, y, now){
      const dt = Math.max(8, now - strum.t), dist = Math.hypot(x - strum.x, y - strum.y), speed = dist / dt;   // image px per ms
      for(const s of strings){
        if(s.held || now - (s.lastStrum||0) < 90) continue;
        const a = project(s, strum.x, strum.y), b = project(s, x, y);
        if((a.off > 0) === (b.off > 0)) continue;
        const f = a.off / (a.off - b.off), t = a.t + (b.t - a.t)*f;
        if(t < .04 || t > .96) continue;
        const dir = Math.sign(b.off - a.off) || 1;
        const amp = Math.max(10, Math.min(MAX_D*.8, 10 + speed*16));
        s.v.fill(0); triangle(s, Math.max(.08, Math.min(.92, t)), dir*amp);
        s.lastStrum = now; s.hover = 1;
        pluckSound(s.i, amp/MAX_D);
        strum.count++; strum.peak = Math.max(strum.peak, amp);
      }
      if(strum.count >= 3 && strum.peak >= PLUCK_MIN*.8) revealSlit();
      strum.x = x; strum.y = y; strum.t = now;
    }

    canvas.addEventListener('pointermove', e => {
      if(!ready || !running) return;
      const [x,y] = toImg(e), now = performance.now();
      if(held){
        const p = project(held, x, y);
        held.raw = p.off - held.off0;
        held.moved = Math.max(held.moved, Math.hypot(x-downAt[0], y-downAt[1]));
        held.d = MAX_D * Math.tanh(held.raw / MAX_D);          // elastic limit
        if(Math.abs(held.raw) > MAX_D*1.7){                    // pulled too far: the string slips and the gesture becomes a strum
          release(); strum = { x, y, t: now, count: 1, peak: MAX_D };
          return;
        }
        triangle(held, held.grabT, held.d);
        return;
      }
      if(strum){ sweep(x, y, now); return; }
      hovered = nearest(x, y, tol());
      setCursor(x, y);
    });
    canvas.addEventListener('pointerleave', () => { if(!held && !strum){ hovered = null; canvas.style.cursor = STAR; } });
    canvas.addEventListener('pointerdown', e => {
      if(!ready || !running) return;
      const [x,y] = toImg(e);
      e.preventDefault(); Sound.audio();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = SHARDS;
      const s = nearest(x, y, tol() * (e.pointerType === 'mouse' ? 1 : 2.2));
      if(!s){ strum = { x, y, t: performance.now(), count: 0, peak: 0 }; return; }
      const p = project(s, x, y);
      held = s; hovered = s; s.held = true; s.grabT = Math.max(.08, Math.min(.92, p.t));
      s.off0 = 0; s.raw = p.off; s.d = MAX_D*Math.tanh(p.off/MAX_D); s.moved = 0; downAt = [x,y];
      s.v.fill(0); triangle(s, s.grabT, s.d);
    });
    function release(){
      if(!held) return;
      const s = held; held = null; s.held = false; s.v.fill(0);
      const amp = Math.abs(s.d);
      if(s.moved < 4 && amp < 6){                      // click without dragging: small recoil
        triangle(s, s.grabT, (Math.random() < .5 ? -1 : 1) * 4.5); tick();
      } else if(amp >= PLUCK_MIN){                     // full pluck
        triangle(s, s.grabT, s.d); pluckSound(s.i, amp/MAX_D);
        revealSlit();
      } else {                                          // gentle: springs back, muted
        triangle(s, s.grabT, s.d); pluckSound(s.i, amp/MAX_D * .25);
      }
    }
    function end(e){
      release();
      if(strum){ strum = null; }
      const [x,y] = toImg(e); hovered = nearest(x, y, tol()); setCursor(x, y);
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    /* ---------- sizing ---------- */
    function resize(){
      // the stage's own scale, so a scene transition in progress never lowers the resolution
      const fit = document.getElementById('stage').getBoundingClientRect().width / 2000;
      const cssW = canvas.offsetWidth * fit, cssH = canvas.offsetHeight * fit;
      if(!cssW) return;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
      scale = cssW / FW * S;
      rerender();
    }
    addEventListener('resize', resize);

    /* ---------- simulation + render ---------- */
    function step(s){
      if(s.held) return;
      const n = Math.floor(s.steps) + (Math.random() < s.steps%1 ? 1 : 0);
      const y = s.y, v = s.v, C = .81;
      for(let k=0;k<n;k++){
        for(let j=1;j<N-1;j++) v[j] = (v[j] + C*(y[j-1] - 2*y[j] + y[j+1])) * s.damp;
        // a little smoothing of the velocity bleeds off high harmonics first
        for(let j=1;j<N-1;j++) v[j] += .015*(v[j-1] - 2*v[j] + v[j+1]);
        for(let j=1;j<N-1;j++) y[j] += v[j];
      }
    }
    function drawString(s, X, Y){
      const tension = Math.min(1, Math.abs(s.held ? s.d : 0)/MAX_D);
      const lw = s.w * (1.25 - tension*.35) * 1.4;
      ctx.beginPath();
      for(let j=0;j<N;j++){ const t = j/(N-1), px = s.x1 + (s.x2-s.x1)*t + s.nx*s.y[j], py = s.y1 + (s.y2-s.y1)*t + s.ny*s.y[j]; j ? ctx.lineTo(X(px),Y(py)) : ctx.moveTo(X(px),Y(py)); }
      return lw;
    }
    function frame(now){
      if(!running) return;
      requestAnimationFrame(frame);
      if(!ready || !surface) return;
      const W = canvas.width, H = canvas.height, c = W/FW, k = S*c;
      const X = x => (x*S + OX)*c, Y = y => (y*S + OY)*c;
      ctx.setTransform(1,0,0,1,0,0);
      ctx.clearRect(0,0,W,H);
      ctx.drawImage(surface, OX*c, OY*c, IW*S*c, IH*S*c);

      // torn slit, behind the strings
      if(slitTarget && now > slitStart && slit < 1){
        const burst = Math.random() < .11;
        slit = Math.min(1, slit + .0035 + (burst ? .035 + .045*Math.random() : 0));
        if(burst || slit === 1) ripSound(burst ? .6 + Math.random()*.4 : .3);
        if(slit === 1 && !finished){ finished = true; setTimeout(() => { if(running) onDone && onDone(); }, 700); }
      }
      if(slit > .002) drawTear(X, Y, k);

      for(const s of strings){ step(s); s.hover += ((s === hovered || s.held ? 1 : 0) - s.hover) * .2; }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // shadows cast on the screen surface
      for(const s of strings){
        ctx.save(); ctx.translate(3*k, 5*k); const lw = drawString(s, X, Y);
        ctx.lineWidth = lw*k*1.3; ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.stroke(); ctx.restore();
      }
      // strings: a soft constant glow, brighter on the string under the star
      const order = strings.slice().sort((a,b) => (a.held||a===hovered) - (b.held||b===hovered));
      for(const s of order){
        const lw = drawString(s, X, Y), h = s.hover;
        const g = Math.round(214 + 41*h);
        ctx.shadowColor = `rgba(255,${Math.round(150 + 90*h)},${Math.round(196 + 50*h)},${.55 + .4*h})`;
        ctx.shadowBlur = (7 + 10*h)*k;
        ctx.lineWidth = lw*k*(1 + .25*h); ctx.strokeStyle = `rgb(${g},${Math.min(255, g+8)},${Math.min(255, g+8)})`; ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    function start(){
      if(running) return;
      running = true; canvas.style.cursor = STAR;
      loaded.then(() => { resize(); });
      resize(); requestAnimationFrame(frame);
    }
    function stop(){ running = false; held = null; strum = null; }
    function reset(){
      stop();
      hovered = null; finished = false; canvas.style.cursor = STAR;
      for(const s of strings){ s.y.fill(0); s.v.fill(0); s.hover = 0; s.held = false; }
      slit = 0; slitTarget = 0; tear = null;
    }
    return { start, stop, reset, loaded };
  }

  return { create };
})();
