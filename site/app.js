'use strict';
const SPECIES = { Geranium:'drought', Petunia:'thirsty', Surfinia:'thirsty', Tomato:'thirsty', Basil:'thirsty', Strawberry:'thirsty', Mint:'thirsty', Lobelia:'thirsty', Fuchsia:'moderate', Begonia:'moderate', Marigold:'moderate', Verbena:'moderate', 'Mixed flowers':'moderate', Lavender:'drought', Rosemary:'drought', Thyme:'drought', Succulents:'drought', Other:'moderate' };
const THIRST = { thirsty:{l:'thirsty',m:-1}, moderate:{l:'average thirst',m:0}, drought:{l:'drought-tolerant',m:1} };
const SUN = { full:{l:'Full sun',m:-0.5}, partial:{l:'Part sun',m:0}, shade:{l:'Shade',m:0.5} };
const SIZE = { 50:{l:'50 cm',m:-0.5}, 80:{l:'80 cm',m:0}, 100:{l:'100 cm',m:0.5} };
const C = { water:'oklch(0.5 0.11 240)', dry:'oklch(0.5 0.11 65)', check:'oklch(0.5 0.11 150)' };
const T = { water:'oklch(0.94 0.035 240)', dry:'oklch(0.94 0.035 65)', check:'oklch(0.94 0.035 150)' };
const KEY = 'balconera-app-v1';
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DOWL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const pad = n => String(n).padStart(2,'0');
const iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parse = s => new Date(s + 'T12:00:00');
const add = (s, n) => { const d = parse(s); d.setDate(d.getDate()+n); return iso(d); };
const diff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const fmt = s => { const d = parse(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const ago = n => n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
const until = (s, t) => { const n = diff(t, s); return n <= 0 ? 'today' : n === 1 ? 'tomorrow' : n < 7 ? `on ${DOWL[parse(s).getDay()]}` : `on ${fmt(s)}`; };
const deg = v => v == null ? '–' : `${Math.round(v)}°`;
const WMO = c => c === 0 ? 'Clear' : c <= 2 ? 'Partly cloudy' : c === 3 ? 'Overcast' : c <= 48 ? 'Fog' : c <= 57 ? 'Drizzle' : c <= 67 ? 'Rain' : c <= 77 ? 'Snow' : c <= 82 ? 'Showers' : 'Thunderstorm';
const band = t => t >= 28 ? {b:0,l:'skip',k:'water'} : t >= 23 ? {b:1,l:'1 day',k:'dry'} : t >= 16 ? {b:2,l:'2 days',k:'dry'} : {b:3,l:'3 days',k:'check'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function seed() {
  const t = iso();
  const mk = (id, name, location, species, sun, size, minAgo, wAgo) => {
    const h = [{t:'water', d:add(t,-wAgo)}, {t:'min', d:add(t,-(wAgo+2))}, {t:'water', d:add(t,-(wAgo+9))}, {t:'min', d:add(t,-(wAgo+11))}];
    if (minAgo != null) h.unshift({t:'min', d:add(t,-minAgo)});
    return { id, name, location, species, sun, size, minAt: minAgo == null ? null : add(t,-minAgo), wateredAt: add(t,-wAgo), history: h };
  };
  return [
    mk('p1','Railing left','South balcony','Geranium','full',80,1,8),
    mk('p2','Railing right','South balcony','Petunia','full',80,2,7),
    mk('p3','Kitchen sill','Kitchen window','Basil','partial',50,null,4),
    mk('p4','Corner box','South balcony','Lavender','full',50,null,6),
    mk('p5','North rail','Bedroom balcony','Begonia','shade',80,0,9),
    mk('p6','Herb rail','South balcony','Rosemary','full',50,null,3),
    mk('p7','Berry box','Bedroom balcony','Strawberry','partial',80,1,6),
    mk('p8','Door planter','Bedroom balcony','Fuchsia','shade',100,null,2),
  ];
}
function mockWx() {
  const t = iso(), highs = [21,23,24,20,18,19,22], lows = [12,13,14,12,10,11,12], codes = [2,1,0,3,61,2,1];
  return { live:false, current:19, code:2, daily: highs.map((h,i) => ({date:add(t,i), max:h, min:lows[i], code:codes[i], rain: codes[i]===61?4.2:0})) };
}
const emptyForm = () => ({ name:'', location:'', species:'Geranium', sun:'full', size:80 });

// ---------------------------------------------------------------- state
let saved = null;
try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
const state = {
  planters: saved?.planters ?? seed(),
  settings: saved?.settings ?? { city:'Berlin', region:'Germany', lat:52.52, lon:13.41, notify:true, includeCheck:true, remindTime:'08:00', lastReminded:null },
  wx: saved?.wx ?? { loading:true, daily:[] },
  tab:'today', detailId:null, sheet:null, form:emptyForm(), editId:null,
  toast:null, cityInput:'', cityResults:[], cityMsg:'',
};
let toastT;
function persist() { try { localStorage.setItem(KEY, JSON.stringify({ planters:state.planters, settings:state.settings, wx:state.wx })); } catch (e) {} }
function set(patch) { Object.assign(state, patch); persist(); render(); }
function setState(patch) { Object.assign(state, patch); render(); }

// ---------------------------------------------------------------- weather
async function loadWx() {
  const { lat, lon } = state.settings;
  setState({ wx: { ...state.wx, loading:true } });
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=7`);
    const j = await r.json();
    const D = j.daily;
    set({ wx: { live:true, at:Date.now(), current:j.current.temperature_2m, code:j.current.weather_code,
      daily: D.time.map((d,i) => ({ date:d, max:D.temperature_2m_max[i], min:D.temperature_2m_min[i], code:D.weather_code[i], rain:D.precipitation_sum[i] })) } });
  } catch (e) { setState({ wx: { ...mockWx(), error:true } }); }
}
async function searchCity() {
  const q = state.cityInput.trim(); if (!q) return;
  setState({ cityMsg:'Searching…', cityResults:[] });
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5`);
    const j = await r.json();
    const res = (j.results || []).map(c => ({ name:c.name, region:[c.admin1, c.country].filter(Boolean).join(', '), lat:c.latitude, lon:c.longitude }));
    setState({ cityResults:res, cityMsg: res.length ? '' : 'No matches.' });
  } catch (e) { setState({ cityMsg:'Search unavailable offline.' }); }
}
function pickCity(c) {
  set({ settings:{ ...state.settings, city:c.name, region:c.region, lat:c.lat, lon:c.lon }, cityResults:[], cityInput:'', cityMsg:`Weather now uses ${c.name}.` });
  setTimeout(loadWx, 0);
}

// ---------------------------------------------------------------- dry-phase rule
function avgHigh() { const d = (state.wx.daily || []).slice(0,3); return d.length ? d.reduce((a,x) => a + x.max, 0) / d.length : 20; }
function plan(p, avg = avgHigh()) {
  const tk = SPECIES[p.species] || 'moderate', th = THIRST[tk], bd = band(avg);
  const raw = bd.b + th.m + SUN[p.sun].m + SIZE[p.size].m;
  const days = bd.b === 0 ? (tk === 'drought' ? 1 : 0) : Math.min(4, Math.max(1, Math.round(raw)));
  const sg = m => m === 0 ? '±0' : (m > 0 ? '+' : '−') + Math.abs(m);
  const rows = [
    { label:`Avg high ${deg(avg)} next 3 days`, val: bd.b === 0 ? 'hot: skip' : `${bd.b} d base` },
    { label:`${p.species} · ${th.l}`, val:sg(th.m) },
    { label:SUN[p.sun].l, val:sg(SUN[p.sun].m) },
    { label:`${SIZE[p.size].l} planter`, val:sg(SIZE[p.size].m) },
  ];
  return { days, rows, total: days === 0 ? 'none' : days === 1 ? '1 day' : `${days} days` };
}
function view(p, today) {
  const pl = plan(p);
  const v = { id:p.id, name:p.name, meta:`${p.species} · ${p.location || SUN[p.sun].l}`, plan:pl, p };
  if (p.minAt) {
    const el = diff(p.minAt, today), on = add(p.minAt, pl.days), left = diff(today, on);
    v.waterOn = on;
    if (left <= 0) {
      Object.assign(v, { status:'water', statusLabel:'Water now', gauge:'0%',
        line: pl.days === 0 ? `At min ${ago(el)} · warm spell, no dry phase` : `Dry phase over · at min ${ago(el)}`,
        short:'Water today', instruction:'Refill the reservoir to max through the water shaft.' });
    } else {
      Object.assign(v, { status:'dry', statusLabel:'Dry phase', gauge:'0%', line:`At min ${ago(el)} · water ${until(on, today)}`,
        short:`Water ${until(on, today)}`, badge: left === 1 ? '1 day' : `${left} days`, instruction:`Leave it. Water ${until(on, today)}.` });
    }
  } else {
    const sw = p.wateredAt ? diff(p.wateredAt, today) : null;
    Object.assign(v, { status:'check', statusLabel:'Check gauge', gauge: sw == null ? '50%' : `${Math.max(28, 90 - sw * 9)}%`,
      line: sw == null ? 'Look at the water level indicator' : `Refilled ${ago(sw)} · look at the gauge`,
      short:'Check gauge', sw: sw ?? 99, instruction:'Look at the water level indicator. Does it read min?' });
  }
  v.tone = C[v.status]; v.tint = T[v.status];
  v.hasAction = v.status !== 'dry'; v.hasBadge = v.status === 'dry';
  v.actionLabel = v.status === 'water' ? 'Refilled' : 'At min';
  v.btnBg = v.status === 'water' ? C.water : 'transparent';
  v.btnFg = v.status === 'water' ? '#FDFCF8' : C.check;
  v.btnBd = v.status === 'water' ? C.water : C.check;
  return v;
}

// ---------------------------------------------------------------- actions
const snapshot = () => JSON.parse(JSON.stringify(state.planters));
function toast(msg, prev) { clearTimeout(toastT); setState({ toast:{ msg, prev } }); toastT = setTimeout(() => setState({ toast:null }), 4500); }
function update(id, fn) { set({ planters: state.planters.map(p => p.id === id ? fn(p) : p) }); }
function water(id) {
  const prev = snapshot(), t = iso(), p = state.planters.find(x => x.id === id);
  update(id, p => ({ ...p, minAt:null, wateredAt:t, history:[{t:'water', d:t}, ...p.history] }));
  toast(`${p.name} refilled to max`, prev);
}
function markMin(id, daysAgo) {
  const prev = snapshot(), d = add(iso(), -daysAgo), p = state.planters.find(x => x.id === id);
  update(id, p => ({ ...p, minAt:d, history:[{t:'min', d}, ...p.history] }));
  setState({ sheet:null });
  toast(`${p.name}: dry phase started`, prev);
}
function clearMin(id) {
  const prev = snapshot();
  update(id, p => { const h = [...p.history]; const i = h.findIndex(e => e.t === 'min' && e.d === p.minAt); if (i >= 0) h.splice(i,1); return { ...p, minAt:null, history:h }; });
  toast('Min mark removed', prev);
}
const openMin = id => setState({ sheet:{ type:'min', id } });
function openForm(editId) {
  const p = editId && state.planters.find(x => x.id === editId);
  setState({ sheet:{ type:'form' }, editId: editId || null, form: p ? { name:p.name, location:p.location, species:p.species, sun:p.sun, size:p.size } : emptyForm() });
}
function saveForm() {
  const f = state.form; if (!f.name.trim()) return;
  if (state.editId) update(state.editId, p => ({ ...p, ...f, name:f.name.trim() }));
  else set({ planters:[...state.planters, { id:'p' + Date.now(), ...f, name:f.name.trim(), minAt:null, wateredAt:null, history:[] }] });
  setState({ sheet:null });
}
function remove(id) {
  const prev = snapshot(), p = state.planters.find(x => x.id === id);
  set({ planters: state.planters.filter(x => x.id !== id), detailId:null });
  toast(`${p.name} removed`, prev);
}

// ---------------------------------------------------------------- render
const $ = id => document.getElementById(id);
const legend = `<div style="display:flex;flex-wrap:wrap;gap:14px;padding:12px 14px;font-size:12px;color:#5C635D;">
  <div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;border-radius:50%;background:oklch(0.5 0.11 240);"></div>Water</div>
  <div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;border-radius:50%;background:oklch(0.93 0.04 65);border:2px solid oklch(0.5 0.11 65);"></div>Dry phase</div>
  <div style="display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;border-radius:50%;border:2px solid oklch(0.5 0.11 150);"></div>Check gauge</div>
</div>`;

function planterRow(p) {
  return `<div data-act="open" data-id="${esc(p.id)}" style="display:flex;align-items:center;gap:14px;padding:12px 12px 12px 14px;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;cursor:pointer;">
    <div style="position:relative;width:10px;height:40px;border-radius:5px;background:#ECE9E0;overflow:hidden;flex-shrink:0;border:1px solid #DDD9CE;">
      <div style="position:absolute;left:0;right:0;bottom:0;height:${p.gauge};background:oklch(0.62 0.1 240);"></div>
      <div style="position:absolute;left:0;right:0;bottom:22%;height:1px;background:#8E948E;"></div>
    </div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
      <div style="font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
      <div style="font-size:13px;color:#5C635D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.meta)}</div>
      <div style="font-size:13px;color:${p.tone};font-weight:500;">${esc(p.line)}</div>
    </div>
    ${p.hasAction ? `<button data-act="action" data-id="${esc(p.id)}" style="flex-shrink:0;min-height:40px;padding:0 14px;border-radius:20px;border:1.5px solid ${p.btnBd};background:${p.btnBg};color:${p.btnFg};font-size:14px;font-weight:600;cursor:pointer;">${p.actionLabel}</button>` : ''}
    ${p.hasBadge ? `<div style="flex-shrink:0;padding:6px 10px;border-radius:12px;background:${p.tint};color:${p.tone};font-size:13px;font-weight:600;font-family:'IBM Plex Mono',monospace;">${p.badge}</div>` : ''}
  </div>`;
}

function renderToday(m) {
  const { vs, water, dry, check, avg, bd, wx, t } = m, s = state, now = new Date();
  const headline = !vs.length ? 'Your balcony' : water.length ? `${water.length} to water today` : check.length ? `${check.length} to check` : 'All resting';
  const subParts = [];
  if (water.length && check.length) subParts.push(`${check.length} to check`);
  if (dry.length) subParts.push(`${dry.length} in dry phase`);
  if (!water.length && !check.length && vs.length) subParts.push('Nothing to do today');
  const nowTemp = wx.loading && wx.current == null ? '…' : deg(wx.current);
  const wxRule = bd.b === 0 ? 'Hot: skip the dry phase, water at min' : `Base dry phase ${bd.l} after min`;
  let html = `<div style="padding:8px 20px 28px;display:flex;flex-direction:column;gap:18px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
    <div style="display:flex;flex-direction:column;gap:4px;min-width:0;">
      <div style="font-size:13px;color:#5C635D;font-weight:500;">${DOWL[now.getDay()]}, ${now.getDate()} ${MONL[now.getMonth()]}</div>
      <div style="font-size:28px;line-height:1.1;font-weight:700;letter-spacing:-0.02em;text-wrap:pretty;">${headline}</div>
      <div style="font-size:14px;color:#5C635D;">${subParts.join(' · ')}</div>
    </div>
    <button data-act="add" style="flex-shrink:0;height:40px;padding:0 14px;border-radius:20px;border:1px solid #D9D5CA;background:#FDFCF8;font-size:14px;font-weight:600;color:#1E2520;cursor:pointer;">+ Planter</button>
  </div>
  <button data-act="tab" data-tab="weather" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:none;background:#EBE8DF;text-align:left;cursor:pointer;color:#1E2520;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:500;">${nowTemp}</div>
    <div style="display:flex;flex-direction:column;gap:1px;min-width:0;">
      <div style="font-size:14px;font-weight:600;">${esc(s.settings.city)} · highs around ${deg(avg)}</div>
      <div style="font-size:13px;color:#5C635D;">${wxRule}</div>
    </div>
  </button>`;
  if (!vs.length) {
    html += `<div style="padding:32px 20px;border:1.5px dashed #D2CEC2;border-radius:16px;text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center;">
      <div style="font-size:16px;font-weight:600;">No planters yet</div>
      <div style="font-size:14px;color:#5C635D;">Add your first planter and I'll track its dry phase.</div>
      <button data-act="add" style="height:44px;padding:0 18px;border-radius:22px;border:none;background:#1E2520;color:#F5F3EC;font-size:15px;font-weight:600;cursor:pointer;">Add planter</button>
    </div>`;
  } else {
    const groups = [
      { title:'Water now', tone:C.water, items:water, note:'Refill to max' },
      { title:'Check gauge', tone:C.check, items:check, note:'Tap At min when it reads min' },
      { title:'Dry phase', tone:C.dry, items:dry, note:"Don't water yet" },
    ].filter(g => g.items.length);
    const days = [0,1,2,3,4].map(i => { const dd = add(t,i), w = (wx.daily || []).find(x => x.date === dd); return { dow: i === 0 ? 'Today' : DOW[parse(dd).getDay()], temp: w ? deg(w.max) : '', color: i === 0 ? '#1E2520' : '#5C635D' }; });
    const rows = [...water, ...dry, ...check].map(v => ({ id:v.id, name:v.name, short:v.short, tone:v.tone,
      cells: [0,1,2,3,4].map(i => {
        const dd = add(t,i);
        if ((v.status === 'water' && i === 0) || (v.status === 'dry' && dd === v.waterOn)) return { bg:C.water, bd:C.water, size:'22px' };
        if (v.status === 'dry' && dd < v.waterOn) return { bg:'oklch(0.93 0.04 65)', bd:C.dry, size:'16px' };
        if (v.status === 'check' && i === 0) return { bg:'transparent', bd:C.check, size:'20px' };
        return { bg:'#E5E1D6', bd:'#E5E1D6', size:'6px' };
      }) }));
    const grid = 'display:grid;grid-template-columns:minmax(0,1fr) repeat(5,34px);gap:4px;';
    html += `<div style="display:flex;flex-direction:column;gap:22px;">
      ${groups.map(g => `<div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:baseline;gap:8px;padding:0 2px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${g.tone};align-self:center;"></div>
          <div style="font-size:15px;font-weight:700;">${g.title}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#5C635D;">${g.items.length}</div>
          <div style="margin-left:auto;font-size:12px;color:#5C635D;">${g.note}</div>
        </div>
        ${g.items.map(planterRow).join('')}
      </div>`).join('')}
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="font-size:15px;font-weight:700;padding:0 2px;">Coming up</div>
        <div style="display:flex;flex-direction:column;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;overflow:hidden;">
          <div style="${grid}padding:12px 12px 10px 14px;border-bottom:1px solid #E5E1D6;align-items:end;">
            <div style="font-size:12px;color:#5C635D;font-weight:600;">Next 5 days</div>
            ${days.map(d => `<div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
              <div style="font-size:11px;font-weight:700;color:${d.color};">${d.dow}</div>
              <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5C635D;">${d.temp}</div>
            </div>`).join('')}
          </div>
          ${rows.map(r => `<div data-act="open" data-id="${esc(r.id)}" style="${grid}padding:10px 12px 10px 14px;border-bottom:1px solid #EEEBE3;align-items:center;cursor:pointer;">
            <div style="min-width:0;display:flex;flex-direction:column;gap:1px;">
              <div style="font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.name)}</div>
              <div style="font-size:12px;color:${r.tone};font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.short)}</div>
            </div>
            ${r.cells.map(c => `<div style="display:flex;justify-content:center;"><div style="width:${c.size};height:${c.size};border-radius:50%;background:${c.bg};border:2px solid ${c.bd};"></div></div>`).join('')}
          </div>`).join('')}
          ${legend}
        </div>
      </div>
    </div>`;
  }
  return html + '</div>';
}

function renderDetail(v) {
  const p = v.p;
  const chips = [p.species, THIRST[SPECIES[p.species] || 'moderate'].l, SUN[p.sun].l, SIZE[p.size].l, p.location].filter(Boolean);
  const canMin = v.status === 'check', canClear = !!p.minAt;
  const waterLabel = v.status === 'dry' ? 'Refilled early anyway' : 'Refilled to max';
  const waterBg = v.status === 'water' ? C.water : 'transparent', waterFg = v.status === 'water' ? '#FDFCF8' : C.water;
  const hist = p.history.slice(0,12).map(h => ({ label: h.t === 'min' ? 'Gauge hit min' : 'Refilled to max', date: fmt(h.d), tone: h.t === 'min' ? C.dry : C.water }));
  return `<div style="padding:4px 20px 28px;display:flex;flex-direction:column;gap:16px;">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <button data-act="back" style="height:40px;padding:0 14px 0 10px;border-radius:20px;border:1px solid #D9D5CA;background:#FDFCF8;font-size:14px;font-weight:600;color:#1E2520;cursor:pointer;">‹ Back</button>
    <button data-act="edit" data-id="${esc(p.id)}" style="height:40px;padding:0 14px;border-radius:20px;border:none;background:transparent;font-size:14px;font-weight:600;color:#1E2520;cursor:pointer;">Edit</button>
  </div>
  <div style="display:flex;flex-direction:column;gap:6px;">
    <div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1.1;">${esc(v.name)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${chips.map(c => `<div style="padding:5px 10px;border-radius:12px;background:#EBE8DF;font-size:13px;font-weight:500;">${esc(c)}</div>`).join('')}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:14px;padding:18px;border-radius:20px;background:${v.tint};">
    <div style="display:flex;gap:16px;align-items:center;">
      <div style="position:relative;width:22px;height:72px;border-radius:11px;background:#FDFCF8;overflow:hidden;border:1.5px solid #CFCBBF;flex-shrink:0;">
        <div style="position:absolute;left:0;right:0;bottom:0;height:${v.gauge};background:oklch(0.62 0.1 240);"></div>
        <div style="position:absolute;left:0;right:0;bottom:22%;height:1.5px;background:#6F766F;"></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;">
        <div style="font-size:13px;font-weight:700;color:${v.tone};">${v.statusLabel}</div>
        <div style="font-size:17px;font-weight:600;text-wrap:pretty;">${esc(v.instruction)}</div>
        <div style="font-size:13px;color:#5C635D;">${esc(v.line)}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${canMin ? `<button data-act="min" data-id="${esc(p.id)}" style="height:48px;border-radius:24px;border:none;background:oklch(0.5 0.11 150);color:#FDFCF8;font-size:15px;font-weight:700;cursor:pointer;">Gauge is at min</button>` : ''}
      <button data-act="water" data-id="${esc(p.id)}" style="height:48px;border-radius:24px;border:1.5px solid oklch(0.5 0.11 240);background:${waterBg};color:${waterFg};font-size:15px;font-weight:700;cursor:pointer;">${waterLabel}</button>
      ${canClear ? `<button data-act="clear" data-id="${esc(p.id)}" style="height:40px;border-radius:20px;border:none;background:transparent;color:#5C635D;font-size:14px;font-weight:600;cursor:pointer;">Not at min after all</button>` : ''}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;">
    <div style="padding:14px 16px 6px;font-size:15px;font-weight:700;">How long it stays at min</div>
    ${v.plan.rows.map(r => `<div style="display:flex;justify-content:space-between;gap:12px;padding:9px 16px;border-top:1px solid #EEEBE3;font-size:14px;">
      <div style="color:#3E453F;">${esc(r.label)}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;white-space:nowrap;">${esc(r.val)}</div>
    </div>`).join('')}
    <div style="display:flex;justify-content:space-between;gap:12px;padding:12px 16px;border-top:1.5px solid #D9D5CA;font-size:15px;font-weight:700;">
      <div>Dry phase</div>
      <div style="font-family:'IBM Plex Mono',monospace;">${v.plan.total}</div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;">
    <div style="padding:14px 16px 6px;font-size:15px;font-weight:700;">History</div>
    ${hist.map(h => `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid #EEEBE3;font-size:14px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${h.tone};"></div>
      <div style="flex:1;">${h.label}</div>
      <div style="color:#5C635D;font-size:13px;">${h.date}</div>
    </div>`).join('')}
    ${p.history.length ? '' : '<div style="padding:10px 16px 14px;font-size:14px;color:#5C635D;">Nothing logged yet.</div>'}
  </div>
  <button data-act="delete" data-id="${esc(p.id)}" style="height:44px;border-radius:22px;border:none;background:transparent;color:oklch(0.5 0.13 25);font-size:14px;font-weight:600;cursor:pointer;">Remove planter</button>
</div>`;
}

function renderWeather(m) {
  const { wx, bd } = m, s = state;
  const nowTemp = wx.loading && wx.current == null ? '…' : deg(wx.current);
  const wxRule = bd.b === 0 ? 'Hot: skip the dry phase, water at min' : `Base dry phase ${bd.l} after min`;
  const source = wx.loading ? 'Updating forecast…' : wx.live ? `Live forecast · ${s.settings.region || ''}` : 'Offline: sample forecast';
  const days = (wx.daily || []).map((w, i) => { const b = band(w.max); return { dow: i === 0 ? 'Today' : DOW[parse(w.date).getDay()], label: WMO(w.code) + (w.rain > 0.2 ? ` · ${w.rain.toFixed(1)} mm` : ''), min:deg(w.min), max:deg(w.max), band:b.l, tone:C[b.k], tint:T[b.k] }; });
  return `<div style="padding:8px 20px 28px;display:flex;flex-direction:column;gap:18px;">
  <div style="display:flex;flex-direction:column;gap:4px;">
    <div style="font-size:13px;color:#5C635D;font-weight:500;">${esc(source)}</div>
    <div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;">${esc(s.settings.city)}</div>
  </div>
  <div style="display:flex;align-items:center;gap:16px;padding:18px;border-radius:20px;background:#EBE8DF;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:44px;font-weight:500;line-height:1;">${nowTemp}</div>
    <div style="display:flex;flex-direction:column;gap:2px;">
      <div style="font-size:16px;font-weight:600;">${wx.code != null ? WMO(wx.code) : ''}</div>
      <div style="font-size:13px;color:#5C635D;">${wxRule}</div>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;">
    ${days.map(w => `<div style="display:grid;grid-template-columns:52px minmax(0,1fr) auto auto;gap:10px;align-items:center;padding:11px 14px;border-bottom:1px solid #EEEBE3;">
      <div style="font-size:14px;font-weight:700;">${w.dow}</div>
      <div style="font-size:13px;color:#5C635D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${w.label}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;"><span style="color:#5C635D;">${w.min}</span> ${w.max}</div>
      <div style="padding:3px 8px;border-radius:10px;background:${w.tint};color:${w.tone};font-size:12px;font-weight:600;min-width:52px;text-align:center;">${w.band}</div>
    </div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;padding:16px;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;font-size:14px;line-height:1.45;color:#3E453F;">
    <div style="font-size:15px;font-weight:700;color:#1E2520;">The dry-phase rule</div>
    <div>When the gauge first reads min, the soil still holds water. Wait before refilling so the roots get air and the reservoir doesn't go stagnant.</div>
    <div>Base wait from the 3-day average high: ≥28° skip · 23–27° 1 day · 16–22° 2 days · below 16° 3 days. Then each planter is adjusted for plant thirst, sun and planter size.</div>
  </div>
  <button data-act="refresh" style="height:44px;border-radius:22px;border:1px solid #D9D5CA;background:#FDFCF8;font-size:14px;font-weight:600;color:#1E2520;cursor:pointer;">${wx.loading ? 'Updating…' : 'Refresh forecast'}</button>
</div>`;
}

function renderSettings() {
  const s = state;
  return `<div style="padding:8px 20px 28px;display:flex;flex-direction:column;gap:22px;">
  <div style="font-size:28px;font-weight:700;letter-spacing:-0.02em;">Settings</div>
  <div style="display:flex;flex-direction:column;gap:8px;">
    <div style="font-size:13px;font-weight:700;color:#5C635D;padding:0 2px;">Planters</div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${s.planters.length ? s.planters.map(p => `<div style="display:flex;align-items:center;gap:8px;padding:10px 10px 10px 14px;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;">
          <div style="font-size:16px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.name)}</div>
          <div style="font-size:13px;color:#5C635D;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.species)} · ${esc(SUN[p.sun].l)} · ${esc(SIZE[p.size].l)}${p.location ? ' · ' + esc(p.location) : ''}</div>
        </div>
        <button data-act="edit" data-id="${esc(p.id)}" style="flex-shrink:0;height:40px;padding:0 14px;border-radius:20px;border:1px solid #D9D5CA;background:#F5F3EC;font-size:14px;font-weight:600;color:#1E2520;cursor:pointer;">Edit</button>
        <button data-act="delete" data-id="${esc(p.id)}" style="flex-shrink:0;height:40px;padding:0 10px;border:none;background:transparent;font-size:14px;font-weight:600;color:oklch(0.5 0.13 25);cursor:pointer;">Remove</button>
      </div>`).join('') : `<div style="padding:14px;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;font-size:14px;color:#5C635D;">No planters yet. Add one to get started.</div>`}
      <button data-act="add" style="height:44px;padding:0 16px;border-radius:22px;border:none;background:#1E2520;color:#F5F3EC;font-size:14px;font-weight:600;cursor:pointer;align-self:flex-start;">+ Add planter</button>
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;">
    <div style="font-size:13px;font-weight:700;color:#5C635D;padding:0 2px;">Location for weather</div>
    <div style="display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;background:#FDFCF8;border:1px solid #E5E1D6;">
      <div style="font-size:14px;">Current: <strong>${esc(s.settings.city)}${s.settings.region ? ', ' + esc(s.settings.region) : ''}</strong></div>
      <div style="display:flex;gap:8px;">
        <input id="cityInput" value="${esc(s.cityInput)}" placeholder="Search city" style="flex:1;min-width:0;height:44px;padding:0 14px;border-radius:12px;border:1px solid #D9D5CA;background:#F5F3EC;font-size:16px;color:#1E2520;outline:none;">
        <button data-act="search" style="height:44px;padding:0 16px;border-radius:12px;border:none;background:#1E2520;color:#F5F3EC;font-size:14px;font-weight:600;cursor:pointer;">Search</button>
      </div>
      ${s.cityResults.map((c, i) => `<button data-act="pickcity" data-i="${i}" style="display:flex;justify-content:space-between;align-items:center;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #E5E1D6;background:#F5F3EC;font-size:14px;color:#1E2520;text-align:left;cursor:pointer;">
        <span style="font-weight:600;">${esc(c.name)}</span><span style="color:#5C635D;font-size:13px;">${esc(c.region)}</span>
      </button>`).join('')}
      ${s.cityMsg ? `<div style="font-size:13px;color:#5C635D;">${esc(s.cityMsg)}</div>` : ''}
    </div>
  </div>
  <div style="display:flex;flex-direction:column;gap:8px;">
    <div style="font-size:13px;font-weight:700;color:#5C635D;padding:0 2px;">Data</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button data-act="demo" style="height:44px;padding:0 16px;border-radius:22px;border:1px solid #D9D5CA;background:#FDFCF8;font-size:14px;font-weight:600;color:#1E2520;cursor:pointer;">Load sample planters</button>
      <button data-act="clearall" style="height:44px;padding:0 16px;border-radius:22px;border:none;background:transparent;font-size:14px;font-weight:600;color:oklch(0.5 0.13 25);cursor:pointer;">Remove all</button>
    </div>
  </div>
</div>`;
}

const selStyle = on => ({ bd: on ? '#1E2520' : '#E0DCD1', bg: on ? '#1E2520' : '#F5F3EC', fg: on ? '#F5F3EC' : '#1E2520' });
const formPreview = () => `At today's weather, this planter waits ${plan(state.form).total} at min before refilling.`;
const saveBg = () => state.form.name.trim() ? '#1E2520' : '#A9ADA6';

function renderSheet(t) {
  const s = state, f = s.form;
  let body = '';
  const minP = s.sheet?.type === 'min' && s.planters.find(p => p.id === s.sheet.id);
  if (minP) {
    const mp = plan(minP);
    body = `<div style="display:flex;flex-direction:column;gap:4px;">
      <div style="font-size:20px;font-weight:700;">When did ${esc(minP.name)} hit min?</div>
      <div style="font-size:14px;color:#5C635D;">The dry phase starts counting from this day.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;padding-bottom:8px;">
      ${[0,1,2].map(n => { const on = add(add(t,-n), mp.days), now = diff(t,on) <= 0;
        return `<button data-act="setmin" data-id="${esc(minP.id)}" data-n="${n}" style="display:flex;justify-content:space-between;align-items:center;min-height:56px;padding:0 16px;border-radius:14px;border:1.5px solid #E0DCD1;background:#F5F3EC;cursor:pointer;color:#1E2520;text-align:left;">
          <span style="font-size:16px;font-weight:600;">${n === 0 ? 'Today' : n === 1 ? 'Yesterday' : '2 days ago'}</span>
          <span style="font-size:13px;color:${now ? C.water : C.dry};font-weight:600;">${now ? 'water today' : `water ${until(on, t)}`}</span>
        </button>`; }).join('')}
    </div>`;
  } else if (s.sheet?.type === 'form') {
    const opt = (k, key, label) => { const o = selStyle(f[key] === k); return `<button data-act="${key === 'sun' ? 'sun' : 'size'}" data-v="${k}" style="height:44px;border-radius:12px;border:1.5px solid ${o.bd};background:${o.bg};color:${o.fg};font-size:14px;font-weight:600;cursor:pointer;">${label}</button>`; };
    body = `<div style="font-size:20px;font-weight:700;">${s.editId ? 'Edit planter' : 'New planter'}</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:13px;font-weight:600;color:#5C635D;">Name</div>
      <input id="fName" value="${esc(f.name)}" placeholder="e.g. Railing left" style="height:46px;padding:0 14px;border-radius:12px;border:1px solid #D9D5CA;background:#F5F3EC;font-size:16px;color:#1E2520;outline:none;">
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:13px;font-weight:600;color:#5C635D;">Location</div>
      <input id="fLoc" value="${esc(f.location)}" placeholder="e.g. South balcony" style="height:46px;padding:0 14px;border-radius:12px;border:1px solid #D9D5CA;background:#F5F3EC;font-size:16px;color:#1E2520;outline:none;">
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:13px;font-weight:600;color:#5C635D;">Plant</div>
      <select id="fSpecies" style="height:46px;padding:0 12px;border-radius:12px;border:1px solid #D9D5CA;background:#F5F3EC;font-size:16px;color:#1E2520;">
        ${Object.keys(SPECIES).map(k => `<option value="${esc(k)}"${f.species === k ? ' selected' : ''}>${esc(k)} (${THIRST[SPECIES[k]].l})</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:13px;font-weight:600;color:#5C635D;">Sun exposure</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">${Object.keys(SUN).map(k => opt(k, 'sun', SUN[k].l)).join('')}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="font-size:13px;font-weight:600;color:#5C635D;">Planter length</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;">${[50,80,100].map(k => opt(k, 'size', SIZE[k].l)).join('')}</div>
    </div>
    <div id="fPreview" style="font-size:13px;color:#5C635D;">${formPreview()}</div>
    <button id="fSave" data-act="save" style="height:52px;border-radius:26px;border:none;background:${saveBg()};color:#FDFCF8;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:8px;">${s.editId ? 'Save changes' : 'Add planter'}</button>`;
  }
  return `<div data-act="closesheet" style="position:absolute;inset:0;background:rgba(24,30,25,0.38);display:flex;flex-direction:column;justify-content:flex-end;z-index:30;">
    <div id="sheet" data-act="stop" style="background:#FDFCF8;border-radius:24px 24px 0 0;padding:10px 20px max(10px, env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;max-height:88%;overflow-y:auto;">
      <div style="width:40px;height:5px;border-radius:3px;background:#D9D5CA;align-self:center;flex-shrink:0;"></div>
      ${body}
    </div>
  </div>`;
}

function render() {
  const s = state, t = iso();
  const vs = s.planters.map(p => view(p, t));
  const water = vs.filter(v => v.status === 'water');
  const dry = vs.filter(v => v.status === 'dry').sort((a,b) => a.waterOn < b.waterOn ? -1 : 1);
  const check = vs.filter(v => v.status === 'check').sort((a,b) => b.sw - a.sw);
  const avg = avgHigh(), m = { vs, water, dry, check, avg, bd: band(avg), wx: s.wx, t };
  const detailV = s.detailId && vs.find(v => v.id === s.detailId);
  const onTab = !s.detailId;

  // main content (scroll container persists so scroll position survives re-renders)
  const main = $('main');
  const prevKey = main.dataset.view, key = detailV ? 'detail:' + s.detailId : s.tab;
  const top = main.scrollTop;
  const focusId = document.activeElement?.id, selStart = document.activeElement?.selectionStart, selEnd = document.activeElement?.selectionEnd;
  main.innerHTML = detailV ? renderDetail(detailV) : s.tab === 'today' ? renderToday(m) : s.tab === 'weather' ? renderWeather(m) : renderSettings();
  main.dataset.view = key;
  main.scrollTop = prevKey === key ? top : 0;

  $('tabs').innerHTML = [['today','Today', water.length ? `${water.length} due` : ''], ['weather','Weather', deg(s.wx.current)], ['settings','Settings','']].map(([k,l,sub]) => {
    const on = onTab && s.tab === k;
    return `<button data-act="tab" data-tab="${k}" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-height:44px;justify-content:center;border:none;background:transparent;cursor:pointer;color:${on ? '#1E2520' : '#5C635D'};">
      <div style="width:20px;height:4px;border-radius:2px;background:${on ? '#1E2520' : 'transparent'};"></div>
      <div style="font-size:13px;font-weight:700;">${l}</div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:11px;height:14px;color:#5C635D;">${sub}</div>
    </button>`; }).join('');

  const ov = $('overlay'), sheetTop = $('sheet')?.scrollTop || 0;
  ov.innerHTML = s.sheet ? renderSheet(t) : '';
  if ($('sheet')) $('sheet').scrollTop = sheetTop;

  $('toast').innerHTML = s.toast ? `<div style="position:absolute;left:16px;right:16px;bottom:calc(88px + env(safe-area-inset-bottom) - 10px);z-index:40;display:flex;align-items:center;gap:12px;padding:12px 12px 12px 16px;border-radius:16px;background:#1E2520;color:#F5F3EC;box-shadow:0 8px 24px rgba(0,0,0,0.2);">
    <div style="flex:1;font-size:14px;">${esc(s.toast.msg)}</div>
    <button data-act="undo" style="height:36px;padding:0 12px;border-radius:18px;border:none;background:#39423B;color:#F5F3EC;font-size:14px;font-weight:600;cursor:pointer;">Undo</button>
  </div>` : '';

  if (focusId && $(focusId) && document.activeElement !== $(focusId)) { const el = $(focusId); el.focus(); try { el.setSelectionRange(selStart, selEnd); } catch (e) {} }
}

// ---------------------------------------------------------------- events
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const { act, id, tab, i, n, v } = el.dataset;
  switch (act) {
    case 'stop': return;
    case 'open': return setState({ detailId:id });
    case 'action': { const p = view(state.planters.find(x => x.id === id), iso()); return p.status === 'check' ? openMin(id) : water(id); }
    case 'add': return openForm(null);
    case 'tab': return setState({ tab, detailId:null });
    case 'back': return setState({ detailId:null });
    case 'edit': return openForm(id);
    case 'min': return openMin(id);
    case 'water': return water(id);
    case 'clear': return clearMin(id);
    case 'delete': return remove(id);
    case 'refresh': return loadWx();
    case 'search': return searchCity();
    case 'pickcity': return pickCity(state.cityResults[+i]);
    case 'demo': { const prev = snapshot(); set({ planters:seed() }); return toast('Sample planters loaded', prev); }
    case 'clearall': { const prev = snapshot(); set({ planters:[] }); return toast('All planters removed', prev); }
    case 'closesheet': return setState({ sheet:null });
    case 'setmin': return markMin(id, +n);
    case 'sun': return setState({ form:{ ...state.form, sun:v } });
    case 'size': return setState({ form:{ ...state.form, size:+v } });
    case 'save': return saveForm();
    case 'undo': return set({ planters: state.toast.prev, toast:null });
  }
});
function formChanged() {
  const p = $('fPreview'), b = $('fSave');
  if (p) p.textContent = formPreview();
  if (b) b.style.background = saveBg();
}
document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'cityInput') state.cityInput = e.target.value;
  else if (id === 'fName') { state.form = { ...state.form, name:e.target.value }; formChanged(); }
  else if (id === 'fLoc') state.form = { ...state.form, location:e.target.value };
});
document.addEventListener('change', e => {
  if (e.target.id === 'fSpecies') { state.form = { ...state.form, species:e.target.value }; formChanged(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'cityInput') searchCity(); });

// ---------------------------------------------------------------- boot
render();
{
  const w = state.wx;
  if (!w.at || Date.now() - w.at > 3 * 3600e3 || w.daily?.[0]?.date !== iso()) loadWx();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const w = state.wx;
  if (!w.at || Date.now() - w.at > 3 * 3600e3 || w.daily?.[0]?.date !== iso()) loadWx(); else render();
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
