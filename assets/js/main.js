/* =========================================================
   ISP Landing 2026 — motion & interaction
   Deps: GSAP 3 + ScrollTrigger, Lenis (all optional-safe)
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  // breakpoints — keep in sync with the @media rules in main.css
  const BP = { phone: '(max-width: 767px)', desktop: 1024 };
  const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const header = $('.site-header');
  const headerH = () => header.offsetHeight;

  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (!reduced && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    window.ISP_LENIS = lenis; // handy for debugging / programmatic scrolling
    if (hasGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  const scrollToEl = (el) => {
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: el.id === 'gioi-thieu' ? 0 : -headerH() + 1, duration: 1.4 });
    else window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - headerH(), behavior: reduced ? 'auto' : 'smooth' });
  };

  /* ---------- Anchor links ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id === 'top' ? $('#gioi-thieu') : document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(target);
    history.replaceState(null, '', '#' + id);
  });

  /* ---------- Mobile menu ---------- */
  const menuBtn = $('.menu-toggle');
  const menu = $('#mobile-menu');
  function closeMenu() {
    if (!menu || menu.hidden) return;
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Mở menu');
    if (hasGSAP && !reduced) {
      gsap.to(menu, { clipPath: 'circle(0% at 100% 0%)', duration: .5, ease: 'power3.in', onComplete: () => { menu.hidden = true; } });
    } else menu.hidden = true;
    lenis && lenis.start();
  }
  function openMenu() {
    menu.hidden = false;
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-label', 'Đóng menu');
    header.classList.remove('is-hidden');
    if (hasGSAP && !reduced) {
      gsap.fromTo(menu, { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: .8, ease: 'power3.out' });
      gsap.from($$('nav a, .btn', menu), { y: 40, autoAlpha: 0, stagger: .06, duration: .7, delay: .15, ease: 'power3.out' });
    }
    lenis && lenis.stop();
  }
  menuBtn && menuBtn.addEventListener('click', () => (menu.hidden ? openMenu() : closeMenu()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  /* ---------- Header state, progress, active nav, mobile CTA ---------- */
  const progress = $('.scroll-progress span');
  const navLinks = $$('.nav a[data-nav]');
  const indicator = $('.nav__indicator');
  // page order; 'dang-ky' has no nav link, so nothing is highlighted while on the form
  const navSections = ['gioi-thieu', 'chuong-trinh', 'tuyen-sinh', 'trai-nghiem', 'dang-ky'].map(id => document.getElementById(id));
  const hero = $('.hero');
  const mobileCta = $('.mobile-cta');
  const formSection = $('#dang-ky');
  let lastY = scrollY, activeId = null;
  const headerState = {};
  function setHeader(cls, on) {
    if (headerState[cls] === on) return; // avoid redundant style invalidation every frame
    headerState[cls] = on;
    header.classList.toggle(cls, on);
  }

  function moveIndicator(link) {
    if (!indicator) return;
    if (!link) { indicator.style.opacity = 0; return; }
    const pad = 0; // pill covers the whole link
    indicator.style.opacity = 1;
    indicator.style.width = (link.offsetWidth - pad * 2) + 'px';
    indicator.style.transform = `translateX(${link.offsetLeft + pad}px)`;
  }

  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
    setHeader('is-scrolled', y > 40);
    const dy = y - lastY;
    if (Math.abs(dy) > 6) {
      if (menu.hidden) setHeader('is-hidden', dy > 0 && y > innerHeight * .9);
      lastY = y;
    }

    // active section
    let current = null;
    navSections.forEach(sec => { if (sec && sec.getBoundingClientRect().top <= innerHeight * .4) current = sec.id; });
    if (current !== activeId) {
      activeId = current;
      navLinks.forEach(l => l.classList.toggle('is-active', l.dataset.nav === current));
      moveIndicator(navLinks.find(l => l.dataset.nav === current));
    }

    // mobile CTA
    if (mobileCta) {
      const fr = formSection.getBoundingClientRect();
      const formInView = fr.top < innerHeight && fr.bottom > 0;
      mobileCta.classList.toggle('is-visible', y > hero.offsetHeight * .6 && !formInView);
    }
  }
  if (lenis) lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => moveIndicator(navLinks.find(l => l.dataset.nav === activeId)));
  onScroll();

  /* ---------- Odometer numbers ---------- */
  // Builds rolling digit columns; the element keeps an aria-label with the real value.
  function buildOdo(el) {
    const value = el.dataset.value || el.textContent.trim();
    el.setAttribute('aria-label', value);
    el.setAttribute('role', 'text');
    // Typeset the real number once and read every character's position with a Range, so each
    // rolling column is exactly as wide as that glyph's slot in the final text — kerning pairs and
    // letter-spacing included. The swap to plain text at the end is then pixel-identical.
    el.textContent = value;
    const tn = el.firstChild;
    const box = el.getBoundingClientRect();
    // cancel an ancestor scale() (reveal animations) — but only when there is one, to avoid offsetWidth's integer rounding
    const ratio = box.width && Math.abs(box.width - el.offsetWidth) > 1 ? el.offsetWidth / box.width : 1;
    const range = document.createRange();
    const lefts = [...value].map((_, i) => { range.setStart(tn, i); range.setEnd(tn, i + 1); return range.getBoundingClientRect().left; });
    const widths = lefts.map((l, i) => ((i < lefts.length - 1 ? lefts[i + 1] : box.right) - l) * ratio);
    el.textContent = '';
    el._value = value;
    const cols = [];
    [...value].forEach((ch, i) => {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'odo__col';
        col.setAttribute('aria-hidden', 'true');
        for (let n = 0; n < 20; n++) {
          const s = document.createElement('span');
          s.textContent = n % 10;
          col.appendChild(s);
        }
        col.dataset.target = 10 + Number(ch);
        col.style.width = widths[i] + 'px';
        el.appendChild(col);
        cols.push(col);
      } else {
        const s = document.createElement('span');
        s.className = 'odo__static';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = ch;
        s.style.width = widths[i] + 'px';
        el.appendChild(s);
      }
    });
    el._cols = cols;
  }
  function rollOdo(el, delay = 0) {
    if (!el._cols || el._rolled) return;
    el._rolled = true;
    buildOdo(el); // re-measure now: layout and webfont are final (same frame, no visible flicker)
    const last = el._cols.length - 1;
    el._cols.forEach((col, i) => {
      const target = Number(col.dataset.target);
      gsap.fromTo(col, { yPercent: 0 }, {
        yPercent: -(target / 20) * 100,
        duration: 1.8 + i * .25, delay: delay + i * .08, ease: 'expo.out',
        // settle into plain text so the font's own kerning applies
        onComplete: i === last ? () => { el.textContent = el._value; el.classList.add('is-done'); } : null
      });
    });
  }
  const odos = $$('.odo');
  if (hasGSAP && !reduced) {
    const initOdos = () => odos.forEach(el => {
      buildOdo(el);
      ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => rollOdo(el, .15) });
    });
    // initial build shows the zero state; widths are re-measured when each number starts rolling
    const fontsReady = document.fonts
      ? Promise.all([document.fonts.load('800 100px "Mona Sans"'), document.fonts.ready]).catch(() => {})
      : Promise.resolve();
    fontsReady.then(initOdos);
  }

  /* ---------- Scramble text ---------- */
  function scramble(el) {
    const final = el.dataset.text;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let frame = 0; const total = 28;
    const tick = () => {
      frame++;
      el.textContent = [...final].map((c, i) => (frame / total > i / final.length + .2 ? c : chars[Math.floor(Math.random() * chars.length)])).join('');
      if (frame < total) requestAnimationFrame(tick); else el.textContent = final;
    };
    tick();
  }

  /* ---------- Split headings into words ---------- */
  function splitWords(el) {
    const frag = document.createDocumentFragment();
    const wrap = (text, isEm) => {
      text.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
        const w = document.createElement('span');
        w.className = 'w' + (isEm ? ' is-em' : '');
        const inner = document.createElement('span');
        inner.textContent = part;
        w.appendChild(inner);
        frag.appendChild(w);
      });
    };
    el.childNodes.forEach(n => {
      if (n.nodeType === 3) wrap(n.textContent, false);
      else if (n.nodeName === 'EM') wrap(n.textContent, true);
      else frag.appendChild(n.cloneNode(true));
    });
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
    el.textContent = '';
    el.appendChild(frag);
    $$('.w', el).forEach(w => w.setAttribute('aria-hidden', 'true'));
    return $$('.w > span', el);
  }
  // one continuous red→purple gradient per heading: each highlighted word shows its own slice of it
  const paintEm = () => $$('.h2').forEach(h => {
    const ws = $$('.is-em > span', h); if (!ws.length) return;
    const W = h.clientWidth, x0 = h.getBoundingClientRect().left;
    ws.forEach(sp => { sp.style.backgroundSize = W + 'px 100%'; sp.style.backgroundPosition = (x0 - sp.getBoundingClientRect().left) + 'px 0'; });
  });
  requestAnimationFrame(paintEm);
  addEventListener('resize', paintEm);
  document.fonts && document.fonts.ready.then(paintEm);

  /* ---------- Video modal ---------- */
  const modal = $('.video-modal');
  const frame = $('.video-modal__frame');
  $$('[data-video]').forEach(btn => btn.addEventListener('click', () => {
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${btn.dataset.video}?autoplay=1&rel=0" title="Video giới thiệu chương trình ISP" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    modal.showModal();
    lenis && lenis.stop();
  }));
  const closeModal = () => { modal.close(); };
  modal.addEventListener('close', () => { frame.innerHTML = ''; lenis && lenis.start(); });
  $('.video-modal__close').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  /* ---------- Majors: tabs + pathway builder ---------- */
  const MAJORS = {
    gm: { vi: 'Quản trị Toàn cầu', short: 'Quản trị', en: 'Management' },
    gt: { vi: 'Công nghệ Toàn cầu', short: 'Công nghệ', en: 'Technology' },
    gs: { vi: 'Phát triển bền vững Toàn cầu', short: 'Bền vững', en: 'Sustainability' },
    gst: { vi: 'Nghiên cứu Toàn cầu', short: 'Nghiên cứu', en: 'Global Studies' }
  };
  const tabs = $$('.tab');
  const ink = $('.tabs__ink');
  function placeInk(tab) {
    if (!ink || !tab) return;
    ink.style.width = tab.offsetWidth + 'px';
    ink.style.height = tab.offsetHeight + 'px';
    ink.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
  }
  function activateTab(tab, focus) {
    tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.hidden = !on;
      panel.classList.toggle('is-active', on);
      if (on && hasGSAP && !reduced) {
        // image: quick circular reveal from the bottom edge
        gsap.fromTo($('.panel__media img', panel), { clipPath: 'circle(0% at 50% 100%)', scale: 1.12 },
          { clipPath: 'circle(142% at 50% 100%)', scale: 1.02, duration: .65, ease: 'power2.out' });
        gsap.fromTo($$('.panel__body > *', panel), { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: .06, duration: .7, ease: 'power3.out' });
      }
    });
    placeInk(tab);
    if (focus) tab.focus();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', e => {
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      activateTab(tabs[(i + dir + tabs.length) % tabs.length], true);
    });
  });
  const initInk = () => placeInk($('.tab.is-active'));
  addEventListener('resize', initInk);
  document.fonts && document.fonts.ready.then(initInk);
  initInk();

  // mobile: tabs are hidden and .panels is a scroll-snap slider (CSS); keep the dots in sync
  const majorTrack = $('.panels');
  const dots = $$('.swipe-hint__dot');
  const slides = $$('.panel', majorTrack);
  const slideAt = i => slides[i].offsetLeft - slides[0].offsetLeft;
  let syncQueued = false;
  majorTrack.addEventListener('scroll', () => {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => {
      syncQueued = false;
      const step = slideAt(1) || 1;
      const i = Math.min(slides.length - 1, Math.round(majorTrack.scrollLeft / step));
      dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
    });
  }, { passive: true });
  dots.forEach(d => d.addEventListener('click', () => {
    majorTrack.scrollTo({ left: slideAt(+d.dataset.slide), behavior: reduced ? 'auto' : 'smooth' });
  }));

  const picks = [];
  const mobileMQ = window.matchMedia(BP.phone);
  const slots = $$('.slot[data-slot]');
  const msg = $('.builder__msg');
  const vennA = $('.venn__c--a'), vennB = $('.venn__c--b');
  const vennTA = $('.venn__t--a'), vennTB = $('.venn__t--b');
  function renderPicks() {
    slots.forEach((slot, i) => {
      const key = picks[i];
      slot.classList.toggle('is-filled', !!key);
      slot.innerHTML = key
        ? `<i class="ph-bold ph-check-circle" aria-hidden="true"></i> ${MAJORS[key].vi}<button type="button" aria-label="Bỏ chọn ${MAJORS[key].vi}" data-unpick="${key}"><i class="ph-bold ph-x" aria-hidden="true"></i></button>`
        : `<span class="slot__empty">${i === 0 ? 'Lĩnh vực thứ nhất' : 'Lĩnh vực thứ hai'}</span>`;
    });
    [vennA, vennB].forEach((c, i) => c.classList.toggle('is-on', !!picks[i]));
    [[vennTA, picks[0], 'Lĩnh vực 1'], [vennTB, picks[1], 'Lĩnh vực 2']].forEach(([t, key, empty]) => {
      t.classList.toggle('is-empty', !key);
      t.querySelector('.venn__name').textContent = key ? MAJORS[key].short : empty;
      t.querySelector('.venn__sub').textContent = key ? MAJORS[key].en : 'chưa chọn';
    });
    // keep the registration form's pathway field in sync
    $$('input[data-sync]').forEach(cb => { cb.checked = picks.includes(cb.dataset.sync); });
    // show the picked state on the tab and on the info card too
    $$('.tab[data-major], .panel[data-major]').forEach(el => el.classList.toggle('is-picked', picks.includes(el.dataset.major)));
    $$('[data-pick]').forEach(b => {
      const on = picks.includes(b.dataset.pick);
      b.setAttribute('aria-pressed', on);
      b.querySelector('span').textContent = on ? 'Bỏ chọn' : 'Thêm vào lộ trình';
    });
    msg.innerHTML = picks.length === 2
      ? `Lộ trình của bạn: <strong>Kinh doanh × ${MAJORS[picks[0]].vi} × ${MAJORS[picks[1]].vi}</strong>. Đăng ký để được tư vấn chi tiết!`
      : picks.length === 1 ? 'Tuyệt! Chọn thêm <strong>1 lĩnh vực</strong> nữa để hoàn thiện lộ trình.'
      : 'Chọn “Thêm vào lộ trình” ở mỗi lĩnh vực để kết hợp.';
    if (hasGSAP && !reduced) {
      gsap.fromTo('.venn__c.is-on', { scale: .92, transformOrigin: 'center' }, { scale: 1, duration: .8, ease: 'elastic.out(1, .5)' });
    }
  }
  function togglePick(key) {
    const idx = picks.indexOf(key);
    if (idx > -1) picks.splice(idx, 1);
    else { if (picks.length === 2) picks.shift(); picks.push(key); }
    renderPicks();
  }
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-pick]');
    if (p) {
      togglePick(p.dataset.pick);
      // mobile: once both fields are picked from the cards, bring the pathway builder into view
      if (picks.length === 2 && picks.includes(p.dataset.pick) && mobileMQ.matches) {
        setTimeout(() => scrollToEl($('.builder')), 350);
      }
    }
    const u = e.target.closest('[data-unpick]');
    if (u) togglePick(u.dataset.unpick);
  });
  $$('input[data-sync]').forEach(cb => cb.addEventListener('change', () => togglePick(cb.dataset.sync)));

  /* ---------- Scholarship: stairs + criteria + checker ---------- */
  const LEVELS = {
    60: { name: 'Elite Talent', a: [8.5, 7.0], b: [8.0, 7.5] },
    50: { name: 'Premier Talent', a: [8.5, 6.5], b: [8.0, 7.0] },
    40: { name: 'Outstanding Talent', a: [8.5, 6.0], b: [8.0, 6.5] },
    30: { name: 'Emerging Talent', a: [8.0, 6.0], b: [7.5, 6.5] }
  };
  const stairs = $$('.stair');
  const crit = $('.criteria');
  const c = k => $(`[data-c="${k}"]`, crit);
  let pinnedLevel = 60, shownLevel = 60;
  function showLevel(level, animate = true) {
    if (level === shownLevel && animate) return;
    shownLevel = level;
    const L = LEVELS[level];
    stairs.forEach(s => { const on = Number(s.dataset.level) === level; s.classList.toggle('is-active', on); s.setAttribute('aria-selected', on); });
    const apply = () => {
      c('pct').textContent = level;
      c('name').textContent = L.name;
      c('a-gpa').textContent = L.a[0].toFixed(1); c('a-ielts').textContent = L.a[1].toFixed(1);
      c('b-gpa').textContent = L.b[0].toFixed(1); c('b-ielts').textContent = L.b[1].toFixed(1);
    };
    if (hasGSAP && !reduced && animate) {
      gsap.timeline()
        .to(crit.children, { y: -10, autoAlpha: 0, duration: .15, stagger: .02, ease: 'power2.in' })
        .add(apply)
        .fromTo(crit.children, { y: 14 }, { y: 0, autoAlpha: 1, duration: .45, stagger: .05, ease: 'power3.out' });
    } else apply();
  }
  stairs.forEach(s => {
    const lvl = Number(s.dataset.level);
    s.addEventListener('mouseenter', () => showLevel(lvl));
    s.addEventListener('focus', () => showLevel(lvl));
    s.addEventListener('click', () => { pinnedLevel = lvl; showLevel(lvl); });
  });
  $('.stairs').addEventListener('mouseleave', () => showLevel(pinnedLevel));

  const gpa = $('#gpa'), gpaOut = $('#gpa-out'), result = $('#checker-result');
  function check() {
    const g = Math.round(parseFloat(gpa.value) * 10) / 10;
    const i = parseFloat(($('input[name="ielts"]:checked') || {}).value || 0);
    gpaOut.textContent = g.toFixed(1);
    gpa.style.setProperty('--fill', ((g - gpa.min) / (gpa.max - gpa.min) * 100) + '%');
    const ok = ([mg, mi]) => g >= mg - 1e-9 && i >= mi - 1e-9;
    const match = [60, 50, 40, 30].find(l => ok(LEVELS[l].a) || ok(LEVELS[l].b));
    stairs.forEach(s => s.classList.toggle('is-match', Number(s.dataset.level) === match));
    if (match) {
      result.innerHTML = `Với GPA <strong>${g.toFixed(1)}</strong> và IELTS <strong>${i < 6 ? '< 6.0' : i.toFixed(1)}</strong>, bạn có thể đạt học bổng <strong>${match}% – ${LEVELS[match].name}</strong>.`;
      pinnedLevel = match; showLevel(match);
    } else if (i < 6) {
      result.innerHTML = 'Chương trình yêu cầu <strong>IELTS Academic 6.0</strong> trở lên (điểm kỹ năng > 5.0). <a href="#dang-ky">Đăng ký tư vấn</a> để nhận lộ trình chuẩn bị.';
    } else {
      result.innerHTML = 'Hồ sơ của bạn có thể đủ điều kiện xét tuyển. <a href="#dang-ky">Đăng ký tư vấn</a> để được đánh giá chi tiết và cập nhật học bổng mới nhất.';
    }
  }
  gpa.addEventListener('input', check);
  $$('input[name="ielts"]').forEach(r => r.addEventListener('change', check));

  /* ---------- Form ---------- */
  const form = $('#signup-form');
  const validateField = (el) => {
    const wrap = el.closest('.field') || el.closest('.consent');
    if (!wrap) return true;
    let valid = el.checkValidity();
    if (el.name === 'phone') valid = /^(0|\+84)\d{9}$/.test(el.value.replace(/[\s.-]/g, ''));
    wrap.classList.toggle('is-invalid', !valid);
    return valid;
  };
  $$('input, select', form).forEach(el => {
    el.addEventListener('blur', () => { if (el.value || el.type === 'checkbox') validateField(el); });
    el.addEventListener('input', () => { if ((el.closest('.field, .consent') || {}).classList?.contains('is-invalid')) validateField(el); });
    el.addEventListener('change', () => validateField(el));
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fields = $$('input:not([type="radio"]):not([data-sync]), select', form);
    const invalid = fields.filter(el => !validateField(el));
    if (invalid.length) {
      invalid[0].focus();
      if (hasGSAP && !reduced) gsap.fromTo(form, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1, .3)' });
      return;
    }
    const btn = $('.form__submit', form);
    btn.classList.add('is-loading');
    btn.querySelector('span').textContent = 'Đang gửi…';
    try {
      const endpoint = form.dataset.endpoint;
      if (endpoint) await fetch(endpoint, { method: 'POST', body: new FormData(form) });
      else await new Promise(r => setTimeout(r, 900)); // demo mode — no backend wired yet
      $('.form__body', form).hidden = true;
      const ok = $('.form__success', form);
      ok.hidden = false; ok.focus();
      if (hasGSAP && !reduced) {
        gsap.from('.form__check', { scale: 0, rotate: -90, duration: .9, ease: 'back.out(2)' });
        gsap.from('.form__success h3, .form__success p', { y: 20, autoAlpha: 0, stagger: .1, delay: .2 });
      }
    } catch (err) {
      btn.classList.remove('is-loading');
      btn.querySelector('span').textContent = 'Thử lại';
    }
  });

  /* ---------- Micro-interactions (pointer: fine only) ---------- */
  if (finePointer && !reduced) {
    // spotlight
    $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }));
    if (hasGSAP) {
      // tilt
      $$('[data-tilt]').forEach(el => {
        const rx = gsap.quickTo(el, 'rotationX', { duration: .6, ease: 'power3' });
        const ry = gsap.quickTo(el, 'rotationY', { duration: .6, ease: 'power3' });
        gsap.set(el, { transformPerspective: 900 });
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          ry(((e.clientX - r.left) / r.width - .5) * 8);
          rx(-((e.clientY - r.top) / r.height - .5) * 8);
        });
        el.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
      // magnetic buttons
      $$('.magnetic').forEach(el => {
        const xTo = gsap.quickTo(el, 'x', { duration: .5, ease: 'power3' });
        const yTo = gsap.quickTo(el, 'y', { duration: .5, ease: 'power3' });
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * .25);
          yTo((e.clientY - r.top - r.height / 2) * .35);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
    }
  }

  /* ---------- Initial non-animated states ---------- */
  showLevel(60, false);
  check();
  renderPicks();

  /* =========================================================
     Scroll choreography (GSAP)
     ========================================================= */
  // UEH + Fu Jen side by side: give matching ranking rows the same height so row 2 lines up across both schools
  const uniGrids = $$('.unis .rank-grid');
  const alignUniRows = () => {
    const items = uniGrids.map(g => [...g.children]);
    items.flat().forEach(li => (li.style.minHeight = ''));
    if (innerWidth < BP.desktop || uniGrids.length < 2) return; // stacked layout: nothing to align
    const cols = 2, rows = Math.max(...items.map(l => Math.ceil(l.length / cols)));
    for (let r = 0; r < rows; r++) {
      const row = items.flatMap(l => l.slice(r * cols, r * cols + cols));
      const h = Math.max(...row.map(li => li.offsetHeight));
      row.forEach(li => (li.style.minHeight = h + 'px'));
    }
  };
  alignUniRows();
  addEventListener('resize', alignUniRows);
  document.fonts && document.fonts.ready.then(alignUniRows);

  if (!hasGSAP || reduced) {
    root.classList.remove('js');
    $$('.scramble').forEach(el => (el.textContent = el.dataset.text));
    return;
  }

  /* --- Hero intro --- */
  const heroChars = [];
  $$('.hero__title .split').forEach(el => {
    const txt = el.textContent;
    el.setAttribute('aria-hidden', 'true');
    el.textContent = '';
    [...txt].forEach(ch => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.display = 'inline-block';
      el.appendChild(s);
      heroChars.push(s);
    });
  });
  const h1 = $('#hero-title');
  h1.setAttribute('aria-label', 'Cử nhân Kinh doanh Liên ngành');
  $$('.hero__title .line').forEach(l => (l.style.overflow = 'hidden'));

  const intro = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: .1 });
  intro
    .set('.hero__title .line, [data-hero]', { autoAlpha: 1 })
    .from('.hero__media img', { scale: 1.18, duration: 2.4, ease: 'power3.out' }, 0)
    .from('.site-header__inner', { y: -30, autoAlpha: 0, duration: 1 }, .2)
    .from('.hero__eyebrow', { y: 20, autoAlpha: 0, duration: 1 }, .35)
    .from(heroChars, { yPercent: 115, rotate: 6, duration: 1.3, stagger: .018 }, .45)
    .from('.hero__lead, .hero__tagline, .hero__actions', { y: 30, autoAlpha: 0, stagger: .1, duration: 1.2 }, 1)
    .from('.hero__ticker', { yPercent: 100, duration: 1.2 }, 1.2);

  /* --- Hero scroll-out --- */
  gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
    .to('.hero__media img', { scale: 1.12, yPercent: 8, ease: 'none' }, 0)
    .to('.hero__content', { yPercent: -18, autoAlpha: .15, ease: 'none' }, 0);

  /* --- Split headings --- */
  $$('[data-split]').forEach(el => {
    const words = splitWords(el);
    gsap.from(words, {
      yPercent: 110, duration: 1.1, stagger: .05, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%', once: true }
    });
  });

  /* --- Generic reveals --- */
  $$('[data-reveal]').forEach(el => {
    gsap.from(el, { y: 36, autoAlpha: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  const batchReveal = (sel, vars = {}) => ScrollTrigger.batch(sel, {
    start: 'top 90%', once: true,
    onEnter: els => gsap.from(els, { y: 50, autoAlpha: 0, duration: 1.1, stagger: .09, ease: 'expo.out', overwrite: false, ...vars })
  });
  // USP cards — "Staggered Zoom-In Up" (a.k.a. zoomInUp / scale-fade-up):
  // each card grows from 80% → 100%, rises 80px and goes from faded + soft-blurred to crisp, one after another.
  ScrollTrigger.batch('.bento__card', {
    start: 'top 88%', once: true,
    onEnter: els => gsap.fromTo(els,
      { autoAlpha: 0, y: 80, scale: .8, filter: 'blur(8px)', transformOrigin: '50% 100%' },
      { autoAlpha: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: .9, stagger: .1, ease: 'back.out(1.4)', clearProps: 'filter' })
  });
  gsap.set('.bento__card', { autoAlpha: 0 }); // hidden until their batch enters (no flash before the reveal)
  batchReveal('.method');
  batchReveal('.career', { y: 30 });
  batchReveal('.testi', { y: 80 });
  batchReveal('.life__stat');

  /* --- Roadmap: static 3-column layout — no progress bar, no pin, no scroll-triggered reveal (2026-10) --- */

  /* --- Majors: builder float --- */
  gsap.from('.venn__c', { scale: 0, transformOrigin: 'center', stagger: .12, duration: 1.2, ease: 'elastic.out(1, .6)', scrollTrigger: { trigger: '.builder', start: 'top 80%', once: true } });

  /* --- Fu Jen parallax + scramble --- */
  // university halves (UEH, Fu Jen): gentle background parallax
  $$('.uni').forEach(sec => {
    gsap.fromTo(sec.querySelector('.uni__photo img'), { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  ScrollTrigger.batch('.rank', { start: 'top 90%', once: true, onEnter: els => gsap.from(els, { y: 60, autoAlpha: 0, stagger: .1, duration: 1.1, ease: 'expo.out' }) });
  $$('.scramble').forEach(el => ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => setTimeout(() => scramble(el), 400) }));

  /* --- Student life belt: infinite loop reacting to scroll velocity --- */
  const track = $('.belt__track');
  if (track) {
    [...track.children].forEach(n => { const c = n.cloneNode(true); c.setAttribute('aria-hidden', 'true'); track.appendChild(c); });
    const loop = gsap.to(track, { xPercent: -50, duration: 70, ease: 'none', repeat: -1 });
    let boost;
    ScrollTrigger.create({
      trigger: '.belt', start: 'top bottom', end: 'bottom top',
      onUpdate: self => {
        const v = Math.min(Math.abs(self.getVelocity()) / 250, 6);
        boost && boost.kill();
        loop.timeScale(1 + v);
        boost = gsap.to(loop, { timeScale: 1, duration: 1.2, ease: 'power2.out' });
      }
    });
    if (finePointer) {
      track.addEventListener('mouseenter', () => gsap.to(loop, { timeScale: .15, duration: .6 }));
      track.addEventListener('mouseleave', () => gsap.to(loop, { timeScale: 1, duration: .6 }));
    }
    gsap.from('.belt', { autoAlpha: 0, y: 60, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.belt', start: 'top 92%', once: true } });
  }

  /* --- Admission --- */
  gsap.fromTo('.admission__img img', { yPercent: -10 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.admission__media', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* --- Scholarship --- */
  gsap.fromTo('.stair', { scaleY: 0, y: 0 }, { scaleY: 1, y: 0, transformOrigin: '50% 100%', duration: 1.3, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.stairs', start: 'top 80%', once: true } });
  gsap.from('.criteria', { x: 60, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.criteria', start: 'top 85%', once: true } });
  gsap.to('.scholar__glow', { xPercent: -30, yPercent: 40, ease: 'none', scrollTrigger: { trigger: '.scholar', start: 'top bottom', end: 'bottom top', scrub: true } });

  /* --- Form --- */
  gsap.from('.form', { y: 80, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.form', start: 'top 88%', once: true } });

  /* --- Footer marquee reacts to scroll direction --- */
  root.classList.remove('js');
  addEventListener('load', () => ScrollTrigger.refresh());
  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
})();
