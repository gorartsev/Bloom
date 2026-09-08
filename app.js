/* BLOOM — тренировочный лог. Ванильный JS, без зависимостей, работает офлайн. */

/* ═══ ХРАНИЛИЩЕ ═══════════════════════════════════════════════════════ */
const KEY = "bloom";

const BLANK = {
  v: 3,
  profile: { name:null, height:185, startWeight:null, birth:2003 },
  settings: {},
  sessions: [],      // завершённые
  active: null,      // текущая, живёт между запусками
  weights: {},       // 'YYYY-MM-DD' -> кг
  plans: {},         // 'YYYY-MM-DD' -> план от тренера
  flags: [],         // carry-forward от тренера
  customEx: [],      // упражнения, добавленные руками
  char: { body:"leopard", outfit:"none", hair:"bald" },
  xp: 0,
  unlocked: ["leopard","black","white","stripes","mint","none","bald","buzz"],
  coachSeen: {},     // id реплики -> дата последнего показа
  seenLevel: 1,      // до какого уровня экран «уровень взят» уже показывали
};

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
  if (!raw) return structuredClone(BLANK);
  if (raw.v >= 2) {
    const s = { ...structuredClone(BLANK), ...raw,
      profile:{...BLANK.profile, ...(raw.profile||{})},
      settings:{...BLANK.settings, ...(raw.settings||{})},
      char:{...BLANK.char, ...(raw.char||{})} };
    if (!Array.isArray(s.unlocked) || !s.unlocked.length) s.unlocked = [...BLANK.unlocked];
    s.v = 3;
    return s;
  }
  /* Старую схему сохраняем нетронутой рядом: миграция не должна уметь съесть данные. */
  try { localStorage.setItem(KEY + "_v1_backup", JSON.stringify(raw)); } catch {}
  const migrated = migrateV1(raw);
  migrated._migrated = true;
  return migrated;
}

/* Старый формат: {name, workouts:{date:[{name,category,duration,time,notes}]}, moods, weights} */
function migrateV1(old) {
  const s = structuredClone(BLANK);
  s.profile.name = old.name || null;
  s.weights = old.weights || {};
  const typeMap = { fitness:"strength", run:"run" };
  Object.entries(old.workouts || {}).forEach(([date, arr]) => {
    (arr || []).forEach(w => {
      s.sessions.push({
        id: w.id || uid(),
        date,
        type: typeMap[w.category] || "other",
        duration: parseInt(w.duration) || 45,
        rpe: old.moods?.[date] ? Math.min(10, old.moods[date] * 2) : 5,
        notes: [w.name, w.notes].filter(Boolean).join(" · "),
        entries: [], run: null, done: true, legacy: true,
      });
    });
  });
  s.sessions.sort((a,b) => a.date.localeCompare(b.date));
  return s;
}

let ST = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch {} }
if (ST._migrated) { delete ST._migrated; save(); }

/* ═══ УТИЛИТЫ ════════════════════════════════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2,10);
const $ = sel => document.querySelector(sel);
const pad = n => String(n).padStart(2,"0");
const dk = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => dk(new Date());
const parseDk = k => { const [y,m,d] = k.split("-").map(Number); return new Date(y,m-1,d); };
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate()-n); return dk(d); };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

const MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const DOWS = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const DAY_FULL = ["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"];
const fmtDate = k => { const d = parseDk(k); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtDay  = k => k === today() ? "сегодня" : k === daysAgo(1) ? "вчера" : fmtDate(k);
/* Русская форма числительного: «1 флаг», «2 флага», «5 флагов». */
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  return n + " " + (a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many);
};

const allEx = () => [...EXERCISES, ...ST.customEx];
const exById = id => EX_BY_ID[id] || ST.customEx.find(e => e.id === id) ||
  { id, n:id, p:"other", eq:"none", step:2.5, reps:[8,12], tags:[] };
const unit = ex => ex.u === "s" ? "сек" : "повт";

/* ═══ МЕТРИКИ ════════════════════════════════════════════════════════ */
/* Нагрузка по Фостеру: минуты умножить на RPE. Одно число на любую сессию,
   поэтому мат, бег и штанга складываются в одну неделю. */
const sessionLoad = s => (s.duration || 0) * (s.rpe || 0);
const loadBetween = (from, to) => ST.sessions
  .filter(s => s.date >= from && s.date <= to)
  .reduce((a,s) => a + sessionLoad(s), 0);

/* ACWR: острая неделя делить на среднюю за четыре. Ниже 0.8 спад,
   выше 1.3 риск. При коротком стаже не считаем: знаменатель врёт. */
function acwr() {
  const acute = loadBetween(daysAgo(6), today());
  const chronic = loadBetween(daysAgo(27), today()) / 4;
  if (chronic < 50) return null;
  return acute / chronic;
}

const e1rm = (w, r) => (!w || !r) ? 0 : Math.round(w * (1 + r/30));

function exHistory(exId) {
  const out = [];
  ST.sessions.forEach(s => (s.entries||[]).forEach(e => {
    if (e.ex === exId && e.sets?.length) out.push({ date:s.date, sets:e.sets });
  }));
  const a = ST.active;
  if (a) (a.entries||[]).forEach(e => {
    if (e.ex === exId && e.sets?.length) out.push({ date:a.date, sets:e.sets, live:true });
  });
  return out;
}

function lastSet(exId, live = true) {
  const h = exHistory(exId).filter(x => live || !x.live);
  if (!h.length) return null;
  const last = h[h.length-1];
  const best = last.sets.reduce((a,b) => (b.w||0) >= (a.w||0) ? b : a, last.sets[0]);
  return { ...best, date:last.date, count:last.sets.length };
}

function bestSet(exId) {
  let best = null;
  exHistory(exId).forEach(x => x.sets.forEach(st => {
    const v = st.w ? e1rm(st.w, st.r) : (st.r || 0);
    if (!best || v > best.v) best = { v, w:st.w, r:st.r, date:x.date };
  }));
  return best;
}

/* Двойная прогрессия: сначала добираем повторы до верха диапазона,
   и только когда верх взят с запасом, растёт вес. Запас (RIR) это гейт:
   без него прогрессия превращается в «каждый раз до отказа». */
function suggest(exId) {
  const ex = exById(exId);
  const last = lastSet(exId);
  const [lo, hi] = ex.reps || [8,12];
  if (!last) return { w:0, r:lo, why:"Первый раз. Возьми вес, с которым уверенно сделаешь " + lo + "." };
  const rir = last.rir ?? 2;
  if ((last.r || 0) >= hi && rir >= 2 && ex.step > 0)
    return { w:(last.w||0) + ex.step, r:lo,
      why:`Прошлый раз ${last.w||0} × ${last.r}, запас ${rir}. Верх диапазона взят, вес растёт.` };
  if (rir <= 0)
    return { w:last.w||0, r:Math.max(lo, (last.r||lo) - 1),
      why:`Прошлый раз шёл до отказа. Тот же вес, на повтор меньше.` };
  return { w:last.w||0, r:Math.min(hi, (last.r||lo) + 1),
    why:`Прошлый раз ${last.w||0} × ${last.r}, запас ${rir}. Тот же вес, добираем повтор.` };
}

/* ═══ ПЕРСОНАЖ, ОПЫТ, НАГРАДЫ ════════════════════════════════════════ */
const totalXp = () => ST.sessions.reduce((a,s) => a + Math.round(sessionLoad(s)/3), 0);
const lvl = () => levelFromXp(totalXp());

/* Недельный стрик по силовым: пропуск бега его не жжёт, пропуск силовой жжёт.
   Считаем назад по неделям от текущей, пока в неделе есть силовая. */
