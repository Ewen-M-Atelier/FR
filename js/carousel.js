/* =====================================================
   carousel.js — Carrousel de photos · Ewen-M-Atelier

   FONCTIONNEMENT :
   1. GitHub Actions scanne photos-[modele]/ à chaque push
      et régénère photos.json automatiquement.
   2. Ce script lit photos.json et construit le carrousel.
   → Ajouter une photo = la déposer dans le dossier + push.

   PRINCIPE DE DÉFILEMENT (fenêtre glissante) :
   Le carrousel affiche une "fenêtre" de plusieurs photos
   consécutives (ex: 3 photos). À chaque cycle, la fenêtre
   avance d'UNE SEULE photo vers la gauche — la plus ancienne
   sort, une nouvelle entre — plutôt que de sauter par groupes
   entiers. C'est valable aussi bien en mode 'fade' qu'en
   mode 'slide'.

   ★ CONFIGURATION ★ — modifiez ces valeurs librement :
===================================================== */
const CFG = {
  autoplay:           true,   // true=défilement auto | false=manuel seul
  autoplayDelay:      4000,   // ms entre chaque pas : 1000=1s 4000=4s 6000=6s
  pauseOnHover:        true,  // true=pause au survol souris
  visibleCount:        3,     // photos visibles côte à côte ≥1024px : 1 | 2 | 3
                               // tablette : 2 max auto · mobile : 1 auto
  transition:        'fade',  // 'fade'=fondu enchaîné | 'slide'=glissement physique
  transitionDuration:  700,   // ms animation : 300=rapide 700=moyen 1200=lent
  swipeEnabled:        true,  // true=balayage tactile activé
  swipeThreshold:       50,   // px mini swipe : 30=sensible 50=normal 80=peu
  lightboxEnabled:     true,  // true=clic → plein écran
};

/* ── Classe carrousel ─────────────────────────────────── */
class ModelCarousel {
  constructor(el) {
    this.el      = el;
    this.model   = el.dataset.model;
    this.photos  = [];     // noms de fichiers, chargés depuis photos.json
    this.pageIdx = 0;      // index de la PREMIÈRE photo visible dans la fenêtre
    this.busy    = false;  // empêche de cliquer pendant une transition
    this.timer   = null;
    this.lbIdx   = 0;      // index de la photo ouverte dans la lightbox
  }

  /* -------------------------------------------------
     INITIALISATION
  ------------------------------------------------- */
  async init() {
    try {
      const r = await fetch('photos.json');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      this.photos = d[this.model] || [];
    } catch (e) {
      console.warn('[Carrousel] photos.json :', e.message);
    }

    if (!this.photos.length) {
      this.el.querySelector('.carousel-empty').style.display = 'flex';
      this.el.querySelector('.carousel-stage').style.display = 'none';
      return;
    }

    this.buildDots();
    this.bindEvents();

    if (CFG.transition === 'slide') {
      this.buildSlide();        // construit le ruban continu avec clones
    } else {
      this.buildFade(0, false); // construit la première fenêtre fade
    }
    if (CFG.autoplay) this.play();
  }

  /* -------------------------------------------------
     Nombre de photos visibles simultanément
     (dépend de la largeur d'écran)
  ------------------------------------------------- */
  vis() {
    const w = window.innerWidth;
    if (w < 640)  return 1;
    if (w < 1024) return Math.min(2, CFG.visibleCount);
    return Math.min(CFG.visibleCount, this.photos.length);
  }

  /* -------------------------------------------------
     Renvoie les v photos consécutives à partir de
     l'index "start", en bouclant sur le tableau.
     Ex.: 7 photos, start=5, v=3 → indices [5,6,0]
  ------------------------------------------------- */
  windowAt(start) {
    const v = this.vis(), n = this.photos.length;
    const out = [];
    for (let i = 0; i < v; i++) out.push((start + i) % n);
    return out; // tableau d'INDEX (pas de noms de fichiers)
  }

