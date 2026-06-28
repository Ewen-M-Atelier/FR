/* =====================================================
   carousel.js — Carrousel de photos · Ewen-M-Atelier

   FONCTIONNEMENT :
   1. GitHub Actions scanne photos-[modele]/ à chaque push
      et régénère photos.json automatiquement.
   2. Ce script lit photos.json et construit le carrousel.
   → Ajouter une photo = la déposer dans le dossier + push.

   ★ CONFIGURATION ★ — modifiez ces valeurs librement :
===================================================== */
const CFG = {
  autoplay:           true,   // true=défilement auto | false=manuel seul
  autoplayDelay:      4000,   // ms entre groupes : 1000=1s 4000=4s 6000=6s
  pauseOnHover:       true,   // true=pause au survol souris
  visibleCount:       3,      // photos côte à côte ≥1024px : 1 | 2 | 3
                              // tablette : 2 max auto · mobile : 1 auto
  transition:        'fade',  // 'fade'=fondu | 'slide'=glissement
  transitionDuration: 700,    // ms animation : 300=rapide 700=moyen 1200=lent
  swipeEnabled:       true,   // true=balayage tactile activé
  swipeThreshold:     50,     // px mini swipe : 30=sensible 50=normal 80=peu
  lightboxEnabled:    true,   // true=clic → plein écran
};

/* ── Classe carrousel ─────────────────────────────────── */
class ModelCarousel {
  constructor(el) {
    this.el=el; this.model=el.dataset.model;
    this.photos=[]; this.pageIdx=0;
    this.busy=false; this.timer=null; this.lbIdx=0;
  }

  async init() {
    try {
      const r=await fetch('photos.json');
      if(!r.ok) throw new Error('HTTP '+r.status);
      const d=await r.json();
      this.photos=d[this.model]||[];
    } catch(e){ console.warn('[Carrousel] photos.json :', e.message); }

    if(!this.photos.length){
      this.el.querySelector('.carousel-empty').style.display='flex';
      this.el.querySelector('.carousel-stage').style.display='none';
      return;
    }
    this.build(); this.bindEvents();
    this.showPage(0,false);
    if(CFG.autoplay) this.play();
  }

  vis(){
    const w=window.innerWidth;
    if(w<640) return 1;
    if(w<1024) return Math.min(2,CFG.visibleCount);
    return Math.min(CFG.visibleCount,this.photos.length);
  }

  pages(){
    const v=this.vis(),g=[];
    for(let i=0;i<this.photos.length;i+=v) g.push(this.photos.slice(i,i+v));
    return g;
  }

  build(){
    const track=this.el.querySelector('.carousel-track');
    const dotsEl=this.el.querySelector('.carousel-dots');
    const groups=this.pages(), v=this.vis();
    const isSlide=CFG.transition==='slide';
    track.innerHTML='';

    if(isSlide){
      Object.assign(track.style,{display:'flex',width:`${groups.length*100}%`,
        height:'100%',transition:'none',transform:'translateX(0)'});
    } else {
      Object.assign(track.style,{display:'block',position:'relative',
        width:'100%',height:'100%'});
    }

    groups.forEach((group,gi)=>{
      const page=document.createElement('div');
      page.className='c-page'; page.dataset.page=gi;
      if(isSlide){
        Object.assign(page.style,{display:'inline-flex',
          width:`${100/groups.length}%`,height:'100%',gap:'2px',flexShrink:'0'});
      } else {
        Object.assign(page.style,{display:'flex',
          position:gi===0?'relative':'absolute',
          top:'0',left:'0',width:'100%',height:'100%',
          opacity:gi===0?'1':'0',
          pointerEvents:gi===0?'all':'none',
          gap:'2px',zIndex:gi===0?'2':'0'});
      }
      group.forEach((file,fi)=>{
        const s=document.createElement('div');
        s.className='c-slide'; s.style.flex=`0 0 ${100/v}%`;
        const img=document.createElement('img');
        img.src=`photos-${this.model}/${file}`;
        img.alt=`${this.model} — photo ${gi*v+fi+1}`;
        img.loading=gi===0?'eager':'lazy';
        img.draggable=false;
        if(CFG.lightboxEnabled){
          const idx=gi*v+fi;
          s.style.cursor='zoom-in';
          s.addEventListener('click',()=>this.lbOpen(idx));
        }
        s.appendChild(img); page.appendChild(s);
      });
      track.appendChild(page);
    });

    dotsEl.innerHTML='';
    if(groups.length>1) groups.forEach((_,i)=>{
      const d=document.createElement('button');
      d.className='c-dot'; d.ariaLabel=`Groupe ${i+1}`;
      d.addEventListener('click',()=>{this.showPage(i);this.resetTimer();});
      dotsEl.appendChild(d);
    });
  }

  showPage(idx,animate=true){
    if(this.busy) return;
    const groups=this.pages();
    idx=((idx%groups.length)+groups.length)%groups.length;
    const prev=this.pageIdx; this.pageIdx=idx;
    CFG.transition==='slide'?this.doSlide(idx,groups.length,animate):this.doFade(prev,idx,animate);
    this.el.querySelectorAll('.c-dot').forEach((d,i)=>d.classList.toggle('active',i===idx));
  }