function strengthStreak() {
  const has = wkAgo => {
    const end = new Date(); end.setDate(end.getDate() - wkAgo*7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    return ST.sessions.some(s => s.type === "strength" && s.date >= dk(start) && s.date <= dk(end));
  };
  let n = 0;
  while (n < 60 && has(n)) n++;
  return n;
}

function matWeeks() {
  const has = wkAgo => {
    const end = new Date(); end.setDate(end.getDate() - wkAgo*7);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    return ST.sessions.some(s => s.type === "bjj" && s.date >= dk(start) && s.date <= dk(end));
  };
  let n = 0;
  while (n < 60 && has(n)) n++;
  return n;
}

const rirSets = () => ST.sessions.reduce((a,s) =>
  a + (s.entries||[]).reduce((x,e) => x + e.sets.filter(st => (st.rir ?? 0) >= 2).length, 0), 0);

function metFor(need) {
  if (!need) return true;
  if (need.t === "level")    return lvl().level >= need.v;
  if (need.t === "sessions") return ST.sessions.length >= need.v;
  if (need.t === "streak")   return strengthStreak() >= need.v;
  if (need.t === "matWeeks") return matWeeks() >= need.v;
  if (need.t === "rirSets")  return rirSets() >= need.v;
  return false;
}

/* Возвращает то, что открылось прямо сейчас, и сразу это фиксирует. */
function checkUnlocks() {
  const fresh = [];
  [...BODIES, ...OUTFITS, ...HAIRS].forEach(it => {
    if (ST.unlocked.includes(it.id)) return;
    /* Отдаём запись из CHAR_BY_ID, а не сырую из каталога: только у первой
       есть slot, без него путь к картинке собирается как char/undefined/. */
    if (metFor(it.need)) { ST.unlocked.push(it.id); fresh.push(CHAR_BY_ID[it.id]); }
  });
  if (fresh.length) save();
  return fresh;
}

const has = id => ST.unlocked.includes(id);

/* Слои того, что надето: образ перекрывает трусы, причёска ложится сверху. */
function wornLayers(ch = ST.char) {
  const out = [];
  out.push(ch.outfit && ch.outfit !== "none"
    ? charSrc("outfit", ch.outfit)
    : charSrc("body", ch.body));
  const h = charSrc("hair", ch.hair);
  if (h) out.push(h);
  return out.filter(Boolean);
}

const heroHtml = (layers, cls="") =>
  `<div class="hero ${cls}" style="width:100%;height:100%">` +
  layers.map(s => `<img src="${s}" alt="">`).join("") + `</div>`;

/* Атрибуты считаются каждый от своего среза истории. Общий опыт двигал бы
   все полоски одновременно, и они перестали бы что-либо означать. */
function attrValues() {
  const d28 = daysAgo(27);
  const recent = ST.sessions.filter(s => s.date >= d28);
  const ton = recent.filter(s => s.type === "strength")
    .reduce((a,s) => a + (s.entries||[]).reduce((x,e) =>
      x + e.sets.reduce((y,st) => y + (st.w||0)*(st.r||0), 0), 0), 0);
  const runMin = recent.filter(s => s.type === "run").reduce((a,s) => a + (s.duration||0), 0);
  const mobMin = recent.filter(s => s.type === "mobility").reduce((a,s) => a + (s.duration||0), 0);
  const matMin = recent.filter(s => s.type === "bjj").reduce((a,s) => a + (s.duration||0), 0);
  const hard   = recent.filter(s => (s.rpe||0) >= 8).length;
  const cap = (v, full) => clamp(Math.round(v / full * 20), 0, 20);
  return {
    str:  cap(ton, 24000),
    end:  cap(runMin, 240),
    mob:  cap(mobMin, 150),
    grit: cap(matMin, 500),
    will: cap(hard * 60 + recent.length * 20, 400),
  };
}

/* ═══ ТРЕНЕР ═════════════════════════════════════════════════════════
   Открывает рот только когда есть число, которого нет у Горы.
   Правила молчания: одну мысль не чаще раза в неделю, не больше двух
   реплик за сессию, и молчок, пока подход только что записан. */
let COACH = { shownThisSession: 0, dismissed: null, lastSetAt: 0 };

function coachLine(ctx) {
  if (COACH.dismissed === ctx.where) return null;
  if (COACH.shownThisSession >= 2) return null;
  if (Date.now() - COACH.lastSetAt < 20000) return null;

  const fresh = id => {
    const seen = ST.coachSeen[id];
    return !seen || seen < daysAgo(6);
  };
  const out = [];

  const r = acwr();
  if (r && r > 1.3 && fresh("load"))
    out.push({ id:"load", tone:"warn", kind:"Нагрузка",
      text:`Неделя уже ${r.toFixed(2)} при коридоре до 1.3. Следующую силовую режу до трёх упражнений.`,
      acts:[{ n:"Понял", a:"coach-ok" }] });

  if (ctx.where === "session" && ctx.exId) {
    const s = suggest(ctx.exId), last = lastSet(ctx.exId);
    if (last && s.w && s.w !== last.w && fresh("prog:" + ctx.exId))
      out.push({ id:"prog:" + ctx.exId, tone:"good", kind:"Следующий вес", text:s.why,
        acts:[{ n:`Поставить ${s.w}`, a:`np-set:${s.w}:${s.r}` }, { n:"Оставить", a:"coach-ok", sec:true }] });
  }

  const flag = (ST.flags || []).find(f => ctx.exText && f.toLowerCase().split(/[ ,:]/)
    .some(w => w.length > 4 && ctx.exText.toLowerCase().includes(w)));
  if (flag && fresh("flag:" + flag))
    out.push({ id:"flag:" + flag, tone:"warn", kind:"Флаг тренера", text:flag,
      acts:[{ n:"Понял", a:"coach-ok" }] });

  const st = strengthStreak();
  if (st >= 2 && ctx.where === "home" && fresh("streak:" + st))
    out.push({ id:"streak:" + st, tone:"good", kind:`${plural(st,"неделя","недели","недель")} подряд`,
      text:`${plural(st,"неделя","недели","недель")} без пропуска силовой. Стрик недельный: пропуск бега его не жжёт.`,
      acts:[{ n:"Красава", a:"coach-ok" }] });

  return out[0] || null;
}

function coachShown(id) {
  ST.coachSeen[id] = today();
  COACH.shownThisSession++;
  save();
}

function coachHtml(ctx) {
  const c = coachLine(ctx);
  if (!c) return "";
  if (!ST.coachSeen[c.id]) coachShown(c.id);
  const layers = wornLayers();
  return `<div class="coach ${c.tone === "warn" ? "warn" : ""}">
    <div class="coach-p">${heroHtml(layers)}</div>
    <div class="coach-b">
      <span class="lbl">${esc(c.kind)}</span>
      <div class="coach-t">${esc(c.text)}</div>
      <div class="coach-a">${c.acts.map(a =>
        `<button data-act="${a.a}"${a.sec?' class="sec"':''}>${esc(a.n)}</button>`).join("")}</div>
    </div></div>`;
}

/* ═══ ВИД ════════════════════════════════════════════════════════════ */
let VIEW = { name:"home", exId:null, tab:"outfit", month:null };
let REST = { until:0, total:0 };
let SHEET = null;   // {kind:"numpad"|"adjust"|"picker", ...}
let TOAST = null;

function render() {
  const v = VIEW.name;
  const body =
    !ST.profile.name ? vOnboard() :
    v === "session"  ? vSession()  :
    v === "finish"   ? vFinish()   :
    v === "quick"    ? vQuick()    :
    v === "hero"     ? vHero()     :
    v === "wardrobe" ? vWardrobe() :
    v === "levelup"  ? vLevelUp()  :
    v === "history"  ? vHistory()  :
    v === "profile"  ? vProfile()  :
                       vHome();
  $("#root").innerHTML = body + sheetHtml() + toastHtml();
  if (REST.until > Date.now()) tickRest();
}

const go = (name, extra={}) => { VIEW = { ...VIEW, name, ...extra }; SHEET = null; window.scrollTo(0,0); render(); };
const rerender = () => render();
const toast = msg => { TOAST = msg; render(); setTimeout(() => { TOAST = null; render(); }, 2200); };
const toastHtml = () => TOAST ? `<div class="toast">${esc(TOAST)}</div>` : "";

const nav = active => `<div class="nav">${
  [["home","Сегодня"],["hero","Герой"],["history","Прогресс"],["profile","Я"]]
    .map(([k,n]) => `<button class="nav-b ${active===k?"on":""}" data-act="go:${k}">
      <span class="lbl">${n}</span></button>`).join("")}</div>`;

const hdr = (title, sub, back) => `<div class="hdr">
  ${back ? `<button class="back" data-act="${back}">←</button>` : ""}
  <div class="hdr-t"><div class="hdr-title dsp">${esc(title)}</div>
  ${sub ? `<div class="hdr-sub">${esc(sub)}</div>` : ""}</div></div>`;

/* ── онбординг: первый шаг это выбор трусов, а не форма ── */
function vOnboard() {
  const picked = VIEW.pants || "leopard";
  return `<div class="scr">
    <div class="top"><div class="top-l">
      <span class="lbl">Шаг 1 из 2</span>
      <div class="top-h dsp">Выбери,<br>с кого начнём</div></div></div>
    <p class="hint" style="margin-top:10px">Одежду заработаешь. Сейчас важнее трусы: в них ты проведёшь первые недели.</p>

    <div class="stage" style="height:190px;margin-top:10px">
      <div class="stage-bg" style="width:170px;height:170px"></div>
      <div class="hero bob" style="width:118px;height:178px">
        <img src="${charSrc("body", picked)}" alt=""></div>
    </div>

    <div class="grid4">${BODIES.filter(b => !b.need).map(b => `
      <button class="item ${b.id===picked?"on":""}" data-act="onb-p:${b.id}">
        <div class="item-i" style="height:52px"><img src="${charSrc("body", b.id)}" style="height:50px" alt=""></div>
        <div class="item-c" style="font-size:9px">${esc(b.n)}</div></button>`).join("")}</div>

    <div class="sp"></div>
    <span class="lbl" style="color:var(--dim)">Как тебя звать</span>
    <input class="inp" id="onb-name" placeholder="Гора" style="margin-top:10px" autocomplete="off">
    <span class="lbl" style="color:var(--dim)">Вес сейчас</span>
    <input class="inp" id="onb-w" type="number" inputmode="decimal" placeholder="85" style="margin-top:10px">
    <button class="btn" data-act="onb-go">Это я →</button>
    <p class="hint" style="text-align:center;margin-top:12px">Остальное спрошу по ходу. Данные лежат на телефоне и никуда не уходят.</p>
  </div>`;
}

/* ── сегодня ── */
function vHome() {
  const a = ST.active;
  const plan = ST.plans[today()];
  const name = ST.profile.name || "Гора";
  const d = new Date();
  const l = lvl();
  const r = acwr();
  const week = loadBetween(daysAgo(6), today());

  return `<div class="scr">
    <div class="top">
      <div class="top-l">
        <span class="lbl">${DAY_FULL[d.getDay()]} · ${fmtDate(today())}</span>
        <div class="top-h dsp">Привет, ${esc(name)}</div>
      </div>
      <button style="position:relative;width:52px;height:52px;border-radius:18px;background:var(--mint);
        display:flex;align-items:center;justify-content:center;flex-shrink:0" data-act="go:hero">
        <div class="hero bob" style="width:32px;height:40px">${wornLayers().map(s=>`<img src="${s}" alt="">`).join("")}</div>
        <span class="dsp num" style="position:absolute;right:-5px;bottom:-5px;min-width:22px;height:22px;
          padding:0 5px;border-radius:11px;background:var(--ink);color:var(--mint);border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;font-size:11px">${l.level}</span>
      </button>
    </div>

    ${coachHtml({ where:"home" })}

    ${a ? liveCard(a) : plan ? planCard(plan) : noPlanCard()}

    <span class="lbl" style="color:var(--dim);display:block;margin-top:18px">Записать быстро</span>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px">
      ${["bjj","run","mobility"].map(t => {
        const st = SESSION_TYPES[t], last = ST.sessions.filter(s => s.type===t).slice(-1)[0];
        return `<button class="item" style="background:${st.c};border:none;padding:11px 6px"
          data-act="quick:${t}">
          <div class="dsp" style="font-size:13px;color:${st.dark?"#fff":"var(--ink)"}">${esc(st.n)}</div>
          <div class="lbl" style="font-size:9px;letter-spacing:.6px;margin-top:3px;
            color:${st.dark?"#fff":t==="run"?"#2C4A2C":"#332F63"}">${last?fmtDay(last.date):"ни разу"}</div>
        </button>`;
      }).join("")}
    </div>

    ${plan && !a ? `<button class="row" style="border-radius:20px;margin-top:12px" data-act="adjust">
      <span class="row-n">Сегодня не тяну</span>
      <span class="lbl" style="color:var(--dim)">поменять план</span>
      <span class="row-x">→</span></button>` : ""}

    <div class="card" style="margin-top:14px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div><span class="lbl">Нагрузка недели</span>
          <div class="dsp num" style="font-size:30px;line-height:1;margin-top:4px">${week.toLocaleString("ru")}</div></div>
        ${r ? `<div style="background:${r>1.3?"var(--violet)":"var(--violetLite)"};
          color:${r>1.3?"#fff":"var(--ink)"};border-radius:999px;padding:8px 14px">
          <span class="dsp num" style="font-size:14px">${r.toFixed(2)}</span></div>` : ""}
      </div>
      ${r ? `<div class="corr"><i></i><b style="left:${clamp((r-0.5)/1.2*100, 3, 97)}%"></b></div>
      <div class="corr-l"><span>спад</span><span class="mid">коридор</span><span>перебор</span></div>`
        : `<p class="hint" style="margin-top:10px">Коридор появится, когда наберётся четыре недели истории. Сейчас считать не на чем.</p>`}
    </div>
  </div>${nav("home")}`;
}

const liveCard = a => {
  const st = SESSION_TYPES[a.type] || { n:a.type, c:"var(--fill)" };
  const n = (a.entries||[]).reduce((x,e) => x + e.sets.length, 0);
  return `<button class="card mint" style="margin-top:16px" data-act="go:session">
    <span class="lbl">Идёт сейчас</span>
    <div class="dsp" style="font-size:24px;line-height:1.05;margin-top:6px">${esc(st.n)}</div>
    <p class="hint" style="color:var(--mintInk);margin-top:8px">
      ${n ? plural(n,"подход","подхода","подходов") + " записано" : "Ещё ни одного подхода"} · начал ${fmtDay(a.date)}</p>
    <div class="btn" style="margin-top:14px">Вернуться →</div></button>`;
};

const planCard = p => {
  const items = p.items || [];
  return `<div class="card mint" style="margin-top:16px">
    <span class="lbl">План на сегодня</span>
    <div class="dsp" style="font-size:24px;line-height:1.05;margin-top:6px">${esc(p.session || "Тренировка")}</div>
    <div class="plan-rows">${items.map(it => {
      const ex = exById(it.ex);
      return `<div class="plan-r"><div class="tick"></div>
        <span class="n">${esc(ex.n)}</span>
        <span class="s num">${it.sets} × ${esc(it.reps)}${it.weight ? " · " + it.weight : ""}</span></div>`;
    }).join("")}</div>
    ${p.note ? `<p class="hint" style="color:var(--mintInk);margin-top:12px">${esc(p.note)}</p>` : ""}
    <button class="btn" data-act="start-plan">Поехали →</button></div>`;
};

const noPlanCard = () => {
  const d = new Date().getDay();
  const planned = (WEEK_TEMPLATE[d]?.planned || []);
  return `<div class="card" style="margin-top:16px">
    <span class="lbl">Плана на сегодня нет</span>
    <div class="dsp" style="font-size:20px;line-height:1.1;margin-top:6px">
      ${planned.length ? "По расписанию: " + planned.map(t => SESSION_TYPES[t].n).join(" и ") : "Выходной по расписанию"}</div>
    <p class="hint" style="margin-top:8px">План приходит от тренера: Профиль → «Вставить план». Или начни сам.</p>
    <div class="row2" style="margin-top:12px">
      <button class="btn ghost" style="margin:0" data-act="start:strength">Силовая</button>
      <button class="btn ghost" style="margin:0" data-act="start:calisthenics">Дома</button></div>
  </div>`;
};

/* ── тренировка ── */
function vSession() {
  const a = ST.active;
  if (!a) { VIEW.name = "home"; return vHome(); }
  const st = SESSION_TYPES[a.type] || { n:a.type };
  const mins = Math.max(1, Math.round((Date.now() - (a.startedAt || Date.now())) / 60000));
  const entries = a.entries || [];
  const cur = entries.find(e => e.ex === VIEW.exId) || entries[entries.length-1];
  const ex = cur ? exById(cur.ex) : null;

  return `<div class="scr">
    ${hdr(st.n, `${plural(entries.length,"упражнение","упражнения","упражнений")} · ${mins} мин`, "go:home")}

    ${entries.length ? entries.map(e => {
      const x = exById(e.ex), open = cur && e.ex === cur.ex;
      return `<button class="card" style="${open?"background:var(--mint)":""}" data-act="pick-ex:${e.ex}">
        <div style="display:flex;align-items:baseline;gap:8px">
          <span class="dsp" style="font-size:18px;flex:1">${esc(x.n)}</span>
          <span class="lbl" style="color:${open?"var(--mintInk)":"var(--dim)"}">${
            e.sets.length ? plural(e.sets.length,"подход","подхода","подходов") : "пусто"}</span>
        </div>
        <div class="sets">${e.sets.map((s,i) => `<span class="set">${
          s.w ? `${s.w}<small>кг</small> × ${s.r}` : `${s.r}<small>${unit(x)}</small>`
        }${s.rir!=null?`<small>rir ${s.rir}</small>`:""}</span>`).join("")}
        ${open ? `<span class="set next">подход ${e.sets.length+1}</span>` : ""}</div>
      </button>`;
    }).join("") : `<div class="empty">
      <div class="empty-h dsp">Ещё пусто</div>
      <p class="empty-p">Добавь упражнение, и подходы поедут сюда.</p></div>`}

    ${ex && needRir(cur) ? rirAsk(cur) : ""}

    ${ex ? `
      ${coachHtml({ where:"session", exId:cur.ex, exText:ex.n })}
      <button class="card" data-act="np:${cur.ex}">
        <span class="lbl">Записать подход</span>
        <div style="display:flex;align-items:baseline;gap:10px;margin-top:6px">
          <span class="dsp num" style="font-size:40px;line-height:1">${DRAFT.w ?? suggest(cur.ex).w ?? 0}</span>
          <span class="lbl" style="color:var(--dim)">кг</span>
          <span class="dsp num" style="font-size:40px;line-height:1;margin-left:8px">${DRAFT.r ?? suggest(cur.ex).r}</span>
          <span class="lbl" style="color:var(--dim)">${unit(ex)}</span>
        </div>
        <p class="hint" style="margin-top:8px">Нажми, чтобы вписать числа</p>
      </button>
      ${ex.cue ? `<p class="hint" style="padding:0 4px">${esc(ex.cue)}</p>` : ""}
    ` : ""}

    <button class="btn ghost" data-act="picker">Добавить упражнение</button>
    <button class="btn" data-act="finish">Завершить тренировку</button>
    <div id="rest"></div>
  </div>`;
}

/* Последний подход без запаса. Спрашиваем ровно один раз и сразу,
   пока ощущение свежее: задним числом RIR это уже фантазия. */
const needRir = e => { const l = e?.sets[e.sets.length-1]; return l && l.rir == null; };

function rirAsk(e) {
  const l = e.sets[e.sets.length-1];
  return `<div class="card" style="background:#fff;border:2px solid var(--ink)">
    <div class="lad-h"><span class="lbl" style="color:var(--dim)">Сколько ещё мог</span>
      <span class="dsp num" style="font-size:15px">${l.w ? l.w + " × " + l.r : l.r}</span></div>
    <div class="ladder">${[0,1,2,3,4].map(v => `
      <button class="lad" style="height:${44+v*5}px" data-act="set-rir:${v}">${v===4?"4+":v}</button>`).join("")}</div>
    <p class="hint" style="margin-top:10px">Запас решает, растёт вес или повторы. Без него тренер считает вслепую.</p>
  </div>`;
}

/* ── итог ── */
function vFinish() {
  const a = ST.active;
  if (!a) { VIEW.name = "home"; return vHome(); }
  const dur = DRAFT.dur ?? a.duration ?? 40;
  const rpe = DRAFT.rpe ?? 7;
  const load = dur * rpe;
  return `<div class="scr">
    ${hdr("Как прошло?", "Тренировка закончена", "go:session")}

    <span class="lbl" style="color:var(--dim)">Сколько шло</span>
    <button class="card" style="margin-top:10px;text-align:center" data-act="np-dur">
      <div class="dsp num" style="font-size:44px;line-height:1">${dur}</div>
      <span class="lbl" style="color:var(--dim)">мин · нажми, чтобы вписать</span>
    </button>

    <div class="lad-h" style="margin-top:18px">
      <span class="lbl" style="color:var(--dim)">Насколько тяжело</span>
      <span class="lad-w">${esc(RPE_SCALE[rpe] || "")}</span></div>
    <div class="ladder">${Array.from({length:10},(_,i)=>i+1).map(v => `
      <button class="lad ${v===rpe?"on":v<rpe?"past":""}" style="height:${Math.round(43+v*2.5)}px"
        data-act="fin-rpe:${v}">${v}</button>`).join("")}</div>

    <div class="card mint" style="margin-top:18px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between">
        <div><span class="lbl">Нагрузка сессии</span>
          <div class="dsp num" style="font-size:38px;line-height:1;margin-top:4px">${load}</div></div>
        <div style="text-align:right"><span class="lbl">Опыт</span>
          <div class="dsp num" style="font-size:24px;line-height:1;margin-top:4px">+${Math.round(load/3)}</div></div>
      </div>
      <p class="hint" style="color:var(--mintInk);margin-top:10px">${esc(verdict(rpe))}</p>
    </div>

    <button class="btn" data-act="fin-save">Сохранить</button>
    <button class="btn flat" data-act="fin-drop">Не сохранять</button>
  </div>`;
}

const verdict = rpe =>
  rpe >= 9 ? "Девять и выше два раза подряд значит следующая легче. Тренер это учтёт." :
  rpe <= 3 ? "Совсем легко: в следующий раз можно добавить вес, если техника держится." :
  "Неделя укладывается в коридор, ничего менять не надо.";

/* ── быстрый лог ── */
function vQuick() {
  const t = VIEW.qType || "bjj";
  const st = SESSION_TYPES[t];
  const dur = DRAFT.dur ?? (t === "bjj" ? 90 : t === "run" ? 35 : 15);
  const rpe = DRAFT.rpe ?? (t === "bjj" ? 7 : 5);
  const km  = DRAFT.km ?? 6;
  const load = dur * rpe;
  const paceMin = km ? dur / km : 0;
  const pace = km ? `${Math.floor(paceMin)}:${pad(Math.round((paceMin%1)*60))} на км` : "";
  const week = loadBetween(daysAgo(6), today());

  return `<div class="scr">
    ${hdr("Записать", "15 секунд", "go:home")}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px">
      ${["bjj","run","mobility"].map(k => `
        <button class="item" style="background:${k===t?SESSION_TYPES[k].c:"var(--fill)"};border:none;padding:12px 6px"
          data-act="q-type:${k}">
          <div class="dsp" style="font-size:14px;color:${k===t&&SESSION_TYPES[k].dark?"#fff":"var(--ink)"}">${esc(SESSION_TYPES[k].n)}</div>
        </button>`).join("")}
    </div>

    <span class="lbl" style="color:var(--dim);display:block;margin-top:18px">Сколько шло</span>
    <button class="card" style="margin-top:10px;text-align:center" data-act="np-dur">
      <div class="dsp num" style="font-size:42px;line-height:1">${dur}</div>
      <span class="lbl" style="color:var(--dim)">мин · нажми, чтобы вписать</span>
    </button>

    ${t === "run" ? `
      <span class="lbl" style="color:var(--dim);display:block;margin-top:12px">Дистанция</span>
      <button class="card" style="margin-top:10px;text-align:center" data-act="np-km">
        <div class="dsp num" style="font-size:36px;line-height:1">${km}</div>
        <span class="lbl" style="color:var(--dim)">км · ${esc(pace)}</span>
      </button>` : ""}

    <div class="lad-h" style="margin-top:16px">
      <span class="lbl" style="color:var(--dim)">Насколько тяжело</span>
      <span class="lad-w">${esc(RPE_SCALE[rpe] || "")}</span></div>
    <div class="ladder">${Array.from({length:10},(_,i)=>i+1).map(v => `
      <button class="lad ${v===rpe?"on":v<rpe?"past":""}" style="height:${Math.round(43+v*2.5)}px"
        data-act="fin-rpe:${v}">${v}</button>`).join("")}</div>

    <div class="card" style="margin-top:18px;display:flex;align-items:center;justify-content:space-between">
      <div><span class="lbl">Нагрузка</span>
        <div class="dsp num" style="font-size:30px;line-height:1;margin-top:4px">${load}</div></div>
      <div style="text-align:right"><span class="lbl">Неделя станет</span>
        <div class="dsp num" style="font-size:20px;line-height:1;margin-top:4px;color:var(--violet)">${week + load}</div></div>
    </div>

    <button class="btn" data-act="q-save">Готово</button>
  </div>`;
}

/* ── герой ── */
function vHero() {
  const l = lvl();
  const av = attrValues();
  const ch = ST.char;
  const nm = id => (CHAR_BY_ID[id] || { n:"—" }).n;
  return `<div class="scr">
    <div class="top"><div class="top-l">
      <span class="lbl">Уровень ${l.level}</span>
      <div class="top-h dsp">${esc(ST.profile.name || "Гора")}</div></div>
      <div style="background:var(--mint);border-radius:999px;padding:9px 15px">
        <span class="lbl">${strengthStreak() ? plural(strengthStreak(),"неделя","недели","недель") : "Свеж"}</span></div>
    </div>

    <div class="stage" style="height:300px;margin-top:6px">
      <div class="stage-bg" style="width:270px;height:270px"></div>
      <div class="hero bob" style="width:170px;height:255px">
        ${wornLayers().map(s => `<img src="${s}" alt="">`).join("")}</div>
    </div>

    <div style="display:flex;gap:6px;margin-top:6px">
      ${[["body","Трусы",ch.body],["outfit","Образ",ch.outfit],["hair","Причёска",ch.hair]].map(([slot,label,cur]) =>
        `<button class="tab" data-act="wd:${slot}">
          <span class="lbl">${label}</span>
          <span class="tab-sub">${esc(nm(cur))}</span></button>`).join("")}
    </div>

    <div class="lad-h" style="margin-top:18px">
      <span class="lbl" style="color:var(--dim)">До ${l.level+1} уровня</span>
      <span class="dsp num" style="font-size:13px">${l.into.toLocaleString("ru")} / ${l.need.toLocaleString("ru")}</span></div>
    <div class="xp"><i style="width:${Math.round(l.into/l.need*100)}%"></i></div>

    <div style="margin-top:16px">${ATTRS.map(a => `
      <div class="attr"><span class="attr-n">${a.n}</span>
        <div class="attr-b"><i style="width:${av[a.id]/20*100}%;background:${a.c}"></i></div>
        <span class="attr-v">${av[a.id]}</span></div>`).join("")}</div>

    <button class="card" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between"
      data-act="go:wardrobe">
      <div><div class="dsp" style="font-size:16px">Гардероб</div>
        <span class="lbl" style="color:var(--dim);margin:0">${ST.unlocked.length} из ${BODIES.length+OUTFITS.length+HAIRS.length}</span></div>
      <span class="dsp" style="font-size:18px">→</span>
    </button>
  </div>${nav("hero")}`;
}

/* ── гардероб ── */
function vWardrobe() {
  const tab = VIEW.tab || "outfit";
  const LIST = { body:BODIES, outfit:OUTFITS, hair:HAIRS }[tab];
  const cur = ST.char[tab];
  const sel = CHAR_BY_ID[VIEW.sel] || CHAR_BY_ID[cur] || LIST[0];
  const nm = id => (CHAR_BY_ID[id] || { n:"—" }).n;
  const thumb = it => tab === "hair"
    ? (it.id === "bald" ? charSrc("body", ST.char.body) : charSrc("hair", it.id))
    : (it.id === "none" ? charSrc("body", ST.char.body) : charSrc(tab, it.id));

  return `<div class="scr" style="padding-bottom:220px">
    ${hdr("Гардероб", `${ST.unlocked.length} из ${BODIES.length+OUTFITS.length+HAIRS.length}`, "go:hero")}

    <div class="stage" style="height:216px">
      <div class="stage-bg" style="width:198px;height:198px"></div>
      <div class="hero bob" style="width:140px;height:210px">
        ${wornLayers().map(s => `<img src="${s}" alt="">`).join("")}</div>
    </div>

    <div style="display:flex;gap:6px;margin-top:8px">
      ${[["body","Трусы"],["outfit","Образ"],["hair","Причёска"]].map(([k,n]) =>
        `<button class="tab ${tab===k?"on":""}" data-act="wd:${k}">
          <span class="lbl">${n}</span><span class="tab-sub">${esc(nm(ST.char[k]))}</span></button>`).join("")}
    </div>

    <div class="grid3">${LIST.map(it => {
      const locked = !has(it.id);
      const src = thumb(it);
      return `<button class="item ${it.id===cur?"on":""} ${locked?"locked":""}" data-act="wear:${tab}:${it.id}">
        <div class="item-i">${src ? `<img src="${src}" alt="">` : `<span class="lbl" style="color:var(--dim)">нет</span>`}</div>
        <div class="item-n">${esc(it.n)}</div>
        <div class="item-c">${esc(needText(it.need))}</div></button>`;
    }).join("")}</div>

    <div style="position:fixed;left:0;right:0;bottom:0;z-index:20;background:var(--fill);
      border-radius:26px 26px 0 0;padding:14px var(--pad) calc(20px + env(safe-area-inset-bottom));
      max-width:520px;margin:0 auto">
      <div class="dsp" style="font-size:16px">${esc(sel.n)}</div>
      <p class="hint" style="margin-top:5px">${esc(sel.d)}</p>
      <button class="btn ${has(sel.id) ? "" : "ghost"}" style="min-height:54px"
        ${has(sel.id) ? `data-act="wear:${sel.slot}:${sel.id}"` : "disabled"}>
        ${has(sel.id) ? (ST.char[sel.slot] === sel.id ? "Надето" : "Надеть") : "Ещё закрыто"}</button>
    </div>
  </div>`;
}

const needText = need => {
  if (!need) return "Стартовое";
  if (has0(need)) return "Открыто";
  if (need.t === "level")    return `Уровень ${need.v}`;
  if (need.t === "sessions") return `${need.v} сессий`;
  if (need.t === "streak")   return `${plural(need.v,"неделя","недели","недель")} подряд`;
  if (need.t === "matWeeks") return `${need.v} нед. мата`;
  if (need.t === "rirSets")  return `${need.v} подходов с запасом`;
  return "";
};
const has0 = need => metFor(need);

/* ── взятие уровня ── */
function vLevelUp() {
  const l = lvl();
  const fresh = VIEW.fresh || [];
  return `<div class="scr" style="padding:0 0 96px">
    <div style="background:var(--mint);height:340px;display:flex;align-items:center;
      justify-content:center;text-align:center;overflow:hidden;position:relative">
      <div>
        <span class="lbl" style="color:var(--mintInk)">Уровень взят</span>
        <div class="dsp num" style="font-size:120px;line-height:.86;margin-top:4px">${l.level}</div>
      </div>
    </div>
    <div style="padding:0 var(--pad)">
      ${fresh.length ? `
        <span class="lbl" style="color:var(--dim);display:block;margin-top:20px">Открылось</span>
        ${fresh.map(it => `<div class="card violet" style="margin-top:10px;display:flex;align-items:center;gap:16px">
          <div class="hero" style="width:54px;height:64px">
            <img src="${charSrc(it.slot, it.id) || charSrc("body", ST.char.body)}" alt=""></div>
          <div><span class="lbl">Новая вещь</span>
            <div class="dsp" style="font-size:20px;line-height:1.05;margin-top:4px">${esc(it.n)}</div>
            <p class="hint" style="color:#fff;margin-top:5px">${esc(it.d)}</p></div>
        </div>`).join("")}
        <button class="btn" data-act="go:wardrobe">Примерить →</button>
      ` : `<p class="hint" style="margin-top:20px;text-align:center">Новых вещей пока нет, следующая ждёт впереди.</p>`}
      <button class="btn flat" data-act="go:home">Потом</button>
    </div>
  </div>`;
}

/* ── прогресс ── */
function vHistory() {
  const days = [];
  for (let i = 27; i >= 0; i--) days.push(daysAgo(i));
  const byDay = {};
  ST.sessions.forEach(s => (byDay[s.date] ||= []).push(s));

  const prs = [...new Set(ST.sessions.flatMap(s => (s.entries||[]).map(e => e.ex)))]
    .map(id => ({ id, ex:exById(id), best:bestSet(id) }))
    .filter(x => x.best)
    .sort((a,b) => b.best.v - a.best.v).slice(0, 5);

  const recent = [...ST.sessions].reverse().slice(0, 6);
  const firstDow = (parseDk(days[0]).getDay() + 6) % 7;

  return `<div class="scr">
    <div class="top"><div class="top-l">
      <span class="lbl">Последние 4 недели</span>
      <div class="top-h dsp">Прогресс</div></div>
      ${strengthStreak() ? `<div style="background:var(--mint);border-radius:999px;padding:9px 15px">
        <span class="lbl">Стрик ${plural(strengthStreak(),"неделя","недели","недель")}</span></div>` : ""}
    </div>

    <div class="dows">${DOWS.map(d => `<span>${d}</span>`).join("")}</div>
    <div class="cal">
      ${Array.from({length:firstDow},()=>`<div></div>`).join("")}
      ${days.map(k => {
        const ss = byDay[k] || [];
        const main = ss.find(s => s.type==="bjj") || ss.find(s => s.type==="strength") || ss[0];
        const t = main ? SESSION_TYPES[main.type] : null;
        const c = t?.c || "var(--fill)";
        return `<div class="cal-d ${main?"has":""}" style="background:${c};color:${t?.dark?"#fff":"var(--ink)"}">
          ${parseDk(k).getDate()}
          ${ss.some(s=>s.type==="strength") && main?.type!=="strength" ? `<i></i>` : ""}
        </div>`;
      }).join("")}
    </div>
    <div class="legend">
      ${["bjj","strength","run","mobility"].map(t =>
        `<div><b style="background:${SESSION_TYPES[t].c}"></b><span>${SESSION_TYPES[t].n}</span></div>`).join("")}
    </div>

    ${prs.length ? `
      <span class="lbl" style="color:var(--dim);display:block;margin-top:22px">Личные рекорды</span>
      <div class="rows">${prs.map(p => `<div class="row">
        <span class="row-n">${esc(p.ex.n)}</span>
        <span class="dsp num" style="font-size:15px">${p.best.w ? `${p.best.w} кг` : `${p.best.r} ${unit(p.ex)}`}</span>
        <span class="lbl" style="color:var(--dim)">${fmtDate(p.best.date)}</span></div>`).join("")}</div>
    ` : ""}

    ${recent.length ? `
      <span class="lbl" style="color:var(--dim);display:block;margin-top:22px">Последние</span>
      <div style="margin-top:10px">${recent.map(s => {
        const st = SESSION_TYPES[s.type] || { n:s.type, c:"var(--fill)" };
        return `<div class="srow">
          <div class="srow-i" style="background:${st.c}"></div>
          <div class="srow-b"><div class="srow-n">${esc(s.title || st.n)}</div>
            <div class="srow-s">${fmtDay(s.date)} · ${s.duration} мин · RPE ${s.rpe}</div></div>
          <span class="srow-l">${sessionLoad(s)}</span></div>`;
      }).join("")}</div>
    ` : `<div class="empty" style="margin-top:30px">
      <div class="empty-h dsp">Истории ещё нет</div>
      <p class="empty-p">Запиши первую сессию, и здесь появятся календарь, рекорды и нагрузка по неделям.</p></div>`}
  </div>${nav("history")}`;
}

/* ── профиль ── */
function vProfile() {
  const w = Object.entries(ST.weights).sort().slice(-1)[0];
  const noReview = ST.sessions.length
    ? Math.round((Date.now() - parseDk(ST.sessions[ST.sessions.length-1].date)) / 86400000) : 0;
  return `<div class="scr">
    <div class="top"><div class="top-l">
      <span class="lbl">${ST.profile.height} см${w ? " · " + w[1] + " кг" : ""}</span>
      <div class="top-h dsp">${esc(ST.profile.name || "Гора")}</div></div></div>

    <div class="card violet" style="margin-top:16px">
      <span class="lbl">Тренер</span>
      <div class="dsp" style="font-size:20px;line-height:1.1;margin-top:6px">Отдать данные и забрать план</div>
      <p class="hint" style="color:#fff;margin-top:8px">
        Шесть недель: подходы, RIR, нагрузка, вес, флаги. Вставляешь в чат, получаешь разбор и план.</p>
      <button class="btn mint" style="min-height:50px" data-act="export">Скопировать данные</button>
      <button class="btn line" style="min-height:48px;margin-top:8px;border-color:rgba(255,255,255,.4);color:#fff"
        data-act="import">Вставить план</button>
      <div style="display:flex;justify-content:space-between;margin-top:16px">
        ${[[ST.sessions.length,"сессий"],[Object.keys(ST.plans).length,"планов"],[noReview + " дн","без разбора"]]
          .map(([v,n]) => `<div><div class="dsp num" style="font-size:19px">${v}</div>
            <span class="lbl" style="color:#fff;margin:0">${n}</span></div>`).join("")}</div>
    </div>

    ${ST.flags.length ? `
      <div class="lad-h" style="margin-top:20px">
        <span class="lbl" style="color:var(--dim)">Что тренер держит</span>
        <span class="lbl" style="color:var(--violet)">${plural(ST.flags.length,"флаг","флага","флагов")}</span></div>
      <div class="rows">${ST.flags.map(f => `<div class="row">
        <div style="width:8px;height:8px;border-radius:4px;background:var(--violet);flex-shrink:0"></div>
        <span class="row-n" style="font-size:13px">${esc(f)}</span></div>`).join("")}</div>
    ` : ""}

    <span class="lbl" style="color:var(--dim);display:block;margin-top:20px">Настройки</span>
    <div class="rows">
      <button class="row" data-act="log-weight"><span class="row-n">Вес и замеры</span>
        <span class="row-v">${w ? w[1] + " кг" : "не записан"}</span><span class="row-x">→</span></button>
      <button class="row" data-act="backup"><span class="row-n">Резервная копия</span>
        <span class="row-v">скачать</span><span class="row-x">→</span></button>
      <button class="row" data-act="wipe"><span class="row-n" style="color:var(--pinkInk)">Стереть всё</span>
        <span class="row-x">→</span></button>
    </div>
    <p class="hint" style="margin-top:14px;padding:0 4px">Данные лежат в браузере на телефоне. Резервная копия это единственный способ их не потерять.</p>
  </div>${nav("profile")}`;
}

/* ═══ ШИТЫ ═══════════════════════════════════════════════════════════ */
let DRAFT = {};   // черновик ввода: вес, повторы, длительность, RPE

function sheetHtml() {
  if (!SHEET) return "";
  if (SHEET.kind === "numpad") return npHtml();
  if (SHEET.kind === "picker") return pickerHtml();
  if (SHEET.kind === "adjust") return adjustHtml();
  return "";
}

/* ── нампад: вписывать, а не крутить ── */
function npHtml() {
  const f = SHEET.fields, cur = SHEET.field;
  const val = SHEET.vals[cur] ?? "";
  const meta = f.find(x => x.k === cur);
  const KEYS = ["1","2","3","4","5","6","7","8","9",".","0","⌫"];
  return `<div class="scrim" data-act="sheet-x"></div><div class="sheet">
    <div class="grab"></div>
    <div class="np-fields">${f.map(x => `
      <button class="np-f ${x.k===cur?"on":""}" data-act="np-f:${x.k}">
        <span class="lbl">${esc(x.n)}</span>
        <span class="np-v"><b class="num">${esc(SHEET.vals[x.k] ?? "")}</b><i></i><u>${esc(x.u)}</u></span>
      </button>`).join("")}</div>

    ${meta.quick?.length ? `<div class="np-quick">${meta.quick.map(q => `
      <button class="np-q ${String(q.v)===String(val)?"on":""}" data-act="np-q:${q.v}">${esc(q.n)}</button>`).join("")}
    </div>` : ""}

    <div class="np-keys">${KEYS.map(k => `
      <button class="np-k ${k==="⌫"?"wipe":""}" data-act="np-k:${k}">${k}</button>`).join("")}</div>

    <button class="btn" data-act="${SHEET.done}">${esc(SHEET.cta)}</button>
  </div>`;
}

function pickerHtml() {
  const q = (SHEET.q || "").toLowerCase();
  const loc = SHEET.loc || "all";
  const list = allEx()
    .filter(e => loc === "all" || e.loc === loc || e.loc === "both")
    .filter(e => !q || e.n.toLowerCase().includes(q))
    .slice(0, 60);
  return `<div class="scrim" data-act="sheet-x"></div><div class="sheet">
    <div class="grab"></div>
    <div class="sheet-h dsp">Что делаем</div>
    <input class="inp" id="pk-q" placeholder="Поиск" value="${esc(SHEET.q||"")}" style="margin-top:12px" autocomplete="off">
    <div class="chips" style="margin-top:0">
      ${[["all","Всё"],["gym","Зал"],["home","Дом"]].map(([k,n]) =>
        `<button class="chip dark ${loc===k?"on":""}" data-act="pk-loc:${k}">${n}</button>`).join("")}
    </div>
    <div class="rows" style="margin-top:12px">${list.map(e => `
      <button class="row" data-act="add-ex:${e.id}">
        <span class="row-n">${esc(e.n)}</span>
        <span class="row-v">${esc(PATTERNS[e.p] || "")}</span>
        <span class="row-x">+</span></button>`).join("") ||
      `<p class="hint" style="padding:14px">Ничего не нашлось.</p>`}</div>
  </div>`;
}

/* ── «сегодня не тяну»: план это предложение, а не приказ ── */
function adjustHtml() {
  const OPTS = [
    { id:"light", n:"Облегчить", d:"Веса минус двадцать процентов, запас три вместо двух" },
    { id:"short", n:"Урезать",   d:"Два упражнения вместо четырёх, самое важное остаётся" },
    { id:"skip",  n:"Пропустить сегодня", d:"Мат был тяжёлый или просто нет сил" },
  ];
  const pick = SHEET.pick || "light";
  return `<div class="scrim" data-act="sheet-x"></div><div class="sheet">
    <div class="grab"></div>
    <div class="sheet-h dsp">Сегодня не тяну</div>
    <p class="sheet-p">План это предложение, а не приказ. Молча пропустить хуже: тренер не узнает почему.</p>
    <div style="margin-top:16px;display:flex;flex-direction:column;gap:8px">
      ${OPTS.map(o => `<button class="item" style="text-align:left;padding:14px 16px;display:flex;
        align-items:center;gap:12px;${o.id===pick?"background:var(--mint);border-color:var(--ink)":""}"
        data-act="adj-p:${o.id}">
        <div style="width:20px;height:20px;border-radius:10px;border:2px solid ${o.id===pick?"var(--ink)":"#C9C6C4"};
          background:${o.id===pick?"var(--ink)":"transparent"};flex-shrink:0"></div>
        <div><div class="dsp" style="font-size:15px">${o.n}</div>
          <div style="font-size:12px;font-weight:500;margin-top:3px;
            color:${o.id===pick?"var(--mintInk)":"var(--dim)"}">${o.d}</div></div>
      </button>`).join("")}
    </div>
    <button class="btn" data-act="adj-go:${pick}">Поменять план</button>
    <button class="btn flat" data-act="sheet-x">Оставить как есть</button>
  </div>`;
}

/* ═══ ТАЙМЕР ОТДЫХА ══════════════════════════════════════════════════ */
function startRest(sec) {
  REST = { until: Date.now() + sec*1000, total: sec };
  tickRest();
}
function tickRest() {
  const el = $("#rest");
  if (!el) return;
  const left = Math.max(0, Math.round((REST.until - Date.now())/1000));
  if (!left) { el.innerHTML = ""; return; }
  const pct = left / REST.total * 100;
  el.innerHTML = `<div class="rest"><i style="width:${pct}%"></i>
    <span class="lbl">Отдых</span><span class="t">${Math.floor(left/60)}:${pad(left%60)}</span>
    <button class="lbl" style="color:var(--dim)" data-act="rest-x">пропустить</button></div>`;
  setTimeout(tickRest, 1000);
}

/* ═══ ДЕЙСТВИЯ ═══════════════════════════════════════════════════════ */
function startSession(type, plan) {
  ST.active = {
    id: uid(), date: today(), type,
    title: plan?.session || null,
    startedAt: Date.now(), entries: [], done: false,
  };
  if (plan?.items?.length) {
    ST.active.entries = plan.items.map(it => ({ ex: it.ex, sets: [], target: it }));
    VIEW.exId = plan.items[0].ex;
  }
  save();
  go("session");
}

function saveFinished(extra = {}) {
  const a = ST.active;
  if (!a) return;
  const before = lvl().level;
  const s = { ...a, ...extra, done:true };
  s.entries = (s.entries || []).filter(e => e.sets.length);
  ST.sessions.push(s);
  ST.sessions.sort((x,y) => x.date.localeCompare(y.date));
  ST.active = null;
  DRAFT = {};
  save();
  const fresh = checkUnlocks();
  const after = lvl().level;
  if (after > before || fresh.length) {
    ST.seenLevel = after; save();
    go("levelup", { fresh });
  } else {
    go("home");
    toast(`Записано: нагрузка ${sessionLoad(s)}, опыт +${Math.round(sessionLoad(s)/3)}`);
  }
}

function exportForCoach() {
  const from = daysAgo(41);
  const weeks = {};
  ST.sessions.filter(s => s.date >= from).forEach(s => {
    const d = parseDk(s.date); const day = (d.getDay()+6)%7;
    const mon = new Date(d); mon.setDate(d.getDate()-day);
    (weeks[dk(mon)] ||= []).push(s);
  });
  const out = {
    kind: "bloom-export",
    at: new Date().toISOString(),
    profile: { ...ST.profile, level: lvl().level, xp: totalXp() },
    weight: Object.entries(ST.weights).sort().slice(-8),
    flags: ST.flags,
    acwr: acwr() ? +acwr().toFixed(2) : null,
    streakWeeks: strengthStreak(),
    matWeeks: matWeeks(),
    weekLoads: Object.fromEntries(Object.entries(weeks)
      .map(([k,v]) => [k, v.reduce((a,s)=>a+sessionLoad(s),0)])),
    sessions: ST.sessions.filter(s => s.date >= from).map(s => ({
      date: s.date, type: s.type, title: s.title || null,
      duration: s.duration, rpe: s.rpe, load: sessionLoad(s), notes: s.notes || null,
      entries: (s.entries||[]).map(e => ({
        ex: e.ex, n: exById(e.ex).n,
        sets: e.sets.map(x => ({ w:x.w||0, r:x.r||0, rir:x.rir ?? null })),
      })),
    })),
  };
  copy(JSON.stringify(out, null, 1), "Скопировано. Вставляй в чат тренеру.");
}

function copy(txt, okMsg) {
  const done = () => toast(okMsg);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(txt).then(done, () => fallback());
  } else fallback();
  function fallback() {
    const ta = document.createElement("textarea");
    ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch { toast("Не вышло скопировать"); }
    ta.remove();
  }
}

