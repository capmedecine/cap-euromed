/* Cap EuroMed — interactions (JavaScript natif, aucune librairie)
   Fonctionne sur toutes les pages : chaque effet vérifie que ses éléments existent. */
(() => {
  const d = document, w = window, html = d.documentElement;
  const reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = w.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const locale = html.lang === 'en' ? 'en-GB' : 'fr-FR';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (sel) => d.querySelector(sel), $$ = (sel) => [...d.querySelectorAll(sel)];
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add('ready')));

  /* Apparition au scroll */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  $$('[data-reveal]').forEach((el) => revealIO.observe(el));

  /* Compteurs animés */
  const fmt = new Intl.NumberFormat(locale);
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      const el = e.target, to = +el.dataset.count, from = +(el.dataset.from || 0), dur = 1500;
      if (reduce) { el.textContent = fmt.format(to); return; }
      let t0;
      const tick = (t) => {
        t0 ??= t;
        const k = clamp((t - t0) / dur);
        el.textContent = fmt.format(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  $$('[data-count]').forEach((el) => countIO.observe(el));

  /* Éléments liés au scroll */
  const nav = $('#nav'), bar = nav && nav.querySelector('.progress');
  const hero = $('.hero'), collage = $('#collage'), frame = $('.collage-frame');
  const route = $('#route'), steps = route ? [...route.querySelectorAll('.step')] : [];
  const waFloat = $('.wa-float'), contact = $('#contact');
  const active = new Set();
  const scrollIO = new IntersectionObserver((entries) => entries.forEach((e) => (e.isIntersecting ? active.add(e.target) : active.delete(e.target))), { rootMargin: '15% 0px' });
  $$('[data-scroll]').forEach((el) => scrollIO.observe(el));
  let contactVisible = false;
  if (contact) new IntersectionObserver((es) => { contactVisible = es[0].isIntersecting; }).observe(contact);

  let vh = 0, lastY = 0, ticking = false, heroH = 1, stepPos = [], zoom = 0;
  // Mesures faites dans un ResizeObserver (après le layout) : pas de reflow forcé
  const measure = () => {
    vh = innerHeight;
    heroH = hero ? hero.offsetHeight : 400;
    if (route) {
      const rh = route.offsetHeight || 1;
      stepPos = steps.map((s) => (s.offsetTop + s.querySelector('.step-num').offsetHeight / 2) / rh);
    }
    if (frame && collage) {
      const z = Math.min(1, frame.clientWidth / 540);
      if (Math.abs(z - zoom) > 0.004) { zoom = z; collage.style.zoom = z.toFixed(3); }
    }
  };

  const frameUpdate = () => {
    ticking = false;
    const y = scrollY, max = html.scrollHeight - vh;
    // lectures d'abord…
    const routeRect = route ? route.getBoundingClientRect() : null;
    const reads = [];
    if (!reduce) active.forEach((el) => reads.push([el, el.getBoundingClientRect()]));
    // …écritures ensuite
    if (bar) bar.style.transform = `scaleX(${max > 0 ? (y / max).toFixed(4) : 0})`;
    if (nav) {
      nav.classList.toggle('scrolled', y > 20);
      nav.classList.toggle('hide', y > heroH * 0.7 && y > lastY + 2 && !nav.classList.contains('open'));
      if (y < lastY - 2) nav.classList.remove('hide');
    }
    if (waFloat) waFloat.classList.toggle('show', y > heroH * 0.8 && !contactVisible);
    if (collage && !reduce && y < heroH) collage.style.setProperty('--sy', (y * 0.12).toFixed(1) + 'px');
    if (routeRect) {
      const p = clamp((vh * 0.55 - routeRect.top) / routeRect.height);
      route.style.setProperty('--progress', p.toFixed(4));
      steps.forEach((s, i) => s.classList.toggle('reached', p >= stepPos[i] - 0.02));
    }
    reads.forEach(([el, r]) => el.style.setProperty('--p', clamp((vh - r.top) / (vh + r.height)).toFixed(4)));
    lastY = y;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(frameUpdate); } };
  addEventListener('scroll', onScroll, { passive: true });
  new ResizeObserver(() => { measure(); onScroll(); }).observe(html);

  /* Menu mobile */
  const toggle = $('.nav-toggle');
  if (nav && toggle) {
    const label = (open) => toggle.getAttribute(open ? 'data-label-close' : 'data-label-open') || '';
    const setMenu = (open) => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', label(open));
    };
    toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    $$('.nav-links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  }

  /* Lien actif dans la navigation (ancres de la page courante, ex. /#faq sur l'accueil) */
  const links = new Map($$('.nav-links a').filter((a) => a.hash && a.pathname === location.pathname).map((a) => [a.hash.slice(1), a]));
  if (links.size) {
    const spy = new IntersectionObserver((entries) => entries.forEach((e) => {
      const a = links.get(e.target.id); if (!a) return;
      if (e.isIntersecting) { links.forEach((l) => l.classList.remove('active')); a.classList.add('active'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((_, id) => { const s = d.getElementById(id); if (s) spy.observe(s); });
  }

  /* Changement de langue : on garde la section en cours (#tarifs, #faq…) */
  $$('a[data-lang-switch]').forEach((a) => a.addEventListener('click', () => {
    if (location.hash) a.href = a.getAttribute('href').split('#')[0] + location.hash;
  }));

  /* Bande défilante : vitesse boostée par le scroll */
  const track = $('.tape-track');
  if (track && !reduce) {
    let x = 0, v = 0, vis = false, last = 0, lastSY = -1;
    const loop = (t) => {
      if (!vis) return;
      const dt = Math.min(64, t - (last || t)); last = t;
      const sy = scrollY, dy = lastSY < 0 ? 0 : Math.abs(sy - lastSY); lastSY = sy;
      v += (dy * 0.9 - v) * 0.08;
      x -= (0.045 + v * 0.012) * dt;
      const half = track.scrollWidth / 2;
      if (-x >= half) x += half;
      track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
      requestAnimationFrame(loop);
    };
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis) { last = 0; requestAnimationFrame(loop); } }).observe(track);
  }

  if (fine && !reduce) {
    /* Parallaxe souris sur le collage */
    if (hero && collage) {
      let mx = 0, my = 0, raf = 0;
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5;
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; collage.style.setProperty('--mx', (mx * 2).toFixed(3)); collage.style.setProperty('--my', (my * 2).toFixed(3)); });
      });
      hero.addEventListener('pointerleave', () => { collage.style.setProperty('--mx', 0); collage.style.setProperty('--my', 0); });
    }

    /* Effet 3D sur les cartes tarifs */
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
        el.style.setProperty('--ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => { el.style.removeProperty('--rx'); el.style.removeProperty('--ry'); });
    });

    /* Boutons magnétiques */
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.translate = `${((e.clientX - r.left - r.width / 2) * 0.16).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * 0.26).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => { el.style.translate = ''; });
    });
  }

  /* Suivi des clics WhatsApp (actif seulement si un pixel Meta / Google est installé) */
  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href*="wa.me"]'); if (!a) return;
    const label = (a.dataset.cta || 'whatsapp') + (html.lang === 'en' ? '-en' : '');
    if (typeof w.fbq === 'function') w.fbq('track', 'Contact', { content_name: label });
    if (typeof w.gtag === 'function') w.gtag('event', 'generate_lead', { method: 'whatsapp', cta: label });
    if (typeof w.plausible === 'function') w.plausible('WhatsApp', { props: { cta: label, page: location.pathname } });
  });
})();
