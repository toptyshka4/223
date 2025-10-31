const DATA_URL = '/data/wagons_2000.json';
const YOUNG_YEAR_THRESHOLD = 2018;
const wagonsByNumber = new Map();
const wagonsById = new Map();
async function loadWagons() {
  const resp = await fetch(DATA_URL, { cache: 'no-store' });
  if (!resp.ok) throw new Error('Не удалось загрузить базу вагонов');
  const data = await resp.json();
  data.forEach(rec => {
    wagonsById.set(String(rec.id), rec);
    wagonsByNumber.set(String(rec.number), rec);
  });
}
function getWagonRecord(el) {
  const id = el.getAttribute('data-wagon-id');
  const num = el.getAttribute('data-number');
  if (id && wagonsById.has(id)) return wagonsById.get(id);
  if (num && wagonsByNumber.has(num)) return wagonsByNumber.get(num);
  return null;
}
function applyBadges(el, rec) {
  const isYoung = Number(rec['Постройка']) >= YOUNG_YEAR_THRESHOLD;
  const hasHuebner = String(rec['Переход']).toUpperCase() === 'Х';
  el.querySelectorAll('.badge').forEach(n => n.remove());
  if (isYoung) {
    const s=document.createElement('div'); s.className='badge star'; s.textContent='★'; el.appendChild(s);
  }
  if (hasHuebner) {
    const h=document.createElement('div'); h.className='badge huebner'; h.textContent='Х'; el.appendChild(h);
  }
}
function buildTooltipHTML(rec) {
  const rows=[['ЭЧТК',rec['ЭЧТК']],['УКВ',rec['УКВ']],['Кол-во мест',rec['Кол-во мест']],['Автосцепка',rec['Автосцепка']],['Переход',rec['Переход']],['Постройка',rec['Постройка']],['Тип',rec['Тип']]];
  let html=`<div class="title">Вагон №${rec.number}</div>`;
  for(const [k,v] of rows){html+=`<div class="row"><div class="k">${k}</div><div class="v">${v}</div></div>`;}
  return html;
}
const tooltipEl=document.createElement('div');
tooltipEl.className='wagon-tooltip';
tooltipEl.id='wagon-tooltip';
tooltipEl.style.display='none';
document.body.appendChild(tooltipEl);
function showTooltip(el,rec,evt){tooltipEl.innerHTML=buildTooltipHTML(rec);tooltipEl.style.display='block';positionTooltip(evt);}
function hideTooltip(){tooltipEl.style.display='none';}
function positionTooltip(evt){const pad=10;const{x,y}=evt;const tt=tooltipEl.getBoundingClientRect();let l=x+16,t=y+16;if(l+tt.width>window.innerWidth-pad){l=x-tt.width-16;}if(t+tt.height>window.innerHeight-pad){t=y-tt.height-16;}tooltipEl.style.left=l+'px';tooltipEl.style.top=t+'px';}
function wireHoverHandlers(){document.querySelectorAll('.wagon').forEach(el=>{let rec=null;el.addEventListener('mouseenter',e=>{rec=getWagonRecord(el);if(!rec)return;applyBadges(el,rec);showTooltip(el,rec,e);});el.addEventListener('mousemove',positionTooltip);el.addEventListener('mouseleave',hideTooltip);});}
(async function(){await loadWagons();wireHoverHandlers();document.querySelectorAll('.wagon').forEach(el=>{const r=getWagonRecord(el);if(r)applyBadges(el,r);});console.log('Wagon hover ready');})();