  /* -------------------------------------------------
     Crée un élément <div class="c-slide"> pour une photo
     globalIdx = position réelle dans this.photos (pour la lightbox)
  ------------------------------------------------- */
  makeSlide(globalIdx, widthPct) {
    const file = this.photos[globalIdx];
    const s = document.createElement('div');
    s.className = 'c-slide';
    if (widthPct) s.style.flex = `0 0 ${widthPct}%`;

    const img = document.createElement('img');
    img.src       = `photos-${this.model}/${file}`;
    img.alt       = `${this.model} — photo ${globalIdx + 1}`;
    img.loading   = 'lazy';
    img.draggable = false;

    if (CFG.lightboxEnabled) {
      s.style.cursor = 'zoom-in';
      s.addEventListener('click', () => this.lbOpen(globalIdx));
    }
    s.appendChild(img);
    return s;
  }

  /* ===================================================
     MODE "FADE" — fenêtre glissante avec fondu enchaîné
     À chaque pas : la fenêtre courante (pageIdx) disparaît
     en fondu, la fenêtre suivante (pageIdx+1) apparaît.
     Les deux fenêtres ne diffèrent que d'UNE photo.
  =================================================== */
  buildFade(startIdx, animate) {
    const track = this.el.querySelector('.carousel-track');
    const v     = this.vis();

    Object.assign(track.style, {
      display: 'block', position: 'relative',
      width: '100%', height: '100%',
    });

    const layer = document.createElement('div');
    layer.className = 'c-layer';
    Object.assign(layer.style, {
      position: 'absolute', inset: '0',
      display: 'flex', gap: '2px',
      opacity: animate ? '0' : '1',
      transition: `opacity ${CFG.transitionDuration}ms ease`,
    });
    this.windowAt(startIdx).forEach(gi => layer.appendChild(this.makeSlide(gi, 100 / v)));

    // Empile la nouvelle couche au-dessus, puis fait disparaître l'ancienne
    const old = track.querySelector('.c-layer');
    track.appendChild(layer);

    requestAnimationFrame(() => { layer.style.opacity = '1'; });

    if (old) {
      old.style.opacity = '0';
      setTimeout(() => old.remove(), CFG.transitionDuration + 50);
    }
  }

  /* ===================================================
     MODE "SLIDE" — ruban continu, glisse d'1 photo (case)
     Toutes les photos sont alignées dans un ruban ; on y
     ajoute des clones des v premières photos à la fin pour
     permettre une boucle infinie sans saut visible.
  =================================================== */
  buildSlide() {
    const track = this.el.querySelector('.carousel-track');
    const v     = this.vis(), n = this.photos.length;

    // Ruban = toutes les photos + clones des v premières (boucle fluide en avant)
    this.slideTotal = n + v;
    const widthPct  = 100 / this.slideTotal;     // largeur d'une case, en % du ruban

    Object.assign(track.style, {
      display: 'flex',
      width: `${(this.slideTotal / v) * 100}%`,   // le ruban est plus large que la scène
      height: '100%',
      transition: 'none',
      transform: 'translateX(0)',
    });
    track.innerHTML = '';

    for (let i = 0; i < n; i++) track.appendChild(this.makeSlide(i, widthPct));
    for (let i = 0; i < v; i++) track.appendChild(this.makeSlide(i, widthPct)); // clones de fin

    this.trackPos = 0; // position visuelle actuelle dans le ruban (0..n-1, ou n = zone clone)
  }

  /* Déplace le ruban d'EXACTEMENT une case (slide) */
  slideTo(pos, animate) {
    const track = this.el.querySelector('.carousel-track');
    const dur   = animate ? CFG.transitionDuration : 0;
    track.style.transition = `transform ${dur}ms cubic-bezier(.25,.46,.45,.94)`;
    track.style.transform  = `translateX(-${(100 / this.slideTotal) * pos}%)`;
  }

