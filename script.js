/* Resistor Pro script: supports 4/5/6 band forward/reverse, live SVG color update, favorites, export */
const COLORS = [
  {name:'Black', value:0, multiplier:1, hex:'#000000'},
  {name:'Brown', value:1, multiplier:10, hex:'#8B4513'},
  {name:'Red', value:2, multiplier:100, hex:'#FF0000'},
  {name:'Orange', value:3, multiplier:1000, hex:'#FF8C00'},
  {name:'Yellow', value:4, multiplier:10000, hex:'#FFFF00'},
  {name:'Green', value:5, multiplier:100000, hex:'#008000'},
  {name:'Blue', value:6, multiplier:1000000, hex:'#0000FF'},
  {name:'Violet', value:7, multiplier:10000000, hex:'#8A2BE2'},
  {name:'Grey', value:8, multiplier:100000000, hex:'#808080'},
  {name:'White', value:9, multiplier:1000000000, hex:'#FFFFFF'},
  // multiplier colors beyond (gold, silver)
  {name:'Gold', value:null, multiplier:0.1, hex:'#D4AF37'},
  {name:'Silver', value:null, multiplier:0.01, hex:'#C0C0C0'}
];

const TOLERANCES = [
  {name:'Brown (±1%)', value:0.01, hex:'#8B4513'},
  {name:'Red (±2%)', value:0.02, hex:'#FF0000'},
  {name:'Green (±0.5%)', value:0.005, hex:'#008000'},
  {name:'Blue (±0.25%)', value:0.0025, hex:'#0000FF'},
  {name:'Violet (±0.1%)', value:0.001, hex:'#8A2BE2'},
  {name:'Grey (±0.05%)', value:0.0005, hex:'#808080'},
  {name:'Gold (±5%)', value:0.05, hex:'#D4AF37'},
  {name:'Silver (±10%)', value:0.1, hex:'#C0C0C0'}
];

const controlsArea = document.getElementById('controlsArea');
const calcBtn = document.getElementById('calcBtn');
const clearBtn = document.getElementById('clearBtn');
const resultValue = document.getElementById('resultValue');
const resultTolerance = document.getElementById('resultTolerance');
const resultRange = document.getElementById('resultRange');
const bandsGroup = document.getElementById('bandsGroup');
const darkToggle = document.getElementById('darkToggle');
const printBtn = document.getElementById('printBtn');
const favoritesEl = document.getElementById('favorites');
const saveFav = document.getElementById('saveFav');
const favName = document.getElementById('favName');
const clearFavs = document.getElementById('clearFavs');
const exportCSV = document.getElementById('exportCSV');
const copyBtn = document.getElementById('copyBtn');

let state = {
  mode: 'forward',
  bands: 4,
  selections: [], // will hold selected indexes / objects
  tolerance: TOLERANCES[6].name // default Gold
};

function init(){
  // attach listeners
  document.querySelectorAll('input[name="mode"]').forEach(r=>r.addEventListener('change', e=>{ state.mode = e.target.value; renderControls(); }));
  document.querySelectorAll('input[name="bands"]').forEach(r=>r.addEventListener('change', e=>{ state.bands = Number(e.target.value); renderControls(); }));
  calcBtn.addEventListener('click', onCalculate);
  clearBtn.addEventListener('click', onClear);
  darkToggle.addEventListener('change', onDarkToggle);
  printBtn.addEventListener('click', ()=>window.print());
  saveFav.addEventListener('click', saveFavorite);
  clearFavs.addEventListener('click', ()=>{ localStorage.removeItem('resistor_favs'); renderFavorites(); });
  exportCSV.addEventListener('click', exportFavoritesCSV);
  copyBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(resultValue.textContent || '').then(()=>alert('Copied')); });

  loadFavorites();
  renderControls();
  renderFavorites();
}