function importPlan() {
  const raw = prompt("Вставь JSON плана от тренера");
  if (!raw) return;
  let data;
  try { data = JSON.parse(raw); } catch { return toast("Это не JSON"); }
  const list = Array.isArray(data) ? data : data.plans ? data.plans : [data];
  let n = 0, badEx = [];
  list.forEach(p => {
    if (!p?.date) return;
    (p.items || []).forEach(it => { if (!EX_BY_ID[it.ex] && !ST.customEx.find(e=>e.id===it.ex)) badEx.push(it.ex); });
    ST.plans[p.date] = p;
    /* Флаги перезаписывают список целиком: тренер отдаёт полный актуальный набор. */
    if (Array.isArray(p.flags)) ST.flags = p.flags;
    n++;
  });
  save();
  go("home");
  toast(badEx.length
    ? `Планов: ${n}. Не нашёл упражнения: ${[...new Set(badEx)].join(", ")}`
    : `Планов принято: ${n}`);
}

function backup() {
  const blob = new Blob([JSON.stringify(ST, null, 1)], { type:"application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bloom-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ═══ СОБЫТИЯ ════════════════════════════════════════════════════════ */
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-act]");
  if (!b) return;
  const [act, ...args] = b.dataset.act.split(":");
  const a = ST.active;

  switch (act) {
    case "go": VIEW.name = args[0]; SHEET = null; window.scrollTo(0,0); return render();
    case "sheet-x": SHEET = null; return render();

    /* онбординг */
    case "onb-p": VIEW.pants = args[0]; return render();
    case "onb-go": {
      const nm = $("#onb-name")?.value.trim();
      const w  = parseFloat($("#onb-w")?.value);
      if (!nm) return toast("Как тебя звать?");
      ST.profile.name = nm;
      ST.char.body = VIEW.pants || "leopard";
      if (w > 0) { ST.weights[today()] = w; ST.profile.startWeight = w; }
      save(); return go("home");
    }

    /* старт и план */
    case "start": return startSession(args[0], null);
    case "start-plan": {
      const p = ST.plans[today()];
      return startSession(p?.kind || "strength", p);
    }
    case "quick": DRAFT = {}; return go("quick", { qType: args[0] });
    case "q-type": DRAFT = {}; VIEW.qType = args[0]; return render();
    case "q-save": {
      const t = VIEW.qType || "bjj";
      const dur = DRAFT.dur ?? (t === "bjj" ? 90 : t === "run" ? 35 : 15);
      const rpe = DRAFT.rpe ?? (t === "bjj" ? 7 : 5);
      ST.active = { id:uid(), date:today(), type:t, entries:[],
        run: t === "run" ? { km: DRAFT.km ?? 6 } : null };
      return saveFinished({ duration:dur, rpe });
    }

    /* сессия */
    case "picker": SHEET = { kind:"picker", q:"", loc:"all" }; return render();
    case "pk-loc": SHEET.loc = args[0]; return render();
    case "add-ex": {
      if (!a) return;
      if (!a.entries.find(e => e.ex === args[0])) a.entries.push({ ex:args[0], sets:[] });
      VIEW.exId = args[0]; SHEET = null; DRAFT = {}; save(); return render();
    }
    case "pick-ex": VIEW.exId = args[0]; DRAFT = {}; return render();
    case "np": {
      const ex = exById(args[0]), s = suggest(args[0]);
      SHEET = { kind:"numpad", field:"w",
        vals:{ w:String(DRAFT.w ?? s.w ?? 0), r:String(DRAFT.r ?? s.r) },
        fields:[
          { k:"w", n:"Вес", u:"кг", quick: lastSet(args[0])
            ? [{ n:`${lastSet(args[0]).w} как в прошлый`, v:lastSet(args[0]).w },
               { n:`−${ex.step}`, v:"-" }, { n:`+${ex.step}`, v:"+" }] : [] },
          { k:"r", n:"Повторы", u:unit(ex), quick: lastSet(args[0])
            ? [{ n:`${lastSet(args[0]).r} как в прошлый`, v:lastSet(args[0]).r },
               { n:"−1", v:"-" }, { n:"+1", v:"+" }] : [] },
        ],
        step:{ w:ex.step || 2.5, r:1 },
        cta:"Записать подход", done:`np-set-done:${args[0]}` };
      return render();
    }
    case "np-f": SHEET.field = args[0]; SHEET.fresh = true; return render();
    case "np-k": {
      const k = args[0], f = SHEET.field;
      let v = SHEET.fresh === false ? String(SHEET.vals[f] ?? "") : "";
      if (k === "⌫") { v = String(SHEET.vals[f] ?? "").slice(0, -1) || "0"; SHEET.fresh = false; }
      else if (k === "." && v.includes(".")) { /* вторую точку не пускаем */ }
      else if (v.replace(".","").length < 5) { v = (v === "0" && k !== ".") ? k : v + k; SHEET.fresh = false; }
      SHEET.vals[f] = v;
      return render();
    }
    case "np-q": {
      const f = SHEET.field, step = SHEET.step[f];
      const cur = parseFloat(SHEET.vals[f]) || 0;
      SHEET.vals[f] = args[0] === "+" ? String(Math.round((cur + step)*10)/10)
                    : args[0] === "-" ? String(Math.max(0, Math.round((cur - step)*10)/10))
                    : args[0];
      SHEET.fresh = false;
      return render();
    }
    case "np-set": {   /* тренер предложил вес и повторы */
      DRAFT.w = parseFloat(args[0]); DRAFT.r = parseFloat(args[1]);
      COACH.dismissed = "session";
      return render();
    }
    case "np-set-done": {
      if (!a) return;
      const e = a.entries.find(x => x.ex === args[0]);
      if (!e) return;
      const w = parseFloat(SHEET.vals.w) || 0, r = parseFloat(SHEET.vals.r) || 0;
      if (!r) { SHEET = null; return toast("Повторы не заданы"); }
      /* Запас спрашиваем не здесь, а лесенкой на экране сессии сразу после
         записи: лишний шаг в шите между подходами это лишние две секунды. */
      e.sets.push({ w, r, rir:null, at:Date.now() });
      DRAFT = {}; COACH.lastSetAt = Date.now();
      SHEET = null;
      startRest(90);
      save(); return render();
    }
    case "set-rir": {
      if (!a) return;
      const e = a.entries.find(x => x.ex === VIEW.exId);
      const last = e?.sets[e.sets.length-1];
      if (last) { last.rir = +args[0]; save(); }
      return render();
    }
    case "rest-x": REST.until = 0; return render();

    /* завершение */
    case "finish": {
      if (!a) return;
      DRAFT = { dur: Math.max(5, Math.round((Date.now()-(a.startedAt||Date.now()))/60000)), rpe:7 };
      return go("finish");
    }
    case "fin-rpe": DRAFT.rpe = +args[0]; return render();
    case "fin-save": return saveFinished({ duration: DRAFT.dur ?? 40, rpe: DRAFT.rpe ?? 7 });
    case "fin-drop": ST.active = null; DRAFT = {}; save(); return go("home");
    case "np-dur": {
      SHEET = { kind:"numpad", field:"dur", vals:{ dur:String(DRAFT.dur ?? 40) },
        fields:[{ k:"dur", n:"Длительность", u:"мин",
          quick:[{n:"20",v:20},{n:"35",v:35},{n:"60",v:60}] }],
        step:{ dur:5 }, cta:"Готово", done:"np-dur-done" };
      return render();
    }
    case "np-dur-done": DRAFT.dur = parseInt(SHEET.vals.dur) || 40; SHEET = null; return render();
    case "np-km": {
      SHEET = { kind:"numpad", field:"km", vals:{ km:String(DRAFT.km ?? 6) },
        fields:[{ k:"km", n:"Дистанция", u:"км", quick:[{n:"5",v:5},{n:"−0.5",v:"-"},{n:"+0.5",v:"+"}] }],
        step:{ km:0.5 }, cta:"Готово", done:"np-km-done" };
      return render();
    }
    case "np-km-done": DRAFT.km = parseFloat(SHEET.vals.km) || 0; SHEET = null; return render();

    /* «не тяну» */
    case "adjust": SHEET = { kind:"adjust", pick:"light" }; return render();
    case "adj-p": SHEET.pick = args[0]; return render();
    case "adj-go": {
      const p = ST.plans[today()];
      if (!p) { SHEET = null; return render(); }
      if (args[0] === "skip") { delete ST.plans[today()]; save(); SHEET = null; go("home");
        return toast("План снят. Тренер увидит пропуск и причину в выгрузке."); }
      if (args[0] === "light") p.items = (p.items||[]).map(it =>
        ({ ...it, weight: it.weight ? Math.round(it.weight*0.8*2)/2 : it.weight, rir:3 }));
      if (args[0] === "short") p.items = (p.items||[]).slice(0, 2);
      save(); SHEET = null; render();
      return toast(args[0] === "light" ? "Веса срезаны на двадцать процентов" : "Оставил два упражнения");
    }

    /* герой и гардероб */
    case "wd": VIEW.tab = args[0]; VIEW.sel = ST.char[args[0]]; return go("wardrobe");
    case "wear": {
      const [slot, id] = args;
      VIEW.sel = id;
      if (has(id)) { ST.char[slot] = id; save(); }
      return render();
    }

    /* тренер */
    case "coach-ok": COACH.dismissed = VIEW.name === "session" ? "session" : "home"; return render();

    /* профиль */
    case "export": return exportForCoach();
    case "import": return importPlan();
    case "backup": return backup();
    case "log-weight": {
      const v = prompt("Вес сегодня, кг", Object.entries(ST.weights).sort().slice(-1)[0]?.[1] ?? "85");
      const n = parseFloat(String(v).replace(",", "."));
      if (n > 20 && n < 300) { ST.weights[today()] = n; save(); render(); toast("Записал " + n + " кг"); }
      return;
    }
    case "wipe": {
      if (!confirm("Стереть все данные без возврата?")) return;
      if (!confirm("Точно? Резервную копию скачал?")) return;
      localStorage.removeItem(KEY);
      ST = structuredClone(BLANK);
      return go("home");
    }
  }
});

document.addEventListener("input", ev => {
  if (ev.target.id === "pk-q" && SHEET?.kind === "picker") {
    SHEET.q = ev.target.value;
    const scroll = window.scrollY;
    render();
    $("#pk-q")?.focus();
    window.scrollTo(0, scroll);
  }
});

render();
if ("serviceWorker" in navigator)
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