  /* ===================================================
     NAVIGATION — avance / recule d'UNE SEULE case
  =================================================== */
  next() {
    if (this.busy) return;
    const n = this.photos.length;
    this.busy = true;

    if (CFG.transition === 'slide') {
      this.trackPos++;
      this.slideTo(this.trackPos, true);
      this.pageIdx = this.trackPos % n;
      this.updateDots();

      // Si on vient d'entrer dans la zone des clones (fin du ruban),
      // on re-saute instantanément au début dès la transition finie
      // → boucle infinie invisible pour l'utilisateur.
      if (this.trackPos >= n) {
        setTimeout(() => {
          this.trackPos = 0;
          this.slideTo(0, false);
          this.busy = false;
        }, CFG.transitionDuration + 30);
      } else {
        setTimeout(() => { this.busy = false; }, CFG.transitionDuration + 30);
      }
    } else {
      this.pageIdx = (this.pageIdx + 1) % n;
      this.buildFade(this.pageIdx, true);
      this.updateDots();
      setTimeout(() => { this.busy = false; }, CFG.transitionDuration + 50);
    }
  }

  prev() {
    if (this.busy) return;
    const n = this.photos.length;
    this.busy = true;

    if (CFG.transition === 'slide') {
      // Pas de clones en début de ruban : on revient en arrière
      // par un saut instantané (sans animation) si on est à la
      // toute première photo, sinon glissement normal.
      if (this.trackPos === 0) {
        this.trackPos = n - 1;
        this.slideTo(this.trackPos, false);
      } else {
        this.trackPos--;
        this.slideTo(this.trackPos, true);
      }
      this.pageIdx = this.trackPos % n;
      this.updateDots();
      setTimeout(() => { this.busy = false; }, CFG.transitionDuration + 30);
    } else {
      this.pageIdx = (this.pageIdx - 1 + n) % n;
      this.buildFade(this.pageIdx, true);
      this.updateDots();
      setTimeout(() => { this.busy = false; }, CFG.transitionDuration + 50);
    }
  }

  /* Clic sur un dot : saut direct (pas soumis à la règle "1 case") */
  goTo(idx) {
    if (this.busy) return;
    const n = this.photos.length;
    this.pageIdx = ((idx % n) + n) % n;
    this.busy = true;

    if (CFG.transition === 'slide') {
      this.trackPos = this.pageIdx;
      this.slideTo(this.trackPos, true);
    } else {
      this.buildFade(this.pageIdx, true);
    }
    this.updateDots();
    setTimeout(() => { this.busy = false; }, CFG.transitionDuration + 50);
  }

  /* -------------------------------------------------
     DOTS — un point par photo (position de départ
     de la fenêtre). Le point actif = pageIdx.
  ------------------------------------------------- */
  buildDots() {
    const dotsEl = this.el.querySelector('.carousel-dots');
    dotsEl.innerHTML = '';
    if (this.photos.length <= 1) return;
    this.photos.forEach((_, i) => {
      const d = document.createElement('button');
      d.className = 'c-dot';
      d.ariaLabel = `Aller à la photo ${i + 1}`;
      d.addEventListener('click', () => { this.goTo(i); this.resetTimer(); });
      dotsEl.appendChild(d);
    });
    this.updateDots();
  }

  updateDots() {
    this.el.querySelectorAll('.c-dot')
      .forEach((d, i) => d.classList.toggle('active', i === this.pageIdx));
  }

  /* -------------------------------------------------
     AUTOPLAY
  ------------------------------------------------- */
  play()       { this.stop(); this.timer = setInterval(() => this.next(), CFG.autoplayDelay); }
  stop()       { clearInterval(this.timer); this.timer = null; }
  resetTimer() { if (CFG.autoplay) { this.stop(); this.play(); } }

