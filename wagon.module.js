/*! wagon.module.js — Production UI for wagon tooltips & badges (no layout impact) */
(function(global){
  const WagonUI = {};
  const _state = {
    dataUrl: '/223/data/wagons_2000.json',
    youngYear: 2018,
    cellSelector: '.wagon, [data-number]',
    typeToAsset: {
      'одноэтажный': '/223/assets/wagon_single.jpg',
      'двухэтажный': '/223/assets/wagon_double.jpg'
    },
    debug: true
  };

  const db = {
    byNumber: new Map(), // ключ: НОРМАЛИЗОВАННЫЙ номер '########'
    byId: new Map(),
    loaded: false
  };

  let tooltipEl = null;
  const initialized = new WeakSet();

  function log(){ if(_state.debug) console.log.apply(console, arguments); }

  // === ВАЖНО: нормализация номера ===
  // Всегда возвращаем строку ровно из 8 цифр, сохраняя ведущие нули.
  function normalizeWagonNumber(input) {
    const digits = String(input ?? '').replace(/\D/g, '');
    const last8 = digits.slice(-8);        // на случай формата '###-#####' или длинных строк
    return last8.padStart(8, '0');         // дополняем нулями слева
  }

  async function loadData(){
    if (db.loaded) return;
    try {
      const resp = await fetch(_state.dataUrl, { cache: 'no-store' });
      if (!resp.ok) throw new Error('Не удалось загрузить базу вагонов: '+_state.dataUrl);
      const data = await resp.json();

      data.forEach(r => {
        // Индексация по ID (как есть)
        if (r.id !== undefined && r.id !== null) {
          db.byId.set(String(r.id), r);
        }

        // Индексация по номеру: нормализуем в '########'
        // Поддержим возможные варианты поля в JSON: number / Номер
        const rawNum = (r.number !== undefined ? r.number : r['Номер']);
        if (rawNum !== undefined) {
          const key = normalizeWagonNumber(rawNum);
          db.byNumber.set(key, r);
        }
      });

      db.loaded = true;
      log('DB loaded:', db.byNumber.size, 'records');
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
    }
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
           
    // Пытаемся показать номер из rec.number или rec['Номер']
    const shownNumber = normalizeWagonNumber(rec.number ?? rec['Номер'] ?? '');
    let html = `<div class="title">Вагон №${shownNumber}</div>`;
    for(const [k,v] of rows){ 
      html += `<div class="row"><div class="k">${k}</div><div class="v">${v || '—'}</div></div>`; 
    }
    return html;
  }

  function positionTooltip(evt, anchor){
    const pad = 10;
    let x = (evt && (evt.clientX || evt.pageX)) || 0;
    let y = (evt && (evt.clientY || evt.pageY)) || 0;
    if (!x && anchor) { 
      const r = anchor.getBoundingClientRect(); 
      x = r.right; 
      y = r.top; 
    }
    const tt = tooltipEl.getBoundingClientRect();
    let l = x + 16, t = y + 16;
    if (l + tt.width > window.innerWidth - pad) l = x - tt.width - 16;
    if (t + tt.height > window.innerHeight - pad) t = y - tt.height - 16;
    tooltipEl.style.left = l + 'px';
    tooltipEl.style.top = t + 'px';
  }

  function showTooltip(rec, evt, anchor){
    ensureTooltip();
    tooltipEl.innerHTML = buildHTML(rec);
    tooltipEl.style.display = 'block';
    positionTooltip(evt, anchor);
  }

  function hideTooltip(){ 
    if (tooltipEl) tooltipEl.style.display = 'none'; 
  }

  function getKeyFromEl(el){
    // 1) Явные атрибуты
    const id = el.getAttribute('data-wagon-id');
    const num = el.getAttribute('data-number');
    if (id) return { type: 'id', value: String(id) };
    if (num) return { type: 'number', value: normalizeWagonNumber(num) };

    // 2) Из .num (два <div>)
    const numEl = el.querySelector('.num');
    if (numEl) {
      const divs = numEl.querySelectorAll('div');
      if (divs.length >= 2) {
        const part1 = (divs[0].textContent || '').trim();
        const part2 = (divs[1].textContent || '').trim();
        if (part1 && part2) {
          const normalized = normalizeWagonNumber(part1 + part2);
          log('Extracted number from .num divs:', normalized);
          return { type: 'number', value: normalized };
        }
      }
      // Альтернатива: весь текст без пробелов
      const fullText = (numEl.textContent || '').replace(/\s+/g, '');
      if (fullText) {
        const normalized = normalizeWagonNumber(fullText);
        if (normalized) {
          log('Extracted number from .num text:', normalized);
          return { type: 'number', value: normalized };
        }
      }
    }

    // 3) Из текста всего элемента: форматы "001-12599" или "001 12599"
    const txt = el.textContent || '';
    const m = txt.match(/(\d{3})[-\s]*(\d{5})/);
    if (m){
      const normalized = normalizeWagonNumber(m[1] + m[2]);
      log('Extracted number from element text:', normalized);
      return { type: 'number', value: normalized };
    }

    // 4) Из src изображения: .../XXXXXXXX.jpg
    const img = el.querySelector('img');
    if (img && img.src){
      const m2 = img.src.match(/(\d{8})(?:\.\w+)?$/);
      if (m2) {
        const normalized = normalizeWagonNumber(m2[1]);
        log('Extracted number from image src:', normalized);
        return { type: 'number', value: normalized };
      }
    }
    
    log('No number found for element:', el);
    return null;
  }

  function getRecByKey(key){
    if (!key) return null;
    
    if (key.type === 'id') {
      const searchId = String(key.value);
      return db.byId.get(searchId) || null;
    }
    
    if (key.type === 'number') {
      const searchValue = normalizeWagonNumber(key.value);
      log('Searching for normalized number:', searchValue);
      const rec = db.byNumber.get(searchValue);
      if (rec) {
        log('Match found:', rec);
        return rec;
      }
    }
    return null;
  }

  function clearBadges(root){
    root.querySelectorAll(':scope > .wagon-badge').forEach(n => n.remove());
  }

  function applyBadges(root, rec){
    clearBadges(root);
    const isYoung = Number(rec['Постройка']) >= _state.youngYear;
    const hasH = String(rec['Переход р/с']).toUpperCase() === 'HUBNER' || 
                 String(rec['Переход н/с']).toUpperCase() === 'HUBNER';
    
    if (isYoung){
      const s = document.createElement('div'); 
      s.className = 'wagon-badge star'; 
      s.textContent = '★'; 
      root.appendChild(s);
    }
    if (hasH){
      const h = document.createElement('div'); 
      h.className = 'wagon-badge huebner'; 
      h.textContent = 'Х'; 
      root.appendChild(h);
    }
  }

  function setIconByType(root, rec){
    const img = root.querySelector('img');
    if (!img) return;
    // Используем поле "Модель вагона" (при необходимости можно заменить на "Тип вагона")
    const modelType = String(rec['Модель вагона'] || '').toLowerCase();
    const src = _state.typeToAsset[modelType];
    if (src) {
      img.setAttribute('src', src);
    }
  }

  function markMissing(root, key){
    root.classList.add('wagon-missing');
    root.addEventListener('mouseenter', ()=>{
      notify('Вагон не найден в базе: ' + (key?.value || 'без номера'));
    }, { once: true });
  }

  function notify(msg){
    let d = document.getElementById('wagon-notify');
    if(!d){
      d = document.createElement('div'); 
      d.id = 'wagon-notify';
      Object.assign(d.style, {
        position: 'fixed', 
        right: '16px', 
        bottom: '16px', 
        maxWidth: '360px',
        padding: '12px 14px', 
        borderRadius: '10px', 
        background: '#111', 
        color: '#fff',
        font: '14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial',
        boxShadow: '0 10px 20px rgba(0,0,0,.35)', 
        zIndex: 10000
      });
      document.body.appendChild(d);
    }
    d.innerHTML = msg + '<div style="opacity:.75;margin-top:6px">Добавьте запись в <code>' + _state.dataUrl + '</code> (обязательно «Модель вагона»).</div>';
    d.style.display = 'block';
    clearTimeout(d._t); 
    d._t = setTimeout(() => { 
      d.style.display = 'none'; 
    }, 4500);
  }

  function enhance(root){
    if (initialized.has(root)) return;
    initialized.add(root);
    
    log('=== Enhancing element ===', root);
    
    root.classList.add('wagon-root');
    const key = getKeyFromEl(root);
    log('Extracted key:', key);
    
    if (key) {
      const rec = getRecByKey(key);
      log('Found record:', rec);
      
      if (!rec){
        log('Record not found for key:', key);
        markMissing(root, key);
        root.addEventListener('mouseleave', hideTooltip);
        return;
      }
      
      applyBadges(root, rec);
      setIconByType(root, rec);
      
      // Tooltip events
      root.addEventListener('mouseenter', e => showTooltip(rec, e, root));
      root.addEventListener('mousemove', e => showTooltip(rec, e, root));
      root.addEventListener('mouseleave', hideTooltip);
      
      root.setAttribute('tabindex', '0');
      root.addEventListener('focus', e => showTooltip(rec, e, root));
      root.addEventListener('blur', hideTooltip);
    } else {
      log('No key extracted from element');
      markMissing(root, null);
    }
  }

  function scan(){
    const elements = document.querySelectorAll(_state.cellSelector);
    log('Found elements:', elements.length);
    elements.forEach(enhance);
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
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  WagonUI.init = async function init(options){
    Object.assign(_state, options || {});
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
