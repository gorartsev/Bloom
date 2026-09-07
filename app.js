/* BLOOM — тренировочный лог. Ванильный JS, без зависимостей, работает офлайн. */

/* ═══ ХРАНИЛИЩЕ ═══════════════════════════════════════════════════════ */
const KEY = "bloom";

const BLANK = {
  v: 2,
  profile: { name:null, height:185, startWeight:null, birth:2003 },
  settings: { theme:"dark" },
  sessions: [],      // завершённые
  active: null,      // текущая, живёт между запусками
  weights: {},       // 'YYYY-MM-DD' -> кг
  plans: {},         // 'YYYY-MM-DD' -> план от тренера
  flags: [],         // carry-forward от тренера
  customEx: [],      // упражнения, добавленные руками
};

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
  if (!raw) return structuredClone(BLANK);
  if (raw.v === 2) return { ...structuredClone(BLANK), ...raw,
    profile:{...BLANK.profile, ...(raw.profile||{})},
    settings:{...BLANK.settings, ...(raw.settings||{})} };
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

const MON = ["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const DAYS = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];
const fmtDate = k => { const d = parseDk(k); return `${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtDay  = k => k === today() ? "сегодня" : k === daysAgo(1) ? "вчера" : fmtDate(k);

const allEx = () => [...EXERCISES, ...ST.customEx];
const exById = id => EX_BY_ID[id] || ST.customEx.find(e => e.id === id) || { id, n:id, p:"other", eq:"none", step:2.5, reps:[8,12], tags:[] };
const unit = ex => ex.u === "s" ? "сек" : "повт";

/* Нагрузка сессии по Фостеру: минуты × RPE */
const sessionLoad = s => (s.duration || 0) * (s.rpe || 0);
const loadBetween = (from, to) => ST.sessions
  .filter(s => s.date >= from && s.date <= to)
  .reduce((a,s) => a + sessionLoad(s), 0);

/* Отношение острой нагрузки к хронической. Грубый светофор, не закон. */
function acwr() {
  const acute = loadBetween(daysAgo(6), today());
  const chronic = loadBetween(daysAgo(27), today()) / 4;
  if (chronic < 50) return null;
  return acute / chronic;
}

/* Оценка разового максимума, формула Эпли */
const e1rm = (w, r) => (!w || !r) ? 0 : Math.round(w * (1 + r/30));

/* Вся история подходов по упражнению, свежие первыми */
function exHistory(exId) {
  const out = [];
  [...ST.sessions].reverse().forEach(s => {
    (s.entries || []).forEach(e => {
      if (e.exId === exId && e.sets.length) out.push({ date:s.date, sets:e.sets });
    });
  });
  return out;
}

function lastSet(exId) {
  const h = exHistory(exId);
  if (!h.length) return null;
  const sets = h[0].sets;
  return { ...sets[sets.length-1], date:h[0].date };
}

function bestSet(exId) {
  let best = null;
  exHistory(exId).forEach(h => h.sets.forEach(s => {
    const score = s.w ? e1rm(s.w, s.r) : s.r;
    if (!best || score > best.score) best = { ...s, score, date:h.date };
  }));
  return best;
}

/* Двойная прогрессия: добираем повторы внутри диапазона, потом добавляем вес.
   Гейт: последний подход прошлого раза с запасом (RIR >= 1) и на верхе диапазона. */
function suggest(exId) {
  const ex = exById(exId);
  const h = exHistory(exId);
  if (!h.length) return { w:0, r:ex.reps[0], rir:2, why:"первый раз, начни осторожно" };
  const sets = h[0].sets;
  const top = sets[sets.length-1];
  const hitTop = sets.every(s => s.r >= ex.reps[1]);
  const hasRoom = (top.rir ?? 0) >= 1;
  if (hitTop && hasRoom && ex.step > 0)
    return { w:+(top.w + ex.step).toFixed(1), r:ex.reps[0], rir:2, why:`+${ex.step} кг: диапазон закрыт с запасом` };
  if (hitTop && hasRoom && ex.step === 0)
    return { w:0, r:top.r + (ex.u === "s" ? 5 : 1), rir:2, why:"добавь повтор, прошлый раз был с запасом" };
  if ((top.rir ?? 2) === 0)
    return { w:top.w, r:top.r, rir:1, why:"прошлый раз ушёл в отказ, вес держим" };
  return { w:top.w, r:Math.min(top.r + 1, ex.reps[1]), rir:2, why:"добираем повторы до верха диапазона" };
}

/* ═══ ТЕМЫ ═══════════════════════════════════════════════════════════ */
const THEMES = {
  dark: {
    bg:"#0D0F14", card:"#161A22", cardDim:"#1E2430", text:"#EDF0F5",
    dim:"#8D97A8", soft:"#5A6373", line:"#252B37",
    accent:"#FF5A3C", accentSoft:"#FF5A3C22", ok:"#4ADE80", warn:"#FBBF24", bad:"#F43F5E",
  },
  bloom: {
    bg:"#F6EFEE", card:"#FFFFFF", cardDim:"#FBF4F3", text:"#2B1F26",
    dim:"#8E7A84", soft:"#C4AEBA", line:"#EFD5E3",
    accent:"#E396DF", accentSoft:"#F8DCEF", ok:"#9BC791", warn:"#E0A458", bad:"#D4707E",
  },
};

function applyTheme() {
  const t = THEMES[ST.settings.theme] || THEMES.dark;
  const r = document.documentElement;
  Object.entries(t).forEach(([k,v]) => r.style.setProperty(`--${k}`, v));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.bg);
  r.style.colorScheme = ST.settings.theme === "dark" ? "dark" : "light";
}

/* ═══ СОСТОЯНИЕ ЭКРАНА ═══════════════════════════════════════════════ */
let VIEW = { name:"home", exId:null, pickFor:null, month:null, filter:"all" };
let REST = { until:0, total:0 };
let DRAFT = {};   // черновик ввода подхода по exId

/* ═══ РЕНДЕР ═════════════════════════════════════════════════════════ */
function render() {
  const root = $("#root");
  const y = window.scrollY;
  if (!ST.profile.name) { root.innerHTML = vOnboard(); return; }
  const map = { home:vHome, session:vSession, picker:vPicker, exercise:vExercise,
                history:vHistory, progress:vProgress, settings:vSettings, finish:vFinish,
                day:vDay, sview:vSessionView };
  root.innerHTML = (map[VIEW.name] || vHome)();
  if (VIEW.keepScroll) { window.scrollTo(0, y); VIEW.keepScroll = false; }
  tickRest();
}

const go = (name, extra={}) => { VIEW = { ...VIEW, name, ...extra }; window.scrollTo(0,0); render(); };
const rerender = () => { VIEW.keepScroll = true; render(); };

/* ── компоненты ── */
const header = (title, sub, back, right="") => `
  <div class="hdr">
    ${back ? `<button class="ic" data-act="${back}">←</button>` : `<div class="ic-sp"></div>`}
    <div class="hdr-t"><div class="hdr-title">${esc(title)}</div>${sub ? `<div class="hdr-sub">${esc(sub)}</div>` : ""}</div>
    <div class="hdr-r">${right}</div>
  </div>`;

const nav = active => `
  <div class="nav">
    ${[["home","Сегодня","▦"],["history","История","☰"],["progress","Прогресс","◔"],["settings","Профиль","⚙"]]
      .map(([v,l,i]) => `<button class="nav-b ${active===v?"on":""}" data-act="go:${v}"><span class="nav-i">${i}</span>${l}</button>`).join("")}
  </div>`;

/* ═══ ОНБОРДИНГ ══════════════════════════════════════════════════════ */
function vOnboard() {
  return `
  <div class="onb">
    <div class="onb-logo">🌸</div>
    <h1 class="onb-h1">BLOOM</h1>
    <p class="onb-p">Лог тренировок, мата и бега</p>
    <div class="card onb-card">
      <label class="lbl">Как тебя зовут</label>
      <input id="onb-name" class="inp" placeholder="Имя" autocomplete="off">
      <div class="row2">
        <div><label class="lbl">Рост, см</label><input id="onb-h" class="inp" inputmode="numeric" value="185"></div>
        <div><label class="lbl">Вес, кг</label><input id="onb-w" class="inp" inputmode="decimal" placeholder="85"></div>
      </div>
      <button class="btn" data-act="onb-go">Начать</button>
    </div>
    <div class="onb-foot">Всё хранится на устройстве. Работает офлайн.</div>
  </div>`;
}

/* ═══ ГЛАВНЫЙ ЭКРАН ══════════════════════════════════════════════════ */
function vHome() {
  const t = today();
  const todaySessions = ST.sessions.filter(s => s.date === t);
  const plan = ST.plans[t];
  const wk = weekStrip();
  const load7 = loadBetween(daysAgo(6), t);
  const ratio = acwr();
  const lastW = Object.entries(ST.weights).sort((a,b)=>a[0].localeCompare(b[0])).pop();

  let ratioTag = "";
  if (ratio !== null) {
    const [cls, txt] = ratio > 1.5 ? ["bad","резкий скачок"]
      : ratio > 1.3 ? ["warn","растёт быстро"]
      : ratio < 0.8 ? ["dim","спад"] : ["ok","в коридоре"];
    ratioTag = `<span class="tag ${cls}">${ratio.toFixed(2)} · ${txt}</span>`;
  }

  return `
  <div class="scr">
    <div class="top">
      <div><div class="top-hi">Привет, ${esc(ST.profile.name)}</div>
      <div class="top-d">${DAYS[new Date().getDay()]}, ${fmtDate(t)}</div></div>
      <button class="ic" data-act="go:settings">⚙</button>
    </div>

    ${ST.active ? `
      <button class="card live" data-act="go:session">
        <div class="live-l"><span class="dot"></span>${ST.active.back ? "Запись за "+fmtDay(ST.active.date) : "Сессия идёт"}</div>
        <div class="live-n">${SESSION_TYPES[ST.active.type].ic} ${SESSION_TYPES[ST.active.type].n}</div>
        <div class="live-s">${activeSummary(ST.active)} · продолжить →</div>
      </button>` : ""}

    ${ST.flags.length ? `
      <div class="card flags">
        <div class="lbl">🚩 От тренера</div>
        ${ST.flags.map(f => `<div class="flag">${esc(f)}</div>`).join("")}
      </div>` : ""}

    ${plan ? `
      <div class="card plan">
        <div class="plan-h"><div class="lbl">План на сегодня</div><div class="plan-n">${esc(plan.session||"Тренировка")}</div></div>
        ${(plan.items||[]).map(i => {
          const ex = exById(i.ex);
          return `<div class="plan-i"><span>${esc(ex.n)}</span><span class="plan-t">${i.sets}×${esc(String(i.reps))}${i.weight?` · ${i.weight}кг`:""}</span></div>`;
        }).join("")}
        ${plan.note ? `<div class="plan-note">${esc(plan.note)}</div>` : ""}
        <button class="btn" data-act="start:${plan.kind||"strength"}">Начать по плану</button>
      </div>` : ""}

    <div class="lbl pad">Записать</div>
    <div class="grid3">
      ${Object.entries(SESSION_TYPES).filter(([k]) => k!=="other").map(([k,v]) => `
        <button class="tile" data-act="start:${k}" style="--tc:${v.c}">
          <span class="tile-i">${v.ic}</span><span class="tile-n">${v.n}</span>
        </button>`).join("")}
      <button class="tile" data-act="w-log" style="--tc:#94A3B8"><span class="tile-i">⚖️</span><span class="tile-n">Вес</span></button>
      <button class="tile" data-act="start:other" style="--tc:#64748B"><span class="tile-i">⚡</span><span class="tile-n">Другое</span></button>
    </div>

    <div class="lbl pad">Неделя</div>
    <div class="card">
      <div class="wk">${wk}</div>
      <div class="wk-sum">
        <div><div class="wk-v">${load7}</div><div class="wk-l">нагрузка за 7 дней</div></div>
        <div class="wk-tag">${ratioTag}</div>
      </div>
    </div>

    ${todaySessions.length ? `
      <div class="lbl pad">Сегодня записано</div>
      ${todaySessions.map(s => sessionRow(s)).join("")}` : ""}

    ${lastW ? `
      <button class="card wcard" data-act="w-log">
        <div><div class="lbl">Вес</div><div class="wcard-v">${lastW[1]} <span>кг</span></div></div>
        <div class="wcard-d">${fmtDay(lastW[0])}</div>
      </button>` : ""}

    <div class="sp"></div>
  </div>
  ${nav("home")}`;
}

function weekStrip() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const k = daysAgo(i);
    const d = parseDk(k);
    const ss = ST.sessions.filter(s => s.date === k);
    const load = ss.reduce((a,s)=>a+sessionLoad(s),0);
    const h = load ? Math.max(14, Math.min(52, load/12)) : 4;
    const planned = WEEK_TEMPLATE[d.getDay()]?.planned || [];
    out.push(`
      <div class="wk-d ${i===0?"now":""}">
        <div class="wk-bars">${ss.length
          ? ss.map(s=>`<div class="wk-bar" style="height:${h/ss.length+6}px;background:${SESSION_TYPES[s.type]?.c||"#64748B"}"></div>`).join("")
          : `<div class="wk-bar empty" style="height:4px"></div>`}</div>
        <div class="wk-n">${DAYS[d.getDay()]}</div>
        <div class="wk-p">${ss.length ? ss.map(s=>SESSION_TYPES[s.type]?.ic||"").join("") : (i===0? planned.map(p=>SESSION_TYPES[p]?.ic||"").join("") : "")}</div>
      </div>`);
  }
  return out.join("");
}

const activeSummary = s => {
  const sets = (s.entries||[]).reduce((a,e)=>a+e.sets.length,0);
  const mins = Math.round((Date.now() - s.startTs)/60000);
  return sets ? `${sets} подх. · ${mins} мин` : `${mins} мин`;
};

const tonnage = s => (s.entries||[]).reduce((a,e)=>a+e.sets.reduce((x,st)=>x+(st.w||0)*(st.r||0),0),0);
const fmtVol = v => !v ? "" : v >= 1000 ? `${(v/1000).toFixed(1)} т` : `${Math.round(v)} кг`;

function sessionRow(s) {
  const t = SESSION_TYPES[s.type] || SESSION_TYPES.other;
  const sets = (s.entries||[]).reduce((a,e)=>a+e.sets.length,0);
  const bits = [
    s.duration ? `${s.duration} мин` : "",
    s.rpe ? `RPE ${s.rpe}` : "",
    sets ? `${sets} подх.` : "",
    fmtVol(tonnage(s)),
    s.run?.km ? `${s.run.km} км` : "",
  ].filter(Boolean).join(" · ");
  return `
    <button class="card srow" data-act="open-s:${s.id}">
      <div class="srow-i" style="background:${t.c}22;color:${t.c}">${t.ic}</div>
      <div class="srow-b">
        <div class="srow-n">${esc(s.name || t.n)}</div>
        <div class="srow-s">${esc(bits)}</div>
      </div>
      <div class="srow-l">${sessionLoad(s)}</div>
    </button>`;
}

/* ═══ АКТИВНАЯ СЕССИЯ ════════════════════════════════════════════════ */
function vSession() {
  const s = ST.active;
  if (!s) { VIEW.name = "home"; return vHome(); }
  const t = SESSION_TYPES[s.type];
  const mins = s.back ? (s.duration || 45) : Math.round((Date.now() - s.startTs)/60000);

  if (t.mode === "strength") return vSessionStrength(s, t, mins);
  return vSessionQuick(s, t, mins);
}

function vSessionStrength(s, t, mins) {
  return `
  <div class="scr">
    ${header(`${t.ic} ${t.n}`, s.back ? fmtDay(s.date) : `${mins} мин`, "go:home",
      `<button class="ic" data-act="finish">✓</button>`)}
    <div id="rest" class="rest hide"></div>

    ${(s.entries||[]).map((e,i) => exCard(e, i)).join("")}

    <button class="btn ghost" data-act="pick">+ Добавить упражнение</button>
    <button class="btn" data-act="finish">Завершить тренировку</button>
    <button class="btn flat" data-act="cancel">Отменить сессию</button>
    <div class="sp"></div>
  </div>`;
}

function exCard(e, idx) {
  const ex = exById(e.exId);
  const open = VIEW.exId === e.exId;
  const sug = suggest(e.exId);
  const d = DRAFT[e.exId] || (DRAFT[e.exId] = {
    w: e.sets.length ? e.sets[e.sets.length-1].w : (e.target?.weight ?? sug.w),
    r: e.sets.length ? e.sets[e.sets.length-1].r : (parseInt(e.target?.reps) || sug.r),
    rir: e.sets.length ? e.sets[e.sets.length-1].rir : sug.rir,
  });
  const last = lastSet(e.exId);
  const u = unit(ex);

  return `
  <div class="card ex ${open?"open":""}">
    <button class="ex-h" data-act="toggle:${e.exId}">
      <div class="ex-hb">
        <div class="ex-n">${esc(ex.n)}</div>
        <div class="ex-s">${e.target ? `цель ${e.target.sets}×${e.target.reps}` : PATTERNS[ex.p] || ""}${last ? ` · прошлый раз ${last.w?last.w+"кг × ":""}${last.r}${ex.u==="s"?"с":""}` : ""}</div>
      </div>
      <div class="ex-c">${e.sets.length}</div>
    </button>

    ${e.sets.length ? `<div class="sets">${e.sets.map((st,i) => `
      <button class="set" data-act="delset:${e.exId}:${i}">
        <span class="set-n">${i+1}</span>
        ${st.w ? `<span class="set-w">${st.w}</span><span class="set-u">кг</span>` : ""}
        <span class="set-r">${st.r}</span><span class="set-u">${ex.u==="s"?"с":""}</span>
        ${st.rir!=null ? `<span class="set-rir">RIR ${st.rir}</span>` : ""}
      </button>`).join("")}</div>` : ""}

    ${open ? `
    <div class="pane">
      ${ex.cue ? `<div class="cue">💡 ${esc(ex.cue)}</div>` : ""}
      <div class="sug">${esc(sug.why)}</div>

      ${ex.step > 0 ? `
      <div class="stepper">
        <button class="st-b" data-act="d:${e.exId}:w:-${ex.step}">−</button>
        <div class="st-v"><span>${d.w}</span><small>кг</small></div>
        <button class="st-b" data-act="d:${e.exId}:w:${ex.step}">+</button>
      </div>` : ""}

      <div class="stepper">
        <button class="st-b" data-act="d:${e.exId}:r:-${ex.u==="s"?5:1}">−</button>
        <div class="st-v"><span>${d.r}</span><small>${u}</small></div>
        <button class="st-b" data-act="d:${e.exId}:r:${ex.u==="s"?5:1}">+</button>
      </div>

      <div class="rirs">
        ${[0,1,2,3,4].map(v => `<button class="rir ${d.rir===v?"on":""}" data-act="d:${e.exId}:rir:=${v}">${v===4?"4+":v}</button>`).join("")}
      </div>
      <div class="rir-h">RIR: ${esc(RIR_HINT[d.rir] ?? "")}</div>

      <button class="btn" data-act="addset:${e.exId}">Записать подход</button>
      <button class="btn flat" data-act="rmex:${e.exId}">Убрать упражнение</button>
    </div>` : ""}
  </div>`;
}

function vSessionQuick(s, t, mins) {
  const isRun = t.mode === "run";
  return `
  <div class="scr">
    ${header(`${t.ic} ${t.n}`, s.back ? fmtDay(s.date) : `идёт ${mins} мин`, "go:home")}
    <div class="card qcard">
      <div class="qbig">${mins}</div>
      <div class="qlbl">${s.back ? "минут, поправишь на следующем шаге" : "минут с начала"}</div>
      ${isRun ? `
      <div class="row2">
        <div><label class="lbl">Дистанция, км</label><input id="q-km" class="inp" inputmode="decimal" value="${s.run?.km ?? ""}" placeholder="5"></div>
        <div><label class="lbl">Время, мин</label><input id="q-min" class="inp" inputmode="numeric" value="${s.run?.min ?? ""}" placeholder="${mins}"></div>
      </div>` : ""}
      <label class="lbl">Заметка</label>
      <textarea id="q-note" class="inp ta" placeholder="${isRun?"Как бежалось, где, самочувствие":"Что делали, как прошло, что болит"}">${esc(s.notes||"")}</textarea>
      <button class="btn" data-act="finish">Завершить и оценить</button>
      <button class="btn flat" data-act="cancel">Отменить сессию</button>
    </div>
    <div class="sp"></div>
  </div>`;
}

/* ═══ ЗАВЕРШЕНИЕ: RPE ════════════════════════════════════════════════ */
function vFinish() {
  const s = ST.active;
  if (!s) { VIEW.name="home"; return vHome(); }
  const t = SESSION_TYPES[s.type];
  const mins = s.duration ?? Math.max(1, Math.round((Date.now()-s.startTs)/60000));
  const rpe = VIEW.rpe ?? 6;
  return `
  <div class="scr">
    ${header("Как прошло", `${t.ic} ${t.n}`, "go:session")}
    <div class="card">
      <label class="lbl">Длительность, мин</label>
      <div class="stepper">
        <button class="st-b" data-act="fin-d:-5">−</button>
        <div class="st-v"><span>${mins}</span><small>мин</small></div>
        <button class="st-b" data-act="fin-d:5">+</button>
      </div>
      <div class="chips">
        ${[20,30,45,60,75,90].map(v => `<button class="chip ${mins===v?"on":""}" data-act="fin-set:${v}">${v}</button>`).join("")}
      </div>

      <label class="lbl">Насколько тяжело, RPE</label>
      <div class="rpe">
        ${[1,2,3,4,5,6,7,8,9,10].map(v => `<button class="rpe-b ${rpe===v?"on":""}" data-act="fin-r:${v}">${v}</button>`).join("")}
      </div>
      <div class="rpe-l">${esc(RPE_SCALE[rpe])}</div>
      <div class="rpe-load">Нагрузка сессии: <b>${mins*rpe}</b></div>

      <label class="lbl">Заметка</label>
      <textarea id="fin-note" class="inp ta" placeholder="Что получилось, что мешало, что болит">${esc(s.notes||"")}</textarea>

      <button class="btn" data-act="fin-save">Сохранить</button>
    </div>
    <div class="sp"></div>
  </div>`;
}

/* ═══ ВЫБОР УПРАЖНЕНИЯ ═══════════════════════════════════════════════ */
function vPicker() {
  const q = (VIEW.q || "").toLowerCase().trim();
  const f = VIEW.filter || "all";
  let list = allEx();
  if (f === "bjj")  list = list.filter(e => e.tags.includes("bjj"));
  if (f === "home") list = list.filter(e => e.loc === "home" || e.loc === "both");
  if (f === "gym")  list = list.filter(e => e.loc === "gym"  || e.loc === "both");
  if (f === "mob")  list = list.filter(e => e.p === "mob" || e.p === "neck");
  if (q) list = list.filter(e => e.n.toLowerCase().includes(q));

  const groups = {};
  list.forEach(e => (groups[e.p] ||= []).push(e));

  return `
  <div class="scr">
    ${header("Упражнение", `${list.length} в каталоге`, "go:session")}
    <input id="pick-q" class="inp" placeholder="Поиск" value="${esc(VIEW.q||"")}" autocomplete="off">
    <div class="chips">
      ${[["all","Все"],["bjj","Для БЖЖ"],["gym","Зал"],["home","Дом"],["mob","Мобильность"]]
        .map(([k,l]) => `<button class="chip ${f===k?"on":""}" data-act="filter:${k}">${l}</button>`).join("")}
    </div>
    ${Object.entries(groups).map(([p,arr]) => `
      <div class="lbl pad">${PATTERNS[p]||p}</div>
      ${arr.map(e => {
        const b = bestSet(e.id);
        return `<button class="card prow" data-act="addex:${e.id}">
          <div class="prow-b">
            <div class="prow-n">${esc(e.n)}${e.tags.includes("bjj")?` <span class="mini">БЖЖ</span>`:""}</div>
            <div class="prow-s">${EQ_NAMES[e.eq]||""} · ${e.reps[0]}–${e.reps[1]} ${unit(e)}${b?` · лучший ${b.w?b.w+"кг × ":""}${b.r}`:""}</div>
          </div><div class="prow-a">+</div>
        </button>`;
      }).join("")}`).join("")}
    <div class="sp"></div>
  </div>`;
}

/* ═══ ДЕНЬ ═══════════════════════════════════════════════════════════ */
function vDay() {
  const k = VIEW.date || today();
  const ss = ST.sessions.filter(s => s.date === k);
  const w = ST.weights[k];
  const past = k !== today();
  return `
  <div class="scr">
    ${header(fmtDay(k), `${DAYS[parseDk(k).getDay()]}${past?" · запись задним числом":""}`, "go:history")}
    ${ss.length ? ss.map(s => sessionRow(s)).join("") : `<div class="hint pad">В этот день ничего не записано</div>`}
    ${w ? `<div class="card wcard"><div><div class="lbl">Вес</div><div class="wcard-v">${w} <span>кг</span></div></div></div>` : ""}
    <div class="lbl pad">Добавить за этот день</div>
    <div class="grid3">
      ${Object.entries(SESSION_TYPES).map(([id,v]) => `
        <button class="tile" data-act="startd:${id}:${k}" style="--tc:${v.c}">
          <span class="tile-i">${v.ic}</span><span class="tile-n">${v.n}</span>
        </button>`).join("")}
    </div>
    <div class="sp"></div>
  </div>`;
}

/* ═══ ПРОСМОТР СОХРАНЁННОЙ СЕССИИ ════════════════════════════════════ */
function vSessionView() {
  const s = ST.sessions.find(x => x.id === VIEW.sid);
  if (!s) { VIEW.name = "history"; return vHistory(); }
  const t = SESSION_TYPES[s.type] || SESSION_TYPES.other;
  const sets = (s.entries||[]).reduce((a,e)=>a+e.sets.length,0);
  return `
  <div class="scr">
    ${header(`${t.ic} ${s.name || t.n}`, `${fmtDay(s.date)} · ${DAYS[parseDk(s.date).getDay()]}`, "go:history")}
    <div class="card">
      <div class="kv" style="border:0"><span>Длительность</span><b>${s.duration||"—"} мин</b></div>
      <div class="kv"><span>RPE</span><b>${s.rpe||"—"} · ${esc(RPE_SCALE[s.rpe]||"")}</b></div>
      <div class="kv"><span>Нагрузка</span><b>${sessionLoad(s)}</b></div>
      ${sets ? `<div class="kv"><span>Подходов</span><b>${sets}</b></div>` : ""}
      ${tonnage(s) ? `<div class="kv"><span>Тоннаж</span><b>${fmtVol(tonnage(s))}</b></div>` : ""}
      ${s.run?.km ? `<div class="kv"><span>Дистанция</span><b>${s.run.km} км${s.run.min?` · ${(s.run.min/s.run.km).toFixed(1)} мин/км`:""}</b></div>` : ""}
    </div>
    ${(s.entries||[]).map(e => {
      const ex = exById(e.exId);
      return `<div class="card hrow">
        <div class="hrow-d" style="width:auto;flex:1">${esc(ex.n)}</div>
        <div class="hrow-s">${e.sets.map(st=>`<span>${st.w?st.w+"×":""}${st.r}${st.rir!=null?`<i>${st.rir}</i>`:""}</span>`).join("")}</div>
      </div>`;
    }).join("")}
    ${s.notes ? `<div class="card"><div class="lbl">Заметка</div><div class="hint" style="color:var(--text)">${esc(s.notes)}</div></div>` : ""}
    <button class="btn flat" data-act="dels:${s.id}">Удалить эту запись</button>
    <div class="sp"></div>
  </div>`;
}

/* ═══ ИСТОРИЯ ════════════════════════════════════════════════════════ */
function vHistory() {
  const byDate = {};
  ST.sessions.forEach(s => (byDate[s.date] ||= []).push(s));
  const dates = Object.keys(byDate).sort().reverse();
  const m = VIEW.month || { y:new Date().getFullYear(), m:new Date().getMonth() };

  const first = new Date(m.y, m.m, 1);
  const days = new Date(m.y, m.m+1, 0).getDate();
  const off = (first.getDay()+6)%7;
  const cells = [...Array(off).fill(null), ...Array.from({length:days},(_,i)=>i+1)];

  return `
  <div class="scr">
    <div class="top"><div><div class="top-hi">История</div>
      <div class="top-d">${ST.sessions.length} тренировок</div></div></div>

    <div class="card">
      <div class="cal-h">
        <button class="ic sm" data-act="mon:-1">‹</button>
        <div class="cal-t">${["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"][m.m]} ${m.y}</div>
        <button class="ic sm" data-act="mon:1">›</button>
      </div>
      <div class="cal-w">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d=>`<div>${d}</div>`).join("")}</div>
      <div class="cal">
        ${cells.map(d => {
          if (d === null) return `<div></div>`;
          const k = `${m.y}-${pad(m.m+1)}-${pad(d)}`;
          const ss = byDate[k] || [];
          const isT = k === today();
          return `<button class="cal-d ${ss.length?"has":""} ${isT?"today":""}" data-act="jump:${k}">
            <span>${d}</span>
            <div class="cal-dots">${ss.slice(0,3).map(s=>`<i style="background:${SESSION_TYPES[s.type]?.c||"#888"}"></i>`).join("")}</div>
          </button>`;
        }).join("")}
      </div>
    </div>

    ${dates.slice(0,40).map(d => `
      <div class="lbl pad">${fmtDay(d)}</div>
      ${byDate[d].map(s => sessionRow(s)).join("")}`).join("")}
    <div class="sp"></div>
  </div>
  ${nav("history")}`;
}

/* ═══ ПРОГРЕСС ═══════════════════════════════════════════════════════ */
function vProgress() {
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    const to = daysAgo(w*7), from = daysAgo(w*7+6);
    weeks.push({ from, to, load: loadBetween(from, to) });
  }
  const maxL = Math.max(...weeks.map(w=>w.load), 1);
  const ratio = acwr();

  const byType = {};
  ST.sessions.filter(s => s.date >= daysAgo(27)).forEach(s => {
    byType[s.type] = (byType[s.type]||0) + sessionLoad(s);
  });
  const totalT = Object.values(byType).reduce((a,b)=>a+b,0) || 1;

  const prs = allEx().map(e => ({ ex:e, b:bestSet(e.id) })).filter(x => x.b)
    .sort((a,b) => (b.b.date||"").localeCompare(a.b.date||"")).slice(0,12);

  const ws = Object.entries(ST.weights).sort((a,b)=>a[0].localeCompare(b[0]));

  return `
  <div class="scr">
    <div class="top"><div><div class="top-hi">Прогресс</div>
      <div class="top-d">нагрузка, рекорды, вес</div></div></div>

    <div class="card">
      <div class="lbl">Недельная нагрузка</div>
      <div class="bars">
        ${weeks.map((w,i) => `
          <div class="bar-c">
            <div class="bar-v">${w.load||""}</div>
            <div class="bar" style="height:${Math.max(3,(w.load/maxL)*90)}px;opacity:${i===7?1:.55}"></div>
            <div class="bar-l">${i===7?"эта":`−${7-i}`}</div>
          </div>`).join("")}
      </div>
      <div class="hint">Минуты × RPE. Смотри не на цифру, а на скачки между неделями.</div>
      ${ratio!==null ? `<div class="ratio">
        <div class="ratio-v ${ratio>1.5?"bad":ratio>1.3?"warn":ratio<0.8?"dim":"ok"}">${ratio.toFixed(2)}</div>
        <div class="ratio-t">острая к хронической. Коридор 0.8–1.3. Выше 1.5 значит прыгнул слишком резко и это классический вход в травму.</div>
      </div>` : `<div class="hint">Копи данные месяц, тогда появится индикатор перегруза.</div>`}
    </div>

    ${Object.keys(byType).length ? `
    <div class="card">
      <div class="lbl">Из чего нагрузка, 4 недели</div>
      ${Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([k,v]) => {
        const t = SESSION_TYPES[k]||SESSION_TYPES.other;
        return `<div class="tr">
          <div class="tr-n">${t.ic} ${t.n}</div>
          <div class="tr-bar"><i style="width:${(v/totalT)*100}%;background:${t.c}"></i></div>
          <div class="tr-v">${Math.round(v/totalT*100)}%</div>
        </div>`;
      }).join("")}
    </div>` : ""}

    ${prs.length ? `
    <div class="card">
      <div class="lbl">Рекорды</div>
      ${prs.map(({ex,b}) => `
        <button class="pr" data-act="exview:${ex.id}">
          <div class="pr-n">${esc(ex.n)}</div>
          <div class="pr-v">${b.w?`${b.w} кг × ${b.r}`:`${b.r}${ex.u==="s"?" сек":" повт"}`}${b.w?` <small>≈${e1rm(b.w,b.r)}</small>`:""}</div>
        </button>`).join("")}
    </div>` : ""}

    ${ws.length>1 ? `
    <div class="card">
      <div class="lbl">Вес</div>
      ${weightChart(ws)}
      <div class="wrow"><span>${ws[0][1]} кг · ${fmtDate(ws[0][0])}</span><span>${ws[ws.length-1][1]} кг · ${fmtDay(ws[ws.length-1][0])}</span></div>
    </div>` : ""}
    <div class="sp"></div>
  </div>
  ${nav("progress")}`;
}

