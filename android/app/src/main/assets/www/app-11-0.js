"use strict";

/* Ora X 11.0 · 𝑺𝒂𝒍𝑯𝒂𝒓𝒅 */

const $ = id => document.getElementById(id);
const el = {
  giorno: $("giornoInput"), ora: $("oraInput"), now: $("nowBtn"), ent: $("ent"), usc: $("usc"), mos: $("mos"),
  avviso: $("avvisoCheck"), avvisoStato: $("avvisoStato"), reset: $("resetBtn"), storico: $("storicoBtn"),
  overlay: $("storicoOverlay"), close: $("storicoClose"), titolo: $("storicoTitolo"), totali: $("storicoTotali"), lista: $("storicoLista"),
  prev: $("mesePrev"), next: $("meseNext"), exportMese: $("storicoExport"), exportAll: $("storicoExportAll"),
  info: $("infoBtn"), infoOverlay: $("infoOverlay"), infoClose: $("infoClose"), infoVersione: $("infoVersione"),
  backup: $("backupJsonBtn"), restore: $("importJsonBtn"), restoreInput: $("importJsonInput"), stato: $("statoApp")
};

const CONFIG = Object.freeze({ USC: 442, MOS: 462, AVVISO: 5, STORAGE: "storico", ALERT: "avvisoUscitaAbilitato" });
const APP_VERSION = (() => {
  try { return window.AndroidOraX?.getVersionName?.() || "11.0"; } catch { return "11.0"; }
})();
let timerAvviso = 0;
let timerPlan = 0;
let audioCtx = null;
const inizioMese = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
let mese = inizioMese();

const pad = n => String(n).padStart(2, "0");
const oggi = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const minuti = h => { const [hh, mm] = h.split(":").map(Number); return hh * 60 + mm; };
const addInfo = (h, m) => { const total = minuti(h) + m; const days = Math.floor(total / 1440); const t = ((total % 1440) + 1440) % 1440; return { time: `${pad(Math.floor(t / 60))}:${pad(t % 60)}`, days }; };
const add = (h, m) => addInfo(h, m).time;
const addDisplay = (h, m, suffix = false) => { const r = addInfo(h, m); return suffix && r.days ? `${r.time} (+${r.days})` : r.time; };
const ore = m => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

// Interpreta l'orario digitato: "712"/"07:12" -> {ok:true, value:"07:12"}. "done" distingue un errore
// definitivo (mostra ERRORE) da un input ancora incompleto (l'utente sta ancora scrivendo).
function norm(value) {
  const v = String(value ?? "").trim();
  if (!v) return { ok: false, done: false };
  if (v.includes(":")) {
    const p = v.split(":");
    if (p.length !== 2 || !/^\d{1,2}$/.test(p[0]) || (p[1] !== "" && !/^\d{1,2}$/.test(p[1]))) return { ok: false, done: true };
    if (p[1] === "") return { ok: false, done: false };
    const h = +p[0], m = +p[1];
    return h < 24 && m < 60 ? { ok: true, value: `${pad(h)}:${pad(m)}` } : { ok: false, done: true };
  }
  if (!/^\d{3,4}$/.test(v)) return { ok: false, done: v.length >= 4 };
  const h = v.length === 3 ? +v[0] : +v.slice(0, 2);
  const m = v.length === 3 ? +v.slice(1) : +v.slice(2);
  if (h < 24 && m < 60) return { ok: true, value: `${pad(h)}:${pad(m)}` };
  // "071" non vale come 0:71 ma puo' diventare "0712": l'errore compare solo quando non puo' piu' essere valido
  return { ok: false, done: !(v.length === 3 && +v.slice(0, 2) < 24 && +v[2] < 6) };
}

function normalizeHistory(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("storico non valido");
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const r = norm(value?.valore);
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && r.ok && (value.fonte === "manuale" || value.fonte === "auto")) {
      out[key] = { valore: r.value, fonte: value.fonte, pasto: value.pasto === true };
    }
  }
  return out;
}