  /* -------------------------------------------------
     ÉVÉNEMENTS — flèches, survol, swipe, clavier, resize
  ------------------------------------------------- */
  bindEvents() {
    const stage = this.el.querySelector('.carousel-stage');

    this.el.querySelector('.carousel-btn-prev')
      .addEventListener('click', () => { this.prev(); this.resetTimer(); });
    this.el.querySelector('.carousel-btn-next')
      .addEventListener('click', () => { this.next(); this.resetTimer(); });

    if (CFG.pauseOnHover && CFG.autoplay) {
      stage.addEventListener('mouseenter', () => this.stop());
      stage.addEventListener('mouseleave', () => this.play());
    }

    if (CFG.swipeEnabled) {
      let sx = 0, sy = 0;
      stage.addEventListener('touchstart', e => {
        sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      }, { passive: true });
      stage.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dy) > Math.abs(dx)) return;
        if (Math.abs(dx) > CFG.swipeThreshold) {
          dx < 0 ? this.next() : this.prev();
          this.resetTimer();
        }
      }, { passive: true });
    }

    this.el.setAttribute('tabindex', '0');
    this.el.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  { this.prev(); this.resetTimer(); }
      if (e.key === 'ArrowRight') { this.next(); this.resetTimer(); }
    });

    // Reconstruction complète si la fenêtre est redimensionnée
    // (le nombre de photos visibles peut changer : 3 → 2 → 1)
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (CFG.transition === 'slide') {
          this.buildSlide();
          this.trackPos = this.pageIdx;
          this.slideTo(this.trackPos, false);
        } else {
          this.buildFade(this.pageIdx, false);
        }
      }, 250);
    });
  }

  /* -------------------------------------------------
     LIGHTBOX — agrandissement plein écran
  ------------------------------------------------- */
  lbOpen(globalIdx) {
    activeCarousel = this;
    this.lbIdx = globalIdx;
    document.getElementById('lightbox').classList.add('open');
    this.lbUpdate();
    document.body.style.overflow = 'hidden';
    this.stop();
  }
  lbClose() {
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow = '';
    if (CFG.autoplay) this.play();
  }
  lbUpdate() {
    const lb = document.getElementById('lightbox');
    const f  = this.photos[this.lbIdx];
    lb.querySelector('.lb-img').src = `photos-${this.model}/${f}`;
    lb.querySelector('.lb-img').alt = `Photo ${this.lbIdx + 1}`;
    lb.querySelector('.lb-counter').textContent = `${this.lbIdx + 1} / ${this.photos.length}`;
  }
}

/* ── Lightbox partagée (une seule sur la page) ────────── */
let activeCarousel = null;

function initLightbox() {
  const lb = document.getElementById('lightbox');
  if (!lb) return;

  lb.querySelector('.lb-close').addEventListener('click', () => activeCarousel?.lbClose());

  lb.querySelector('.lb-prev').addEventListener('click', () => {
    if (!activeCarousel) return;
    activeCarousel.lbIdx = ((activeCarousel.lbIdx - 1) + activeCarousel.photos.length) % activeCarousel.photos.length;
    activeCarousel.lbUpdate();
  });

  lb.querySelector('.lb-next').addEventListener('click', () => {
    if (!activeCarousel) return;
    activeCarousel.lbIdx = (activeCarousel.lbIdx + 1) % activeCarousel.photos.length;
    activeCarousel.lbUpdate();
  });

  lb.addEventListener('click', e => { if (e.target === lb) activeCarousel?.lbClose(); });

  document.addEventListener('keydown', e => {
    if (!lb.classList.contains('open')) return;
    ({ Escape:     () => activeCarousel?.lbClose(),
       ArrowLeft:  () => lb.querySelector('.lb-prev').click(),
       ArrowRight: () => lb.querySelector('.lb-next').click(),
    })[e.key]?.();
  });

  let lbX = 0;
  lb.addEventListener('touchstart', e => { lbX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - lbX;
    if (Math.abs(dx) > 40) lb.querySelector(dx < 0 ? '.lb-next' : '.lb-prev').click();
  }, { passive: true });
}

/* ── Démarrage ─────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initLightbox();
  document.querySelectorAll('.photo-carousel').forEach(el => {
    const c = new ModelCarousel(el);
    c.init().then(() => { activeCarousel = c; });
  });
});