  next(){ this.showPage(this.pageIdx+1); }
  prev(){ this.showPage(this.pageIdx-1); }

  doSlide(idx,total,animate){
    const track=this.el.querySelector('.carousel-track');
    const dur=animate?CFG.transitionDuration:0;
    track.style.transition=`transform ${dur}ms cubic-bezier(.25,.46,.45,.94)`;
    track.style.transform=`translateX(-${(100/total)*idx}%)`;
    if(animate){this.busy=true; setTimeout(()=>{this.busy=false;},dur+50);}
  }

  doFade(prev,idx,animate){
    const dur=animate?CFG.transitionDuration:0;
    if(animate) this.busy=true;
    this.el.querySelectorAll('.c-page').forEach((p,i)=>{
      p.style.transition=`opacity ${dur}ms ease`;
      p.style.position=i===idx?'relative':'absolute';
      p.style.opacity=i===idx?'1':'0';
      p.style.pointerEvents=i===idx?'all':'none';
      p.style.zIndex=i===idx?'2':(i===prev?'1':'0');
    });
    if(animate) setTimeout(()=>{this.busy=false;},dur+50);
  }

  play(){ this.stop(); this.timer=setInterval(()=>this.next(),CFG.autoplayDelay); }
  stop(){ clearInterval(this.timer); this.timer=null; }
  resetTimer(){ if(CFG.autoplay){this.stop();this.play();} }

  bindEvents(){
    const stage=this.el.querySelector('.carousel-stage');
    this.el.querySelector('.carousel-btn-prev').addEventListener('click',()=>{this.prev();this.resetTimer();});
    this.el.querySelector('.carousel-btn-next').addEventListener('click',()=>{this.next();this.resetTimer();});
    if(CFG.pauseOnHover&&CFG.autoplay){
      stage.addEventListener('mouseenter',()=>this.stop());
      stage.addEventListener('mouseleave',()=>this.play());
    }
    if(CFG.swipeEnabled){
      let sx=0,sy=0;
      stage.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
      stage.addEventListener('touchend',e=>{
        const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
        if(Math.abs(dy)>Math.abs(dx)) return;
        if(Math.abs(dx)>CFG.swipeThreshold){dx<0?this.next():this.prev();this.resetTimer();}
      },{passive:true});
    }
    this.el.setAttribute('tabindex','0');
    this.el.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft'){this.prev();this.resetTimer();}
      if(e.key==='ArrowRight'){this.next();this.resetTimer();}
    });
    let rt;
    window.addEventListener('resize',()=>{
      clearTimeout(rt);
      rt=setTimeout(()=>{this.build();this.showPage(this.pageIdx,false);},250);
    });
  }

  lbOpen(i){
    activeCarousel=this; this.lbIdx=i;
    document.getElementById('lightbox').classList.add('open');
    this.lbUpdate();
    document.body.style.overflow='hidden';
    this.stop();
  }
  lbClose(){
    document.getElementById('lightbox').classList.remove('open');
    document.body.style.overflow='';
    if(CFG.autoplay) this.play();
  }
  lbUpdate(){
    const lb=document.getElementById('lightbox'),f=this.photos[this.lbIdx];
    lb.querySelector('.lb-img').src=`photos-${this.model}/${f}`;
    lb.querySelector('.lb-img').alt=`Photo ${this.lbIdx+1}`;
    lb.querySelector('.lb-counter').textContent=`${this.lbIdx+1} / ${this.photos.length}`;
  }
}

/* ── Lightbox partagée ────────────────────────────────── */
let activeCarousel=null;

function initLightbox(){
  const lb=document.getElementById('lightbox');
  if(!lb) return;
  lb.querySelector('.lb-close').addEventListener('click',()=>activeCarousel?.lbClose());
  lb.querySelector('.lb-prev').addEventListener('click',()=>{
    if(!activeCarousel) return;
    activeCarousel.lbIdx=((activeCarousel.lbIdx-1)+activeCarousel.photos.length)%activeCarousel.photos.length;
    activeCarousel.lbUpdate();
  });
  lb.querySelector('.lb-next').addEventListener('click',()=>{
    if(!activeCarousel) return;
    activeCarousel.lbIdx=(activeCarousel.lbIdx+1)%activeCarousel.photos.length;
    activeCarousel.lbUpdate();
  });
  lb.addEventListener('click',e=>{ if(e.target===lb) activeCarousel?.lbClose(); });
  document.addEventListener('keydown',e=>{
    if(!lb.classList.contains('open')) return;
    ({Escape:()=>activeCarousel?.lbClose(),
      ArrowLeft:()=>lb.querySelector('.lb-prev').click(),
      ArrowRight:()=>lb.querySelector('.lb-next').click()})[e.key]?.();
  });
  let lbX=0;
  lb.addEventListener('touchstart',e=>{lbX=e.touches[0].clientX;},{passive:true});
  lb.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-lbX;
    if(Math.abs(dx)>40) lb.querySelector(dx<0?'.lb-next':'.lb-prev').click();
  },{passive:true});
}

document.addEventListener('DOMContentLoaded',()=>{
  initLightbox();
  document.querySelectorAll('.photo-carousel').forEach(el=>{
    const c=new ModelCarousel(el);
    c.init().then(()=>{ activeCarousel=c; });
  });
});
