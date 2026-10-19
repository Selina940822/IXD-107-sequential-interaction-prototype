// Tear Open the Screen — adapted from tear-open-the-screen/index.html.
// Same behaviour: anything along the torn edge can be grabbed; pulling outward past the edge
// curls the flap, and every full step of pull rips the tear a little further in that direction
// (with a crackling rip and a small shake). Neighbouring edge follows so the tear stays
// continuous. When most of the paper is gone, the rest tears away and the flap falls.
// Changes here: the scene behind the paper is the performance space, the cursor is the pink
// star (with shards over the edge), and the sequence moves on once the paper has fallen away.
window.Tear = (() => {
  "use strict";
  const IW = 1393, IH = 1011, RX = 0;         // the frame the strings and slit are drawn in
  const FW = 990, FH = 740;                   // the TV screen the canvas fills
  const S = Math.max(FW / IW, FH / IH);       // cover-fit of that frame into the screen
  const OX = (FW - IW * S) / 2, OY = (FH - IH * S) / 2;
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
  const SHARDS = 'url("assets/images/cursor-star-shards.svg") 30 30, pointer';

  function create(canvas, { onDone }) {
    const ctx = canvas.getContext('2d');

    /* ---------- seeded noise (the tear path is fixed) ---------- */
    function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
    function periodicNoise(n, r, octaves){
      const out = new Float32Array(n);
      for(const [cells, amp] of octaves){
        const pts = Array.from({length: cells}, () => r()*2-1);
        for(let i=0;i<n;i++){
          const f = i/n*cells, i0 = Math.floor(f), t = f - i0, s = t*t*(3-2*t);
          out[i] += amp * (pts[i0%cells]*(1-s) + pts[(i0+1)%cells]*s);
        }
      }
      return out;
    }

    /* ---------- scene data (from the SVG) ---------- */
    let paper = null, entrance = null, strings = [], slitPoly = [], ready = false, running = false;
    const NT = 420;                                   // samples around the tear
    let C = {x:727, y:540}, R0, R1, JAG, FIB, theta = new Float32Array(NT), angR = 0;

    function loadImg(src){ return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
    const svgP = fetch('assets/images/guitar-closeup-slit.svg').then(r => r.text()).then(txt => {
      const doc = new DOMParser().parseFromString(txt, 'image/svg+xml');
      const img = doc.getElementById('guitar-closeup');
      const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink','href');
      strings = [...doc.querySelectorAll('#strings line[id^="string-"]')].map(l => ({
        x1:+l.getAttribute('x1'), y1:+l.getAttribute('y1'), x2:+l.getAttribute('x2'), y2:+l.getAttribute('y2'), w:+l.getAttribute('stroke-width')||2 }));
      const poly = doc.querySelector('#slit-hole polygon');
      slitPoly = poly.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number));
      // the paper is the same vector close-up as the strum step; the performance space shows through
      return Promise.all(['assets/images/guitar-closeup.svg', 'assets/images/performance.svg'].map(u => fetch(u).then(r => r.text())));
    });
    let paperSVG = null, sceneSVG = null, rasterW = 0;
    function rerender(){
      const w = canvas.width; if(!paperSVG || !w || w === rasterW) return;
      rasterW = w; const c = w / FW;
      Promise.all([svgImage(paperSVG, IW * S * c, IH * S * c), svgImage(sceneSVG, FW * c, FH * c)]).then(([p, e]) => {
        if(canvas.width !== w) return; paper = p; entrance = e; ready = true; dirty = true;
      });
    }
    const loaded = svgP.then(([p, e]) => {
      paperSVG = p; sceneSVG = e; build(); flapTh = flapThT = angR - .57; resize(); dirty = true;
    }).catch(err => console.error('Could not load assets', err));

    function build(){
      // centre of the slit and direction of the strings
      let sx = 0, sy = 0; for(const [x,y] of slitPoly){ sx += x; sy += y; } C = {x: sx/slitPoly.length, y: sy/slitPoly.length};
      const s = strings[2] || strings[0]; angR = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);   // pointing to the right, up the neck
      const r = rng(20261011);
      R0 = new Float32Array(NT); R1 = new Float32Array(NT);
      JAG = periodicNoise(NT, r, [[9,.45],[29,.32],[83,.25],[167,.18]]);
      const sharp = new Float32Array(NT); let j = 0; for(let i=0;i<NT;i++){ if(r() < .3) j = (r()-.5)*2; sharp[i] = j; }
      const rem = periodicNoise(NT, r, [[5,.6],[13,.4]]);
      FIB = new Float32Array(NT); for(let i=0;i<NT;i++) FIB[i] = 1.5 + Math.pow(r(),2)*7;
      for(let k=0;k<2;k++) for(let i=0;i<NT;i++) FIB[i] = (FIB[(i+NT-1)%NT] + FIB[i]*2 + FIB[(i+1)%NT])/4;
      for(let i=0;i<NT;i++){
        const th = i/NT*Math.PI*2; theta[i] = th;
        const dx = Math.cos(th), dy = Math.sin(th);
        R0[i] = rayPoly(C.x, C.y, dx, dy, slitPoly);
        const edge = rayRect(C.x, C.y, dx, dy);
        R1[i] = edge * (.86 + .2*(rem[i]*.5 + .5));        // ragged remnants of paper stay near the frame
        JAG[i] = JAG[i] + sharp[i]*.45;
      }
    }
    function rayPoly(ox, oy, dx, dy, P){
      let best = 1e9;
      for(let i=0;i<P.length;i++){
        const [ax,ay] = P[i], [bx,by] = P[(i+1)%P.length];
        const ex = bx-ax, ey = by-ay, den = dx*ey - dy*ex; if(Math.abs(den) < 1e-9) continue;
        const t = ((ax-ox)*ey - (ay-oy)*ex)/den, u = ((ax-ox)*dy - (ay-oy)*dx)/den;
        if(t > 0 && u >= 0 && u <= 1 && t < best) best = t;
      }
      return best === 1e9 ? 2 : best;
    }
    function rayRect(ox, oy, dx, dy){
      const tx = dx > 0 ? (IW-ox)/dx : dx < 0 ? -ox/dx : 1e9, ty = dy > 0 ? (IH-oy)/dy : dy < 0 ? -oy/dy : 1e9;
      return Math.min(tx, ty);
    }

    /* ---------- tear state ---------- */
    let G = new Float32Array(NT);   // how far the tear has run, per direction (kept on release)
    let fold = .5, foldT = .5;      // flap curl (rest .5, bent → 1)
    let drag = {x:0, y:0}, dragT = {x:0, y:0};
    let done = false, flapGone = 0, reported = false;
    let held = false, hover = false, hoverA = 0, hoverTh = 0;
    let dirty = true, shake = 0;
    let flapTh = 0, flapThT = 0;    // direction of the flap from the slit centre
    const STEP = 40;                // image px of outward pull per increment
    // drag distance to complete, edge roughness, fold shadow and settle curve are live settings (js/tuning.js)
    const PP = () => Tuning.live.paper;
    const PL = () => Tuning.live.paperLook;          // fibre count, length, width and colors
    // the loose fibres: fixed positions around the edge, so changing the count adds or removes some
    const LOOSE = (() => { const r = rng(91), out = []; for(let n=0;n<200;n++) out.push({ i: Math.floor(r()*NT), ang: (r()-.5)*1.1, len: .4 + r()*.6, bend: (r()-.5)*4 }); return out; })();
    const rough = () => PP().roughness / 100;
    const fib = i => FIB[i] * (.3 + .7 * rough());   // fibrous margin: thinner when smooth, never gone
    Tuning.onChange(() => { dirty = true; });   // redraw when a setting changes
    let ripped = 0;                 // outward pull applied so far (image px)
    let relT = 1, relFold = .5, relDrag = {x:0, y:0};   // settle of the flap after letting go
    const FLAP_HW = .36;            // flap half-width (radians)
    const FLAP_D = 38;

    function wrapAngle(a){ return (a + Math.PI*3) % (Math.PI*2) - Math.PI; }
    function flapWeight(i){
      const rel = wrapAngle(theta[i] - flapTh);
      if(Math.abs(rel) >= FLAP_HW) return 0;
      return Math.cos(rel/FLAP_HW*Math.PI/2);
    }
    function idxOf(th){ return ((Math.round((th < 0 ? th + Math.PI*2 : th)/(Math.PI*2)*NT) % NT) + NT) % NT; }
    function baseR(i){ const g = G[i]; return Math.max(R0[i], R0[i] + (R1[i] - R0[i])*g + JAG[i]*rough()*(6 + .085*(R0[i] + (R1[i]-R0[i])*g))*Math.sqrt(g)); }
    function radii(){
      const r = new Float32Array(NT), rl = new Float32Array(NT);
      const fl = done ? 0 : fold;
      for(let i=0;i<NT;i++){ r[i] = baseR(i); rl[i] = r[i] + FLAP_D*fl*flapWeight(i); }
      return [r, rl];
    }
    function advance(th){
      // tear runs a little further in this direction; neighbours follow so the edge stays continuous
      // each rip opens less when a longer drag is needed to complete the tear
      const W = .8, amt = (.04 + Math.random()*.02) * 1600 / PP().tearDistance;
      for(let i=0;i<NT;i++){
        const rel = Math.abs(wrapAngle(theta[i] - th));
        if(rel < W){ const w = Math.pow(Math.cos(rel/W*Math.PI/2), 1.6); G[i] = Math.min(1, G[i] + amt*w); }
      }
      for(let pass=0;pass<5;pass++){ const c = G.slice(); for(let i=0;i<NT;i++) G[i] = Math.max(c[i], (c[(i+NT-1)%NT] + c[i]*2 + c[(i+1)%NT])/4); }
    }
    function meanG(){ let s = 0; for(let i=0;i<NT;i++) s += G[i]; return s/NT; }

    /* ---------- audio: short paper rips ---------- */
    let noiseBuf = null;
    function rip(strength){
      const a = Sound.audio(); if(!a) return;
      if(!noiseBuf){ noiseBuf = a.createBuffer(1, a.sampleRate*.6, a.sampleRate); const d = noiseBuf.getChannelData(0); for(let n=0;n<d.length;n++) d[n] = (Math.random()*2-1)*(Math.random() < .12 ? 1 : .22); }
      const t = a.currentTime, dur = .07 + strength*.12;
      const src = a.createBufferSource(), hp = a.createBiquadFilter(), bp = a.createBiquadFilter(), g = a.createGain();
      src.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = 700; bp.type = 'bandpass'; bp.frequency.value = 1500 + Math.random()*2500; bp.Q.value = .6;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.22 + .2*strength, t + .006);
      // crackle: a few stutters inside the rip
      for(let k=1;k<5;k++){ const tk = t + dur*k/5; g.gain.setValueAtTime((.08 + Math.random()*.25)*(1-k/6), tk); }
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(hp).connect(bp).connect(g).connect(a.destination); src.start(t, Math.random()*.3, dur + .02);
    }

    /* ---------- geometry for drawing ---------- */
    function pt(i, r){ return [C.x + Math.cos(theta[i])*r, C.y + Math.sin(theta[i])*r]; }
    function flapIdx(){ const out = []; for(let i=0;i<NT;i++) if(flapWeight(i) > 0) out.push(i); out.sort((a,b) => wrapAngle(theta[a]-flapTh) - wrapAngle(theta[b]-flapTh)); return out; }
    function flapPoly(rl){
      const idx = flapIdx(), crease = [], tip = [];
      const fl = done ? 0 : fold;
      for(const i of idx){
        const w = flapWeight(i), ux = Math.cos(theta[i]), uy = Math.sin(theta[i]);
        const [cx, cy] = pt(i, rl[i]);
        const L = FLAP_D*fl*w;
        tip.push([cx - ux*L*1.05 + drag.x*w*.55, cy - uy*L*1.05 + drag.y*w*.55]);
        crease.push([cx, cy]);
      }
      return {crease, tip};
    }
    function inPoly(x, y, P){ let c = false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const [xi,yi]=P[i],[xj,yj]=P[j]; if(((yi>y)!==(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) c = !c; } return c; }

    /* ---------- drawing ---------- */
    let dpr = 1, k = 1;
    function resize(){
      // the stage's own scale, so a scene transition in progress never lowers the resolution
      const fit = document.getElementById('stage').getBoundingClientRect().width / 2000;
      const cssW = canvas.offsetWidth * fit, cssH = canvas.offsetHeight * fit;
      if(!cssW) return;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
      k = canvas.width / FW * S; dirty = true;
      rerender();
    }
    addEventListener('resize', resize);

    function roundRect(c, x, y, w, h, r){ c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); }
    function holePath(c, rl){ c.moveTo(...pt(0, rl[0])); for(let i=1;i<NT;i++) c.lineTo(...pt(i, rl[i])); c.closePath(); }

    function draw(){
      const [r, rl] = radii();
      ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height);
      const sx = shake ? (Math.random()-.5)*shake : 0, sy = shake ? (Math.random()-.5)*shake : 0;
      ctx.setTransform(k,0,0,k,OX*canvas.width/FW + sx*k,OY*canvas.width/FW + sy*k);
      ctx.save(); ctx.beginPath(); roundRect(ctx, 0, 0, IW, IH, done ? RX*(1-flapGone) : RX); ctx.clip();

      // 1. the performance space (only seen through the tear)
      ctx.save(); ctx.beginPath(); holePath(ctx, rl); ctx.clip();
      // the performance space fills the visible stage frame exactly, as it will once inside
      ctx.drawImage(entrance, -OX/S, -OY/S, FW/S, FH/S);
      // paper thickness shades the inside of the edge
      ctx.beginPath(); holePath(ctx, rl);
      ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 18*k; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
      ctx.restore();

      // 2. the paper (guitar close-up) with the hole cut out
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,IW,IH); holePath(ctx, rl); ctx.clip('evenodd');
      ctx.drawImage(paper, 0, 0, IW, IH);
      ctx.restore();

      // 3. strings: printed on the paper; they span the original slit until the tear runs past it
      ctx.save(); ctx.beginPath(); ctx.rect(0,0,IW,IH); holePath(ctx, rl); ctx.clip('evenodd');
      drawStrings(); ctx.restore();
      const PG = meanG(); if(PG < .05){ ctx.save(); ctx.beginPath(); slitPoly.forEach(([x,y],n) => n ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath(); ctx.clip(); ctx.globalAlpha = 1 - PG/.05; drawStrings(); ctx.restore(); }

      // 4. ragged white fibre along the torn edge
      ctx.beginPath(); holePath(ctx, rl);
      for(let i=NT-1;i>=0;i--){ const f = fib(i)*(.6 + .4*Math.min(1, meanG()*4 + .4)); const [x,y] = pt(i, rl[i] + f); i === NT-1 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); }
      ctx.closePath(); ctx.fillStyle = Tuning.rgba(PL().paperColor, .95); ctx.fill('evenodd');
      ctx.beginPath(); for(let i=0;i<=NT;i++){ const ii = i%NT, [x,y] = pt(ii, rl[ii] + fib(ii)*(.6 + .4*Math.min(1, meanG()*4 + .4))); i ? ctx.lineTo(x,y) : ctx.moveTo(x,y); }
      ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(90,90,90,.6)'; ctx.stroke();

      // loose fibres hanging from the torn edge into the hole
      const nf = Math.min(LOOSE.length, PL().fibres), fl = PL().fibreLength, mg = Math.min(1, meanG()*4 + .4);
      if(nf){
        ctx.lineCap = 'round'; ctx.lineWidth = PL().fibreWidth; ctx.strokeStyle = Tuning.rgba(PL().fibreColor, .9);
        ctx.beginPath();
        for(let n=0;n<nf;n++){
          const f = LOOSE[n], i = f.i, base = rl[i] + fib(i)*.5*mg;
          const a = theta[i] + Math.PI + f.ang, L = fl * f.len * (.5 + .5*mg);   // pointing back into the hole
          const [x, y] = pt(i, base);
          ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a)*L*.5 + f.bend, y + Math.sin(a)*L*.5 - f.bend, x + Math.cos(a)*L, y + Math.sin(a)*L);
        }
        ctx.stroke();
      }

      // brightened edge where the hand is
      if(hoverA > .01 && !done){
        ctx.beginPath(); let started = false;
        for(let d=-40; d<=40; d++){
          const i = (idxOf(hoverTh) + d + NT) % NT, f = fib(i)*(.6 + .4*Math.min(1, meanG()*4 + .4));
          const [x,y] = pt(i, rl[i] + f*.5); started ? ctx.lineTo(x,y) : (ctx.moveTo(x,y), started = true);
        }
        ctx.lineWidth = 2.6; ctx.strokeStyle = `rgba(255,255,255,${.75*hoverA})`; ctx.shadowColor = `rgba(255,255,255,${.6*hoverA})`; ctx.shadowBlur = 8*k; ctx.stroke(); ctx.shadowBlur = 0;
      }
      // 5. the curled flap
      if(!done || flapGone < 1){
        const {crease, tip} = flapPoly(rl);
        if(crease.length > 2){
          ctx.save();
          if(done){ const fg = Math.min(1, Math.max(0, Tuning.ease('paper')(flapGone))); ctx.globalAlpha = 1 - fg; ctx.translate(Math.cos(flapTh)*fg*120, fg*180); }
          ctx.beginPath(); crease.forEach(([x,y],n) => n ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); for(let n=tip.length-1;n>=0;n--) ctx.lineTo(...tip[n]); ctx.closePath();
          const m = Math.floor(crease.length/2), [cx,cy] = crease[m], [tx,ty] = tip[m];
          const gr = ctx.createLinearGradient(cx, cy, tx, ty);
          const lift = .55 + .45*(fold - .5)*2;
          const hi = Math.round(214 + 30*hoverA), lo = Math.round(150 + 20*hoverA);
          gr.addColorStop(0, `rgb(${lo},${lo},${lo})`); gr.addColorStop(.45, `rgb(${hi},${hi},${hi})`); gr.addColorStop(1, `rgb(${Math.min(255,hi+10)},${Math.min(255,hi+10)},${Math.min(255,hi+10)})`);
          const sh = PP().shadow / 100;
          ctx.shadowColor = `rgba(0,0,0,${sh.toFixed(3)})`; ctx.shadowBlur = (10 + 14*lift)*k*(.4 + sh); ctx.shadowOffsetX = (4 + drag.x*.08)*k; ctx.shadowOffsetY = (6 + 6*lift)*k;
          ctx.fillStyle = gr; ctx.fill();
          ctx.shadowColor = 'transparent';
          // brightened torn edge on hover / grab
          ctx.beginPath(); tip.forEach(([x,y],n) => n ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
          ctx.lineWidth = 1 + 1.4*hoverA; ctx.strokeStyle = `rgba(255,255,255,${.35 + .6*hoverA})`; ctx.stroke();
          ctx.beginPath(); crease.forEach(([x,y],n) => n ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
          ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(0,0,0,${(.12 + .4*sh).toFixed(3)})`; ctx.stroke();
          ctx.restore();
        }
      }
      ctx.restore();
    }
    function drawStrings(){
      ctx.lineCap = 'round';
      for(const s of strings){ ctx.beginPath(); ctx.moveTo(s.x1+3, s.y1+5); ctx.lineTo(s.x2+3, s.y2+5); ctx.lineWidth = s.w*1.3*1.4; ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.stroke(); }
      ctx.shadowColor = 'rgba(255,150,196,.55)'; ctx.shadowBlur = 7*k;
      for(const s of strings){ ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.lineWidth = s.w*1.25*1.4; ctx.strokeStyle = 'rgb(214,222,222)'; ctx.stroke(); }
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    }

    /* ---------- interaction ---------- */
    function toImg(e){ const b = canvas.getBoundingClientRect(); return [((e.clientX-b.left)/b.width*FW - OX)/S, ((e.clientY-b.top)/b.height*FH - OY)/S]; }
    const padPx = () => Math.max(16, 22/(canvas.getBoundingClientRect().width/FW*S));
    // anything along the torn edge (or the curled flap) can be grabbed, as long as paper remains beyond it
    function grabAt(x, y){
      if(done) return null;
      const [, rl] = radii(), {crease, tip} = flapPoly(rl);
      if(crease.length > 2){
        const poly = crease.concat(tip.slice().reverse());
        if(inPoly(x, y, poly)) return flapTh;
      }
      const th = Math.atan2(y - C.y, x - C.x), i = idxOf(th), d = Math.hypot(x - C.x, y - C.y);
      if(G[i] >= .995) return null;
      if(Math.abs(d - rl[i]) < padPx()) return th;
      return null;
    }
    canvas.addEventListener('pointermove', e => {
      if(!ready || !running) return;
      const [x,y] = toImg(e);
      if(held){
        const th = Math.atan2(y - C.y, x - C.x), i = idxOf(th);
        flapThT = th; hoverTh = th;
        const stretch = Math.hypot(x - C.x, y - C.y) - baseR(i);       // outward pull past the edge
        const bend = Math.max(0, Math.min(1.15, stretch/STEP));
        foldT = .5 + .5*Math.min(1, bend);
        const [ex, ey] = pt(i, baseR(i));
        dragT = { x: Math.max(-70, Math.min(70, (x - ex)*.8)), y: Math.max(-70, Math.min(70, (y - ey)*.8)) };
        if(stretch >= STEP && G[i] < 1){
          advance(th); foldT = .78; shake = 2.2; ripped += STEP;
          rip(.4 + Math.random()*.6);
          if(ripped >= PP().tearDistance || meanG() > .95) complete();
        }
        dirty = true; return;
      }
      const g = grabAt(x, y);
      hover = g !== null; if(hover) hoverTh = g;
      canvas.style.cursor = hover ? SHARDS : STAR;
      dirty = true;
    });
    canvas.addEventListener('pointerdown', e => {
      if(!ready || !running || done) return;
      const [x,y] = toImg(e);
      const g = grabAt(x, y); if(g === null) return;
      e.preventDefault(); Sound.audio();
      canvas.setPointerCapture(e.pointerId);
      held = true; hover = true; flapThT = Math.atan2(y - C.y, x - C.x); hoverTh = flapThT;
      canvas.style.cursor = SHARDS;
    });
    function release(){
      if(!held) return;
      held = false; foldT = .5; dragT = {x:0, y:0};
      relT = 0; relFold = fold; relDrag = {...drag};
      canvas.style.cursor = hover && !done ? SHARDS : STAR;
    }
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('pointerleave', () => { if(!held){ hover = false; canvas.style.cursor = STAR; } });

    function complete(){
      done = true; held = false; canvas.style.cursor = STAR;
      rip(1); setTimeout(() => rip(.7), 120);
      finishFrom = G.slice(); finishT = 0;
    }
    let finishFrom = null, finishT = 1;

    /* ---------- loop ---------- */
    function frame(){
      if(!running) return;
      requestAnimationFrame(frame);
      if(!ready) return;
      const hA = (hover || held) && !done ? 1 : 0;
      const moving = relT < 1 || Math.abs(wrapAngle(flapThT - flapTh)) > .002 || (finishFrom && finishT < 1) || Math.abs(fold - foldT) > .002 || Math.abs(drag.x - dragT.x) > .1 || Math.abs(drag.y - dragT.y) > .1 || Math.abs(hoverA - hA) > .01 || shake > .05 || (done && flapGone < 1);
      if(!moving && !dirty) return;
      if(held){                                   // the flap follows the hand closely
        fold += (foldT - fold)*.35;
        drag.x += (dragT.x - drag.x)*.4; drag.y += (dragT.y - drag.y)*.4;
      } else if(relT < 1){                        // let go: it settles back along the chosen curve
        relT = Math.min(1, relT + 1/42);
        const e = Tuning.ease('paper')(relT);
        fold = relFold + (.5 - relFold)*e;
        drag.x = relDrag.x*(1 - e); drag.y = relDrag.y*(1 - e);
      } else { fold = foldT; drag.x = dragT.x; drag.y = dragT.y; }
      hoverA += (hA - hoverA)*.2;
      shake *= .7; if(shake < .05) shake = 0;
      if(done) flapGone = Math.min(1, flapGone + .025);
      { const dth = wrapAngle(flapThT - flapTh); flapTh = wrapAngle(flapTh + dth*(held ? .5 : .2)); }
      if(finishFrom && finishT < 1){ finishT = Math.min(1, finishT + .02); const e = Math.min(1.05, Tuning.ease('paper')(finishT)); for(let i=0;i<NT;i++) G[i] = finishFrom[i] + (1 - finishFrom[i])*e; }
      dirty = false;
      draw();
      if(done && flapGone >= 1 && finishT >= 1 && !reported){ reported = true; onDone && onDone(); }
    }

    function start(){
      if(running) return;
      running = true; canvas.style.cursor = STAR; dirty = true;
      loaded.then(() => { resize(); });
      resize(); requestAnimationFrame(frame);
    }
    function stop(){ running = false; held = false; }
    function reset(){
      stop();
      G = new Float32Array(NT); fold = foldT = .5; drag = {x:0,y:0}; dragT = {x:0,y:0}; done = false; flapGone = 0; held = false; hover = false; hoverA = 0;
      flapTh = flapThT = angR - .57; finishFrom = null; finishT = 1; reported = false;
      ripped = 0; relT = 1;
      canvas.style.cursor = STAR; dirty = true;
    }
    return { start, stop, reset, loaded };
  }

  return { create };
})();
