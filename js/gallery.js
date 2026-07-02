/* =====================================================
   gallery.js — Galerie photo en grille + lightbox
   Ewen-M-Atelier · Coutellerie d'art · Thiers
   =====================================================

   FONCTIONNEMENT (même principe que carousel.js) :
   1. GitHub Actions scanne les dossiers photos-[nom]/ à
      chaque push et régénère photos.json automatiquement.
   2. Ce script lit photos.json et construit une grille de
      vignettes, avec agrandissement en plein écran au clic.
   → Ajouter une photo = la déposer dans le dossier, puis
     pousser sur GitHub. Rien d'autre à modifier : la page
     se met à jour toute seule au prochain chargement.

   Comment l'utiliser dans une page HTML :
     <link rel="stylesheet" href="css/gallery.css">
     ...
     <section class="photo-gallery" data-model="nom-du-dossier" data-label="Texte pour le alt">
       <div class="gallery-grid"></div>
       <div class="gallery-empty">
         <p>Aucune photo pour le moment.</p>
       </div>
     </section>

     <div class="lightbox" id="gallery-lightbox" role="dialog" aria-modal="true" aria-label="Photo agrandie">
       <button class="lb-close" aria-label="Fermer (Échap)"><svg>...</svg></button>
       <button class="lb-prev"  aria-label="Photo précédente (←)"><svg>...</svg></button>
       <div class="lb-body"><img class="lb-img" src="" alt=""></div>
       <button class="lb-next"  aria-label="Photo suivante (→)"><svg>...</svg></button>
       <div class="lb-counter"></div>
     </div>
     ...
     <script src="js/gallery.js" defer></script>

   Plusieurs galeries peuvent coexister sur la même page
   (une seule lightbox partagée, comme pour les carrousels).
===================================================== */

/* État de la lightbox actuellement ouverte */
let lbState = { photos: [], idx: 0, model: '', label: '' };

/* -------------------------------------------------
   Lecture de photos.json (généré par GitHub Actions)
------------------------------------------------- */
async function loadPhotosJSON() {
    try {
        const r = await fetch('photos.json');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.json();
    } catch (e) {
        console.warn('[Galerie] photos.json indisponible :', e.message);
        return {};
    }
}

/* -------------------------------------------------
   Construction de la grille pour UNE galerie
------------------------------------------------- */
function buildGallery(el, photos) {
    const grid  = el.querySelector('.gallery-grid');
    const empty = el.querySelector('.gallery-empty');
    const model = el.dataset.model;
    const label = el.dataset.label || model;

    if (!photos.length) {
        if (empty) empty.style.display = 'flex';
        if (grid)  grid.style.display  = 'none';
        return;
    }

    photos.forEach((file, i) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'gallery-item';
        item.setAttribute('aria-label', `Agrandir : ${label} — photo ${i + 1}`);

        const img = document.createElement('img');
        img.src       = `photos-${model}/${file}`;
        img.alt       = `${label} — photo ${i + 1}`;
        img.loading   = 'lazy';
        img.draggable = false;

        item.appendChild(img);
        item.addEventListener('click', () => lbOpen(photos, i, model, label));
        grid.appendChild(item);
    });
}

/* -------------------------------------------------
   LIGHTBOX — agrandissement plein écran
------------------------------------------------- */
function lbOpen(photos, idx, model, label) {
    lbState = { photos, idx, model, label };
    document.getElementById('gallery-lightbox').classList.add('open');
    lbUpdate();
    document.body.style.overflow = 'hidden';
}

function lbClose() {
    document.getElementById('gallery-lightbox').classList.remove('open');
    document.body.style.overflow = '';
}

function lbUpdate() {
    const lb = document.getElementById('gallery-lightbox');
    const f  = lbState.photos[lbState.idx];
    lb.querySelector('.lb-img').src = `photos-${lbState.model}/${f}`;
    lb.querySelector('.lb-img').alt = `${lbState.label} — photo ${lbState.idx + 1}`;
    lb.querySelector('.lb-counter').textContent = `${lbState.idx + 1} / ${lbState.photos.length}`;
}

function lbPrev() {
    lbState.idx = (lbState.idx - 1 + lbState.photos.length) % lbState.photos.length;
    lbUpdate();
}
function lbNext() {
    lbState.idx = (lbState.idx + 1) % lbState.photos.length;
    lbUpdate();
}

function initLightbox() {
    const lb = document.getElementById('gallery-lightbox');
    if (!lb) return;

    lb.querySelector('.lb-close').addEventListener('click', lbClose);
    lb.querySelector('.lb-prev').addEventListener('click', lbPrev);
    lb.querySelector('.lb-next').addEventListener('click', lbNext);
    lb.addEventListener('click', e => { if (e.target === lb) lbClose(); });

    document.addEventListener('keydown', e => {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'Escape')     lbClose();
        if (e.key === 'ArrowLeft')  lbPrev();
        if (e.key === 'ArrowRight') lbNext();
    });

    /* Balayage tactile */
    let sx = 0;
    lb.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) (dx < 0 ? lbNext() : lbPrev());
    }, { passive: true });
}

/* -------------------------------------------------
   DÉMARRAGE — construit toutes les galeries de la page
------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
    initLightbox();
    const data = await loadPhotosJSON();
    document.querySelectorAll('.photo-gallery').forEach(el => {
        const photos = data[el.dataset.model] || [];
        buildGallery(el, photos);
    });
});