function renderControls(){
  controlsArea.innerHTML = '';
  state.selections = [];

  if(state.mode === 'forward'){
    // create selects for digits/mult/tolerance based on bands
    if(state.bands === 4){
      controlsArea.appendChild(makeSelect('Band A (1st digit)', true));
      controlsArea.appendChild(makeSelect('Band B (2nd digit)', true));
      controlsArea.appendChild(makeMultiplierSelect());
      controlsArea.appendChild(makeToleranceSelect());
    } else if(state.bands === 5){
      controlsArea.appendChild(makeSelect('Band A (1st digit)', true));
      controlsArea.appendChild(makeSelect('Band B (2nd digit)', true));
      controlsArea.appendChild(makeSelect('Band C (3rd digit)', true));
      controlsArea.appendChild(makeMultiplierSelect());
      controlsArea.appendChild(makeToleranceSelect());
    } else {
      // 6-band includes temperature coefficient (we'll use as small label)
      controlsArea.appendChild(makeSelect('Band A (1st digit)', true));
      controlsArea.appendChild(makeSelect('Band B (2nd digit)', true));
      controlsArea.appendChild(makeSelect('Band C (3rd digit)', true));
      controlsArea.appendChild(makeMultiplierSelect());
      controlsArea.appendChild(makeToleranceSelect());
      controlsArea.appendChild(makeTempcoSelect());
    }
  } else {
    // reverse mode: input ohms and tolerance
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `<input id="ohmInput" placeholder="Enter resistance (e.g., 4.7k, 10M, 330)" style="min-width:200px" />
                     <select id="revTolerance"></select>`;
    controlsArea.appendChild(div);
    const tol = document.getElementById('revTolerance');
    TOLERANCES.forEach(t=> { const o=document.createElement('option'); o.value=t.name; o.textContent=t.name; tol.appendChild(o); });
    document.getElementById('ohmInput').addEventListener('input', onReverseInput);
  }

  // attach change listeners for live update
  controlsArea.querySelectorAll('select').forEach(sel=>sel.addEventListener('change', onSelectionChange));
  updateResistorSVG();
}

function makeSelect(label, withNone){
  const wrap = document.createElement('div');
  wrap.innerHTML = `<label>${label}</label><select data-type="digit"></select>`;
  const sel = wrap.querySelector('select');
  COLORS.forEach((c,idx)=>{ const opt=document.createElement('option'); opt.value=idx; opt.textContent=c.name; sel.appendChild(opt); });
  return wrap;
}

function makeMultiplierSelect(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `<label>Multiplier</label><select data-type="mult"></select>`;
  const sel = wrap.querySelector('select');
  // add colors including gold/silver
  COLORS.forEach((c,idx)=>{ const opt=document.createElement('option'); opt.value=idx; opt.textContent=c.name; opt.dataset.mult=c.multiplier || ''; sel.appendChild(opt); });
  return wrap;
}

function makeToleranceSelect(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `<label>Tolerance</label><select id="tolSelect"></select>`;
  const sel = wrap.querySelector('select');
  TOLERANCES.forEach((t,idx)=>{ const opt=document.createElement('option'); opt.value=idx; opt.textContent=t.name; sel.appendChild(opt); });
  sel.value = 6;
  return wrap;
}

function makeTempcoSelect(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `<label>Temp. Coeff.</label><select data-type="tempco"><option value="100">100 ppm/K</option><option value="200">200 ppm/K</option><option value="250">250 ppm/K</option></select>`;
  return wrap;
}

function onSelectionChange(){
  // build selections array
  const selects = Array.from(controlsArea.querySelectorAll('select'));
  state.selections = selects.map(s=>{
    const type = s.dataset.type || (s.id==='tolSelect' ? 'tol' : 'other');
    return { type, value: s.value, idx: s.selectedIndex, dataset: {...s.dataset} };
  });
  updateResistorSVG();
  if(state.mode === 'forward'){
    computeForward();
  }
}

function computeForward(){
  try{
    const sels = state.selections;
    const digits = sels.filter(s=>s.type==='digit').map(s=>Number(s.value));
    const multSel = sels.find(s=>s.type==='mult');
    const tolSel = sels.find(s=>s.type==='tol');
    if(!multSel) return;
    const multiplier = Number(multSel.dataset.mult || COLORS[multSel.value].multiplier || 1);
    let value = 0;
    if(digits.length >= 2){
      value = digits.slice(0,3).reduce((acc,v,i)=> acc*10 + v, 0);
    }
    if(digits.length === 2) value = (digits[0]*10 + digits[1]);
    if(digits.length === 3) value = (digits[0]*100 + digits[1]*10 + digits[2]);
    const ohms = value * multiplier;
    showResult(ohms, TOLERANCES[tolSel.value]);
  }catch(e){
    console.error(e);
  }
}

function showResult(ohms, tol){
  resultValue.innerHTML = formatOhms(ohms);
  if(tol){
    resultTolerance.textContent = 'Tolerance: ' + (tol.name || '') ;
    const low = ohms * (1 - tol.value);
    const high = ohms * (1 + tol.value);
    resultRange.textContent = `Range: ${formatOhms(low)} — ${formatOhms(high)}`;
  } else {
    resultTolerance.textContent = 'Tolerance: —';
    resultRange.textContent = 'Range: —';
  }
}