// Rilegge sempre lo storico validandolo riga per riga: se mai localStorage contenesse dati
// corrotti o modificati a mano, le righe non valide vengono scartate invece di rompere l'app.
let historyCache = null;
function loadHistory() {
  if (historyCache) return historyCache;
  try {
    const stored = localStorage.getItem(CONFIG.STORAGE);
    historyCache = normalizeHistory(stored ? JSON.parse(stored) : {});
    return historyCache;
  } catch {
    historyCache = {};
    try { localStorage.removeItem(CONFIG.STORAGE); } catch {}
    return historyCache;
  }
}
function saveHistory(hist) { historyCache = hist; try { localStorage.setItem(CONFIG.STORAGE, JSON.stringify(hist)); } catch {} }
function saveDay(key, value, source) {
  if (!key) return;
  const hist = loadHistory(), old = hist[key];
  hist[key] = { valore: value, fonte: source, pasto: !!old?.pasto };
  saveHistory(hist);
}
function setPasto(key, checked) {
  const h = loadHistory();
  if (!h[key]) return;
  h[key].pasto = !!checked;
  saveHistory(h);

  // Se il giorno modificato è quello selezionato, ricalcola subito USC, MOS e avviso.
  if (key === el.giorno.value) calc();
}

// Calcola l'uscita effettiva del giorno: con mensa/pasto registrato si aggiungono 20 minuti.
function pastoAttivo(key = el.giorno.value) {
  if (!key) return false;
  return loadHistory()[key]?.pasto === true;
}
function uscitaMinuti(key = el.giorno.value) {
  return CONFIG.USC + (pastoAttivo(key) ? 20 : 0);
}
function uscitaDaEntrata(entrata, key = el.giorno.value) {
  return add(entrata, uscitaMinuti(key));
}

// --- avviso sonoro 5 minuti prima dell'uscita (funziona mentre l'app resta aperta) ---
function clearAlert() {
  clearTimeout(timerPlan);
  if (timerAvviso) { clearTimeout(timerAvviso); timerAvviso = 0; }
  try { window.AndroidOraX?.cancelExitAlert?.(); } catch {}
}
function beep() {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime;
    for (let k = 0; k < 3; k++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), s = t + k * .45;
      o.frequency.value = 880;
      g.gain.setValueAtTime(.0001, s);
      g.gain.exponentialRampToValueAtTime(.35, s + .02);
      g.gain.exponentialRampToValueAtTime(.0001, s + .28);
      o.connect(g).connect(audioCtx.destination);
      o.start(s); o.stop(s + .32);
    }
  } catch {}
}
// Durante la digitazione l'allarme nativo viene riprogrammato solo a input fermo (evita cancella/riprogramma a ogni tasto).
function planAlertDebounced() { clearTimeout(timerPlan); timerPlan = setTimeout(planAlert, 400); }
function iconaSvg(id) {
  const ns = "http://www.w3.org/2000/svg", svg = document.createElementNS(ns, "svg"), use = document.createElementNS(ns, "use");
  svg.setAttribute("class", "icon"); svg.setAttribute("aria-hidden", "true");
  use.setAttribute("href", "#" + id); svg.appendChild(use);
  return svg;
}
// kind: "" (informativo) | "ok" (campanella) | "warn" (triangolo, con eventuale azione al tocco)
function alertState(text = "", kind = "", action = "") {
  const n = el.avvisoStato;
  n.replaceChildren();
  n.className = "avviso-stato" + (kind ? " " + kind : "");
  if (action) n.dataset.azione = action; else delete n.dataset.azione;
  if (!text) return;
  const s = document.createElement("span"); s.className = "msg";
  if (kind) s.append(iconaSvg(kind === "warn" ? "i-alert" : "i-bell"));
  s.append(document.createTextNode(text));
  n.append(s);
}
function showTime(node, info) {
  node.textContent = info.time;
  if (info.days) { const s = document.createElement("small"); s.textContent = `+${info.days}`; node.append(s); }
}
function planAlert() {
  clearAlert();
  if (!el.avviso.checked) { alertState(); return; }
  const r = norm(el.ora.value);
  if (!r.ok || !el.giorno.value) { alertState("Inserisci un orario valido per attivare l'avviso."); return; }
  const [y, m, d] = el.giorno.value.split("-").map(Number);
  const [h, mm] = r.value.split(":").map(Number);
  const target = new Date(y, m - 1, d, h, mm);
  target.setMinutes(target.getMinutes() + uscitaMinuti(el.giorno.value) - CONFIG.AVVISO);
  const wait = target.getTime() - Date.now();
  if (wait <= 0) { alertState("L'orario dell'avviso è già passato."); return; }
  if (wait > 24 * 60 * 60 * 1000) { alertState("Avviso programmato solo per il turno imminente."); return; }

  const uscita = uscitaDaEntrata(r.value, el.giorno.value);
  const targetMs = target.getTime();
  const alertTime = `${pad(target.getHours())}:${pad(target.getMinutes())}`;
  const nativeBridge = !!window.AndroidOraX?.scheduleExitAlert;

  if (nativeBridge) {
    let notificheBloccate = false;
    let exactDisponibile = true;
    try { exactDisponibile = !(window.AndroidOraX.canScheduleExactAlarm && !window.AndroidOraX.canScheduleExactAlarm()); } catch {}
    try { notificheBloccate = !!(window.AndroidOraX.canNotify && window.AndroidOraX.canNotify() === false); } catch {}
    if (notificheBloccate) {
      alertState("Notifiche disattivate · tocca qui per abilitarle", "warn", "notifiche");
      return;
    }
    try {
      const nativeScheduled = window.AndroidOraX.scheduleExitAlert(targetMs, uscita) === true;
      if (nativeScheduled) {
        let mode = "standard";
        try { mode = window.AndroidOraX.getAlertScheduleMode?.() || (exactDisponibile ? "exact" : "standard"); } catch {}
        if (mode === "exact") {
          alertState(`Avviso attivo · USC ${uscita} · alert ${alertTime}`, "ok");
        } else {
          alertState(`Avviso attivo · USC ${uscita} · alert previsto ${alertTime} · precisione standard · tocca qui per precisione massima`, "ok", "allarmi");
        }
      } else {
        alertState("Impossibile programmare l'avviso Android.", "warn");
      }
    } catch {
      alertState("Impossibile programmare l'avviso Android.", "warn");
    }
    return;
  }

  timerAvviso = setTimeout(() => {
    beep();
    if (window.Notification?.permission === "granted") {
      try {
        new Notification("ATTENZIONE · USCITA PROGRAMMATA!", {
          body: `Uscita prevista alle ${uscita} · mancano 5 minuti`,
          tag: "orax-uscita",
          renotify: true
        });
      } catch {}
    } else {
      alert(`ATTENZIONE USCITA PROGRAMMATA!\nUSC ${uscita}`);
    }
    alertState(`Avviso inviato · USC ${uscita}`);
  }, wait);
  alertState(`Avviso attivo · USC ${uscita} · alert ${alertTime}`, "ok");
}
function calc(source) {
  const r = norm(el.ora.value);
  if (!el.ora.value) { el.ent.textContent = el.usc.textContent = el.mos.textContent = "--:--"; clearAlert(); alertState(); return; }
  if (!r.ok) { el.ent.textContent = r.done ? "ERRORE" : "--:--"; el.usc.textContent = el.mos.textContent = "--:--"; clearAlert(); alertState(); return; }
  if (source) saveDay(el.giorno.value, r.value, source);
  el.ent.textContent = r.value;
  showTime(el.usc, addInfo(r.value, uscitaMinuti()));
  showTime(el.mos, addInfo(r.value, CONFIG.MOS));
  if (source === "manuale") planAlertDebounced(); else planAlert();
}
function loadDay() {
  const h = loadHistory()[el.giorno.value];
  el.ora.value = h?.valore || "";
  calc();
  aggiornaAdesso();
}
function aggiornaAdesso() {
  const isOggi = el.giorno.value === oggi();
  el.now.disabled = !isOggi;
  el.now.title = isOggi ? "" : "Disponibile solo per il giorno di oggi";
}

