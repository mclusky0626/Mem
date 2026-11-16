/* ==========================================================================
   MEM-cho — Character File · interaction script
   GSAP (ScrollTrigger · Draggable) + Lenis

   Ground rules, taken from the GSAP / Lenis docs:
   - ScrollTriggers are created top-to-bottom in page order (pin spacing depends on it)
   - Animate transform / opacity; values that update constantly use gsap.quickTo
   - The horizontal tween uses ease:"none" and moves a child of the pinned element
   - Elements GSAP animates never carry a CSS `transition: transform`
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js'); // libraries missing → leave the static page as is
    return;
  }

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const { clamp, random: rand, interpolate } = gsap.utils;
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pad = (n, len = 2) => String(n).padStart(len, '0');

  gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin);
  gsap.defaults({ ease: 'expo.out', duration: 1 });
  ScrollTrigger.config({ ignoreMobileResize: true });

  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const INK = '#0B0B0C', WHITE = '#F5F5F0', ACCENT = '#FFE500';

  if (!location.hash) {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }

  /* ───────── Smooth scroll (Lenis driven by the GSAP ticker) ───────── */
  let lenis = null;
  if (window.Lenis && !REDUCE) {
    lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const lockScroll = (on) => {
    if (lenis) on ? lenis.stop() : lenis.start();
    else root.style.overflow = on ? 'hidden' : '';
  };
  let refreshCall = null;
  const refreshSoon = () => {
    if (refreshCall) refreshCall.kill();
    refreshCall = gsap.delayedCall(0.15, () => ScrollTrigger.refresh(true));
  };

  /* ───────── Shared: burst of small marks ───────── */
  function popBurst(x, y, count = 10, spread = 140) {
    if (REDUCE) return;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('i');
      el.className = i % 3 === 0 ? 'pop pop--x' : 'pop';
      document.body.appendChild(el);
      const angle = rand(0, Math.PI * 2);
      const dist = rand(spread * 0.35, spread);
      gsap.set(el, { x, y, xPercent: -50, yPercent: -50, scale: 0, rotation: rand(-45, 45) });
      gsap.timeline({ onComplete: () => el.remove() })
        .to(el, { x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist, scale: rand(0.7, 1.8), rotation: rand(-180, 180), duration: rand(0.7, 1.1), ease: 'expo.out' })
        .to(el, { autoAlpha: 0, scale: 0, duration: 0.3, ease: 'power2.in' }, '-=0.25');
    }
  }
  const centerOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  /* ───────── Shared: split a heading into masked words ───────── */
  function splitWords(el) {
    const label = el.textContent.replace(/\s+/g, ' ').trim();
    const out = document.createDocumentFragment();
    const push = (text, cls) => {
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { out.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w';
        w.setAttribute('aria-hidden', 'true');
        const inner = document.createElement('span');
        inner.className = cls ? `wi ${cls}` : 'wi';
        inner.textContent = part;
        w.appendChild(inner);
        out.appendChild(w);
      });
    };
    el.childNodes.forEach((node) => {
      if (node.nodeType === 3) push(node.textContent);
      else if (node.nodeName === 'BR') out.appendChild(document.createElement('br'));
      else push(node.textContent, node.nodeName === 'EM' ? 'is-em' : '');
    });
    el.textContent = '';
    el.appendChild(out);
    el.setAttribute('aria-label', label);
    return $$('.wi', el);
  }

  /* ───────── Shared: scramble a mono label into place ───────── */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/+_';
  function scramble(el, text, duration = 0.8) {
    if (el._sc) el._sc.kill();
    if (REDUCE) { el.textContent = text; return; }
    const o = { p: 0 };
    el._sc = gsap.to(o, {
      p: 1, duration, ease: 'none',
      onUpdate: () => {
        const n = Math.floor(o.p * text.length);
        let s = text.slice(0, n);
        for (let i = n; i < text.length; i++) s += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        el.textContent = s;
      },
      onComplete: () => { el.textContent = text; },
    });
  }

  /* ───────── Shared: per-section reveals ───────── */
  function revealsIn(scope) {
    if (!scope) return;
    $$('[data-split]', scope).forEach((el) => {
      const words = splitWords(el);
      if (REDUCE) return;
      gsap.from(words, { yPercent: 118, duration: 1.15, stagger: 0.045, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });

    $$('[data-scramble]', scope).forEach((el) => {
      const text = el.textContent;
      ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => scramble(el, text, 0.9) });
    });

    $$('[data-count]', scope).forEach((el) => {
      const to = +el.dataset.count;
      const o = { v: REDUCE ? to : 0 };
      const render = () => { el.textContent = fmt(o.v); };
      render();
      if (REDUCE) return;
      gsap.to(o, { v: to, duration: 2.2, ease: 'expo.out', onUpdate: render, scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
    });

    if (REDUCE) return;

    // image wipe: clip-path opens from the bottom while the image settles
    $$('[data-reveal="clip"]', scope).forEach((el) => {
      const img = $('img', el);
      gsap.set(el, { clipPath: 'inset(100% 0% 0% 0%)' });
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      tl.to(el, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' });
      if (img) tl.fromTo(img, { scale: 1.4 }, { scale: 1.05, duration: 2, ease: 'expo.out' }, 0.2);
    });

    const items = $$('[data-reveal]', scope).filter((el) => el.dataset.reveal !== 'clip');
    if (!items.length) return;
    gsap.set(items, { autoAlpha: 0, y: 32 });
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.06, overwrite: true }),
    });
  }

  /* ==========================================================================
     Loader → hero intro
     ========================================================================== */
  function initLoader(onDone) {
    const loader = $('.loader');
    if (!loader) return onDone();
    const bar = $('.loader__bar i');
    const num = $('.loader__num span');
    const o = { p: 0 };
    const render = () => { bar.style.transform = `scaleX(${o.p})`; num.textContent = pad(Math.round(o.p * 100), 3); };

    lockScroll(true);
    const creep = gsap.to(o, { p: 0.82, duration: 2.4, ease: 'power1.out', onUpdate: render });

    const decode = (src) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = src; });
    const ready = Promise.all([
      decode('assets/img/memcho-full.webp'),
      decode('assets/img/memcho-bust.webp'),
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((res) => setTimeout(res, 900)),
    ]);
    const timeout = new Promise((res) => setTimeout(res, 4500));

    Promise.race([ready, timeout]).then(() => {
      creep.kill();
      gsap.to(o, {
        p: 1, duration: 0.5, ease: 'power2.out', onUpdate: render,
        onComplete: () => {
          const tl = gsap.timeline({ onComplete: () => loader.remove() });
          if (REDUCE) {
            tl.to(loader, { autoAlpha: 0, duration: 0.3 });
            tl.add(() => { lockScroll(false); onDone(); }, 0);
          } else {
            tl.to('.loader__ui', { autoAlpha: 0, y: -24, duration: 0.4, ease: 'power2.in' })
              .to('.loader__cols i', { yPercent: -101, duration: 1.05, ease: 'expo.inOut', stagger: 0.07 }, '-=0.1')
              .add(() => { lockScroll(false); onDone(); }, 0.75);
          }
        },
      });
    });
  }

  function initHero() {
    const hero = $('.hero');
    const float = $('.hero__chara-float');
    const disc = $('.hero__disc');
    const say = $('.hero__say');
    const sayText = $('span', say);

    const intro = gsap.timeline({ paused: true });
    if (!REDUCE) {
      intro
        .from(disc, { scale: 0, duration: 1.6 }, 0)
        .from('.hero__ring', { autoAlpha: 0, duration: 1.6 }, 0.25) // (its transform belongs to the CSS spin)
        .from('.hero__word i', { yPercent: 112, duration: 1.3, stagger: (i) => (i % 6) * 0.06 }, 0.15)
        .from(float, { yPercent: 16, autoAlpha: 0, duration: 1.5, ease: 'power4.out' }, 0.35)
        .from('.hero__meta > *', { y: 16, autoAlpha: 0, duration: 1, stagger: 0.07 }, 0.8)
        .from('.hero__marks i', { scale: 0, rotation: 90, duration: 1, stagger: 0.06 }, 0.8)
        .from(say, { scaleX: 0, autoAlpha: 0, duration: 0.7 }, 1.25)
        .add(() => scramble(sayText, sayText.textContent, 0.7), 1.3)
        .from(['.nav__logo', '.nav__links', '.nav__toggle'], { y: -30, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.7)
        .add(idle, 1.6);
    }
    function idle() {
      if (REDUCE) return;
      gsap.to(float, { y: -12, duration: 2.8, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    }

    if (!REDUCE) {
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
        .to('.hero__word--a', { xPercent: -14 }, 0)
        .to('.hero__word--b', { xPercent: 14 }, 0)
        .to('.hero__chara', { yPercent: 9, scale: 0.95, transformOrigin: '50% 100%' }, 0)
        .to('.hero__halo-scroll', { scale: 1.4, yPercent: 10 }, 0)
        .to('.hero__meta', { autoAlpha: 0, duration: 0.3 }, 0);
    }
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onToggle: (self) => hero.classList.toggle('is-away', !self.isActive) });

    // pointer parallax: each layer moves by a different amount
    if (FINE && !REDUCE) {
      const q = (el, prop) => gsap.quickTo(el, prop, { duration: 1, ease: 'power3' });
      const hx = q('.hero__halo', 'x'), hy = q('.hero__halo', 'y');
      const cx = q('.hero__chara-move', 'x'), cy = q('.hero__chara-move', 'y');
      const tx = q('.hero__title', 'x'), ty = q('.hero__title', 'y');
      hero.addEventListener('pointermove', (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        hx(nx * -22); hy(ny * -16);
        cx(nx * 24); cy(ny * 12);
        tx(nx * -34); ty(ny * -12);
      });
    }

    // poke
    const LINES = ['hey! that tickles~', 'did you hit subscribe yet?', 'the horns? my trademark!', 'i can smell a trend coming…', 'my age? that\'s a se~cret!', 'let\'s go viral again today!', 'hi~ welcome to my channel!'];
    let line = 0;
    $('.hero__poke').addEventListener('click', (e) => {
      const p = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : centerOf(e.currentTarget);
      popBurst(p.x, p.y, 12, 150);
      scramble(sayText, LINES[line++ % LINES.length], 0.55);
      if (REDUCE) return;
      gsap.timeline({ overwrite: 'auto' })
        .to(float, { scaleY: 0.93, scaleX: 1.05, duration: 0.1, ease: 'power2.out' })
        .to(float, { scaleY: 1, scaleX: 1, duration: 1.1, ease: 'elastic.out(1.1, 0.35)' });
      gsap.fromTo(disc, { scale: 1.14 }, { scale: 1, duration: 1.3, ease: 'elastic.out(1, 0.4)', overwrite: true });
    });

    return () => (REDUCE ? null : intro.play());
  }

  /* ───────── Marquee: reacts to scroll velocity ───────── */
  function initMarquee() {
    const wrap = $('.marquee');
    if (!wrap || REDUCE) return;
    const tweens = $$('.marquee__row', wrap).map((row) => {
      const inner = $('.marquee__inner', row);
      for (let i = 0; i < 5; i++) row.appendChild(inner.cloneNode(true));
      const dir = +row.dataset.dir;
      const big = row.classList.contains('marquee__row--big');
      return gsap.fromTo(row.children, { xPercent: dir < 0 ? 0 : -100 }, { xPercent: dir < 0 ? -100 : 0, duration: big ? 22 : 38, ease: 'none', repeat: -1 });
    });
    const skew = gsap.quickTo('.marquee__row--big', 'skewX', { duration: 0.6, ease: 'power3' });
    ScrollTrigger.create({
      trigger: wrap, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => tweens.forEach((t) => (self.isActive ? t.play() : t.pause())),
      onUpdate: (self) => {
        const v = clamp(-1, 1, self.getVelocity() / 2500);
        skew(v * -12);
        tweens.forEach((t) => gsap.to(t, { timeScale: 1 + Math.abs(v) * 5, duration: 0.2, overwrite: true, onComplete: () => { skew(0); gsap.to(t, { timeScale: 1, duration: 1.4 }); } }));
      },
    });
  }

  /* ───────── Profile: subtle tilt on the portrait ───────── */
  function initTilt() {
    if (!FINE || REDUCE) return;
    $$('[data-tilt]').forEach((card) => {
      const img = $('img', card);
      gsap.set(card, { transformPerspective: 1200 });
      const q = (el, prop) => gsap.quickTo(el, prop, { duration: 0.9, ease: 'power3' });
      const rx = q(card, 'rotationX'), ry = q(card, 'rotationY');
      const ix = q(img, 'x'), iy = q(img, 'y');
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 9); rx(py * -7); ix(px * -14); iy(py * -10);
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); ix(0); iy(0); });
    });
  }

  /* ───────── Profile: scratch-off redaction (canvas) ───────── */
  function initScratch() {
    const box = $('.scratch');
    if (!box) return;
    const canvas = $('.scratch__canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const age = $('.scratch__age span');
    const skip = $('.secret__skip');
    let w = 0, h = 0, dpr = 1, touched = false, done = false, drawing = false, last = null, moves = 0;

    function paint() {
      if (touched || done) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.clientWidth; h = box.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#19191C'; ctx.fillRect(0, 0, w, h);

      // faint repeated "REDACTED" texture
      const small = Math.max(8, Math.round(h * 0.05));
      ctx.font = `500 ${small}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(245,245,240,.08)';
      const rowText = 'REDACTED   '.repeat(16);
      for (let y = 8, r = 0; y < h; y += small * 1.9, r++) ctx.fillText(rowText, r % 2 ? -small * 3 : 0, y);

      // frame + corner squares
      ctx.strokeStyle = ACCENT; ctx.lineWidth = 1;
      ctx.strokeRect(10.5, 10.5, w - 21, h - 21);
      ctx.fillStyle = ACCENT;
      [[6, 6], [w - 15, 6], [6, h - 15], [w - 15, h - 15]].forEach(([x, y]) => ctx.fillRect(x, y, 9, 9));

      // instruction
      const big = Math.round(Math.min(h * 0.09, w * 0.052));
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = 'SCRATCH TO DECLASSIFY';
      ctx.font = `700 ${big}px "JetBrains Mono", monospace`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = WHITE; ctx.fillRect(w / 2 - tw / 2 - 12, h / 2 - big, tw + 24, big * 2);
      ctx.fillStyle = INK; ctx.fillText(label, w / 2, h / 2 + 1);
    }

    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    function scratch(a, b) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(36, w * 0.13);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y + 0.01); ctx.stroke();
    }
    function cleared() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let clear = 0, total = 0;
      for (let i = 3; i < data.length; i += 4 * 24) { total++; if (data[i] < 40) clear++; }
      return clear / total;
    }
    function reveal() {
      if (done) return;
      done = true;
      box.classList.add('is-done');
      gsap.to(canvas, { autoAlpha: 0, duration: 0.5, ease: 'power2.out' });
      if (!REDUCE) gsap.fromTo(age, { yPercent: 60, scale: 0.6 }, { yPercent: 0, scale: 1, duration: 1.3, ease: 'expo.out' });
      const c = centerOf(box);
      popBurst(c.x, c.y, 16, 220);
      if (skip) skip.hidden = true;
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (done) return;
      drawing = true; touched = true;
      canvas.setPointerCapture(e.pointerId);
      last = pos(e); scratch(last, last);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e); scratch(last, p); last = p;
      if (++moves % 8 === 0 && cleared() > 0.5) reveal();
    });
    const end = () => { if (!drawing) return; drawing = false; if (cleared() > 0.5) reveal(); };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    if (skip) skip.addEventListener('click', reveal);

    paint();
    if (document.fonts) document.fonts.ready.then(paint);
    new ResizeObserver(paint).observe(box);
  }

  /* ==========================================================================
     Origin: vertical scroll → horizontal travel (pin + containerAnimation)
     ========================================================================== */
  function initStory() {
    const story = $('.story');
    if (!story) return;
    if (REDUCE) { story.classList.add('is-static'); return; }

    const pin = $('.story__pin');
    const track = $('.story__track');
    const cards = $$('.panel--card', track);
    const marker = $('.story__marker');
    const count = $('.story__count b');
    const progress = $('.story__progress');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    let shown = -1, centers = [];

    const setLine = gsap.quickSetter('.story__line i', 'scaleX');
    const setMarker = gsap.quickSetter(marker, 'x', 'px');

    function update(p) {
      setLine(p);
      setMarker(p * progress.offsetWidth);
      const x = -dist() * p;
      let n = 0;
      centers.forEach((c) => { if (c + x < window.innerWidth * 0.66) n++; });
      if (n !== shown) {
        shown = n;
        count.textContent = pad(n);
        gsap.fromTo(count, { yPercent: 50, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.5, overwrite: true });
      }
    }

    const move = gsap.to(track, {
      x: () => -dist(),
      ease: 'none', // required: scroll distance maps 1:1 to horizontal position
      scrollTrigger: {
        trigger: story, pin, start: 'top top', end: () => '+=' + dist(),
        scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1,
        onRefresh: (self) => { centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2); shown = -1; update(self.progress); },
        onUpdate: (self) => update(self.progress),
      },
    });

    splitWords($('.panel--intro .h2'));
    gsap.timeline({ scrollTrigger: { trigger: story, start: 'top 55%', once: true } })
      .from('.panel--intro .wi', { yPercent: 118, duration: 1.2, stagger: 0.05 })
      .from(['.panel__lead', '.panel__go'], { y: 26, autoAlpha: 0, duration: 1, stagger: 0.1 }, 0.3);

    cards.forEach((card) => {
      gsap.from(card, {
        y: 70, autoAlpha: 0, duration: 1.2,
        scrollTrigger: { containerAnimation: move, trigger: card, start: 'left 96%', toggleActions: 'play none none reverse' },
      });
      // the panel nearest the centre lights up
      ScrollTrigger.create({ containerAnimation: move, trigger: card, start: 'left 64%', end: 'right 36%', toggleClass: { targets: card, className: 'is-active' } });
      gsap.fromTo($('.panel__kanji', card), { xPercent: 9 }, {
        xPercent: -9, ease: 'none',
        scrollTrigger: { containerAnimation: move, trigger: card, start: 'left right', end: 'right left', scrub: true },
      });
    });
    gsap.from('.panel__endtext', {
      y: 60, autoAlpha: 0, duration: 1.2,
      scrollTrigger: { containerAnimation: move, trigger: '.panel--end', start: 'left 85%', toggleActions: 'play none none reverse' },
    });
  }

  /* ==========================================================================
     Wardrobe: switch looks (index list · arrows · swipe)
     ========================================================================== */
  function initLook() {
    const sec = $('.look');
    if (!sec) return;
    const LOOKS = [
      { key: 'CASUAL', color: '#8FE3EE', name: 'Off-duty MEM-cho',
        desc: 'Sky-blue off-shoulder knit over a black skirt, a mint scrunchie, and a purple phone case with little devil ears. Everyday influencer style.',
        tags: ['Casual', 'Off-shoulder', 'Season 1'] },
      { key: 'IDOL', color: '#E8324F', name: 'Idol MEM-cho',
        desc: 'Red top with white frills, a black capelet and shorts. The idol look from the Season 2 character visuals — MEM-cho as she stands on stage.',
        tags: ['Idol', 'New B-Komachi', 'Season 2'] },
      { key: 'YELLOW', color: '#FFE500', name: 'Black & yellow',
        desc: 'A black mini dress with frills, gloves and an oversized ribbon in her image colour. The sharper, flashier Season 3 visual.',
        tags: ['Image colour', 'Ribbon', 'Season 3'] },
    ];
    const stage = $('.look__stage');
    const panel = $('.look__panel');
    const figs = $$('.look__fig', sec);
    const tabs = $$('.look__list button', sec);
    const word = $('.look__word span');
    const no = $('.look__no b'), name = $('.look__name'), desc = $('.look__desc'), tags = $('.look__tags');
    const infoEls = [$('.look__no'), name, desc, tags];
    let cur = 0, busy = false;

    function fill(i) {
      const L = LOOKS[i];
      no.textContent = pad(i + 1);
      name.textContent = L.name;
      desc.textContent = L.desc;
      tags.innerHTML = L.tags.map((t) => `<li>${t}</li>`).join('');
    }

    function go(i, dir) {
      i = (i + LOOKS.length) % LOOKS.length;
      if (busy || i === cur) return;
      busy = true;
      const from = figs[cur], to = figs[i], L = LOOKS[i];
      tabs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-selected', k === i); });
      cur = i;
      if (REDUCE) {
        gsap.set(from, { autoAlpha: 0 }); gsap.set(to, { autoAlpha: 1, x: 0, xPercent: 0 });
        gsap.set(panel, { backgroundColor: L.color });
        word.textContent = L.key; fill(i); busy = false;
        return;
      }
      gsap.timeline({ onComplete: () => { busy = false; } })
        .to(from, { xPercent: -26 * dir, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, 0)
        .fromTo(to, { xPercent: 26 * dir, x: 0, rotation: 0, autoAlpha: 0 }, { xPercent: 0, autoAlpha: 1, duration: 1.1 }, 0.38)
        // colour panel wipes out upward, then back in from the floor
        .to(panel, { scaleY: 0, transformOrigin: '50% 0%', duration: 0.5, ease: 'expo.in' }, 0)
        .set(panel, { backgroundColor: L.color, transformOrigin: '50% 100%' }, 0.5)
        .to(panel, { scaleY: 1, duration: 1 }, 0.5)
        .to(word, { yPercent: 105, duration: 0.4, ease: 'power3.in' }, 0)
        .add(() => { word.textContent = L.key; }, 0.41)
        .to(word, { yPercent: 0, duration: 1 }, 0.42)
        .to(infoEls, { y: -12, autoAlpha: 0, duration: 0.25, ease: 'power2.in', stagger: 0.03 }, 0)
        .add(() => fill(i), 0.37)
        .fromTo(infoEls, { y: 18 }, { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.06 }, 0.4);
    }

    $('.arrow--prev', sec).addEventListener('click', () => go(cur - 1, -1));
    $('.arrow--next', sec).addEventListener('click', () => go(cur + 1, 1));
    tabs.forEach((t, i) => t.addEventListener('click', () => go(i, i > cur ? 1 : -1)));

    // drag / swipe
    let startX = null;
    stage.addEventListener('pointerdown', (e) => { if (busy) return; startX = e.clientX; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => {
      if (startX === null || busy) return;
      gsap.to(figs[cur], { x: (e.clientX - startX) * 0.5, duration: 0.4, overwrite: 'auto' });
    });
    const release = (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 60 && e.type === 'pointerup') go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      else gsap.to(figs[cur], { x: 0, duration: 0.9, overwrite: 'auto' });
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    if (!REDUCE) {
      gsap.timeline({ scrollTrigger: { trigger: stage, start: 'top 85%', once: true } })
        .from(panel, { scaleY: 0, transformOrigin: '50% 100%', duration: 1.4, ease: 'expo.inOut' })
        .from(figs[0], { yPercent: 10, autoAlpha: 0, duration: 1.4 }, 0.35);
      gsap.fromTo('.look__word', { xPercent: 6 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* ==========================================================================
     Live: buzz simulator (canvas particles)
     ========================================================================== */
  function initLive() {
    const sec = $('.live');
    if (!sec) return;
    const screen = $('.phone__screen');
    const canvas = $('.phone__fx');
    const ctx = canvas.getContext('2d');
    const chara = $('.phone__chara');
    const heartBtn = $('.phone__heart');
    const bubbleText = $('.phone__bubble span');
    const chat = $('.phone__chat');
    const bar = $('.gauge__bar');
    const fill = $('i', bar);
    const stageEl = $('.gauge__stage');
    const viewersEls = $$('.live__viewers');
    const likesEl = $('.live__likes');
    const rankEl = $('.live__rank');
    const win = $('.phone__win');
    const resetBtn = $('.live__reset');

    const STAGES = [
      { at: 0, label: 'QUIET STREAM', line: 'come in, come in~! smash that heart!', rank: '—' },
      { at: 25, label: 'WORD IS SPREADING', line: 'ooh, it\'s catching on~!', rank: '#48' },
      { at: 50, label: 'CLIMBING FAST', line: 'this pace… we\'re climbing?!', rank: '#12' },
      { at: 75, label: 'ABOUT TO TREND', line: 'almost there! i can see no.1!', rank: '#3' },
      { at: 100, label: 'N°1 TRENDING', line: 'we did it~! buzz pro, as promised!', rank: '#1' },
    ];
    const USERS = ['yellowpenlight', 'hornsforever', 'buzzhunter', 'bkomachi_stan', 'lightstick_pro', 'allnighter', 'day1fan', 'heartspammer', 'algo_gods', 'lemonyellow'];
    const MSGS = ['MEM-cho so cute today', 'where are the horns from??', 'yellow penlights ready!', 'B-Komachi live again pls', 'more Aqua-tan stories lol', 'LET IT TREND', 'legendary stream', 'spamming hearts rn', 'here since stream one', 'collab with Ruby when', 'teasing Arima-chan again lol', 'this is blowing up', 'MEM! MEM! MEM!', 'server is melting', 'one million hearts go', 'that laugh is addictive', 'number one let\'s gooo'];
    const COLORS = [ACCENT, ACCENT, WHITE, INK];

    let buzz = 0, shown = 0, likes = 0, lastTap = 0, won = false, active = false, stage = 0, chatTimer = null;
    let W = 0, H = 0, dpr = 1, parts = [], lastT = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = screen.clientWidth; H = screen.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    new ResizeObserver(resize).observe(screen);
    resize();

    function heart(x, y, big) {
      parts.push({
        t: 'heart', x, y, vx: rand(-40, 40), vy: rand(-260, -150), s: big ? rand(12, 18) : rand(6, 11),
        r: rand(-0.4, 0.4), vr: rand(-1.4, 1.4), life: 0, max: rand(1.1, 1.8), sway: rand(0, 6.28), c: COLORS[Math.floor(rand(0, COLORS.length))],
      });
    }
    function confetti() {
      for (let i = 0; i < 110; i++) {
        parts.push({
          t: 'conf', x: W / 2 + rand(-30, 30), y: H * 0.45, vx: rand(-320, 320), vy: rand(-620, -160), s: rand(4, 9),
          r: rand(0, 6.28), vr: rand(-12, 12), life: 0, max: rand(1.6, 2.8), c: COLORS[i % COLORS.length],
        });
      }
    }
    function drawHeart(s) {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.9);
      ctx.bezierCurveTo(-s * 1.25, s * 0.05, -s * 0.9, -s * 0.95, 0, -s * 0.3);
      ctx.bezierCurveTo(s * 0.9, -s * 0.95, s * 1.25, s * 0.05, 0, s * 0.9);
      ctx.closePath();
    }

    function tap(x, y) {
      if (won) return;
      likes++;
      lastTap = performance.now();
      buzz = Math.min(100, buzz + 3.6);
      likesEl.textContent = fmt(likes);
      heart(x, y, true);
      for (let i = 0; i < 2; i++) heart(W - 39 + rand(-8, 8), H - 58);
      if (!REDUCE) {
        gsap.fromTo(chara, { scaleY: 0.96, scaleX: 1.03 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.4)', overwrite: true });
        gsap.fromTo(heartBtn, { scale: 0.84 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', overwrite: true });
      }
      if (buzz >= 100) finish();
    }

    function finish() {
      won = true; buzz = 100;
      confetti();
      const c = centerOf(screen);
      popBurst(c.x, c.y, 18, 260);
      gsap.fromTo(win, { autoAlpha: 0, scaleY: 0 }, { autoAlpha: 1, scaleY: 1, duration: 0.9, delay: 0.15 });
      resetBtn.hidden = false;
      gsap.fromTo(resetBtn, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.6, clearProps: 'transform' });
    }

    function reset() {
      won = false; buzz = 0; likes = 0; stage = -1;
      likesEl.textContent = '0';
      gsap.to(win, { autoAlpha: 0, scaleY: 0, duration: 0.35, ease: 'power3.in' });
      resetBtn.hidden = true;
    }

    function addChat() {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = USERS[Math.floor(rand(0, USERS.length))];
      li.append(b, MSGS[Math.floor(rand(0, MSGS.length))]);
      chat.appendChild(li);
      gsap.from(li, { y: 14, autoAlpha: 0, duration: 0.35, ease: 'power2.out' });
      while (chat.children.length > 7) chat.firstElementChild.remove();
    }
    function chatLoop() {
      if (!active) { chatTimer = null; return; }
      addChat();
      if (!won && Math.random() < 0.3 + buzz / 140) heart(W - 39 + rand(-8, 8), H - 58);
      chatTimer = gsap.delayedCall(interpolate(1.5, 0.28, buzz / 100) * rand(0.7, 1.3), chatLoop);
    }

    function frame() {
      if (!active && !parts.length) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
      lastT = now;

      // stop tapping and the hype cools off
      if (!won && buzz > 0 && now - lastTap > 650) buzz = Math.max(0, buzz - 6 * dt);
      const prev = shown;
      shown += (buzz - shown) * Math.min(1, dt * 9);
      if (Math.abs(buzz - shown) < 0.05) shown = buzz;
      if (shown !== prev) {
        const p = shown / 100;
        fill.style.transform = `scaleX(${p})`;
        bar.setAttribute('aria-valuenow', Math.round(shown));
        const viewers = fmt(1204 + p * p * 368796);
        viewersEls.forEach((el) => { el.textContent = viewers; });
      }
      let s = 0;
      STAGES.forEach((st, i) => { if (buzz >= st.at) s = i; });
      if (s !== stage) {
        const up = s > stage;
        stage = s;
        scramble(stageEl, STAGES[s].label, 0.5);
        rankEl.textContent = STAGES[s].rank;
        if (up || s === 0) scramble(bubbleText, STAGES[s].line, 0.5);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life > p.max) { parts.splice(i, 1); continue; }
        const k = p.life / p.max;
        if (p.t === 'heart') {
          p.vy += 60 * dt;
          p.x += (p.vx + Math.sin(p.sway + p.life * 5) * 50) * dt;
          p.y += p.vy * dt;
        } else {
          p.vy += 900 * dt; p.vx *= 1 - 1.2 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
        }
        p.r += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.fillStyle = p.c;
        if (p.t === 'heart') {
          const sc = Math.min(1, p.life * 8);
          ctx.scale(sc, sc);
          drawHeart(p.s);
          ctx.fill();
          ctx.lineWidth = 1.5; ctx.strokeStyle = p.c === INK ? ACCENT : INK; ctx.stroke();
        } else {
          ctx.scale(1, Math.cos(p.life * 14 + p.r));
          ctx.fillRect(-p.s, -p.s, p.s * 2, p.s * 2);
        }
        ctx.restore();
      }
    }
    gsap.ticker.add(frame);

    screen.addEventListener('pointerdown', (e) => {
      const r = screen.getBoundingClientRect();
      tap(e.clientX - r.left, e.clientY - r.top);
    });
    heartBtn.addEventListener('click', (e) => { if (e.detail === 0) tap(W - 39, H - 42); }); // keyboard
    resetBtn.addEventListener('click', reset);

    ScrollTrigger.create({
      trigger: sec, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => {
        active = self.isActive;
        lastT = 0;
        if (active && !chatTimer) chatLoop();
      },
    });
  }

  /* ==========================================================================
     B-Komachi: penlight colour switch
     ========================================================================== */
  function initStage() {
    const sec = $('.stage');
    if (!sec) return;
    const crowd = $('.crowd');
    const members = $$('.member', sec);
    const call = $('.stage__call');
    members.forEach((m) => m.style.setProperty('--mc', m.dataset.color));

    const n = clamp(26, 96, Math.round(window.innerWidth / 15));
    const sticks = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.style.left = `${((i + 0.5) / n) * 100 + rand(-0.4, 0.4)}%`;
      el.style.height = `${rand(34, 92)}%`;
      crowd.appendChild(el);
      sticks.push(el);
    }
    if (!REDUCE) {
      const sway = gsap.fromTo(sticks, { rotation: -11 }, {
        rotation: 11, duration: 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1,
        stagger: { each: 0.02, from: 'start', repeat: -1, yoyo: true },
      });
      ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? sway.play() : sway.pause()) });
    }

    function select(m, silent) {
      members.forEach((x) => { const on = x === m; x.classList.toggle('is-active', on); x.setAttribute('aria-checked', on); });
      sec.style.setProperty('--glow', m.dataset.color);
      call.innerHTML = `Penlights turn <b>${m.dataset.hue}</b> for <span>${m.dataset.name}</span>.`;
      if (silent || REDUCE) return;
      gsap.fromTo(sticks, { scaleY: 1.4 }, { scaleY: 1, duration: 1.1, ease: 'elastic.out(1, 0.45)', stagger: { each: 0.007, from: 'center' }, overwrite: 'auto' });
      scramble($('b', call), m.dataset.hue, 0.4);
    }
    members.forEach((m) => m.addEventListener('click', () => select(m)));
    select($('.member.is-active', sec) || members[0], true);
  }

  /* ───────── Accordions (her people · footnotes) ───────── */
  function accordion(rows, headSel, bodySel, single) {
    rows.forEach((row) => {
      const head = $(headSel, row);
      const body = $(bodySel, row);
      row._set = (open) => {
        row.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', open);
        gsap.to(body, { height: open ? 'auto' : 0, duration: REDUCE ? 0 : 0.8, ease: 'expo.inOut', overwrite: true, onComplete: refreshSoon });
      };
      head.addEventListener('click', () => {
        const open = !row.classList.contains('is-open');
        if (single && open) rows.forEach((r) => { if (r !== row && r.classList.contains('is-open')) r._set(false); });
        row._set(open);
      });
    });
  }

  function initNet() {
    const rows = $$('.net__row');
    if (!rows.length) return;
    accordion(rows, '.net__head', '.net__body', true);

    // desktop: a portrait follows the cursor while a row is hovered
    const float = $('.net__float');
    if (!float || !FINE || REDUCE) return;
    const img = $('img', float);
    const list = $('.net');
    gsap.set(float, { x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 0.9 });
    const fx = gsap.quickTo(float, 'x', { duration: 0.7, ease: 'power3' });
    const fy = gsap.quickTo(float, 'y', { duration: 0.7, ease: 'power3' });
    rows.forEach((row) => {
      $('.net__head', row).addEventListener('pointerenter', () => {
        if (img.getAttribute('src') !== row.dataset.img) img.src = row.dataset.img;
        gsap.to(float, { autoAlpha: 1, scale: 1, duration: 0.6, overwrite: 'auto' });
        gsap.fromTo(img, { scale: 1.3 }, { scale: 1, duration: 1.2, overwrite: true });
      });
    });
    list.addEventListener('pointermove', (e) => {
      fx(Math.min(Math.max(e.clientX + 30, window.innerWidth * 0.5), window.innerWidth - float.offsetWidth - 20));
      fy(e.clientY - float.offsetHeight * 0.55);
    });
    list.addEventListener('pointerleave', () => gsap.to(float, { autoAlpha: 0, scale: 0.9, duration: 0.4, overwrite: 'auto' }));
  }

  /* ==========================================================================
     Archive: photo deck (Draggable) + lightbox
     ========================================================================== */
  function initDeck() {
    const deck = $('.deck');
    if (!deck) return;
    const cards = $$('.deck__card', deck);
    const n = cards.length;
    const noEl = $('.gallery__no b');
    const titleEl = $('.gallery__title');
    let order = cards.slice(); // order[0] is on top
    let busy = false;

    const slot = (i) => (i === 0
      ? { x: 0, y: 0, rotation: 0, scale: 1 }
      : { x: (i % 2 ? 1 : -1) * (16 + i * 11), y: i * 6, rotation: (i % 2 ? 1 : -1) * (2 + i * 1.3), scale: 1 - i * 0.03 });

    function caption() {
      const top = order[0];
      noEl.textContent = pad(cards.indexOf(top) + 1);
      titleEl.textContent = top.dataset.title;
      if (!REDUCE) gsap.fromTo([noEl, titleEl], { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.05, overwrite: true });
    }

    function layout(skip) {
      order.forEach((card, i) => {
        drags.get(card)[i === 0 ? 'enable' : 'disable']();
        if (card === skip) return;
        gsap.set(card, { zIndex: n - i });
        gsap.to(card, { ...slot(i), autoAlpha: 1, duration: REDUCE ? 0 : 0.9, overwrite: true });
      });
      caption();
    }

    // throw the top print out in `dir` and tuck it under the pile
    function next(dir) {
      if (busy) return;
      busy = true;
      const card = order.shift();
      order.push(card);
      const out = dir * (deck.offsetWidth * 0.75 + 160);
      gsap.timeline({ onComplete: () => { busy = false; } })
        .to(card, { x: out, rotation: dir * 18, duration: 0.38, ease: 'power3.in', overwrite: true })
        .set(card, { zIndex: 0 })
        .to(card, { ...slot(n - 1), duration: 0.8 });
      layout(card);
    }
    // bring the bottom print back to the top
    function prev() {
      if (busy) return;
      busy = true;
      const card = order.pop();
      order.unshift(card);
      const out = deck.offsetWidth * 0.75 + 160;
      gsap.timeline({ onComplete: () => { busy = false; gsap.set(card, { zIndex: n }); } })
        .to(card, { x: out, rotation: 16, duration: 0.34, ease: 'power3.in', overwrite: true })
        .set(card, { zIndex: n + 1 })
        .to(card, { ...slot(0), duration: 0.9 });
      layout(card);
    }

    const drags = new Map();
    cards.forEach((card) => {
      let t0 = 0;
      const d = Draggable.create(card, {
        type: 'x', zIndexBoost: false, minimumMovement: 6, cursor: 'grab', activeCursor: 'grabbing',
        onDragStart() { t0 = performance.now(); gsap.killTweensOf(card, 'rotation'); },
        onDrag() { gsap.set(card, { rotation: this.x * 0.035 }); },
        onDragEnd() {
          const speed = Math.abs(this.x) / Math.max(1, performance.now() - t0);
          if (Math.abs(this.x) > 110 || (Math.abs(this.x) > 36 && speed > 0.55)) next(this.x < 0 ? -1 : 1);
          else gsap.to(card, { ...slot(0), duration: 0.9 });
        },
        onClick() { if (card === order[0] && !busy) openLightbox(card); },
      })[0];
      drags.set(card, d);
    });

    gsap.set(cards, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
    if (REDUCE) {
      layout();
    } else {
      order.forEach((card, i) => {
        gsap.set(card, { zIndex: n - i, y: 220, rotation: rand(-14, 14), autoAlpha: 0 });
        drags.get(card)[i === 0 ? 'enable' : 'disable']();
      });
      ScrollTrigger.create({
        trigger: deck, start: 'top 80%', once: true,
        onEnter: () => order.slice().reverse().forEach((card, k) => {
          gsap.to(card, { ...slot(n - 1 - k), autoAlpha: 1, duration: 1.2, delay: k * 0.08 });
        }),
      });
    }
    $('.gallery .arrow--next').addEventListener('click', () => next(-1));
    $('.gallery .arrow--prev').addEventListener('click', prev);

    // lightbox
    const lb = $('.lightbox');
    const lbImg = $('img', lb);
    const lbCap = $('.lightbox__cap', lb);
    const lbClose = $('.lightbox__close', lb);
    let lastFocus = null;
    function openLightbox(card) {
      const img = $('img', card);
      lastFocus = document.activeElement;
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt;
      lbCap.textContent = card.dataset.title;
      lb.hidden = false;
      lockScroll(true);
      gsap.fromTo(lb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 });
      gsap.fromTo(lbImg, { scale: 0.86, clipPath: 'inset(50% 0% 50% 0%)' }, { scale: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: REDUCE ? 0 : 1 });
      lbClose.focus();
    }
    function closeLightbox() {
      if (lb.hidden) return;
      lockScroll(false);
      gsap.to(lb, { autoAlpha: 0, duration: 0.25, ease: 'power2.in', onComplete: () => { lb.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); } });
    }
    lb.addEventListener('click', (e) => { if (e.target !== lbImg) closeLightbox(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  }

  /* ==========================================================================
     Navigation · cursor · magnetic button · footer
     ========================================================================== */
  function initNav() {
    const links = $$('.nav__links a');
    const setActive = (id) => links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    $$('[data-nav]').forEach((sec) => {
      ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => { if (self.isActive) setActive(sec.id); } });
    });
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 55%', onEnterBack: () => setActive('') });
    gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    // mobile menu: full-screen panel wiped in with clip-path
    const toggle = $('.nav__toggle');
    const label = $('span', toggle);
    const menu = $('.menu');
    const items = $$('.menu a', menu);
    let open = false;
    function setMenu(state) {
      if (state === open) return;
      open = state;
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      label.textContent = open ? 'Close' : 'Menu';
      menu.setAttribute('aria-hidden', !open);
      lockScroll(open);
      gsap.killTweensOf([menu, items]);
      if (open) {
        gsap.set(menu, { visibility: 'visible' });
        gsap.fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: REDUCE ? 0 : 0.9, ease: 'expo.inOut' });
        gsap.fromTo(items, { yPercent: 110 }, { yPercent: 0, duration: REDUCE ? 0 : 1, stagger: 0.05, delay: REDUCE ? 0 : 0.3 });
      } else {
        gsap.to(menu, { clipPath: 'inset(100% 0% 0% 0%)', duration: REDUCE ? 0 : 0.7, ease: 'expo.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
      }
    }
    toggle.addEventListener('click', () => setMenu(!open));
    items.forEach((a) => a.addEventListener('click', () => setMenu(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width: 1021px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  // crosshair cursor with a live coordinate readout
  function initCursor() {
    if (!FINE || REDUCE) return;
    const cur = $('.cursor');
    const posEl = $('.cursor__pos');
    const label = $('.cursor__ring b');
    const x = gsap.quickTo(cur, 'x', { duration: 0.25, ease: 'power3' });
    const y = gsap.quickTo(cur, 'y', { duration: 0.25, ease: 'power3' });
    let px = -1, py = -1, queued = false;
    const classify = (t) => {
      const tagged = t && t.closest('[data-cursor]');
      const link = t && t.closest('a, button');
      cur.classList.toggle('is-label', !!tagged);
      cur.classList.toggle('is-link', !tagged && !!link);
      if (tagged) label.textContent = tagged.dataset.cursor;
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      px = e.clientX; py = e.clientY;
      x(px); y(py);
      posEl.textContent = `X${pad(Math.round(px), 4)} Y${pad(Math.round(py), 4)}`;
      cur.classList.add('is-on');
      classify(e.target instanceof Element ? e.target : null);
    }, { passive: true });
    window.addEventListener('scroll', () => {
      if (queued || px < 0) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; classify(document.elementFromPoint(px, py)); });
    }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
  }

  function initMagnetic() {
    if (!FINE || REDUCE) return;
    $$('[data-magnetic]').forEach((el) => {
      const x = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.5)' });
      const y = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.5)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.3);
        y((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }

  function initFooter() {
    if (REDUCE) return;
    gsap.from('.footer__big span', { yPercent: 70, autoAlpha: 0, duration: 1.4, stagger: 0.1, scrollTrigger: { trigger: '.footer', start: 'top 78%', once: true } });
    gsap.from(['.footer__say', '.footer .btn', '.footer__credits p'], { y: 24, autoAlpha: 0, duration: 1.1, stagger: 0.07, scrollTrigger: { trigger: '.footer__row', start: 'top 94%', once: true } });
  }

  /* ==========================================================================
     Boot — strictly in page order
     ========================================================================== */
  const playIntro = initHero();
  initMarquee();
  revealsIn($('.profile'));
  initTilt();
  initScratch();
  initStory();
  revealsIn($('.look'));
  initLook();
  revealsIn($('.live'));
  initLive();
  revealsIn($('.stage'));
  initStage();
  initNet();
  revealsIn($('.gallery'));
  initDeck();
  revealsIn($('.trivia'));
  accordion($$('.faq__row'), '.faq__head', '.faq__body', false);
  initFooter();
  initNav();
  initCursor();
  initMagnetic();

  initLoader(playIntro);

  // late fonts / images can shift layout → re-measure
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