function formatOhms(v){
  if(isNaN(v)) return '—';
  if(v >= 1e6) return (v/1e6).toFixed(3).replace(/\.?0+$/,'') + ' MΩ';
  if(v >= 1e3) return (v/1e3).toFixed(3).replace(/\.?0+$/,'') + ' kΩ';
  return v.toString() + ' Ω';
}

function onCalculate(){
  if(state.mode === 'forward') computeForward();
  else {
    const input = document.getElementById('ohmInput').value.trim();
    const tolIdx = document.getElementById('revTolerance').selectedIndex;
    const tol = TOLERANCES[tolIdx];
    const parsed = parseValue(input);
    if(parsed == null){ alert('Invalid value'); return; }
    const bands = state.bands;
    const resultBands = reverseCalc(parsed, bands, tol);
    applyBandsToControls(resultBands);
    updateResistorSVG();
    showResult(parsed, tol);
  }
}

function onClear(){
  renderControls();
  resultValue.textContent = '—';
  resultTolerance.textContent = 'Tolerance: —';
  resultRange.textContent = 'Range: —';
}

function onReverseInput(e){
  // live reverse preview
  const val = parseValue(e.target.value);
  if(val==null) return;
  const resultBands = reverseCalc(val, state.bands, TOLERANCES[6]);
  applyBandsToControls(resultBands);
  updateResistorSVG();
  showResult(val, TOLERANCES[6]);
}

function parseValue(str){
  if(!str) return null;
  str = str.toLowerCase().replace(/\s/g,'');
  const m = str.match(/^([0-9]*\.?[0-9]+)\s*([kKmM]?)/);
  if(!m) return null;
  let num = parseFloat(m[1]);
  const suffix = m[2].toLowerCase();
  if(suffix === 'k') num *= 1e3;
  if(suffix === 'm') num *= 1e6;
  return num;
}

function reverseCalc(ohms, bands, tol){
  // basic algorithm: for 4-band -> two digits + multiplier
  // for 5/6 -> three digits + multiplier
  let digitsNeeded = bands === 4 ? 2 : 3;
  // find multiplier as power of 10 to make digits integer with digitsNeeded
  let multiplierPow = 0;
  let base = ohms;
  while(base >= Math.pow(10, digitsNeeded)) { base = base / 10; multiplierPow++; }
  // round base to integer
  let intVal = Math.round(base * Math.pow(10, Math.max(0, digitsNeeded- (Math.floor(Math.log10(base))+1))));
  // simpler approach: compute digits by scaling
  let scaled = ohms;
  // try multipliers from -2 (0.01) to 9 (1G)
  for(let m=-2;m<=9;m++){
    const scale = Math.pow(10,m);
    const candidate = ohms / scale;
    const rounded = Math.round(candidate);
    const len = rounded.toString().length;
    if(len === digitsNeeded){
      // get digits
      const digits = String(rounded).padStart(digitsNeeded,'0').split('').map(Number);
      // find multiplier index based on m
      // multiplier value = scale
      const multiplier = Math.pow(10,m);
      // find closest multiplier color index
      let multIdx = COLORS.findIndex(c => (c.multiplier === multiplier));
      if(multIdx === -1){
        // allow gold/silver
        if(Math.abs(multiplier - 0.1) < 1e-9) multIdx = COLORS.findIndex(c=>c.name==='Gold');
        if(Math.abs(multiplier - 0.01) < 1e-9) multIdx = COLORS.findIndex(c=>c.name==='Silver');
      }
      if(multIdx !== -1){
        return { digits, multIdx, tolIdx: TOLERANCES.indexOf(tol) };
      }
    }
  }
  // fallback: use scientific approx
  const s = ohms.toExponential(digitsNeeded-1);
  const mant = parseFloat(s.split('e')[0]) * Math.pow(10, digitsNeeded-1);
  const rounded = Math.round(mant);
  const digits = String(rounded).split('').slice(0,digitsNeeded).map(Number);
  let exp = parseInt(s.split('e')[1]) - (digitsNeeded-1);
  let multIdx = COLORS.findIndex(c=>c.multiplier === Math.pow(10,exp));
  if(multIdx === -1) multIdx = COLORS.findIndex(c=>c.name==='Black');
  return { digits, multIdx, tolIdx: TOLERANCES.indexOf(tol) };
}

function applyBandsToControls(bandsObj){
  // set selects values in controls area if available
  const selects = Array.from(controlsArea.querySelectorAll('select'));
  if(!selects.length) return;
  // map digits
  let digitIdx = 0;
  for(const s of selects){
    if(s.dataset.type === 'digit'){
      s.selectedIndex = bandsObj.digits[digitIdx];
      digitIdx++;
    } else if(s.dataset.type === 'mult'){
      s.selectedIndex = bandsObj.multIdx;
    } else if(s.id === 'tolSelect'){
      s.selectedIndex = bandsObj.tolIdx || 6;
    }
  }
  // trigger change
  selects.forEach(s=>s.dispatchEvent(new Event('change')));
}

