/* ==========================================================================
   MEM쵸 캐릭터 파일 — 인터랙션 스크립트
   GSAP(ScrollTrigger · Draggable) + Lenis
   - ScrollTrigger는 페이지 위→아래 순서로 생성한다 (pin 간격 계산 때문에 순서가 중요)
   - 움직임은 transform / opacity 위주, 자주 갱신되는 값은 gsap.quickTo 사용
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js'); // 라이브러리 로드 실패 시: 정적인 페이지로 그대로 보여 준다
    return;
  }

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const { clamp, random: rand } = gsap.utils;
  const fmt = (n) => Math.round(n).toLocaleString('ko-KR');

  gsap.registerPlugin(ScrollTrigger, Draggable, InertiaPlugin);
  gsap.defaults({ ease: 'power3.out', duration: 0.8 });
  ScrollTrigger.config({ ignoreMobileResize: true });

  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const PALETTE = ['#FFD12E', '#FF4F9A', '#1FC6DA', '#FFFFFF', '#5B3FD6'];

  if (!location.hash) {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }

  /* ───────── 부드러운 스크롤 (Lenis ↔ ScrollTrigger 동기화) ───────── */
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

  /* ───────── 공용: 터지는 파티클 (DOM) ───────── */
  const ICONS = ['i-heart', 'i-spark', 'i-star', 'i-horn'];
  function popBurst(x, y, count = 12, spread = 150) {
    if (REDUCE) return;
    for (let i = 0; i < count; i++) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#' + ICONS[i % ICONS.length]);
      svg.appendChild(use);
      svg.setAttribute('class', 'pop');
      svg.style.fill = PALETTE[i % PALETTE.length];
      document.body.appendChild(svg);
      const angle = rand(0, Math.PI * 2);
      const dist = rand(spread * 0.4, spread);
      gsap.set(svg, { x, y, xPercent: -50, yPercent: -50, scale: 0, rotation: rand(-90, 90) });
      gsap.timeline({ onComplete: () => svg.remove() })
        .to(svg, { x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist - 30, scale: rand(0.6, 1.4), rotation: rand(-200, 200), duration: rand(0.6, 0.9), ease: 'power3.out' })
        .to(svg, { y: '+=50', autoAlpha: 0, scale: 0.2, duration: 0.45, ease: 'power2.in' }, '-=0.15');
    }
  }
  const centerOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  /* ───────── 공용: 글자 단위 분할 ───────── */
  function splitChars(el) {
    const text = el.textContent.trim();
    el.setAttribute('aria-label', text);
    el.textContent = '';
    text.split(' ').forEach((word, i, arr) => {
      const w = document.createElement('span');
      w.className = 'word';
      w.setAttribute('aria-hidden', 'true');
      for (const ch of word) {
        const c = document.createElement('span');
        c.className = 'char';
        c.textContent = ch;
        w.appendChild(c);
      }
      el.appendChild(w);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(' '));
    });
    return $$('.char', el);
  }

  /* ───────── 공용: 섹션 단위 등장 애니메이션 ───────── */
  function revealsIn(scope) {
    $$('[data-split]', scope).forEach((el) => {
      const chars = splitChars(el);
      if (REDUCE) return;
      gsap.from(chars, {
        yPercent: 90, scale: 0.4, autoAlpha: 0, rotation: () => rand(-25, 25),
        duration: 0.75, ease: 'back.out(2)', stagger: 0.035,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });

    const items = $$('[data-reveal]', scope);
    if (!items.length || REDUCE) return;
    items.forEach((el) => {
      const pop = el.dataset.reveal === 'pop';
      gsap.set(el, { autoAlpha: 0, y: pop ? 70 : 36, scale: pop ? 0.86 : 1 });
    });
    ScrollTrigger.batch(items, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => batch.forEach((el, i) => {
        const pop = el.dataset.reveal === 'pop';
        gsap.to(el, { autoAlpha: 1, y: 0, scale: 1, duration: pop ? 1 : 0.8, ease: pop ? 'back.out(1.5)' : 'power3.out', delay: i * 0.07, overwrite: true });
      }),
    });

    $$('[data-count]', scope).forEach((el) => {
      const to = +el.dataset.count;
      const suffix = el.dataset.suffix || '';
      const o = { v: 0 };
      const render = () => { el.innerHTML = `${fmt(o.v)}<small>${suffix}</small>`; };
      render();
      gsap.to(o, { v: to, duration: 1.8, ease: 'power2.out', onUpdate: render, scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
  }

  /* ==========================================================================
     로더 → 히어로 인트로
     ========================================================================== */
  function initLoader(onDone) {
    const loader = $('.loader');
    if (!loader) return onDone();
    const bar = $('.loader__bar i');
    const pct = $('.loader__pct span');
    const o = { p: 0 };
    const render = () => { bar.style.transform = `scaleX(${o.p})`; pct.textContent = Math.round(o.p * 100); };

    lockScroll(true);
    gsap.set('.loader__horns svg:last-child', { scaleX: -1 });
    const wiggle = gsap.fromTo('.loader__horns svg', { rotation: -8 }, { rotation: 8, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.12 });
    const creep = gsap.to(o, { p: 0.8, duration: 2.2, ease: 'power1.out', onUpdate: render });

    const decode = (src) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = src; });
    const ready = Promise.all([
      decode('assets/img/memcho-full.webp'),
      decode('assets/img/memcho-bust.webp'),
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((res) => setTimeout(res, 900)), // 너무 빨리 사라지지 않도록
    ]);
    const timeout = new Promise((res) => setTimeout(res, 4500));

    Promise.race([ready, timeout]).then(() => {
      creep.kill();
      gsap.to(o, {
        p: 1, duration: 0.45, ease: 'power2.out', onUpdate: render,
        onComplete: () => {
          wiggle.kill();
          const tl = gsap.timeline({ onComplete: () => loader.remove() });
          if (REDUCE) {
            tl.to(loader, { autoAlpha: 0, duration: 0.3 });
          } else {
            tl.to('.loader__inner', { scale: 0.7, autoAlpha: 0, duration: 0.35, ease: 'back.in(2)' })
              .fromTo(loader, { clipPath: 'circle(120% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)', duration: 0.8, ease: 'power3.inOut' }, '-=0.05');
          }
          tl.add(() => { lockScroll(false); onDone(); }, REDUCE ? 0 : 0.45);
        },
      });
    });
  }

  function initHero() {
    const hero = $('.hero');
    const float = $('.hero__chara-float');
    const bubble = $('.hero__bubble');
    const bubbleText = $('span', bubble);
    const stickers = $$('.sticker__in', hero);

    // 인트로 타임라인 (로더가 끝나면 재생)
    const intro = gsap.timeline({ paused: true, defaults: { ease: 'back.out(1.6)' } });
    if (!REDUCE) {
      intro
        .from('.hero__word i', { yPercent: 130, scale: 0.3, autoAlpha: 0, rotation: () => rand(-24, 24), duration: 0.95, stagger: 0.075 }, 0)
        .from(float, { yPercent: 45, autoAlpha: 0, duration: 1.2, ease: 'power4.out' }, 0.2)
        .from(stickers, { scale: 0, autoAlpha: 0, rotation: () => rand(-120, 120), duration: 0.8, stagger: { each: 0.06, from: 'random' } }, 0.55)
        .from(bubble, { scale: 0, autoAlpha: 0, duration: 0.55 }, 1.1)
        .from(['.hero__kicker', '.hero__foot > *', '.hero__scroll > *'], { y: 26, autoAlpha: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 0.75)
        .from(['.nav__logo', '.nav__links', '.nav__toggle'], { y: -70, autoAlpha: 0, duration: 0.8, ease: 'power3.out', stagger: 0.08 }, 0.6)
        .add(idle, 1.5);
    }

    // 둥실둥실 대기 모션
    function idle() {
      if (REDUCE) return;
      gsap.to(float, { y: -14, rotation: 0.9, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      stickers.forEach((el) => {
        gsap.to(el, { y: rand(-16, 16), rotation: `+=${rand(-9, 9)}`, duration: rand(2, 3.6), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: rand(0, 0.8) });
      });
    }

    // 스크롤 패럴랙스 (scrub)
    if (!REDUCE) {
      gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
        .to('.hero__word--a', { xPercent: -16 }, 0)
        .to('.hero__word--b', { xPercent: 16 }, 0)
        .to('.hero__chara', { yPercent: 10, scale: 0.94, transformOrigin: '50% 100%' }, 0)
        .to('.hero__stickers', { yPercent: -22 }, 0)
        .to(['.hero__foot', '.hero__scroll'], { autoAlpha: 0, y: -40, duration: 0.3 }, 0);
    }

    // 화면 밖에서는 CSS 무한 애니메이션을 멈춘다
    ScrollTrigger.create({ trigger: hero, start: 'top top', end: 'bottom top', onToggle: (self) => hero.classList.toggle('is-away', !self.isActive) });

    // 마우스 패럴랙스 — 깊이(data-depth)에 따라 다르게 움직인다
    if (FINE && !REDUCE) {
      const q = (el, prop) => gsap.quickTo(el, prop, { duration: 0.9, ease: 'power3' });
      const layers = $$('.sticker[data-depth]', hero).map((el) => ({ x: q(el, 'x'), y: q(el, 'y'), d: parseFloat(el.dataset.depth) }));
      const cx = q('.hero__chara-move', 'x'), cy = q('.hero__chara-move', 'y');
      const tx = q('.hero__title', 'x'), ty = q('.hero__title', 'y');
      hero.addEventListener('pointermove', (e) => {
        const nx = e.clientX / window.innerWidth - 0.5;
        const ny = e.clientY / window.innerHeight - 0.5;
        layers.forEach((l) => { l.x(nx * -46 * l.d); l.y(ny * -34 * l.d); });
        cx(nx * 22); cy(ny * 12);
        tx(nx * -30); ty(ny * -14);
      });
    }

    // 콕 찌르기
    const LINES = ['꺄! 간지럽잖아~', '구독이랑 좋아요, 눌러 줬어?', '이 뿔? 내 트레이드마크야!', '버즈의 냄새가 난다…!', '나이는… 비~밀!', '오늘도 떡상 가 보자고~!', '어서 와~ MEM쵸 채널이야!'];
    let line = 0;
    $('.hero__poke').addEventListener('click', (e) => {
      const p = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : centerOf(e.currentTarget);
      popBurst(p.x, p.y, 10, 140);
      if (!REDUCE) {
        gsap.timeline({ overwrite: 'auto' })
          .to(float, { scaleY: 0.9, scaleX: 1.07, duration: 0.11, ease: 'power2.out' })
          .to(float, { scaleY: 1, scaleX: 1, duration: 1, ease: 'elastic.out(1.2, 0.3)' });
      }
      gsap.timeline()
        .to(bubble, { scale: 0, duration: 0.14, ease: 'power2.in' })
        .add(() => { bubbleText.textContent = LINES[line++ % LINES.length]; })
        .to(bubble, { scale: 1, duration: 0.55, ease: 'back.out(2.4)' });
    });

    return () => (REDUCE ? null : intro.play());
  }

  /* ───────── 마키: 스크롤 속도에 반응 ───────── */
  function initMarquee() {
    const wrap = $('.marquee');
    if (!wrap || REDUCE) return;
    const tweens = $$('.marquee__row', wrap).map((row) => {
      const inner = $('.marquee__inner', row);
      for (let i = 0; i < 5; i++) row.appendChild(inner.cloneNode(true));
      const dir = +row.dataset.dir;
      return gsap.fromTo(row.children, { xPercent: dir < 0 ? 0 : -100 }, { xPercent: dir < 0 ? -100 : 0, duration: 22, ease: 'none', repeat: -1 });
    });
    const skew = gsap.quickTo('.marquee__row', 'skewX', { duration: 0.5, ease: 'power3' });
    ScrollTrigger.create({
      trigger: wrap, start: 'top bottom', end: 'bottom top',
      onToggle: (self) => tweens.forEach((t) => (self.isActive ? t.play() : t.pause())),
      onUpdate: (self) => {
        const v = clamp(-1, 1, self.getVelocity() / 2500);
        skew(v * -14);
        tweens.forEach((t) => gsap.to(t, { timeScale: 1 + Math.abs(v) * 5, duration: 0.2, overwrite: true, onComplete: () => { skew(0); gsap.to(t, { timeScale: 1, duration: 1.2 }); } }));
      },
    });
  }

  /* ───────── 프로필: 틸트 카드 ───────── */
  function initTilt() {
    if (!FINE || REDUCE) return;
    $$('[data-tilt]').forEach((card) => {
      const img = $('img', card);
      gsap.set(card, { transformPerspective: 900 });
      const q = (el, prop) => gsap.quickTo(el, prop, { duration: 0.6, ease: 'power3' });
      const rx = q(card, 'rotationX'), ry = q(card, 'rotationY');
      const ix = q(img, 'x'), iy = q(img, 'y');
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 24); rx(py * -20); ix(px * -16); iy(py * -12);
        card.style.setProperty('--gx', `${(px + 0.5) * 100}%`);
        card.style.setProperty('--gy', `${(py + 0.5) * 100}%`);
      });
      card.addEventListener('pointerleave', () => { rx(0); ry(0); ix(0); iy(0); });
    });
  }

  /* ───────── 프로필: 스크래치 카드 (canvas) ───────── */
  function initScratch() {
    const box = $('.scratch');
    if (!box) return;
    const canvas = $('.scratch__canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const age = $('.scratch__age span');
    let w = 0, h = 0, dpr = 1, touched = false, done = false, drawing = false, last = null, moves = 0;

    function paint() {
      if (touched || done) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.clientWidth; h = box.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#CFCBE2'); g.addColorStop(0.45, '#F6F4FC'); g.addColorStop(0.55, '#DAD6EA'); g.addColorStop(1, '#B4AED0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(29,20,54,.07)'; ctx.lineWidth = 8;
      for (let x = -h; x < w; x += 26) { ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke(); }
      ctx.fillStyle = '#1D1436'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${Math.round(h * 0.2)}px "Bagel Fat One", "Dela Gothic One", sans-serif`;
      ctx.fillText('여기를 긁어 봐!', w / 2, h * 0.46);
      ctx.font = `700 ${Math.round(h * 0.085)}px "Pretendard Variable", sans-serif`;
      ctx.fillStyle = 'rgba(29,20,54,.6)';
      ctx.fillText('㊙  SCRATCH  ㊙', w / 2, h * 0.7);
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
      gsap.to(canvas, { autoAlpha: 0, scale: 1.08, duration: 0.5, ease: 'power2.out' });
      if (!REDUCE) {
        gsap.fromTo(age, { scale: 0.2, rotation: -25 }, { scale: 1, rotation: 0, duration: 1.1, ease: 'elastic.out(1.1, 0.35)' });
        gsap.fromTo(box, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.2)' });
      }
      const c = centerOf(box);
      popBurst(c.x, c.y, 16, 220);
      const skip = $('.secret__skip');
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
    $('.secret__skip').addEventListener('click', reveal);

    paint();
    if (document.fonts) document.fonts.ready.then(paint);
    new ResizeObserver(paint).observe(box);
  }

  /* ==========================================================================
     스토리: 세로 스크롤 → 가로 이동 (pin + containerAnimation)
     ========================================================================== */
  function initStory() {
    const story = $('.story');
    if (!story) return;
    if (REDUCE) { story.classList.add('is-static'); return; }

    const pin = $('.story__pin');
    const track = $('.story__track');
    const cards = $$('.panel--card', track);
    const line = $('.story__line i');
    const marker = $('.story__marker');
    const count = $('.story__count b');
    const progress = $('.story__progress');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    let shown = -1, centers = [];

    const setLine = gsap.quickSetter(line, 'scaleX');
    const setMarker = gsap.quickSetter(marker, 'x', 'px');

    function update(p) {
      setLine(p);
      setMarker(p * progress.offsetWidth);
      const x = -dist() * p;
      let n = 0;
      centers.forEach((c) => { if (c + x < window.innerWidth * 0.66) n++; });
      if (n !== shown) {
        shown = n;
        count.textContent = String(n).padStart(2, '0');
        gsap.fromTo(count, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.4, overwrite: true });
        gsap.fromTo(marker, { rotation: -30 }, { rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' });
      }
    }

    // 가로 이동은 반드시 ease:'none' — 스크롤 거리와 1:1로 대응시킨다
    const move = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: story, pin, start: 'top top', end: () => '+=' + dist(),
        scrub: 0.7, invalidateOnRefresh: true, anticipatePin: 1,
        onRefresh: (self) => { centers = cards.map((c) => c.offsetLeft + c.offsetWidth / 2); shown = -1; update(self.progress); },
        onUpdate: (self) => update(self.progress),
      },
    });

    gsap.from('.panel--intro > *', { y: 50, autoAlpha: 0, duration: 0.9, stagger: 0.12, scrollTrigger: { trigger: story, start: 'top 55%', once: true } });

    cards.forEach((card) => {
      gsap.from(card, {
        y: 120, rotation: '+=9', autoAlpha: 0, duration: 0.9, ease: 'back.out(1.5)',
        scrollTrigger: { containerAnimation: move, trigger: card, start: 'left 94%', toggleActions: 'play none none reverse' },
      });
      gsap.fromTo($('.panel__kanji', card), { xPercent: 22 }, {
        xPercent: -22, ease: 'none',
        scrollTrigger: { containerAnimation: move, trigger: card, start: 'left right', end: 'right left', scrub: true },
      });
    });
    gsap.from('.panel--end > *', {
      scale: 0, rotation: () => rand(-40, 40), duration: 0.8, ease: 'back.out(2)', stagger: 0.1,
      scrollTrigger: { containerAnimation: move, trigger: '.panel--end', start: 'left 80%', toggleActions: 'play none none reverse' },
    });
  }

  /* ==========================================================================
     룩북: 의상 전환 (버튼 · 스와이프 · 키보드)
     ========================================================================== */
  function initLook() {
    const sec = $('.look');
    if (!sec) return;
    const LOOKS = [
      { key: 'CASUAL', name: '평소의 MEM쵸', bg: '#BFEFF2', accent: '#FFFFFF',
        desc: '하늘색 오프숄더 니트에 블랙 스커트. 민트색 슈슈와 작은 악마 귀가 달린 보라색 폰 케이스까지, 인플루언서다운 사복 스타일.',
        tags: ['#사복', '#오프숄더', '#TV애니 1기'] },
      { key: 'IDOL', name: '아이돌 MEM쵸', bg: '#FFA3B4', accent: '#FFE3E8',
        desc: '붉은 톱과 하얀 프릴, 검은 케이프에 쇼트 팬츠. TV 애니메이션 2기 캐릭터 비주얼에서 선보인, 무대에 서는 아이돌로서의 모습.',
        tags: ['#아이돌', '#신생B코마치', '#TV애니 2기'] },
      { key: 'YELLOW', name: '블랙 & 옐로', bg: '#CDBFFF', accent: '#FFF27A',
        desc: '검은 미니 원피스에 멤버 컬러인 노란 프릴과 장갑, 커다란 리본. 한층 화려해진 TV 애니메이션 3기의 비주얼.',
        tags: ['#멤버컬러', '#리본', '#TV애니 3기'] },
    ];
    const stage = $('.look__stage');
    const figs = $$('.look__fig', sec);
    const dots = $$('.look__dots button', sec);
    const blob = $('.look__blob');
    const word = $('.look__word span');
    const no = $('.look__no b'), name = $('.look__name'), desc = $('.look__desc'), tags = $('.look__tags');
    const infoEls = [$('.look__no'), name, desc, tags];
    let cur = 0, busy = false;

    function fill(i) {
      const L = LOOKS[i];
      no.textContent = String(i + 1).padStart(2, '0');
      name.textContent = L.name;
      desc.textContent = L.desc;
      tags.innerHTML = L.tags.map((t) => `<li>${t}</li>`).join('');
    }

    function go(i, dir) {
      i = (i + LOOKS.length) % LOOKS.length;
      if (busy || i === cur) return;
      busy = true;
      const from = figs[cur], to = figs[i], L = LOOKS[i];
      dots.forEach((d, k) => { d.classList.toggle('is-active', k === i); d.setAttribute('aria-selected', k === i); });
      cur = i;
      if (REDUCE) {
        gsap.set(from, { autoAlpha: 0 }); gsap.set(to, { autoAlpha: 1, x: 0, rotation: 0, scale: 1 });
        gsap.set(sec, { backgroundColor: L.bg }); gsap.set(blob, { backgroundColor: L.accent });
        word.textContent = L.key; fill(i); busy = false;
        return;
      }
      gsap.timeline({ onComplete: () => { busy = false; } })
        .to(from, { xPercent: -45 * dir, rotation: -12 * dir, scale: 0.8, autoAlpha: 0, duration: 0.42, ease: 'power2.in' }, 0)
        .fromTo(to, { xPercent: 45 * dir, x: 0, rotation: 12 * dir, scale: 0.8, autoAlpha: 0 }, { xPercent: 0, rotation: 0, scale: 1, autoAlpha: 1, duration: 0.85, ease: 'back.out(1.5)' }, 0.3)
        .to(sec, { backgroundColor: L.bg, duration: 0.8, ease: 'power2.inOut' }, 0)
        .to(blob, { backgroundColor: L.accent, scale: 1.12, duration: 0.4, ease: 'power2.in' }, 0)
        .to(blob, { scale: 1, duration: 0.9, ease: 'elastic.out(1, 0.5)' }, 0.4)
        .to(word, { yPercent: 110, duration: 0.3, ease: 'power2.in' }, 0)
        .add(() => { word.textContent = L.key; }, 0.31)
        .to(word, { yPercent: 0, duration: 0.7, ease: 'power3.out' }, 0.34)
        .to(infoEls, { y: -16, autoAlpha: 0, duration: 0.22, ease: 'power2.in', stagger: 0.03 }, 0)
        .add(() => fill(i), 0.33)
        .fromTo(infoEls, { y: 22 }, { y: 0, autoAlpha: 1, duration: 0.55, stagger: 0.06 }, 0.35);
      const c = centerOf(stage);
      popBurst(c.x, c.y, 8, Math.min(260, stage.offsetWidth * 0.5));
    }

    $('.arrow--prev', sec).addEventListener('click', () => go(cur - 1, -1));
    $('.arrow--next', sec).addEventListener('click', () => go(cur + 1, 1));
    dots.forEach((d, i) => d.addEventListener('click', () => go(i, i > cur ? 1 : -1)));

    // 드래그 / 스와이프
    let startX = null;
    stage.addEventListener('pointerdown', (e) => { if (busy) return; startX = e.clientX; stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => {
      if (startX === null || busy) return;
      const dx = e.clientX - startX;
      gsap.to(figs[cur], { x: dx * 0.5, rotation: dx * 0.03, duration: 0.3, overwrite: 'auto' });
    });
    const release = (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 60 && e.type === 'pointerup') go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      else gsap.to(figs[cur], { x: 0, rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
    };
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    if (!REDUCE) {
      gsap.from(stage, { y: 100, autoAlpha: 0, duration: 1.1, ease: 'power4.out', scrollTrigger: { trigger: stage, start: 'top 85%', once: true } });
      gsap.fromTo('.look__word', { xPercent: 8 }, { xPercent: -8, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  /* ==========================================================================
     라이브: 버즈 시뮬레이터 (canvas 파티클)
     ========================================================================== */
  function initLive() {
    const sec = $('.live');
    if (!sec) return;
    const screen = $('.phone__screen');
    const canvas = $('.phone__fx');
    const ctx = canvas.getContext('2d');
    const chara = $('.phone__chara');
    const heartBtn = $('.phone__heart');
    const bubble = $('.phone__bubble');
    const bubbleText = $('span', bubble);
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
      { at: 0, label: '잔잔한 방송', line: '다들 어서 와~! 하트 꾹꾹 눌러 줘!', rank: '— 위' },
      { at: 25, label: '입소문 타는 중', line: '오, 반응 온다 온다~!', rank: '48위' },
      { at: 50, label: '급상승!', line: '이 속도… 급상승 각인데?!', rank: '12위' },
      { at: 75, label: '트렌드 진입 직전!', line: '조금만 더! 1위가 보여!', rank: '3위' },
      { at: 100, label: '실시간 트렌드 1위', line: '해냈다~! 역시 버즈의 프로!', rank: '1위' },
    ];
    const USERS = ['노랑펜라이트', '뿔덕후', '버즈헌터', 'B코마치최고', '사이리움장인', '밤샘시청러', '첫방부터팬', '하트연타봇', '떡상기원', '옐로옐로'];
    const MSGS = ['MEM쵸 오늘도 귀여워ㅠㅠ', '뿔 머리띠 어디 거예요?', '노란 사이리움 준비 완료!', 'B코마치 라이브 또 해 줘요', '아쿠땅 얘기 더 해 주세요ㅋㅋ', '버즈 가자아아', '오늘 방송 레전드', '하트 연타 중', '첫 방송부터 봤어요', '루비랑 합방 해 줘요', '아리마쨩 또 놀리는 중ㅋㅋ', '떡상 각이다', 'MEM! MEM! MEM!', '서버 터지겠다', '하트 백만 개 가자', '웃음소리 중독됨', '트렌드 1위 가즈아'];

    let buzz = 0, shown = 0, likes = 0, lastTap = 0, won = false, active = false, stage = 0, chatTimer = null;
    let W = 0, H = 0, dpr = 1, parts = [], lastT = 0;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = screen.clientWidth; H = screen.clientHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    new ResizeObserver(resize).observe(screen);
    resize();

    function say(text) {
      gsap.timeline()
        .to(bubble, { scale: 0, duration: 0.12, ease: 'power2.in' })
        .add(() => { bubbleText.textContent = text; })
        .to(bubble, { scale: 1, duration: 0.5, ease: 'back.out(2.4)' });
    }

    function heart(x, y, big) {
      parts.push({
        t: 'heart', x, y, vx: rand(-40, 40), vy: rand(-260, -150), s: big ? rand(13, 20) : rand(7, 13),
        r: rand(-0.5, 0.5), vr: rand(-1.5, 1.5), life: 0, max: rand(1.1, 1.8), sway: rand(0, 6.28), c: PALETTE[Math.floor(rand(0, 4))],
      });
    }
    function confetti() {
      for (let i = 0; i < 110; i++) {
        parts.push({
          t: 'conf', x: W / 2 + rand(-30, 30), y: H * 0.45, vx: rand(-320, 320), vy: rand(-620, -160), s: rand(5, 10),
          r: rand(0, 6.28), vr: rand(-12, 12), life: 0, max: rand(1.6, 2.8), c: PALETTE[i % PALETTE.length],
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
      for (let i = 0; i < 2; i++) heart(W - 41 + rand(-8, 8), H - 60);
      if (!REDUCE) {
        gsap.fromTo(chara, { scaleY: 0.955, scaleX: 1.035 }, { scaleY: 1, scaleX: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.4)', overwrite: true });
        gsap.fromTo(heartBtn, { scale: 0.82 }, { scale: 1, duration: 0.45, ease: 'back.out(3)', overwrite: true });
      }
      if (buzz >= 100) finish();
    }

    function finish() {
      won = true; buzz = 100;
      confetti();
      const c = centerOf(screen);
      popBurst(c.x, c.y, 18, 260);
      gsap.fromTo(win, { autoAlpha: 0, scale: 0.4, rotation: -8 }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.8, ease: 'back.out(1.8)', delay: 0.15 });
      resetBtn.hidden = false;
      gsap.fromTo(resetBtn, { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.6, ease: 'back.out(2)', delay: 0.6, clearProps: 'transform' });
    }

    function reset() {
      won = false; buzz = 0; likes = 0; stage = -1;
      likesEl.textContent = '0';
      gsap.to(win, { autoAlpha: 0, scale: 0.6, duration: 0.3, ease: 'power2.in' });
      resetBtn.hidden = true;
    }

    function addChat() {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = USERS[Math.floor(rand(0, USERS.length))];
      li.append(b, MSGS[Math.floor(rand(0, MSGS.length))]);
      chat.appendChild(li);
      gsap.from(li, { y: 18, autoAlpha: 0, duration: 0.3, ease: 'power2.out' });
      while (chat.children.length > 7) chat.firstElementChild.remove();
    }
    function chatLoop() {
      if (!active) { chatTimer = null; return; }
      addChat();
      if (!won && Math.random() < 0.3 + buzz / 140) heart(W - 41 + rand(-8, 8), H - 60);
      chatTimer = gsap.delayedCall(gsap.utils.interpolate(1.5, 0.28, buzz / 100) * rand(0.7, 1.3), chatLoop);
    }

    function frame() {
      if (!active && !parts.length) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
      lastT = now;

      // 손을 멈추면 열기가 식는다
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
        stageEl.textContent = STAGES[s].label;
        rankEl.textContent = STAGES[s].rank;
        if (up || s === 0) say(STAGES[s].line);
        if (!REDUCE) gsap.fromTo([stageEl, rankEl], { scale: 1.4 }, { scale: 1, duration: 0.5, ease: 'back.out(3)', overwrite: true });
      }

      // 파티클
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
          ctx.lineWidth = 2; ctx.strokeStyle = '#1D1436'; ctx.stroke();
        } else {
          ctx.scale(1, Math.cos(p.life * 14 + p.r));
          ctx.fillRect(-p.s, -p.s * 0.5, p.s * 2, p.s);
        }
        ctx.restore();
      }
    }
    gsap.ticker.add(frame);

    screen.addEventListener('pointerdown', (e) => {
      const r = screen.getBoundingClientRect();
      tap(e.clientX - r.left, e.clientY - r.top);
    });
    heartBtn.addEventListener('click', (e) => { if (e.detail === 0) tap(W - 41, H - 44); }); // 키보드 조작
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
     스테이지: 사이리움 컬러 체인지
     ========================================================================== */
  function initStage() {
    const sec = $('.stage');
    if (!sec) return;
    const crowd = $('.crowd');
    const members = $$('.member', sec);
    const call = $('.stage__call');
    const NAMES = { '#FF3D5A': '빨간', '#FFD12E': '노란', '#F5F7FF': '하얀' };
    members.forEach((m) => m.style.setProperty('--mc', m.dataset.color));

    const n = clamp(18, 56, Math.round(window.innerWidth / 26));
    const sticks = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.style.left = `${((i + 0.5) / n) * 100 + rand(-0.8, 0.8)}%`;
      el.style.height = `${rand(44, 78)}%`;
      crowd.appendChild(el);
      sticks.push(el);
    }
    let sway = null;
    if (!REDUCE) {
      sway = gsap.fromTo(sticks, { rotation: -20 }, {
        rotation: 20, duration: 0.62, ease: 'sine.inOut', yoyo: true, repeat: -1,
        stagger: { each: 0.035, from: 'start', repeat: -1, yoyo: true },
      });
      ScrollTrigger.create({ trigger: sec, start: 'top bottom', end: 'bottom top', onToggle: (self) => (self.isActive ? sway.play() : sway.pause()) });
    }

    function select(m, silent) {
      members.forEach((x) => { const on = x === m; x.classList.toggle('is-active', on); x.setAttribute('aria-checked', on); });
      const color = m.dataset.color;
      sec.style.setProperty('--glow', color);
      call.innerHTML = `<span>${m.dataset.name}</span>의 ${NAMES[color]} 사이리움이 켜졌다!`;
      if (silent || REDUCE) return;
      gsap.fromTo(sticks, { scaleY: 1.5 }, { scaleY: 1, duration: 0.9, ease: 'elastic.out(1, 0.4)', stagger: { each: 0.012, from: 'center' }, overwrite: 'auto' });
      gsap.fromTo(call, { scale: 0.85, autoAlpha: 0.3 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.5)' });
      const c = centerOf(m);
      popBurst(c.x, c.y, 8, 140);
    }
    members.forEach((m) => m.addEventListener('click', () => select(m)));
    select($('.member.is-active', sec) || members[0], true);
  }

  /* ───────── 뒤집히는 카드 (관계도 · 퀴즈) ───────── */
  function initFlips() {
    $$('.flip, .quiz').forEach((card) => {
      card.setAttribute('aria-pressed', 'false');
      card.addEventListener('click', () => {
        const on = card.classList.toggle('is-flipped');
        card.setAttribute('aria-pressed', on);
      });
    });
  }

  /* ==========================================================================
     갤러리: 포토 덱 (Draggable) + 라이트박스
     ========================================================================== */
  function initDeck() {
    const deck = $('.deck');
    if (!deck) return;
    const cards = $$('.deck__card', deck);
    const n = cards.length;
    const noEl = $('.gallery__no b');
    const titleEl = $('.gallery__title');
    let order = cards.slice(); // order[0] 이 맨 위
    let busy = false;

    const slot = (i) => (i === 0
      ? { x: 0, y: 0, rotation: -2, scale: 1 }
      : { x: (i % 2 ? 1 : -1) * (10 + i * 9), y: i * 5, rotation: (i % 2 ? 1 : -1) * (3 + i * 1.7), scale: 1 - i * 0.035 });

    function caption() {
      const top = order[0];
      noEl.textContent = String(cards.indexOf(top) + 1).padStart(2, '0');
      titleEl.textContent = top.dataset.title;
      if (!REDUCE) gsap.fromTo([noEl, titleEl], { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.05, overwrite: true });
    }

    function layout(skip) {
      order.forEach((card, i) => {
        drags.get(card)[i === 0 ? 'enable' : 'disable']();
        if (card === skip) return;
        gsap.set(card, { zIndex: n - i });
        gsap.to(card, { ...slot(i), autoAlpha: 1, duration: REDUCE ? 0 : 0.7, ease: 'back.out(1.5)', overwrite: true });
      });
      caption();
    }

    // 맨 위 사진을 dir 방향으로 날려 보내고 맨 뒤로
    function next(dir) {
      if (busy) return;
      busy = true;
      const card = order.shift();
      order.push(card);
      const out = dir * (deck.offsetWidth * 0.75 + 160);
      gsap.timeline({ onComplete: () => { busy = false; } })
        .to(card, { x: out, rotation: dir * 26, duration: 0.36, ease: 'power2.in', overwrite: true })
        .set(card, { zIndex: 0 })
        .to(card, { ...slot(n - 1), duration: 0.6, ease: 'power3.out' });
      layout(card);
    }
    // 맨 뒤 사진을 다시 맨 위로
    function prev() {
      if (busy) return;
      busy = true;
      const card = order.pop();
      order.unshift(card);
      const out = deck.offsetWidth * 0.75 + 160;
      gsap.timeline({ onComplete: () => { busy = false; gsap.set(card, { zIndex: n }); } })
        .to(card, { x: out, rotation: 22, duration: 0.32, ease: 'power2.in', overwrite: true })
        .set(card, { zIndex: n + 1 })
        .to(card, { ...slot(0), duration: 0.65, ease: 'back.out(1.5)' });
      layout(card);
    }

    const drags = new Map();
    cards.forEach((card) => {
      let t0 = 0;
      const d = Draggable.create(card, {
        type: 'x', zIndexBoost: false, minimumMovement: 6, cursor: 'grab', activeCursor: 'grabbing',
        onDragStart() { t0 = performance.now(); gsap.killTweensOf(card, 'rotation'); },
        onDrag() { gsap.set(card, { rotation: -2 + this.x * 0.045 }); },
        onDragEnd() {
          const speed = Math.abs(this.x) / Math.max(1, performance.now() - t0);
          if (Math.abs(this.x) > 110 || (Math.abs(this.x) > 36 && speed > 0.55)) next(this.x < 0 ? -1 : 1);
          else gsap.to(card, { ...slot(0), duration: 0.8, ease: 'elastic.out(1, 0.45)' });
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
        gsap.set(card, { zIndex: n - i, y: 260, rotation: rand(-30, 30), autoAlpha: 0 });
        drags.get(card)[i === 0 ? 'enable' : 'disable']();
      });
      ScrollTrigger.create({
        trigger: deck, start: 'top 80%', once: true,
        onEnter: () => order.slice().reverse().forEach((card, k) => {
          gsap.to(card, { ...slot(n - 1 - k), autoAlpha: 1, duration: 0.9, ease: 'back.out(1.4)', delay: k * 0.09 });
        }),
      });
    }
    $('.gallery .arrow--next').addEventListener('click', () => next(-1));
    $('.gallery .arrow--prev').addEventListener('click', prev);

    // 라이트박스
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
      gsap.fromTo(lb, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 });
      gsap.fromTo(lbImg, { scale: 0.6, rotation: -5 }, { scale: 1, rotation: 0, duration: REDUCE ? 0 : 0.7, ease: 'back.out(1.6)' });
      lbClose.focus();
    }
    function closeLightbox() {
      if (lb.hidden) return;
      lockScroll(false);
      gsap.to(lb, { autoAlpha: 0, duration: 0.25, onComplete: () => { lb.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); } });
    }
    lb.addEventListener('click', (e) => { if (e.target !== lbImg) closeLightbox(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
  }

  /* ==========================================================================
     내비게이션 · 커서 · 마그네틱 버튼
     ========================================================================== */
  function initNav() {
    const links = $$('.nav__links a');
    const setActive = (id) => links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + id));
    $$('[data-nav]').forEach((sec) => {
      ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => { if (self.isActive) setActive(sec.id); } });
    });
    ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom 55%', onEnterBack: () => setActive('') });
    gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

    // 모바일 메뉴 (원형으로 펼쳐지는 오버레이)
    const toggle = $('.nav__toggle');
    const menu = $('.menu');
    const items = $$('.menu li', menu);
    let open = false;
    function setMenu(state) {
      if (state === open) return;
      open = state;
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      menu.setAttribute('aria-hidden', !open);
      lockScroll(open);
      const r = toggle.getBoundingClientRect();
      const at = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`;
      const big = Math.hypot(window.innerWidth, window.innerHeight) + 40;
      gsap.killTweensOf([menu, items]);
      if (open) {
        gsap.set(menu, { visibility: 'visible' });
        gsap.fromTo(menu, { clipPath: `circle(0px at ${at})` }, { clipPath: `circle(${big}px at ${at})`, duration: REDUCE ? 0 : 0.75, ease: 'power3.inOut' });
        gsap.fromTo(items, { y: 46, autoAlpha: 0, rotation: () => rand(-6, 6) }, { y: 0, autoAlpha: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.8)', stagger: 0.05, delay: REDUCE ? 0 : 0.25 });
      } else {
        gsap.to(menu, { clipPath: `circle(0px at ${at})`, duration: REDUCE ? 0 : 0.55, ease: 'power3.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
      }
    }
    toggle.addEventListener('click', () => setMenu(!open));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width: 981px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  function initCursor() {
    if (!FINE || REDUCE) return;
    const cur = $('.cursor');
    const label = $('.cursor__label');
    const x = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' });
    const y = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x(e.clientX); y(e.clientY);
      cur.classList.add('is-on');
      const t = e.target instanceof Element ? e.target : null;
      const tagged = t && t.closest('[data-cursor]');
      const link = t && t.closest('a, button');
      cur.classList.toggle('is-label', !!tagged);
      cur.classList.toggle('is-link', !tagged && !!link);
      if (tagged) label.textContent = tagged.dataset.cursor;
    }, { passive: true });
    document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
    window.addEventListener('pointerdown', () => gsap.fromTo(cur, { scale: 0.7 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' }));
  }

  function initMagnetic() {
    if (!FINE || REDUCE) return;
    $$('[data-magnetic]').forEach((el) => {
      const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.5)' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        x((e.clientX - (r.left + r.width / 2)) * 0.35);
        y((e.clientY - (r.top + r.height / 2)) * 0.45);
      });
      el.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }

  function initFooter() {
    if (REDUCE) return;
    gsap.from('.footer__big > *', {
      yPercent: 120, rotation: () => rand(-20, 20), autoAlpha: 0, duration: 0.9, ease: 'back.out(1.8)', stagger: 0.08,
      scrollTrigger: { trigger: '.footer', start: 'top 75%', once: true },
    });
    gsap.from(['.footer__say', '.footer .btn'], { y: 40, autoAlpha: 0, duration: 0.8, stagger: 0.12, clearProps: 'transform', scrollTrigger: { trigger: '.footer__say', start: 'top 92%', once: true } });
  }

  /* ==========================================================================
     시작 — 반드시 페이지 순서대로
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
  initFlips();
  revealsIn($('.gallery'));
  initDeck();
  revealsIn($('.trivia'));
  initFooter();
  initNav();
  initCursor();
  initMagnetic();

  initLoader(playIntro);

  // 폰트·이미지가 늦게 도착해 레이아웃이 바뀌면 위치를 다시 계산
  if (document.fonts) document.fonts.ready.then(() => ScrollTrigger.refresh());
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
