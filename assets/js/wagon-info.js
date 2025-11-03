(function (global, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    module.exports = factory();
  } else {
    global.WagonInfo = factory();
  }
})(typeof window !== "undefined" ? window : this, function () {
  const DEFAULTS = {
    jsonUrl: "/wagons.json",
    selector: "[data-wagon-number]",
    numberAttr: "data-wagon-number",
    hydrateOnce: false,
    cacheBust: true,
    render: defaultRender,
    onMissing: defaultOnMissing
  };

  let _db = null;
  let _cfg = { ...DEFAULTS };
  let _observer = null;
  let _stylesInjected = false;

  const api = {
    async init(config = {}) {
      _cfg = { ...DEFAULTS, ...config };
      _db = await loadDb(_cfg.jsonUrl, _cfg.cacheBust);
      hydrateAll();
      
      if (!_cfg.hydrateOnce && typeof MutationObserver !== "undefined") {
        _observer = new MutationObserver(onDomChanged);
        _observer.observe(document.documentElement || document.body, {
          childList: true,
          subtree: true,
        });
      }
      return api;
    },

    get(number) {
      if (!_db) return null;
      const key = normalize(number);
      return _db[key] || null;
    },

    async reload() {
      _db = await loadDb(_cfg.jsonUrl, _cfg.cacheBust);
      hydrateAll();
      return api;
    },

    setRenderer(fn) {
      _cfg.render = typeof fn === "function" ? fn : defaultRender;
      hydrateAll();
      return api;
    },

    disconnect() {
      if (_observer) _observer.disconnect();
      _observer = null;
    },

    _debug() { 
      return { _db, _cfg, observing: !!_observer }; 
    }
  };

  async function loadDb(url, cacheBust) {
    const u = new URL(url, window.location.origin);
    if (cacheBust) u.searchParams.set("v", Date.now());
    const res = await fetch(u.toString(), { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`Не удалось загрузить справочник вагонов: ${res.status}`);
    const json = await res.json();
    const db = {};
    Object.keys(json || {}).forEach(k => { 
      db[normalize(k)] = json[k]; 
    });
    return db;
  }

  function normalize(n) { 
    return String(n || "").trim().replace(/\s+/g, "").replace(/^0+/, '');
  }

  function onDomChanged(mutations) {
    for (const m of mutations) {
      for (const node of m.addedNodes || []) {
        if (!(node instanceof HTMLElement)) continue;
        maybeHydrate(node);
        const nodes = node.querySelectorAll ? node.querySelectorAll(_cfg.selector) : [];
        nodes.forEach(maybeHydrate);
      }
    }
  }

  function hydrateAll() {
    const nodes = document.querySelectorAll(_cfg.selector);
    nodes.forEach(maybeHydrate);
  }

  function maybeHydrate(el) {
    if (!el || !(el instanceof HTMLElement)) return;
    const number = el.getAttribute(_cfg.numberAttr) || el.textContent;
    if (!number) return;
    const data = api.get(number);
    if (el.__wagonHydrated && el.__wagonHydrated === normalize(number)) return;
    el.__wagonHydrated = normalize(number);

    if (data) {
      _cfg.render(el, normalize(number), data);
      el.setAttribute("data-wagon-found", "true");
      el.removeAttribute("data-wagon-missing");
    } else {
      _cfg.onMissing(el, normalize(number));
      el.setAttribute("data-wagon-missing", "true");
      el.removeAttribute("data-wagon-found");
    }
  }

  function defaultRender(container, number, data) {
    container.classList.add("wagon-card");
    container.innerHTML = `
      <div class="wagon-card__inner">
        <div class="wagon-card__header">
          <span class="wagon-card__number">№ ${escapeHtml(number)}</span>
          <span class="wagon-card__type">${escapeHtml(data['Тип вагона'] || "—")}</span>
        </div>
        <dl class="wagon-card__props">
          <div><dt>Мест:</dt><dd>${numOrDash(data['Кол-во мест'])}</dd></div>
          <div><dt>ЭЧТК:</dt><dd>${yn(data['ЭЧТК'])}</dd></div>
          <div><dt>УКВ:</dt><dd>${yn(data['УКВ'])}</dd></div>
          <div><dt>Переход р/с:</dt><dd>${escapeHtml(data['Переход р/с'] || "—")}</dd></div>
          <div><dt>Переход н/с:</dt><dd>${escapeHtml(data['Переход н/с'] || "—")}</dd></div>
          <div><dt>Сцепка р/с:</dt><dd>${escapeHtml(data['Сцепка р/с'] || "—")}</dd></div>
          <div><dt>Сцепка н/с:</dt><dd>${escapeHtml(data['Сцепка н/с'] || "—")}</dd></div>
          <div><dt>Постройка:</dt><dd>${numOrDash(data['Постройка'])}</dd></div>
          <div><dt>Модель:</dt><dd>${escapeHtml(data['Модель вагона'] || "—")}</dd></div>
        </dl>
      </div>`;
    injectBaseStyles();
  }

  function defaultOnMissing(container, number) {
    container.classList.add("wagon-card", "wagon-card--missing");
    container.innerHTML = `
      <div class="wagon-card__inner">
        <div class="wagon-card__header">
          <span class="wagon-card__number">№ ${escapeHtml(number)}</span>
          <span class="wagon-card__type">Не найдено</span>
        </div>
        <p class="wagon-card__hint">Добавьте этот номер в базу данных</p>
      </div>`;
    injectBaseStyles();
  }

  function numOrDash(v) {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "—";
  }

  function yn(v) {
    const s = String(v || "").toLowerCase();
    if (["да", "yes", "true", "1"].includes(s)) return "да";
    if (["нет", "no", "false", "0", "нет данных"].includes(s)) return "нет";
    return "—";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
    }[c]));
  }

  function injectBaseStyles() {
    if (_stylesInjected) return;
    _stylesInjected = true;
    const css = `
      .wagon-card {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 12px;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0,0,0,.04);
        font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto;
        max-width: 320px;
      }
      .wagon-card--missing {
        background: #fff7f7;
        border-color: #ffd6d6;
      }
      .wagon-card__header {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
        font-weight: 600;
      }
      .wagon-card__number {
        opacity: .8;
      }
      .wagon-card__type {
        padding: 2px 8px;
        border-radius: 999px;
        background: #f3f4f6;
        font-weight: 600;
        font-size: 12px;
      }
      .wagon-card__props {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .wagon-card__props div {
        display: contents;
      }
      .wagon-card__props dt {
        color: #6b7280;
        font-size: 12px;
      }
      .wagon-card__props dd {
        margin: 0;
        font-weight: 500;
        font-size: 12px;
      }
      [data-wagon-missing="true"] {
        outline: 2px dashed #fca5a5;
      }
    `;
    const style = document.createElement("style");
    style.setAttribute("data-wagon-info-styles", "true");
    style.textContent = css;
    document.head.appendChild(style);
  }

  return api;
});
