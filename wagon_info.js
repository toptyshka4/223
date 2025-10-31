// Pages-safe: относительные пути
const DATA_URL = './data/wagons_2000.json';
const YOUNG_YEAR_THRESHOLD = 2018;

const TYPE_TO_ASSET = {
  'одноэтажный': './assets/wagon_one.png',
  'двухэтажный': './assets/wagon_two.png'
};

const wagonsByNumber = new Map();
const wagonsById = new Map();

async function loadWagons(){
  const resp = await fetch(DATA_URL,{cache:'no-store'});
  if(!resp.ok) throw new Error('Не удалось загрузить базу вагонов');
  const data = await resp.json();
  data.forEach(r=>{wagonsById.set(String(r.id),r);wagonsByNumber.set(String(r.number),r)});
}

function notify(msg){
  let d=document.getElementById('wagon-notify');
  if(!d){d=document.createElement('div');d.id='wagon-notify';
    Object.assign(d.style,{position:'fixed',right:'16px',bottom:'16px',background:'#111',color:'#fff',padding:'12px',borderRadius:'8px',zIndex:10000,maxWidth:'360px',boxShadow:'0 10px 20px rgba(0,0,0,.35)'});
    document.body.appendChild(d);
  }
  d.innerHTML=msg+'<div style="opacity:.75;margin-top:6px">Добавьте этот вагон в <code>./data/wagons_2000.json</code> (обязательно поле «Тип»).</div>';
  d.style.display='block';clearTimeout(d._t);d._t=setTimeout(()=>d.style.display='none',4500);
}

function getRec(el){const id=el.dataset.wagonId,num=el.dataset.number;
  return (id&&wagonsById.get(id))||(num&&wagonsByNumber.get(num))||null;}

function clearBadges(root){ root.querySelectorAll(':scope > .badge').forEach(n=>n.remove()); }

function applyBadges(root,rec){
  clearBadges(root);
  if(Number(rec['Постройка'])>=YOUNG_YEAR_THRESHOLD){const s=document.createElement('div');s.className='badge star';s.textContent='★';root.appendChild(s);}
  if(String(rec['Переход']).toUpperCase()==='Х'){const x=document.createElement('div');x.className='badge huebner';x.textContent='Х';x.style.right='28px';root.appendChild(x);}
}

let tip;
function ensureTip(){ if(!tip){ tip=document.createElement('div'); tip.className='wagon-tooltip'; tip.style.display='none'; document.body.appendChild(tip); } }
function buildTip(rec){
  const rows=[['ЭЧТК',rec['ЭЧТК']],['УКВ',rec['УКВ']],['Кол-во мест',rec['Кол-во мест']],['Автосцепка',rec['Автосцепка']],['Переход',rec['Переход']],['Постройка',rec['Постройка']],['Тип',rec['Тип']]];
  let html=`<div class="title">Вагон №${rec.number}</div>`;
  for(const [k,v] of rows){ html+=`<div class="row"><div class="k">${k}</div><div class="v">${v}</div></div>`; }
  return html;
}
function showTip(rec,e,anchor){
  ensureTip(); tip.innerHTML=buildTip(rec); tip.style.display='block';
  const pad=10; let x=(e&&(e.clientX||e.pageX))||0, y=(e&&(e.clientY||e.pageY))||0;
  if(!x&&anchor){ const r=anchor.getBoundingClientRect(); x=r.right; y=r.top; }
  const tt=tip.getBoundingClientRect(); let l=x+16, t=y+16;
  if(l+tt.width>window.innerWidth-pad){ l=x-tt.width-16;} if(t+tt.height>window.innerHeight-pad){ t=y-tt.height-16;}
  tip.style.left=l+'px'; tip.style.top=t+'px';
}
function hideTip(){ if(tip) tip.style.display='none'; }

function setIcon(root,rec){
  const img=root.querySelector('img.wagon-img'); if(!img) return;
  const src=TYPE_TO_ASSET[String(rec['Тип']).toLowerCase()]; if(src) img.src=src;
}

function markMissing(root){
  root.classList.add('wagon-missing');
  root.addEventListener('mouseenter',()=>{
    notify('Вагон не найден в базе: '+(root.dataset.number||root.dataset.wagonId||'без номера'));
  },{once:true});
}

async function init(){
  try{
    await loadWagons();
    document.querySelectorAll('.wagon-root').forEach(root=>{
      const rec=getRec(root);
      if(!rec){ markMissing(root); root.addEventListener('mouseleave',hideTip); return; }
      applyBadges(root,rec); setIcon(root,rec);
      root.addEventListener('mouseenter',e=>showTip(rec,e,root));
      root.addEventListener('mousemove',e=>showTip(rec,e,root));
      root.addEventListener('mouseleave',hideTip);
      root.setAttribute('tabindex','0');
      root.addEventListener('focus',e=>showTip(rec,e,root));
      root.addEventListener('blur',hideTip);
    });
    console.log('Wagon UI ready');
  }catch(e){ console.error(e); }
}
document.addEventListener('DOMContentLoaded',init);
