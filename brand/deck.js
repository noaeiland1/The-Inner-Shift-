/* Inner Shift · deck engine
   Turns a page of <section class="slide ..."> elements into a presentation:
   one slide at a time, scaled to the screen, with the shared choreography.

   Use in a deck, after the slides:
     <script src="brand/deck.js"></script>

   Keys: → ↓ space PageDown Enter = next · ← ↑ PageUp Backspace = back
         F = full screen · Home / End = first / last
   Elements with class "r" appear one per click, cumulatively, before the deck
   moves on (the newest gets .is-on). The slide number is kept in the address (#7), so a
   refresh returns to the same slide.
*/
(function () {
  const slides = [...document.querySelectorAll('.deck > .slide')];
  if (!slides.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  // a soft brush texture any line can use (CSS: filter: url(#brush-stroke)): uneven edges, a dry grain, slightly soft
  const fx = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  fx.setAttribute('width', '0'); fx.setAttribute('height', '0'); fx.setAttribute('aria-hidden', 'true'); fx.style.position = 'absolute';
  fx.innerHTML = '<filter id="brush-stroke" x="-5%" y="-25%" width="110%" height="150%">'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="7" result="warp"/>'
    + '<feDisplacementMap in="SourceGraphic" in2="warp" scale="4" xChannelSelector="R" yChannelSelector="G" result="w"/>'
    + '<feTurbulence type="fractalNoise" baseFrequency="0.45 0.07" numOctaves="2" seed="3" result="grain"/>'
    + '<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.8 1.2" result="mask"/>'
    + '<feComposite in="w" in2="mask" operator="in" result="dry"/><feGaussianBlur in="dry" stdDeviation=".8"/></filter>';
  document.body.append(fx);

  // central sentence: split into words that surface one at a time; the marker stays one unit
  document.querySelectorAll('.words').forEach(el => {
    let n = 0;
    [...el.childNodes].forEach(node => {
      if (node.nodeType === 3) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(part); return; }
          const s = document.createElement('span'); s.className = 'w'; s.style.setProperty('--w', n++); s.textContent = part; frag.append(s);
        });
        node.replaceWith(frag);
      } else {
        const wrap = document.createElement('span'); wrap.className = 'w'; wrap.style.setProperty('--w', n++);
        node.replaceWith(wrap); wrap.append(node);
      }
    });
    const mark = el.querySelector('.mark');
    if (mark) mark.style.setProperty('--mark-at', 'calc(' + n + ' * var(--word-stagger) + var(--enter-delay) + 700ms)');
  });

  // big numbers count up from 0 to their value
  // a number inside a click-revealed item (.r) waits for its click
  function countUp(slide, scope) {
    (scope || slide).querySelectorAll('[data-count]').forEach(el => {
      if (!scope && el.closest('.r')) { el.textContent = 0; return; }
      const to = +el.dataset.count;
      if (reduced) { el.textContent = to; return; }
      const dur = parseFloat(css('--count-up')) || 2600, t0 = performance.now() + 400;
      el.textContent = 0;
      const tick = now => {
        const p = Math.min(Math.max((now - t0) / dur, 0), 1);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 4)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // click reveal: elements with class "r" appear one per click and stay; the newest is marked current
  const items = slide => slide.querySelectorAll('.r');
  function setStep(slide, k) {
    slide.dataset.at = k;
    const its = items(slide);
    its.forEach((el, i) => { const was = el.classList.contains('shown'); el.classList.toggle('shown', i <= k); el.classList.toggle('is-on', i === k); if (!was && i <= k) countUp(slide, el); });
    // data-final: one more click after the last item puts the slide in its focus state (as in the original)
    slide.classList.toggle('is-final', slide.dataset.final !== undefined && k >= its.length);
  }

  let cur = 0;
  function show(i) {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, j) => { s.classList.toggle('is-current', j === cur); if (j !== cur) s.classList.remove('play'); });
    const s = slides[cur];
    if (items(s).length || s.dataset.final !== undefined) setStep(s, -1);
    void s.offsetWidth; s.classList.add('play');
    countUp(s);
    history.replaceState(null, '', '#' + (cur + 1));
    counter.textContent = (cur + 1) + ' / ' + slides.length;
  }
  function step(dir) {
    const s = slides[cur], n = items(s).length, fin = s.dataset.final !== undefined;
    const at = +(s.dataset.at ?? -1), last = n - 1 + (fin ? 1 : 0);
    if (n || fin) {
      if (dir > 0 && at < last) { setStep(s, at + 1); return; }
      if (dir < 0 && at > -1) { setStep(s, at - 1); return; }
    }
    if (cur + dir >= 0 && cur + dir < slides.length) show(cur + dir);
  }

  // layout: one slide at a time, as large as the screen allows at 16:9
  const style = document.createElement('style');
  style.textContent = `
    html, body { margin:0; height:100%; background:#1d1413; overflow:hidden; }
    .deck { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; }
    .deck > .slide { display:none; width:min(100vw, 177.78vh); }
    .deck > .slide.is-current { display:block; animation:deck-in 700ms cubic-bezier(.22,1,.36,1) both; }
    @keyframes deck-in { from { opacity:0; transform:scale(.985); filter:blur(6px); } to { opacity:1; transform:none; filter:none; } }
    .deck-ui { position:fixed; bottom:16px; left:50%; transform:translateX(-50%); z-index:10; display:flex; gap:10px; align-items:center;
      background:rgba(29,20,19,.55); backdrop-filter:blur(10px); padding:6px 14px; border-radius:999px; color:rgba(255,255,255,.75);
      font:13px 'Open Sans', sans-serif; opacity:0; transition:opacity .4s; direction:ltr; }
    .deck-ui.on, .deck-ui:hover { opacity:1; }
    .deck-ui button { background:none; border:1px solid rgba(255,255,255,.25); color:inherit; border-radius:999px; padding:3px 12px; cursor:pointer; font:inherit; }
    @media print { html, body { overflow:visible; background:none; } .deck { position:static; display:block; } .deck > .slide { display:block !important; width:100%; break-after:page; } .deck-ui { display:none; } }
  `;
  document.head.append(style);
  const ui = document.createElement('div'); ui.className = 'deck-ui';
  ui.innerHTML = '<button data-d="-1">‹</button><span></span><button data-d="1">›</button><button data-f>⤢</button>';
  document.body.append(ui);
  const counter = ui.querySelector('span');
  ui.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.f !== undefined) full(); else step(+b.dataset.d); });

  function full() { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); }
  document.addEventListener('keydown', e => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); step(1); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); step(-1); }
    else if (e.key === 'Home') show(0);
    else if (e.key === 'End') show(slides.length - 1);
    else if (e.key === 'f' || e.key === 'F') full();
  });
  document.addEventListener('click', e => { if (!e.target.closest('.deck-ui') && e.target.closest('.slide')) step(1); });
  let t; document.addEventListener('mousemove', () => { ui.classList.add('on'); clearTimeout(t); t = setTimeout(() => ui.classList.remove('on'), 1800); });

  show((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