function weightChart(ws) {
  const vals = ws.map(w=>w[1]);
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = (mx-mn)||1;
  const pts = ws.map((w,i) => {
    const x = ws.length===1 ? 50 : (i/(ws.length-1))*100;
    const y = 60 - ((w[1]-mn)/rg)*50 - 5;
    return `${x},${y}`;
  }).join(" ");
  return `<svg viewBox="0 0 100 60" preserveAspectRatio="none" class="chart">
    <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
  </svg>`;
}

/* ═══ КАРТОЧКА УПРАЖНЕНИЯ ════════════════════════════════════════════ */
function vExercise() {
  const ex = exById(VIEW.exId);
  const h = exHistory(ex.id);
  const b = bestSet(ex.id);
  return `
  <div class="scr">
    ${header(ex.n, PATTERNS[ex.p]||"", "go:progress")}
    <div class="card">
      ${ex.cue ? `<div class="cue">💡 ${esc(ex.cue)}</div>` : ""}
      <div class="kv"><span>Снаряд</span><b>${EQ_NAMES[ex.eq]||"—"}</b></div>
      <div class="kv"><span>Диапазон</span><b>${ex.reps[0]}–${ex.reps[1]} ${unit(ex)}</b></div>
      <div class="kv"><span>Шаг веса</span><b>${ex.step?ex.step+" кг":"без веса"}</b></div>
      ${b ? `<div class="kv"><span>Рекорд</span><b>${b.w?`${b.w} кг × ${b.r}`:b.r}</b></div>` : ""}
      ${ex.tags.length ? `<div class="tags">${ex.tags.map(t=>`<span class="mini">${t}</span>`).join("")}</div>` : ""}
    </div>
    ${h.length ? `<div class="lbl pad">История</div>
      ${h.slice(0,20).map(x => `<div class="card hrow">
        <div class="hrow-d">${fmtDay(x.date)}</div>
        <div class="hrow-s">${x.sets.map(s=>`<span>${s.w?s.w+"×":""}${s.r}${s.rir!=null?`<i>${s.rir}</i>`:""}</span>`).join("")}</div>
      </div>`).join("")}` : `<div class="hint pad">Ещё не делал</div>`}
    <div class="sp"></div>
  </div>`;
}

