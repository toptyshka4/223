/*! wagon.module.js — подсказки, бейджи и выбор стороны вагона.
 * Тип вагона берём ТОЛЬКО из базы (поле "Тип").
 * Новое: ПКМ-меню с ползунком для выбора НЕрабочей стороны (Москва / Сортировочная).
 * Если НЕрабочая сторона = "Москва" → картинка вагона зеркалится по X.
 */
(function (global) {
  const WagonUI = {};
  const state = {
    dataUrl: './data/wagons_2000.json',
    cellSelector: '[data-number],[data-wagon-id]',
    typeToAsset: {
      'одноэтажный': './assets/wagon_one.png',
      'двухэтажный': './assets/wagon_two.png'
    },
    youngYear: 2018,
    debug: false
  };

  const db = { byNumber: new Map(), byId: new Map(), loaded: false };
  let tipEl = null;
  const inited = new WeakSet();

  /* ---------- ВСПОМОГАТЕЛЬНОЕ ---------- */
  function log(){ if(state.debug) console.log.apply(console, arguments); }
  function keyFor(root){
    const id  = root.getAttribute('data-wagon-id');
    const num = root.getAttribute('data-number');
    return id ? `id:${id}` : (num ? `num:${num}` : null);
  }
  function storageGetSide(root){
    const k = keyFor(root); if(!k) return null;
    return localStorage.getItem('wagonSide:'+k); // "moscow" | "sort" | null
  }
  function storageSetSide(root, side){
    const k = keyFor(root); if(!k) return;
    localStorage.setItem('wagonSide:'+k, side);
  }

  /* ---------- ЗАГРУЗКА БАЗЫ ---------- */
  async function loadDB(){
    if (db.loaded) return;
    const r = await fetch(state.dataUrl, { cache: 'no-store' });
    if (!r.ok) throw new Error('Не удалось загрузить базу: ' + state.dataUrl);
    const data = await r.json();
    data.forEach(rec => {
      db.byId.set(String(rec.id), rec);
      db.byNumber.set(String(rec.number), rec);
    });
    db.loaded = true;
    log('DB loaded:', db.byNumber.size);
  }

  /* ---------- ТУЛТИП ---------- */
  function ensureTip(){
    if (tipEl) return;
    tipEl = document.createElement('div');
    tipEl.className = 'wagon-tooltip';
    Object.assign(tipEl.style, {
      position:'fixed',zIndex:9999,maxWidth:'320px',padding:'10px 12px',
      borderRadius:'8px',background:'#111',color:'#fff',
      font:'13px/1.35 system-ui,-apple-system, Segoe UI, Roboto, Arial, sans-serif',
      boxShadow:'0 10px 20px rgba(0,0,0,.35)',pointerEvents:'none',display:'none'
    });
    document.body.appendChild(tipEl);
  }
  function buildTipHTML(rec){
    const rows = [
      ['ЭЧТК', rec['ЭЧТК']],
      ['УКВ',  rec['УКВ']],
      ['Кол-во мест', rec['Кол-во мест']],
      ['Автосцепка', rec['Автосцепка']],
      ['Переход', rec['Переход']],
      ['Постройка', rec['Постройка']],
      ['Тип', rec['Тип']]
    ];
    let html = `<div style="font-weight:700;margin-bottom:6px;font-size:14px">Вагон №${rec.number}</div>`;
    for(const [k,v] of rows){
      html += `<div style="display:flex;justify-content:space-between;gap:10px"><div style="opacity:.75">${k}</div><div style="font-weight:600">${v}</div></div>`;
    }
    return html;
  }
  function positionTip(evt, anchor){
    const pad = 10;
    let x = (evt && (evt.clientX || evt.pageX)) || 0;
    let y = (evt && (evt.clientY || evt.pageY)) || 0;
    if (!x && anchor){ const r=anchor.getBoundingClientRect(); x=r.right; y=r.top; }
    const tt = tipEl.getBoundingClientRect();
    let l=x+16, t=y+16;
    if(l+tt.width>window.innerWidth-pad) l=x-tt.width-16;
    if(t+tt.height>window.innerHeight-pad) t=y-tt.height-16;
    tipEl.style.left=l+'px'; tipEl.style.top=t+'px';
  }
  function showTip(rec,evt,anchor){ ensureTip(); tipEl.innerHTML=buildTipHTML(rec); tipEl.style.display='block'; positionTip(evt,anchor); }
  function hideTip(){ if(tipEl) tipEl.style.display='none'; }

  /* ---------- БЕЙДЖИ ---------- */
  function clearBadges(root){ root.querySelectorAll(':scope > .wagon-badge').forEach(n=>n.remove()); }
  function addBadge(root, cls, text, extraRightPx){
    const b=document.createElement('div');
    b.className='wagon-badge '+cls;
    Object.assign(b.style,{
      position:'absolute',top:'6px',right:(extraRightPx||6)+'px',zIndex:2,
      display:'flex',alignItems:'center',justifyContent:'center',
      width:'22px',height:'22px',borderRadius:'50%',
      fontWeight:700,fontSize:(cls==='star'?'16px':'14px'),lineHeight:1,
      background:(cls==='star'?'#111':'#fff'),color:(cls==='star'?'#fff':'#111'),
      boxShadow:'0 2px 6px rgba(0,0,0,.25)',pointerEvents:'none'
    });
    b.textContent=text;
    root.appendChild(b);
  }
  function applyBadges(root, rec){
    clearBadges(root);
    if (Number(rec['Постройка']) >= state.youngYear) addBadge(root,'star','★',6);
    if (String(rec['Переход']).toUpperCase()==='Х') addBadge(root,'huebner','Х',30);
  }

  /* ---------- ИКОНКА ПО ТИПУ И ЗЕРКАЛО ---------- */
  function setIconByType(root, rec){
    const img = root.querySelector('img'); if(!img) return;
    const type = String(rec['Тип']||'').toLowerCase();
    const src  = state.typeToAsset[type];
    if (src) img.setAttribute('src', src);
  }
  function applyMirrorBySide(root){
    const img = root.querySelector('img'); if(!img) return;
    // "moscow" означает НЕрабочая сторона = Москва → зеркалим
    const side = storageGetSide(root) || 'sort';
    img.style.transform = (side === 'moscow') ? 'scaleX(-1)' : 'none';
    img.style.transformOrigin = '50% 50%';
  }

  /* ---------- НОТИФИКАЦИЯ ОТСУТСТВИЯ В БАЗЕ ---------- */
  function notifyMissing(root, key){
    let box = document.getElementById('wagon-notify');
    if(!box){
      box=document.createElement('div'); box.id='wagon-notify';
      Object.assign(box.style,{
        position:'fixed', right:'16px', bottom:'16px', maxWidth:'360px',
        padding:'12px 14px', borderRadius:'10px', background:'#111', color:'#fff',
        font:'14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial',
        boxShadow:'0 10px 20px rgba(0,0,0,.35)', zIndex:10000
      });
      document.body.appendChild(box);
    }
    box.innerHTML = 'Вагон не найден в базе: ' + (key?.v || 'без номера') +
      '<div style="opacity:.75;margin-top:6px">Добавьте запись в <code>'+state.dataUrl+'</code> (обязательно «Тип»).</div>';
    box.style.display='block';
    clearTimeout(box._t); box._t=setTimeout(()=>{box.style.display='none';},4500);
  }

  /* ---------- ПКМ-МЕНЮ С ПОЛЗУНКОМ ---------- */
  let ctxMenu = null;
  function ensureContextMenu(){
    if (ctxMenu) return;
    ctxMenu = document.createElement('div');
    ctxMenu.id = 'wagon-side-menu';
    Object.assign(ctxMenu.style,{
      position:'fixed', zIndex:10000, background:'#fff', color:'#111',
      border:'1px solid #e5e7eb', borderRadius:'10px', boxShadow:'0 10px 20px rgba(0,0,0,.12)',
      padding:'10px 12px', font:'14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial', display:'none'
    });
    ctxMenu.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;">Нерабочая сторона</div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="opacity:.75;">Москва</span>
        <label style="position:relative;display:inline-block;width:46px;height:24px;">
          <input type="checkbox" id="wagon-side-toggle" style="opacity:0;width:0;height:0;">
          <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:#d1d5db;border-radius:999px;transition:.2s;"></span>
          <span style="position:absolute;left:2px;top:2px;width:20px;height:20px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.2s;"></span>
        </label>
        <span style="opacity:.75;">Сортировочная</span>
      </div>
      <div style="margin-top:10px; font-size:12px; opacity:.7;">ПКМ по вагону → выбор стороны</div>
    `;
    document.body.appendChild(ctxMenu);

    // стилизация переключателя через JS (чтобы работало без внешнего CSS)
    const wrap = ctxMenu.querySelector('label');
    const track = wrap.children[1];
    const knob  = wrap.children[2];
    function setToggleUI(on){
      track.style.background = on ? '#0b5cab' : '#d1d5db';
      knob.style.transform   = on ? 'translateX(22px)' : 'translateX(0)';
    }
    ctxMenu._setToggleUI = setToggleUI;

    // клик вне меню — скрыть
    document.addEventListener('click', (e)=>{
      if (!ctxMenu) return;
      if (ctxMenu.style.display==='none') return;
      if (!ctxMenu.contains(e.target)) ctxMenu.style.display='none';
    });
  }
  function openContextMenu(root, x, y){
    ensureContextMenu();
    const toggle = ctxMenu.querySelector('#wagon-side-toggle');
    const curr = storageGetSide(root) || 'sort'; // по умолчанию НЕрабочая = Сортировочная
    // В нашем UI: чекбокс = true означает НЕрабочая = "Сортировочная" (слева Москва, справа Сортировочная)
    const isSort = (curr === 'sort');
    toggle.checked = isSort;
    ctxMenu._setToggleUI(isSort);

    // позиция
    const w = 220, h = 96; // примерные размеры
    let L = x, T = y;
    if (L + w > window.innerWidth - 10)  L = window.innerWidth - w - 10;
    if (T + h > window.innerHeight - 10) T = window.innerHeight - h - 10;
    ctxMenu.style.left = L + 'px';
    ctxMenu.style.top  = T + 'px';
    ctxMenu.style.display = 'block';

    // обработчик смены
    toggle.onchange = () => {
      const newSide = toggle.checked ? 'sort' : 'moscow';
      storageSetSide(root, newSide);
      applyMirrorBySide(root);
      // обновим UI тумблера
      ctxMenu._setToggleUI(toggle.checked);
    };
  }

  /* ---------- ОСНОВНОЕ ПОВЕДЕНИЕ ЭЛЕМЕНТА ---------- */
  function getKeyObj(root){
    const id = root.getAttribute('data-wagon-id');
    const num = root.getAttribute('data-number');
    if (id)  return {t:'id', v:String(id)};
    if (num) return {t:'num',v:String(num)};
    return null;
  }
  function getRecByKey(key){
    if(!key) return null;
    if (key.t==='id')  return db.byId.get(key.v)   || null;
    if (key.t==='num') return db.byNumber.get(key.v)|| null;
    return null;
  }

  function enhance(root){
    if (inited.has(root)) return;
    inited.add(root);
    root.classList.add('wagon-root');
    const key = getKeyObj(root);
    const rec = getRecByKey(key);

    if (!rec){
      root.classList.add('wagon-missing');
      root.addEventListener('mouseenter', ()=> notifyMissing(root, key), { once:true });
      root.addEventListener('mouseleave', hideTip);
      // ПКМ всё равно разрешим — чтобы можно было задать сторону заранее
      root.addEventListener('contextmenu', (e)=>{ e.preventDefault(); openContextMenu(root, e.clientX, e.clientY); });
      return;
    }

    applyBadges(root, rec);
    setIconByType(root, rec);
    applyMirrorBySide(root); // применяем текущее состояние зеркала

    root.addEventListener('mouseenter', e=> showTip(rec, e, root));
    root.addEventListener('mousemove', e=> showTip(rec, e, root));
    root.addEventListener('mouseleave', hideTip);

    // Правый клик — открыть меню выбора НЕрабочей стороны
    root.addEventListener('contextmenu', (e)=>{
      e.preventDefault();
      openContextMenu(root, e.clientX, e.clientY);
    });

    // Доступность
    root.setAttribute('tabindex','0');
    root.addEventListener('focus', e=> showTip(rec, e, root));
    root.addEventListener('blur',  hideTip);
  }

  function scan(){
    document.querySelectorAll(state.cellSelector).forEach(enhance);
  }
  function observe(){
    const mo = new MutationObserver(muts=>{
      muts.forEach(m=>{
        m.addedNodes && m.addedNodes.forEach(n=>{
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches(state.cellSelector)) enhance(n);
          n.querySelectorAll && n.querySelectorAll(state.cellSelector).forEach(enhance);
        });
      });
    });
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  /* ---------- ПУБЛИЧНЫЙ API ---------- */
  WagonUI.init = async function init(opts){
    Object.assign(state, opts || {});
    await loadDB();
    scan();
    observe();
    log('WagonUI: ready', state);
  };

  global.WagonUI = WagonUI;
})(window);
