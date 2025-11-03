/*! wagon.module.js — Production UI for wagon tooltips & badges (no layout impact) */
(function(global){
  const WagonUI = {};
  const _state = {
    dataUrl: './data/wagons_2000.json',
    youngYear: 2018,
    cellSelector: '[data-number],[data-wagon-id]',
    typeToAsset: {
      'одноэтажный': './assets/wagon_single.jpg',
      'двухэтажный': './assets/wagon_double.jpg'
    },
    debug: false
  };

  const db = {
    byNumber: new Map(),
    byId: new Map(),
    loaded: false
  };

  let tooltipEl = null;
  const initialized = new WeakSet();

  function log(){ if(_state.debug) console.log.apply(console, arguments); }

  async function loadData(){
    if (db.loaded) return;
    const resp = await fetch(_state.dataUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Не удалось загрузить базу вагонов: '+_state.dataUrl);
    const data = await resp.json();
    data.forEach(r => {
      db.byId.set(String(r.id), r);
      db.byNumber.set(String(r.number), r);
    });
    db.loaded = true;
    log('DB loaded:', db.byNumber.size, 'records');
  }

  function ensureTooltip(){
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'wagon-tooltip';
    tooltipEl.style.display = 'none';
    document.body.appendChild(tooltipEl);
  }

  function buildHTML(rec){
    const rows=[
      ['Тип вагона', rec['Тип вагона']],
      ['Кол-во мест', rec['Кол-во мест']],
      ['ЭЧТК', rec['ЭЧТК']],
      ['УКВ', rec['УКВ']],
      ['Переход р/с', rec['Переход р/с']],
      ['Переход н/с', rec['Переход н/с']],
      ['Сцепка р/с', rec['Сцепка р/с']],
      ['Сцепка н/с', rec['Сцепка н/с']],
      ['Постройка', rec['Постройка']],
      ['Модель вагона', rec['Модель вагона']]
    ];
           
    let html=`<div class="title">Вагон №${rec.number}</div>`;
    for(const [k,v] of rows){ 
      html+=`<div class="row"><div class="k">${k}</div><div class="v">${v||'—'}</div></div>`; 
    }
    return html;
  }

  function positionTooltip(evt, anchor){
    const pad=10;
    let x = (evt && (evt.clientX || evt.pageX)) || 0;
    let y = (evt && (evt.clientY || evt.pageY)) || 0;
    if (!x && anchor) { const r=anchor.getBoundingClientRect(); x=r.right; y=r.top; }
    const tt = tooltipEl.getBoundingClientRect();
    let l=x+16, t=y+16;
    if (l + tt.width > window.innerWidth - pad) l = x - tt.width - 16;
    if (t + tt.height > window.innerHeight - pad) t = y - tt.height - 16;
    tooltipEl.style.left = l + 'px';
    tooltipEl.style.top  = t + 'px';
  }

  function showTooltip(rec, evt, anchor){
    ensureTooltip();
    tooltipEl.innerHTML = buildHTML(rec);
    tooltipEl.style.display = 'block';
    positionTooltip(evt, anchor);
  }
  function hideTooltip(){ if (tooltipEl) tooltipEl.style.display = 'none'; }

  function getKeyFromEl(el){
    const id = el.getAttribute('data-wagon-id');
    const num = el.getAttribute('data-number');
    if (id) return { type:'id', value:String(id) };
    if (num) return { type:'number', value:String(num) };

    // Try text extraction: 8 digits or 3-5 digits + dash + 5 digits
    const txt = el.textContent || '';
    const m = txt.match(/\b\d{8}\b|\b\d{3,5}-\d{5}\b/);
    if (m){
      const normalized = m[0].replace(/\D+/g,'');
      if (normalized.length===8) return { type:'number', value:normalized };
    }

    // Try from <img src="...12345678.png">
    const img = el.querySelector('img');
    if (img && img.src){
      const m2 = img.src.match(/(\d{8})(?:\.\w+)?$/);
      if (m2) return { type:'number', value:m2[1] };
    }
    return null;
  }

  function getRecByKey(key){
    if (!key) return null;
    if (key.type==='id') return db.byId.get(key.value) || null;
    if (key.type==='number') return db.byNumber.get(key.value) || null;
    return null;
  }

  function clearBadges(root){
    root.querySelectorAll(':scope > .wagon-badge').forEach(n=>n.remove());
  }

  function applyBadges(root, rec){
    clearBadges(root);
    const isYoung = Number(rec['Постройка']) >= _state.youngYear;
    const hasH = String(rec['Переход р/с']).toUpperCase() === 'HUBNER' || 
                 String(rec['Переход н/с']).toUpperCase() === 'HUBNER';
    if (isYoung){
      const s=document.createElement('div'); s.className='wagon-badge star'; s.textContent='★'; root.appendChild(s);
    }
    if (hasH){
      const h=document.createElement('div'); h.className='wagon-badge huebner'; h.textContent='Х'; root.appendChild(h);
    }
  }

  function setIconByType(root, rec){
    const img = root.querySelector('img');
    if (!img) return;
    // Используем поле "Модель вагона" вместо "Тип"
    const modelType = String(rec['Модель вагона']).toLowerCase();
    const src = _state.typeToAsset[modelType];
    if (src) img.setAttribute('src', src);
  }

  function markMissing(root, key){
    root.classList.add('wagon-missing');
    root.addEventListener('mouseenter', ()=>{
      notify('Вагон не найден в базе: '+(key?.value||'без номера'));
    }, { once: true });
  }

  function notify(msg){
    let d=document.getElementById('wagon-notify');
    if(!d){
      d=document.createElement('div'); d.id='wagon-notify';
      Object.assign(d.style,{
        position:'fixed', right:'16px', bottom:'16px', maxWidth:'360px',
        padding:'12px 14px', borderRadius:'10px', background:'#111', color:'#fff',
        font:'14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial',
        boxShadow:'0 10px 20px rgba(0,0,0,.35)', zIndex:10000
      });
      document.body.appendChild(d);
    }
    d.innerHTML = msg + '<div style="opacity:.75;margin-top:6px">Добавьте запись в <code>'+_state.dataUrl+'</code> (обязательно «Модель вагона»).</div>';
    d.style.display='block';
    clearTimeout(d._t); d._t = setTimeout(()=>{ d.style.display='none'; }, 4500);
  }

  function enhance(root){
    if (initialized.has(root)) return;
    initialized.add(root);
    root.classList.add('wagon-root');
    const key = getKeyFromEl(root);
    const rec = getRecByKey(key);
    if (!rec){
      markMissing(root, key);
      root.addEventListener('mouseleave', hideTooltip);
      return;
    }
    applyBadges(root, rec);
    setIconByType(root, rec);
    root.addEventListener('mouseenter', e=> showTooltip(rec, e, root));
    root.addEventListener('mousemove', e=> showTooltip(rec, e, root));
    root.addEventListener('mouseleave', hideTooltip);
    root.setAttribute('tabindex','0');
    root.addEventListener('focus', e=> showTooltip(rec, e, root));
    root.addEventListener('blur', hideTooltip);
  }

  function scan(){
    document.querySelectorAll(_state.cellSelector).forEach(enhance);
  }

  function observe(){
    const mo = new MutationObserver(muts => {
      for (const m of muts){
        m.addedNodes && m.addedNodes.forEach(n => {
          if (!(n instanceof HTMLElement)) return;
          if (n.matches && n.matches(_state.cellSelector)) enhance(n);
          n.querySelectorAll && n.querySelectorAll(_state.cellSelector).forEach(enhance);
        });
      }
    });
    mo.observe(document.documentElement, { childList:true, subtree:true });
  }

  WagonUI.init = async function init(options){
    Object.assign(_state, options||{});
    await loadData();
    scan();
    observe();
    log('WagonUI initialized with', _state);
  };

  // auto-init if script tag has data-auto-init
  function auto(){
    const scriptEl = document.currentScript;
    if (scriptEl && scriptEl.dataset.autoInit !== undefined){
      WagonUI.init({
        dataUrl: scriptEl.dataset.dataUrl || _state.dataUrl,
        youngYear: scriptEl.dataset.youngYear ? Number(scriptEl.dataset.youngYear) : _state.youngYear,
        cellSelector: scriptEl.dataset.cellSelector || _state.cellSelector
      });
    }
  }
  try{ auto(); }catch(e){}

  global.WagonUI = WagonUI;
})(window);