/* ═══ ПРОФИЛЬ И НАСТРОЙКИ ════════════════════════════════════════════ */
function vSettings() {
  const totalLoad = loadBetween(daysAgo(27), today());
  return `
  <div class="scr">
    <div class="top"><div><div class="top-hi">Профиль</div>
      <div class="top-d">${esc(ST.profile.name||"")}</div></div></div>

    <div class="card">
      <div class="row2">
        <div><label class="lbl">Рост, см</label><input id="p-h" class="inp" inputmode="numeric" value="${ST.profile.height||""}"></div>
        <div><label class="lbl">Имя</label><input id="p-n" class="inp" value="${esc(ST.profile.name||"")}"></div>
      </div>
      <button class="btn ghost" data-act="p-save">Сохранить профиль</button>
    </div>

    <div class="card">
      <div class="lbl">Тема</div>
      <div class="chips">
        <button class="chip ${ST.settings.theme==="dark"?"on":""}" data-act="theme:dark">Тёмная</button>
        <button class="chip ${ST.settings.theme==="bloom"?"on":""}" data-act="theme:bloom">Розовая</button>
      </div>
    </div>

    <div class="card">
      <div class="lbl">Тренеру</div>
      <div class="hint">Экспорт кидаешь в чат, оттуда приходит разбор и план на следующую сессию.</div>
      <button class="btn" data-act="export">Скопировать данные для тренера</button>
      <button class="btn ghost" data-act="import">Вставить план от тренера</button>
      <div class="kv"><span>Сессий</span><b>${ST.sessions.length}</b></div>
      <div class="kv"><span>Нагрузка за 4 недели</span><b>${totalLoad}</b></div>
      <div class="kv"><span>Замеров веса</span><b>${Object.keys(ST.weights).length}</b></div>
    </div>

    <div class="card">
      <div class="lbl">Данные</div>
      <button class="btn ghost" data-act="backup">Скачать резервную копию</button>
      <button class="btn flat" data-act="wipe">Стереть всё</button>
    </div>
    <div class="sp"></div>
  </div>
  ${nav("settings")}`;
}