function updateResistorSVG(){
  // draw bands based on selections
  bandsGroup.innerHTML = '';
  const selects = Array.from(controlsArea.querySelectorAll('select'));
  const bandCount = state.bands;
  // compute band positions
  const startX = 160; const bandWidth = 16; const gap = 6;
  // place digits then multiplier then tolerance then tempco if present
  let order = [];
  selects.forEach(s=>{
    const type = s.dataset.type || (s.id==='tolSelect' ? 'tol' : 'other');
    order.push({ type, sel: s });
  });
  // mapping to positions
  let x = startX;
  order.forEach((o, idx)=>{
    const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', 42);
    rect.setAttribute('width', bandWidth);
    rect.setAttribute('height', 36);
    rect.setAttribute('rx', 4);
    let color = '#ddd';
    if(o.sel){
      const idx = Number(o.sel.value);
      if(o.sel.dataset.mult) {
        const c = COLORS[idx];
        color = c ? c.hex : '#ddd';
      } else if(o.sel.dataset.type==='digit' || o.sel.dataset.type==='tempco' || o.sel.id==='tolSelect'){
        const c = COLORS[idx];
        if(c) color = c.hex;
        if(o.sel.id==='tolSelect') {
          const t = TOLERANCES[o.sel.selectedIndex];
          color = t ? t.hex : color;
        }
      } else {
        const c = COLORS[idx];
        color = c ? c.hex : '#ddd';
      }
    }
    rect.setAttribute('fill', color);
    bandsGroup.appendChild(rect);
    x += bandWidth + gap;
  });
}

function loadFavorites(){
  const raw = localStorage.getItem('resistor_favs');
  if(!raw) return [];
  try{ return JSON.parse(raw); } catch { return []; }
}

function renderFavorites(){
  const favs = loadFavorites();
  favoritesEl.innerHTML = '';
  favs.forEach(f=>{
    const el = document.createElement('div');
    el.className = 'fav-item';
    el.innerHTML = `<div><strong>${f.name}</strong><div class="small">${f.value}</div></div><div style="display:flex;gap:6px"><button class="btn ghost" data-load="${f.data}">Load</button><button class="btn ghost" data-del="${f.data}">Del</button></div>`;
    favoritesEl.appendChild(el);
  });
  favoritesEl.querySelectorAll('button[data-load]').forEach(b=>{
    b.addEventListener('click', e=>{
      const raw = b.getAttribute('data-load');
      try{
        const obj = JSON.parse(raw);
        // set band selections: expects object {selections: [...]}
        applyBandsToControls(obj);
      }catch(e){ console.error(e); }
    });
  });
  favoritesEl.querySelectorAll('button[data-del]').forEach(b=>{
    b.addEventListener('click', e=>{
      const raw = b.getAttribute('data-del');
      const favs = loadFavorites().filter(x=>x.data !== raw);
      localStorage.setItem('resistor_favs', JSON.stringify(favs));
      renderFavorites();
    });
  });
}

function saveFavorite(){
  const name = (favName.value || '').trim();
  if(!name) return alert('Enter a name for favorite');
  // capture current controls state: selections
  const selects = Array.from(controlsArea.querySelectorAll('select'));
  const obj = { selections: selects.map(s=> ({ type: s.dataset.type || (s.id==='tolSelect'?'tol':'other'), value: s.value, selectedIndex: s.selectedIndex })), bands: state.bands, mode: state.mode, tol: selects.find(s=>s.id==='tolSelect')?.selectedIndex || 6 };
  const favs = loadFavorites();
  favs.unshift({ name, value: resultValue.textContent || '', data: JSON.stringify(obj) });
  localStorage.setItem('resistor_favs', JSON.stringify(favs));
  renderFavorites();
}

function exportFavoritesCSV(){
  const favs = loadFavorites();
  if(!favs.length) return alert('No favorites');
  const rows = favs.map(f=> [f.name, f.value, f.data].join(','));
  const csv = 'Name,Value,Data\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'resistor_favorites.csv'; a.click(); URL.revokeObjectURL(url);
}

function onDarkToggle(e){
  if(e.target.checked) document.body.classList.add('dark');
  else document.body.classList.remove('dark');
}

// initialize on DOM load
document.addEventListener('DOMContentLoaded', init);
