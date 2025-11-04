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
    byNumber: new Map(), // ключ: нормализованный номер '########'
    byId: new Map(),
    loaded: false
  };

  let tooltipEl = null;
  let ctxMenuEl = null;
  let editorEl = null;
  let currentEditRoot = null;
  const initialized = new WeakSet();

  function log(){ if(_state.debug) console.log.apply(console, arguments); }

  // --- НОРМАЛИЗАЦИЯ НОМЕРА: всегда строка из 8 цифр (с ведущими нулями) ---
  function normalizeWagonNumber(input) {
    const digits = String(input ?? '').replace(/\D/g, '');
    const last8 = digits.slice(-8);
    return last8.padStart(8, '0');
  }

  async function loadData(){
    if (db.loaded) return;
    try {
      const resp = await fetch(_state.dataUrl, { cache: 'no-store' });
      if (!resp.ok) throw new Error('Не удалось загрузить базу вагонов: '+_state.dataUrl);
      const data = await resp.json();

      data.forEach(r => {
        if (r.id !== undefined && r.id !== null) db.byId.set(String(r.id), r);
        const rawNum = (r.number !== undefined ? r.number : r['Номер']);
        if (rawNum !== undefined) db.byNumber.set(normalizeWagonNumber(rawNum), r);
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
    const modelType = String(rec['Модель вагона'] || '').toLowerCase();
    const src = _state.typeToAsset[modelType];
    if (src) img.setAttribute('src', src);
    // По умолчанию оставляем «рабочую сторону налево» (никаких трансформаций)
    if (!root.dataset.wagonFlipped) applyFlipToRoot(root, false);
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
    d._t = setTimeout(() => { d.style.display = 'none'; }, 4500);
  }

  // =========================== КОНТЕКСТНОЕ МЕНЮ ===========================
  function ensureContextMenu(){
    if (ctxMenuEl) return;
    ctxMenuEl = document.createElement('div');
    ctxMenuEl.className = 'wagon-ctxmenu';
    Object.assign(ctxMenuEl.style, {
      position: 'fixed',
      left: '0', top: '0',
      display: 'none',
      background: '#1f1f1f',
      color: '#fff',
      borderRadius: '10px',
      boxShadow: '0 10px 20px rgba(0,0,0,.3)',
      minWidth: '200px',
      overflow: 'hidden',
      zIndex: 10001,
      font: '14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial',
      userSelect: 'none'
    });
    ctxMenuEl.innerHTML = `
      <button data-action="edit" style="display:block;width:100%;text-align:left;padding:10px 12px;background:none;border:0;color:#fff;cursor:pointer">Редактировать вагон</button>
    `;
    document.body.appendChild(ctxMenuEl);

    // скрытие меню
    document.addEventListener('click', ()=> ctxMenuEl.style.display = 'none');
    window.addEventListener('blur', ()=> ctxMenuEl.style.display = 'none');
    window.addEventListener('resize', ()=> ctxMenuEl.style.display = 'none');
  }

  function openContextMenu(evt, root){
    ensureContextMenu();
    evt.preventDefault();
    currentEditRoot = root;
    ctxMenuEl.style.display = 'block';
    const rect = ctxMenuEl.getBoundingClientRect();
    let x = evt.clientX, y = evt.clientY;
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;
    ctxMenuEl.style.left = x + 'px';
    ctxMenuEl.style.top = y + 'px';

    const editBtn = ctxMenuEl.querySelector('[data-action="edit"]');
    editBtn.onclick = () => {
      ctxMenuEl.style.display = 'none';
      openEditor(currentEditRoot);
    };
  }

  // ============================== РЕДАКТОР ===============================
  function ensureEditor(){
    if (editorEl) return;

    editorEl = document.createElement('div');
    editorEl.className = 'wagon-editor';
    Object.assign(editorEl.style, {
      position: 'fixed',
      left: '0', top: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,.5)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10002
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: 'min(560px, 92vw)',
      background: '#fff',
      borderRadius: '16px',
      boxShadow: '0 20px 40px rgba(0,0,0,.35)',
      padding: '16px'
    });

    panel.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:8px">
        <div style="font:600 16px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial">Редактировать вагон</div>
        <button data-close style="border:0;background:#eee;border-radius:10px;padding:8px 10px;cursor:pointer">×</button>
      </div>
      <div data-preview style="display:flex;align-items:center;justify-content:center;padding:12px;border:1px solid #eee;border-radius:12px;min-height:140px;overflow:hidden">
        <div style="opacity:.6">Превью изображения</div>
      </div>
      <div style="margin-top:12px;display:grid;gap:10px">
        <label style="display:grid;gap:6px">
          <span style="font-size:13px;color:#333">Пароль для переворота (введите <code>0000</code>):</span>
          <input type="password" data-pass placeholder="0000" style="padding:8px 10px;border:1px solid #ccc;border-radius:10px;font:14px system-ui,-apple-system,Segoe UI,Roboto,Arial">
          <div data-pass-hint style="font-size:12px;color:#888">Ползунок будет доступен после правильного пароля</div>
        </label>
        <label style="display:grid;gap:6px">
          <span style="font-size:13px;color:#333">Перевернуть по горизонтали</span>
          <input type="range" data-flip min="0" max="100" value="0" disabled>
          <div data-flip-state style="font-size:12px;color:#666">0 — обычно (рабочая сторона налево)</div>
        </label>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">
          <button data-reset style="border:0;background:#f2f2f2;border-radius:10px;padding:8px 12px;cursor:pointer">Сброс</button>
          <button data-apply style="border:0;background:#111;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer">Применить</button>
        </div>
      </div>
    `;

    editorEl.appendChild(panel);
    document.body.appendChild(editorEl);

    editorEl.querySelector('[data-close]').onclick = () => editorEl.style.display = 'none';

    // Логика пароля
    const passInput = editorEl.querySelector('[data-pass]');
    const passHint  = editorEl.querySelector('[data-pass-hint]');
    const flipRange = editorEl.querySelector('[data-flip]');
    const flipState = editorEl.querySelector('[data-flip-state]');

    passInput.addEventListener('input', () => {
      const ok = passInput.value === '0000';
      flipRange.disabled = !ok;
      passHint.textContent = ok ? 'Пароль верный — можно менять ползунок' : 'Ползунок будет доступен после правильного пароля';
      passHint.style.color = ok ? '#0a7' : '#888';
    });

    // Превью и применение scaleX
    flipRange.addEventListener('input', () => {
      const v = Number(flipRange.value);
      const flipped = v >= 50; // 0..49 — нормально, 50..100 — зеркально
      updatePreviewTransform(flipped);
      flipState.textContent = flipped ? '100 — зеркально (рабочая сторона направо)' : '0 — обычно (рабочая сторона налево)';
    });

    editorEl.querySelector('[data-reset]').onclick = () => {
      passInput.value = '';
      flipRange.value = 0;
      flipRange.disabled = true;
      passHint.textContent = 'Ползунок будет доступен после правильного пароля';
      passHint.style.color = '#888';
      updatePreviewTransform(false);
      flipState.textContent = '0 — обычно (рабочая сторона налево)';
    };

    editorEl.querySelector('[data-apply]').onclick = () => {
      if (!currentEditRoot) { editorEl.style.display = 'none'; return; }
      const v = Number(flipRange.value);
      const flipped = v >= 50;
      applyFlipToRoot(currentEditRoot, flipped);
      editorEl.style.display = 'none';
    };
  }

  function updatePreviewTransform(flipped){
    const prev = editorEl.querySelector('[data-preview]');
    const img = prev.querySelector('img');
    if (img) img.style.transform = flipped ? 'scaleX(-1)' : 'none';
  }

  function openEditor(root){
    ensureEditor();
    editorEl.style.display = 'flex';

    // Вставляем превью текущей картинки
    const prev = editorEl.querySelector('[data-preview]');
    prev.innerHTML = '';
    const img = (root && root.querySelector('img')) ? root.querySelector('img').cloneNode(true) : null;
    if (img) {
      Object.assign(img.style, { maxWidth: '100%', maxHeight: '220px', display: 'block' });
      prev.appendChild(img);
    } else {
      prev.innerHTML = '<div style="opacity:.6">Картинка не найдена</div>';
    }

    // Синхронизируем ползунок с текущим состоянием вагона
    const flipRange = editorEl.querySelector('[data-flip]');
    const flipState = editorEl.querySelector('[data-flip-state]');
    const passInput = editorEl.querySelector('[data-pass]');
    const passHint  = editorEl.querySelector('[data-pass-hint]');

    const isFlipped = !!(root && root.dataset.wagonFlipped === '1');
    flipRange.value = isFlipped ? 100 : 0;
    updatePreviewTransform(isFlipped);
    flipState.textContent = isFlipped ? '100 — зеркально (рабочая сторона направо)' : '0 — обычно (рабочая сторона налево)';

    // При открытии ползунок заблокирован, пока не введут пароль заново
    passInput.value = '';
    flipRange.disabled = true;
    passHint.textContent = 'Ползунок будет доступен после правильного пароля';
    passHint.style.color = '#888';
  }

  function applyFlipToRoot(root, flipped){
    // Сохраняем состояние на корневом элементе
    root.dataset.wagonFlipped = flipped ? '1' : '0';

    // Находим img внутри вагона и применяем трансформацию
    const img = root.querySelector('img');
    if (img) {
      img.style.transformOrigin = 'center';
      img.style.transform = flipped ? 'scaleX(-1)' : 'none';
    }
  }

  // ============================ ОСНОВНОЙ ФЛОУ ============================
  function enhance(root){
    if (initialized.has(root)) return;
    initialized.add(root);
    
    log('=== Enhancing element ===', root);
    root.classList.add('wagon-root');

    // контекстное меню на правый клик
    root.addEventListener('contextmenu', (e) => openContextMenu(e, root));

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

  function ensureScaffolding(){
    ensureContextMenu();
  }

  WagonUI.init = async function init(options){
    Object.assign(_state, options || {});
    await loadData();
    scan();
    observe();
    ensureScaffolding();
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