/* ═══ ТАЙМЕР ОТДЫХА ══════════════════════════════════════════════════ */
function startRest(sec) {
  REST = { until: Date.now() + sec*1000, total: sec };
  tickRest();
}
function tickRest() {
  const el = $("#rest");
  if (!el) return;
  const left = Math.ceil((REST.until - Date.now())/1000);
  if (left <= 0) { el.className = "rest hide"; return; }
  el.className = "rest";
  el.innerHTML = `<div class="rest-b" style="width:${(left/REST.total)*100}%"></div>
    <span>Отдых ${Math.floor(left/60)}:${pad(left%60)}</span>
    <button class="rest-x" data-act="rest-skip">пропустить</button>`;
}
setInterval(() => {
  if (REST.until && Date.now() < REST.until + 1200) {
    const before = REST.until - Date.now() > 0;
    tickRest();
    if (before && REST.until - Date.now() <= 0) beep();
  }
}, 1000);

function beep() {
  try {
    const ac = new (window.AudioContext||window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.frequency.value = 880; g.gain.value = 0.15;
    o.start(); o.stop(ac.currentTime + 0.18);
  } catch {}
  navigator.vibrate?.([120,60,120]);
}

/* ═══ ДЕЙСТВИЯ ═══════════════════════════════════════════════════════ */
function startSession(type, date) {
  if (ST.active && !confirm("Есть незавершённая сессия. Начать новую и потерять её?")) return;
  const d = date || today();
  const plan = ST.plans[d];
  const entries = (plan && (plan.kind||"strength") === type)
    ? (plan.items||[]).map(i => ({
        exId: i.ex, sets: [],
        target: { sets:i.sets, reps:i.reps, weight:i.weight, rir:i.rir, note:i.note },
      }))
    : [];
  const back = d !== today();
  ST.active = {
    id: uid(), date: d, type, startTs: Date.now(), back,
    entries, run: type==="run" ? {km:"",min:""} : null,
    notes: "", name: plan?.session || null,
    duration: back ? 45 : undefined,
  };
  DRAFT = {};
  save(); go("session");
}

function finishSession() {
  const s = ST.active; if (!s) return;
  if (s.type === "run") {
    s.run = { km: parseFloat($("#q-km")?.value) || null, min: parseInt($("#q-min")?.value) || null };
    if (s.run.min) s.duration = s.run.min;
  }
  const note = $("#q-note")?.value ?? $("#fin-note")?.value;
  if (note != null) s.notes = note;
  s.duration ??= s.back ? 45 : Math.max(1, Math.round((Date.now()-s.startTs)/60000));
  save(); go("finish", { rpe: VIEW.rpe ?? 6, dur: s.duration });
}

function saveFinished() {
  const s = ST.active; if (!s) return;
  s.notes = $("#fin-note")?.value ?? s.notes;
  s.rpe = VIEW.rpe ?? 6;
  s.duration = VIEW.dur ?? s.duration ?? 45;
  s.endTs = Date.now();
  s.done = true;
  s.entries = (s.entries||[]).filter(e => e.sets.length);
  ST.sessions.push(s);
  ST.sessions.sort((a,b)=>a.date.localeCompare(b.date));
  ST.active = null;
  VIEW.rpe = undefined; VIEW.dur = undefined;
  DRAFT = {};
  save(); go("home");
}

function logWeight() {
  const cur = ST.weights[today()] ?? Object.values(ST.weights).slice(-1)[0] ?? "";
  const v = prompt("Вес сегодня, кг", cur);
  if (v === null) return;
  const n = parseFloat(String(v).replace(",", "."));
  if (!isNaN(n) && n > 0) { ST.weights[today()] = n; save(); rerender(); }
}

function exportForCoach() {
  const from = daysAgo(41);
  const payload = {
    kind: "bloom-export", v: 2, generated: new Date().toISOString(),
    profile: ST.profile,
    weights: Object.fromEntries(Object.entries(ST.weights).filter(([k]) => k >= from)),
    flags: ST.flags,
    weekLoad: [0,1,2,3].map(w => ({
      from: daysAgo(w*7+6), to: daysAgo(w*7), load: loadBetween(daysAgo(w*7+6), daysAgo(w*7)),
    })),
    acwr: acwr(),
    sessions: ST.sessions.filter(s => s.date >= from).map(s => ({
      date:s.date, type:s.type, name:s.name, duration:s.duration, rpe:s.rpe,
      load: sessionLoad(s), notes:s.notes, run:s.run,
      entries: (s.entries||[]).map(e => ({ ex: exById(e.exId).n, id:e.exId, sets:e.sets })),
    })),
  };
  const txt = JSON.stringify(payload, null, 1);
  copy(txt, `Скопировано: ${payload.sessions.length} сессий за 6 недель. Вставь в чат тренеру.`);
}

function copy(txt, okMsg) {
  const done = () => alert(okMsg);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(txt).then(done, () => fallback());
  } else fallback();
  function fallback() {
    const ta = document.createElement("textarea");
    ta.value = txt; ta.style.position="fixed"; ta.style.opacity="0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); }
    catch { prompt("Скопируй вручную", txt); }
    document.body.removeChild(ta);
  }
}

