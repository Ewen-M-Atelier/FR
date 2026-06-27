/* =====================================================
   main.js — Scripts communs à toutes les pages
   Ewen-M-Atelier · Coutellerie d'art · Thiers
   =====================================================

   Ce fichier contient tous les comportements JavaScript
   réutilisés sur chaque page du site :
     1. Le curseur personnalisé (point doré + anneau)
     2. L'écran de chargement (loader)
     3. La barre de navigation (fond au défilement)
     4. Les animations d'apparition (reveal)

   Comment l'inclure dans une page HTML :
     <script src="js/main.js"></script>
   (à placer juste avant la balise </body>)
===================================================== */


/* -------------------------------------------------------
   1. CURSEUR PERSONNALISÉ
   -------------------------------------------------------
   Le curseur natif du navigateur est masqué (cursor:none
   dans le CSS). On le remplace par deux éléments HTML :
     • #cur  → petit point doré (suit la souris instantanément)
     • #curR → grand anneau (suit avec un léger retard, effet traînée)
------------------------------------------------------- */

const cur  = document.getElementById('cur');   // le point
const curR = document.getElementById('curR');  // l'anneau

let mx = 0, my = 0;  // coordonnées X et Y de la souris
let rx = 0, ry = 0;  // coordonnées de l'anneau (décalées dans le temps)

/* Mise à jour immédiate de la position du point */
document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    cur.style.left = mx + 'px';
    cur.style.top  = my + 'px';
});

/* L'anneau rattrape la souris progressivement (11% par image).
   requestAnimationFrame crée une boucle qui tourne ~60 fois/seconde. */
(function loop() {
    rx += (mx - rx) * 0.11;
    ry += (my - ry) * 0.11;
    curR.style.left = rx + 'px';
    curR.style.top  = ry + 'px';
    requestAnimationFrame(loop);
})();


/* -------------------------------------------------------
   2. ÉCRAN DE CHARGEMENT (LOADER)
   -------------------------------------------------------
   Un écran noir avec le logo s'affiche au démarrage.
   Il disparaît 2,1 secondes après que la page est chargée.
   La classe CSS "out" déclenche une transition opacity→0.
------------------------------------------------------- */

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('out');
    }, 2100);  /* 2100 millisecondes = 2,1 secondes */
});


/* -------------------------------------------------------
   3. NAVIGATION — fond au défilement
   -------------------------------------------------------
   La barre de navigation est transparente au départ (sur
   le hero). Dès que l'utilisateur fait défiler de plus de
   70px, on ajoute la classe "on" qui ajoute un fond sombre
   semi-transparent (défini dans le CSS).
------------------------------------------------------- */

const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
    /* toggle(classe, condition) : ajoute si true, retire si false */
    nav.classList.toggle('on', window.scrollY > 70);
});


/* -------------------------------------------------------
   4. ANIMATIONS D'APPARITION (REVEAL)
   -------------------------------------------------------
   Les éléments HTML portant la classe "reveal" sont
   initialement invisibles (opacity:0, décalés vers le bas).
   Quand ils entrent dans le champ de vision, la classe "vis"
   leur est ajoutée → le CSS anime leur apparition.

   On utilise IntersectionObserver : API native du navigateur
   qui surveille quand un élément devient visible, sans boucle
   manuelle (plus performant que l'ancienne méthode scroll+getBoundingClientRect).
------------------------------------------------------- */

const revealObserver = new IntersectionObserver(
    entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                /* L'élément est au moins 12% visible → on le révèle */
                entry.target.classList.add('vis');
                /* On arrête de surveiller cet élément (l'animation ne rejoue pas) */
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.12 }  /* seuil : 12% de l'élément doit être visible */
);

/* On active la surveillance sur tous les éléments .reveal de la page */
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