el.ora.addEventListener("input", () => calc("manuale"));
el.giorno.addEventListener("change", () => { if (!el.giorno.value) el.giorno.value = oggi(); loadDay(); });
el.now.addEventListener("click", () => {
  if (el.giorno.value !== oggi()) return;
  const d = new Date();
  el.ora.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  calc("auto");
});
el.avviso.addEventListener("change", async () => {
  if (el.avviso.checked) {
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") await audioCtx.resume();
    } catch {}
    try { window.AndroidOraX?.requestNotificationPermission?.(); } catch {}
    if (!window.AndroidOraX && window.Notification?.permission === "default") { try { await Notification.requestPermission(); } catch {} }
  }
  try { localStorage.setItem(CONFIG.ALERT, el.avviso.checked ? "1" : "0"); } catch {}
  planAlert();
});
el.avvisoStato.addEventListener("click", () => {
  const azione = el.avvisoStato.dataset.azione, b = window.AndroidOraX;
  try {
    if (azione === "allarmi") b?.requestExactAlarmPermission?.();
    else if (azione === "notifiche") b?.openNotificationSettings?.();
  } catch {}
});
el.reset.addEventListener("click", () => { el.giorno.value = oggi(); el.ora.value = ""; calc(); loadDay(); });

// --- pannello storico ---
function dayTimes(e) {
  return {
    usc: addDisplay(e.valore, CONFIG.USC + (e.pasto ? 20 : 0), true),
    mos: addDisplay(e.valore, CONFIG.MOS, true)
  };
}
function rowText(k, e) {
  const { usc, mos } = dayTimes(e);
  return e.pasto ? `${k} · ENT ${e.valore} · MOS ${mos} · USC ${usc} · pasto fatto` : `${k} · ENT ${e.valore} · USC ${usc}`;
}
function renderHistory() {
  const ym = `${mese.getFullYear()}-${pad(mese.getMonth() + 1)}`;
  el.titolo.textContent = mese.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const h = loadHistory(), keys = Object.keys(h).filter(k => k.startsWith(ym)).sort();
  if (!keys.length) { el.totali.textContent = "Nessun inserimento questo mese."; el.lista.innerHTML = ""; return; }
  let total = 0, pasti = 0;
  keys.forEach(k => { total += h[k].pasto ? CONFIG.MOS : CONFIG.USC; pasti += h[k].pasto ? 1 : 0; });
  el.totali.textContent = `Totale ${ore(total)} · Pasto ${pasti}/${keys.length} giorni`;
  el.lista.innerHTML = keys.map(k => {
    const e = h[k];
    const label = new Date(k + "T00:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "2-digit" });
    const { usc: u, mos: m } = dayTimes(e);
    return `<article class="storico-riga" data-key="${esc(k)}">
      <div class="storico-riga-top">
        <button class="storico-giorno" type="button">${esc(label)} <small>${e.fonte === "manuale" ? "" : "(adesso)"}</small></button>
        <button class="storico-del" data-key="${esc(k)}" type="button" aria-label="Elimina"><svg class="icon"><use href="#i-trash"></use></svg></button>
      </div>
      <div class="storico-riga-bottom">
        <span class="sv-ent">${esc(e.valore)}</span>
        <span class="sv-usc ${e.pasto ? "sv-muto" : ""}">${u}</span>
        <span class="sv-mos ${e.pasto ? "sv-attivo" : ""}">${m}</span>
        <label class="storico-pasto">
          <input type="checkbox" class="pasto-check" data-key="${esc(k)}" ${e.pasto ? "checked" : ""}>
          <svg class="icon"><use href="#i-meal"></use></svg>
        </label>
      </div>
    </article>`;
  }).join("");
}
// Lo Storico e' un pannello, non una pagina: senza una voce nella cronologia il tasto/gesto Indietro chiude l'intera app.
// Aprendolo si aggiunge una voce; Indietro la toglie (popstate) e il pannello si chiude.
function showHistory(open) { el.overlay.classList.toggle("aperto", open); el.overlay.setAttribute("aria-hidden", open ? "false" : "true"); }
function openHistory() {
  mese = inizioMese(); renderHistory(); showHistory(true);
  try { if (!history.state?.storico) history.pushState({ storico: 1 }, ""); } catch {}
}
function closeHistory() {
  showHistory(false);
  try { if (history.state?.storico) history.back(); } catch {}
}
// --- pannello info (autore, versione, novita'): stessa gestione di cronologia dello Storico ---
function showInfo(open) { el.infoOverlay.classList.toggle("aperto", open); el.infoOverlay.setAttribute("aria-hidden", open ? "false" : "true"); }
function openInfo() {
  el.infoVersione.textContent = APP_VERSION;
  showInfo(true);
  try { if (!history.state?.info) history.pushState({ info: 1 }, ""); } catch {}
}
function closeInfo() {
  showInfo(false);
  try { if (history.state?.info) history.back(); } catch {}
}
window.addEventListener("popstate", () => {
  if (el.infoOverlay.classList.contains("aperto")) showInfo(false);
  else if (el.overlay.classList.contains("aperto")) showHistory(false);
});
// Chiamata dall'app Android (MainActivity) a ogni Indietro: true = gestito (pannello chiuso), false = l'app puo' chiudersi.
window.oraxBack = function () {
  if (el.infoOverlay.classList.contains("aperto")) { closeInfo(); return true; }
  if (el.overlay.classList.contains("aperto")) { closeHistory(); return true; }
  return false;
};
el.info.addEventListener("click", openInfo);
el.infoClose.addEventListener("click", closeInfo);
el.infoOverlay.addEventListener("click", e => { if (e.target === el.infoOverlay) closeInfo(); });
try { if (history.state?.storico || history.state?.info) history.replaceState(null, ""); } catch {} // app ripristinata con una voce "fantasma"
el.storico.addEventListener("click", openHistory);
el.close.addEventListener("click", closeHistory);
el.overlay.addEventListener("click", e => { if (e.target === el.overlay) closeHistory(); });
// Si parte sempre dal giorno 1: setMonth() dal 29-31 saltava o ripeteva il mese (es. 31 ottobre -> "31 settembre" = 1 ottobre)
el.prev.addEventListener("click", () => { mese = new Date(mese.getFullYear(), mese.getMonth() - 1, 1); renderHistory(); });
el.next.addEventListener("click", () => { mese = new Date(mese.getFullYear(), mese.getMonth() + 1, 1); renderHistory(); });
el.lista.addEventListener("click", e => {
  const del = e.target.closest(".storico-del");
  if (del) {
    const h = loadHistory(); delete h[del.dataset.key]; saveHistory(h);
    if (del.dataset.key === el.giorno.value) loadDay(); // il giorno in schermata non esiste piu': azzera anche l'avviso
    renderHistory(); return;
  }
  const b = e.target.closest(".storico-giorno");
  if (b) { el.giorno.value = b.closest(".storico-riga").dataset.key; loadDay(); closeHistory(); }
});
el.lista.addEventListener("change", e => {
  const c = e.target.closest(".pasto-check");
  if (c) { setPasto(c.dataset.key, c.checked); renderHistory(); }
});

// --- backup / esportazione ---
function download(name, text, type = "text/plain;charset=utf-8") {
  // App Android (WebView): i download via blob non funzionano, si usa il salvataggio nativo
  try { if (window.AndroidOraX?.saveFile) { window.AndroidOraX.saveFile(name, text, type); return; } } catch {}
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
el.exportMese.addEventListener("click", () => {
  const ym = `${mese.getFullYear()}-${pad(mese.getMonth() + 1)}`, h = loadHistory(), keys = Object.keys(h).filter(k => k.startsWith(ym)).sort();
  if (!keys.length) return alert("Nessun dato da esportare.");
  download(`ora-x-${ym}.txt`, `ORA X — ${mese.toLocaleDateString("it-IT", { month: "long", year: "numeric" })}\n\n${keys.map(k => rowText(k, h[k])).join("\n")}\n`);
});
el.exportAll.addEventListener("click", () => {
  const h = loadHistory(), keys = Object.keys(h).sort();
  if (!keys.length) return alert("Nessun dato salvato.");
  download("ora-x-storico-completo.txt", "ORA X — Storico completo\n\n" + keys.map(k => rowText(k, h[k])).join("\n") + "\n");
});
el.backup.addEventListener("click", () => {
  const h = loadHistory();
  if (!Object.keys(h).length) return alert("Nessun dato da salvare.");
  download("ora-x-backup.json", JSON.stringify({ app: "ora-x", versione: 2, appVersion: APP_VERSION, esportatoIl: new Date().toISOString(), storico: h }, null, 2), "application/json;charset=utf-8");
});
el.restore.addEventListener("click", () => { el.restoreInput.value = ""; el.restoreInput.click(); });
el.restoreInput.addEventListener("change", async () => {
  const file = el.restoreInput.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()), raw = data?.storico ?? data;
    const imported = normalizeHistory(raw);
    if (!Object.keys(imported).length && Object.keys(raw).length) throw new Error();
    const current = loadHistory();
    let unisci = false;
    if (Object.keys(current).length) {
      unisci = confirm(`Nell'app ci sono già ${Object.keys(current).length} giorni salvati.\n\nUnire il backup ai dati esistenti? In caso di conflitto vince il backup.\n\nOK = Unisci\nAnnulla = altre opzioni`);
      if (!unisci && !confirm("Sostituire TUTTI i dati dell'app con il solo backup?\n\nOperazione non reversibile.\n\nOK = Sostituisci\nAnnulla = interrompi il ripristino")) return;
    }
    saveHistory(unisci ? { ...current, ...imported } : imported);
    loadDay();
    renderHistory();
    alert(`Backup importato: ${Object.keys(imported).length} giorni.`);
  } catch {
    alert("Il file selezionato non è un backup valido di Ora X.");
  }
});

// --- avvio ---
try { el.avviso.checked = localStorage.getItem(CONFIG.ALERT) === "1"; } catch {}
el.giorno.value = oggi();
loadDay();
el.stato.textContent = `Ora X · v${APP_VERSION}`;
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" }).catch(() => {});
// Se l'app resta aperta/in background oltre la mezzanotte, al rientro "oggi" viene riallineato.
let giornoCorrente = oggi();
function controllaCambioGiorno() {
  const adesso = oggi();
  if (adesso === giornoCorrente) return;
  const eraOggi = el.giorno.value === giornoCorrente;
  giornoCorrente = adesso;
  if (eraOggi) { el.giorno.value = adesso; loadDay(); }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  controllaCambioGiorno();
  aggiornaAdesso();
  if (!window.AndroidOraX) planAlert();
});