function importPlan() {
  const raw = prompt("Вставь JSON плана от тренера");
  if (!raw) return;
  let p; try { p = JSON.parse(raw); } catch { alert("Это не JSON. Скопируй блок целиком."); return; }
  const plans = Array.isArray(p) ? p : (p.plans || [p]);
  let n = 0;
  plans.forEach(pl => {
    if (!pl || !pl.date) return;
    ST.plans[pl.date] = pl; n++;
  });
  if (p.flags) ST.flags = p.flags;
  save();
  alert(n ? `Планов загружено: ${n}${p.flags?", флаги обновлены":""}` : "В плане нет поля date");
  go("home");
}

function backup() {
  const blob = new Blob([JSON.stringify(ST)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `bloom-${today()}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}

/* ═══ ОБРАБОТЧИК СОБЫТИЙ ═════════════════════════════════════════════ */
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-act]");
  if (!b) return;
  const [act, ...args] = b.dataset.act.split(":");

  switch (act) {
    case "go": go(args[0]); break;

    case "onb-go": {
      const n = $("#onb-name").value.trim();
      if (!n) return;
      ST.profile.name = n;
      ST.profile.height = parseInt($("#onb-h").value) || 185;
      const w = parseFloat(String($("#onb-w").value).replace(",","."));
      if (w) { ST.weights[today()] = w; ST.profile.startWeight = w; }
      save(); applyTheme(); go("home");
      break;
    }

    case "start": startSession(args[0]); break;
    case "finish": finishSession(); break;
    case "cancel":
      if (confirm("Отменить сессию? Записанное не сохранится.")) { ST.active=null; DRAFT={}; save(); go("home"); }
      break;

    case "fin-r": VIEW.rpe = +args[0]; rerender(); break;
    case "fin-d": {
      const cur = VIEW.dur ?? ST.active?.duration ?? 45;
      VIEW.dur = Math.max(5, cur + (+args[0]));
      if (ST.active) ST.active.duration = VIEW.dur;
      rerender(); break;
    }
    case "fin-set":
      VIEW.dur = +args[0];
      if (ST.active) ST.active.duration = VIEW.dur;
      rerender(); break;
    case "fin-save": saveFinished(); break;

    case "pick": go("picker", { q:"", filter:"all" }); break;
    case "filter": VIEW.filter = args[0]; rerender(); break;
    case "addex": {
      const id = args[0];
      if (!ST.active) startSession("strength");
      if (!ST.active.entries.some(e => e.exId === id))
        ST.active.entries.push({ exId:id, sets:[] });
      VIEW.exId = id;
      save(); go("session");
      break;
    }
    case "rmex":
      ST.active.entries = ST.active.entries.filter(e => e.exId !== args[0]);
      save(); rerender(); break;

    case "toggle": VIEW.exId = VIEW.exId === args[0] ? null : args[0]; rerender(); break;

    case "d": {   // d:exId:field:delta   (=N задаёт значение)
      const [id, field, raw] = args;
      const d = DRAFT[id] ||= { w:0, r:0, rir:2 };
      if (raw.startsWith("=")) d[field] = +raw.slice(1);
      else d[field] = Math.max(0, +(d[field] + parseFloat(raw)).toFixed(2));
      rerender(); break;
    }

    case "addset": {
      const id = args[0];
      const e = ST.active.entries.find(x => x.exId === id);
      const d = DRAFT[id];
      if (!e || !d || !d.r) return;
      e.sets.push({ w:d.w||0, r:d.r, rir:d.rir, ts:Date.now() });
      save();
      const ex = exById(id);
      startRest(ex.p === "mob" ? 30 : ex.step >= 5 ? 180 : 90);
      rerender(); break;
    }
    case "delset": {
      const [id, i] = args;
      const e = ST.active.entries.find(x => x.exId === id);
      if (e && confirm("Удалить подход?")) { e.sets.splice(+i,1); save(); rerender(); }
      break;
    }
    case "rest-skip": REST.until = 0; tickRest(); break;

    case "w-log": logWeight(); break;
    case "mon": {
      const m = VIEW.month || { y:new Date().getFullYear(), m:new Date().getMonth() };
      let nm = m.m + (+args[0]), ny = m.y;
      if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; }
      VIEW.month = { y:ny, m:nm }; rerender(); break;
    }
    case "jump": {
      const k = args.join(":");
      if (k > today()) { alert("Будущее ещё не случилось"); break; }
      go("day", { date:k }); break;
    }
    case "startd": startSession(args[0], args.slice(1).join(":")); break;
    case "open-s": go("sview", { sid:args[0] }); break;
    case "dels":
      if (confirm("Удалить запись насовсем?")) {
        ST.sessions = ST.sessions.filter(s => s.id !== args[0]);
        save(); go("history");
      }
      break;
    case "exview": go("exercise", { exId:args[0] }); break;

    case "theme": ST.settings.theme = args[0]; save(); applyTheme(); rerender(); break;
    case "p-save":
      ST.profile.name = $("#p-n").value.trim() || ST.profile.name;
      ST.profile.height = parseInt($("#p-h").value) || ST.profile.height;
      save(); rerender(); break;

    case "export": exportForCoach(); break;
    case "import": importPlan(); break;
    case "backup": backup(); break;
    case "wipe":
      if (confirm("Стереть вообще все данные? Отменить будет нельзя.") && confirm("Точно? Последний шанс.")) {
        localStorage.removeItem(KEY); ST = structuredClone(BLANK); save(); applyTheme(); go("home");
      }
      break;
  }
});

document.addEventListener("input", ev => {
  if (ev.target.id === "pick-q") {
    VIEW.q = ev.target.value;
    const pos = ev.target.selectionStart;
    rerender();
    const el = $("#pick-q");
    if (el) { el.focus(); el.setSelectionRange(pos,pos); }
  }
});

/* ═══ СТАРТ ══════════════════════════════════════════════════════════ */
applyTheme();
render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
