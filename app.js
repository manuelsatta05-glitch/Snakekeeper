// ═══════════════════════════════════════
//  SUPABASE CONFIG
// ═══════════════════════════════════════
const SUPABASE_URL = "https://xmtxbtcexyrveifwfswb.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdHhidGNleHlydmVpZndmc3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5Njc4MDYsImV4cCI6MjEwMDU0MzgwNn0.eVW5nAZeKu8NoryZUYRKsmHGoHrPV719X3cRINCUkjk";
const BASE_URL = "https://snakekeeper.it/";

// ═══════════════════════════════════════
//  SICUREZZA: escaping HTML (anti-XSS)
// ═══════════════════════════════════════
// Tutti i campi inseriti liberamente dall'utente (nome, note, specie,
// morfo, provenienza, ecc.) vengono renderizzati dentro innerHTML.
// Senza escaping, un valore come "<img src=x onerror=alert(1)>" salvato
// come nome di un serpente verrebbe eseguito come codice nel browser.
// esc() converte i caratteri pericolosi nelle entita' HTML equivalenti
// prima di inserirli nel markup.
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── LIGHTBOX FOTO (foto ingrandita al click, senza ritaglio) ────────────────
function showPhotoLightbox(url, name) {
  document.getElementById("photo-lightbox")?.remove();
  const overlay = document.createElement("div");
  overlay.id = "photo-lightbox";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:1000;background:rgba(6,13,7,0.92);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out";
  overlay.innerHTML = `
    <button onclick="document.getElementById('photo-lightbox').remove()"
      style="position:absolute;top:16px;right:16px;background:var(--bg-card);border:1px solid var(--border);color:var(--text-bright);width:38px;height:38px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    ${name ? `<div style="position:absolute;top:20px;left:20px;font-family:'Cinzel',serif;color:var(--accent-gold);font-size:15px">${esc(name)}</div>` : ""}
    <img src="${esc(url)}" style="max-width:min(90vw,600px);max-height:85vh;object-fit:contain;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5);cursor:default">`;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  const escHandler = (e) => {
    if (e.key === "Escape") {
      overlay.remove();
      document.removeEventListener("keydown", escHandler);
    }
  };
  document.addEventListener("keydown", escHandler);
}

// ── STRIPE CONFIG ──────────────────────────────────────────────────────────
const STRIPE_PK =
  "pk_test_51TxoKTFXkOXN7EUyLw4pgbOi0oIBtV19KQocWnnmPnICXEP8nHxfxaMSj63Cl8Y99eGhOEuo7YNQ9ZJyNv988YS6000Mp34367";
const STRIPE_PRICES = {
  monthly: "price_1TyteJ2V7PprrT59S3uhFmUm", // €4.99/mese (LIVE)
  yearly: "price_1Tytez2V7PprrT594TmhtdCf", // €47.99/anno (LIVE)
  for_life: "price_1TytI32V7PprrT59MjzwPC9i", // €199 una tantum (LIVE)
};

// Token dell'utente loggato (per far funzionare le policy RLS), fallback su SUPABASE_KEY.
// Se manca meno di un minuto alla scadenza (o è già scaduto) lo rinnova prima di
// restituirlo — la app non usa la SDK completa di Supabase, che farebbe questo da sola
// in background, quindi senza questo controllo le sessioni lunghe finivano in "JWT expired".
async function getSupabaseToken() {
  let token = SUPABASE_KEY;
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith("sb-") && k.includes("auth-token"),
    );
    if (!keys.length) return token;
    let session = JSON.parse(localStorage.getItem(keys[0]));
    if (!session || !session.access_token) return token;
    if (
      (session.expires_at || 0) - 60 < Date.now() / 1000 &&
      session.refresh_token
    ) {
      const refreshed = await refreshAccessToken(session.refresh_token);
      if (refreshed) session = refreshed;
    }
    if (session && session.access_token) token = session.access_token;
  } catch (e) {}
  return token;
}

async function refreshAccessToken(refreshToken) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    saveSession(data);
    const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
    return JSON.parse(localStorage.getItem(key));
  } catch (e) {
    console.warn("Refresh token fallito:", e);
    return null;
  }
}

const SB = {
  async req(path, opts = {}) {
    const token = await getSupabaseToken();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: opts.prefer || "return=representation",
        ...opts.headers,
      },
      ...opts,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || err.hint || "Errore Supabase");
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // SERPENTI
  async getSerpenti() {
    return this.req("serpenti?select=*&order=created_at.asc");
  },
  async insertSerpente(s) {
    return this.req("serpenti", { method: "POST", body: JSON.stringify(s) });
  },
  async deleteSerpente(id) {
    return this.req(`serpenti?id=eq.${id}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  },

  // VENDUTI
  // Lista/grafico: esclude logs_snapshot (~85-90% del peso di ogni riga) — serve solo per il dettaglio.
  async getVenduti() {
    return this.req(
      "venduti?select=id,snake_id,nome,specie,morfo,sesso,nascita,peso,provenienza,icd,note,data_vendita,acquirente,prezzo,note_vendita,snake_created_at,created_at,user_id&order=data_vendita.desc",
    );
  },
  async getVendutoFull(id) {
    const rows = await this.req(`venduti?id=eq.${id}&select=*`);
    return rows[0] || null;
  },
  async insertVenduto(v) {
    return this.req("venduti", { method: "POST", body: JSON.stringify(v) });
  },
  async updateVenduto(id, data) {
    return this.req(`venduti?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      prefer: "return=minimal",
    });
  },
  async deleteVenduto(id) {
    return this.req(`venduti?id=eq.${id}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  },

  // LOGS
  async getLogs(snakeId) {
    const filter = snakeId ? `snake_id=eq.${snakeId}&` : "";
    return this.req(`logs?${filter}select=*&order=data.desc,created_at.desc`);
  },
  async getAllLogs() {
    return this.req("logs?select=*&order=data.desc,created_at.desc");
  },
  // Solo l'ultima riga per (serpente, tipo) — vista server-side (DISTINCT ON), usata per
  // "ultimo pasto"/"ultime feci" nella lista serpenti senza scaricare lo storico completo.
  async getLastLogsPerSnake() {
    return this.req("last_logs_per_snake?select=*");
  },
  // Solo le ultime N righe (tutti i serpenti) — usato all'avvio per Dashboard/Registro,
  // che mostrano comunque solo attività recente. Lo storico completo si carica per-serpente.
  async getRecentLogs(limit) {
    return this.req(
      `logs?select=*&order=data.desc,created_at.desc&limit=${limit}`,
    );
  },
  // Conteggio esatto senza scaricare righe: HEAD + Prefer:count=exact, legge il totale
  // dall'header Content-Range ("*/N"). Usato per statistiche "da sempre" (es. deposizioni).
  async countLogs(filters = {}) {
    const qs = Object.entries(filters)
      .map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`)
      .join("&");
    const token = await getSupabaseToken();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/logs?select=id${qs ? "&" + qs : ""}`,
      {
        method: "HEAD",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          Prefer: "count=exact",
        },
      },
    );
    if (!res.ok) throw new Error("Errore conteggio: " + res.statusText);
    const range = res.headers.get("content-range") || "";
    const total = parseInt(range.split("/")[1], 10);
    return Number.isFinite(total) ? total : 0;
  },
  async insertLog(l) {
    return this.req("logs", { method: "POST", body: JSON.stringify(l) });
  },
  async insertLogsBulk(rows) {
    if (!rows.length) return [];
    // I 5 tipi di log usano colonne diverse (grammi, food_tipo, feci_tipo, ...): un insert
    // bulk con oggetti dalle chiavi diverse tra loro non è affidabile in PostgREST — si
    // normalizza ogni riga con lo stesso set completo di colonne (null dove non si applica).
    return this.req("logs", {
      method: "POST",
      body: JSON.stringify(rows.map(normalizeLogRow)),
    });
  },
  async deleteLog(id) {
    return this.req(`logs?id=eq.${id}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  },
  async updateSerpente(id, data) {
    return this.req(`serpenti?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      prefer: "return=minimal",
    });
  },
  async updateLog(id, data) {
    return this.req(`logs?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      prefer: "return=minimal",
    });
  },

  // RPC — passa da req(), quindi usa getSupabaseToken() e rinnova da solo un JWT
  // in scadenza. Le chiamate rpc storiche sono fetch scritti a mano su getSession()
  // e quel rinnovo non ce l'hanno.
  async rpc(name, body = {}) {
    return this.req(`rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  // TRASFERIMENTI
  // La tabella ha RLS senza policy: non è raggiungibile via PostgREST. Ogni accesso
  // passa da queste RPC SECURITY DEFINER, che ricavano l'identità da auth.uid().
  async getTrasferimentiRicevuti() {
    return this.rpc("get_trasferimenti_ricevuti");
  },
  async getTrasferimentiInviati() {
    return this.rpc("get_trasferimenti_inviati");
  },
  async accettaTrasferimento(id) {
    return this.rpc("accetta_trasferimento", { p_id: id });
  },
  async rifiutaTrasferimento(id) {
    return this.rpc("rifiuta_trasferimento", { p_id: id });
  },
  async annullaTrasferimento(id) {
    return this.rpc("annulla_trasferimento", { p_id: id });
  },
};

// ═══════════════════════════════════════
//  CACHE LOCALE (per velocità UI)
// ═══════════════════════════════════════
let _snakes = [];
// _recentLogs: ultime ~300 righe su tutti i serpenti, per Dashboard/Registro.
// _logsCache: storico completo per-serpente, caricato al volo alla prima apertura della scheda.
// _lastLogsPerSnake: solo l'ultima riga per (snake_id, tipo), per "ultimo pasto"/"ultime feci"
// nella lista serpenti — caricata subito all'avvio (vista server-side last_logs_per_snake),
// indipendente dallo storico completo che resta lazy.
let _recentLogs = [];
let _logsCache = {};
let _lastLogsPerSnake = {}; // chiave `${snakeId}|${tipo}` -> riga log
let _venduti = [];
// Trasferimenti: _trasfRicevuti sono gli inviti in attesa arrivati a questo account
// (col payload completo, è l'anteprima di ciò che si sta per accettare); _trasfInviati
// sono quelli partiti da qui, servono solo a mostrare lo stato sulla scheda del venduto.
let _trasfRicevuti = [];
let _trasfInviati = [];
const RECENT_LOGS_LIMIT = 300;
let _eggsTotalCache = null; // conteggio deposizioni da sempre — via count server-side, non richiede tutto lo storico
const _annullaInFlight = new Set(); // guardia anti doppio-click / listener duplicati su "Annulla vendita"
const _trasfInFlight = new Set(); // stessa guardia per accetta/rifiuta/ritira trasferimento

function _lastLogKey(snakeId, tipo) {
  return snakeId + "|" + tipo;
}
// Confronta due log per "quale è più recente" con lo stesso ordinamento della vista server-side
// (data desc, poi created_at desc), per decidere se aggiornare la cache _lastLogsPerSnake.
function _isNewerLog(a, b) {
  if (!b) return true;
  if ((a.data || "") !== (b.data || "")) return (a.data || "") > (b.data || "");
  return String(a.created_at || "") > String(b.created_at || "");
}
// Ricalcola _lastLogsPerSnake per un serpente dallo storico completo in _logsCache (disponibile
// solo se la scheda dettaglio di quel serpente è già stata aperta in sessione).
function _refreshLastLogsForSnake(snakeId) {
  const logs = _logsCache[snakeId];
  if (!logs) return; // storico non caricato: non tocchiamo quel che sappiamo già
  Object.keys(_lastLogsPerSnake).forEach((k) => {
    if (k.startsWith(snakeId + "|")) delete _lastLogsPerSnake[k];
  });
  logs.forEach((l) => {
    const k = _lastLogKey(snakeId, l.tipo);
    if (_isNewerLog(l, _lastLogsPerSnake[k])) _lastLogsPerSnake[k] = l;
  });
}

function addLogToCaches(log) {
  if (!_logsCache[log.snake_id]) _logsCache[log.snake_id] = [];
  _logsCache[log.snake_id].unshift(log);
  _recentLogs.unshift(log);
  if (_recentLogs.length > RECENT_LOGS_LIMIT) _recentLogs.pop();
  const k = _lastLogKey(log.snake_id, log.tipo);
  if (_isNewerLog(log, _lastLogsPerSnake[k])) _lastLogsPerSnake[k] = log;
}
function removeLogFromCaches(logId, snakeId) {
  if (_logsCache[snakeId])
    _logsCache[snakeId] = _logsCache[snakeId].filter((l) => l.id !== logId);
  _recentLogs = _recentLogs.filter((l) => l.id !== logId);
  _refreshLastLogsForSnake(snakeId);
}
function updateLogInCaches(logId, snakeId, updates) {
  const inCache = (_logsCache[snakeId] || []).find((l) => l.id === logId);
  if (inCache) Object.assign(inCache, updates);
  const inRecent = _recentLogs.find((l) => l.id === logId);
  if (inRecent) Object.assign(inRecent, updates);
  _refreshLastLogsForSnake(snakeId);
}
const LOG_FIELDS = [
  "id",
  "snake_id",
  "user_id",
  "tipo",
  "data",
  "grammi",
  "qty",
  "food_tipo",
  "feci_tipo",
  "num_uova",
  "fertili",
  "temp",
  "note",
  "pulizia_tipo",
  "partner_id",
  "partner_esterno",
  "created_at",
];
function normalizeLogRow(l) {
  const row = {};
  LOG_FIELDS.forEach((f) => {
    row[f] = f in l && l[f] !== undefined ? l[f] : null;
  });
  return row;
}
// Ripristina in blocco lo storico di un serpente (es. dopo "Annulla vendita")
function addLogsToCaches(snakeId, logs) {
  _logsCache[snakeId] = logs.slice();
  _recentLogs = _recentLogs
    .concat(logs)
    .sort(
      (a, b) =>
        b.data.localeCompare(a.data) ||
        String(b.created_at || "").localeCompare(String(a.created_at || "")),
    )
    .slice(0, RECENT_LOGS_LIMIT);
  _refreshLastLogsForSnake(snakeId);
}
let _isOnline = false;
// Vero solo quando loadAll() non è riuscita a caricare serpenti+log, anche dopo il
// retry automatico. Diverso da _isOnline (badge di connessione, aggiornato anche
// dagli eventi online/offline del browser senza ricaricare i dati): usare _isOnline
// per decidere se mostrare il banner d'errore farebbe scattare il banner anche
// quando l'app va semplicemente offline mentre i dati già in memoria sono validi.
let _dataLoadFailed = false;

// Helper: fetch con timeout che si ARRENDE restituendo un fallback (per chiamate
// non critiche, dove "niente dati" è un degrado accettabile).
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}
// Variante per chiamate CRITICHE (serpenti, log): un timeout deve contare come
// fallimento vero, non come "successo" con dati vuoti — altrimenti una connessione
// lenta produce esattamente lo stesso falso-vuoto che questo fix vuole evitare.
function withTimeoutReject(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`timeout: ${label}`)), ms),
    ),
  ]);
}

async function loadAll(_isRetry = false) {
  // Se ci sono modifiche fatte offline e ora si è tornati online, sincronizzale PRIMA di
  // leggere dal server — altrimenti, ricaricando la pagina senza passare da una transizione
  // 'online' dal vivo (l'unico altro punto in cui scatta la sync), restavano bloccate in
  // coda e sparivano dalla UI al refresh pur essendo ancora salvate in locale.
  // Solo al primo giro: il retry automatico non deve rigiocare la stessa coda due volte.
  if (navigator.onLine && !_isRetry) {
    try {
      await replayOfflineQueue();
    } catch (e) {
      console.warn("[Sync] replay all'avvio fallito:", e);
    }
  }

  // Carica ogni tabella individualmente — se una fallisce, le altre funzionano comunque.
  // Serpenti e log sono critici: un timeout deve propagarsi come fallimento vero (vedi
  // withTimeoutReject sopra), le altre tabelle possono degradare a [] senza problemi.
  const results = await Promise.allSettled([
    withTimeoutReject(SB.getSerpenti(), 15000, "serpenti"),
    withTimeoutReject(SB.getRecentLogs(RECENT_LOGS_LIMIT), 15000, "logs"),
    withTimeout(SB.getVenduti(), 15000, []),
    withTimeout(SB.getLastLogsPerSnake(), 15000, []),
    withTimeout(SB.getTrasferimentiRicevuti(), 15000, []),
    withTimeout(SB.getTrasferimentiInviati(), 15000, []),
  ]);

  _snakes = results[0].status === "fulfilled" ? results[0].value || [] : [];
  _recentLogs = results[1].status === "fulfilled" ? results[1].value || [] : [];
  _logsCache = {};
  _lastLogsPerSnake = {};
  (results[3].status === "fulfilled" ? results[3].value || [] : []).forEach(
    (l) => {
      _lastLogsPerSnake[_lastLogKey(l.snake_id, l.tipo)] = l;
    },
  );
  _eggsTotalCache = null;
  _venduti = results[2].status === "fulfilled" ? results[2].value || [] : [];
  _trasfRicevuti =
    results[4].status === "fulfilled" ? results[4].value || [] : [];
  _trasfInviati =
    results[5].status === "fulfilled" ? results[5].value || [] : [];

  // Log errori per debug
  const _labels = [
    "serpenti",
    "logs",
    "venduti",
    "ultimi log",
    "trasferimenti ricevuti",
    "trasferimenti inviati",
  ];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(_labels[i] + " errore:", r.reason);
    }
  });

  // Considera online se almeno serpenti e logs sono caricati
  const ok =
    results[0].status === "fulfilled" && results[1].status === "fulfilled";

  // Un singolo fallimento è spesso solo un hiccup temporaneo (connessione fredda
  // a Supabase, rete lenta al primo giro dopo il login) — riprova UNA volta in
  // automatico prima di arrenderci, così l'utente non vede mai statistiche
  // azzerate false senza nemmeno sapere che deve ricaricare la pagina.
  if (!ok && !_isRetry) {
    await new Promise((r) => setTimeout(r, 1500));
    return loadAll(true);
  }
  _dataLoadFailed = !ok;
  setOnline(ok);
}

// Richiamato dal banner di errore in dashboard/lista serpenti quando anche il
// retry automatico di loadAll() fallisce (es. utente davvero offline).
// Guardia anti-concorrenza: senza, click ripetuti sul bottone "Riprova" farebbero
// partire più loadAll() in parallelo, che rigiocano la coda offline in contemporanea
// e possono inviare la stessa scrittura due volte (righe duplicate sul server).
let _loadAllInFlight = null;
async function retryLoadAll() {
  if (_loadAllInFlight) return _loadAllInFlight;
  const btn = document.getElementById("btn-retry-load");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
  }
  _loadAllInFlight = loadAll().finally(() => {
    _loadAllInFlight = null;
  });
  await _loadAllInFlight;
  showPage(currentPage, currentSnakeId);
}

// Banner mostrato al posto (o sopra) dei dati quando il caricamento da Supabase
// è fallito, per non far credere all'utente che il suo allevamento sia vuoto.
function renderLoadErrorBanner() {
  return `
  <div style="background:rgba(192,57,43,0.08);border:1px solid rgba(192,57,43,0.35);border-radius:10px;padding:16px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="font-size:22px">⚠️</div>
      <div>
        <div style="font-size:13px;color:var(--accent-red);font-weight:700">${t("load_error_title")}</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:2px">${t("load_error_desc")}</div>
      </div>
    </div>
    <button id="btn-retry-load" class="btn btn-ghost btn-sm" onclick="retryLoadAll()">🔄 ${t("load_error_retry")}</button>
  </div>`;
}

function setOnline(val) {
  _isOnline = val;
  const ind = document.getElementById("conn-indicator");
  const mob = document.getElementById("conn-indicator-mob");
  if (ind) {
    ind.className = "conn-badge " + (val ? "online" : "offline");
    ind.innerHTML = `<div class="conn-dot"></div><span>${val ? "☁️ Supabase connesso" : "⚠️ Offline"}</span>`;
  }
  if (mob)
    mob.style.background = val ? "var(--accent-lime)" : "var(--accent-red)";
}

// ═══════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════
function genId() {
  return (
    "SN" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 5).toUpperCase()
  );
}
// Nome leggibile di un genitore: se padre_id/madre_id puntano a un serpente ancora
// in collezione usa quello, altrimenti ricade sul nome esterno scritto a mano.
// Serve a "congelare" la genealogia in testo al momento della vendita, perché dopo
// la vendita il serpente-genitore potrebbe non essere più raggiungibile per id.
function nomeGenitore(snake, ruolo) {
  const idField = ruolo === "padre" ? "padre_id" : "madre_id";
  const txtField = ruolo === "padre" ? "padre_esterno" : "madre_esterna";
  const p = snake[idField]
    ? _snakes.find((s) => s.id === snake[idField])
    : null;
  if (p) {
    const st = [p.specie, p.morfo].filter(Boolean).join(", ");
    return p.nome + (st ? ` (${st})` : "");
  }
  return snake[txtField] || null;
}
function genICD() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let r = "IT-";
  for (let i = 0; i < 8; i++)
    r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}
function fmtDate(d) {
  if (!d) return "—";
  const parts = d.slice(0, 10).split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function age(dob) {
  if (!dob) return "—";
  const ms = Date.now() - new Date(dob);
  const days = Math.floor(ms / 86400000);
  if (days < 30) return days + "g";
  const months = Math.floor(days / 30);
  if (months < 12) return months + " mesi";
  return Math.floor(months / 12) + " anni";
}
function toast(msg, color = "#6db56d") {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  t.style.background = color;
  t.style.color = color === "#6db56d" ? "#0a1a0a" : "#fff";
  document.body.appendChild(t);
  setTimeout(() => closeToastEl(t), 2800);
}
function closeToastEl(t) {
  if (!t || !t.isConnected) return;
  t.classList.add("toast-out");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => t.remove(), reduced ? 20 : 250);
}
// Apertura/chiusura modali con materializzazione (fade+scale in ingresso e uscita, invece di comparire/sparire di scatto)
function openModalEl(modal) {
  modal.classList.add("modal-backdrop");
  document.body.appendChild(modal);
  void modal.offsetWidth; // forza il reflow così la transizione di apertura parte dallo stato iniziale
  requestAnimationFrame(() => modal.classList.add("modal-open"));
}
function closeModalEl(modal) {
  if (!modal) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  modal.classList.remove("modal-open");
  setTimeout(() => modal.remove(), reduced ? 130 : 280);
}
function logsForSnake(snakeId) {
  return _logsCache[snakeId] || [];
}

// ═══════════════════════════════════════
//  DRAWER MOBILE
// ═══════════════════════════════════════
function openDrawer() {
  document.getElementById("mobile-drawer").classList.add("open");
  document.getElementById("drawer-overlay").classList.add("open");
  document.body.style.overflow = "hidden";
  refreshDrawerSnakes();
}
function closeDrawer() {
  document.getElementById("mobile-drawer").classList.remove("open");
  document.getElementById("drawer-overlay").classList.remove("open");
  document.body.style.overflow = "";
}
function refreshDrawerSnakes() {
  const list = document.getElementById("drawer-snake-list");
  let html = '<div class="nav-label">I tuoi serpenti</div>';
  if (!_snakes.length)
    html +=
      '<div style="padding:8px 12px;font-size:12px;color:var(--text-dim)">Nessun serpente</div>';
  const SIDEBAR_LIMIT = 5;
  _snakes.slice(0, SIDEBAR_LIMIT).forEach((s) => {
    html += `<div class="sidebar-snake-item" onclick="showPage('dettaglio','${s.id}');closeDrawer()">
      <div class="sex-dot ${esc(s.sesso)}"></div><span>${esc(s.nome)}</span></div>`;
  });
  if (_snakes.length > SIDEBAR_LIMIT) {
    const rest = _snakes.length - SIDEBAR_LIMIT;
    html += `<div class="sidebar-snake-item" style="color:var(--text-dim);font-style:italic" onclick="showPage('serpenti');closeDrawer()">+ ${rest} altr${rest === 1 ? "o" : "i"}</div>`;
  }
  list.innerHTML = html;
}

// ═══════════════════════════════════════
//  ROUTING
// ═══════════════════════════════════════
let currentPage = "dashboard";
let currentSnakeId = null;

function showPage(page, snakeId = null) {
  currentPage = page;
  currentSnakeId = snakeId;
  window.scrollTo(0, 0);
  ["dashboard", "serpenti", "aggiungi", "registro"].forEach((p) => {
    ["nav-", "mnav-", "mob-"].forEach((prefix) => {
      const el = document.getElementById(prefix + p);
      if (el)
        el.classList.toggle(
          "active",
          p === (page === "dettaglio" ? "serpenti" : page),
        );
    });
  });
  document.getElementById("main-content").innerHTML = "";
  const pages = {
    dashboard: renderDashboard,
    serpenti: renderSerpenti,
    aggiungi: renderAggiungi,
    dettaglio: renderDettaglio,
    registro: renderRegistro,
    venduti: renderVenduti,
    dettaglioVenduto: renderDettaglioVenduto,
    trasferimenti: renderTrasferimenti,
    admin: renderAdmin,
    profilo: renderProfilo,
    privacy: renderPrivacy,
    terms: renderTerms,
  };
  if (pages[page]) pages[page]();
  refreshSidebar();
  applyTrasferimentiUI();
}

function refreshSidebar() {
  const list = document.getElementById("sidebar-snake-list");
  if (!list) return;
  let html = '<div class="nav-label">I tuoi serpenti</div>';
  if (!_snakes.length)
    html +=
      '<div style="padding:8px 12px;font-size:12px;color:var(--text-dim)">Nessun serpente</div>';
  const SIDEBAR_LIMIT = 5;
  _snakes.slice(0, SIDEBAR_LIMIT).forEach((s) => {
    const active =
      currentPage === "dettaglio" && currentSnakeId === s.id ? "active" : "";
    html += `<div class="sidebar-snake-item ${active}" onclick="showPage('dettaglio','${s.id}')">
      <div class="sex-dot ${esc(s.sesso)}"></div><span>${esc(s.nome)}</span></div>`;
  });
  if (_snakes.length > SIDEBAR_LIMIT) {
    const rest = _snakes.length - SIDEBAR_LIMIT;
    html += `<div class="sidebar-snake-item" style="color:var(--text-dim);font-style:italic" onclick="showPage('serpenti')">+ ${rest} altr${rest === 1 ? "o" : "i"}</div>`;
  }
  list.innerHTML = html;
}

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
function renderDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0, 7);
  const totM = _snakes.filter((s) => s.sesso === "M").length;
  const totF = _snakes.filter((s) => s.sesso === "F").length;
  const foodMonth = _recentLogs.filter(
    (l) => l.tipo === "cibo" && l.data && l.data.startsWith(thisMonth),
  ).length;
  let eggsTotal = _eggsTotalCache;
  if (eggsTotal === null) {
    SB.countLogs({ tipo: "uova" })
      .then((n) => {
        _eggsTotalCache = n;
        if (currentPage === "dashboard") renderDashboard();
      })
      .catch(() => {
        _eggsTotalCache = 0;
      });
    eggsTotal = "…";
  }

  const warnings = [];
  _snakes.forEach((s) => {
    // Basato sull'attività recente (ultime 300 registrazioni): se un serpente non
    // compare qui, l'ultimo pasto è più vecchio della finestra osservata — trattato
    // come "nessun dato recente", stesso caso di un serpente mai nutrito.
    const last = _recentLogs
      .filter((l) => l.snake_id === s.id && l.tipo === "cibo")
      .sort((a, b) => b.data.localeCompare(a.data))[0];
    if (last) {
      const days = Math.floor((Date.now() - new Date(last.data)) / 86400000);
      if (days >= 14) warnings.push({ nome: s.nome, days, id: s.id });
    } else {
      warnings.push({ nome: s.nome, days: null, id: s.id });
    }
  });

  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().split("T")[0];
    chartData.push(
      _recentLogs.filter((l) => l.data === d && l.tipo === "cibo").length,
    );
  }
  const maxBar = Math.max(...chartData, 1);

  document.getElementById("main-content").innerHTML = `
  <div class="page-header"><h2>🌿 Dashboard</h2><p>${t("dashboard_welcome")} · ☁️ Dati su Supabase</p></div>
  ${_dataLoadFailed ? renderLoadErrorBanner() : ""}
  <div class="dash-stats-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-bottom:20px">
    ${[
      [
        "🐍",
        _dataLoadFailed ? "—" : _snakes.length,
        t("dashboard_totale"),
        "var(--accent-gold)",
      ],
      ["♂️", _dataLoadFailed ? "—" : totM, t("dashboard_maschi"), "#5b9bd5"],
      [
        "♀️",
        _dataLoadFailed ? "—" : totF,
        t("dashboard_femmine"),
        "var(--accent-pink)",
      ],
      [
        "🥩",
        _dataLoadFailed ? "—" : foodMonth,
        t("dashboard_pasti_mese"),
        "var(--accent-lime)",
      ],
      [
        "🥚",
        _dataLoadFailed ? "—" : eggsTotal,
        t("dashboard_deposizioni"),
        "var(--accent-pink)",
      ],
    ]
      .map(
        ([ico, val, lab, col]) => `
      <div class="card" style="text-align:center;padding:14px">
        <div style="font-size:28px;margin-bottom:4px">${ico}</div>
        <div style="font-family:'Cinzel',serif;font-size:26px;color:${col}">${val}</div>
        <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">${lab}</div>
      </div>`,
      )
      .join("")}
  </div>
  <div class="dash-bottom-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="card">
      <div class="card-title">📊 ${t("dashboard_pasti_7gg")}</div>
      <div class="mini-chart">${chartData.map((v) => `<div class="mini-bar" style="height:${Math.max(6, (v / maxBar) * 100)}%"></div>`).join("")}</div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:9px;color:var(--text-dim)">
        ${["6", "5", "4", "3", "2"]
          .map((n) => `<span>${n}${t("dashboard_giorni_fa")}</span>`)
          .concat([
            `<span>${t("dashboard_ieri")}</span>`,
            `<span>${t("dashboard_oggi")}</span>`,
          ])
          .join("")}
      </div>
    </div>
    <div class="card">
      <div class="card-title">⚠️ ${t("dashboard_attenzione")}</div>
      ${
        _dataLoadFailed
          ? `<div style="color:var(--text-dim);font-size:14px;padding:8px 0">${t("dashboard_dati_non_disponibili")}</div>`
          : warnings.length === 0
            ? `<div style="color:var(--text-dim);font-size:14px;padding:8px 0">✅ ${t("dashboard_tutto_regola")}</div>`
            : warnings
                .map(
                  (w) => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span>🐍</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;color:var(--text-bright);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.nome)}</div>
              <div style="font-size:10px;color:var(--accent-red)">${w.days === null ? t("dashboard_nessun_pasto") : w.days + t("dashboard_giorni_fa")}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="showPage('dettaglio','${w.id}')" style="padding:6px 10px;font-size:11px">${t("dashboard_vai")}</button>
          </div>`,
                )
                .join("")
      }
    </div>
  </div>
  ${
    _snakes.length === 0 && !_dataLoadFailed
      ? `
  <div class="card mt-24" style="text-align:center;padding:40px 20px">
    <div style="font-size:56px;margin-bottom:12px">🐍</div>
    <h3 style="font-family:'Cinzel',serif;color:var(--text-mid);margin-bottom:8px">${t("dashboard_inizia")}</h3>
    <p style="color:var(--text-dim);margin-bottom:18px;font-size:14px">${t("dashboard_aggiungi_primo")}</p>
    <button class="btn btn-primary" onclick="showPage('aggiungi')">➕ ${t("dashboard_aggiungi_serpente")}</button>
  </div>`
      : ""
  }`;
}

// ═══════════════════════════════════════
//  LISTA SERPENTI
// ═══════════════════════════════════════
function renderSerpenti() {
  let html = `
  <div class="page-header"><h2>🐍 ${t("serpenti_title")}</h2><p>${_dataLoadFailed ? "—" : _snakes.length} ${t("serpenti_count_suffix")}</p></div>
  <div style="margin-bottom:16px"><button class="btn btn-primary" onclick="showPage('aggiungi')">➕ ${t("serpenti_aggiungi")}</button></div>`;

  if (_dataLoadFailed) html += renderLoadErrorBanner();

  const nLocked = lockedSnakesCount();
  if (nLocked > 0) {
    html += `<div style="margin-bottom:16px;padding:14px 16px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.35);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:10px;min-width:210px;flex:1">
        <div style="font-size:22px">🔒</div>
        <div>
          <div style="font-size:13px;color:var(--accent-gold);font-weight:700">${nLocked} ${nLocked === 1 ? t("serpenti_locked_singular") : t("serpenti_locked_plural")} ${t("serpenti_locked_suffix")}</div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:3px;line-height:1.45">${t("serpenti_locked_desc").replace("{N}", FREE_SNAKE_LIMIT)}</div>
        </div>
      </div>
      <button onclick="showUpgradeModal()" style="background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;white-space:nowrap">⭐ ${t("serpenti_sblocca_pro")}</button>
    </div>`;
  }

  if (!_snakes.length && !_dataLoadFailed) {
    html += `<div class="empty-state"><div class="empty-icon">🐍</div><h3>${t("serpenti_empty_title")}</h3><p>${t("serpenti_empty_desc")}</p><button class="btn btn-primary" onclick="showPage('aggiungi')">➕ ${t("serpenti_aggiungi")}</button></div>`;
  } else if (_snakes.length) {
    html +=
      '<div class="snakes-grid">' +
      _snakes
        .map((s) => {
          const locked = !canEditSnake(s.id);
          const lastFood = _lastLogsPerSnake[_lastLogKey(s.id, "cibo")];
          const lastFece = _lastLogsPerSnake[_lastLogKey(s.id, "feci")];
          return `
      <div class="snake-card" onclick="showPage('dettaglio','${s.id}')">
        <div class="snake-card-header">
          <div style="display:flex;align-items:center;gap:10px">
            ${s.foto_url ? `<img src="${esc(s.foto_url)}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;object-position:${esc(s.foto_position || "50% 50%")};flex-shrink:0;cursor:zoom-in" onclick="event.stopPropagation();showPhotoLightbox('${esc(s.foto_url)}','${esc(s.nome)}')">` : ""}
            <div><div class="snake-name">${esc(s.nome)}</div><div class="snake-code">${esc(s.icd)}</div></div>
          </div>
          <div style="display:flex;align-items:center;gap:7px">
            ${locked ? `<span title="${t("serpenti_locked_tooltip")}" style="font-size:14px">🔒</span>` : ""}
            <span class="badge badge-${esc(s.sesso)}">${s.sesso === "M" ? "♂" : "♀"}</span>
          </div>
        </div>
        <div class="snake-info">
          <div class="snake-info-item"><div class="snake-info-label">${t("serpenti_specie")}</div><div class="snake-info-value">${esc(s.specie || "—")}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("serpenti_eta")}</div><div class="snake-info-value">${age(s.nascita)}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("serpenti_ultimo_pasto")}</div><div class="snake-info-value" style="font-size:12px">${lastFood ? fmtDate(lastFood.data) : "—"}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("serpenti_ultime_feci")}</div><div class="snake-info-value" style="font-size:12px">${lastFece ? fmtDate(lastFece.data) : "—"}</div></div>
        </div>
        <div class="snake-card-actions" onclick="event.stopPropagation()">
          <button class="btn btn-green btn-sm" onclick="showPage('dettaglio','${s.id}')">📋 ${t("serpenti_dettagli")}</button>
          <button class="btn btn-ghost btn-sm" onclick="printLabel('${s.id}')">🏷️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSerpente('${s.id}')">🗑️</button>
        </div>
      </div>`;
        })
        .join("") +
      "</div>";
  }
  document.getElementById("main-content").innerHTML = html;
}

// ═══════════════════════════════════════
//  AGGIUNGI SERPENTE
// ═══════════════════════════════════════
function renderAggiungi() {
  _addFotoData = null;
  const limitBadge = !isPro()
    ? `
    <div style="margin-bottom:16px;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px">
      <div>
        <div style="font-size:12px;color:var(--text-dim)">${t("aggiungi_piano_free")} · <strong style="color:var(--text-mid)">${_snakes.length}/${FREE_SNAKE_LIMIT}</strong> ${t("aggiungi_serpenti_usati")}</div>
        <div style="margin-top:4px;background:var(--bg-moss);border-radius:4px;height:4px;width:180px">
          <div style="height:4px;border-radius:4px;background:${_snakes.length >= FREE_SNAKE_LIMIT ? "var(--accent-red)" : "var(--accent-lime)"};width:${Math.min(100, (_snakes.length / FREE_SNAKE_LIMIT) * 100)}%"></div>
        </div>
      </div>
      <button onclick="showUpgradeModal()" style="background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;white-space:nowrap">⭐ Pro</button>
    </div>`
    : "";
  document.getElementById("main-content").innerHTML = `
  <div class="page-header"><h2>➕ ${t("aggiungi_title")}</h2><p>${t("aggiungi_subtitle")}</p></div>
  ${limitBadge}
  <div class="card">
    <div class="card-title">🐍 ${t("aggiungi_dati_anagrafici")}</div>
    <div class="form-group" style="margin-bottom:16px">
      <label>${t("aggiungi_foto_opz")}</label>
      <div style="display:flex;align-items:center;gap:14px;margin-top:6px">
        <div id="add-foto-preview" style="width:90px;height:90px;border-radius:12px;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:32px;background:var(--bg-moss);flex-shrink:0">📷</div>
        <div>
          <label class="btn btn-ghost btn-sm" style="cursor:pointer">
            📤 ${t("aggiungi_carica_foto")}
            <input type="file" accept="image/*" onchange="previewFotoAdd(this)" style="display:none">
          </label>
          <div id="add-foto-pos-container"></div>
        </div>
      </div>
      <input type="hidden" id="foto-position-input" value="50% 50%">
    </div>
    <div class="form-grid">
      <div class="form-group"><label>${t("aggiungi_nome")}</label><input type="text" id="f-nome" placeholder="${t("aggiungi_ph_nome")}" autocomplete="off"></div>
      <div class="form-group"><label>${t("aggiungi_specie")}</label><input type="text" id="f-specie" placeholder="${t("aggiungi_ph_specie")}" autocomplete="off"></div>
      <div class="form-group"><label>${t("aggiungi_morfo")}</label><input type="text" id="f-morfo" placeholder="${t("aggiungi_ph_morfo")}" autocomplete="off"></div>
      <div class="form-group">
        <label>${t("aggiungi_sesso")}</label>
        <select id="f-sesso">
          <option value="">${t("aggiungi_seleziona")}</option>
          <option value="M">♂ ${t("aggiungi_maschio")}</option>
          <option value="F">♀ ${t("aggiungi_femmina")}</option>
        </select>
      </div>
      <div class="form-group"><label>${t("aggiungi_nascita")}</label><input type="date" id="f-nascita"></div>
      <div class="form-group"><label>${t("aggiungi_peso")}</label><input type="number" id="f-peso" placeholder="${t("aggiungi_ph_peso")}" inputmode="decimal"></div>
      <div class="form-group"><label>${t("aggiungi_provenienza")}</label><input type="text" id="f-provenienza" placeholder="${t("aggiungi_ph_provenienza")}" autocomplete="off"></div>
      <div class="form-group">
        <label>${t("aggiungi_icd")}</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="text" id="f-icd" style="flex:1" autocomplete="off">
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('f-icd').value=genICD()" style="flex-shrink:0">🔄</button>
        </div>
      </div>
    </div>
    <div class="form-group mt-16"><label>${t("aggiungi_note")}</label><textarea id="f-note" rows="3" placeholder="${t("aggiungi_note_ph")}" style="resize:vertical"></textarea></div>
  </div>
  <div class="card mt-16">
    <div class="card-title">🧬 ${t("gen_title")}</div>
    <div class="form-grid">
      ${renderParentField("padre", null, null, "M", null)}
      ${renderParentField("madre", null, null, "F", null)}
    </div>
    <div class="form-group mt-16"><label>${t("gen_genetica")}</label><input type="text" id="f-genetica" placeholder="${t("gen_genetica_ph")}" autocomplete="off"></div>
  </div>
    <div class="flex-row mt-20">
      <button class="btn btn-primary" id="btn-salva-serpente" onclick="saveSerpente()">💾 ${t("aggiungi_salva")}</button>
      <button class="btn btn-ghost" onclick="showPage('serpenti')">${t("aggiungi_annulla")}</button>
    </div>
  </div>`;
  document.getElementById("f-icd").value = genICD();
}

async function saveSerpente() {
  const nome = document.getElementById("f-nome").value.trim();
  const sesso = document.getElementById("f-sesso").value;
  if (!nome) {
    toast(t("err_nome_richiesto"), "#c0392b");
    return;
  }
  if (!sesso) {
    toast(t("err_sesso_richiesto"), "#c0392b");
    return;
  }
  if (isNameTaken(nome)) {
    toast(`"${nome}" ${t("err_nome_usato")}`, "#c0392b");
    return;
  }
  if (!canAddSnake()) {
    showUpgradeModal();
    return;
  }
  const btn = document.getElementById("btn-salva-serpente");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvataggio...';
  const snake = {
    id: genId(),
    nome,
    sesso,
    specie: document.getElementById("f-specie").value.trim() || null,
    morfo: document.getElementById("f-morfo").value.trim() || null,
    nascita: document.getElementById("f-nascita").value || null,
    peso: parseFloat(document.getElementById("f-peso").value) || null,
    provenienza: document.getElementById("f-provenienza").value.trim() || null,
    icd: document.getElementById("f-icd").value.trim() || genICD(),
    note: document.getElementById("f-note").value.trim() || null,
    foto_url: _addFotoData || null,
    foto_position: _addFotoData
      ? document.getElementById("foto-position-input")?.value || "50% 50%"
      : "50% 50%",
    ...readParentFields(),
    genetica: document.getElementById("f-genetica").value.trim() || null,
  };
  try {
    await SB.insertSerpente(snake);
    _snakes.push(snake);
    _logsCache[snake.id] = []; // serpente appena creato: nessuno storico da recuperare
    _addFotoData = null;
    toast("🐍 Serpente salvato nel cloud!");
    showPage("dettaglio", snake.id);
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva";
  }
}

// ═══════════════════════════════════════
//  DETTAGLIO SERPENTE
// ═══════════════════════════════════════
function renderDettaglio() {
  const snake = _snakes.find((s) => s.id === currentSnakeId);
  if (!snake) {
    showPage("serpenti");
    return;
  }

  // Storico completo caricato al volo alla prima apertura di questa scheda in sessione.
  if (!_logsCache[snake.id]) {
    document.getElementById("main-content").innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-ghost btn-sm" onclick="showPage('serpenti')">← ${t("det_indietro")}</button></div>
      <div class="empty-state"><div class="empty-icon">⏳</div><h3>Caricamento storico…</h3></div>`;
    SB.getLogs(snake.id)
      .then((rows) => {
        _logsCache[snake.id] = rows || [];
        if (currentPage === "dettaglio" && currentSnakeId === snake.id)
          renderDettaglio();
      })
      .catch((e) => toast("Errore: " + e.message, "#c0392b"));
    return;
  }

  const logs = logsForSnake(snake.id);
  const foodLogs = logs
    .filter((l) => l.tipo === "cibo")
    .sort((a, b) => b.data.localeCompare(a.data));
  const feciLogs = logs
    .filter((l) => l.tipo === "feci")
    .sort((a, b) => b.data.localeCompare(a.data));
  const eggsLogs = logs
    .filter((l) => l.tipo === "uova")
    .sort((a, b) => b.data.localeCompare(a.data));
  const puliziaLogs = logs
    .filter((l) => l.tipo === "pulizia")
    .sort((a, b) => b.data.localeCompare(a.data));
  const mutaLogs = logs
    .filter((l) => l.tipo === "muta")
    .sort((a, b) => b.data.localeCompare(a.data));
  const pesoLogs = logs
    .filter((l) => l.tipo === "peso")
    .sort((a, b) => a.data.localeCompare(b.data));
  const totalFood = foodLogs.reduce(
    (s, l) => s + (parseFloat(l.grammi) || 0),
    0,
  );
  const todayVal = new Date().toISOString().split("T")[0];

  document.getElementById("main-content").innerHTML = `
  <div style="margin-bottom:14px">
    <button class="btn btn-ghost btn-sm" onclick="showPage('serpenti')">← ${t("det_indietro")}</button>
  </div>
  <div class="snake-detail-header">
    <div class="sdh-top">
      <div class="sdh-top-row1">
        <div class="snake-avatar" style="position:relative;overflow:hidden;border-radius:50%;width:56px;height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--bg-moss)">${snake.foto_url ? `<img src="${esc(snake.foto_url)}" style="width:100%;height:100%;object-fit:cover;object-position:${esc(snake.foto_position || "50% 50%")};cursor:zoom-in" onclick="showPhotoLightbox('${esc(snake.foto_url)}','${esc(snake.nome)}')">` : "🐍"}</div>
        <div class="sdh-name-block">
          <div class="snake-detail-name">${esc(snake.nome)}</div>
          <div class="snake-detail-meta">
            <span class="badge badge-${esc(snake.sesso)}">${snake.sesso === "M" ? "♂ " + t("aggiungi_maschio") : "♀ " + t("aggiungi_femmina")}</span>
            ${snake.specie ? `<span>🦎 ${esc(snake.specie)}</span>` : ""}
            ${snake.morfo ? `<span>🎨 ${esc(snake.morfo)}</span>` : ""}
            ${snake.nascita ? `<span>🎂 ${fmtDate(snake.nascita)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="sdh-top-row2">
        <button class="btn btn-ghost btn-sm" onclick="printLabel('${snake.id}')">🏷️ ${t("det_stampa")}</button>
        <button class="btn btn-ghost btn-sm" onclick="printSchedaSerpente('${snake.id}')" style="color:var(--accent-lime);border-color:var(--accent-lime)">📄 PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="showVendiModal('${snake.id}')" style="color:var(--accent-gold);border-color:var(--accent-gold)">💰 ${t("det_vendi")}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteSerpente('${snake.id}')">🗑️</button>
      </div>
    </div>
    <div class="sdh-bottom">
      <div class="snake-stats">
        <div class="stat"><div class="stat-val">${age(snake.nascita)}</div><div class="stat-lab">${t("serpenti_eta")}</div></div>
        <div class="stat"><div class="stat-val">${foodLogs.length}</div><div class="stat-lab">${t("det_pasti")}</div></div>
        <div class="stat"><div class="stat-val">${totalFood.toFixed(0)}g</div><div class="stat-lab">${t("det_cibo_tot")}</div></div>
        <div class="stat"><div class="stat-val">${feciLogs.length}</div><div class="stat-lab">${t("det_feci")}</div></div>
        <div class="stat"><div class="stat-val">${puliziaLogs.length}</div><div class="stat-lab">${t("det_pulizie")}</div></div>
        ${snake.sesso === "F" ? `<div class="stat"><div class="stat-val">${eggsLogs.length}</div><div class="stat-lab">${t("dashboard_deposizioni")}</div></div>` : ""}
        <div class="stat"><div class="stat-val">${mutaLogs.length}</div><div class="stat-lab">${t("det_mute")}</div></div>
      </div>
      <div class="sdh-icd">${esc(snake.icd)}</div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" id="tab-cibo" onclick="switchTab('cibo')">🥩 ${t("det_tab_pasti")}</button>
    <button class="tab" id="tab-feci" onclick="switchTab('feci')">💩 ${t("det_tab_feci")}</button>
    ${snake.sesso === "F" ? `<button class="tab" id="tab-uova" onclick="switchTab('uova')">🥚 ${t("det_tab_uova")}</button>` : ""}
    <button class="tab" id="tab-pulizia" onclick="switchTab('pulizia')">🧹 ${t("det_tab_pulizia")}</button>
    <button class="tab" id="tab-muta" onclick="switchTab('muta')">🦎 ${t("det_tab_mute")}</button>
    <button class="tab" id="tab-peso" onclick="switchTab('peso')">⚖️ ${t("det_tab_peso")}</button>
    <button class="tab" id="tab-info" onclick="switchTab('info')">📄 ${t("det_tab_info")}</button>
  </div>

  <!-- TAB CIBO -->
  <div id="tab-content-cibo">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🥩 ${t("reg_pasto")}</div>
      <div class="form-grid">
        <div class="form-group"><label>${t("label_data")}</label><input type="date" id="food-data" value="${todayVal}"></div>
        <div class="form-group">
          <label>${t("tipo_cibo")}</label>
          <select id="food-tipo">
            <option>${t("food_topo_sc")}</option><option>${t("food_topo_vivo")}</option>
            <option>${t("food_ratto_sc")}</option><option>${t("food_ratto_vivo")}</option>
            <option>${t("food_pulcino")}</option><option>${t("food_coniglio")}</option><option>${t("food_altro")}</option>
          </select>
        </div>
        <div class="form-group"><label>${t("peso_preda")}</label><input type="number" id="food-grammi" placeholder="es. 45" inputmode="decimal"></div>
        <div class="form-group"><label>${t("quantita")}</label><input type="number" id="food-qty" value="1" min="1" inputmode="numeric"></div>
      </div>
      <div class="form-group mt-16"><label>${t("label_note")}</label><input type="text" id="food-note" placeholder="${t("ph_pasto_note")}" autocomplete="off"></div>
      <button class="btn btn-green mt-16" id="btn-log-food" onclick="logFood('${snake.id}')">💾 ${t("salva_pasto")}</button>
    </div>
    <div class="card">
      <div class="card-title">📜 ${t("label_storico")} (${foodLogs.length})</div>
      ${renderLogList(foodLogs, "food", snake.id)}
    </div>
  </div>

  <!-- TAB FECI -->
  <div id="tab-content-feci" style="display:none">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">💩 ${t("reg_feci")}</div>
      <div class="form-grid">
        <div class="form-group"><label>${t("label_data")}</label><input type="date" id="feci-data" value="${todayVal}"></div>
        <div class="form-group">
          <label>${t("consistenza")}</label>
          <select id="feci-tipo">
            <option>${t("feci_normale")}</option><option>${t("feci_liquide")}</option><option>${t("feci_dure")}</option>
            <option>${t("feci_urati")}</option><option>${t("feci_sangue")}</option>
          </select>
        </div>
      </div>
      <div class="form-group mt-16"><label>${t("label_note")}</label><input type="text" id="feci-note" placeholder="${t("ph_feci_note")}" autocomplete="off"></div>
      <button class="btn btn-primary mt-16" style="background:var(--accent-gold)" id="btn-log-feci" onclick="logFeci('${snake.id}')">💾 ${t("aggiungi_salva")}</button>
    </div>
    <div class="card">
      <div class="card-title">📜 ${t("label_storico")} (${feciLogs.length})</div>
      ${renderLogList(feciLogs, "feci", snake.id)}
    </div>
  </div>

  <!-- TAB UOVA -->
  ${
    snake.sesso === "F"
      ? `<div id="tab-content-uova" style="display:none">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🥚 ${t("reg_deposizione")}</div>
      <div class="form-grid">
        <div class="form-group"><label>${t("label_data")}</label><input type="date" id="eggs-data" value="${todayVal}"></div>
        <div class="form-group"><label>${t("n_uova")}</label><input type="number" id="eggs-num" placeholder="es. 6" inputmode="numeric"></div>
        <div class="form-group"><label>${t("n_fertili")}</label><input type="number" id="eggs-fertili" placeholder="es. 5" inputmode="numeric"></div>
        <div class="form-group"><label>${t("temp_incubazione")}</label><input type="number" id="eggs-temp" placeholder="es. 31" step="0.1" inputmode="decimal"></div>
        ${renderParentField("partner", null, null, "M", snake.id)}
      </div>
      <div class="form-group mt-16"><label>${t("label_note")}</label><input type="text" id="eggs-note" placeholder="${t("ph_uova_note")}" autocomplete="off"></div>
      <button class="btn mt-16" style="background:var(--accent-pink);color:#1a0010" id="btn-log-uova" onclick="logUova('${snake.id}')">💾 ${t("aggiungi_salva")}</button>
    </div>
    <div class="card">
      <div class="card-title">📜 ${t("label_storico")} (${eggsLogs.length})</div>
      ${renderLogList(eggsLogs, "eggs", snake.id)}
    </div>
  </div>`
      : ""
  }

  <!-- TAB PULIZIA -->
  <div id="tab-content-pulizia" style="display:none">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🧹 ${t("reg_pulizia")}</div>
      <div class="form-grid">
        <div class="form-group"><label>${t("label_data")}</label><input type="date" id="pulizia-data" value="${todayVal}"></div>
        <div class="form-group">
          <label>${t("tipo_pulizia")}</label>
          <select id="pulizia-tipo">
            <option value="Pulizia completa">${t("pulizia_completa")}</option>
            <option value="Pulizia parziale">${t("pulizia_parziale")}</option>
            <option value="Cambio acqua">${t("cambio_acqua")}</option>
            <option value="Disinfezione">${t("disinfezione")}</option>
          </select>
        </div>
      </div>
      <div class="form-group mt-16"><label>${t("label_note")}</label><input type="text" id="pulizia-note" placeholder="${t("ph_pulizia_note")}" autocomplete="off"></div>
      <button class="btn mt-16" style="background:#4a90a4;color:#fff" id="btn-log-pulizia" onclick="logPulizia('${snake.id}')">💾 ${t("aggiungi_salva")}</button>
    </div>
    <div class="card">
      <div class="card-title">📜 ${t("storico_pulizie")} (${puliziaLogs.length})</div>
      ${
        puliziaLogs.length === 0
          ? `<div style="color:var(--text-dim);font-size:14px;padding:10px 0">${t("nessuna_pulizia")}</div>`
          : puliziaLogs
              .map(
                (l) => `<div class="log-entry">
          <div class="log-icon" style="background:rgba(74,144,164,0.2)">🧹</div>
          <div class="log-info">
            <div class="log-date">${fmtDate(l.data)}</div>
            <div class="log-desc">${l.pulizia_tipo || "Pulizia"}${l.note ? ` · ${esc(l.note)}` : ""}</div>
          </div>
          <button class="log-delete" onclick="deleteLogEntry('${l.id}','${snake.id}')">✕</button>
        </div>`,
              )
              .join("")
      }
    </div>
  </div>

  <!-- TAB MUTA -->
  <div id="tab-content-muta" style="display:none">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🦎 ${t("reg_muta")}</div>
      <div class="form-grid">
        <div class="form-group"><label>${t("label_data")}</label><input type="date" id="muta-data" value="${todayVal}"></div>
        <div class="form-group">
          <label>${t("esito")}</label>
          <select id="muta-tipo">
            <option>${t("muta_completa")}</option><option>${t("muta_parziale")}</option>
            <option>${t("muta_problematica")}</option><option>${t("muta_in_corso")}</option>
          </select>
        </div>
      </div>
      <div class="form-group mt-16"><label>${t("label_note")}</label><input type="text" id="muta-note" placeholder="${t("ph_muta_note")}" autocomplete="off"></div>
      <button class="btn mt-16" style="background:#8e7cc3;color:#fff" id="btn-log-muta" onclick="logMuta('${snake.id}')">💾 ${t("salva_muta")}</button>
    </div>
    <div class="card">
      <div class="card-title">📜 ${t("storico_mute")} (${mutaLogs.length})</div>
      ${
        mutaLogs.length === 0
          ? `<div style="color:var(--text-dim);font-size:14px;padding:10px 0">${t("nessuna_muta")}</div>`
          : mutaLogs
              .map(
                (l) => `<div class="log-entry">
          <div class="log-icon" style="background:rgba(142,124,195,0.2)">🦎</div>
          <div class="log-info">
            <div class="log-date">${fmtDate(l.data)}</div>
            <div class="log-desc">${l.feci_tipo || "Completa"}${l.note ? ` · ${esc(l.note)}` : ""}</div>
          </div>
          <button class="log-delete" onclick="deleteLogEntry('${l.id}','${snake.id}')">✕</button>
        </div>`,
              )
              .join("")
      }
    </div>
  </div>

  <!-- TAB PESO -->
  <div id="tab-content-peso" style="display:none">
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">⚖️ ${t("reg_peso")}</div>
      <div class="form-grid">
        <div class="form-group"><label>${t("label_data")}</label><input type="date" id="peso-data" value="${todayVal}"></div>
        <div class="form-group"><label>${t("peso_g")}</label><input type="number" id="peso-grammi" placeholder="es. 450" inputmode="decimal"></div>
      </div>
      <div class="form-group mt-16"><label>${t("label_note")}</label><input type="text" id="peso-note" placeholder="${t("ph_peso_note")}" autocomplete="off"></div>
      <button class="btn mt-16" style="background:var(--accent-lime);color:#0a1a0a" id="btn-log-peso" onclick="logPeso('${snake.id}')">💾 ${t("salva_peso")}</button>
    </div>
    ${
      pesoLogs.length > 0
        ? `<div class="card" style="margin-bottom:14px">
      <div class="card-title">📈 ${t("curva_crescita")}</div>
      <div style="background:var(--bg-moss);border-radius:8px;padding:16px 8px;overflow-x:auto">
        ${(() => {
          const pl = pesoLogs.filter((l) => l.grammi);
          if (pl.length < 2)
            return `<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:40px 0">${t("servono_2_pesate")}</div>`;
          const vals = pl.map((l) => l.grammi);
          const minV = Math.min(...vals),
            maxV = Math.max(...vals);
          const range = maxV - minV || 1;
          const pointSpacing = 76;
          const leftPad = 36,
            rightPad = 36;
          const chartW = Math.max(
            400,
            (pl.length - 1) * pointSpacing + leftPad + rightPad,
          );
          const plotH = 150,
            topPad = 26,
            dateAreaH = 30;
          const svgH = topPad + plotH + dateAreaH;
          const xForI = (i) => leftPad + i * pointSpacing;
          const yForV = (v) => topPad + plotH - ((v - minV) / range) * plotH;
          const shortDate = (d) => {
            if (!d) return "";
            const [y, m, dd] = d.split("-");
            return `${dd}/${m}/${y.slice(2)}`;
          };
          const points = pl.map((l, i) => [
            xForI(i),
            yForV(l.grammi),
            l.grammi,
            l.data,
          ]);
          const path = points
            .map(
              (p, i) =>
                (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1),
            )
            .join(" ");
          return `<svg viewBox="0 0 ${chartW} ${svgH}" width="${chartW}" height="${svgH}" style="display:block">
            <path d="${path}" fill="none" stroke="var(--accent-lime)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
            ${points
              .map(
                ([x, y, g, d]) => `
              <circle cx="${x}" cy="${y}" r="4" fill="var(--accent-lime)" stroke="var(--bg-moss)" stroke-width="2"/>
              <text x="${x}" y="${Math.max(12, y - 11)}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--accent-gold)" font-family="Inter,sans-serif">${g}g</text>
              <text x="${x}" y="${topPad + plotH + 20}" text-anchor="middle" font-size="9.5" fill="var(--text-dim)" font-family="Inter,sans-serif">${shortDate(d)}</text>
            `,
              )
              .join("")}
          </svg>`;
        })()}
      </div>
    </div>`
        : ""
    }
    <div class="card">
      <div class="card-title">📜 ${t("storico_pesate")} (${pesoLogs.length})</div>
      ${
        pesoLogs.length === 0
          ? `<div style="color:var(--text-dim);font-size:14px;padding:10px 0">${t("nessuna_pesata")}</div>`
          : [...pesoLogs]
              .reverse()
              .map(
                (l) => `<div class="log-entry">
          <div class="log-icon" style="background:rgba(109,181,109,0.2)">⚖️</div>
          <div class="log-info">
            <div class="log-date">${fmtDate(l.data)}</div>
            <div class="log-desc">${l.grammi || 0}g${l.note ? ` · ${esc(l.note)}` : ""}</div>
          </div>
          <button class="log-delete" onclick="deleteLogEntry('${l.id}','${snake.id}')">✕</button>
        </div>`,
              )
              .join("")
      }
    </div>
  </div>

  <!-- TAB INFO -->
  <div id="tab-content-info" style="display:none">
    <div class="card">
      <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
        📄 ${t("scheda_anagrafica")}
        <button class="btn btn-ghost btn-sm" onclick="toggleEditSerpente('${snake.id}')" id="btn-toggle-edit">✏️ ${t("modifica")}</button>
      </div>
      <div id="info-view-mode">
        ${snake.foto_url ? `<div style="text-align:center;margin-bottom:14px"><img src="${esc(snake.foto_url)}" style="width:120px;height:120px;border-radius:12px;object-fit:cover;object-position:${esc(snake.foto_position || "50% 50%")};border:2px solid var(--border);cursor:zoom-in" onclick="showPhotoLightbox('${esc(snake.foto_url)}','${esc(snake.nome)}')"></div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
          ${[
            [t("lbl_nome"), snake.nome],
            [t("lbl_specie"), snake.specie || "—"],
            [t("lbl_morfo"), snake.morfo || "—"],
            [
              t("lbl_sesso"),
              snake.sesso === "M"
                ? "♂ " + t("aggiungi_maschio")
                : "♀ " + t("aggiungi_femmina"),
            ],
            [t("lbl_nascita"), fmtDate(snake.nascita)],
            [t("serpenti_eta"), age(snake.nascita)],
            [t("lbl_peso"), snake.peso ? snake.peso + "g" : "—"],
            [t("lbl_provenienza"), snake.provenienza || "—"],
            [t("lbl_icd"), snake.icd],
          ]
            .map(
              ([k, v]) => `
            <div style="background:var(--bg-moss);border-radius:8px;padding:10px">
              <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">${k}</div>
              <div style="font-size:13px;color:var(--text-bright);margin-top:3px;font-weight:500;word-break:break-word">${v}</div>
            </div>`,
            )
            .join("")}
        </div>
        ${
          snake.note
            ? `<div style="margin-top:12px;background:var(--bg-moss);border-radius:8px;padding:12px">
          <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${t("label_note")}</div>
          <div style="font-size:13px;color:var(--text-mid)">${esc(snake.note)}</div>
        </div>`
            : ""
        }
      </div>
      <div id="info-edit-mode" style="display:none">
        <div style="text-align:center;margin-bottom:14px">
          <div style="position:relative;display:inline-block">
            ${snake.foto_url ? `<img id="edit-foto-preview" src="${esc(snake.foto_url)}" style="width:100px;height:100px;border-radius:12px;object-fit:cover;object-position:${esc(snake.foto_position || "50% 50%")};border:2px solid var(--border)">` : `<div id="edit-foto-preview" style="width:100px;height:100px;border-radius:12px;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:36px;background:var(--bg-moss)">📷</div>`}
          </div>
          <div style="margin-top:8px">
            <label style="cursor:pointer;padding:6px 14px;background:var(--bg-moss);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--text-mid);font-family:'Inter',sans-serif">
              📷 ${t("aggiungi_carica_foto")}
              <input type="file" accept="image/*" onchange="previewFoto(this)" style="display:none" id="edit-foto-input">
            </label>
          </div>
          ${snake.foto_url ? `<input type="hidden" id="foto-position-input" value="${esc(snake.foto_position || "50% 50%")}"><div style="display:flex;justify-content:center">${renderPosPicker(snake.foto_position)}</div>` : `<input type="hidden" id="foto-position-input" value="50% 50%">`}
        </div>
        <div class="form-grid">
          <div class="form-group"><label>${t("lbl_nome")}</label><input type="text" id="edit-nome" value="${esc(snake.nome)}" autocomplete="off"></div>
          <div class="form-group"><label>${t("lbl_specie")}</label><input type="text" id="edit-specie" value="${esc(snake.specie || "")}" autocomplete="off"></div>
          <div class="form-group"><label>${t("lbl_morfo")}</label><input type="text" id="edit-morfo" value="${esc(snake.morfo || "")}" autocomplete="off"></div>
          <div class="form-group"><label>${t("lbl_sesso")}</label>
            <select id="edit-sesso">
              <option value="M" ${snake.sesso === "M" ? "selected" : ""}>${t("aggiungi_maschio")}</option>
              <option value="F" ${snake.sesso === "F" ? "selected" : ""}>${t("aggiungi_femmina")}</option>
            </select>
          </div>
          <div class="form-group"><label>${t("lbl_data_nascita")}</label><input type="date" id="edit-nascita" value="${snake.nascita || ""}"></div>
          <div class="form-group"><label>${t("lbl_peso")} (g)</label><input type="number" id="edit-peso" value="${snake.peso || ""}" inputmode="decimal"></div>
          <div class="form-group"><label>${t("lbl_provenienza")}</label><input type="text" id="edit-provenienza" value="${esc(snake.provenienza || "")}" autocomplete="off"></div>
        </div>
        <div class="form-group mt-16"><label>${t("label_note")}</label><textarea id="edit-note" rows="3" style="resize:vertical">${esc(snake.note || "")}</textarea></div>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
          <div style="font-family:'Cinzel',serif;font-size:13px;color:var(--accent-gold);margin-bottom:10px">🧬 ${t("gen_title")}</div>
          <div class="form-grid">
            ${renderParentField("padre", snake.padre_id, snake.padre_esterno, "M", snake.id)}
            ${renderParentField("madre", snake.madre_id, snake.madre_esterna, "F", snake.id)}
          </div>
          <div class="form-group mt-16"><label>${t("gen_genetica")}</label><input type="text" id="f-genetica" placeholder="${t("gen_genetica_ph")}" value="${esc(snake.genetica || "")}" autocomplete="off"></div>
        </div>
        <div class="flex-row mt-20">
          <button class="btn btn-primary" id="btn-save-edit" onclick="saveEditSerpente('${snake.id}')">💾 ${t("salva_modifiche")}</button>
          <button class="btn btn-ghost" onclick="toggleEditSerpente()">${t("aggiungi_annulla")}</button>
        </div>
      </div>
    </div>
    ${renderGenealogySection(snake)}
  </div>`;

  applySnakeLockUI(snake.id);
}

function renderPosPicker(current) {
  const positions = [
    "0% 0%",
    "50% 0%",
    "100% 0%",
    "0% 50%",
    "50% 50%",
    "100% 50%",
    "0% 100%",
    "50% 100%",
    "100% 100%",
  ];
  const cur = current || "50% 50%";
  return `<div style="margin-top:8px">
    <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">${t("foto_pos_label")}</div>
    <div style="display:grid;grid-template-columns:repeat(3,26px);gap:4px">
      ${positions.map((p) => `<button type="button" onclick="setFotoPosition('${p}')" data-pos="${p}" class="pos-picker-btn" style="width:26px;height:26px;border-radius:5px;border:1px solid var(--border);background:${p === cur ? "var(--accent-gold)" : "var(--bg-moss)"};cursor:pointer"></button>`).join("")}
    </div>
  </div>`;
}

function setFotoPosition(pos) {
  const input = document.getElementById("foto-position-input");
  if (input) input.value = pos;
  const editPreview = document.getElementById("edit-foto-preview");
  const addImg = document.getElementById("add-foto-img");
  if (editPreview && editPreview.tagName === "IMG")
    editPreview.style.objectPosition = pos;
  if (addImg) addImg.style.objectPosition = pos;
  document.querySelectorAll(".pos-picker-btn").forEach((b) => {
    b.style.background =
      b.dataset.pos === pos ? "var(--accent-gold)" : "var(--bg-moss)";
  });
}

// ── GENEALOGIA: campo genitore (select tra archivio + opzione esterna) ─────
function renderParentField(
  role,
  currentId,
  currentEsterno,
  sessoFiltro,
  excludeId,
) {
  const label =
    role === "padre"
      ? t("gen_padre")
      : role === "madre"
        ? t("gen_madre")
        : t("gen_partner");
  const inputId =
    role === "padre"
      ? "f-padre-esterno"
      : role === "madre"
        ? "f-madre-esterna"
        : "eggs-partner-esterno";
  const selectId =
    role === "partner" ? "eggs-partner-select" : `f-${role}-select`;
  const isEsterno = !currentId && !!currentEsterno;
  const options = _snakes.filter(
    (s) => s.sesso === sessoFiltro && s.id !== excludeId,
  );
  return `<div class="form-group">
    <label>${label}</label>
    <select id="${selectId}" onchange="toggleParentExterno('${role}')">
      <option value="">${t("gen_nessuno")}</option>
      <option value="__esterno__" ${isEsterno ? "selected" : ""}>${t("gen_esterno_label")}</option>
      ${options.map((s) => `<option value="${esc(s.id)}" ${currentId === s.id ? "selected" : ""}>${esc(s.nome)}</option>`).join("")}
    </select>
    <input type="text" id="${inputId}" placeholder="${t("gen_esterno_ph")}" value="${esc(currentEsterno || "")}" style="display:${isEsterno ? "block" : "none"};margin-top:6px">
  </div>`;
}

function toggleParentExterno(role) {
  const selectId =
    role === "partner" ? "eggs-partner-select" : `f-${role}-select`;
  const inputId =
    role === "padre"
      ? "f-padre-esterno"
      : role === "madre"
        ? "f-madre-esterna"
        : "eggs-partner-esterno";
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  if (select && input)
    input.style.display = select.value === "__esterno__" ? "block" : "none";
}

function readParentFields() {
  const padreSel = document.getElementById("f-padre-select")?.value || "";
  const madreSel = document.getElementById("f-madre-select")?.value || "";
  return {
    padre_id: padreSel && padreSel !== "__esterno__" ? padreSel : null,
    padre_esterno:
      padreSel === "__esterno__"
        ? document.getElementById("f-padre-esterno")?.value.trim() || null
        : null,
    madre_id: madreSel && madreSel !== "__esterno__" ? madreSel : null,
    madre_esterna:
      madreSel === "__esterno__"
        ? document.getElementById("f-madre-esterna")?.value.trim() || null
        : null,
  };
}

// ── GENEALOGIA: sezione figli / fratelli di cova nella scheda dettaglio ────
function renderGenealogySection(snake) {
  const figli = _snakes.filter(
    (s) => s.padre_id === snake.id || s.madre_id === snake.id,
  );
  const fratelli =
    snake.padre_id || snake.madre_id
      ? _snakes.filter(
          (s) =>
            s.id !== snake.id &&
            ((snake.padre_id && s.padre_id === snake.padre_id) ||
              (snake.madre_id && s.madre_id === snake.madre_id)),
        )
      : [];
  const hasParents =
    snake.padre_id ||
    snake.padre_esterno ||
    snake.madre_id ||
    snake.madre_esterna ||
    snake.genetica;
  if (!hasParents && figli.length === 0 && fratelli.length === 0) return "";

  const snakeChip = (
    s,
  ) => `<span onclick="showPage('dettaglio','${s.id}')" style="display:inline-flex;align-items:center;gap:5px;background:var(--bg-moss);border:1px solid var(--border);border-radius:20px;padding:4px 10px 4px 4px;font-size:12px;cursor:pointer;margin:3px 4px 3px 0">
      ${s.foto_url ? `<img src="${esc(s.foto_url)}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;object-position:${esc(s.foto_position || "50% 50%")}">` : `<span style="width:20px;height:20px;border-radius:50%;background:var(--bg-card);display:flex;align-items:center;justify-content:center;font-size:10px">🐍</span>`}
      ${esc(s.nome)}</span>`;

  const parentChip = (s) => {
    const sottotitolo = [s.specie, s.morfo].filter(Boolean).join(" · ");
    return `<div onclick="showPage('dettaglio','${s.id}')" style="display:inline-flex;align-items:center;gap:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:6px 10px;cursor:pointer;margin-top:2px">
      ${s.foto_url ? `<img src="${esc(s.foto_url)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;object-position:${esc(s.foto_position || "50% 50%")};flex-shrink:0">` : `<span style="width:28px;height:28px;border-radius:50%;background:var(--bg-moss);display:flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0">🐍</span>`}
      <div style="min-width:0">
        <div style="font-size:13px;color:var(--text-bright);font-weight:500">${esc(s.nome)}</div>
        ${sottotitolo ? `<div style="font-size:10.5px;color:var(--text-dim);font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(sottotitolo)}</div>` : ""}
      </div>
    </div>`;
  };

  return `<div class="card" style="margin-bottom:14px">
    <div class="card-title">🧬 ${t("gen_title")}</div>
    ${
      hasParents
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:${figli.length || fratelli.length ? "14px" : "0"}">
      <div style="background:var(--bg-moss);border-radius:8px;padding:10px">
        <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">${t("gen_padre")}</div>
        ${
          snake.padre_id && _snakes.find((s) => s.id === snake.padre_id)
            ? parentChip(_snakes.find((s) => s.id === snake.padre_id))
            : snake.padre_esterno
              ? `<div style="font-size:13px;color:var(--text-bright);margin-top:3px">${esc(snake.padre_esterno)} <span style="font-size:10px;color:var(--text-dim)">(${t("gen_esterno_badge")})</span></div>`
              : `<div style="font-size:13px;color:var(--text-dim);margin-top:3px">${t("gen_non_impostato")}</div>`
        }
      </div>
      <div style="background:var(--bg-moss);border-radius:8px;padding:10px">
        <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">${t("gen_madre")}</div>
        ${
          snake.madre_id && _snakes.find((s) => s.id === snake.madre_id)
            ? parentChip(_snakes.find((s) => s.id === snake.madre_id))
            : snake.madre_esterna
              ? `<div style="font-size:13px;color:var(--text-bright);margin-top:3px">${esc(snake.madre_esterna)} <span style="font-size:10px;color:var(--text-dim)">(${t("gen_esterno_badge")})</span></div>`
              : `<div style="font-size:13px;color:var(--text-dim);margin-top:3px">${t("gen_non_impostato")}</div>`
        }
      </div>
      ${
        snake.genetica
          ? `<div style="background:var(--bg-moss);border-radius:8px;padding:10px;grid-column:1/-1">
        <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">${t("gen_genetica")}</div>
        <div style="font-size:13px;color:var(--text-bright);margin-top:3px">${esc(snake.genetica)}</div>
      </div>`
          : ""
      }
    </div>`
        : ""
    }
    ${figli.length > 0 ? `<div style="margin-top:10px"><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">${t("gen_figli")} (${figli.length})</div>${figli.map(snakeChip).join("")}</div>` : ""}
    ${fratelli.length > 0 ? `<div style="margin-top:10px"><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">${t("gen_fratelli")} (${fratelli.length})</div>${fratelli.map(snakeChip).join("")}</div>` : ""}
  </div>`;
}

function renderLogList(logs, type, snakeId) {
  const icons = {
    food: "🥩",
    feci: "💩",
    eggs: "🥚",
    pulizia: "🧹",
    muta: "🦎",
    peso: "⚖️",
  };
  if (!logs.length)
    return `<div style="color:var(--text-dim);font-size:14px;padding:10px 0">${t("nessuna_registrazione")}</div>`;
  return logs
    .map((l) => {
      let desc = "";
      // food_tipo/feci_tipo sono colonne text: arrivano da una <select>, ma nulla
      // impedisce di scriverci HTML con una POST diretta su /rest/v1/logs. E questi
      // campi viaggiano anche fuori dall'account di chi li scrive — transfer-snake li
      // copia nel payload e accetta_trasferimento li inserisce nei log del destinatario,
      // che poi li vede renderizzati nel proprio browser. Vanno sempre scappati.
      // grammi/qty/num_uova/fertili/temp no: sono numeric/integer lato DB.
      if (l.tipo === "cibo")
        desc = `${esc(l.food_tipo) || t("log_cibo_default")} ×${l.qty || 1} — ${l.grammi || 0}g`;
      if (l.tipo === "feci") desc = `${esc(l.feci_tipo) || "—"}`;
      if (l.tipo === "uova") {
        const partnerNome = l.partner_id
          ? _snakes.find((s) => s.id === l.partner_id)?.nome || null
          : l.partner_esterno || null;
        desc = `${l.num_uova || 0} ${t("log_uova_desc")}, ${l.fertili || 0} ${t("log_fertili_desc")}${l.temp ? ` — ${l.temp}°C` : ""}${partnerNome ? ` · ${t("gen_partner")}: ${esc(partnerNome)}` : ""}`;
      }
      if (l.tipo === "muta") desc = `${esc(l.feci_tipo) || t("muta_completa")}`;
      if (l.tipo === "peso") desc = `${l.grammi || 0}g`;
      return `<div class="log-entry">
      <div class="log-icon ${type}">${icons[type]}</div>
      <div class="log-info">
        <div class="log-date">${fmtDate(l.data)}</div>
        <div class="log-desc">${desc}${l.note ? ` · ${esc(l.note)}` : ""}</div>
      </div>
      <button class="log-delete" onclick="editLogEntry('${l.id}','${snakeId}','${esc(l.tipo)}')" title="${t("modifica")}" style="color:var(--accent-gold);font-size:13px">✏️</button>
      <button class="log-delete" onclick="deleteLogEntry('${l.id}','${snakeId}')" title="Elimina">✕</button>
    </div>`;
    })
    .join("");
}

function switchTab(name) {
  ["cibo", "feci", "uova", "pulizia", "muta", "peso", "info"].forEach((t) => {
    const btn = document.getElementById("tab-" + t);
    const cnt = document.getElementById("tab-content-" + t);
    if (btn) btn.classList.toggle("active", t === name);
    if (cnt) cnt.style.display = t === name ? "" : "none";
  });
}

// ═══════════════════════════════════════
//  LOG ACTIONS
// ═══════════════════════════════════════
async function logFood(snakeId) {
  if (!requireEditable(snakeId)) return;
  const data = document.getElementById("food-data").value;
  if (!data) {
    toast(t("err_data_richiesta"), "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-log-food");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const log = {
    id: "L" + Date.now() + Math.random().toString(36).slice(2, 5),
    snake_id: snakeId,
    tipo: "cibo",
    data,
    food_tipo: document.getElementById("food-tipo").value,
    grammi: parseFloat(document.getElementById("food-grammi").value) || null,
    qty: parseInt(document.getElementById("food-qty").value) || 1,
    note: document.getElementById("food-note").value || null,
  };
  try {
    await SB.insertLog(log);
    addLogToCaches(log);
    toast("🥩 Pasto salvato nel cloud!");
    renderDettaglio();
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva Pasto";
  }
}

async function logFeci(snakeId) {
  if (!requireEditable(snakeId)) return;
  const data = document.getElementById("feci-data").value;
  if (!data) {
    toast(t("err_data_richiesta"), "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-log-feci");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const log = {
    id: "L" + Date.now() + Math.random().toString(36).slice(2, 5),
    snake_id: snakeId,
    tipo: "feci",
    data,
    feci_tipo: document.getElementById("feci-tipo").value,
    note: document.getElementById("feci-note").value || null,
  };
  try {
    await SB.insertLog(log);
    addLogToCaches(log);
    toast("💩 Feci salvate nel cloud!");
    renderDettaglio();
    switchTab("feci");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva";
  }
}

async function logUova(snakeId) {
  if (!requireEditable(snakeId)) return;
  const data = document.getElementById("eggs-data").value;
  if (!data) {
    toast(t("err_data_richiesta"), "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-log-uova");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const log = {
    id: "L" + Date.now() + Math.random().toString(36).slice(2, 5),
    snake_id: snakeId,
    tipo: "uova",
    data,
    num_uova: parseInt(document.getElementById("eggs-num").value) || null,
    fertili: parseInt(document.getElementById("eggs-fertili").value) || null,
    temp: parseFloat(document.getElementById("eggs-temp").value) || null,
    note: document.getElementById("eggs-note").value || null,
  };
  const partnerSel =
    document.getElementById("eggs-partner-select")?.value || "";
  log.partner_id =
    partnerSel && partnerSel !== "__esterno__" ? partnerSel : null;
  log.partner_esterno =
    partnerSel === "__esterno__"
      ? document.getElementById("eggs-partner-esterno")?.value.trim() || null
      : null;
  try {
    await SB.insertLog(log);
    addLogToCaches(log);
    toast("🥚 Deposizione salvata nel cloud!");
    renderDettaglio();
    switchTab("uova");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva";
  }
}

async function logPulizia(snakeId) {
  if (!requireEditable(snakeId)) return;
  const data = document.getElementById("pulizia-data").value;
  if (!data) {
    toast(t("err_data_richiesta"), "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-log-pulizia");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const log = {
    id: "L" + Date.now() + Math.random().toString(36).slice(2, 5),
    snake_id: snakeId,
    tipo: "pulizia",
    data,
    pulizia_tipo: document.getElementById("pulizia-tipo").value,
    note: document.getElementById("pulizia-note").value || null,
  };
  try {
    await SB.insertLog(log);
    addLogToCaches(log);
    toast("🧹 Pulizia salvata nel cloud!");
    renderDettaglio();
    switchTab("pulizia");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva";
  }
}

async function deleteLogEntry(logId, snakeId) {
  if (!requireEditable(snakeId)) return;
  if (!confirm("Eliminare questa registrazione?")) return;
  try {
    await SB.deleteLog(logId);
    removeLogFromCaches(logId, snakeId);
    toast("Eliminato", "#c0392b");
    renderDettaglio();
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
  }
}

function editLogEntry(logId, snakeId, tipo) {
  if (!requireEditable(snakeId)) return;
  const log = (_logsCache[snakeId] || []).find((l) => l.id === logId);
  if (!log) return;
  document.getElementById("edit-log-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "edit-log-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:500;background:rgba(8,15,9,0.92);display:flex;align-items:center;justify-content:center;padding:24px";

  let fieldsHtml = "";
  fieldsHtml += `<div class="form-group"><label>Data</label><input type="date" id="editlog-data" value="${log.data || ""}"></div>`;

  if (tipo === "cibo") {
    fieldsHtml += `
      <div class="form-group"><label>Tipo cibo</label>
        <select id="editlog-food-tipo">
          ${["Topo scongelato", "Topo vivo", "Ratto scongelato", "Ratto vivo", "Pulcino", "Coniglio", "Altro"].map((t) => `<option ${log.food_tipo === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>
      </div>
      <div class="form-group"><label>Peso preda (g)</label><input type="number" id="editlog-grammi" value="${log.grammi || ""}" inputmode="decimal"></div>
      <div class="form-group"><label>Quantità</label><input type="number" id="editlog-qty" value="${log.qty || 1}" min="1" inputmode="numeric"></div>`;
  } else if (tipo === "feci") {
    fieldsHtml += `<div class="form-group"><label>Consistenza</label>
      <select id="editlog-feci-tipo">
        ${["Normale", "Liquide", "Dure", "Con urati", "Sanguinolente"].map((t) => `<option ${log.feci_tipo === t ? "selected" : ""}>${t}</option>`).join("")}
      </select></div>`;
  } else if (tipo === "uova") {
    fieldsHtml += `
      <div class="form-group"><label>N° uova</label><input type="number" id="editlog-num-uova" value="${log.num_uova || ""}" inputmode="numeric"></div>
      <div class="form-group"><label>N° fertili</label><input type="number" id="editlog-fertili" value="${log.fertili || ""}" inputmode="numeric"></div>
      <div class="form-group"><label>Temp (°C)</label><input type="number" id="editlog-temp" value="${log.temp || ""}" step="0.1" inputmode="decimal"></div>`;
  } else if (tipo === "muta") {
    fieldsHtml += `<div class="form-group"><label>Esito</label>
      <select id="editlog-muta-tipo">
        ${["Completa", "Parziale", "Problematica", "In corso"].map((t) => `<option ${log.feci_tipo === t ? "selected" : ""}>${t}</option>`).join("")}
      </select></div>`;
  } else if (tipo === "peso") {
    fieldsHtml += `<div class="form-group"><label>Peso (g)</label><input type="number" id="editlog-grammi" value="${log.grammi || ""}" inputmode="decimal"></div>`;
  } else if (tipo === "pulizia") {
    fieldsHtml += `<div class="form-group"><label>Tipo pulizia</label>
      <select id="editlog-pulizia-tipo">
        ${["Pulizia completa", "Pulizia parziale", "Cambio acqua", "Disinfezione"].map((t) => `<option ${log.pulizia_tipo === t ? "selected" : ""}>${t}</option>`).join("")}
      </select></div>`;
  }
  fieldsHtml += `<div class="form-group"><label>Note</label><input type="text" id="editlog-note" value="${esc(log.note || "")}" autocomplete="off"></div>`;

  const tipoLabels = {
    cibo: "🥩 Pasto",
    feci: "💩 Feci",
    uova: "🥚 Deposizione",
    muta: "🦎 Muta",
    peso: "⚖️ Peso",
    pulizia: "🧹 Pulizia",
  };
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:400px;width:100%;box-shadow:var(--shadow)">
      <div style="font-family:'Cinzel',serif;font-size:18px;color:var(--accent-gold);margin-bottom:16px">✏️ Modifica ${tipoLabels[tipo] || "Log"}</div>
      <div class="form-grid">${fieldsHtml}</div>
      <div class="flex-row mt-20">
        <button class="btn btn-primary" id="btn-save-editlog" onclick="saveEditLog('${logId}','${snakeId}','${tipo}')">💾 Salva</button>
        <button class="btn btn-ghost" onclick="closeModalEl(document.getElementById('edit-log-modal'))">Annulla</button>
      </div>
    </div>`;
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
}

async function saveEditLog(logId, snakeId, tipo) {
  if (!requireEditable(snakeId)) return;
  const btn = document.getElementById("btn-save-editlog");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const updates = {
    data: document.getElementById("editlog-data").value,
    note: document.getElementById("editlog-note").value || null,
  };
  if (tipo === "cibo") {
    updates.food_tipo = document.getElementById("editlog-food-tipo").value;
    updates.grammi =
      parseFloat(document.getElementById("editlog-grammi").value) || null;
    updates.qty = parseInt(document.getElementById("editlog-qty").value) || 1;
  } else if (tipo === "feci") {
    updates.feci_tipo = document.getElementById("editlog-feci-tipo").value;
  } else if (tipo === "uova") {
    updates.num_uova =
      parseInt(document.getElementById("editlog-num-uova").value) || null;
    updates.fertili =
      parseInt(document.getElementById("editlog-fertili").value) || null;
    updates.temp =
      parseFloat(document.getElementById("editlog-temp").value) || null;
  } else if (tipo === "muta") {
    updates.feci_tipo = document.getElementById("editlog-muta-tipo").value;
  } else if (tipo === "peso") {
    updates.grammi =
      parseFloat(document.getElementById("editlog-grammi").value) || null;
  } else if (tipo === "pulizia") {
    updates.pulizia_tipo = document.getElementById(
      "editlog-pulizia-tipo",
    ).value;
  }
  try {
    await SB.updateLog(logId, updates);
    updateLogInCaches(logId, snakeId, updates);
    closeModalEl(document.getElementById("edit-log-modal"));
    toast("✅ Log aggiornato!");
    renderDettaglio();
  } catch (e) {
    toast("❌ " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva";
  }
}

// ── MUTA LOG ──
async function logMuta(snakeId) {
  if (!requireEditable(snakeId)) return;
  const data = document.getElementById("muta-data").value;
  if (!data) {
    toast(t("err_data_richiesta"), "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-log-muta");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const log = {
    id: "L" + Date.now() + Math.random().toString(36).slice(2, 5),
    snake_id: snakeId,
    tipo: "muta",
    data,
    feci_tipo: document.getElementById("muta-tipo").value,
    note: document.getElementById("muta-note").value || null,
  };
  try {
    await SB.insertLog(log);
    addLogToCaches(log);
    toast("🦎 Muta registrata!");
    renderDettaglio();
    switchTab("muta");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva Muta";
  }
}

// ── PESO LOG ──
async function logPeso(snakeId) {
  if (!requireEditable(snakeId)) return;
  const data = document.getElementById("peso-data").value;
  const grammi = parseFloat(document.getElementById("peso-grammi").value);
  if (!data) {
    toast(t("err_data_richiesta"), "#c0392b");
    return;
  }
  if (!grammi) {
    toast("Inserisci il peso!", "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-log-peso");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  const log = {
    id: "L" + Date.now() + Math.random().toString(36).slice(2, 5),
    snake_id: snakeId,
    tipo: "peso",
    data,
    grammi,
    note: document.getElementById("peso-note").value || null,
  };
  try {
    await SB.insertLog(log);
    addLogToCaches(log);
    // Aggiorna anche il peso corrente del serpente
    const snake = _snakes.find((s) => s.id === snakeId);
    if (snake) {
      snake.peso = grammi;
      await SB.updateSerpente(snakeId, { peso: grammi });
    }
    toast("⚖️ Peso registrato!");
    renderDettaglio();
    switchTab("peso");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva Peso";
  }
}

// ── EDIT SERPENTE ──
let _editFotoData = null;
let _addFotoData = null;

function toggleEditSerpente(id) {
  if (id && !requireEditable(id)) return;
  const viewMode = document.getElementById("info-view-mode");
  const editMode = document.getElementById("info-edit-mode");
  const btn = document.getElementById("btn-toggle-edit");
  if (!viewMode || !editMode) return;
  const isEditing = editMode.style.display !== "none";
  viewMode.style.display = isEditing ? "" : "none";
  editMode.style.display = isEditing ? "none" : "";
  btn.textContent = isEditing ? "✏️ Modifica" : "✕ Annulla";
  _editFotoData = null;
}

// Comprime lato client una foto scelta dall'utente in un data-URL JPEG (lato lungo
// max 400px, qualità 0.7). Non esiste uno Storage: è questa stringa che finisce
// direttamente nella colonna testo `foto_url`, quindi la compressione non è un
// dettaglio estetico ma ciò che tiene le righe di dimensioni ragionevoli.
function compressImageToDataUrl(file, maxSize = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lettura del file non riuscita"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("File immagine non valido"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width,
          h = img.height;
        if (w > h) {
          if (w > maxSize) {
            h *= maxSize / w;
            w = maxSize;
          }
        } else {
          if (h > maxSize) {
            w *= maxSize / h;
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function previewFotoAdd(input) {
  if (!input.files || !input.files[0]) return;
  try {
    _addFotoData = await compressImageToDataUrl(input.files[0]);
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    return;
  }
  const preview = document.getElementById("add-foto-preview");
  if (!preview) return;
  preview.innerHTML = `<img src="${_addFotoData}" style="width:100%;height:100%;border-radius:10px;object-fit:cover;object-position:50% 50%" id="add-foto-img">`;
  preview.style.border = "none";
  setFotoPosition("50% 50%");
  const posContainer = document.getElementById("add-foto-pos-container");
  if (posContainer) posContainer.innerHTML = renderPosPicker("50% 50%");
}

async function previewFoto(input) {
  if (!input.files || !input.files[0]) return;
  try {
    _editFotoData = await compressImageToDataUrl(input.files[0]);
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    return;
  }
  const preview = document.getElementById("edit-foto-preview");
  if (!preview) return;
  if (preview.tagName === "IMG") {
    preview.src = _editFotoData;
  } else {
    preview.outerHTML = `<img id="edit-foto-preview" src="${_editFotoData}" style="width:100px;height:100px;border-radius:12px;object-fit:cover;object-position:50% 50%;border:2px solid var(--border)">`;
    // Prima foto aggiunta durante la modifica: crea il selettore di posizione al volo, se non c'e' gia'
    if (!document.querySelector(".pos-picker-btn")) {
      setFotoPosition("50% 50%");
      const hiddenInput = document.getElementById("foto-position-input");
      if (hiddenInput)
        hiddenInput.insertAdjacentHTML(
          "afterend",
          `<div style="display:flex;justify-content:center">${renderPosPicker("50% 50%")}</div>`,
        );
    }
  }
}

// ═══════════════════════════════════════
//  LOGO ALLEVAMENTO
// ═══════════════════════════════════════
// Disegna un'immagine (già caricata, es. <img> o <canvas> sorgente) centrata
// su un canvas quadrato, mantenendo le proporzioni originali (nessun taglio,
// nessuna deformazione) — è questo che garantisce che il logo risulti sempre
// centrato ovunque venga mostrato (etichetta, PDF, anteprima profilo).
function centerOnSquareCanvas(source, srcW, srcH, size = 400) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  // Sfondo trasparente: si adatta sia a sfondi bianchi (etichetta/PDF) che scuri (anteprima nel profilo)
  ctx.clearRect(0, 0, size, size);
  const scale = Math.min(size / srcW, size / srcH);
  const w = srcW * scale,
    h = srcH * scale;
  const x = (size - w) / 2,
    y = (size - h) / 2;
  ctx.drawImage(source, x, y, w, h);
  return canvas.toDataURL("image/png");
}

function uploadLogo(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (file.type === "application/pdf") {
    uploadLogoFromPdf(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = async function () {
      const logoData = centerOnSquareCanvas(img, img.width, img.height);
      try {
        await saveLogoToServer(logoData);
        _userLogo = logoData;
        renderProfilo();
        toast("🏷️ Logo caricato!");
      } catch (err) {
        toast("❌ Errore: " + err.message, "#c0392b");
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// pdf.js serve solo per "carica logo da PDF", ma il PDF lo sceglie l'utente: e' input
// non fidato dato in pasto a un parser complesso. La 3.11.174 che stava qui era affetta
// da CVE-2024-4367 — un PDF costruito ad arte esegue JavaScript arbitrario nella pagina
// che lo apre, quindi nella sessione dell'allevatore. Corretta dalla 4.2.67 in poi.
//
// Dalla 4.x pdf.js e' distribuito SOLO come modulo ES (.mjs): non si puo' piu' caricare
// con loadScriptOnce, che crea un <script> classico. Serve import() dinamico, che
// funziona anche dentro uno script classico come questo.
//
// La 6.3.289 accetta ancora `canvasContext` in render() (verificato nel sorgente:
// `render({canvasContext: t, canvas: e = t.canvas, ...})`), quindi la chiamata piu'
// sotto resta identica.
const PDFJS_VERSION = "6.3.289";
const PDFJS_BASE = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}`;
let _pdfjsPromise = null;

function loadPdfJs() {
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = import(`${PDFJS_BASE}/pdf.min.mjs`)
    .then((lib) => {
      // Il worker sta su un'altra origine: i worker cross-origin sarebbero vietati dal
      // browser, ma pdf.js se ne accorge e lo scarica trasformandolo in un blob
      // same-origin. Per questo la CSP elenca cdnjs sia in connect-src sia in worker-src,
      // oltre a blob: in worker-src.
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}/pdf.worker.min.mjs`;
      return lib;
    })
    .catch(() => {
      // Un fallimento di rete non deve restare in cache: al prossimo tentativo si riprova.
      _pdfjsPromise = null;
      throw new Error("Libreria PDF non disponibile, ricarica la pagina");
    });
  return _pdfjsPromise;
}

async function uploadLogoFromPdf(file) {
  try {
    toast("📄 Lettura PDF in corso...", "var(--accent-lime)");
    const pdfjsLib = await loadPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1); // usa sempre la prima pagina del PDF come logo

    const viewport = page.getViewport({ scale: 2 }); // scala 2x per una resa nitida
    const renderCanvas = document.createElement("canvas");
    renderCanvas.width = viewport.width;
    renderCanvas.height = viewport.height;
    await page.render({
      canvasContext: renderCanvas.getContext("2d"),
      viewport,
    }).promise;

    const logoData = centerOnSquareCanvas(
      renderCanvas,
      renderCanvas.width,
      renderCanvas.height,
    );
    await saveLogoToServer(logoData);
    _userLogo = logoData;
    renderProfilo();
    toast("🏷️ Logo caricato dal PDF!");
  } catch (err) {
    toast("❌ Errore lettura PDF: " + err.message, "#c0392b");
  }
}

async function removeLogo() {
  if (!confirm("Rimuovere il logo? Non comparirà più su etichette e PDF."))
    return;
  try {
    await saveLogoToServer(null);
    _userLogo = null;
    renderProfilo();
    toast("Logo rimosso");
  } catch (err) {
    toast("❌ Errore: " + err.message, "#c0392b");
  }
}

async function changeAppLang(lang) {
  const prevLang = _appLang;
  _appLang = lang; // aggiorna subito l'interfaccia, senza aspettare il server
  applyAppLang();
  showPage(currentPage, currentSnakeId); // ridisegna la pagina corrente nella nuova lingua
  try {
    const session = await getSession();
    const token = session ? session.access_token : SUPABASE_KEY;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_own_lang`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_lang: lang }),
    });
    if (!res.ok) throw new Error("Errore salvataggio lingua");
    toast(
      lang === "it"
        ? "🌐 Lingua impostata su Italiano"
        : "🌐 Language set to English",
    );
  } catch (err) {
    _appLang = prevLang; // rollback se il salvataggio fallisce
    applyAppLang();
    showPage(currentPage, currentSnakeId);
    toast("❌ " + err.message, "#c0392b");
  }
}

async function saveLogoToServer(logoDataOrNull) {
  const session = await getSession();
  const token = session ? session.access_token : SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_own_logo`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_logo_url: logoDataOrNull }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || "Errore salvataggio logo");
  }
}

async function saveEditSerpente(snakeId) {
  if (!requireEditable(snakeId)) return;
  const btn = document.getElementById("btn-save-edit");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvataggio...';
  const updates = {
    nome: document.getElementById("edit-nome").value.trim(),
    specie: document.getElementById("edit-specie").value.trim() || null,
    morfo: document.getElementById("edit-morfo").value.trim() || null,
    sesso: document.getElementById("edit-sesso").value,
    nascita: document.getElementById("edit-nascita").value || null,
    peso: parseFloat(document.getElementById("edit-peso").value) || null,
    provenienza:
      document.getElementById("edit-provenienza").value.trim() || null,
    note: document.getElementById("edit-note").value.trim() || null,
    ...readParentFields(),
    genetica: document.getElementById("f-genetica").value.trim() || null,
  };
  if (_editFotoData) updates.foto_url = _editFotoData;
  const posInput = document.getElementById("foto-position-input");
  if (posInput) updates.foto_position = posInput.value;
  if (!updates.nome) {
    toast("Il nome è obbligatorio!", "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva Modifiche";
    return;
  }
  if (isNameTaken(updates.nome, snakeId)) {
    toast(`"${updates.nome}" già utilizzato`, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva Modifiche";
    return;
  }
  try {
    await SB.updateSerpente(snakeId, updates);
    const snake = _snakes.find((s) => s.id === snakeId);
    if (snake) Object.assign(snake, updates);
    _editFotoData = null;
    toast("✅ Serpente aggiornato!");
    renderDettaglio();
    switchTab("info");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva Modifiche";
  }
}

async function deleteSerpente(id) {
  if (
    !confirm(
      "Eliminare questo serpente e tutte le sue registrazioni?\nI dati verranno cancellati dal database.",
    )
  )
    return;
  try {
    await SB.deleteSerpente(id);
    _snakes = _snakes.filter((s) => s.id !== id);
    delete _logsCache[id];
    _recentLogs = _recentLogs.filter((l) => l.snake_id !== id);
    toast("Serpente eliminato", "#c0392b");
    showPage("serpenti");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
  }
}

// ═══════════════════════════════════════
//  MODALE VENDI
// ═══════════════════════════════════════
function showVendiModal(snakeId) {
  const snake = _snakes.find((s) => s.id === snakeId);
  if (!snake) return;
  const today = new Date().toISOString().split("T")[0];

  // Rimuovi modale esistente
  const existing = document.getElementById("vendi-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "vendi-modal";
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;display:flex;align-items:flex-end;justify-content:center;padding:0";
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px 16px 0 0;padding:24px;width:100%;max-width:600px;box-shadow:0 -10px 40px rgba(0,0,0,0.6);padding-bottom:calc(24px + var(--safe-bottom));max-height:90vh;overflow-y:auto">
      <div style="font-family:'Cinzel',serif;font-size:18px;color:var(--accent-gold);margin-bottom:6px">💰 Segna come Venduto</div>
      <div style="font-size:13px;color:var(--text-dim);margin-bottom:20px">Stai vendendo: <strong style="color:var(--text-bright)">${esc(snake.nome)}</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">Data vendita *</label>
          <input type="date" id="v-data" value="${today}" style="background:var(--bg-forest);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:12px 14px;font-size:16px;font-family:'Inter',sans-serif;outline:none;-webkit-appearance:none">
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">Prezzo (€)</label>
          <input type="number" id="v-prezzo" placeholder="es. 150" inputmode="decimal" style="background:var(--bg-forest);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:12px 14px;font-size:16px;font-family:'Inter',sans-serif;outline:none">
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;grid-column:1/-1">
          <label style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">Nome acquirente</label>
          <input type="text" id="v-acquirente" placeholder="es. Mario Rossi" autocomplete="off" style="background:var(--bg-forest);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:12px 14px;font-size:16px;font-family:'Inter',sans-serif;outline:none">
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;grid-column:1/-1">
          <label style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">Note vendita</label>
          <input type="text" id="v-note" placeholder="es. Venduto con accessori" autocomplete="off" style="background:var(--bg-forest);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:12px 14px;font-size:16px;font-family:'Inter',sans-serif;outline:none">
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
        <button onclick="closeModalEl(document.getElementById('vendi-modal'))" style="padding:12px 20px;background:transparent;color:var(--text-mid);border:1px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:15px;cursor:pointer">Annulla</button>
        <button id="btn-conferma-vendi" onclick="confermaVendita('${snake.id}')" style="padding:12px 24px;background:var(--accent-gold);color:#1a0f00;border:none;border-radius:8px;font-family:'Inter',sans-serif;font-size:15px;font-weight:700;cursor:pointer">💰 Conferma Vendita</button>
      </div>
    </div>`;
  modal.classList.add("modal-sheet");
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
}

async function confermaVendita(snakeId) {
  const snake = _snakes.find((s) => s.id === snakeId);
  if (!snake) return;
  const data = document.getElementById("v-data").value;
  if (!data) {
    toast("Inserisci la data vendita!", "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-conferma-vendi");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvataggio...';

  try {
    // 1. Prendi i log dalla cache locale (raggiungibile solo da scheda già aperta e caricata)
    const logsSnapshot = _logsCache[snakeId] || [];
    console.log("Log trovati per snapshot:", logsSnapshot.length);

    const venduto = {
      id:
        "V" + Date.now() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      snake_id: snake.id,
      nome: snake.nome,
      specie: snake.specie,
      morfo: snake.morfo,
      sesso: snake.sesso,
      nascita: snake.nascita,
      peso: snake.peso,
      provenienza: snake.provenienza,
      icd: snake.icd,
      note: snake.note,
      data_vendita: data,
      acquirente: document.getElementById("v-acquirente").value.trim() || null,
      prezzo: parseFloat(document.getElementById("v-prezzo").value) || null,
      note_vendita: document.getElementById("v-note").value.trim() || null,
      snake_created_at: snake.created_at,
      logs_snapshot: logsSnapshot,
      // Foto, genetica e genealogia: prima non venivano salvate e andavano perse per
      // sempre alla vendita. Servono sia per ripristinare davvero con "Annulla vendita",
      // sia per poter mandare al cliente una scheda completa.
      foto_url: snake.foto_url || null,
      foto_position: snake.foto_position || null,
      genetica: snake.genetica || null,
      padre_id: snake.padre_id || null,
      madre_id: snake.madre_id || null,
      padre_esterno: snake.padre_esterno || null,
      madre_esterna: snake.madre_esterna || null,
      // Risolti adesso, finché i genitori sono ancora in collezione.
      padre_nome: nomeGenitore(snake, "padre"),
      madre_nome: nomeGenitore(snake, "madre"),
    };

    // 2. Salva il venduto CON i log PRIMA di eliminare il serpente
    await SB.insertVenduto(venduto);

    // 3. Solo DOPO elimina il serpente (e i log a cascata)
    await SB.deleteSerpente(snake.id);

    // 4. Aggiorna cache locale
    _venduti.unshift(venduto);
    _snakes = _snakes.filter((s) => s.id !== snakeId);
    delete _logsCache[snakeId];
    _recentLogs = _recentLogs.filter((l) => l.snake_id !== snakeId);

    closeModalEl(document.getElementById("vendi-modal"));
    toast(
      "💰 " +
        snake.nome +
        " segnato come venduto con " +
        logsSnapshot.length +
        " log salvati!",
    );
    showPage("venduti");
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💰 Conferma Vendita";
  }
}

// ═══════════════════════════════════════
//  PAGINA VENDUTI
// ═══════════════════════════════════════
const MESI_ABBR = {
  it: [
    "Gen",
    "Feb",
    "Mar",
    "Apr",
    "Mag",
    "Giu",
    "Lug",
    "Ago",
    "Set",
    "Ott",
    "Nov",
    "Dic",
  ],
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
};
const MESI_FULL = {
  it: [
    "Gennaio",
    "Febbraio",
    "Marzo",
    "Aprile",
    "Maggio",
    "Giugno",
    "Luglio",
    "Agosto",
    "Settembre",
    "Ottobre",
    "Novembre",
    "Dicembre",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

function getVendutiYears() {
  const years = new Set();
  _venduti.forEach((v) => {
    if (v.data_vendita) years.add(v.data_vendita.slice(0, 4));
  });
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

function getFilteredVenduti() {
  if (_vendutiFilterYear === "all") return _venduti;
  return _venduti.filter((v) => {
    if (!v.data_vendita) return false;
    if (v.data_vendita.slice(0, 4) !== _vendutiFilterYear) return false;
    if (_vendutiFilterMonth !== "all") {
      const m = parseInt(v.data_vendita.slice(5, 7), 10) - 1;
      if (m !== parseInt(_vendutiFilterMonth, 10)) return false;
    }
    return true;
  });
}

function setVendutiYear(year) {
  _vendutiFilterYear = year;
  _vendutiFilterMonth = "all";
  renderVenduti();
}

function setVendutiMonth(month) {
  _vendutiFilterMonth = String(month);
  renderVenduti();
}

function resetVendutiFiltri() {
  _vendutiFilterYear = "all";
  _vendutiFilterMonth = "all";
  renderVenduti();
}

function renderVenduti() {
  const filtered = getFilteredVenduti();
  const filteredIncasso = filtered.reduce(
    (s, v) => s + (parseFloat(v.prezzo) || 0),
    0,
  );
  const years = getVendutiYears();
  const mesiAbbr = MESI_ABBR[_appLang] || MESI_ABBR.it;
  const mesiFull = MESI_FULL[_appLang] || MESI_FULL.it;
  const filtriAttivi =
    _vendutiFilterYear !== "all" || _vendutiFilterMonth !== "all";

  // ── Costruzione barre del grafico ──
  let chartBars = [];
  if (_vendutiFilterYear === "all") {
    chartBars = [...years]
      .sort((a, b) => a.localeCompare(b))
      .map((y) => {
        const inYear = _venduti.filter(
          (v) => v.data_vendita && v.data_vendita.slice(0, 4) === y,
        );
        const incasso = inYear.reduce(
          (s, v) => s + (parseFloat(v.prezzo) || 0),
          0,
        );
        return {
          label: y,
          count: inYear.length,
          incasso,
          onclick: `setVendutiYear('${y}')`,
          active: false,
        };
      });
  } else {
    chartBars = mesiAbbr.map((label, idx) => {
      const inMonth = _venduti.filter(
        (v) =>
          v.data_vendita &&
          v.data_vendita.slice(0, 4) === _vendutiFilterYear &&
          parseInt(v.data_vendita.slice(5, 7), 10) - 1 === idx,
      );
      const incasso = inMonth.reduce(
        (s, v) => s + (parseFloat(v.prezzo) || 0),
        0,
      );
      const active =
        _vendutiFilterMonth !== "all" &&
        parseInt(_vendutiFilterMonth, 10) === idx;
      return {
        label,
        count: inMonth.length,
        incasso,
        onclick: `setVendutiMonth(${idx})`,
        active,
      };
    });
  }
  const maxBarValue = Math.max(0, ...chartBars.map((b) => b.incasso));
  const maxIncasso = maxBarValue + 5000; // margine fisso richiesto, cosi' la barra piu' alta non tocca mai il bordo

  let html = `
  <div class="page-header">
    <h2>💰 ${t("venduti_title")}</h2>
    <p>${filtered.length} ${t("venduti_count")} · ${t("venduti_incasso")} <strong style="color:var(--accent-gold)">€${filteredIncasso.toFixed(2)}</strong></p>
  </div>`;

  // ── Grafico ──
  if (years.length > 0) {
    const chartH = 140;
    const ySteps = 4; // 5 etichette: 100%, 75%, 50%, 25%, 0%
    const fmtEuroAxis = (val) =>
      val >= 1000
        ? "€" + (val / 1000).toFixed(1).replace(".0", "") + "k"
        : "€" + Math.round(val);
    const yLabels = [];
    for (let i = ySteps; i >= 0; i--) yLabels.push((maxIncasso * i) / ySteps);

    html += `
    <div class="card" style="margin-bottom:20px">
      <div class="card-title">📊 ${t("venduti_grafico_title")}</div>
      <div style="font-size:11px;color:var(--text-dim);margin-top:-8px;margin-bottom:4px">${t("venduti_grafico_hint")}</div>
      <div style="margin-top:16px">
        <div style="display:flex">
          <div style="position:relative;width:46px;height:${chartH}px;flex-shrink:0">
            ${yLabels.map((val, i) => `<div style="position:absolute;top:${(i / ySteps) * 100}%;transform:translateY(-50%);right:8px;font-size:9px;color:var(--text-dim);white-space:nowrap">${fmtEuroAxis(val)}</div>`).join("")}
          </div>
          <div style="flex:1;min-width:0;overflow-x:auto">
            <div style="min-width:max-content">
              <div style="position:relative;height:${chartH}px">
                <div style="position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;pointer-events:none">
                  ${yLabels.map(() => `<div style="border-top:1px dashed var(--border);opacity:0.4;height:0"></div>`).join("")}
                </div>
                <div style="position:relative;display:flex;align-items:flex-end;gap:6px;height:100%;padding-right:2px">
                  ${chartBars
                    .map(
                      (b) => `
                    <div class="venduti-bar-col" onclick="${b.onclick}" title="${b.count} ${t("venduti_vendite_label")} · €${b.incasso.toFixed(2)}">
                      <div style="font-size:12px;font-weight:700;color:var(--accent-gold);margin-bottom:3px;line-height:1">${b.count > 0 ? b.count : ""}</div>
                      <div class="venduti-bar ${b.active ? "venduti-bar-active" : ""}" style="height:${Math.max(3, (b.incasso / maxIncasso) * chartH)}px"></div>
                    </div>`,
                    )
                    .join("")}
                </div>
              </div>
              <div style="display:flex;gap:6px;margin-top:4px">
                ${chartBars.map((b) => `<div style="flex:1;min-width:30px;text-align:center;font-size:10px;color:var(--text-dim);white-space:nowrap">${esc(b.label)}</div>`).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Filtri ──
  html += `
  <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
    <select onchange="setVendutiYear(this.value)" style="background:var(--bg-moss);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:9px 12px;font-family:'Inter',sans-serif;font-size:13px">
      <option value="all" ${_vendutiFilterYear === "all" ? "selected" : ""}>${t("venduti_tutti_anni")}</option>
      ${years.map((y) => `<option value="${y}" ${_vendutiFilterYear === y ? "selected" : ""}>${y}</option>`).join("")}
    </select>
    ${
      _vendutiFilterYear !== "all"
        ? `
    <select onchange="setVendutiMonth(this.value)" style="background:var(--bg-moss);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:9px 12px;font-family:'Inter',sans-serif;font-size:13px">
      <option value="all" ${_vendutiFilterMonth === "all" ? "selected" : ""}>${t("venduti_tutti_mesi")}</option>
      ${mesiFull.map((m, idx) => `<option value="${idx}" ${String(_vendutiFilterMonth) === String(idx) ? "selected" : ""}>${m}</option>`).join("")}
    </select>`
        : ""
    }
    ${filtriAttivi ? `<button class="btn btn-ghost btn-sm" onclick="resetVendutiFiltri()">${t("venduti_reset_filtri")}</button>` : ""}
    <div style="margin-left:auto;font-size:13px;color:var(--text-mid);white-space:nowrap">
      <strong style="color:var(--accent-gold)">${filtered.length}</strong> ${t("venduti_vendite_label")} · <strong style="color:var(--accent-gold)">€${filteredIncasso.toFixed(2)}</strong>
    </div>
  </div>`;

  // ── Lista (filtrata) ──
  if (!filtered.length) {
    html += `<div class="empty-state"><div class="empty-icon">💰</div><h3>${filtriAttivi ? t("venduti_nessuna_nel_periodo") : t("venduti_empty_title")}</h3><p>${filtriAttivi ? "" : t("venduti_empty_desc")}</p></div>`;
  } else {
    html +=
      '<div class="snakes-grid">' +
      filtered
        .map(
          (v) => `
      <div class="snake-card" style="cursor:default">
        <div class="snake-card-header">
          <div>
            <div class="snake-name" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">${esc(v.nome)} <span style="font-size:11px;background:rgba(201,168,76,0.2);color:var(--accent-gold);padding:2px 8px;border-radius:20px;font-family:'Inter',sans-serif;font-weight:600">${t("venduti_badge")}</span>${trasferimentoPill(v.id)}</div>
            <div class="snake-code">${esc(v.icd)}</div>
          </div>
          <span class="badge badge-${esc(v.sesso)}">${v.sesso === "M" ? "♂" : "♀"}</span>
        </div>
        <div class="snake-info">
          <div class="snake-info-item"><div class="snake-info-label">${t("serpenti_specie")}</div><div class="snake-info-value">${esc(v.specie || "—")}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("venduti_data_vendita")}</div><div class="snake-info-value">${fmtDate(v.data_vendita)}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("venduti_acquirente")}</div><div class="snake-info-value">${esc(v.acquirente || "—")}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("venduti_prezzo")}</div><div class="snake-info-value" style="color:var(--accent-gold)">${v.prezzo ? "€" + v.prezzo : "—"}</div></div>
        </div>
        <div class="snake-card-actions">
          <button class="btn btn-ghost btn-sm vend-detail-btn" data-id="${v.id}">📋 ${t("serpenti_dettagli")}</button>
          ${trasferimentoActions(v.id)}
          ${trasferimentoAccettato(v.id) ? "" : `<button class="btn btn-ghost btn-sm vend-undo-btn" data-id="${v.id}" style="color:var(--accent-lime);border-color:var(--accent-lime)">↩️ Annulla vendita</button>`}
          <button class="btn btn-primary btn-sm vend-pdf-btn" data-id="${v.id}">📄 PDF</button>
          <button class="btn btn-danger btn-sm vend-del-btn" data-id="${v.id}">🗑️</button>
        </div>
      </div>`,
        )
        .join("") +
      "</div>";
  }
  document.getElementById("main-content").innerHTML = html;
  bindVendutiActions();
}

// Event delegation — evita problemi con onclick e template literals su Safari.
// #main-content è un contenitore persistente (solo l'innerHTML viene sostituito ad ogni
// navigazione): il listener va agganciato UNA SOLA VOLTA, altrimenti si accumula ad ogni
// visita di questa pagina e ogni click scatena N conferme in sequenza.
// Chiamata sia dalla lista che dal dettaglio venduto, perché entrambe le pagine
// mostrano i bottoni di trasferimento.
function bindVendutiActions() {
  const mainEl = document.getElementById("main-content");
  if (!mainEl || mainEl.dataset.vendutiBound) return;
  mainEl.dataset.vendutiBound = "1";
  mainEl.addEventListener("click", function (e) {
    const detBtn = e.target.closest(".vend-detail-btn");
    const pdfBtn = e.target.closest(".vend-pdf-btn");
    const delBtn = e.target.closest(".vend-del-btn");
    const undoBtn = e.target.closest(".vend-undo-btn");
    const sendBtn = e.target.closest(".vend-send-btn");
    const trUndoBtn = e.target.closest(".vend-trasf-undo-btn");
    if (detBtn) showPage("dettaglioVenduto", detBtn.dataset.id);
    if (pdfBtn) printResoconto(pdfBtn.dataset.id);
    if (delBtn) deleteVenduto(delBtn.dataset.id);
    if (undoBtn) annullaVendita(undoBtn.dataset.id);
    if (sendBtn) showInviaClienteModal(sendBtn.dataset.id);
    if (trUndoBtn) ritiraTrasferimento(trUndoBtn.dataset.id);
  });
}

async function deleteVenduto(id) {
  if (!confirm(t("err_elimina_venduto"))) return;
  try {
    // Un invito ancora in attesa punta a una vendita che sta per sparire: va ritirato,
    // altrimenti resterebbe accettabile per un record che non esiste più.
    const tr = trasferimentoDelVenduto(id);
    if (tr && tr.stato === "pending") {
      await SB.annullaTrasferimento(tr.id);
      tr.stato = "cancelled";
    }
    await SB.deleteVenduto(id);
    _venduti = _venduti.filter((v) => v.id !== id);
    toast(t("eliminato"), "#c0392b");
    renderVenduti();
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
  }
}

// Riporta un serpente venduto in collezione (creato per errore, ripensamento, ecc.).
// Ripristina anagrafica, storico log completo e — per le vendite registrate da quando
// `venduti` salva anche quei campi — foto, genetica e genealogia.
async function annullaVendita(vendutoId) {
  // Protegge da doppio-click e da eventuali listener duplicati rimasti da prima del fix:
  // senza questa guardia due inserimenti in corsa possono scontrarsi su "duplicate key".
  if (_annullaInFlight.has(vendutoId)) return;
  const listV = _venduti.find((x) => x.id === vendutoId);
  if (!listV) return;

  // Se il cliente ha già accettato il trasferimento, l'animale vive sul suo account:
  // ripristinare anche la propria copia creerebbe lo stesso esemplare in due posti.
  const tr = trasferimentoDelVenduto(vendutoId);
  if (tr && tr.stato === "accepted") {
    toast(t("trasf_err_gia_accettato"), "#c0392b");
    return;
  }

  const avvisoInvito =
    tr && tr.stato === "pending"
      ? `\n\nL'invito inviato a ${tr.destinatario_email} verrà ritirato: il cliente non potrà più accettarlo.`
      : "";
  if (
    !confirm(
      `Annullare la vendita di "${listV.nome}"?\n\nIl serpente torna in "I miei serpenti" con anagrafica e storico log completi, insieme a foto e genealogia se erano state salvate al momento della vendita.${avvisoInvito}`,
    )
  )
    return;

  _annullaInFlight.add(vendutoId);
  try {
    // Prima si ritira l'invito, poi si smonta la vendita: se il ritiro fallisce meglio
    // fermarsi qui, con la vendita ancora intatta, che lasciare in giro un invito
    // accettabile per un serpente tornato in collezione.
    if (tr && tr.stato === "pending") {
      await SB.annullaTrasferimento(tr.id);
      tr.stato = "cancelled";
    }

    // Serve la riga completa (con logs_snapshot) — potrebbe non essere ancora in cache se richiamato dalla lista.
    const v = listV.logs_snapshot ? listV : await SB.getVendutoFull(vendutoId);
    if (!v) {
      toast("Vendita non trovata", "#c0392b");
      return;
    }

    // I genitori potrebbero essere stati venduti nel frattempo: se l'id non punta più a
    // un serpente in collezione si ricade sul nome congelato alla vendita, così la
    // genealogia resta leggibile invece di sparire.
    const padreVivo = !!(
      v.padre_id && _snakes.some((s) => s.id === v.padre_id)
    );
    const madreViva = !!(
      v.madre_id && _snakes.some((s) => s.id === v.madre_id)
    );

    const restored = {
      id: v.snake_id,
      nome: v.nome,
      specie: v.specie,
      morfo: v.morfo,
      sesso: v.sesso,
      nascita: v.nascita,
      peso: v.peso,
      provenienza: v.provenienza,
      icd: v.icd,
      note: v.note,
      created_at: v.snake_created_at || undefined,
      foto_url: v.foto_url || null,
      foto_position: v.foto_position || null,
      genetica: v.genetica || null,
      padre_id: padreVivo ? v.padre_id : null,
      padre_esterno: padreVivo ? null : v.padre_esterno || v.padre_nome || null,
      madre_id: madreViva ? v.madre_id : null,
      madre_esterna: madreViva ? null : v.madre_esterna || v.madre_nome || null,
    };
    // Se un tentativo precedente si era già fermato qui (es. rete, o un retry) il serpente
    // può esistere già lato server: non è un errore, si prosegue con i passi mancanti.
    try {
      await SB.insertSerpente(restored);
    } catch (err) {
      if (!/duplicate key/i.test(err.message)) throw err;
    }

    const logsToRestore = (v.logs_snapshot || []).map((l) => ({
      ...l,
      snake_id: restored.id,
    }));
    if (logsToRestore.length) {
      try {
        await SB.insertLogsBulk(logsToRestore);
      } catch (err) {
        if (!/duplicate key/i.test(err.message)) throw err;
      }
    }

    await SB.deleteVenduto(v.id);

    if (!_snakes.some((s) => s.id === restored.id)) _snakes.push(restored);
    addLogsToCaches(restored.id, logsToRestore);
    _venduti = _venduti.filter((x) => x.id !== v.id);

    toast("🐍 " + restored.nome + " ripristinato nella collezione!");
    showPage("dettaglio", restored.id);
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
  } finally {
    _annullaInFlight.delete(vendutoId);
  }
}

// ═══════════════════════════════════════
//  DETTAGLIO SERPENTE VENDUTO
// ═══════════════════════════════════════
function renderDettaglioVenduto() {
  const vendutoId = currentSnakeId;
  const v = _venduti.find((x) => x.id === vendutoId);
  if (!v) {
    showPage("venduti");
    return;
  }

  // logs_snapshot non è nella lista (per peso) — va recuperato al volo la prima volta.
  if (!v.logs_snapshot) {
    document.getElementById("main-content").innerHTML = `
      <div style="margin-bottom:14px"><button class="btn btn-ghost btn-sm" onclick="showPage('venduti')">← ${t("det_indietro")}</button></div>
      <div class="empty-state"><div class="empty-icon">⏳</div><h3>Caricamento storico…</h3></div>`;
    SB.getVendutoFull(vendutoId)
      .then((full) => {
        if (full) Object.assign(v, full);
        if (currentPage === "dettaglioVenduto" && currentSnakeId === vendutoId)
          renderDettaglioVenduto();
      })
      .catch((e) => toast("Errore: " + e.message, "#c0392b"));
    return;
  }

  const logs = v.logs_snapshot || [];
  const foodLogs = logs
    .filter((l) => l.tipo === "cibo")
    .sort((a, b) => b.data.localeCompare(a.data));
  const feciLogs = logs
    .filter((l) => l.tipo === "feci")
    .sort((a, b) => b.data.localeCompare(a.data));
  const eggsLogs = logs
    .filter((l) => l.tipo === "uova")
    .sort((a, b) => b.data.localeCompare(a.data));
  const totalFood = foodLogs.reduce(
    (s, l) => s + (parseFloat(l.grammi) || 0),
    0,
  );

  const dataIngresso = v.snake_created_at ? new Date(v.snake_created_at) : null;
  const dataVendita = new Date(v.data_vendita);
  const giorniAllevamento = dataIngresso
    ? Math.floor((dataVendita - dataIngresso) / 86400000)
    : null;

  let html = `
  <div style="margin-bottom:14px">
    <button class="btn btn-ghost btn-sm" onclick="showPage('venduti')">← ${t("det_indietro")}</button>
  </div>

  <!-- HEADER -->
  <div class="snake-detail-header">
    <div class="sdh-top">
      <div class="sdh-top-row1">
        <div class="snake-avatar" style="position:relative;overflow:hidden;border-radius:50%;width:56px;height:56px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--bg-moss)">${v.foto_url ? `<img src="${esc(v.foto_url)}" style="width:100%;height:100%;object-fit:cover">` : "🐍"}</div>
        <div class="sdh-name-block">
          <div class="snake-detail-name">${esc(v.nome)} <span style="font-size:11px;background:rgba(201,168,76,0.2);color:var(--accent-gold);padding:2px 8px;border-radius:20px;font-family:'Inter',sans-serif;font-weight:600">${t("venduti_badge")}</span>${trasferimentoPill(v.id)}</div>
          <div class="snake-detail-meta">
            <span class="badge badge-${esc(v.sesso)}">${v.sesso === "M" ? "♂ " + t("aggiungi_maschio") : "♀ " + t("aggiungi_femmina")}</span>
            ${v.specie ? `<span>🦎 ${esc(v.specie)}</span>` : ""}
            ${v.morfo ? `<span>🎨 ${esc(v.morfo)}</span>` : ""}
            ${v.nascita ? `<span>🎂 ${fmtDate(v.nascita)}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="sdh-top-row2">
        ${trasferimentoActions(v.id)}
        ${trasferimentoAccettato(v.id) ? "" : `<button class="btn btn-ghost btn-sm" onclick="annullaVendita('${v.id}')" style="color:var(--accent-lime);border-color:var(--accent-lime)">↩️ Annulla vendita</button>`}
        <button class="btn btn-primary btn-sm" onclick="printResoconto('${v.id}')">📄 PDF</button>
      </div>
    </div>
    <div class="sdh-bottom">
      <div class="snake-stats">
        <div class="stat"><div class="stat-val">${foodLogs.length}</div><div class="stat-lab">${t("det_pasti")}</div></div>
        <div class="stat"><div class="stat-val">${totalFood.toFixed(0)}g</div><div class="stat-lab">${t("det_cibo_tot")}</div></div>
        <div class="stat"><div class="stat-val">${feciLogs.length}</div><div class="stat-lab">${t("det_feci")}</div></div>
        ${v.sesso === "F" ? `<div class="stat"><div class="stat-val">${eggsLogs.length}</div><div class="stat-lab">${t("dashboard_deposizioni")}</div></div>` : ""}
        ${giorniAllevamento !== null ? `<div class="stat"><div class="stat-val">${giorniAllevamento}</div><div class="stat-lab">${t("dv_giorni")}</div></div>` : ""}
      </div>
      <div class="sdh-icd">${esc(v.icd)}</div>
    </div>
  </div>

  <!-- BOX VENDITA -->
  <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,var(--bg-moss),var(--bg-card2));border-color:var(--accent-gold)">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-family:'Cinzel',serif;font-size:14px;color:var(--accent-gold);margin-bottom:4px">💰 ${t("dv_venduto_il")} ${fmtDate(v.data_vendita)}</div>
        <div style="font-size:13px;color:var(--text-mid)">${t("venduti_acquirente")}: <strong style="color:var(--text-bright)">${esc(v.acquirente) || t("dv_non_specificato")}</strong></div>
        ${v.note_vendita ? `<div style="font-size:12px;color:var(--text-dim);margin-top:2px">${esc(v.note_vendita)}</div>` : ""}
      </div>
      <div style="font-family:'Cinzel',serif;font-size:28px;color:var(--accent-gold)">${v.prezzo ? "€" + v.prezzo : "N/D"}</div>
    </div>
  </div>

  <!-- TABS LOG -->
  <div class="tabs">
    <button class="tab active" id="tab-cibo" onclick="switchTab('cibo')">🥩 ${t("det_tab_pasti")} (${foodLogs.length})</button>
    <button class="tab" id="tab-feci" onclick="switchTab('feci')">💩 ${t("det_tab_feci")} (${feciLogs.length})</button>
    ${v.sesso === "F" ? `<button class="tab" id="tab-uova" onclick="switchTab('uova')">🥚 ${t("det_tab_uova")} (${eggsLogs.length})</button>` : ""}
    <button class="tab" id="tab-info" onclick="switchTab('info')">📄 ${t("det_tab_info")}</button>
  </div>

  <!-- CIBO -->
  <div id="tab-content-cibo">
    <div class="card">
      <div class="card-title">🥩 ${t("dv_storico_alimentazione")}</div>
      ${
        foodLogs.length === 0
          ? `<div style="color:var(--text-dim);font-size:14px;padding:10px 0">${t("dv_nessun_pasto")}</div>`
          : foodLogs
              .map(
                (l) => `<div class="log-entry">
          <div class="log-icon food">🥩</div>
          <div class="log-info">
            <div class="log-date">${fmtDate(l.data)}</div>
            <div class="log-desc">${l.food_tipo || t("log_cibo_default")} ×${l.qty || 1} — ${l.grammi || 0}g${l.note ? ` · ${esc(l.note)}` : ""}</div>
          </div>
        </div>`,
              )
              .join("")
      }
    </div>
  </div>

  <!-- FECI -->
  <div id="tab-content-feci" style="display:none">
    <div class="card">
      <div class="card-title">💩 ${t("dv_storico_feci")}</div>
      ${
        feciLogs.length === 0
          ? `<div style="color:var(--text-dim);font-size:14px;padding:10px 0">${t("nessuna_registrazione")}</div>`
          : feciLogs
              .map(
                (l) => `<div class="log-entry">
          <div class="log-icon feci">💩</div>
          <div class="log-info">
            <div class="log-date">${fmtDate(l.data)}</div>
            <div class="log-desc">${l.feci_tipo || "—"}${l.note ? ` · ${esc(l.note)}` : ""}</div>
          </div>
        </div>`,
              )
              .join("")
      }
    </div>
  </div>

  <!-- UOVA -->
  ${
    v.sesso === "F"
      ? `<div id="tab-content-uova" style="display:none">
    <div class="card">
      <div class="card-title">🥚 ${t("dv_storico_deposizioni")}</div>
      ${
        eggsLogs.length === 0
          ? `<div style="color:var(--text-dim);font-size:14px;padding:10px 0">${t("dv_nessuna_deposizione")}</div>`
          : eggsLogs
              .map(
                (l) => `<div class="log-entry">
          <div class="log-icon eggs">🥚</div>
          <div class="log-info">
            <div class="log-date">${fmtDate(l.data)}</div>
            <div class="log-desc">${l.num_uova || 0} ${t("log_uova_desc")}, ${l.fertili || 0} ${t("log_fertili_desc")}${l.temp ? ` — ${l.temp}°C` : ""}${l.note ? ` · ${esc(l.note)}` : ""}</div>
          </div>
        </div>`,
              )
              .join("")
      }
    </div>
  </div>`
      : ""
  }

  <!-- INFO -->
  <div id="tab-content-info" style="display:none">
    <div class="card">
      <div class="card-title">📄 ${t("scheda_anagrafica")}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
        ${[
          [t("lbl_nome"), v.nome],
          [t("lbl_specie"), v.specie || "—"],
          [t("lbl_morfo"), v.morfo || "—"],
          [
            t("lbl_sesso"),
            v.sesso === "M"
              ? "♂ " + t("aggiungi_maschio")
              : "♀ " + t("aggiungi_femmina"),
          ],
          [t("lbl_nascita"), fmtDate(v.nascita)],
          [t("lbl_peso"), v.peso ? v.peso + "g" : "—"],
          [t("lbl_provenienza"), v.provenienza || "—"],
          [t("lbl_icd"), v.icd],
          [
            t("dv_giorni_allevamento"),
            giorniAllevamento !== null ? giorniAllevamento + "gg" : "—",
          ],
          // Salvati sul venduto solo dalle vendite registrate dopo l'introduzione
          // del trasferimento: sulle vendite più vecchie restano vuoti.
          [t("gen_padre"), v.padre_nome || v.padre_esterno || "—"],
          [t("gen_madre"), v.madre_nome || v.madre_esterna || "—"],
          [t("gen_genetica"), v.genetica || "—"],
        ]
          .map(
            ([k, val]) => `
          <div style="background:var(--bg-moss);border-radius:8px;padding:10px">
            <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">${k}</div>
            <div style="font-size:13px;color:var(--text-bright);margin-top:3px;font-weight:500;word-break:break-word">${esc(val)}</div>
          </div>`,
          )
          .join("")}
      </div>
      ${
        v.note
          ? `<div style="margin-top:12px;background:var(--bg-moss);border-radius:8px;padding:12px">
        <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${t("label_note")}</div>
        <div style="font-size:13px;color:var(--text-mid)">${esc(v.note)}</div>
      </div>`
          : ""
      }
    </div>
  </div>`;

  document.getElementById("main-content").innerHTML = html;
  bindVendutiActions();
}

// ═══════════════════════════════════════
//  TRASFERIMENTO AL CLIENTE
// ═══════════════════════════════════════
// L'allevatore invia al cliente la scheda di un serpente venduto. Il cliente deve
// accettare esplicitamente dal proprio account: finché non lo fa, sul suo account
// non viene scritto nulla. La vendita resta comunque nei "Venduti" dell'allevatore,
// prezzo compreso, quindi il grafico del fatturato non cambia.
//
// Nessuno dei due lati può scrivere direttamente: la RLS è `user_id = auth.uid()` su
// tutte le tabelle. La creazione dell'invito passa dalla Edge Function transfer-snake
// (che manda anche l'email), l'accettazione da una RPC SECURITY DEFINER che fa
// l'INSERT in una sola transazione.

// Più righe possono riferirsi alla stessa vendita nel tempo (un invito ritirato e poi
// rifatto): conta solo la più significativa. Accettato batte in attesa, che batte il resto.
function trasferimentoDelVenduto(vendutoId) {
  const righe = _trasfInviati.filter((x) => x.venduto_id === vendutoId);
  return (
    righe.find((x) => x.stato === "accepted") ||
    righe.find((x) => x.stato === "pending") ||
    righe[0] ||
    null
  );
}

function trasferimentoAccettato(vendutoId) {
  const tr = trasferimentoDelVenduto(vendutoId);
  return !!(tr && tr.stato === "accepted");
}

// Pillola di stato, stesso stile del badge VENDUTO.
function trasferimentoPill(vendutoId) {
  const tr = trasferimentoDelVenduto(vendutoId);
  if (!tr) return "";
  const stili = {
    pending: [
      "rgba(201,168,76,0.2)",
      "var(--accent-gold)",
      t("trasf_stato_pending"),
    ],
    accepted: [
      "rgba(109,181,109,0.2)",
      "var(--accent-lime)",
      t("trasf_stato_accepted"),
    ],
    rejected: [
      "rgba(192,57,43,0.2)",
      "var(--accent-red)",
      t("trasf_stato_rejected"),
    ],
  };
  const s = stili[tr.stato];
  if (!s) return "";
  return `<span title="${esc(tr.destinatario_email)}" style="font-size:11px;background:${s[0]};color:${s[1]};padding:2px 8px;border-radius:20px;font-family:'Inter',sans-serif;font-weight:600">${s[2]}</span>`;
}

// Bottoni di trasferimento per una vendita. Se il cliente ha già accettato non c'è
// più nulla da fare: l'animale vive sul suo account.
function trasferimentoActions(vendutoId) {
  const tr = trasferimentoDelVenduto(vendutoId);
  if (tr && tr.stato === "accepted") return "";
  if (tr && tr.stato === "pending") {
    return `<button class="btn btn-ghost btn-sm vend-trasf-undo-btn" data-id="${tr.id}" style="color:var(--accent-red);border-color:var(--accent-red)">✖️ ${t("trasf_ritira")}</button>`;
  }
  return `<button class="btn btn-ghost btn-sm vend-send-btn" data-id="${vendutoId}" style="color:var(--accent-gold);border-color:var(--accent-gold)">📨 ${t("trasf_invia")}</button>`;
}

// Dati raccolti nella modale di invio: la foto nuova eventualmente scelta lì.
let _inviaFotoData = null;

async function showInviaClienteModal(vendutoId) {
  const v = _venduti.find((x) => x.id === vendutoId);
  if (!v) return;
  _inviaFotoData = null;

  // Foto e genealogia non sono nella select della lista (peso): serve la riga piena
  // per sapere davvero cosa manca, altrimenti risulterebbero sempre assenti.
  if (!v.logs_snapshot) {
    try {
      const full = await SB.getVendutoFull(vendutoId);
      if (full) Object.assign(v, full);
    } catch (e) {
      toast("Errore: " + e.message, "#c0392b");
      return;
    }
  }

  const padre = v.padre_nome || v.padre_esterno || "";
  const madre = v.madre_nome || v.madre_esterna || "";
  const nLog = ultimiLogInvio(v).length;

  document.getElementById("invia-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "invia-modal";
  modal.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;display:flex;align-items:flex-end;justify-content:center;padding:0";

  const campo = (label, id, value, ph) => `
    <div style="display:flex;flex-direction:column;gap:6px">
      <label style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">${label}</label>
      <input type="text" id="${id}" value="${esc(value)}" placeholder="${esc(ph)}" autocomplete="off" style="background:var(--bg-forest);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:12px 14px;font-size:16px;font-family:'Inter',sans-serif;outline:none">
    </div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px 16px 0 0;padding:24px;width:100%;max-width:600px;box-shadow:0 -10px 40px rgba(0,0,0,0.6);padding-bottom:calc(24px + var(--safe-bottom));max-height:90vh;overflow-y:auto">
      <div style="font-family:'Cinzel',serif;font-size:18px;color:var(--accent-gold);margin-bottom:6px">📨 ${t("trasf_modal_title")}</div>
      <div style="font-size:13px;color:var(--text-dim);margin-bottom:20px">${t("trasf_modal_sub")} <strong style="color:var(--text-bright)">${esc(v.nome)}</strong></div>

      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;flex-direction:column;gap:6px">
          <label style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim)">${t("trasf_email_label")} *</label>
          <input type="email" id="inv-email" placeholder="cliente@email.com" autocomplete="off" inputmode="email" style="background:var(--bg-forest);border:1px solid var(--border);color:var(--text-bright);border-radius:8px;padding:12px 14px;font-size:16px;font-family:'Inter',sans-serif;outline:none">
        </div>

        <div style="background:var(--bg-moss);border-radius:10px;padding:14px">
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-dim);margin-bottom:10px">${t("trasf_cosa_invii")}</div>

          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div id="inv-foto-preview" style="width:64px;height:64px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:var(--bg-forest);border:1px dashed var(--border);overflow:hidden">
              ${v.foto_url ? `<img src="${esc(v.foto_url)}" style="width:100%;height:100%;object-fit:cover">` : '<span style="font-size:22px">📷</span>'}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;color:${v.foto_url ? "var(--text-bright)" : "var(--accent-gold)"}">${v.foto_url ? t("trasf_foto_ok") : t("trasf_foto_manca")}</div>
              <label style="display:inline-block;margin-top:6px;font-size:12px;color:var(--accent-gold);cursor:pointer;text-decoration:underline">
                ${v.foto_url ? t("trasf_foto_cambia") : t("trasf_foto_aggiungi")}
                <input type="file" accept="image/*" onchange="previewFotoInvio(this)" style="display:none">
              </label>
            </div>
          </div>

          ${campo(t("gen_padre"), "inv-padre", padre, t("trasf_gen_ph"))}
          <div style="height:10px"></div>
          ${campo(t("gen_madre"), "inv-madre", madre, t("trasf_gen_ph"))}

          <div style="font-size:12px;color:var(--text-mid);margin-top:14px;line-height:1.6">
            ${t("trasf_riepilogo").replace("{N}", nLog)}
          </div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:8px;line-height:1.6">
            ${t("trasf_non_invii")}
          </div>
        </div>
      </div>

      <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
        <button onclick="closeModalEl(document.getElementById('invia-modal'))" style="padding:12px 20px;background:transparent;color:var(--text-mid);border:1px solid var(--border);border-radius:8px;font-family:'Inter',sans-serif;font-size:15px;cursor:pointer">${t("trasf_annulla")}</button>
        <button id="btn-conferma-invio" onclick="confermaInvioCliente('${v.id}')" style="padding:12px 24px;background:var(--accent-gold);color:#1a0f00;border:none;border-radius:8px;font-family:'Inter',sans-serif;font-size:15px;font-weight:700;cursor:pointer">📨 ${t("trasf_conferma")}</button>
      </div>
    </div>`;
  modal.classList.add("modal-sheet");
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
}

async function previewFotoInvio(input) {
  if (!input.files || !input.files[0]) return;
  try {
    _inviaFotoData = await compressImageToDataUrl(input.files[0]);
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    return;
  }
  const preview = document.getElementById("inv-foto-preview");
  if (preview) {
    preview.innerHTML = `<img src="${_inviaFotoData}" style="width:100%;height:100%;object-fit:cover">`;
    preview.style.border = "none";
  }
}

// Conteggio locale dell'anteprima: deve corrispondere a ciò che la Edge Function
// estrae davvero dal logs_snapshot, cioè l'ultima registrazione per ogni tipo.
function ultimiLogInvio(v) {
  const perTipo = {};
  (v.logs_snapshot || []).forEach((l) => {
    if (!l || !l.tipo) return;
    if (_isNewerLog(l, perTipo[l.tipo])) perTipo[l.tipo] = l;
  });
  return Object.values(perTipo);
}

async function confermaInvioCliente(vendutoId) {
  const btn = document.getElementById("btn-conferma-invio");
  if (!btn || btn.disabled) return;
  const v = _venduti.find((x) => x.id === vendutoId);
  if (!v) return;

  const email = (document.getElementById("inv-email").value || "")
    .trim()
    .toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    toast(t("trasf_err_email"), "#c0392b");
    return;
  }

  const padre = (document.getElementById("inv-padre").value || "").trim();
  const madre = (document.getElementById("inv-madre").value || "").trim();

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> ' + t("trasf_invio_corso");
  try {
    // Foto e genitori inseriti qui vengono prima SALVATI sulla vendita, non solo
    // spediti: così restano nella scheda del venduto, nel PDF e in un eventuale
    // "Annulla vendita", invece di esistere solo dentro l'invito.
    const patch = {};
    if (_inviaFotoData) {
      patch.foto_url = _inviaFotoData;
      patch.foto_position = v.foto_position || "50% 50%";
    }
    if (padre !== (v.padre_nome || v.padre_esterno || ""))
      patch.padre_nome = padre || null;
    if (madre !== (v.madre_nome || v.madre_esterna || ""))
      patch.madre_nome = madre || null;
    if (Object.keys(patch).length) {
      await SB.updateVenduto(vendutoId, patch);
      Object.assign(v, patch);
    }

    const session = await getSession();
    if (!session)
      throw new Error("Sessione non valida, effettua di nuovo il login.");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/transfer-snake`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ venduto_id: vendutoId, email }),
    });
    const data = await res.json();
    if (!res.ok || data.error)
      throw new Error(data.error || t("trasf_err_generico"));

    // La lista inviati non viene ricaricata dal server: si aggiunge la riga a mano
    // per far comparire subito la pillola "in attesa" senza un giro di rete in più.
    _trasfInviati.unshift({
      id: data.id,
      destinatario_email: email,
      venduto_id: vendutoId,
      stato: "pending",
      created_at: new Date().toISOString(),
      expires_at: data.expires_at,
      responded_at: null,
    });

    closeModalEl(document.getElementById("invia-modal"));
    toast("📨 " + t("trasf_inviato"));
    if (currentPage === "venduti") renderVenduti();
    else if (currentPage === "dettaglioVenduto") renderDettaglioVenduto();
    applyTrasferimentiUI();
  } catch (e) {
    toast("Errore: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "📨 " + t("trasf_conferma");
  }
}

async function ritiraTrasferimento(trasfId) {
  if (_trasfInFlight.has(trasfId)) return;
  const tr = _trasfInviati.find((x) => x.id === trasfId);
  if (!tr) return;
  if (
    !confirm(
      t("trasf_conferma_ritiro").replace("{EMAIL}", tr.destinatario_email),
    )
  )
    return;

  _trasfInFlight.add(trasfId);
  try {
    await SB.annullaTrasferimento(trasfId);
    tr.stato = "cancelled";
    toast(t("trasf_ritirato"));
    if (currentPage === "venduti") renderVenduti();
    else if (currentPage === "dettaglioVenduto") renderDettaglioVenduto();
    applyTrasferimentiUI();
  } catch (e) {
    toast("Errore: " + traduciErroreTrasf(e.message), "#c0392b");
  } finally {
    _trasfInFlight.delete(trasfId);
  }
}

// Le RPC sollevano codici secchi (NOT_FOUND, FREE_LIMIT, ...) invece di frasi:
// così il messaggio mostrato all'utente segue la lingua dell'app.
function traduciErroreTrasf(msg) {
  const key = {
    NOT_FOUND: "trasf_err_non_trovato",
    NOT_PENDING: "trasf_err_non_in_attesa",
    EXPIRED: "trasf_err_scaduto",
    FREE_LIMIT: "trasf_err_limite_free",
  }[String(msg || "").trim()];
  return key ? t(key) : msg;
}

// ═══════════════════════════════════════
//  PAGINA TRASFERIMENTI (lato cliente)
// ═══════════════════════════════════════
// Voce di menu e badge compaiono solo a chi ha effettivamente qualcosa da vedere:
// stesso approccio della sezione admin in applyPlanUI().
function applyTrasferimentiUI() {
  const nPending = _trasfRicevuti.length;
  const visibile = nPending > 0 || _trasfInviati.length > 0;
  ["trasf-nav-section", "trasf-mnav-section"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = visibile ? "" : "none";
  });
  ["nav-trasferimenti-badge", "mnav-trasferimenti-badge"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = nPending;
    el.style.display = nPending > 0 ? "" : "none";
  });
}

function renderTrasferimenti() {
  const ric = _trasfRicevuti;
  const inv = _trasfInviati.filter(
    (x) =>
      x.stato === "pending" || x.stato === "accepted" || x.stato === "rejected",
  );

  let html = `
  <div class="page-header">
    <h2>📨 ${t("trasf_page_title")}</h2>
    <p>${t("trasf_page_sub")}</p>
  </div>`;

  if (!ric.length && !inv.length) {
    html += `<div class="empty-state"><div class="empty-icon">📨</div><h3>${t("trasf_empty_title")}</h3><p>${t("trasf_empty_desc")}</p></div>`;
    document.getElementById("main-content").innerHTML = html;
    bindTrasferimentiActions();
    return;
  }

  if (ric.length) {
    html += `<div class="card-title" style="margin-bottom:12px">📥 ${t("trasf_in_arrivo")}</div>`;
    html +=
      '<div class="snakes-grid" style="margin-bottom:24px">' +
      ric
        .map((tr) => {
          const p = tr.payload || {};
          const scad = tr.expires_at
            ? fmtDate(tr.expires_at.slice(0, 10))
            : "—";
          return `
      <div class="snake-card" style="cursor:default;border-color:var(--accent-gold)">
        <div class="snake-card-header">
          <div style="display:flex;align-items:center;gap:12px;min-width:0">
            <div style="width:52px;height:52px;border-radius:10px;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--bg-moss)">
              ${p.foto_url ? `<img src="${esc(p.foto_url)}" style="width:100%;height:100%;object-fit:cover;object-position:${esc(p.foto_position || "50% 50%")}">` : "🐍"}
            </div>
            <div style="min-width:0">
              <div class="snake-name">${esc(p.nome || "—")}</div>
              <div class="snake-code">${esc(p.icd || "")}</div>
            </div>
          </div>
          ${p.sesso ? `<span class="badge badge-${esc(p.sesso)}">${p.sesso === "M" ? "♂" : "♀"}</span>` : ""}
        </div>
        <div class="snake-info">
          <div class="snake-info-item"><div class="snake-info-label">${t("serpenti_specie")}</div><div class="snake-info-value">${esc(p.specie || "—")}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("lbl_morfo")}</div><div class="snake-info-value">${esc(p.morfo || "—")}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("trasf_da")}</div><div class="snake-info-value" style="word-break:break-all">${esc(tr.mittente_email || "—")}</div></div>
          <div class="snake-info-item"><div class="snake-info-label">${t("trasf_scade")}</div><div class="snake-info-value">${scad}</div></div>
        </div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:10px;line-height:1.6">
          ${t("trasf_contenuto").replace("{N}", (p.logs || []).length)}
        </div>
        <div class="snake-card-actions">
          <button class="btn btn-green btn-sm trasf-ok-btn" data-id="${tr.id}">✅ ${t("trasf_accetta")}</button>
          <button class="btn btn-danger btn-sm trasf-no-btn" data-id="${tr.id}">✖️ ${t("trasf_rifiuta")}</button>
        </div>
      </div>`;
        })
        .join("") +
      "</div>";
  }

  if (inv.length) {
    html += `<div class="card-title" style="margin-bottom:12px">📤 ${t("trasf_inviati")}</div>`;
    html +=
      '<div class="card">' +
      inv
        .map((tr) => {
          const v = _venduti.find((x) => x.id === tr.venduto_id);
          const etichette = {
            pending: t("trasf_stato_pending"),
            accepted: t("trasf_stato_accepted"),
            rejected: t("trasf_stato_rejected"),
          };
          const colori = {
            pending: "var(--accent-gold)",
            accepted: "var(--accent-lime)",
            rejected: "var(--accent-red)",
          };
          return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">
        <div style="flex:1;min-width:140px">
          <div style="font-size:13px;color:var(--text-bright)">${esc(v ? v.nome : t("trasf_vendita_rimossa"))}</div>
          <div style="font-size:11px;color:var(--text-dim);word-break:break-all">${esc(tr.destinatario_email)}</div>
        </div>
        <div style="font-size:11px;font-weight:600;color:${colori[tr.stato]}">${etichette[tr.stato]}</div>
        ${tr.stato === "pending" ? `<button class="btn btn-ghost btn-sm trasf-ritira-btn" data-id="${tr.id}" style="color:var(--accent-red);border-color:var(--accent-red)">✖️ ${t("trasf_ritira")}</button>` : ""}
      </div>`;
        })
        .join("") +
      "</div>";
  }

  document.getElementById("main-content").innerHTML = html;
  bindTrasferimentiActions();
}

function bindTrasferimentiActions() {
  const mainEl = document.getElementById("main-content");
  if (!mainEl || mainEl.dataset.trasfBound) return;
  mainEl.dataset.trasfBound = "1";
  mainEl.addEventListener("click", function (e) {
    const okBtn = e.target.closest(".trasf-ok-btn");
    const noBtn = e.target.closest(".trasf-no-btn");
    const ritBtn = e.target.closest(".trasf-ritira-btn");
    if (okBtn) accettaTrasferimento(okBtn.dataset.id);
    if (noBtn) rifiutaTrasferimento(noBtn.dataset.id);
    if (ritBtn) ritiraTrasferimento(ritBtn.dataset.id);
  });
}

async function accettaTrasferimento(trasfId) {
  if (_trasfInFlight.has(trasfId)) return;
  const tr = _trasfRicevuti.find((x) => x.id === trasfId);
  if (!tr) return;
  const nome = (tr.payload && tr.payload.nome) || "";
  if (!confirm(t("trasf_conferma_accetta").replace("{NOME}", nome))) return;

  _trasfInFlight.add(trasfId);
  try {
    const out = await SB.accettaTrasferimento(trasfId);
    _trasfRicevuti = _trasfRicevuti.filter((x) => x.id !== trasfId);

    // Il serpente e i log sono stati creati server-side: ricarica per averli in cache
    // con gli id veri, invece di ricostruirli a mano dal payload.
    await loadAll();
    toast("🐍 " + t("trasf_accettato"));
    const nuovoId = out && out.snake_id;
    if (nuovoId && _snakes.some((s) => s.id === nuovoId))
      showPage("dettaglio", nuovoId);
    else showPage("serpenti");
  } catch (e) {
    const msg = traduciErroreTrasf(e.message);
    toast(msg, "#c0392b");
    if (String(e.message).trim() === "FREE_LIMIT") showUpgradeModal();
    // Su errore l'invito resta valido lato server: si ricarica per riallineare la UI.
    try {
      _trasfRicevuti = await SB.getTrasferimentiRicevuti();
    } catch (_) {}
    if (currentPage === "trasferimenti") renderTrasferimenti();
  } finally {
    _trasfInFlight.delete(trasfId);
    applyTrasferimentiUI();
  }
}

async function rifiutaTrasferimento(trasfId) {
  if (_trasfInFlight.has(trasfId)) return;
  const tr = _trasfRicevuti.find((x) => x.id === trasfId);
  if (!tr) return;
  const nome = (tr.payload && tr.payload.nome) || "";
  if (!confirm(t("trasf_conferma_rifiuta").replace("{NOME}", nome))) return;

  _trasfInFlight.add(trasfId);
  try {
    await SB.rifiutaTrasferimento(trasfId);
    _trasfRicevuti = _trasfRicevuti.filter((x) => x.id !== trasfId);
    toast(t("trasf_rifiutato"), "#c0392b");
    renderTrasferimenti();
  } catch (e) {
    toast(traduciErroreTrasf(e.message), "#c0392b");
  } finally {
    _trasfInFlight.delete(trasfId);
    applyTrasferimentiUI();
  }
}

// ═══════════════════════════════════════
//  PDF RESOCONTO VITA SERPENTE
// ═══════════════════════════════════════
async function printResoconto(vendutoId) {
  const v = _venduti.find((x) => x.id === vendutoId);
  if (!v) return;

  // Apri subito la tab (deve avvenire in modo sincrono nel click per non essere bloccata come popup)
  const win = window.open("about:blank", "_blank");
  if (!win) {
    toast(t("pdf_no_popup"), "#c0392b");
    return;
  }

  // Chiamato anche dalla lista Venduti, dove logs_snapshot non è precaricato — recupera al volo.
  if (!v.logs_snapshot) {
    win.document.body.style.cssText =
      "font-family:sans-serif;padding:40px;color:#333";
    win.document.body.textContent = "Caricamento…";
    try {
      const full = await SB.getVendutoFull(vendutoId);
      if (full) Object.assign(v, full);
    } catch (e) {
      win.document.body.textContent =
        "Errore nel caricamento dei dati: " + e.message;
      return;
    }
  }

  // Usa logs_snapshot salvato al momento della vendita
  const logs = v.logs_snapshot || [];
  const foodLogs = logs
    .filter((l) => l.tipo === "cibo")
    .sort((a, b) => a.data.localeCompare(b.data));
  const feciLogs = logs
    .filter((l) => l.tipo === "feci")
    .sort((a, b) => a.data.localeCompare(b.data));
  const eggsLogs = logs
    .filter((l) => l.tipo === "uova")
    .sort((a, b) => a.data.localeCompare(b.data));
  const totalCibo = foodLogs.reduce(
    (s, l) => s + (parseFloat(l.grammi) || 0),
    0,
  );

  // Calcola giorni in allevamento
  const dataIngresso = v.snake_created_at ? new Date(v.snake_created_at) : null;
  const dataVendita = new Date(v.data_vendita);
  const giorniAllevamento = dataIngresso
    ? Math.floor((dataVendita - dataIngresso) / 86400000)
    : null;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(BASE_URL + "#snake=" + v.snake_id)}&margin=2&color=0d1f0f&bgcolor=ffffff`;
  const dateLocale = _appLang === "it" ? "it-IT" : "en-GB";

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html lang="${_appLang}">
<head>
<meta charset="UTF-8">
<title>${t("pdf_resoconto_vita")} — ${esc(v.nome)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #111; background: white; font-size: 10pt; }
  @page { size: A4; margin: 15mm 12mm; }

  /* HEADER */
  .doc-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding-bottom: 5mm; border-bottom: 3px solid #1a3320; margin-bottom: 6mm;
  }
  .doc-title { font-family: 'Cinzel', serif; font-size: 22pt; color: #0d1f0f; font-weight: 700; }
  .doc-sub { font-size: 9pt; color: #888; margin-top: 2mm; }
  .doc-logo { font-size: 9pt; color: #888; text-align: right; }
  .doc-logo strong { display: block; font-family: 'Cinzel', serif; font-size: 13pt; color: #1a3320; }

  /* SEZIONE */
  .section { margin-bottom: 6mm; page-break-inside: avoid; }
  .section-title {
    font-family: 'Cinzel', serif; font-size: 11pt; color: #1a3320;
    border-bottom: 1.5px solid #6db56d; padding-bottom: 2mm; margin-bottom: 3mm;
    display: flex; align-items: center; gap: 6px;
  }

  /* GRIGLIA DATI */
  .data-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
  .data-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; }
  .data-field { background: #f8f8f8; border-radius: 2mm; padding: 2.5mm 3.5mm; }
  .data-field .lbl { font-size: 6.5pt; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 1mm; }
  .data-field .val { font-size: 10pt; font-weight: 700; color: #111; }
  .data-field .val.gold { color: #c9a84c; }
  .data-field .val.green { color: #1a3320; }

  /* HEADER SERPENTE */
  .snake-header { display: flex; gap: 5mm; align-items: flex-start; margin-bottom: 5mm; }
  .snake-header-info { flex: 1; }
  .snake-nome { font-family: 'Cinzel', serif; font-size: 20pt; color: #0d1f0f; }
  .snake-specie { font-size: 10pt; color: #555; font-style: italic; margin-top: 1mm; }
  .snake-icd { font-family: monospace; font-size: 9pt; color: #888; margin-top: 2mm; background: #f0f0f0; display: inline-block; padding: 1.5mm 3mm; border-radius: 2mm; }
  .sesso-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 9pt; font-weight: 700; margin-top: 2mm; margin-left: 3mm; }
  .sesso-M { background: rgba(91,155,213,0.15); color: #3a7ab5; border: 1px solid rgba(91,155,213,0.3); }
  .sesso-F { background: rgba(227,145,160,0.15); color: #c06070; border: 1px solid rgba(227,145,160,0.3); }

  /* STATISTICHE */
  .stats-row { display: flex; gap: 3mm; margin-bottom: 5mm; }
  .stat-box { flex: 1; background: #f8f8f8; border-radius: 2mm; padding: 3mm; text-align: center; border-left: 3px solid #6db56d; }
  .stat-box .sv { font-family: 'Cinzel', serif; font-size: 18pt; color: #1a3320; }
  .stat-box .sl { font-size: 6.5pt; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 1mm; }

  /* TABELLA LOG */
  .log-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .log-table th { background: #1a3320; color: white; padding: 2mm 3mm; text-align: left; font-weight: 600; font-size: 7.5pt; }
  .log-table td { padding: 2mm 3mm; border-bottom: 1px solid #eee; vertical-align: top; }
  .log-table tr:nth-child(even) td { background: #fafafa; }
  .log-table tr:last-child td { border-bottom: none; }

  /* VENDITA BOX */
  .vendita-box {
    background: linear-gradient(135deg, #0d1f0f, #1a3320);
    color: white; border-radius: 3mm; padding: 5mm 6mm;
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 5mm;
  }
  .vendita-box .vb-title { font-family: 'Cinzel', serif; font-size: 13pt; color: #c9a84c; }
  .vendita-box .vb-data { font-size: 9pt; color: #a8c8a0; margin-top: 1mm; }
  .vendita-box .vb-prezzo { font-family: 'Cinzel', serif; font-size: 22pt; color: #c9a84c; }

  /* FOOTER */
  .doc-footer {
    margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #ddd;
    display: flex; justify-content: space-between; font-size: 7pt; color: #bbb;
  }

  /* PULSANTI */
  .no-print { text-align: center; padding: 16px; background: #f9f9f9; border-bottom: 1px solid #eee; }
  .btn-print { background: #1a3320; color: white; border: none; padding: 12px 28px; font-size: 15px; border-radius: 8px; cursor: pointer; margin-right: 8px; font-family: 'Inter', sans-serif; }
  .btn-close { background: #eee; color: #333; border: none; padding: 12px 20px; font-size: 15px; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; }
  @media print { .no-print { display: none !important; } }
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨️ ${t("pdf_stampa_salva")}</button>
  <button class="btn-close" onclick="window.close()">✕ ${t("pdf_chiudi")}</button>
</div>

<div style="padding: 0">

  <!-- HEADER DOCUMENTO -->
  <div class="doc-header">
    <div>
      <div class="doc-title">${t("pdf_resoconto_esemplare")}</div>
      <div class="doc-sub">${t("pdf_storico_completo")} · ${t("pdf_generato_footer")} ${new Date().toLocaleDateString(dateLocale)}</div>
    </div>
    <div class="doc-logo">
      <strong>🐍 SnakeKeeper</strong>
      ${t("pdf_gestionale_sub")}
    </div>
  </div>

  <!-- ANAGRAFICA -->
  <div class="section">
    <div class="snake-header">
      <div class="snake-header-info">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:6px">
          <div class="snake-nome">${esc(v.nome)}</div>
          <span class="sesso-badge sesso-${esc(v.sesso)}">${v.sesso === "M" ? "♂ " + t("aggiungi_maschio") : "♀ " + t("aggiungi_femmina")}</span>
        </div>
        <div class="snake-specie">${esc(v.specie || "")}${v.morfo ? " · " + esc(v.morfo) : ""}</div>
        <div class="snake-icd">ICD: ${esc(v.icd)}</div>
      </div>
      <img src="${qrUrl}" width="80" height="80" style="border:1px solid #ddd;border-radius:2mm" />
    </div>

    <div class="data-grid">
      <div class="data-field"><span class="lbl">${t("lbl_data_nascita")}</span><span class="val">${fmtDate(v.nascita)}</span></div>
      <div class="data-field"><span class="lbl">${t("lbl_provenienza")}</span><span class="val">${esc(v.provenienza || "—")}</span></div>
      <div class="data-field"><span class="lbl">${t("pdf_peso_registrato")}</span><span class="val">${v.peso ? v.peso + "g" : "—"}</span></div>
      <div class="data-field"><span class="lbl">${t("pdf_ingresso_allevamento")}</span><span class="val">${dataIngresso ? dataIngresso.toLocaleDateString(dateLocale) : "—"}</span></div>
      <div class="data-field"><span class="lbl">${t("pdf_giorni_allevamento")}</span><span class="val green">${giorniAllevamento !== null ? giorniAllevamento + " " + t("pdf_giorni_suffix") : "—"}</span></div>
      <div class="data-field"><span class="lbl">${t("lbl_morfo")}</span><span class="val">${esc(v.morfo || "—")}</span></div>
    </div>
    ${v.note ? `<div style="background:#fffbf0;border-left:3px solid #c9a84c;padding:2.5mm 4mm;border-radius:0 2mm 2mm 0;margin-top:3mm;font-size:9pt;color:#555"><strong>${t("label_note")}:</strong> ${esc(v.note)}</div>` : ""}
  </div>

  <!-- STATISTICHE RIEPILOGO -->
  <div class="section">
    <div class="section-title">📊 ${t("pdf_riepilogo_attivita")}</div>
    <div class="stats-row">
      <div class="stat-box"><div class="sv">${foodLogs.length}</div><div class="sl">${t("pdf_pasti_totali")}</div></div>
      <div class="stat-box"><div class="sv">${totalCibo.toFixed(0)}g</div><div class="sl">${t("pdf_cibo_somministrato")}</div></div>
      <div class="stat-box"><div class="sv">${feciLogs.length}</div><div class="sl">${t("pdf_feci_registrate")}</div></div>
      ${v.sesso === "F" ? `<div class="stat-box"><div class="sv">${eggsLogs.length}</div><div class="sl">${t("pdf_deposizioni")}</div></div>` : ""}
      ${giorniAllevamento ? `<div class="stat-box"><div class="sv">${foodLogs.length > 0 ? (giorniAllevamento / foodLogs.length).toFixed(0) : "—"}</div><div class="sl">${t("pdf_giorni_tra_pasti")}</div></div>` : ""}
    </div>
  </div>

  <!-- STORICO ALIMENTAZIONE -->
  ${
    foodLogs.length > 0
      ? `
  <div class="section">
    <div class="section-title">🥩 ${t("pdf_storico_pasti")}</div>
    <table class="log-table">
      <thead>
        <tr>
          <th>${t("pdf_col_data")}</th><th>${t("tipo_cibo")}</th><th>${t("pdf_col_qty")}</th><th>${t("pdf_col_peso")} (g)</th><th>${t("pdf_col_note")}</th>
        </tr>
      </thead>
      <tbody>
        ${foodLogs
          .map(
            (l) => `<tr>
          <td>${fmtDate(l.data)}</td>
          <td>${esc(l.food_tipo) || "—"}</td>
          <td style="text-align:center">${l.qty || 1}</td>
          <td style="text-align:center">${l.grammi || "—"}</td>
          <td style="color:#888">${esc(l.note || "")}</td>
        </tr>`,
          )
          .join("")}
        <tr style="background:#f0f7f0">
          <td colspan="3"><strong>${t("pdf_totale")}</strong></td>
          <td style="text-align:center"><strong>${totalCibo.toFixed(0)}g</strong></td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>`
      : ""
  }

  <!-- STORICO FECI -->
  ${
    feciLogs.length > 0
      ? `
  <div class="section">
    <div class="section-title">💩 ${t("pdf_storico_feci")}</div>
    <table class="log-table">
      <thead><tr><th>${t("pdf_col_data")}</th><th>${t("consistenza")}</th><th>${t("pdf_col_note")}</th></tr></thead>
      <tbody>
        ${feciLogs
          .map(
            (l) => `<tr>
          <td>${fmtDate(l.data)}</td>
          <td>${esc(l.feci_tipo) || "—"}</td>
          <td style="color:#888">${esc(l.note || "")}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`
      : ""
  }

  <!-- STORICO DEPOSIZIONI (solo femmine) -->
  ${
    v.sesso === "F" && eggsLogs.length > 0
      ? `
  <div class="section">
    <div class="section-title">🥚 ${t("pdf_deposizioni")}</div>
    <table class="log-table">
      <thead><tr><th>${t("pdf_col_data")}</th><th>${t("pdf_uova_deposte")}</th><th>${t("pdf_col_fertili")}</th><th>${t("pdf_temp_c")}</th><th>${t("pdf_col_note")}</th></tr></thead>
      <tbody>
        ${eggsLogs
          .map(
            (l) => `<tr>
          <td>${fmtDate(l.data)}</td>
          <td style="text-align:center">${l.num_uova || "—"}</td>
          <td style="text-align:center">${l.fertili || "—"}</td>
          <td style="text-align:center">${l.temp || "—"}</td>
          <td style="color:#888">${esc(l.note || "")}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`
      : ""
  }

  <!-- BOX VENDITA -->
  <div class="section">
    <div class="section-title">💰 ${t("pdf_dettagli_vendita")}</div>
    <div class="vendita-box">
      <div>
        <div class="vb-title">${t("dv_venduto_il")} ${fmtDate(v.data_vendita)}</div>
        <div class="vb-data">${t("venduti_acquirente")}: ${esc(v.acquirente) || t("dv_non_specificato")}</div>
        ${v.note_vendita ? `<div class="vb-data">${t("label_note")}: ${esc(v.note_vendita)}</div>` : ""}
      </div>
      <div class="vb-prezzo">${v.prezzo ? "€" + parseFloat(v.prezzo).toFixed(2) : "N/D"}</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="doc-footer">
    <span>SnakeKeeper — ${t("pdf_gestionale_sub")}</span>
    <span>ICD: ${esc(v.icd)} · ${t("pdf_doc_generato")} ${new Date().toLocaleDateString(dateLocale)}</span>
  </div>

</div>
</body>
</html>`);
  win.document.close();
}

// ═══════════════════════════════════════
//  REGISTRO GLOBALE
// ═══════════════════════════════════════
function renderRegistro() {
  const logs = [..._recentLogs]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 80);
  const snakeMap = {};
  _snakes.forEach((s) => (snakeMap[s.id] = s));
  const icons = { cibo: "🥩", feci: "💩", uova: "🥚", pulizia: "🧹" };
  const types = {
    cibo: "food",
    feci: "feci",
    uova: "eggs",
    pulizia: "pulizia",
  };
  let html = `<div class="page-header"><h2>📋 ${t("registro_title")}</h2><p>${t("registro_ultime").replace("{N}", logs.length)}</p></div><div class="card">`;
  if (!logs.length) {
    html += `<div class="empty-state"><div class="empty-icon">📋</div><h3>${t("registro_empty_title")}</h3><p>${t("registro_empty_desc")}</p></div>`;
  } else {
    logs.forEach((l) => {
      const snake = snakeMap[l.snake_id];
      const sname = snake ? snake.nome : "?";
      let desc = "";
      // Stesso motivo di renderLogList: colonne text scrivibili via POST diretta e
      // trasferibili a un altro account. Vedi il commento esteso in renderLogList.
      if (l.tipo === "cibo")
        desc = `${esc(l.food_tipo) || t("log_cibo_default")} ×${l.qty || 1} — ${l.grammi || 0}g`;
      if (l.tipo === "feci")
        desc = `${t("log_feci_prefix")}${esc(l.feci_tipo) || "—"}`;
      if (l.tipo === "uova")
        desc = `${t("log_deposizione_prefix")}${l.num_uova || 0} ${t("log_uova_desc")}`;
      if (l.tipo === "pulizia")
        desc = `${t("log_pulizia_prefix")}${esc(l.pulizia_tipo) || "—"}`;
      html += `<div class="log-entry">
        <div class="log-icon ${types[l.tipo] || "food"}">${icons[l.tipo] || "📌"}</div>
        <div class="log-info">
          <div class="log-date">${fmtDate(l.data)} · <span style="color:var(--accent-lime);cursor:pointer" onclick="showPage('dettaglio','${l.snake_id}')">${esc(sname)}</span></div>
          <div class="log-desc">${desc}${l.note ? ` · ${esc(l.note)}` : ""}</div>
        </div>
      </div>`;
    });
  }
  html += "</div>";
  document.getElementById("main-content").innerHTML = html;
}

// ═══════════════════════════════════════
//  STAMPA ETICHETTA + QR — NUOVA FINESTRA
// ═══════════════════════════════════════
// ── PDF SCHEDA SERPENTE (Pro Feature) ──
function printSchedaSerpente(snakeId) {
  if (!isPro()) {
    showUpgradeModal();
    return;
  }
  const snake = _snakes.find((s) => s.id === snakeId);
  if (!snake) return;
  const logs = logsForSnake(snake.id);
  const foodLogs = logs
    .filter((l) => l.tipo === "cibo")
    .sort((a, b) => a.data.localeCompare(b.data));
  const feciLogs = logs
    .filter((l) => l.tipo === "feci")
    .sort((a, b) => a.data.localeCompare(b.data));
  const mutaLogs = logs
    .filter((l) => l.tipo === "muta")
    .sort((a, b) => a.data.localeCompare(b.data));
  const pesoLogs = logs
    .filter((l) => l.tipo === "peso")
    .sort((a, b) => a.data.localeCompare(b.data));
  const eggsLogs = logs
    .filter((l) => l.tipo === "uova")
    .sort((a, b) => a.data.localeCompare(b.data));
  const totalCibo = foodLogs.reduce(
    (s, l) => s + (parseFloat(l.grammi) || 0),
    0,
  );

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(BASE_URL + "#snake=" + snake.id)}&margin=2&color=0d1f0f&bgcolor=ffffff`;
  const dateLocale = _appLang === "it" ? "it-IT" : "en-GB";
  const today = new Date().toLocaleDateString(dateLocale);

  const makeTable = (title, icon, rows, headers) => {
    if (!rows.length) return "";
    return `<div class="section"><div class="sec-title">${icon} ${title} (${rows.length})</div>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  };

  const win = window.open("about:blank", "_blank");
  if (!win) {
    toast(t("pdf_no_popup"), "#c0392b");
    return;
  }
  win.document
    .write(`<!DOCTYPE html><html lang="${_appLang}"><head><meta charset="UTF-8">
<title>${t("pdf_scheda_titolo_tab")} — ${esc(snake.nome)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #111; background: white; font-size: 10pt; padding: 12mm; }
  @page { size: A4; margin: 15mm 12mm; }
  .doc-header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:5mm; border-bottom:3px solid #1a3320; margin-bottom:6mm; }
  .doc-title { font-family:'Cinzel',serif; font-size:22pt; color:#0d1f0f; font-weight:700; }
  .doc-sub { font-size:9pt; color:#666; margin-top:2mm; }
  .badge { display:inline-block; padding:2px 10px; border-radius:20px; font-size:9pt; font-weight:600; }
  .badge-M { background:#e3f0fb; color:#2b6cb0; }
  .badge-F { background:#fce4ec; color:#c0392b; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:3mm; margin-bottom:6mm; }
  .info-item { background:#f5f8f5; border-radius:3mm; padding:3mm; }
  .info-label { font-size:7pt; color:#888; text-transform:uppercase; letter-spacing:0.5px; }
  .info-value { font-size:10pt; font-weight:500; margin-top:1mm; }
  .section { margin-bottom:5mm; break-inside:avoid; }
  .sec-title { font-family:'Cinzel',serif; font-size:12pt; color:#1a3320; margin-bottom:2mm; padding-bottom:1mm; border-bottom:1px solid #ddd; }
  table { width:100%; border-collapse:collapse; font-size:9pt; margin-top:2mm; }
  th { text-align:left; padding:2mm; background:#f0f4f0; color:#555; font-weight:500; font-size:8pt; text-transform:uppercase; letter-spacing:0.3px; border-bottom:1px solid #ddd; }
  td { padding:2mm; border-bottom:1px solid #eee; }
  .stats-row { display:flex; gap:3mm; margin-bottom:5mm; }
  .stat-box { flex:1; background:#f5f8f5; border-radius:3mm; padding:3mm; text-align:center; }
  .stat-num { font-size:16pt; font-weight:700; color:#1a3320; }
  .stat-lbl { font-size:7pt; color:#888; text-transform:uppercase; }
  .footer { margin-top:8mm; padding-top:3mm; border-top:1px solid #ddd; display:flex; justify-content:space-between; align-items:center; font-size:8pt; color:#999; }
  .foto-circle { width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #1a3320; }
  @media print { body { padding:0; } }
</style></head><body>
<div class="doc-header">
  <div style="display:flex;align-items:center;gap:4mm">
    ${_userLogo ? `<img src="${_userLogo}" style="width:16mm;height:16mm;object-fit:contain" alt="Logo">` : ""}
    <div>
      <div class="doc-title">${t("pdf_scheda_serpente")}</div>
      <div class="doc-sub">${t("pdf_doc_generato")} ${today} — SnakeKeeper</div>
    </div>
  </div>
  <div style="text-align:right">
    ${snake.foto_url ? `<img src="${esc(snake.foto_url)}" class="foto-circle">` : ""}
    <img src="${qrUrl}" style="width:50px;height:50px;margin-left:8px" alt="QR">
  </div>
</div>

<div class="info-grid">
  ${[
    [t("lbl_nome"), snake.nome],
    [t("lbl_specie"), snake.specie || "—"],
    [t("lbl_morfo"), snake.morfo || "—"],
    [
      t("lbl_sesso"),
      snake.sesso === "M"
        ? "♂ " + t("aggiungi_maschio")
        : "♀ " + t("aggiungi_femmina"),
    ],
    [
      t("lbl_data_nascita"),
      snake.nascita
        ? new Date(snake.nascita).toLocaleDateString(dateLocale)
        : "—",
    ],
    [t("serpenti_eta"), age(snake.nascita)],
    [t("pdf_peso_attuale"), snake.peso ? snake.peso + "g" : "—"],
    [t("lbl_provenienza"), snake.provenienza || "—"],
    [t("lbl_icd"), snake.icd],
    [
      t("gen_padre"),
      (() => {
        const p = snake.padre_id
          ? _snakes.find((s) => s.id === snake.padre_id)
          : null;
        if (p) {
          const st = [p.specie, p.morfo].filter(Boolean).join(", ");
          return p.nome + (st ? ` (${st})` : "");
        }
        return snake.padre_esterno || "—";
      })(),
    ],
    [
      t("gen_madre"),
      (() => {
        const m = snake.madre_id
          ? _snakes.find((s) => s.id === snake.madre_id)
          : null;
        if (m) {
          const st = [m.specie, m.morfo].filter(Boolean).join(", ");
          return m.nome + (st ? ` (${st})` : "");
        }
        return snake.madre_esterna || "—";
      })(),
    ],
    [t("gen_genetica"), snake.genetica || "—"],
  ]
    .map(
      ([k, v]) =>
        `<div class="info-item"><div class="info-label">${k}</div><div class="info-value">${esc(v)}</div></div>`,
    )
    .join("")}
</div>

<div class="stats-row">
  ${[
    [t("pdf_pasti_tot"), foodLogs.length],
    [t("det_cibo_tot"), totalCibo.toFixed(0) + "g"],
    [t("det_feci"), feciLogs.length],
    [t("det_mute"), mutaLogs.length],
    [t("pdf_pesate"), pesoLogs.length],
    ...(snake.sesso === "F" ? [[t("pdf_deposizioni"), eggsLogs.length]] : []),
  ]
    .map(
      ([l, v]) =>
        `<div class="stat-box"><div class="stat-num">${v}</div><div class="stat-lbl">${l}</div></div>`,
    )
    .join("")}
</div>

${snake.note ? `<div class="section"><div class="sec-title">📝 ${t("label_note")}</div><p style="font-size:10pt;color:#444;margin-top:2mm">${esc(snake.note)}</p></div>` : ""}

${makeTable(
  t("pdf_storico_pasti"),
  "🥩",
  foodLogs.map((l) => [
    new Date(l.data).toLocaleDateString(dateLocale),
    esc(l.food_tipo) || t("log_cibo_default"),
    (l.grammi || 0) + "g",
    "×" + (l.qty || 1),
    esc(l.note) || "",
  ]),
  [
    t("pdf_col_data"),
    t("pdf_col_tipo"),
    t("pdf_col_peso"),
    t("pdf_col_qty"),
    t("pdf_col_note"),
  ],
)}
${makeTable(
  t("pdf_storico_mute"),
  "🦎",
  mutaLogs.map((l) => [
    new Date(l.data).toLocaleDateString(dateLocale),
    esc(l.feci_tipo) || t("muta_completa"),
    esc(l.note) || "",
  ]),
  [t("pdf_col_data"), t("pdf_col_esito"), t("pdf_col_note")],
)}
${makeTable(
  t("pdf_storico_peso"),
  "⚖️",
  pesoLogs.map((l) => [
    new Date(l.data).toLocaleDateString(dateLocale),
    (l.grammi || 0) + "g",
    esc(l.note) || "",
  ]),
  [t("pdf_col_data"), t("pdf_col_peso"), t("pdf_col_note")],
)}
${makeTable(
  t("pdf_storico_feci"),
  "💩",
  feciLogs.map((l) => [
    new Date(l.data).toLocaleDateString(dateLocale),
    esc(l.feci_tipo) || "—",
    esc(l.note) || "",
  ]),
  [t("pdf_col_data"), t("pdf_col_tipo"), t("pdf_col_note")],
)}
${
  snake.sesso === "F"
    ? makeTable(
        t("pdf_deposizioni"),
        "🥚",
        eggsLogs.map((l) => [
          new Date(l.data).toLocaleDateString(dateLocale),
          l.num_uova || 0,
          l.fertili || 0,
          l.temp ? l.temp + "°C" : "—",
          esc(l.note) || "",
        ]),
        [
          t("pdf_col_data"),
          t("pdf_col_uova"),
          t("pdf_col_fertili"),
          t("pdf_col_temp"),
          t("pdf_col_note"),
        ],
      )
    : ""
}

<div class="footer">
  <div>SnakeKeeper — ${t("pdf_gestionale_sub")}<br>snakekeeper.it</div>
  <div style="text-align:right">ICD: ${esc(snake.icd)}<br>${t("pdf_generato_footer")} ${today}</div>
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 600);
}

function printLabel(id) {
  const snake = _snakes.find((s) => s.id === id);
  if (!snake) return;

  const url = BASE_URL + "#snake=" + snake.id;
  const qrSmallUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" +
    encodeURIComponent(url) +
    "&margin=2&color=0d1f0f&bgcolor=ffffff";
  const qrLargeUrl =
    "https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=" +
    encodeURIComponent(url) +
    "&margin=4&color=0d1f0f&bgcolor=ffffff";

  const printHTML = `<!DOCTYPE html>
<html lang="${_appLang}">
<head>
<meta charset="UTF-8">
<title>${_appLang === "it" ? "Etichetta" : "Label"} — ${esc(snake.nome)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: white; font-family: 'Inter', Arial, sans-serif; color: #111; }

  @page { size: A4; margin: 10mm; }

  /* ── LAYOUT PAGINA UNICA ── */
  .page {
    width: 190mm;
    min-height: 267mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
  }

  /* ── INTESTAZIONE ── */
  .header {
    width: 100%;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid #1a3320;
    padding-bottom: 3mm; margin-bottom: 6mm;
  }
  .header-logo { font-family: 'Cinzel', serif; font-size: 14pt; color: #1a3320; font-weight: 700; }
  .header-sub { font-size: 7pt; color: #aaa; text-align: right; }

  /* ── LAYOUT 2 COLONNE ── */
  .two-col {
    width: 100%;
    display: flex; gap: 8mm; align-items: flex-start;
    margin-bottom: 0;
  }

  /* ── COLONNA SINISTRA: QR GRANDE ── */
  .col-qr {
    display: flex; flex-direction: column; align-items: center;
    flex-shrink: 0;
  }
  .col-qr-label { font-size: 6.5pt; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2mm; }
  .qr-border {
    border: 2px dashed #6db56d; border-radius: 3mm;
    padding: 4mm; display: inline-flex; flex-direction: column; align-items: center;
  }
  .qr-border img { display: block; width: 65mm; height: 65mm; }
  .qr-icd { font-family: monospace; font-size: 7pt; color: #555; margin-top: 2mm; letter-spacing: 1px; }
  .qr-hint { font-size: 6pt; color: #aaa; margin-top: 1.5mm; text-align: center; max-width: 70mm; line-height: 1.5; }

  /* ── COLONNA DESTRA: DATI SERPENTE ── */
  .col-info { flex: 1; }
  .snake-nome { font-family: 'Cinzel', serif; font-size: 28pt; font-weight: 700; color: #0d1f0f; line-height: 1.1; }
  .snake-sesso { font-size: 20pt; font-weight: 400; color: #555; }
  .snake-specie { font-size: 10pt; color: #555; font-style: italic; margin-top: 1.5mm; margin-bottom: 5mm; }
  .dati-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 5mm; margin-bottom: 5mm; }
  .dati-field .lbl { display: block; font-size: 6.5pt; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .dati-field .val { display: block; font-size: 11pt; font-weight: 700; color: #111; margin-top: 0.5mm; }
  .icd-box {
    background: #f5f5f5; border-radius: 2mm; padding: 2.5mm 4mm;
    display: inline-flex; align-items: center; gap: 3mm; margin-top: 2mm;
  }
  .icd-box .lbl { font-size: 6pt; color: #aaa; text-transform: uppercase; letter-spacing: 0.5px; }
  .icd-box .val { font-family: monospace; font-size: 11pt; font-weight: 700; color: #1a3320; letter-spacing: 1.5px; }

  /* ── DIVISORE ── */
  .divider {
    width: 100%; border: none; border-top: 1px dashed #ddd;
    margin: 6mm 0;
  }

  /* ── ETICHETTA TECA ── */
  .teca-section-label { font-size: 7pt; color: #aaa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3mm; }
  .teca-label {
    width: 100mm; height: 58mm;
    border: 2px solid #1a3320;
    border-radius: 3mm;
    padding: 3mm 3.5mm;
    display: flex; gap: 2.5mm; align-items: stretch;
    background: white;
    box-shadow: 0 0 0 1.5mm #6db56d inset;
    position: relative;
  }
  .teca-logo {
    position: absolute; top: 2.5mm; right: 2.5mm;
    width: 26mm; height: 26mm; object-fit: contain;
    background: white; border-radius: 2mm;
    border: 1px solid #eee;
  }
  .teca-qr-box { flex-shrink: 0; width: 35mm; display: flex; align-items: center; justify-content: center; }
  .teca-qr-box img { width: 35mm; height: 35mm; display: block; }
  .teca-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; padding-right: 29mm; }
  .teca-nome { font-family: 'Cinzel', serif; font-size: 12pt; font-weight: 700; color: #0d1f0f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .teca-specie-s { font-size: 6.5pt; color: #555; font-style: italic; margin-top: 0.5mm; }
  .teca-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 2mm; margin-top: 1mm; }
  .teca-field .lbl { display: block; font-size: 5pt; color: #aaa; text-transform: uppercase; }
  .teca-field .val { display: block; font-size: 7pt; font-weight: 700; color: #111; }
  .teca-icd { font-family: monospace; font-size: 5.5pt; color: #ccc; margin-top: 1mm; }
  .teca-scan { font-size: 5pt; color: #bbb; }

  /* ── FOOTER ── */
  .footer {
    width: 100%; margin-top: auto; padding-top: 4mm;
    border-top: 1px solid #eee;
    display: flex; justify-content: space-between; align-items: center;
  }
  .footer-text { font-size: 6pt; color: #ccc; }

  /* ── PULSANTI (nascosti in stampa) ── */
  .no-print { text-align: center; padding: 16px; background: #f9f9f9; border-bottom: 1px solid #eee; }
  .btn-print { background: #1a3320; color: white; border: none; padding: 12px 28px; font-size: 15px; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; margin-right: 8px; }
  .btn-close { background: #eee; color: #333; border: none; padding: 12px 20px; font-size: 15px; border-radius: 8px; cursor: pointer; font-family: 'Inter', sans-serif; }

  @media print {
    .no-print { display: none !important; }
    body { background: white !important; }
    .page { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="no-print">
  <button class="btn-print" onclick="window.print()">🖨️ ${t("pdf_stampa_salva")}</button>
  <button class="btn-close" onclick="window.close()">✕ ${t("pdf_chiudi")}</button>
</div>

<div class="page">

  <!-- INTESTAZIONE -->
  <div class="header">
    <div class="header-logo">🐍 SnakeKeeper</div>
    <div class="header-sub">${t("pdf_gestionale_sub")}<br>${t("pdf_scheda_esemplare")}</div>
  </div>

  <!-- 2 COLONNE: QR GRANDE + DATI -->
  <div class="two-col">

    <!-- QR GRANDE -->
    <div class="col-qr">
      <div class="col-qr-label">${t("pdf_scansiona_apri")}</div>
      <div class="qr-border">
        <img src="${qrLargeUrl}" alt="QR Code" />
        <div class="qr-icd">${esc(snake.icd)}</div>
      </div>
      <div class="qr-hint">${t("pdf_inquadra_camera")}</div>
    </div>

    <!-- DATI SERPENTE -->
    <div class="col-info">
      <div class="snake-nome">${esc(snake.nome)} <span class="snake-sesso">${snake.sesso === "M" ? "♂" : "♀"}</span></div>
      <div class="snake-specie">${esc(snake.specie || "")}${snake.morfo ? " · " + esc(snake.morfo) : ""}</div>
      <div class="dati-grid">
        <div class="dati-field">
          <span class="lbl">${t("lbl_sesso")}</span>
          <span class="val">${snake.sesso === "M" ? t("aggiungi_maschio") : t("aggiungi_femmina")}</span>
        </div>
        <div class="dati-field">
          <span class="lbl">${t("lbl_data_nascita")}</span>
          <span class="val">${fmtDate(snake.nascita)}</span>
        </div>
        ${snake.peso ? `<div class="dati-field"><span class="lbl">${t("lbl_peso")}</span><span class="val">${snake.peso}g</span></div>` : ""}
        ${snake.provenienza ? `<div class="dati-field"><span class="lbl">${t("lbl_provenienza")}</span><span class="val" style="font-size:9pt">${esc(snake.provenienza)}</span></div>` : ""}
        ${snake.morfo ? `<div class="dati-field"><span class="lbl">${t("lbl_morfo")}</span><span class="val">${esc(snake.morfo)}</span></div>` : ""}
        ${snake.specie ? `<div class="dati-field"><span class="lbl">${t("lbl_specie")}</span><span class="val" style="font-size:9pt;font-style:italic">${esc(snake.specie)}</span></div>` : ""}
      </div>
      <div class="icd-box">
        <div><div class="lbl">${t("lbl_icd")}</div><div class="val">${esc(snake.icd)}</div></div>
      </div>
    </div>
  </div>

  <hr class="divider">

  <!-- ETICHETTA TECA PICCOLA -->
  <div style="width:100%">
    <div class="teca-section-label">${t("pdf_ritaglia_prefix")} (100×58mm)</div>
    <div class="teca-label">
      ${_userLogo ? `<img class="teca-logo" src="${_userLogo}" alt="Logo">` : ""}
      <div class="teca-qr-box">
        <img src="${qrSmallUrl}" alt="QR" />
      </div>
      <div class="teca-info">
        <div>
          <div class="teca-nome">${esc(snake.nome)} ${snake.sesso === "M" ? "♂" : "♀"}</div>
          <div class="teca-specie-s">${esc(snake.specie || "")}${snake.morfo ? " · " + esc(snake.morfo) : ""}</div>
        </div>
        <div class="teca-grid">
          <div class="teca-field"><span class="lbl">${t("lbl_sesso")}</span><span class="val">${snake.sesso === "M" ? t("aggiungi_maschio") : t("aggiungi_femmina")}</span></div>
          <div class="teca-field"><span class="lbl">${t("pdf_nascita_short")}</span><span class="val">${fmtDate(snake.nascita)}</span></div>
          ${snake.peso ? `<div class="teca-field"><span class="lbl">${t("lbl_peso")}</span><span class="val">${snake.peso}g</span></div>` : ""}
          ${snake.provenienza ? `<div class="teca-field"><span class="lbl">${t("lbl_provenienza")}</span><span class="val">${esc(snake.provenienza)}</span></div>` : ""}
        </div>
        <div>
          <div class="teca-icd">ICD: ${esc(snake.icd)}</div>
          <div class="teca-scan">📷 ${t("pdf_scansiona_qr")}</div>
        </div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-text">SnakeKeeper — ${t("pdf_gestionale_sub")}</div>
    <div class="footer-text">${t("pdf_generato_footer")} ${new Date().toLocaleDateString(_appLang === "it" ? "it-IT" : "en-GB")}</div>
  </div>

</div>
</body>
</html>`;

  // Apri in nuova finestra
  const win = window.open("", "_blank", "width=800,height=900");
  win.document.write(printHTML);
  win.document.close();
}

// ═══════════════════════════════════════
//  HASH ROUTING
// ═══════════════════════════════════════
function checkHash() {
  const hash = window.location.hash;
  if (hash.startsWith("#snake=")) {
    const id = hash.replace("#snake=", "");
    if (_snakes.find((s) => s.id === id)) {
      showPage("dettaglio", id);
      return true;
    }
  }
  return false;
}
window.addEventListener("hashchange", checkHash);

// Swipe gesture drawer — trascinamento 1:1 col dito, rubber-band ai bordi, rilascio deciso dalla velocità (apple-design §2/§6/§9)
(function () {
  const DRAWER_W = 280;
  const drawer = document.getElementById("mobile-drawer");
  const overlay = document.getElementById("drawer-overlay");
  let mode = "idle"; // 'idle' | 'pending' | 'dragging'
  let pointerId = null,
    startX = 0,
    startY = 0,
    curTranslate = DRAWER_W;
  let lastX = 0,
    lastT = 0,
    velocity = 0;

  function rubberband(overshoot, dim, k) {
    return (overshoot * dim * k) / (dim + k * Math.abs(overshoot));
  }
  function clampWithRubberband(x) {
    if (x < 0) return rubberband(x, DRAWER_W, 0.55);
    if (x > DRAWER_W)
      return DRAWER_W + rubberband(x - DRAWER_W, DRAWER_W, 0.55);
    return x;
  }
  function applyTranslate(x) {
    curTranslate = x;
    drawer.style.transform = "translateX(" + x + "px)";
    overlay.style.opacity = String(Math.max(0, Math.min(1, x / DRAWER_W)));
  }
  function settle(open) {
    drawer.style.transition = "";
    overlay.style.transition = "";
    drawer.style.transform = "";
    overlay.style.opacity = "";
    if (open) openDrawer();
    else closeDrawer();
  }
  function onDown(e) {
    if (!drawer.classList.contains("open") || mode !== "idle") return;
    mode = "pending";
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    curTranslate = DRAWER_W;
    lastX = startX;
    lastT = performance.now();
    velocity = 0;
  }
  function onMove(e) {
    if (mode === "idle" || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (mode === "pending") {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // hysteresis prima di impegnarsi in una direzione
      if (Math.abs(dy) > Math.abs(dx)) {
        mode = "idle";
        return;
      } // era uno scroll verticale nel drawer, non un drag
      mode = "dragging";
      try {
        drawer.setPointerCapture(pointerId);
      } catch (err) {}
      drawer.style.transition = "none";
      overlay.style.transition = "none";
    }
    const now = performance.now();
    applyTranslate(clampWithRubberband(DRAWER_W + dx));
    const dt = now - lastT;
    if (dt > 0) velocity = ((e.clientX - lastX) / dt) * 1000; // px/s
    lastX = e.clientX;
    lastT = now;
    e.preventDefault();
  }
  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    if (mode === "dragging") {
      const shouldOpen =
        velocity < -300
          ? false
          : velocity > 300
            ? true
            : curTranslate > DRAWER_W / 2;
      settle(shouldOpen);
    }
    mode = "idle";
    pointerId = null;
  }
  drawer.addEventListener("pointerdown", onDown);
  drawer.addEventListener("pointermove", onMove, { passive: false });
  drawer.addEventListener("pointerup", onUp);
  drawer.addEventListener("pointercancel", onUp);
})();

// ═══════════════════════════════════════
//  SERVICE WORKER + OFFLINE SYNC
// ═══════════════════════════════════════

// ═══════════════════════════════════════
//  LANDING PAGE JS
// ═══════════════════════════════════════
function smoothScrollTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleFaq(i) {
  const ans = document.getElementById("faq-ans-" + i);
  const icon = document.getElementById("faq-icon-" + i);
  if (!ans) return;
  const isOpen = ans.classList.contains("open");
  document
    .querySelectorAll(".lp-faq-a")
    .forEach((a) => a.classList.remove("open"));
  document
    .querySelectorAll(".lp-faq-icon")
    .forEach((ic) => (ic.textContent = "+"));
  if (!isOpen) {
    ans.classList.add("open");
    if (icon) icon.textContent = "−";
  }
}

function initParticles() {
  const canvas = document.getElementById("lp-particles");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W,
    H,
    particles = [];
  function resize() {
    W = canvas.width = canvas.parentElement?.offsetWidth || window.innerWidth;
    H = canvas.height =
      canvas.parentElement?.offsetHeight || window.innerHeight;
    if (W === 0) W = canvas.width = window.innerWidth;
    if (H === 0) H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.4 + 0.1,
      c: Math.random() > 0.5 ? "#4ade80" : "#c9a84c",
    });
  }
  let running = true;
  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = p.o;
      ctx.fill();
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }
  draw();
}

function initFeatureShowcaseScroll() {
  const showcase = document.getElementById("lp-showcase");
  if (!showcase) return;
  const items = showcase.querySelectorAll(".lp-showcase-item");
  const slides = showcase.querySelectorAll(".device-slide");
  if (!items.length || !slides.length) return;
  const setActive = (idx) => {
    items.forEach((it) =>
      it.classList.toggle("is-active", it.dataset.slide === String(idx)),
    );
    slides.forEach((sl) =>
      sl.classList.toggle("is-active", sl.dataset.slide === String(idx)),
    );
  };
  // Fascia sottile che fa da "trigger": solo l'item che la attraversa è attivo, evita
  // ambiguità quando più card sono parzialmente visibili insieme (apple-design §7/§8).
  // Su desktop il dispositivo è centrato nel viewport → fascia al centro (50%).
  // Su mobile/tablet il dispositivo è fisso in alto (sticky) e il testo scorre sotto:
  // la fascia va spostata più in basso, nella zona di lettura effettivamente visibile.
  let observer = null;
  const setupObserver = () => {
    if (observer) observer.disconnect();
    const mobile = window.matchMedia("(max-width: 1024px)").matches;
    const rootMargin = mobile ? "-60% 0px -35% 0px" : "-45% 0px -45% 0px";
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.dataset.slide);
        });
      },
      { threshold: 0, rootMargin },
    );
    items.forEach((it) => observer.observe(it));
  };
  setupObserver();
  let resizeT;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(setupObserver, 200);
  });
}

function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("visible");
      });
    },
    { threshold: 0.1 },
  );
  document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
}

function initLandingNav() {
  const nav = document.getElementById("lp-nav");
  const landing = document.getElementById("landing-page");
  if (!nav || !landing) return;
  landing.addEventListener("scroll", () => {
    nav.style.boxShadow =
      landing.scrollTop > 50 ? "0 4px 30px rgba(0,0,0,0.4)" : "";
    closeMobileNav();
  });
}

// ── MENU MOBILE (sheet ancorato all'hamburger, coerente all'apertura/chiusura) ──
function toggleMobileNav() {
  const sheet = document.getElementById("lp-mobile-sheet");
  const btn = document.getElementById("lp-hamburger");
  if (!sheet || !btn) return;
  const open = sheet.classList.toggle("open");
  btn.classList.toggle("open", open);
  btn.setAttribute("aria-expanded", open ? "true" : "false");
}

function closeMobileNav() {
  const sheet = document.getElementById("lp-mobile-sheet");
  const btn = document.getElementById("lp-hamburger");
  if (!sheet || !btn) return;
  sheet.classList.remove("open");
  btn.classList.remove("open");
  btn.setAttribute("aria-expanded", "false");
}

function mobileNavGo(id) {
  closeMobileNav();
  smoothScrollTo(id);
}

function initLanding() {
  initParticles();
  initFeatureShowcaseScroll();
  initScrollReveal();
  initLandingNav();
}

// ═══════════════════════════════════════
//  COOKIE BANNER GDPR
// ═══════════════════════════════════════
const COOKIE_KEY = "sk_cookie_consent";

function initCookieBanner() {
  try {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Prima visita — mostra il banner
      const banner = document.getElementById("cookie-banner");
      if (banner) {
        banner.style.display = "block";
      }
    } else {
      applyCookiePrefs(JSON.parse(consent));
    }
  } catch (e) {
    // Safari privata o localStorage non disponibile — mostra sempre il banner
    const banner = document.getElementById("cookie-banner");
    if (banner) banner.style.display = "block";
  }
}

let _stripeEnabled = true;

function toggleCookieStripe() {
  _stripeEnabled = !_stripeEnabled;
  const toggle = document.getElementById("stripe-toggle");
  const dot = document.getElementById("stripe-toggle-dot");
  if (_stripeEnabled) {
    toggle.style.background = "var(--accent-gold)";
    toggle.style.justifyContent = "flex-end";
    dot.style.background = "#0a1a0a";
  } else {
    toggle.style.background = "var(--bg-card)";
    toggle.style.justifyContent = "flex-start";
    dot.style.background = "var(--text-dim)";
  }
}

function cookieChoice(type) {
  const prefs = {
    essential: true,
    stripe: type === "all" ? true : _stripeEnabled,
    timestamp: Date.now(),
    version: "1.0",
  };
  try {
    localStorage.setItem(COOKIE_KEY, JSON.stringify(prefs));
  } catch (e) {
    // localStorage non disponibile (Safari privata) — ignora
  }
  applyCookiePrefs(prefs);
  const banner = document.getElementById("cookie-banner");
  if (banner) {
    banner.style.transition = "transform .3s ease, opacity .3s ease";
    banner.style.transform = "translateY(100%)";
    banner.style.opacity = "0";
    setTimeout(() => (banner.style.display = "none"), 300);
  }
  toast("✅ Preferenze cookie salvate");
}

function applyCookiePrefs(prefs) {
  // Stripe.js viene caricato solo all'apertura del modale di upgrade (vedi showUpgradeModal),
  // non più in head — quindi se l'utente rifiuta i cookie di terze parti qui sappiamo
  // ancora solo registrarlo, ma almeno il cookie non è già stato impostato prima del consenso.
  if (!prefs.stripe) {
    console.log("[Cookie] Stripe cookie disabilitati dall'utente");
  }
}

function resetCookieConsent() {
  localStorage.removeItem(COOKIE_KEY);
  document.getElementById("cookie-banner").style.display = "block";
  document.getElementById("cookie-banner").style.transform = "";
  document.getElementById("cookie-banner").style.opacity = "";
  document.getElementById("cookie-details").style.display = "none";
}

// Inizializza il banner DOPO che l'app è pronta
// (chiamato dall'init principale dopo il caricamento)
// document.addEventListener('DOMContentLoaded', initCookieBanner); // spostato nell'init

// Mostra un banner quando una nuova versione dell'app è pronta
function showUpdateBanner() {
  if (document.getElementById("update-banner")) return;
  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:10000;padding:12px 16px;background:rgba(8,15,9,0.97);border-bottom:2px solid var(--border);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;font-family:'Inter',sans-serif";
  banner.innerHTML = `
    <span style="font-size:13px;color:var(--text-bright)">🔄 È disponibile una nuova versione di SnakeKeeper</span>
    <button onclick="window.location.reload()"
      style="padding:8px 16px;background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:8px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;white-space:nowrap">
      Aggiorna ora
    </button>
  `;
  document.body.appendChild(banner);
}

// Registra Service Worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[SW] Registrato:", reg.scope);
        // Ascolta messaggi dal SW per sync
        navigator.serviceWorker.addEventListener("message", (event) => {
          if (event.data.type === "SYNC_REQUESTED") {
            syncPendingOfflineData();
          }
        });
        // Se c'è già un worker in attesa, la nuova versione è pronta
        if (reg.waiting && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
        // Rileva un nuovo worker installato mentre uno vecchio è già attivo
        // (se non c'è già un controller, è solo la prima installazione)
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateBanner();
            }
          });
        });
      })
      .catch((err) => console.warn("[SW] Registrazione fallita:", err));
  });
}

// Coda operazioni offline
const OFFLINE_QUEUE_KEY = "sk_offline_queue";

function getOfflineQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch (e) {
    return [];
  }
}
function saveOfflineQueue(q) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
}
function addToOfflineQueue(operation) {
  const q = getOfflineQueue();
  q.push({ ...operation, timestamp: Date.now() });
  saveOfflineQueue(q);
  console.log("[Offline] Aggiunta operazione alla coda:", operation.type);
}

// Rigioca la coda offline verso il server. Non tocca UI/stato locale — lo fa chi la chiama,
// con contesti diversi: syncPendingOfflineData() (dopo l'evento 'online', a app già aperta)
// e loadAll() (all'avvio: se la pagina viene ricaricata mentre si è già tornati online, senza
// una transizione 'online' da intercettare, era così che le modifiche in coda restavano
// bloccate in localStorage e sparivano dalla UI al refresh).
async function replayOfflineQueue() {
  const q = getOfflineQueue();
  if (!q.length) return { synced: 0, failed: 0 };
  console.log("[Sync] Sincronizzazione", q.length, "operazioni offline...");

  const failed = [];
  for (const op of q) {
    try {
      if (op.type === "INSERT_SERPENTE") await SB.insertSerpente(op.data);
      else if (op.type === "INSERT_LOG") await SB.insertLog(op.data);
      else if (op.type === "INSERT_VENDUTO") await SB.insertVenduto(op.data);
      else if (op.type === "DELETE_SERPENTE") await SB.deleteSerpente(op.id);
      else if (op.type === "DELETE_LOG") await SB.deleteLog(op.id);
      console.log("[Sync] ✅", op.type, "sincronizzato");
    } catch (e) {
      console.warn("[Sync] ❌ Fallito:", op.type, e.message);
      failed.push(op);
    }
  }

  saveOfflineQueue(failed);
  return { synced: q.length - failed.length, failed: failed.length };
}

// Sincronizza dati offline quando torna la connessione (app già aperta)
async function syncPendingOfflineData() {
  const result = await replayOfflineQueue();
  if (result.synced > 0 && result.failed === 0) {
    toast("☁️ " + result.synced + " modifiche offline sincronizzate!");
    await loadAll();
    showPage(currentPage, currentSnakeId);
  }
}

// Indicatore connessione online/offline
window.addEventListener("online", () => {
  setOnline(true);
  toast("🟢 Connessione ripristinata!");
  syncPendingOfflineData();
});
window.addEventListener("offline", () => {
  setOnline(false);
  toast("🔴 Modalità offline — i dati vengono salvati localmente", "#c9a84c");
});

// Wrapper Supabase con fallback offline.
// navigator.onLine non è affidabile al 100% (riflette solo se l'interfaccia di rete è
// "attiva", non se internet è davvero raggiungibile): oltre al controllo preventivo,
// se il tentativo di rete fallisce comunque per problemi di connessione lo si mette in
// coda invece di far perdere i dati inseriti con un errore secco all'utente.
function isNetworkError(e) {
  return (
    e instanceof TypeError ||
    /failed to fetch|networkerror|network request failed/i.test(e.message || "")
  );
}

const _origInsertLog = SB.insertLog.bind(SB);
SB.insertLog = async function (log) {
  // Assegna sempre il user_id dell'utente corrente
  if (_currentUser && _currentUser.id && !log.user_id)
    log.user_id = _currentUser.id;
  if (!navigator.onLine) {
    // Cache aggiornata dal chiamante (addLogToCaches) — qui solo coda di sync.
    addToOfflineQueue({ type: "INSERT_LOG", data: log });
    return [log];
  }
  try {
    return await _origInsertLog(log);
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    addToOfflineQueue({ type: "INSERT_LOG", data: log });
    return [log];
  }
};

const _origInsertSerpente = SB.insertSerpente.bind(SB);
SB.insertSerpente = async function (s) {
  // Assegna sempre il user_id dell'utente corrente
  if (_currentUser && _currentUser.id && !s.user_id)
    s.user_id = _currentUser.id;
  if (!navigator.onLine) {
    // Cache aggiornata dal chiamante (saveSerpente) — qui solo coda di sync.
    addToOfflineQueue({ type: "INSERT_SERPENTE", data: s });
    return [s];
  }
  try {
    return await _origInsertSerpente(s);
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    addToOfflineQueue({ type: "INSERT_SERPENTE", data: s });
    return [s];
  }
};

const _origInsertVenduto = SB.insertVenduto.bind(SB);
SB.insertVenduto = async function (v) {
  // Assegna sempre il user_id dell'utente corrente
  if (_currentUser && _currentUser.id && !v.user_id)
    v.user_id = _currentUser.id;
  return _origInsertVenduto(v);
};

// ═══════════════════════════════════════
//  INIT — carica da Supabase
// ═══════════════════════════════════════
// ═══════════════════════════════════════
//  LEGAL PAGES — PRIVACY & TERMS
// ═══════════════════════════════════════

function showLegalPage(page) {
  // Mostra la pagina legale sopra la login screen (accessibile anche da non loggati)
  document.getElementById("legal-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "legal-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:999;background:var(--bg-deep);overflow-y:auto;padding:24px";
  const legalLang =
    typeof _appLang !== "undefined" && _appLang
      ? _appLang
      : typeof _landingLang !== "undefined"
        ? _landingLang
        : "it";
  const content =
    page === "privacy"
      ? legalLang === "en"
        ? getPrivacyContentEN()
        : getPrivacyContent()
      : legalLang === "en"
        ? getTermsContentEN()
        : getTermsContent();
  modal.innerHTML = `
    <div style="max-width:760px;margin:0 auto">
      <button onclick="closeModalEl(document.getElementById('legal-modal'))"
        style="background:var(--bg-card);border:1px solid var(--border);color:var(--text-mid);padding:10px 18px;border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;cursor:pointer;margin-bottom:24px;display:flex;align-items:center;gap:6px">
        ← Torna indietro
      </button>
      ${content}
    </div>`;
  openModalEl(modal);
  modal.scrollTop = 0;
}

function getLegalStyles() {
  return `
    <style>
      .legal-doc { color: var(--text-mid); line-height: 1.8; font-size: 14px; }
      .legal-doc h1 { font-family:'Cinzel',serif; color:var(--accent-gold); font-size:24px; margin-bottom:8px; }
      .legal-doc .legal-meta { font-size:12px; color:var(--text-dim); margin-bottom:32px; padding-bottom:16px; border-bottom:1px solid var(--border); }
      .legal-doc h2 { color:var(--text-bright); font-size:16px; margin:28px 0 10px 0; padding-left:12px; border-left:3px solid var(--accent-gold); }
      .legal-doc h3 { color:var(--accent-lime); font-size:14px; margin:18px 0 8px 0; }
      .legal-doc p { margin:0 0 12px 0; color:var(--text-mid); }
      .legal-doc ul { margin:8px 0 12px 20px; }
      .legal-doc ul li { margin-bottom:6px; color:var(--text-mid); }
      .legal-doc .highlight { background:var(--bg-moss); border-radius:8px; padding:14px 16px; margin:16px 0; border-left:3px solid var(--accent-lime); }
      .legal-doc a { color:var(--accent-lime); }
      .legal-doc table { width:100%; border-collapse:collapse; margin:12px 0; font-size:13px; }
      .legal-doc th { background:var(--bg-moss); color:var(--text-bright); padding:10px; text-align:left; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; }
      .legal-doc td { padding:10px; border-bottom:1px solid var(--border); color:var(--text-mid); }
    </style>`;
}

function getPrivacyContent() {
  const today = new Date().toLocaleDateString("it-IT");
  return (
    getLegalStyles() +
    `
  <div class="legal-doc">
    <h1>🔒 Privacy Policy</h1>
    <div class="legal-meta">
      Ultimo aggiornamento: ${today} · Versione 1.0<br>
      Documento conforme al Regolamento (UE) 2016/679 (GDPR)
    </div>

    <div class="highlight">
      <strong style="color:var(--text-bright)">In sintesi:</strong> SnakeKeeper raccoglie solo i dati strettamente necessari al funzionamento del servizio. Non vendiamo mai i tuoi dati a terzi. Hai il pieno controllo sui tuoi dati e puoi richiederne la cancellazione in qualsiasi momento.
    </div>

    <h2>1. Titolare del Trattamento</h2>
    <p>Il titolare del trattamento dei dati personali è:</p>
    <ul>
      <li><strong>Titolare:</strong> Manuel Satta</li>
      <li><strong>Indirizzo:</strong> Via Comerio 9, 48018 Faenza (RA), Italia</li>
      <li><strong>Sito web:</strong> <a href="https://snakekeeper.it">snakekeeper.it</a></li>
      <li><strong>Email:</strong> <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></li>
    </ul>

    <h2>2. Dati Raccolti e Finalità</h2>
    <h3>2.1 Dati di registrazione</h3>
    <p>Al momento della registrazione raccogliamo:</p>
    <ul>
      <li><strong>Indirizzo email</strong> — per identificare l'account e inviare comunicazioni di servizio</li>
      <li><strong>Password</strong> — conservata in forma crittografata (hashing bcrypt), mai in chiaro</li>
    </ul>
    <p><strong>Base giuridica:</strong> esecuzione del contratto (Art. 6.1.b GDPR)</p>

    <h3>2.2 Dati inseriti dall'utente</h3>
    <p>I dati relativi ai serpenti (schede anagrafiche, log alimentari, pesi, mute, vendite) sono dati inseriti volontariamente dall'utente. Questi dati:</p>
    <ul>
      <li>Appartengono esclusivamente all'utente</li>
      <li>Non sono accessibili ad altri utenti</li>
      <li>Non vengono analizzati o utilizzati per finalità commerciali</li>
      <li>Possono essere cancellati dall'utente in qualsiasi momento</li>
    </ul>
    <p><strong>Base giuridica:</strong> esecuzione del contratto (Art. 6.1.b GDPR)</p>

    <h3>2.3 Dati di pagamento</h3>
    <p>I pagamenti sono gestiti da <strong>Stripe Inc.</strong>, un provider certificato PCI-DSS. SnakeKeeper <strong>non raccoglie né conserva</strong> dati di carte di credito o informazioni bancarie. Stripe potrebbe raccogliere:</p>
    <ul>
      <li>Dati della carta di pagamento (gestiti esclusivamente da Stripe)</li>
      <li>Indirizzo di fatturazione</li>
      <li>Dati necessari per prevenire frodi</li>
    </ul>
    <p>Per maggiori informazioni: <a href="https://stripe.com/privacy" target="_blank">stripe.com/privacy</a></p>
    <p><strong>Base giuridica:</strong> esecuzione del contratto (Art. 6.1.b GDPR)</p>

    <h3>2.4 Dati tecnici</h3>
    <p>Come la maggior parte dei servizi web, raccogliamo automaticamente:</p>
    <ul>
      <li>Indirizzo IP (anonimizzato)</li>
      <li>Tipo di browser e dispositivo</li>
      <li>Pagine visitate e durata della sessione</li>
      <li>Data e ora degli accessi</li>
    </ul>
    <p><strong>Base giuridica:</strong> legittimo interesse (Art. 6.1.f GDPR) per sicurezza e funzionamento del servizio</p>

    <h2>3. Cookie e Tecnologie Simili</h2>
    <table>
      <tr><th>Cookie</th><th>Tipo</th><th>Durata</th><th>Finalità</th></tr>
      <tr><td>sb-*-auth-token</td><td>Essenziale</td><td>1 ora</td><td>Sessione di autenticazione Supabase</td></tr>
      <tr><td>offline_queue</td><td>Tecnico</td><td>Sessione</td><td>Coda operazioni offline</td></tr>
      <tr><td>stripe.js</td><td>Terza parte</td><td>Varia</td><td>Elaborazione pagamenti sicuri</td></tr>
    </table>
    <p>Non utilizziamo cookie di profilazione o tracciamento pubblicitario.</p>

    <h2>4. Conservazione dei Dati</h2>
    <p>I dati vengono conservati per i seguenti periodi:</p>
    <ul>
      <li><strong>Dati account:</strong> per tutta la durata del rapporto contrattuale + 12 mesi dopo la cancellazione</li>
      <li><strong>Dati inseriti dall'utente:</strong> fino alla cancellazione da parte dell'utente o dell'account</li>
      <li><strong>Dati di pagamento (Stripe):</strong> secondo le policy di Stripe e gli obblighi fiscali (generalmente 10 anni)</li>
      <li><strong>Log tecnici:</strong> 30 giorni</li>
    </ul>

    <h2>5. Condivisione con Terze Parti</h2>
    <p>I tuoi dati non vengono venduti, affittati o condivisi con terzi per finalità di marketing. Li condividiamo solo con:</p>
    <ul>
      <li><strong>Supabase Inc.</strong> — hosting del database e autenticazione (server in UE)</li>
      <li><strong>Stripe Inc.</strong> — elaborazione pagamenti</li>
      <li><strong>Resend Inc.</strong> — invio email transazionali</li>
      <li><strong>GitHub Inc.</strong> — hosting del sito web (GitHub Pages)</li>
    </ul>
    <p>Tutti i provider sono conformi al GDPR e, ove applicabile, al Privacy Shield UE-USA.</p>

    <h3>5.1 Trasferimento di un esemplare a un altro utente</h3>
    <p>Se vendi un esemplare puoi inviarne la scheda all'acquirente tramite la funzione <strong>"Invia al cliente"</strong>. In questo caso:</p>
    <ul>
      <li>Inserisci tu l'indirizzo email del cliente. Inviando la richiesta dichiari di essere autorizzato a usare quell'indirizzo per questa comunicazione.</li>
      <li>A quell'indirizzo viene inviata <strong>una singola email transazionale</strong> (tramite Resend) che segnala la richiesta. Non viene creato alcun account e l'indirizzo non viene usato per altri scopi né per marketing.</li>
      <li>Vengono trasmessi <strong>solo i dati dell'animale</strong>: scheda anagrafica, foto, genetica, genealogia (come testo) e l'ultima registrazione per ogni tipo di log. <strong>Non</strong> vengono trasmessi prezzo, nome dell'acquirente, note della vendita, le tue note sull'esemplare né quelle sulle singole registrazioni.</li>
      <li>Al destinatario viene mostrato il tuo indirizzo email, per permettergli di riconoscere da chi arriva la richiesta.</li>
      <li><strong>Nessun dato viene copiato sull'account del destinatario finché non accetta esplicitamente</strong> la richiesta dal proprio account. Accettazione e rifiuto vengono registrati con data e ora.</li>
      <li>Le richieste non accettate scadono automaticamente dopo 30 giorni. Puoi ritirare una richiesta in attesa in qualsiasi momento.</li>
      <li>Una volta accettata, la copia sull'account del destinatario è indipendente dalla tua: resta a lui anche se elimini la tua vendita o il tuo account.</li>
    </ul>

    <h2>6. I Tuoi Diritti (GDPR)</h2>
    <p>Ai sensi del GDPR hai il diritto di:</p>
    <ul>
      <li><strong>Accesso</strong> — richiedere una copia di tutti i tuoi dati personali</li>
      <li><strong>Rettifica</strong> — correggere dati inesatti o incompleti</li>
      <li><strong>Cancellazione ("diritto all'oblio")</strong> — richiedere la cancellazione di tutti i tuoi dati</li>
      <li><strong>Portabilità</strong> — ricevere i tuoi dati in formato strutturato e leggibile</li>
      <li><strong>Opposizione</strong> — opporti al trattamento per legittimo interesse</li>
      <li><strong>Limitazione</strong> — limitare il trattamento in determinate circostanze</li>
    </ul>
    <p>Per esercitare questi diritti, scrivi a <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a>. Risponderemo entro 30 giorni.</p>
    <p>Hai inoltre il diritto di proporre reclamo al <strong>Garante per la Protezione dei Dati Personali</strong> (<a href="https://www.garanteprivacy.it" target="_blank">garanteprivacy.it</a>).</p>

    <h2>7. Sicurezza dei Dati</h2>
    <p>Adottiamo le seguenti misure di sicurezza:</p>
    <ul>
      <li>Connessioni cifrate con TLS/HTTPS</li>
      <li>Password conservate con hashing bcrypt</li>
      <li>Accesso ai dati limitato all'utente proprietario tramite Row Level Security (RLS)</li>
      <li>Token di sessione con scadenza automatica</li>
      <li>Nessun dato sensibile conservato in chiaro</li>
    </ul>

    <h2>8. Trasferimento Internazionale di Dati</h2>
    <p>Alcuni provider (Stripe, GitHub) hanno sede negli USA. Il trasferimento avviene nel rispetto del GDPR tramite le Standard Contractual Clauses (SCC) approvate dalla Commissione Europea.</p>

    <h2>9. Minori</h2>
    <p>SnakeKeeper non è destinato a minori di 16 anni. Non raccogliamo consapevolmente dati di minori. Se ritieni che un minore abbia creato un account, contattaci a <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a>.</p>

    <h2>10. Modifiche alla Privacy Policy</h2>
    <p>Ci riserviamo il diritto di aggiornare questa Privacy Policy. In caso di modifiche sostanziali, informeremo gli utenti via email con almeno 15 giorni di preavviso. La data dell'ultimo aggiornamento è sempre indicata in cima al documento.</p>

    <h2>11. Contatti</h2>
    <p>Per qualsiasi domanda relativa alla privacy: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></p>
  </div>`
  );
}

function getTermsContent() {
  const today = new Date().toLocaleDateString("it-IT");
  return (
    getLegalStyles() +
    `
  <div class="legal-doc">
    <h1>📋 Termini di Servizio</h1>
    <div class="legal-meta">
      Ultimo aggiornamento: ${today} · Versione 1.0<br>
      Leggere attentamente prima di utilizzare il servizio
    </div>

    <div class="highlight">
      <strong style="color:var(--text-bright)">In sintesi:</strong> SnakeKeeper è un servizio di gestione per allevatori di serpenti. Offriamo un piano gratuito (max 3 serpenti) e piani a pagamento per funzionalità avanzate. Puoi cancellare il tuo account in qualsiasi momento.
    </div>

    <h2>1. Accettazione dei Termini</h2>
    <p>Utilizzando SnakeKeeper ("il Servizio", "la Piattaforma"), disponibile su <a href="https://snakekeeper.it">snakekeeper.it</a>, accetti di essere vincolato dai presenti Termini di Servizio ("Termini"). Se non accetti questi Termini, non puoi utilizzare il Servizio.</p>
    <p>Il Servizio è fornito da SnakeKeeper ("noi", "ci", "nostro"). Questi Termini costituiscono un accordo legalmente vincolante tra te e SnakeKeeper.</p>

    <h2>2. Descrizione del Servizio</h2>
    <p>SnakeKeeper è un'applicazione web per la gestione professionale di allevamenti di serpenti. Il Servizio consente di:</p>
    <ul>
      <li>Registrare e gestire le schede anagrafiche dei propri serpenti</li>
      <li>Tracciare alimentazione, peso, mute e stato di salute</li>
      <li>Gestire le vendite degli esemplari</li>
      <li>Generare report e schede in formato PDF</li>
      <li>Accedere ai dati offline tramite tecnologia PWA</li>
    </ul>

    <h2>3. Account e Registrazione</h2>
    <h3>3.1 Creazione dell'account</h3>
    <p>Per utilizzare il Servizio è necessario creare un account fornendo un indirizzo email valido e una password. Sei responsabile di:</p>
    <ul>
      <li>Fornire informazioni accurate e aggiornate</li>
      <li>Mantenere la riservatezza delle credenziali di accesso</li>
      <li>Tutte le attività che avvengono sul tuo account</li>
      <li>Notificarci immediatamente in caso di accesso non autorizzato</li>
    </ul>

    <h3>3.2 Requisiti di età</h3>
    <p>Devi avere almeno 16 anni per creare un account. Se hai meno di 16 anni, puoi utilizzare il Servizio solo con il consenso di un genitore o tutore legale.</p>

    <h3>3.3 Un account per persona</h3>
    <p>È consentito un solo account per persona fisica. La creazione di account multipli è vietata.</p>

    <h2>4. Piani e Pagamenti</h2>
    <h3>4.1 Piano Free</h3>
    <p>Il piano gratuito consente di gestire fino a <strong>3 serpenti</strong> senza alcun costo. Non è richiesta carta di credito.</p>
    <p>Se un utente con piano Pro torna al piano Free avendo più di 3 esemplari registrati, <strong>nessun dato viene cancellato</strong>: tutti gli esemplari e il relativo storico restano visibili e consultabili. Restano pienamente modificabili i primi 3 esemplari inseriti in ordine cronologico, mentre gli altri passano in modalità di sola lettura fino all'eventuale riattivazione di un piano a pagamento.</p>

    <h3>4.2 Piano Pro</h3>
    <p>Il piano Pro offre funzionalità illimitate a pagamento:</p>
    <ul>
      <li><strong>Mensile:</strong> €4.99/mese, rinnovato automaticamente ogni mese</li>
      <li><strong>Annuale:</strong> €47.99/anno, rinnovato automaticamente ogni anno</li>
    </ul>

    <h3>4.3 Piano For Life</h3>
    <p>Il piano For Life è un <strong>acquisto una tantum di €199</strong> che garantisce accesso illimitato a tutte le funzionalità attuali e future del Servizio, senza rinnovi periodici.</p>

    <h3>4.4 Pagamenti e fatturazione</h3>
    <p>I pagamenti sono elaborati da Stripe Inc. in modo sicuro. Accettando un piano a pagamento, autorizzi l'addebito automatico secondo la cadenza scelta. I prezzi sono IVA inclusa ove applicabile.</p>

    <h3>4.5 Rimborsi</h3>
    <div class="highlight">
      <strong style="color:var(--text-bright)">Garanzia 14 giorni:</strong> per tutti i piani, entro 14 giorni dall'acquisto puoi richiedere il <strong>rimborso completo</strong> direttamente dalla pagina Profilo, senza contattare l'assistenza e senza dover fornire motivazioni.
    </div>
    <ul>
      <li><strong>Entro 14 giorni (tutti i piani):</strong> rimborso completo automatico. L'accesso premium termina immediatamente e l'importo viene riaccreditato sul metodo di pagamento originale entro 3-5 giorni lavorativi.</li>
      <li><strong>Oltre 14 giorni — Piano Pro (mensile/annuale):</strong> nessun rimborso, ma puoi disdire in qualsiasi momento. Manterrai l'accesso Pro fino alla scadenza del periodo già pagato e non verranno effettuati ulteriori addebiti.</li>
      <li><strong>Oltre 14 giorni — Piano For Life:</strong> trattandosi di un acquisto definitivo una tantum, non è previsto rimborso oltre il periodo di garanzia.</li>
    </ul>
    <p>La cancellazione si effettua dalla sezione <strong>Profilo → Gestione abbonamento</strong>. Per assistenza: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></p>
    <p>Per richiedere un rimborso: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></p>

    <h3>4.6 Modifica dei prezzi</h3>
    <p>Ci riserviamo il diritto di modificare i prezzi con un preavviso di almeno 30 giorni via email. Le modifiche non si applicano agli abbonamenti attivi fino al successivo rinnovo. Il piano For Life è immune da variazioni di prezzo.</p>

    <h2>5. Proprietà dei Contenuti</h2>
    <h3>5.1 I tuoi dati</h3>
    <p>Tutti i dati che inserisci nel Servizio (schede serpenti, log, foto, note) sono di tua proprietà. Ci concedi una licenza limitata per conservarli ed elaborarli ai soli fini di fornirti il Servizio.</p>

    <h3>5.2 Esportazione dei dati</h3>
    <p>Puoi esportare i tuoi dati in formato PDF in qualsiasi momento tramite la funzione integrata nel Servizio. Su richiesta, possiamo fornire un export completo in formato JSON entro 30 giorni.</p>

    <h3>5.3 Trasferimento di un esemplare a un altro utente</h3>
    <p>Il Servizio permette di inviare la scheda di un esemplare venduto all'account dell'acquirente. Usando questa funzione:</p>
    <ul>
      <li>dichiari di aver effettivamente ceduto l'animale e di essere autorizzato a usare l'indirizzo email del destinatario per questa comunicazione;</li>
      <li>il trasferimento si perfeziona <strong>solo</strong> con l'accettazione esplicita del destinatario dal proprio account;</li>
      <li>una volta accettato, il trasferimento è <strong>definitivo</strong>: la copia sull'account del destinatario è indipendente e non può essere revocata da te. Finché la richiesta è ancora in attesa puoi ritirarla in qualsiasi momento;</li>
      <li>la vendita resta registrata nel tuo archivio "Venduti", prezzo compreso;</li>
      <li>è vietato usare questa funzione per inviare comunicazioni non richieste. L'abuso comporta la sospensione dell'account.</li>
    </ul>

    <h3>5.4 Proprietà intellettuale di SnakeKeeper</h3>
    <p>Il codice, il design, i loghi e tutti gli elementi del Servizio sono proprietà di SnakeKeeper e protetti dalle leggi sul copyright. Non puoi copiare, modificare o distribuire il Servizio senza autorizzazione scritta.</p>

    <h2>6. Uso Accettabile</h2>
    <p>Ti impegni a non utilizzare il Servizio per:</p>
    <ul>
      <li>Attività illegali o che violino diritti di terzi</li>
      <li>Inserire contenuti falsi, fuorvianti o offensivi</li>
      <li>Tentare di accedere ai dati di altri utenti</li>
      <li>Sovraccaricare o compromettere l'infrastruttura del Servizio</li>
      <li>Utilizzare bot, scraper o strumenti automatizzati non autorizzati</li>
      <li>Registrare e vendere serpenti protetti da CITES senza i necessari permessi legali</li>
    </ul>
    <p>Ci riserviamo il diritto di sospendere o terminare l'account di chiunque violi queste regole.</p>

    <h2>7. Disponibilità del Servizio</h2>
    <p>Ci impegniamo a garantire la massima disponibilità del Servizio, ma non possiamo garantire un'operatività del 100%. Ci riserviamo il diritto di:</p>
    <ul>
      <li>Effettuare manutenzioni programmate con preavviso</li>
      <li>Sospendere temporaneamente il Servizio per ragioni tecniche</li>
      <li>Modificare o interrompere funzionalità con ragionevole preavviso</li>
    </ul>
    <p>In caso di interruzioni prolungate (oltre 72 ore), gli abbonati Pro riceveranno un credito proporzionale sul prossimo rinnovo.</p>

    <h2>8. Limitazione di Responsabilità</h2>
    <p>Nei limiti consentiti dalla legge applicabile, SnakeKeeper non è responsabile per:</p>
    <ul>
      <li>Perdita di dati causata da eventi al di fuori del nostro controllo</li>
      <li>Danni indiretti, incidentali o consequenziali</li>
      <li>Decisioni prese dall'utente basate sui dati inseriti nel Servizio</li>
      <li>Interruzioni del Servizio dovute a cause di forza maggiore</li>
    </ul>
    <p>La responsabilità massima di SnakeKeeper nei tuoi confronti è limitata all'importo pagato negli ultimi 12 mesi.</p>

    <h2>9. Cancellazione dell'Account</h2>
    <h3>9.1 Cancellazione da parte dell'utente</h3>
    <p>Puoi cancellare il tuo account in qualsiasi momento dalla pagina Profilo o contattando <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a>. La cancellazione è immediata e comporta:</p>
    <ul>
      <li>Cessazione immediata dell'accesso al Servizio</li>
      <li>Cancellazione di tutti i tuoi dati entro 30 giorni</li>
      <li>Cessazione di eventuali abbonamenti attivi (senza rimborso per il periodo residuo)</li>
    </ul>

    <h3>9.2 Cancellazione da parte nostra</h3>
    <p>Ci riserviamo il diritto di sospendere o cancellare account che violino questi Termini, con preavviso di 48 ore salvo casi gravi.</p>

    <h2>10. Legge Applicabile e Foro Competente</h2>
    <p>I presenti Termini sono regolati dalla legge italiana. Per qualsiasi controversia è competente il foro del domicilio dell'utente consumatore, ai sensi del Codice del Consumo (D.Lgs. 206/2005).</p>
    <p>Per controversie relative ai consumatori nell'UE, è disponibile la piattaforma ODR della Commissione Europea: <a href="https://ec.europa.eu/consumers/odr" target="_blank">ec.europa.eu/consumers/odr</a></p>

    <h2>11. Modifiche ai Termini</h2>
    <p>Possiamo modificare questi Termini con un preavviso di almeno 30 giorni via email. Continuando a utilizzare il Servizio dopo la data di entrata in vigore delle modifiche, accetti i nuovi Termini.</p>

    <h2>12. Contatti</h2>
    <p>Per assistenza generale: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a><br>
    Per questioni legali e privacy: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a><br>
    Sito web: <a href="https://snakekeeper.it">snakekeeper.it</a></p>
  </div>`
  );
}

// ═══════════════════════════════════════
//  VERSIONI INGLESI — PRIVACY POLICY E TERMINI
// ═══════════════════════════════════════
// Traduzione professionale, non letterale: terminologia GDPR ufficiale
// in inglese (es. "right to erasure" invece di traduzione parola-per-parola),
// tutti i numeri/importi/scadenze identici all'originale italiano.
function getPrivacyContentEN() {
  const today = new Date().toLocaleDateString("en-GB");
  return (
    getLegalStyles() +
    `
  <div class="legal-doc">
    <h1>🔒 Privacy Policy</h1>
    <div class="legal-meta">
      Last updated: ${today} · Version 1.0<br>
      Document compliant with Regulation (EU) 2016/679 (GDPR)
    </div>

    <div class="highlight">
      <strong style="color:var(--text-bright)">In short:</strong> SnakeKeeper only collects the data strictly necessary to operate the service. We never sell your data to third parties. You have full control over your data and can request its deletion at any time.
    </div>

    <h2>1. Data Controller</h2>
    <p>The controller for the processing of personal data is:</p>
    <ul>
      <li><strong>Controller:</strong> Manuel Satta</li>
      <li><strong>Address:</strong> Via Comerio 9, 48018 Faenza (RA), Italy</li>
      <li><strong>Website:</strong> <a href="https://snakekeeper.it">snakekeeper.it</a></li>
      <li><strong>Email:</strong> <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></li>
    </ul>

    <h2>2. Data We Collect and Purposes</h2>
    <h3>2.1 Registration data</h3>
    <p>When you register, we collect:</p>
    <ul>
      <li><strong>Email address</strong> — to identify your account and send service communications</li>
      <li><strong>Password</strong> — stored in encrypted form (bcrypt hashing), never in plain text</li>
    </ul>
    <p><strong>Legal basis:</strong> performance of a contract (Art. 6(1)(b) GDPR)</p>

    <h3>2.2 Data entered by the user</h3>
    <p>Data relating to snakes (profile sheets, feeding logs, weights, sheds, sales) is entered voluntarily by the user. This data:</p>
    <ul>
      <li>Belongs exclusively to the user</li>
      <li>Is not accessible to other users</li>
      <li>Is not analysed or used for commercial purposes</li>
      <li>Can be deleted by the user at any time</li>
    </ul>
    <p><strong>Legal basis:</strong> performance of a contract (Art. 6(1)(b) GDPR)</p>

    <h3>2.3 Payment data</h3>
    <p>Payments are handled by <strong>Stripe Inc.</strong>, a PCI-DSS certified provider. SnakeKeeper <strong>does not collect or store</strong> credit card data or banking information. Stripe may collect:</p>
    <ul>
      <li>Payment card details (handled exclusively by Stripe)</li>
      <li>Billing address</li>
      <li>Data necessary to prevent fraud</li>
    </ul>
    <p>For more information: <a href="https://stripe.com/privacy" target="_blank">stripe.com/privacy</a></p>
    <p><strong>Legal basis:</strong> performance of a contract (Art. 6(1)(b) GDPR)</p>

    <h3>2.4 Technical data</h3>
    <p>Like most web services, we automatically collect:</p>
    <ul>
      <li>IP address (anonymised)</li>
      <li>Browser and device type</li>
      <li>Pages visited and session duration</li>
      <li>Date and time of access</li>
    </ul>
    <p><strong>Legal basis:</strong> legitimate interest (Art. 6(1)(f) GDPR) for the security and operation of the service</p>

    <h2>3. Cookies and Similar Technologies</h2>
    <table>
      <tr><th>Cookie</th><th>Type</th><th>Duration</th><th>Purpose</th></tr>
      <tr><td>sb-*-auth-token</td><td>Essential</td><td>1 hour</td><td>Supabase authentication session</td></tr>
      <tr><td>offline_queue</td><td>Technical</td><td>Session</td><td>Offline operations queue</td></tr>
      <tr><td>stripe.js</td><td>Third-party</td><td>Varies</td><td>Secure payment processing</td></tr>
    </table>
    <p>We do not use profiling or advertising-tracking cookies.</p>

    <h2>4. Data Retention</h2>
    <p>Data is retained for the following periods:</p>
    <ul>
      <li><strong>Account data:</strong> for the duration of the contractual relationship, plus 12 months after cancellation</li>
      <li><strong>Data entered by the user:</strong> until deleted by the user or upon account deletion</li>
      <li><strong>Payment data (Stripe):</strong> in accordance with Stripe's policies and applicable tax obligations (generally 10 years)</li>
      <li><strong>Technical logs:</strong> 30 days</li>
    </ul>

    <h2>5. Sharing With Third Parties</h2>
    <p>Your data is never sold, rented, or shared with third parties for marketing purposes. We only share it with:</p>
    <ul>
      <li><strong>Supabase Inc.</strong> — database hosting and authentication (servers located in the EU)</li>
      <li><strong>Stripe Inc.</strong> — payment processing</li>
      <li><strong>Resend Inc.</strong> — transactional email delivery</li>
      <li><strong>GitHub Inc.</strong> — website hosting (GitHub Pages)</li>
    </ul>
    <p>All providers are GDPR-compliant and, where applicable, comply with the relevant EU-US data transfer frameworks.</p>

    <h3>5.1 Transferring an animal to another user</h3>
    <p>When you sell an animal you can send its record to the buyer using the <strong>"Send to buyer"</strong> feature. In that case:</p>
    <ul>
      <li>You enter the buyer's email address yourself. By sending the request you confirm you are entitled to use that address for this communication.</li>
      <li><strong>A single transactional email</strong> (via Resend) is sent to that address to notify them of the request. No account is created, and the address is not used for any other purpose or for marketing.</li>
      <li>Only <strong>the animal's data</strong> is transferred: profile, photo, genetics, genealogy (as text) and the latest entry for each log type. Price, buyer name, sale notes, your notes on the animal and on individual log entries are <strong>not</strong> transferred.</li>
      <li>Your email address is shown to the recipient, so they can recognise who the request comes from.</li>
      <li><strong>No data is copied to the recipient's account until they explicitly accept</strong> the request from their own account. Acceptance and refusal are recorded with a timestamp.</li>
      <li>Requests that are not accepted expire automatically after 30 days. You can withdraw a pending request at any time.</li>
      <li>Once accepted, the copy on the recipient's account is independent of yours: it remains theirs even if you delete your sale record or your account.</li>
    </ul>

    <h2>6. Your Rights (GDPR)</h2>
    <p>Under the GDPR, you have the right to:</p>
    <ul>
      <li><strong>Access</strong> — request a copy of all your personal data</li>
      <li><strong>Rectification</strong> — correct inaccurate or incomplete data</li>
      <li><strong>Erasure ("right to be forgotten")</strong> — request the deletion of all your data</li>
      <li><strong>Portability</strong> — receive your data in a structured, commonly used, machine-readable format</li>
      <li><strong>Objection</strong> — object to processing carried out on the basis of legitimate interest</li>
      <li><strong>Restriction</strong> — restrict processing in certain circumstances</li>
    </ul>
    <p>To exercise these rights, write to <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a>. We will respond within 30 days.</p>
    <p>You also have the right to lodge a complaint with the <strong>Italian Data Protection Authority</strong> (Garante per la Protezione dei Dati Personali) (<a href="https://www.garanteprivacy.it" target="_blank">garanteprivacy.it</a>), or with the data protection authority of your own EU member state.</p>

    <h2>7. Data Security</h2>
    <p>We adopt the following security measures:</p>
    <ul>
      <li>Encrypted connections via TLS/HTTPS</li>
      <li>Passwords stored using bcrypt hashing</li>
      <li>Data access restricted to the owning user via Row Level Security (RLS)</li>
      <li>Session tokens with automatic expiry</li>
      <li>No sensitive data stored in plain text</li>
    </ul>

    <h2>8. International Data Transfers</h2>
    <p>Some providers (Stripe, GitHub) are based in the USA. Such transfers take place in compliance with the GDPR through the Standard Contractual Clauses (SCC) approved by the European Commission.</p>

    <h2>9. Children</h2>
    <p>SnakeKeeper is not intended for children under the age of 16. We do not knowingly collect data from children. If you believe a child has created an account, please contact us at <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a>.</p>

    <h2>10. Changes to This Privacy Policy</h2>
    <p>We reserve the right to update this Privacy Policy. In the event of material changes, we will notify users by email with at least 15 days' notice. The date of the last update is always shown at the top of this document.</p>

    <h2>11. Contact</h2>
    <p>For any question regarding privacy: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></p>
  </div>`
  );
}

function getTermsContentEN() {
  const today = new Date().toLocaleDateString("en-GB");
  return (
    getLegalStyles() +
    `
  <div class="legal-doc">
    <h1>📋 Terms of Service</h1>
    <div class="legal-meta">
      Last updated: ${today} · Version 1.0<br>
      Please read carefully before using the service
    </div>

    <div class="highlight">
      <strong style="color:var(--text-bright)">In short:</strong> SnakeKeeper is a management service for snake breeders. We offer a free plan (up to 3 snakes) and paid plans with advanced features. You can cancel your account at any time.
    </div>

    <h2>1. Acceptance of Terms</h2>
    <p>By using SnakeKeeper ("the Service", "the Platform"), available at <a href="https://snakekeeper.it">snakekeeper.it</a>, you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.</p>
    <p>The Service is provided by SnakeKeeper ("we", "us", "our"). These Terms constitute a legally binding agreement between you and SnakeKeeper.</p>

    <h2>2. Description of the Service</h2>
    <p>SnakeKeeper is a web application for the professional management of snake breeding collections. The Service allows you to:</p>
    <ul>
      <li>Record and manage profile sheets for your snakes</li>
      <li>Track feeding, weight, shedding, and health status</li>
      <li>Manage the sale of animals</li>
      <li>Generate reports and profile sheets in PDF format</li>
      <li>Access your data offline via PWA technology</li>
    </ul>

    <h2>3. Account and Registration</h2>
    <h3>3.1 Creating an account</h3>
    <p>To use the Service you must create an account by providing a valid email address and password. You are responsible for:</p>
    <ul>
      <li>Providing accurate and up-to-date information</li>
      <li>Keeping your login credentials confidential</li>
      <li>All activity that takes place under your account</li>
      <li>Notifying us immediately of any unauthorised access</li>
    </ul>

    <h3>3.2 Age requirements</h3>
    <p>You must be at least 16 years old to create an account. If you are under 16, you may only use the Service with the consent of a parent or legal guardian.</p>

    <h3>3.3 One account per person</h3>
    <p>Only one account per individual is permitted. Creating multiple accounts is prohibited.</p>

    <h2>4. Plans and Payments</h2>
    <h3>4.1 Free Plan</h3>
    <p>The free plan allows you to manage up to <strong>3 snakes</strong> at no cost. No credit card is required.</p>
    <p>If a Pro user reverts to the Free plan while having more than 3 registered animals, <strong>no data is deleted</strong>: all animals and their full history remain visible and accessible. The first 3 animals added, in chronological order, remain fully editable, while the others switch to read-only mode until a paid plan is reactivated.</p>

    <h3>4.2 Pro Plan</h3>
    <p>The Pro plan offers unlimited features for a fee:</p>
    <ul>
      <li><strong>Monthly:</strong> €4.99/month, automatically renewed every month</li>
      <li><strong>Annual:</strong> €47.99/year, automatically renewed every year</li>
    </ul>

    <h3>4.3 For Life Plan</h3>
    <p>The For Life plan is a <strong>one-time purchase of €199</strong> that guarantees unlimited access to all current and future features of the Service, with no recurring renewals.</p>

    <h3>4.4 Payments and billing</h3>
    <p>Payments are securely processed by Stripe Inc. By subscribing to a paid plan, you authorise automatic billing according to the frequency you have chosen. Prices are inclusive of VAT where applicable.</p>

    <h3>4.5 Refunds</h3>
    <div class="highlight">
      <strong style="color:var(--text-bright)">14-day guarantee:</strong> for all plans, within 14 days of purchase you can request a <strong>full refund</strong> directly from the Profile page, with no need to contact support and without providing a reason.
    </div>
    <ul>
      <li><strong>Within 14 days (all plans):</strong> automatic full refund. Premium access ends immediately and the amount is credited back to the original payment method within 3-5 business days.</li>
      <li><strong>After 14 days — Pro Plan (monthly/annual):</strong> no refund, but you may cancel at any time. You will retain Pro access until the end of the period you have already paid for, and no further charges will be made.</li>
      <li><strong>After 14 days — For Life Plan:</strong> as this is a final one-time purchase, no refund is available beyond the guarantee period.</li>
    </ul>
    <p>Cancellation is carried out from <strong>Profile → Manage subscription</strong>. For assistance: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></p>
    <p>To request a refund: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a></p>

    <h3>4.6 Price changes</h3>
    <p>We reserve the right to change prices with at least 30 days' notice by email. Changes do not apply to active subscriptions until the next renewal. The For Life plan is not subject to price changes.</p>

    <h2>5. Ownership of Content</h2>
    <h3>5.1 Your data</h3>
    <p>All data you enter into the Service (snake profiles, logs, photos, notes) belongs to you. You grant us a limited licence to store and process it solely for the purpose of providing the Service to you.</p>

    <h3>5.2 Data export</h3>
    <p>You can export your data in PDF format at any time using the feature built into the Service. Upon request, we can provide a complete export in JSON format within 30 days.</p>

    <h3>5.3 Transferring an animal to another user</h3>
    <p>The Service lets you send the record of a sold animal to the buyer's account. By using this feature:</p>
    <ul>
      <li>you confirm that you have actually sold the animal and that you are entitled to use the recipient's email address for this communication;</li>
      <li>the transfer is completed <strong>only</strong> once the recipient explicitly accepts it from their own account;</li>
      <li>once accepted, the transfer is <strong>final</strong>: the copy on the recipient's account is independent and cannot be revoked by you. While a request is still pending you may withdraw it at any time;</li>
      <li>the sale remains recorded in your "Sold" archive, price included;</li>
      <li>using this feature to send unsolicited messages is prohibited. Abuse will result in account suspension.</li>
    </ul>

    <h3>5.4 SnakeKeeper's intellectual property</h3>
    <p>The code, design, logos, and all elements of the Service are the property of SnakeKeeper and are protected by copyright law. You may not copy, modify, or distribute the Service without written authorisation.</p>

    <h2>6. Acceptable Use</h2>
    <p>You agree not to use the Service to:</p>
    <ul>
      <li>Engage in illegal activity or activity that infringes the rights of third parties</li>
      <li>Enter false, misleading, or offensive content</li>
      <li>Attempt to access other users' data</li>
      <li>Overload or compromise the Service's infrastructure</li>
      <li>Use unauthorised bots, scrapers, or automated tools</li>
      <li>Register or sell CITES-protected snakes without the necessary legal permits</li>
    </ul>
    <p>We reserve the right to suspend or terminate the account of anyone who violates these rules.</p>

    <h2>7. Service Availability</h2>
    <p>We work to ensure maximum availability of the Service, but we cannot guarantee 100% uptime. We reserve the right to:</p>
    <ul>
      <li>Carry out scheduled maintenance with advance notice</li>
      <li>Temporarily suspend the Service for technical reasons</li>
      <li>Modify or discontinue features with reasonable notice</li>
    </ul>
    <p>In the event of a prolonged outage (over 72 hours), Pro subscribers will receive a proportional credit on their next renewal.</p>

    <h2>8. Limitation of Liability</h2>
    <p>To the extent permitted by applicable law, SnakeKeeper is not liable for:</p>
    <ul>
      <li>Data loss caused by events outside our control</li>
      <li>Indirect, incidental, or consequential damages</li>
      <li>Decisions made by the user based on data entered into the Service</li>
      <li>Service interruptions due to force majeure</li>
    </ul>
    <p>SnakeKeeper's maximum liability to you is limited to the amount you paid in the previous 12 months.</p>

    <h2>9. Account Termination</h2>
    <h3>9.1 Termination by the user</h3>
    <p>You may delete your account at any time from the Profile page or by contacting <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a>. Deletion is immediate and results in:</p>
    <ul>
      <li>Immediate termination of access to the Service</li>
      <li>Deletion of all your data within 30 days</li>
      <li>Termination of any active subscriptions (with no refund for the remaining period)</li>
    </ul>

    <h3>9.2 Termination by us</h3>
    <p>We reserve the right to suspend or delete accounts that violate these Terms, with 48 hours' notice except in serious cases.</p>

    <h2>10. Governing Law and Jurisdiction</h2>
    <p>These Terms are governed by Italian law. For any dispute, the competent court is that of the consumer user's place of residence, pursuant to the Italian Consumer Code (Legislative Decree No. 206/2005).</p>
    <p>For disputes involving EU consumers, the European Commission's ODR platform is available at: <a href="https://ec.europa.eu/consumers/odr" target="_blank">ec.europa.eu/consumers/odr</a></p>

    <h2>11. Changes to These Terms</h2>
    <p>We may modify these Terms with at least 30 days' notice by email. By continuing to use the Service after the effective date of the changes, you accept the new Terms.</p>

    <h2>12. Contact</h2>
    <p>For general assistance: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a><br>
    For legal and privacy matters: <a href="mailto:snakekeeper.it@gmail.com">snakekeeper.it@gmail.com</a><br>
    Website: <a href="https://snakekeeper.it">snakekeeper.it</a></p>
  </div>`
  );
}

function renderPrivacy() {
  document.getElementById("main-content").innerHTML = `
    <div class="page-header"><h2>🔒 Privacy Policy</h2><p>${_appLang === "en" ? "Information on the processing of personal data" : "Informativa sul trattamento dei dati personali"}</p></div>
    <div class="card">
      ${_appLang === "en" ? getPrivacyContentEN() : getPrivacyContent()}
    </div>`;
}

function renderTerms() {
  document.getElementById("main-content").innerHTML = `
    <div class="page-header"><h2>📋 ${_appLang === "en" ? "Terms of Service" : "Termini di Servizio"}</h2><p>${_appLang === "en" ? "General terms and conditions of use" : "Condizioni generali di utilizzo"}</p></div>
    <div class="card">
      ${_appLang === "en" ? getTermsContentEN() : getTermsContent()}
    </div>`;
}

// ═══════════════════════════════════════
//  PAGINA PROFILO
// ═══════════════════════════════════════
async function renderProfilo() {
  const planLabels = {
    free: "🔓 Free",
    pro: "⭐ Pro",
    admin: "👑 Admin",
    free_forever: "🎁 Free Forever",
    for_life: "♾️ For Life",
  };
  const planColors = {
    free: "var(--text-dim)",
    pro: "var(--accent-lime)",
    admin: "var(--accent-gold)",
    free_forever: "var(--accent-pink)",
    for_life: "var(--accent-lime)",
  };
  const planDesc = {
    free: `${t("piano_free_desc").replace("{N}", FREE_SNAKE_LIMIT)}`,
    pro: t("piano_pro_desc"),
    admin: t("piano_admin_desc"),
    free_forever: t("piano_forever_desc"),
    for_life: t("piano_pro_desc"),
  };

  document.getElementById("main-content").innerHTML = `
    <div class="page-header">
      <h2>👤 ${t("profilo_title")}</h2>
      <p>${t("profilo_subtitle")}</p>
    </div>

    <!-- Card Account -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">📧 ${t("profilo_account")}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="background:var(--bg-moss);border-radius:8px;padding:14px;display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:50%;background:var(--accent-gold);display:flex;align-items:center;justify-content:center;font-size:18px;color:#0a1a0a;font-weight:700;flex-shrink:0">
            ${(_currentUser?.email?.[0] || "?").toUpperCase()}
          </div>
          <div>
            <div style="font-size:14px;color:var(--text-bright);font-weight:500">${esc(_currentUser?.email) || "—"}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${t("profilo_membro_dal")} ${_currentUser?.created_at ? new Date(_currentUser.created_at).toLocaleDateString(_appLang === "it" ? "it-IT" : "en-GB") : "—"}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Card Lingua -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🌐 Lingua / Language</div>
      <div style="display:flex;gap:10px">
        <button onclick="changeAppLang('it')" id="profile-lang-it"
          style="flex:1;padding:12px;border-radius:8px;border:1px solid ${_appLang === "it" ? "var(--accent-lime)" : "var(--border)"};background:${_appLang === "it" ? "rgba(109,181,109,0.15)" : "transparent"};color:${_appLang === "it" ? "var(--text-bright)" : "var(--text-dim)"};font-family:'Inter',sans-serif;font-size:14px;cursor:pointer">🇮🇹 Italiano</button>
        <button onclick="changeAppLang('en')" id="profile-lang-en"
          style="flex:1;padding:12px;border-radius:8px;border:1px solid ${_appLang === "en" ? "var(--accent-lime)" : "var(--border)"};background:${_appLang === "en" ? "rgba(109,181,109,0.15)" : "transparent"};color:${_appLang === "en" ? "var(--text-bright)" : "var(--text-dim)"};font-family:'Inter',sans-serif;font-size:14px;cursor:pointer">🇬🇧 English</button>
      </div>
    </div>

    <!-- Card Logo Allevamento -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🏷️ ${t("logo_title")}</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.5">
        ${t("logo_desc")}
      </p>
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div id="logo-preview-box" style="width:80px;height:80px;border-radius:12px;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;background:var(--bg-moss);overflow:hidden;flex-shrink:0">
          ${_userLogo ? `<img id="logo-preview-img" src="${esc(_userLogo)}" style="width:100%;height:100%;object-fit:contain">` : `<span style="font-size:28px">🏷️</span>`}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <label class="btn btn-ghost btn-sm" style="cursor:pointer;text-align:center">
            📤 ${_userLogo ? t("logo_cambia") : t("logo_carica_btn")}
            <input type="file" accept="image/*,application/pdf" onchange="uploadLogo(this)" style="display:none">
          </label>
          ${_userLogo ? `<button class="btn btn-ghost btn-sm" style="color:var(--accent-red);border-color:rgba(192,57,43,0.4)" onclick="removeLogo()">🗑️ ${t("logo_rimuovi")}</button>` : ""}
        </div>
      </div>
    </div>

    <!-- Card Piano -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">💳 ${t("piano_attuale")}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <div style="font-size:24px;font-weight:700;color:${planColors[_userPlan] || "var(--text-dim)"}">
            ${planLabels[_userPlan] || "Free"}
          </div>
          <div style="font-size:13px;color:var(--text-mid);margin-top:4px;max-width:280px;line-height:1.5">
            ${planDesc[_userPlan] || ""}
          </div>
          ${
            _userPlan === "pro" && _userTrialFieraId
              ? `
          <div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.35)">
            <span style="font-size:13px">🎪</span>
            <span style="font-size:11px;color:var(--accent-gold);font-weight:600">
              ${t("trial_badge_prefix")} ${daysUntil(_userValidUntil) !== null ? Math.max(0, daysUntil(_userValidUntil)) : ""} ${t("trial_badge_days")}
              (${t("trial_badge_code")} ${esc(_userTrialCode || "")})
            </span>
          </div>
          ${_userValidUntil ? `<div style="font-size:11px;color:var(--text-dim);margin-top:5px">${t("trial_badge_expires")} ${new Date(_userValidUntil).toLocaleDateString(_appLang === "en" ? "en-GB" : "it-IT")}</div>` : ""}`
              : ""
          }
        </div>
        ${
          _userPlan === "free"
            ? `
          <button onclick="showUpgradeModal()" 
            style="padding:12px 20px;background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;white-space:nowrap">
            ⭐ ${t("passa_a_pro")}
          </button>`
            : ""
        }
      </div>

      <!-- Statistiche uso -->
      ${
        _userPlan === "free"
          ? `
        <div style="background:var(--bg-moss);border-radius:10px;padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:12px;color:var(--text-dim)">${t("serpenti_utilizzati")}</div>
            <div style="font-size:12px;color:var(--text-mid);font-weight:600">${_snakes.length} / ${FREE_SNAKE_LIMIT}</div>
          </div>
          <div style="background:var(--bg-card);border-radius:4px;height:6px">
            <div style="height:6px;border-radius:4px;background:${_snakes.length >= FREE_SNAKE_LIMIT ? "var(--accent-red)" : "var(--accent-lime)"};width:${Math.min(100, (_snakes.length / FREE_SNAKE_LIMIT) * 100)}%;transition:width .3s"></div>
          </div>
          ${_snakes.length >= FREE_SNAKE_LIMIT ? `<div style="font-size:11px;color:var(--accent-red);margin-top:6px">⚠️ ${t("limite_raggiunto")}</div>` : ""}
        </div>`
          : `
        <div style="background:var(--bg-moss);border-radius:10px;padding:14px">
          <div style="font-size:13px;color:var(--text-mid)">🐍 ${t("serpenti_illimitati_lbl")} <strong style="color:var(--text-bright)">${_snakes.length}</strong> ${t("serpenti_illimitati_suffix")}</div>
        </div>`
      }
    </div>

    <!-- Card Pro Features -->
    ${
      _userPlan === "free"
        ? `
    <div class="card" style="margin-bottom:16px;border:1px solid rgba(201,168,76,0.3)">
      <div class="card-title" style="color:var(--accent-gold)">⭐ ${t("pro_features_title")}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${[
          ["🐍", t("pf1_t"), t("pf1_d")],
          ["📊", t("pf2_t"), t("pf2_d")],
          ["📄", t("pf3_t"), t("pf3_d")],
          ["☁️", t("pf4_t"), t("pf4_d")],
          ["✅", t("pf5_t"), t("pf5_d")],
          ["🔄", t("pf6_t"), t("pf6_d")],
        ]
          .map(
            ([ico, tit, desc]) => `
          <div style="background:var(--bg-moss);border-radius:8px;padding:12px">
            <div style="font-size:18px;margin-bottom:4px">${ico}</div>
            <div style="font-size:13px;color:var(--text-bright);font-weight:500">${tit}</div>
            <div style="font-size:11px;color:var(--text-dim);margin-top:2px">${desc}</div>
          </div>`,
          )
          .join("")}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <button onclick="showUpgradeModal();setTimeout(function(){selectPlan('monthly')},100)"
          style="padding:12px;background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer">
          ⭐ ${t("price_mese")}
        </button>
        <button onclick="showUpgradeModal();setTimeout(function(){selectPlan('yearly')},100)"
          style="padding:12px;background:transparent;color:var(--accent-gold);border:2px solid var(--accent-gold);border-radius:10px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer">
          ⭐ ${t("price_anno")}
        </button>
      </div>
      <button onclick="showUpgradeModal();setTimeout(function(){selectPlan('for_life')},100)"
        style="width:100%;margin-top:8px;padding:12px;background:linear-gradient(90deg,var(--accent-lime),var(--accent-gold));color:#0a1a0a;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer">
        ✨ ${t("price_forlife")}
      </button>
    </div>`
        : ""
    }

    <!-- Card Gestione Abbonamento (solo per piani a pagamento) -->
    ${
      _userPlan === "pro" || _userPlan === "for_life"
        ? `
    <div class="card" style="margin-bottom:16px">
      <div class="card-title">🧾 ${t("gestione_abbonamento")}</div>
      <div id="subscription-info" style="font-size:13px;color:var(--text-dim);padding:8px 0">
        <span class="spinner" style="width:14px;height:14px;border-width:2px"></span> ${t("caricamento_dettagli")}
      </div>
      <button onclick="showCancelSubscriptionModal()"
        style="width:100%;padding:12px;background:transparent;border:1px solid rgba(192,57,43,0.4);color:var(--accent-red);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;cursor:pointer;margin-top:8px">
        ${t("disdici_abbonamento")}
      </button>
    </div>`
        : ""
    }

    <!-- Card Azioni account -->
    <div class="card">
      <div class="card-title">⚙️ ${t("azioni_account")}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button onclick="doForgotPassword()" 
          style="width:100%;padding:12px;background:transparent;border:1px solid var(--border);color:var(--text-mid);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px">
          🔑 ${t("cambia_password")}
        </button>
        <button onclick="doLogout()" 
          style="width:100%;padding:12px;background:transparent;border:1px solid rgba(192,57,43,0.4);color:var(--accent-red);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px">
          🚪 ${t("esci_account")}
        </button>
      </div>
    </div>

    <!-- Card Zona pericolosa -->
    <div class="card" style="margin-top:16px;border:1px solid rgba(192,57,43,0.35)">
      <div class="card-title" style="color:var(--accent-red)">⚠️ ${t("zona_pericolosa")}</div>
      <p style="font-size:12px;color:var(--text-dim);line-height:1.6;margin:0 0 12px">
        ${t("zona_pericolosa_desc")}
      </p>
      <button onclick="showDeleteAccountModal()"
        style="width:100%;padding:12px;background:rgba(192,57,43,0.12);border:1px solid rgba(192,57,43,0.5);color:var(--accent-red);border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px">
        🗑️ ${t("elimina_account_btn")}
      </button>
    </div>
    <div style="text-align:center;margin-top:16px;font-size:11px;color:var(--text-dim);line-height:2">
      <a href="#" onclick="showPage('privacy')" style="color:var(--text-dim);text-decoration:none;margin:0 8px">${t("privacy_policy")}</a>·
      <a href="#" onclick="showPage('terms')" style="color:var(--text-dim);text-decoration:none;margin:0 8px">${t("termini_servizio")}</a>·
      <a href="#" onclick="resetCookieConsent()" style="color:var(--text-dim);text-decoration:none;margin:0 8px">🍪 ${t("gestisci_cookie")}</a>·
      <span style="margin:0 8px">© ${new Date().getFullYear()} SnakeKeeper</span>
    </div>`;
  // Carica i dettagli abbonamento se piano a pagamento
  if (_userPlan === "pro" || _userPlan === "for_life") {
    loadSubscriptionInfo();
  }
}

// ═══════════════════════════════════════
//  GESTIONE ABBONAMENTO
// ═══════════════════════════════════════
let _subInfo = null;

async function loadSubscriptionInfo() {
  const el = document.getElementById("subscription-info");
  if (!el) return;
  try {
    const _authSession = await getSession();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/cancel-subscription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${_authSession ? _authSession.access_token : ""}`,
        },
        body: JSON.stringify({ userId: _currentUser.id, action: "info" }),
      },
    );
    const info = await res.json();
    if (info.error) throw new Error(info.error);
    _subInfo = info;

    const purchaseStr = info.purchaseDate
      ? new Date(info.purchaseDate * 1000).toLocaleDateString("it-IT")
      : "—";
    const renewStr = info.periodEnd
      ? new Date(info.periodEnd * 1000).toLocaleDateString("it-IT")
      : null;
    // Fallback: se manca periodEnd ma è un abbonamento, stimalo dalla data + importo
    let fallbackRenew = null;
    if (!renewStr && info.isSubscription && info.purchaseDate && info.amount) {
      const monthsToAdd = info.amount >= 40 ? 12 : 1;
      const d = new Date(info.purchaseDate * 1000);
      d.setMonth(d.getMonth() + monthsToAdd);
      fallbackRenew = d.toLocaleDateString("it-IT");
    }
    const finalRenewStr = renewStr || fallbackRenew;
    const dateLabel = info.cancelAtPeriodEnd
      ? "Accesso fino al"
      : "Prossimo rinnovo";

    el.innerHTML = `
      <div style="display:grid;gap:8px">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(45,80,48,0.3)">
          <span>Tipo</span>
          <strong style="color:var(--text-bright)">${info.isSubscription ? "Abbonamento" : "Acquisto una tantum"}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(45,80,48,0.3)">
          <span>Attivato il</span>
          <strong style="color:var(--text-bright)">${purchaseStr}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(45,80,48,0.3)">
          <span>Importo</span>
          <strong style="color:var(--text-bright)">€${info.amount.toFixed(2)}</strong>
        </div>
        ${
          finalRenewStr
            ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(45,80,48,0.3)">
          <span>${dateLabel}</span>
          <strong style="color:${info.cancelAtPeriodEnd ? "var(--accent-red)" : "var(--accent-lime)"}">${finalRenewStr}</strong>
        </div>`
            : ""
        }
        ${
          info.cancelAtPeriodEnd
            ? `<div style="background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:8px;padding:12px;margin-top:4px">
          <div style="color:var(--accent-red);font-size:12px">⏱️ <strong>Abbonamento in scadenza</strong><br>Non verrà rinnovato. Manterrai l'accesso Pro fino alla data indicata.</div>
        </div>`
            : `<div style="background:${info.refundEligible ? "rgba(109,181,109,0.1)" : "rgba(45,80,48,0.2)"};border-radius:8px;padding:12px;margin-top:4px">
          ${
            info.refundEligible
              ? `<div style="color:var(--accent-lime);font-size:12px">✅ <strong>Rimborso disponibile</strong><br>Hai ancora <strong>${info.refundDaysLeft} giorni</strong> per richiedere il rimborso completo.</div>`
              : `<div style="color:var(--text-dim);font-size:12px">ℹ️ Il periodo di rimborso di 14 giorni è terminato.${info.isSubscription ? " Puoi comunque disdire: manterrai l'accesso fino alla scadenza." : ""}</div>`
          }
        </div>`
        }
      </div>`;
  } catch (e) {
    el.innerHTML = `<div style="color:var(--accent-red);font-size:12px">Impossibile caricare i dettagli: ${e.message}</div>`;
  }
}

function showCancelSubscriptionModal() {
  const info = _subInfo || {};
  const eligible = info.refundEligible;
  const isSub = info.isSubscription;

  document.getElementById("cancel-sub-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "cancel-sub-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:600;background:rgba(8,15,9,0.94);display:flex;align-items:center;justify-content:center;padding:24px";

  let explanation = "";
  if (eligible) {
    explanation = `
      <div style="background:rgba(109,181,109,0.1);border:1px solid rgba(109,181,109,0.3);border-radius:10px;padding:14px;margin-bottom:20px;text-align:left">
        <div style="color:var(--accent-lime);font-size:13px;font-weight:600;margin-bottom:6px">✅ Rimborso completo</div>
        <div style="color:var(--text-mid);font-size:13px;line-height:1.6">
          Sei entro i <strong>14 giorni</strong> dall'acquisto, quindi riceverai un rimborso completo di <strong>€${(info.amount || 0).toFixed(2)}</strong>.
          L'accesso Pro terminerà immediatamente.
        </div>
      </div>`;
  } else if (isSub) {
    const until = info.periodEnd
      ? new Date(info.periodEnd * 1000).toLocaleDateString("it-IT")
      : "fine periodo";
    explanation = `
      <div style="background:var(--bg-moss);border-radius:10px;padding:14px;margin-bottom:20px;text-align:left">
        <div style="color:var(--accent-gold);font-size:13px;font-weight:600;margin-bottom:6px">ℹ️ Nessun rimborso</div>
        <div style="color:var(--text-mid);font-size:13px;line-height:1.6">
          Il periodo di rimborso è terminato, ma <strong>manterrai l'accesso Pro fino al ${until}</strong>.
          Dopo quella data non verrà addebitato nulla.
        </div>
      </div>`;
  } else {
    explanation = `
      <div style="background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.3);border-radius:10px;padding:14px;margin-bottom:20px;text-align:left">
        <div style="color:var(--accent-red);font-size:13px;font-weight:600;margin-bottom:6px">⚠️ Rimborso non disponibile</div>
        <div style="color:var(--text-mid);font-size:13px;line-height:1.6">
          Il periodo di rimborso di 14 giorni è scaduto. Non è possibile annullare l'acquisto For Life.
        </div>
      </div>`;
  }

  const canProceed = eligible || isSub;

  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:420px;width:100%;text-align:center;box-shadow:var(--shadow)">
      <div style="font-size:44px;margin-bottom:12px">😢</div>
      <div style="font-family:'Cinzel',serif;font-size:20px;color:var(--text-bright);margin-bottom:8px">Vuoi davvero disdire?</div>
      <div style="color:var(--text-dim);font-size:13px;line-height:1.6;margin-bottom:20px">
        Perderai l'accesso a serpenti illimitati, export PDF e statistiche avanzate.
      </div>
      ${explanation}
      ${
        canProceed
          ? `
      <button id="btn-confirm-cancel" onclick="doCancelSubscription()"
        style="width:100%;padding:14px;background:var(--accent-red);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;margin-bottom:10px">
        ${eligible ? "💸 Disdici e rimborsa" : "Disdici abbonamento"}
      </button>`
          : ""
      }
      <button onclick="closeModalEl(document.getElementById('cancel-sub-modal'))"
        style="width:100%;padding:12px;background:var(--accent-lime);color:#0a1a0a;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer">
        🐍 Resto con Pro
      </button>
    </div>`;
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
}

async function doCancelSubscription() {
  const btn = document.getElementById("btn-confirm-cancel");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Elaborazione...';
  try {
    const _authSession = await getSession();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/cancel-subscription`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${_authSession ? _authSession.access_token : ""}`,
        },
        body: JSON.stringify({ userId: _currentUser.id, action: "cancel" }),
      },
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    closeModalEl(document.getElementById("cancel-sub-modal"));

    if (data.refunded) {
      toast(
        `✅ Abbonamento disdetto. Rimborso di €${data.refundAmount.toFixed(2)} in elaborazione (3-5 giorni lavorativi).`,
        "#6db56d",
      );
      _userPlan = "free";
      applyPlanUI();
    } else if (!data.immediate && data.accessUntil) {
      const until = new Date(data.accessUntil * 1000).toLocaleDateString(
        "it-IT",
      );
      toast(
        `✅ Abbonamento disdetto. Mantieni l'accesso Pro fino al ${until}.`,
        "#c9a84c",
      );
    } else {
      toast("✅ Abbonamento disdetto.", "#6db56d");
      _userPlan = "free";
      applyPlanUI();
    }
    await loadUserPlan();
    renderProfilo();
  } catch (e) {
    toast("❌ " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "Riprova";
  }
}

// ═══════════════════════════════════════
//  SISTEMA PIANI UTENTI
// ═══════════════════════════════════════
let _currentUser = null;
let _userPlan = "free"; // 'free' | 'pro' | 'admin' | 'free_forever'
let _vendutiFilterYear = "all"; // 'all' oppure es. '2026'
let _vendutiFilterMonth = "all"; // 'all' oppure 0-11 (indice mese, solo se anno specifico)
let _userLogo = null; // logo allevatore, base64 compresso, null se non caricato
let _userValidUntil = null; // scadenza pro (trial o abbonamento), ISO string o null
let _userTrialFieraId = null; // id evento fiera se il pro attuale è un trial promozionale
let _userTrialCode = null; // codice promo usato per il trial
let _userTrialNotifiedDate = null; // ultima data in cui è stato mostrato il countdown
const FREE_SNAKE_LIMIT = 3;
const ADMIN_EMAIL = "manuel.satta05@gmail.com";

function isPro() {
  return ["pro", "admin", "free_forever", "for_life"].includes(_userPlan);
}
function isAdmin() {
  return _userPlan === "admin";
}
function canAddSnake() {
  if (isPro()) return true;
  return _snakes.length < FREE_SNAKE_LIMIT;
}

// Controlla se il nome è già usato da un altro serpente dello stesso utente
// (case-insensitive). excludeId serve in modifica, per non confrontare il
// serpente con se stesso quando si salva senza cambiare nome.
function isNameTaken(name, excludeId = null) {
  const normalized = (name || "").trim().toLowerCase();
  if (!normalized) return false;
  return _snakes.some(
    (s) =>
      s.id !== excludeId && (s.nome || "").trim().toLowerCase() === normalized,
  );
}

// ═══════════════════════════════════════
//  LIMITE FREE — SERPENTI IN SOLA LETTURA
// ═══════════════════════════════════════
// Su piano Free restano pienamente gestibili solo i primi FREE_SNAKE_LIMIT
// esemplari inseriti (_snakes e' gia' ordinato per created_at.asc dal backend).
// Tutti gli altri restano SEMPRE visibili con lo storico completo, ma in sola
// lettura finche' l'utente non riattiva un piano Pro. Nessun dato viene perso.
function canEditSnake(snakeId) {
  if (isPro()) return true;
  const idx = _snakes.findIndex((s) => s.id === snakeId);
  if (idx === -1) return true;
  return idx < FREE_SNAKE_LIMIT;
}

function lockedSnakesCount() {
  if (isPro()) return 0;
  return Math.max(0, _snakes.length - FREE_SNAKE_LIMIT);
}

// Gate da chiamare all'inizio di ogni operazione di scrittura.
function requireEditable(snakeId) {
  if (canEditSnake(snakeId)) return true;
  showLockedSnakeModal();
  return false;
}

function showLockedSnakeModal() {
  const prev = document.getElementById("locked-snake-modal");
  if (prev) prev.remove();
  const modal = document.createElement("div");
  modal.id = "locked-snake-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:600;background:rgba(8,15,9,0.92);display:flex;align-items:center;justify-content:center;padding:24px";
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:430px;width:100%;box-shadow:var(--shadow);text-align:center">
      <div style="font-size:44px;margin-bottom:10px">🔒</div>
      <div style="font-family:'Cinzel',serif;font-size:19px;color:var(--accent-gold);margin-bottom:14px">Esemplare in sola lettura</div>
      <p style="color:var(--text-mid);font-size:14px;line-height:1.6;margin:0 0 10px">Il piano Free permette di gestire attivamente i primi <strong style="color:var(--text-bright)">${FREE_SNAKE_LIMIT} serpenti</strong> inseriti.</p>
      <p style="color:var(--text-mid);font-size:14px;line-height:1.6;margin:0 0 20px">Questo esemplare resta <strong style="color:var(--text-bright)">sempre visibile</strong> con tutto il suo storico, ma per aggiungere o modificare dati serve il piano Pro.</p>
      <div class="flex-row" style="justify-content:center;gap:10px">
        <button class="btn btn-primary" style="background:var(--accent-gold);color:#0a1a0a" onclick="closeModalEl(document.getElementById('locked-snake-modal'));showUpgradeModal()">⭐ Passa a Pro</button>
        <button class="btn btn-ghost" onclick="closeModalEl(document.getElementById('locked-snake-modal'))">Chiudi</button>
      </div>
    </div>`;
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
}

// Applica lo stato "sola lettura" alla pagina di dettaglio gia' renderizzata:
// disabilita i form di inserimento e i pulsanti di modifica/eliminazione log,
// lasciando attivi Stampa / PDF / Vendi / Elimina serpente.
function applySnakeLockUI(snakeId) {
  const root = document.getElementById("main-content");
  if (!root || canEditSnake(snakeId)) return;

  root.querySelectorAll("input, select, textarea").forEach((el) => {
    el.disabled = true;
  });
  root
    .querySelectorAll(
      '[id^="btn-log-"], #btn-toggle-edit, #btn-save-edit, .log-delete',
    )
    .forEach((el) => {
      el.disabled = true;
      el.style.opacity = "0.4";
      el.style.cursor = "not-allowed";
      el.title = "Disponibile con il piano Pro";
    });

  const banner = document.createElement("div");
  banner.style.cssText =
    "margin-bottom:14px;padding:14px 16px;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.35);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap";
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;min-width:210px;flex:1">
      <div style="font-size:22px">🔒</div>
      <div>
        <div style="font-size:13px;color:var(--accent-gold);font-weight:700">Esemplare in sola lettura</div>
        <div style="font-size:12px;color:var(--text-dim);margin-top:3px;line-height:1.45">Piano Free: gestione attiva limitata ai primi ${FREE_SNAKE_LIMIT} serpenti inseriti. Lo storico resta sempre consultabile.</div>
      </div>
    </div>
    <button onclick="showUpgradeModal()" style="background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;white-space:nowrap">⭐ Sblocca con Pro</button>`;
  root.insertBefore(banner, root.firstChild);
}

async function loadUserPlan() {
  if (!_currentUser || !_currentUser.id) return;
  try {
    // Usa SB.req() che gestisce già il token correttamente
    const data = await SB.req(
      `user_plans?user_id=eq.${_currentUser.id}&select=plan,logo_url,lang,valid_until,trial_fiera_id,trial_code,trial_notified_date`,
    );
    if (data && data.length > 0) {
      _userPlan = data[0].plan || "free";
      _userLogo = data[0].logo_url || null;
      _appLang = data[0].lang || "it";
      _userValidUntil = data[0].valid_until || null;
      _userTrialFieraId = data[0].trial_fiera_id || null;
      _userTrialCode = data[0].trial_code || null;
      _userTrialNotifiedDate = data[0].trial_notified_date || null;
      applyAppLang();
      applyPlanUI();
      checkTrialCountdown();
      return;
    }
    // Fallback admin per email
    if (_currentUser.email === ADMIN_EMAIL) {
      _userPlan = "admin";
      applyPlanUI();
      return;
    }
    _userPlan = "free";
  } catch (e) {
    console.warn("loadUserPlan errore:", e);
    if (_currentUser?.email === ADMIN_EMAIL) {
      _userPlan = "admin";
    } else {
      _userPlan = "free";
    }
  }
  applyPlanUI();
}

// ═══════════════════════════════════════
//  TRIAL FIERA — countdown ultima settimana
// ═══════════════════════════════════════
function daysUntil(isoDateString) {
  if (!isoDateString) return null;
  const ms = new Date(isoDateString).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, confrontabile come stringa
}

function checkTrialCountdown() {
  if (_userPlan !== "pro" || !_userTrialFieraId || !_userValidUntil) return;
  const remaining = daysUntil(_userValidUntil);
  if (remaining === null || remaining < 0 || remaining > 7) return;
  if (_userTrialNotifiedDate === todayStr()) return; // già mostrato oggi
  showTrialCountdownModal(remaining);
  _userTrialNotifiedDate = todayStr(); // guardia locale, evita doppioni nella stessa sessione
  markTrialNotifiedServer();
}

async function markTrialNotifiedServer() {
  try {
    const session = await getSession();
    const token = session ? session.access_token : SUPABASE_KEY;
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/mark_trial_notified`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  } catch (e) {
    console.warn("mark_trial_notified fallito:", e);
  }
}

function showTrialCountdownModal(daysRemaining) {
  const prev = document.getElementById("trial-countdown-modal");
  if (prev) prev.remove();
  const modal = document.createElement("div");
  modal.id = "trial-countdown-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:650;background:rgba(8,15,9,0.92);display:flex;align-items:center;justify-content:center;padding:24px";
  const dayLabel =
    daysRemaining === 1
      ? t("trial_countdown_day_left")
      : t("trial_countdown_days_left");
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid rgba(201,168,76,0.4);border-radius:16px;padding:28px;max-width:420px;width:100%;box-shadow:var(--shadow);text-align:center">
      <div style="font-size:44px;margin-bottom:10px">⏳</div>
      <div style="font-family:'Cinzel',serif;font-size:19px;color:var(--accent-gold);margin-bottom:14px">${t("trial_countdown_title")}</div>
      <p style="color:var(--text-mid);font-size:14px;line-height:1.6;margin:0 0 8px">
        ${t("trial_countdown_desc_1")} <strong style="color:var(--text-bright)">${esc(_userTrialCode || "")}</strong>
        ${t("trial_countdown_desc_2")} <strong style="color:var(--accent-gold)">${daysRemaining} ${dayLabel}</strong>.
      </p>
      <p style="color:var(--text-dim);font-size:13px;line-height:1.6;margin:0 0 20px">${t("trial_countdown_desc_3")}</p>
      <div class="flex-row" style="justify-content:center;gap:10px">
        <button class="btn btn-primary" style="background:var(--accent-gold);color:#0a1a0a" onclick="closeModalEl(document.getElementById('trial-countdown-modal'));showPage('profilo');setTimeout(showUpgradeModal,150)">⭐ ${t("trial_countdown_cta")}</button>
        <button class="btn btn-ghost" onclick="closeModalEl(document.getElementById('trial-countdown-modal'))">${t("trial_countdown_dismiss")}</button>
      </div>
    </div>`;
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
}

// Verifica il pagamento direttamente su Stripe e aggiorna il piano
async function verifyAndUpdatePlan(sessionId) {
  showPaymentProcessingBanner();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await res.json();
    console.log("verify-checkout risposta:", data);

    if (data.error) throw new Error(data.error);

    if (data.paid && data.plan) {
      _userPlan = data.plan;
      applyPlanUI();
      hidePaymentProcessingBanner();
      showPaymentSuccessModal(data.plan);
      // Ricarica anche dal DB per sicurezza
      setTimeout(() => loadUserPlan(), 500);
      return;
    }

    // Pagamento non ancora confermato — riprova
    hidePaymentProcessingBanner();
    toast(
      "⏳ Pagamento in elaborazione. Ricarica tra qualche istante.",
      "#c9a84c",
    );
  } catch (e) {
    console.error("verifyAndUpdatePlan errore:", e);
    hidePaymentProcessingBanner();
    toast("❌ Errore verifica: " + e.message, "#c0392b");
    await loadUserPlan();
  }
}

function showPaymentProcessingBanner() {
  document.getElementById("payment-processing")?.remove();
  const banner = document.createElement("div");
  banner.id = "payment-processing";
  banner.style.cssText =
    "position:fixed;top:0;left:0;right:0;z-index:600;background:linear-gradient(135deg,#c9a84c,#e0ba5c);color:#0a1a0a;padding:14px;text-align:center;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3)";
  banner.innerHTML =
    '<span class="spinner" style="border-color:#0a1a0a;border-top-color:transparent"></span> Stiamo attivando il tuo piano...';
  document.body.appendChild(banner);
}

function hidePaymentProcessingBanner() {
  document.getElementById("payment-processing")?.remove();
}

function showPaymentSuccessModal(plan) {
  const planNames = {
    pro: "Pro",
    for_life: "For Life",
    free_forever: "Free Forever",
  };
  const modal = document.createElement("div");
  modal.id = "payment-success-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:700;background:rgba(8,15,9,0.95);display:flex;align-items:center;justify-content:center;padding:24px";
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:2px solid var(--accent-lime);border-radius:20px;padding:40px 32px;max-width:400px;width:100%;text-align:center;box-shadow:0 0 40px rgba(77,222,128,0.3);animation:successPop .5s ease">
      <div style="font-size:64px;margin-bottom:16px;animation:successBounce .6s ease">🎉</div>
      <div style="font-family:'Cinzel',serif;font-size:26px;color:var(--accent-lime);margin-bottom:12px">Pagamento riuscito!</div>
      <div style="color:var(--text-mid);font-size:15px;line-height:1.7;margin-bottom:8px">
        Benvenuto in <strong style="color:var(--accent-gold)">SnakeKeeper ${planNames[plan] || "Pro"}</strong>! 🐍
      </div>
      <div style="color:var(--text-dim);font-size:13px;margin-bottom:28px">
        Il tuo piano è ora attivo. Hai accesso a tutte le funzionalità premium.
      </div>
      <button onclick="closeModalEl(document.getElementById('payment-success-modal'))"
        style="width:100%;padding:14px;background:var(--accent-lime);color:#0a1a0a;border:none;border-radius:12px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer">
        Inizia a usare Pro →
      </button>
    </div>
  `;
  openModalEl(modal);
  // Aggiungi animazioni se non esistono
  if (!document.getElementById("success-anim-style")) {
    const style = document.createElement("style");
    style.id = "success-anim-style";
    style.textContent =
      "@keyframes successPop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}@keyframes successBounce{0%{transform:scale(0)}60%{transform:scale(1.2)}100%{transform:scale(1)}}";
    document.head.appendChild(style);
  }
}

function applyPlanUI() {
  // Mostra/nascondi pannello admin nella nav
  const adminNavSection = document.getElementById("admin-nav-section");
  const adminMnavSection = document.getElementById("admin-mnav-section");
  if (adminNavSection) adminNavSection.style.display = isAdmin() ? "" : "none";
  if (adminMnavSection)
    adminMnavSection.style.display = isAdmin() ? "" : "none";

  // Mostra badge piano nella user-info
  const userEl = document.getElementById("user-info");
  if (userEl && _currentUser) {
    const planLabels = {
      free: "🔓 Free",
      pro: "⭐ Pro",
      admin: "👑 Admin",
      free_forever: "🎁 Free Forever",
      for_life: "♾️ For Life",
    };
    const planColors = {
      free: "var(--text-dim)",
      pro: "var(--accent-lime)",
      admin: "var(--accent-gold)",
      free_forever: "var(--accent-pink)",
      for_life: "var(--accent-lime)",
    };
    userEl.innerHTML = `
      <div style="font-size:11px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">👤 ${esc(_currentUser.email || "")}</div>
      <div style="font-size:10px;color:${planColors[_userPlan] || "var(--text-dim)"};margin-top:2px;font-weight:600">${planLabels[_userPlan] || "Free"}</div>
    `;
  }
}

function showUpgradeModal() {
  loadScriptOnce("https://js.stripe.com/v3/").catch((err) =>
    console.warn("[Stripe]", err.message),
  );
  document.getElementById("upgrade-modal")?.remove();
  const modal = document.createElement("div");
  modal.id = "upgrade-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:500;background:rgba(8,15,9,0.92);display:flex;align-items:center;justify-content:center;padding:16px;padding-bottom:calc(16px + var(--safe-bottom))";
  modal.innerHTML = `
    <div class="upgrade-card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:var(--shadow)">
      <div style="font-size:48px;margin-bottom:12px">🐍</div>
      <div style="font-family:'Cinzel',serif;font-size:22px;color:var(--accent-gold);margin-bottom:8px">Passa a Pro</div>
      <div style="color:var(--text-mid);font-size:14px;line-height:1.6;margin-bottom:20px">
        Con il piano gratuito puoi gestire fino a <strong style="color:var(--text-bright)">${FREE_SNAKE_LIMIT} serpenti</strong>.<br>
        Passa a <strong style="color:var(--accent-gold)">SnakeKeeper Pro</strong> per serpenti illimitati.
      </div>

      <!-- Features -->
      <div style="background:var(--bg-moss);border-radius:12px;padding:14px;margin-bottom:20px;text-align:left">
        ${[
          "🐍 Serpenti illimitati",
          "📊 Statistiche avanzate",
          "📄 Export PDF & Excel",
          "☁️ Backup prioritario",
          "✅ Supporto dedicato",
        ]
          .map(
            (f) => `
          <div style="font-size:13px;color:var(--text-mid);margin:5px 0;display:flex;align-items:center;gap:6px">${f}</div>`,
          )
          .join("")}
      </div>

      <!-- Scelta piano -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
        <div id="plan-monthly" onclick="selectPlan('monthly')" style="cursor:pointer;border:2px solid var(--accent-gold);border-radius:10px;padding:14px;background:rgba(201,168,76,0.08)">
          <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Mensile</div>
          <div style="font-size:22px;font-weight:700;color:var(--accent-gold)">€4.99</div>
          <div style="font-size:11px;color:var(--text-dim)">al mese</div>
        </div>
        <div id="plan-yearly" onclick="selectPlan('yearly')" style="cursor:pointer;border:2px solid var(--border);border-radius:10px;padding:14px;position:relative">
          <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--accent-lime);color:#0a1a0a;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;white-space:nowrap">RISPARMIA 20%</div>
          <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Annuale</div>
          <div style="font-size:22px;font-weight:700;color:var(--text-bright)">€47.99</div>
          <div style="font-size:11px;color:var(--text-dim)">all'anno</div>
        </div>
      </div>
      <div id="plan-for_life" onclick="selectPlan('for_life')" style="cursor:pointer;border:2px solid var(--border);border-radius:10px;padding:14px;position:relative;margin-bottom:16px;background:linear-gradient(135deg,rgba(109,181,109,0.05),rgba(201,168,76,0.05))">
        <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,var(--accent-lime),var(--accent-gold));color:#0a1a0a;font-size:10px;font-weight:700;padding:2px 14px;border-radius:20px;white-space:nowrap">✨ PAGHI UNA VOLTA</div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">For Life</div>
            <div style="font-size:22px;font-weight:700;color:var(--accent-lime)">€199</div>
            <div style="font-size:11px;color:var(--text-dim)">una tantum — per sempre</div>
          </div>
          <div style="font-size:11px;color:var(--text-dim);text-align:right;line-height:1.6">
            Tutti gli aggiornamenti<br>futuri inclusi 🐍
          </div>
        </div>
      </div>

      <button id="btn-checkout" onclick="startCheckout()"
        style="width:100%;padding:14px;background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;margin-bottom:10px">
        ⭐ Inizia con il piano Mensile
      </button>
      <button onclick="closeModalEl(document.getElementById('upgrade-modal'))"
        style="width:100%;padding:10px;background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:'Inter',sans-serif;cursor:pointer">
        Rimani sul piano Free
      </button>
      <div style="font-size:11px;color:var(--text-dim);margin-top:12px">🔒 Pagamento sicuro con Stripe · Annulla quando vuoi</div>
    </div>`;
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
  _selectedPlan = "monthly";
}

let _selectedPlan = "monthly";

function selectPlan(plan) {
  _selectedPlan = plan;
  const monthly = document.getElementById("plan-monthly");
  const yearly = document.getElementById("plan-yearly");
  const forLife = document.getElementById("plan-for_life");
  const btn = document.getElementById("btn-checkout");
  // Reset tutti
  [monthly, yearly, forLife].forEach((el) => {
    if (el) {
      el.style.border = "2px solid var(--border)";
      el.style.background = "transparent";
    }
  });
  if (plan === "monthly") {
    monthly.style.border = "2px solid var(--accent-gold)";
    monthly.style.background = "rgba(201,168,76,0.08)";
    btn.textContent = "⭐ Inizia con il piano Mensile — €4.99/mese";
  } else if (plan === "yearly") {
    yearly.style.border = "2px solid var(--accent-gold)";
    yearly.style.background = "rgba(201,168,76,0.08)";
    btn.textContent = "⭐ Inizia con il piano Annuale — €47.99/anno";
  } else if (plan === "for_life") {
    forLife.style.border = "2px solid var(--accent-lime)";
    forLife.style.background =
      "linear-gradient(135deg,rgba(109,181,109,0.1),rgba(201,168,76,0.1))";
    btn.textContent = "✨ Acquista For Life — €199 una tantum";
  }
}

async function startCheckout() {
  const btn = document.getElementById("btn-checkout");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Reindirizzamento...';
  try {
    // Chiama la Edge Function per creare la sessione di checkout
    const _authSession = await getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_authSession ? _authSession.access_token : ""}`,
      },
      body: JSON.stringify({
        plan: _selectedPlan,
        email: _currentUser?.email || null,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error("URL checkout non ricevuto");
    }
  } catch (e) {
    toast("❌ Errore checkout: " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "⭐ Riprova";
  }
}

// ── PANNELLO ADMIN ──────────────────────────────────────────────────────────
async function renderAdmin() {
  if (!isAdmin()) {
    showPage("dashboard");
    return;
  }
  document.getElementById("main-content").innerHTML = `
    <div class="page-header">
      <h2>👑 Pannello Admin</h2>
      <p>Gestione utenti e piani · Solo per amministratori</p>
    </div>
    <div id="admin-content">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px">
        <span class="spinner" style="width:28px;height:28px;border-width:3px"></span>
      </div>
    </div>`;
  await loadAdminData();
}

async function loadAdminData() {
  try {
    const session = await getSession();
    const token = session ? session.access_token : SUPABASE_KEY;

    // Carica tutti i piani
    const plansRes = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/get_all_user_plans`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    if (!plansRes.ok) {
      const errBody = await plansRes.json().catch(() => ({}));
      throw new Error(
        errBody.message ||
          errBody.hint ||
          `Errore ${plansRes.status} nel caricare gli utenti`,
      );
    }
    const plans = await plansRes.json();

    // Statistiche VERE di tutta la piattaforma (non solo le tue)
    let globalStats = {
      serpenti_totali: "—",
      log_totali: "—",
      venduti_totali: "—",
      utenti_con_serpenti: "—",
    };
    try {
      const statsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/get_global_app_stats`,
        {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      if (statsRes.ok) globalStats = await statsRes.json();
    } catch (e) {
      console.warn("Statistiche globali non disponibili:", e);
    }

    const planLabels = {
      free: "🔓 Free",
      pro: "⭐ Pro",
      admin: "👑 Admin",
      free_forever: "🎁 Free Forever",
      for_life: "♾️ For Life",
    };
    const planColors = {
      free: "var(--text-dim)",
      pro: "var(--accent-lime)",
      admin: "var(--accent-gold)",
      free_forever: "var(--accent-pink)",
      for_life: "var(--accent-lime)",
    };

    const statsHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:24px">
        ${[
          [
            "👑",
            "Admin",
            plans.filter((p) => p.plan === "admin").length,
            "var(--accent-gold)",
          ],
          [
            "⭐",
            "Pro",
            plans.filter((p) => p.plan === "pro").length,
            "var(--accent-lime)",
          ],
          [
            "♾️",
            "For Life",
            plans.filter((p) => p.plan === "for_life").length,
            "var(--accent-lime)",
          ],
          [
            "🎁",
            "Free Forever",
            plans.filter((p) => p.plan === "free_forever").length,
            "var(--accent-pink)",
          ],
          [
            "🔓",
            "Free",
            plans.filter((p) => p.plan === "free").length,
            "var(--text-dim)",
          ],
          ["👥", "Totale", plans.length, "var(--text-bright)"],
        ]
          .map(
            ([ico, lab, val, col]) => `
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:22px">${ico}</div>
            <div style="font-size:20px;font-weight:700;color:${col};margin:4px 0">${val}</div>
            <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">${lab}</div>
          </div>`,
          )
          .join("")}
      </div>`;

    const tableHtml =
      plans.length === 0
        ? `
      <div class="card" style="text-align:center;padding:32px;color:var(--text-dim)">
        Nessun utente registrato nella tabella piani.<br>
        <span style="font-size:12px">Gli utenti appaiono qui dopo il primo accesso o quando aggiunti manualmente.</span>
      </div>`
        : `
      <div class="card">
        <div class="card-title">📋 Utenti Registrati</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:10px 8px;color:var(--text-dim);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:1px">Email</th>
                <th style="text-align:left;padding:10px 8px;color:var(--text-dim);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:1px">Piano</th>
                <th style="text-align:left;padding:10px 8px;color:var(--text-dim);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:1px">Note</th>
                <th style="text-align:right;padding:10px 8px;color:var(--text-dim);font-weight:500;font-size:11px;text-transform:uppercase;letter-spacing:1px">Azioni</th>
              </tr>
            </thead>
            <tbody>
              ${plans
                .map(
                  (p) => `
                <tr style="border-bottom:1px solid rgba(45,80,48,0.4)" id="row-${p.user_id}">
                  <td style="padding:12px 8px;color:var(--text-bright)">${p.email ? esc(p.email) : '<span style="color:var(--text-dim);font-style:italic">—</span>'}</td>
                  <td style="padding:12px 8px">
                    <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:rgba(0,0,0,0.3);color:${planColors[p.plan] || "var(--text-dim)"}">
                      ${planLabels[p.plan] || esc(p.plan)}
                    </span>
                  </td>
                  <td style="padding:12px 8px;color:var(--text-dim);font-size:12px">${esc(p.notes) || "—"}</td>
                  <td style="padding:12px 8px;text-align:right">
                    ${
                      // Era: p.user_id === "${_currentUser.id}" — dentro un ${} quelle
                      // virgolette fanno una stringa normale, non un template literal, quindi
                      // il confronto era contro i caratteri letterali "${_currentUser.id}" ed
                      // era sempre falso: l'admin vedeva la tendina anche sulla propria riga e
                      // poteva declassare se stesso.
                      p.user_id === _currentUser?.id
                        ? `<span style="font-size:11px;color:var(--accent-gold)">👑 Tu (Admin)</span>`
                        : `
                    <select onchange="changePlan('${p.user_id}', this.value)" 
                      style="background:var(--bg-moss);color:var(--text-mid);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;font-family:'Inter',sans-serif;cursor:pointer">
                      ${["free", "pro", "for_life", "admin", "free_forever"].map((pl) => `<option value="${pl}" ${p.plan === pl ? "selected" : ""}>${planLabels[pl]}</option>`).join("")}
                    </select>`
                    }
                  </td>
                </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    const addUserHtml = `
      <div class="card" style="margin-top:16px">
        <div class="card-title">➕ Aggiungi Utente Manualmente</div>
        <p style="font-size:13px;color:var(--text-dim);margin-bottom:16px">Inserisci l'UUID Supabase dell'utente e assegnagli un piano.</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="form-group">
            <label>UUID Utente (da Supabase Dashboard)</label>
            <input type="text" id="admin-uuid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" style="font-family:monospace;font-size:12px">
          </div>
          <div class="form-group">
            <label>Email (opzionale, solo per riferimento)</label>
            <input type="text" id="admin-email" placeholder="utente@email.com" autocomplete="off">
          </div>
          <div class="form-group">
            <label>Piano</label>
            <select id="admin-plan" style="background:var(--bg-moss);color:var(--text-mid);border:1px solid var(--border);border-radius:8px;padding:10px;font-family:'Inter',sans-serif">
              <option value="free">🔓 Free</option>
              <option value="free_forever" selected>🎁 Free Forever</option>
              <option value="pro">⭐ Pro</option>
              <option value="for_life">♾️ For Life</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>
          <div class="form-group">
            <label>Note (opzionale)</label>
            <input type="text" id="admin-notes" placeholder="es. Utente speciale — accesso gratuito" autocomplete="off">
          </div>
          <button class="btn btn-primary" onclick="adminAddUser()" id="btn-admin-add">➕ Aggiungi Utente</button>
        </div>
      </div>`;

    const statsGlobaliHtml = `
      <div class="card" style="margin-top:16px">
        <div class="card-title">📊 Statistiche Globali App</div>
        <p style="font-size:11px;color:var(--text-dim);margin-bottom:12px">Dati aggregati di tutti gli utenti della piattaforma</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">
          ${[
            [
              "🐍",
              "Serpenti totali",
              globalStats.serpenti_totali,
              "var(--accent-lime)",
            ],
            ["📋", "Log totali", globalStats.log_totali, "var(--accent-gold)"],
            [
              "💰",
              "Venduti totali",
              globalStats.venduti_totali,
              "var(--accent-pink)",
            ],
            [
              "👥",
              "Utenti con serpenti",
              globalStats.utenti_con_serpenti,
              "var(--accent-lime)",
            ],
          ]
            .map(
              ([ico, lab, val, col]) => `
            <div style="background:var(--bg-moss);border-radius:10px;padding:14px;text-align:center">
              <div style="font-size:20px">${ico}</div>
              <div style="font-size:20px;font-weight:700;color:${col};margin:4px 0">${val}</div>
              <div style="font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px">${lab}</div>
            </div>`,
            )
            .join("")}
        </div>
      </div>`;

    document.getElementById("admin-content").innerHTML =
      statsHtml +
      tableHtml +
      addUserHtml +
      statsGlobaliHtml +
      `<div id="admin-fiera-section" style="margin-top:16px"></div>`;
    loadAdminFiera(plans);
  } catch (e) {
    document.getElementById("admin-content").innerHTML =
      `<div class="card" style="color:var(--accent-red)">Errore caricamento: ${e.message}</div>`;
  }
}

// ═══════════════════════════════════════
//  ADMIN — GESTIONE FIERE / TRIAL PROMOZIONALI
// ═══════════════════════════════════════
async function loadAdminFiera(plans) {
  const el = document.getElementById("admin-fiera-section");
  if (!el) return;
  el.innerHTML = `<div class="card"><div style="display:flex;align-items:center;justify-content:center;padding:20px"><span class="spinner"></span></div></div>`;
  try {
    const eventi = await SB.req("fiere_eventi?select=*&order=created_at.desc");
    renderAdminFiera(eventi, plans || []);
  } catch (e) {
    el.innerHTML = `<div class="card" style="color:var(--accent-red)">Errore caricamento fiere: ${e.message}</div>`;
  }
}

let _fieraEventiCache = [];

function renderAdminFiera(eventi, plans) {
  const el = document.getElementById("admin-fiera-section");
  if (!el) return;
  _fieraEventiCache = eventi;
  const baseUrl =
    window.location.origin +
    window.location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");

  // Stato "vero" del codice in questo momento: attivo=true non basta se le
  // date lo escludono. Questo badge riflette esattamente cio' che decide
  // check_fiera_code() lato server, non solo il flag manuale.
  function fieraStatoReale(ev) {
    const oggi = new Date().toISOString().slice(0, 10);
    if (!ev.attivo) return null; // il badge DISATTIVO copre già questo caso
    if (ev.data_fine && oggi > ev.data_fine)
      return { label: "⏱️ SCADUTA", color: "var(--accent-red)" };
    if (ev.data_inizio && oggi < ev.data_inizio)
      return { label: "🕓 NON INIZIATA", color: "var(--accent-gold)" };
    return null;
  }

  const listHtml =
    eventi.length === 0
      ? `
    <p style="color:var(--text-dim);font-size:13px;padding:8px 0">Nessun evento fiera creato ancora.</p>`
      : eventi
          .map((ev) => {
            const count = plans.filter(
              (p) => p.trial_fiera_id === ev.id,
            ).length;
            const link = `${baseUrl}/fiera.html?c=${encodeURIComponent(ev.codice_promo)}`;
            const statoReale = fieraStatoReale(ev);
            return `
    <div class="card" style="margin-bottom:10px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-weight:700;color:var(--text-bright);font-size:14px">
            ${esc(ev.nome)}
            ${ev.attivo ? `<span style="margin-left:8px;padding:2px 8px;border-radius:20px;font-size:10px;background:rgba(109,191,109,0.15);color:var(--accent-lime)">ATTIVO</span>` : `<span style="margin-left:8px;padding:2px 8px;border-radius:20px;font-size:10px;background:rgba(0,0,0,0.3);color:var(--text-dim)">DISATTIVO</span>`}
            ${statoReale ? `<span style="margin-left:6px;padding:2px 8px;border-radius:20px;font-size:10px;background:rgba(0,0,0,0.3);color:${statoReale.color}">${statoReale.label}</span>` : ""}
          </div>
          <div style="font-size:12px;color:var(--text-dim);margin-top:4px">
            ${ev.luogo ? esc(ev.luogo) + " · " : ""}${ev.data_inizio ? ev.data_inizio : "?"} → ${ev.data_fine ? ev.data_fine : "?"}
            · Trial ${ev.durata_trial_giorni} giorni · <strong style="color:var(--accent-gold)">${count}</strong> iscritti
          </div>
          <div style="font-family:monospace;font-size:12px;color:var(--accent-lime);margin-top:6px;word-break:break-all">${esc(link)}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px" onclick="copyFieraLink('${esc(link)}')">📋 Copia link</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px" onclick="showFieraQr('${esc(link)}','${esc(ev.nome)}')">📱 QR</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px;color:var(--accent-gold)" onclick="printVolantinoFiera('${ev.id}')">🖨️ Volantino</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px" onclick="editFieraEvent('${ev.id}')">✏️ Modifica</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px" onclick="showFieraHistory('${ev.id}','${esc(ev.nome)}')">🕓 Cronologia</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px" onclick="toggleFieraAttivo('${ev.id}', ${ev.attivo})">${ev.attivo ? "⏸️ Disattiva" : "▶️ Riattiva"}</button>
          <button class="btn btn-ghost" style="padding:6px 10px;font-size:11px;color:var(--accent-red)" onclick="deleteFieraEvent('${ev.id}', ${count})">🗑️</button>
        </div>
      </div>
    </div>`;
          })
          .join("");

  el.innerHTML = `
    <div class="card">
      <div class="card-title">🎪 Fiera — Iscrizioni trial promozionali</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px">Crea un evento fiera: verrà generato un link/QR condivisibile che porta a una landing page pubblica dove i visitatori possono registrarsi con email, password e il codice promo per ottenere Pro gratis per la durata scelta.</p>
      ${listHtml}
      <div style="border-top:1px solid var(--border);margin-top:16px;padding-top:16px">
        <div style="font-weight:600;color:var(--text-bright);font-size:13px;margin-bottom:10px">➕ Nuovo evento fiera</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div class="form-group">
            <label>Nome evento</label>
            <input type="text" id="fiera-nome" placeholder="es. Reptile Expo Verona 2026" autocomplete="off" oninput="autoSuggestFieraCode()">
          </div>
          <div class="form-group">
            <label>Luogo (opzionale)</label>
            <input type="text" id="fiera-luogo" placeholder="es. Verona" autocomplete="off">
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:140px">
              <label>Data inizio</label>
              <input type="date" id="fiera-data-inizio">
            </div>
            <div class="form-group" style="flex:1;min-width:140px">
              <label>Data fine</label>
              <input type="date" id="fiera-data-fine">
            </div>
          </div>
          <p style="font-size:11px;color:var(--text-dim);margin-top:-4px">Se imposti le date, il codice funzionerà SOLO in quell'intervallo (fuso orario italiano). Lasciale vuote per nessun limite di date.</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <div class="form-group" style="flex:1;min-width:140px">
              <label>Codice promo</label>
              <input type="text" id="fiera-codice" placeholder="es. VERONA26" autocomplete="off" style="font-family:monospace;text-transform:uppercase">
            </div>
            <div class="form-group" style="flex:1;min-width:140px">
              <label>Durata trial (giorni)</label>
              <input type="number" id="fiera-durata" value="90" min="1" max="730">
            </div>
          </div>
          <button class="btn btn-primary" onclick="createFieraEvent()" id="btn-crea-fiera">🎪 Crea evento e genera link</button>
        </div>
      </div>
    </div>`;
}

function autoSuggestFieraCode() {
  const codeEl = document.getElementById("fiera-codice");
  if (!codeEl || codeEl.dataset.touched) return; // non sovrascrive se l'admin ha già digitato manualmente
  const nome = document.getElementById("fiera-nome").value;
  const slug = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
  const year = new Date().getFullYear().toString().slice(-2);
  codeEl.value = slug ? `${slug}${year}` : "";
}

async function createFieraEvent() {
  const nome = document.getElementById("fiera-nome").value.trim();
  const luogo = document.getElementById("fiera-luogo").value.trim();
  const data_inizio =
    document.getElementById("fiera-data-inizio").value || null;
  const data_fine = document.getElementById("fiera-data-fine").value || null;
  const codice = document
    .getElementById("fiera-codice")
    .value.trim()
    .toUpperCase();
  const durata =
    parseInt(document.getElementById("fiera-durata").value, 10) || 90;

  if (!nome) {
    toast("Inserisci il nome evento!", "#c0392b");
    return;
  }
  if (!codice || !/^[A-Z0-9]{4,32}$/.test(codice)) {
    toast(
      "Codice promo non valido (solo lettere/numeri, min 4 caratteri)",
      "#c0392b",
    );
    return;
  }
  if (data_inizio && data_fine && data_fine < data_inizio) {
    toast(
      "❌ La data di fine non può essere precedente alla data di inizio!",
      "#c0392b",
    );
    return;
  }

  const btn = document.getElementById("btn-crea-fiera");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creazione...';
  try {
    await SB.req("fiere_eventi", {
      method: "POST",
      body: JSON.stringify({
        nome,
        luogo: luogo || null,
        data_inizio,
        data_fine,
        codice_promo: codice,
        durata_trial_giorni: durata,
      }),
    });
    toast("✅ Evento fiera creato!");
    await loadAdminData();
  } catch (e) {
    let msg = e.message;
    if (msg.includes("duplicate") || msg.includes("unique"))
      msg = "Codice promo già in uso";
    else if (msg.includes("fiere_eventi_date_range_check"))
      msg = "La data di fine non può essere precedente alla data di inizio";
    else if (msg.includes("fiere_eventi_durata_positiva_check"))
      msg = "La durata del trial deve essere maggiore di zero";
    toast("❌ " + msg, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "🎪 Crea evento e genera link";
  }
}

async function toggleFieraAttivo(id, current) {
  try {
    await SB.req(`fiere_eventi?id=eq.${id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify({ attivo: !current }),
    });
    toast("✅ Stato evento aggiornato!");
    await loadAdminData();
  } catch (e) {
    toast("❌ " + e.message, "#c0392b");
  }
}

async function deleteFieraEvent(id, count) {
  if (count > 0) {
    toast(
      "⚠️ Questo evento ha iscritti: non può essere eliminato, disattivalo invece.",
      "#c0392b",
    );
    return;
  }
  if (!confirm("Eliminare definitivamente questo evento fiera?")) return;
  try {
    await SB.req(`fiere_eventi?id=eq.${id}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    toast("✅ Evento eliminato!");
    await loadAdminData();
  } catch (e) {
    toast("❌ " + e.message, "#c0392b");
  }
}

function copyFieraLink(link) {
  navigator.clipboard
    .writeText(link)
    .then(() => toast("✅ Link copiato negli appunti!"))
    .catch(() => toast("❌ Impossibile copiare il link", "#c0392b"));
}

function showFieraQr(link, nome) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(link)}`;
  const overlay = document.createElement("div");
  overlay.id = "fiera-qr-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:1000;background:rgba(6,13,7,0.92);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out";
  overlay.innerHTML = `
    <div style="background:#fff;padding:20px;border-radius:16px;text-align:center;max-width:340px;cursor:default" onclick="event.stopPropagation()">
      <img src="${qrUrl}" width="280" height="280" style="display:block;border-radius:8px">
      <div style="margin-top:10px;font-family:'Cinzel',serif;color:#1a2e1a;font-size:14px;font-weight:700">${esc(nome)}</div>
      <button class="btn btn-ghost" style="margin-top:10px" onclick="document.getElementById('fiera-qr-overlay').remove()">Chiudi</button>
    </div>`;
  overlay.addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════
//  ADMIN FIERA — VOLANTINO A5 STAMPABILE
// ═══════════════════════════════════════
// Volantino da banchetto: A5 fronte-retro nello stile della landing, col QR
// dell'evento in basso sul fronte. Si genera in una finestra a parte perché
// l'unico @media print del sito (style.css) nasconde ogni figlio di <body> e
// mostra solo #print-area: stampare index.html darebbe una pagina bianca.
//
// Tre dettagli che sembrano cosmetici e non lo sono:
//  - print-color-adjust:exact, senza il quale il browser scarta il fondo scuro
//    in stampa e il volantino esce bianco con testo chiaro, cioè illeggibile;
//  - QR a 1000px invece dei 260px usati altrove: a 45mm quello piccolo starebbe
//    sotto i 150 dpi e in stampa diventa inaffidabile da inquadrare;
//  - nessun print() automatico, perché il QR è un'immagine remota che potrebbe
//    non essere ancora arrivata (stessa scelta di printLabel).
function printVolantinoFiera(id) {
  const ev = _fieraEventiCache.find((e) => e.id === id);
  if (!ev) return;

  if (
    !ev.attivo &&
    !confirm(
      `"${ev.nome}" è disattivato: il codice ${ev.codice_promo} in questo momento non funziona.\n\nStampare comunque il volantino?`,
    )
  )
    return;

  const baseUrl =
    window.location.origin +
    window.location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");
  const link = `${baseUrl}/fiera.html?c=${encodeURIComponent(ev.codice_promo)}`;
  const qrGrande = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(link)}&margin=0&color=0d1f0f&bgcolor=ffffff`;
  const qrPiccolo = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(link)}&margin=0&color=0d1f0f&bgcolor=ffffff`;

  // Luogo e date sono opzionali: la riga si costruisce solo con quello che c'è,
  // altrimenti restano trattini e separatori appesi nel vuoto.
  const periodo =
    ev.data_inizio && ev.data_fine
      ? `${fmtDate(ev.data_inizio)} – ${fmtDate(ev.data_fine)}`
      : ev.data_inizio
        ? `dal ${fmtDate(ev.data_inizio)}`
        : ev.data_fine
          ? `fino al ${fmtDate(ev.data_fine)}`
          : "";
  const sottoTitoloEvento = [ev.luogo, periodo]
    .filter(Boolean)
    .map(esc)
    .join(" · ");

  const FEATURES = [
    [
      "🐍",
      "Schede complete",
      "Specie, morfo, sesso, provenienza, foto e tutto quello che serve per ogni esemplare.",
    ],
    [
      "🥩",
      "Registro pasti",
      "Traccia ogni pasto con tipo di preda, peso e note. Ricevi alert se un serpente non mangia.",
    ],
    [
      "⚖️",
      "Monitoraggio peso",
      "Curva di crescita nel tempo con grafico. Tieni sotto controllo la salute di ogni esemplare.",
    ],
    [
      "🦎",
      "Registro mute",
      "Traccia ogni ecdisi con data e esito. Identifica problemi prima che diventino seri.",
    ],
    [
      "📄",
      "Export PDF",
      "Genera una scheda professionale per ogni serpente da condividere col veterinario.",
    ],
    [
      "💰",
      "Gestione vendite",
      "Registra ogni vendita con acquirente e prezzo, e passa la scheda completa al cliente.",
    ],
  ];
  const PASSI = [
    [
      "Registrati",
      "Inquadra il QR e crea il tuo account. Nessuna carta richiesta.",
    ],
    [
      "Aggiungi i tuoi serpenti",
      "Inserisci le schede dei tuoi esemplari con foto e dati.",
    ],
    [
      "Inizia a tracciare",
      "Registra pasti, mute, pesi e tutto il resto in pochi tap.",
    ],
  ];

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Volantino — ${esc(ev.nome)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #4a4a4a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

@page { size: A5; margin: 0; }

.facciata {
  width: 148mm; height: 210mm;
  background: #060d07; color: #c8d5c9;
  font-family: 'Inter', Arial, sans-serif;
  padding: 9mm 9mm;
  display: flex; flex-direction: column;
  position: relative; overflow: hidden;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
/* Alone verde/oro della hero, riprodotto come due radiali morbide */
.facciata::before { content:''; position:absolute; top:-30mm; left:50%; transform:translateX(-50%);
  width:150mm; height:90mm; background:radial-gradient(ellipse,rgba(77,222,128,0.10) 0%,transparent 70%); pointer-events:none; }
.facciata::after { content:''; position:absolute; bottom:-20mm; left:-30mm;
  width:120mm; height:80mm; background:radial-gradient(ellipse,rgba(201,168,76,0.08) 0%,transparent 70%); pointer-events:none; }
.facciata > * { position: relative; z-index: 1; }

/* ── Lockup ── */
.marchio { text-align:center; }
.marchio-nome { font-family:'Cinzel',serif; font-weight:700; font-size:19pt; color:#c9a84c; letter-spacing:2.5px; }
.marchio-sub { font-size:6.5pt; color:#6b8f6e; letter-spacing:2.5px; text-transform:uppercase; margin-top:1.5mm; }
.filetto { height:1mm; width:34mm; margin:3.5mm auto 0; border-radius:1mm;
  background:linear-gradient(90deg,#4ade80,#c9a84c); }

/* ── Fronte ── */
.centro { flex:1; display:flex; flex-direction:column; justify-content:center; text-align:center; }
.titolo { font-family:'Cinzel',serif; font-size:25pt; line-height:1.15; letter-spacing:-0.01em;
  background:linear-gradient(135deg,#4ade80,#c9a84c); -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent; color:#c9a84c; }
.sottotitolo { font-size:9.5pt; line-height:1.65; color:#a0b5a1; margin-top:5mm; padding:0 4mm; }

.offerta { margin-top:7mm; border:0.4mm solid rgba(201,168,76,0.5); background:rgba(20,40,22,0.8);
  border-radius:5mm; padding:5mm 4mm; }
.offerta-nome { font-family:'Cinzel',serif; font-size:13pt; color:#fff; }
.offerta-dove { font-size:8pt; color:#6b8f6e; margin-top:1.5mm; }
.offerta-premio { font-size:14pt; font-weight:600; color:#4ade80; margin-top:3.5mm; line-height:1.3; }

/* ── QR ── */
.qr-zona { text-align:center; margin-top:auto; }
.qr-invito { font-size:8pt; color:#6b8f6e; letter-spacing:1.5px; text-transform:uppercase; margin-bottom:3mm; }
.qr-cornice { width:47mm; height:47mm; margin:0 auto; background:#fff; border-radius:3mm; padding:2.5mm; }
.qr-cornice img { display:block; width:100%; height:100%; }
.qr-codice { margin-top:3.5mm; font-family:'Courier New',monospace; font-size:12pt; font-weight:700;
  color:#c9a84c; letter-spacing:3px; }
.qr-manuale { font-size:6.5pt; color:#4a6b4d; margin-top:1.5mm; }
.piede { text-align:center; margin-top:5mm; font-size:8pt; color:#6b8f6e; }
.piede strong { color:#c8d5c9; font-weight:600; }

/* ── Retro ── */
.occhiello { font-size:7pt; color:#4ade80; text-transform:uppercase; letter-spacing:3px; text-align:center; margin-top:4mm; }
.titolo-sez { font-family:'Cinzel',serif; font-size:14pt; color:#fff; text-align:center; margin-top:2mm; }
/* gap e padding qui sotto sono volutamente spaiati (2.4 e 2.6 invece di 2.8 e 3):
   arrotondandoli il retro cresce di 3.2mm e la riga di chiusura scende a 5.8mm dal
   bordo, dentro il margine che molte stampanti non stampano. Il fronte non ha il
   problema perché il QR è ancorato con margin-top:auto e assorbe lo scarto. */
.griglia { display:grid; grid-template-columns:1fr 1fr; gap:2.4mm; margin-top:4mm; }
.funz { background:rgba(13,31,15,0.6); border:0.3mm solid rgba(45,80,48,0.4); border-radius:3mm; padding:2.6mm; }
.funz-ico { font-size:11pt; }
.funz-nome { font-size:8.5pt; font-weight:600; color:#c8d5c9; margin-top:1mm; }
.funz-desc { font-size:6.8pt; line-height:1.4; color:#6b8f6e; margin-top:1mm; }
.passo { display:flex; gap:3mm; align-items:flex-start; margin-top:2.8mm; }
.passo-num { flex:0 0 6.5mm; height:6.5mm; border-radius:50%; background:linear-gradient(135deg,#4ade80,#2d9b4a);
  color:#060d07; font-family:'Cinzel',serif; font-weight:700; font-size:8.5pt;
  display:flex; align-items:center; justify-content:center; }
.passo-testo-nome { font-size:8.5pt; font-weight:600; color:#c8d5c9; }
.passo-testo-desc { font-size:7pt; line-height:1.45; color:#6b8f6e; margin-top:0.5mm; }
.rassicura { display:flex; justify-content:center; gap:5mm; margin-top:4mm;
  border-top:0.3mm solid rgba(45,80,48,0.4); padding-top:3mm; font-size:7pt; color:#6b8f6e; }
.chiusura { margin-top:auto; display:flex; align-items:center; gap:4mm;
  border-top:0.3mm solid rgba(45,80,48,0.4); padding-top:3.5mm; }
.chiusura-qr { flex:0 0 18mm; height:18mm; background:#fff; border-radius:2mm; padding:1.2mm; }
.chiusura-qr img { display:block; width:100%; height:100%; }
.chiusura-sito { font-family:'Cinzel',serif; font-size:12pt; color:#c9a84c; }
.chiusura-riga { font-size:7.5pt; color:#6b8f6e; margin-top:1.5mm; line-height:1.6; }

/* ── Barra di servizio, solo a schermo ── */
.no-print { position:sticky; top:0; z-index:10; background:#1a3320; color:#e8f5e0;
  padding:12px 16px; font-family:'Inter',Arial,sans-serif; font-size:13px;
  display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.no-print button { padding:8px 16px; border:none; border-radius:8px; cursor:pointer;
  font-family:'Inter',Arial,sans-serif; font-size:13px; font-weight:600; }
.no-print .stampa { background:#c9a84c; color:#1a0f00; }
.no-print .chiudi { background:transparent; color:#a8c8a0; border:1px solid #2d5030; }
.no-print .nota { font-size:11px; color:#a8c8a0; line-height:1.5; flex:1 1 240px; min-width:0; }

@media screen { .facciata { margin:16px auto; box-shadow:0 6px 30px rgba(0,0,0,0.6); } }
@media print {
  .no-print { display:none !important; }
  html, body { background:#fff; }
  .facciata { margin:0; box-shadow:none; }
  /* Solo TRA le due facciate: un page-break dopo l'ultima creerebbe una terza pagina vuota */
  .facciata + .facciata { page-break-before: always; }
}
</style>
</head>
<body>

<div class="no-print">
  <button class="stampa" onclick="window.print()">🖨️ Stampa</button>
  <button class="chiudi" onclick="window.close()">✕ Chiudi</button>
  <div class="nota">
    Formato A5 fronte-retro. Per il file da portare in tipografia: <strong>Stampa → Salva come PDF</strong>.<br>
    Il fondo scuro consuma parecchio inchiostro: in stampa casalinga conviene provarne prima una copia.
  </div>
</div>

<!-- ═══════════ FRONTE ═══════════ -->
<div class="facciata">
  <div class="marchio">
    <div class="marchio-nome">🐍 SNAKEKEEPER</div>
    <div class="marchio-sub">Gestionale Allevamento</div>
    <div class="filetto"></div>
  </div>

  <div class="centro">
    <div class="titolo">Gestisci il tuo<br>allevamento<br>come un professionista</div>
    <div class="sottotitolo">
      Schede dettagliate, registro pasti, monitoraggio mute e peso.<br>
      Tutto il tuo allevamento in un unico posto.
    </div>

    <div class="offerta">
      <div class="offerta-nome">🎪 ${esc(ev.nome)}</div>
      ${sottoTitoloEvento ? `<div class="offerta-dove">${sottoTitoloEvento}</div>` : ""}
      <div class="offerta-premio">${ev.durata_trial_giorni} giorni di<br>SnakeKeeper Pro gratis</div>
    </div>
  </div>

  <div class="qr-zona">
    <div class="qr-invito">Inquadra con la fotocamera</div>
    <div class="qr-cornice"><img src="${qrGrande}" alt="QR"></div>
    <div class="qr-codice">${esc(ev.codice_promo)}</div>
    <div class="qr-manuale">oppure inserisci il codice a mano su snakekeeper.it/fiera.html</div>
    <div class="piede"><strong>snakekeeper.it</strong> · Nessuna carta di credito richiesta</div>
  </div>
</div>

<!-- ═══════════ RETRO ═══════════ -->
<div class="facciata">
  <div class="marchio">
    <div class="marchio-nome">🐍 SNAKEKEEPER</div>
    <div class="filetto"></div>
  </div>

  <div class="occhiello">Funzionalità</div>
  <div class="titolo-sez">Tutto quello che ti serve</div>

  <div class="griglia">
    ${FEATURES.map(
      ([ico, nome, desc]) => `
    <div class="funz">
      <div class="funz-ico">${ico}</div>
      <div class="funz-nome">${nome}</div>
      <div class="funz-desc">${desc}</div>
    </div>`,
    ).join("")}
  </div>

  <div class="occhiello" style="margin-top:5mm">Come funziona</div>
  <div class="titolo-sez">Inizia in 3 minuti</div>
  <div style="margin-top:3mm">
    ${PASSI.map(
      ([nome, desc], i) => `
    <div class="passo">
      <div class="passo-num">${i + 1}</div>
      <div>
        <div class="passo-testo-nome">${nome}</div>
        <div class="passo-testo-desc">${desc}</div>
      </div>
    </div>`,
    ).join("")}
  </div>

  <div class="rassicura">
    <span>🔒 Conforme al GDPR</span>
    <span>📱 Funziona offline</span>
    <span>↩️ Rimborso 14 giorni</span>
  </div>

  <div class="chiusura">
    <div class="chiusura-qr"><img src="${qrPiccolo}" alt="QR"></div>
    <div>
      <div class="chiusura-sito">snakekeeper.it</div>
      <div class="chiusura-riga">
        Codice fiera: <strong style="color:#c9a84c">${esc(ev.codice_promo)}</strong><br>
        snakekeeper.it@gmail.com
      </div>
    </div>
  </div>
</div>

</body></html>`;

  const win = window.open("", "_blank", "width=760,height=980");
  // printLabel non fa questo controllo e con i popup bloccati esplode in silenzio.
  if (!win) {
    toast(t("pdf_no_popup"), "#c0392b");
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ═══════════════════════════════════════
//  ADMIN FIERA — MODIFICA EVENTO
//  Il codice promo è bloccato di default: e' stampato sui volantini/QR,
//  quindi cambiarlo per sbaglio renderebbe inutile tutto il materiale
//  già stampato. Serve uno sblocco esplicito per poterlo cambiare.
// ═══════════════════════════════════════
function editFieraEvent(id) {
  const ev = _fieraEventiCache.find((e) => e.id === id);
  if (!ev) {
    toast("Evento non trovato, ricarico...", "#c0392b");
    loadAdminData();
    return;
  }

  const prev = document.getElementById("fiera-edit-modal");
  if (prev) prev.remove();
  const modal = document.createElement("div");
  modal.id = "fiera-edit-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:1000;background:rgba(8,15,9,0.92);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto";
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:440px;width:100%;box-shadow:var(--shadow)" onclick="event.stopPropagation()">
      <div style="font-family:'Cinzel',serif;font-size:17px;color:var(--accent-gold);margin-bottom:16px">✏️ Modifica evento fiera</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div class="form-group">
          <label>Nome evento</label>
          <input type="text" id="edit-fiera-nome" value="${esc(ev.nome)}">
        </div>
        <div class="form-group">
          <label>Luogo</label>
          <input type="text" id="edit-fiera-luogo" value="${esc(ev.luogo || "")}">
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:140px">
            <label>Data inizio</label>
            <input type="date" id="edit-fiera-data-inizio" value="${ev.data_inizio || ""}">
          </div>
          <div class="form-group" style="flex:1;min-width:140px">
            <label>Data fine</label>
            <input type="date" id="edit-fiera-data-fine" value="${ev.data_fine || ""}">
          </div>
        </div>
        <div class="form-group">
          <label>Durata trial (giorni) — vale solo per le nuove iscrizioni da qui in poi</label>
          <input type="number" id="edit-fiera-durata" value="${ev.durata_trial_giorni}" min="1" max="730">
        </div>
        <div class="form-group">
          <label>Codice promo — 🔒 bloccato (è sui volantini/QR già stampati)</label>
          <input type="text" id="edit-fiera-codice" value="${esc(ev.codice_promo)}" disabled style="font-family:monospace;opacity:0.6">
          <label style="display:flex;align-items:center;gap:6px;margin-top:8px;text-transform:none;font-size:12px;color:var(--accent-red);cursor:pointer">
            <input type="checkbox" id="edit-fiera-unlock-codice" onchange="unlockCodicePromoField(this.checked)" style="width:auto">
            Sblocca per modificarlo (i QR già stampati smetteranno di funzionare!)
          </label>
        </div>
        <div style="display:flex;gap:10px;margin-top:8px">
          <button class="btn btn-primary" style="flex:1" onclick="saveFieraEdit('${ev.id}')" id="btn-save-fiera-edit">💾 Salva modifiche</button>
          <button class="btn btn-ghost" onclick="closeModalEl(document.getElementById('fiera-edit-modal'))">Annulla</button>
        </div>
      </div>
    </div>`;
  modal.addEventListener("click", () => closeModalEl(modal));
  openModalEl(modal);
}

function unlockCodicePromoField(unlocked) {
  const el = document.getElementById("edit-fiera-codice");
  el.disabled = !unlocked;
  el.style.opacity = unlocked ? "1" : "0.6";
  if (unlocked) el.style.textTransform = "uppercase";
}

async function saveFieraEdit(id) {
  const nome = document.getElementById("edit-fiera-nome").value.trim();
  const luogo = document.getElementById("edit-fiera-luogo").value.trim();
  const data_inizio =
    document.getElementById("edit-fiera-data-inizio").value || null;
  const data_fine =
    document.getElementById("edit-fiera-data-fine").value || null;
  const durata =
    parseInt(document.getElementById("edit-fiera-durata").value, 10) || 90;
  const codiceUnlocked = document.getElementById(
    "edit-fiera-unlock-codice",
  ).checked;
  const codice = document
    .getElementById("edit-fiera-codice")
    .value.trim()
    .toUpperCase();

  if (!nome) {
    toast("Il nome evento è obbligatorio!", "#c0392b");
    return;
  }
  if (data_inizio && data_fine && data_fine < data_inizio) {
    toast(
      "❌ La data di fine non può essere precedente alla data di inizio!",
      "#c0392b",
    );
    return;
  }
  if (codiceUnlocked && (!codice || !/^[A-Z0-9]{4,32}$/.test(codice))) {
    toast(
      "Codice promo non valido (solo lettere/numeri, min 4 caratteri)",
      "#c0392b",
    );
    return;
  }

  const btn = document.getElementById("btn-save-fiera-edit");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvataggio...';
  try {
    const body = {
      nome,
      luogo: luogo || null,
      data_inizio,
      data_fine,
      durata_trial_giorni: durata,
    };
    if (codiceUnlocked) body.codice_promo = codice;
    await SB.req(`fiere_eventi?id=eq.${id}`, {
      method: "PATCH",
      prefer: "return=minimal",
      body: JSON.stringify(body),
    });
    toast("✅ Evento aggiornato!");
    closeModalEl(document.getElementById("fiera-edit-modal"));
    await loadAdminData();
  } catch (e) {
    let msg = e.message;
    if (msg.includes("duplicate") || msg.includes("unique"))
      msg = "Codice promo già in uso da un altro evento";
    else if (msg.includes("fiere_eventi_date_range_check"))
      msg = "La data di fine non può essere precedente alla data di inizio";
    else if (msg.includes("fiere_eventi_durata_positiva_check"))
      msg = "La durata del trial deve essere maggiore di zero";
    toast("❌ " + msg, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "💾 Salva modifiche";
  }
}

// ═══════════════════════════════════════
//  ADMIN FIERA — CRONOLOGIA MODIFICHE
//  Sola lettura: la tabella è scritta solo dal trigger di sistema,
//  nemmeno l'admin può alterarla dall'interfaccia.
// ═══════════════════════════════════════
async function showFieraHistory(id, nome) {
  const prev = document.getElementById("fiera-history-modal");
  if (prev) prev.remove();
  const modal = document.createElement("div");
  modal.id = "fiera-history-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:1000;background:rgba(8,15,9,0.92);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto";
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:var(--shadow)" onclick="event.stopPropagation()">
      <div style="font-family:'Cinzel',serif;font-size:17px;color:var(--accent-gold);margin-bottom:4px">🕓 Cronologia modifiche</div>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:16px">${esc(nome)}</div>
      <div id="fiera-history-content" style="display:flex;flex-direction:column;gap:10px">
        <div style="text-align:center;padding:20px"><span class="spinner"></span></div>
      </div>
      <button class="btn btn-ghost" style="width:100%;margin-top:16px" onclick="closeModalEl(document.getElementById('fiera-history-modal'))">Chiudi</button>
    </div>`;
  modal.addEventListener("click", () => closeModalEl(modal));
  openModalEl(modal);

  try {
    const storia = await SB.req(
      `fiere_eventi_storico?fiera_id=eq.${id}&select=*&order=changed_at.desc`,
    );
    const contentEl = document.getElementById("fiera-history-content");
    if (!storia.length) {
      contentEl.innerHTML = `<p style="color:var(--text-dim);font-size:13px;text-align:center;padding:10px 0">Nessuna modifica registrata: l'evento è ancora nella sua versione originale.</p>`;
      return;
    }
    const campoLabels = {
      codice_promo: "Codice promo",
      nome: "Nome",
      luogo: "Luogo",
      data_inizio: "Data inizio",
      data_fine: "Data fine",
      durata_trial_giorni: "Durata trial (giorni)",
      attivo: "Stato attivo",
    };
    contentEl.innerHTML = storia
      .map(
        (h) => `
      <div style="background:var(--bg-moss);border-radius:8px;padding:10px 12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:12px;font-weight:600;color:var(--accent-gold)">${campoLabels[h.campo] || h.campo}</span>
          <span style="font-size:11px;color:var(--text-dim)">${new Date(h.changed_at).toLocaleString("it-IT")}</span>
        </div>
        <div style="font-size:12px;color:var(--text-mid)">
          <span style="text-decoration:line-through;color:var(--text-dim)">${esc(h.valore_precedente ?? "—")}</span>
          → <span style="color:var(--text-bright)">${esc(h.valore_nuovo ?? "—")}</span>
        </div>
        ${h.changed_by_email ? `<div style="font-size:10px;color:var(--text-dim);margin-top:4px">da ${esc(h.changed_by_email)}</div>` : ""}
      </div>`,
      )
      .join("");
  } catch (e) {
    document.getElementById("fiera-history-content").innerHTML =
      `<div style="color:var(--accent-red);font-size:13px">Errore caricamento: ${e.message}</div>`;
  }
}

async function changePlan(userId, newPlan) {
  if (!isAdmin()) return;
  try {
    const session = await getSession();
    const token = session ? session.access_token : SUPABASE_KEY;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_user_plan`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_user_id: userId, p_plan: newPlan }),
    });
    if (res.ok) {
      toast("✅ Piano aggiornato!");
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.hint || "Errore aggiornamento");
    }
  } catch (e) {
    toast("❌ Errore: " + e.message, "#c0392b");
    await loadAdminData();
  }
}

async function adminAddUser() {
  if (!isAdmin()) return;
  const uuid = document.getElementById("admin-uuid").value.trim();
  const email = document.getElementById("admin-email").value.trim();
  const plan = document.getElementById("admin-plan").value;
  const notes = document.getElementById("admin-notes").value.trim();
  if (!uuid) {
    toast("Inserisci un UUID!", "#c0392b");
    return;
  }
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(uuid)) {
    toast("UUID non valido!", "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-admin-add");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvataggio...';
  try {
    const session = await getSession();
    const token = session ? session.access_token : SUPABASE_KEY;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_user_plan`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_user_id: uuid,
        p_email: email || null,
        p_plan: plan,
        p_notes: notes || null,
      }),
    });
    if (res.ok) {
      toast("✅ Utente aggiunto con piano " + plan + "!");
      document.getElementById("admin-uuid").value = "";
      document.getElementById("admin-email").value = "";
      document.getElementById("admin-notes").value = "";
      await loadAdminData();
    } else {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.hint || "Errore inserimento");
    }
  } catch (e) {
    toast("❌ " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "➕ Aggiungi Utente";
  }
}
// ═══════════════════════════════════════
//  AUTH SUPABASE
// ═══════════════════════════════════════

// ── PROTEZIONE ANTI-BOT (Cloudflare Turnstile) ─────────────────────────────
// L'interruttore CAPTCHA di Supabase e' unico e copre insieme login,
// registrazione e recupero password: o li protegge tutti o nessuno. Quindi il
// token va allegato a TUTTE le chiamate di auth, non solo alla registrazione,
// altrimenti accendendo l'interruttore si blocca il login.
//
// Rollout in due fasi: finche' l'interruttore su Supabase e' spento il token
// viene semplicemente ignorato, quindi questo codice si puo' pubblicare senza
// che cambi nulla. Solo dopo si accende dal pannello, ed e' reversibile in
// pochi secondi senza un nuovo deploy.
//
// ATTENZIONE: 0x4AAAAAAEs6mkAg8OwziuJr e' la sitekey DI TEST di Cloudflare, che
// passa sempre. Va sostituita con quella vera del widget prima di accendere
// l'interruttore su Supabase, altrimenti nessuno riesce piu' ad autenticarsi.
const TURNSTILE_SITE_KEY = "0x4AAAAAAEs6mkAg8OwziuJr";

let _turnstilePromise = null;
function loadTurnstile() {
  if (_turnstilePromise) return _turnstilePromise;
  _turnstilePromise = loadScriptOnce(
    "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit",
  ).catch((err) => {
    _turnstilePromise = null; // un errore di rete non deve restare in cache
    throw err;
  });
  return _turnstilePromise;
}

// Restituisce un token monouso, oppure null se non e' stato possibile ottenerlo.
// Deliberatamente NON blocca l'invio quando fallisce: se restituisse un errore,
// un adblocker o un problema di rete impedirebbero a un cliente pagante di
// accedere ai propri dati. Meglio inviare la richiesta senza token e lasciare
// che sia il server a decidere: il messaggio d'errore viene poi tradotto in
// qualcosa di comprensibile.
async function getCaptchaToken(containerId) {
  if (!TURNSTILE_SITE_KEY) return null;
  const host = document.getElementById(containerId);
  if (!host) return null;
  try {
    await loadTurnstile();
    if (typeof turnstile === "undefined") return null;
    return await new Promise((resolve, reject) => {
      // Il token e' monouso e scade: se ne genera uno nuovo a ogni invio. Il
      // widget precedente va tolto con turnstile.remove(), non svuotando il
      // contenitore: cancellando solo l'HTML, Turnstile continua a credere che
      // il vecchio widget esista e sporca la console di "Cannot find Widget".
      // Un tentativo precedente puo' aver lasciato un widget ancora in sospeso
      // (l'utente ha premuto due volte, o la sfida e' rimasta aperta): va
      // rimosso prima di crearne un altro, altrimenti se ne accumulano.
      if (host.dataset.turnstileId) {
        try {
          turnstile.remove(host.dataset.turnstileId);
        } catch (e) {
          /* gia' rimosso */
        }
        delete host.dataset.turnstileId;
        host.innerHTML = "";
      }

      let widgetId = null;
      let timer = null;
      const chiudi = (fn) => (arg) => {
        if (timer) clearTimeout(timer);
        try {
          if (widgetId !== null) turnstile.remove(widgetId);
        } catch (e) {
          /* widget gia' rimosso */
        }
        delete host.dataset.turnstileId;
        fn(arg);
      };

      // Timeout solo per il caso silenzioso: il widget non risponde e non
      // chiede nulla. Se invece all'utente viene mostrata una sfida da
      // risolvere, il tempo lo decide lui (vedi before-interactive-callback):
      // 20 secondi non bastano a leggere e cliccare, e scadere li' significava
      // inviare la richiesta senza token proprio a chi la sfida l'aveva avuta.
      timer = setTimeout(
        () => chiudi(reject)(new Error("Timeout verifica anti-bot")),
        8000,
      );

      widgetId = turnstile.render(host, {
        sitekey: TURNSTILE_SITE_KEY,
        // Resta invisibile e non chiede nulla, a meno che Cloudflare non
        // giudichi la richiesta sospetta: allora compare la sfida.
        appearance: "interaction-only",
        "before-interactive-callback": () => {
          // Da qui in poi sta all'utente: niente scadenza automatica.
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        },
        callback: (token) => chiudi(resolve)(token),
        "error-callback": () =>
          chiudi(reject)(new Error("Verifica anti-bot non riuscita")),
        "expired-callback": () =>
          chiudi(reject)(new Error("Verifica anti-bot scaduta")),
        "timeout-callback": () =>
          chiudi(reject)(new Error("Verifica anti-bot scaduta")),
      });
      host.dataset.turnstileId = widgetId;
    });
  } catch (e) {
    console.warn("Turnstile non disponibile:", e.message);
    return null;
  }
}

// Traduce l'errore che Supabase restituisce quando il CAPTCHA e' obbligatorio
// ma il token manca o non e' valido: senza questo l'utente leggerebbe un
// messaggio tecnico in inglese senza capire cosa fare.
function traduciErroreCaptcha(msg) {
  if (/captcha/i.test(msg || "")) {
    return "Verifica anti-bot non superata. Ricarica la pagina e riprova; se usi un blocco pubblicità, disattivalo per questo sito.";
  }
  return msg;
}

async function authReq(endpoint, body, captchaToken) {
  const payload = captchaToken
    ? { ...body, gotrue_meta_security: { captcha_token: captchaToken } }
    : body;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      traduciErroreCaptcha(
        data.error_description || data.msg || "Errore autenticazione",
      ),
    );
  return data;
}

async function getSession() {
  // Controlla se c'è un token nel localStorage di Supabase
  try {
    const keys = Object.keys(localStorage).filter(
      (k) => k.startsWith("sb-") && k.includes("auth-token"),
    );
    if (!keys.length) return null;
    const session = JSON.parse(localStorage.getItem(keys[0]));
    if (!session || !session.access_token) return null;
    // Verifica token non scaduto
    const exp = session.expires_at || 0;
    if (Date.now() / 1000 > exp) {
      clearSession();
      return null;
    }
    // Verifica che l'utente esista ancora su Supabase (potrebbe essere stato eliminato)
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) {
        // Token non valido o utente eliminato
        clearSession();
        return null;
      }
      const user = await res.json();
      session.user = user;
    } catch (e) {
      // Errore rete — mantieni sessione locale
      console.warn("Verifica utente fallita:", e);
    }
    return session;
  } catch (e) {
    console.warn("getSession error:", e);
    return null;
  }
}

function saveSession(data) {
  if (!data || !data.access_token) return;
  const key = `sb-${SUPABASE_URL.split("//")[1].split(".")[0]}-auth-token`;
  localStorage.setItem(
    key,
    JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: data.user,
    }),
  );
  _currentUser = data.user;
}

function clearSession() {
  const keys = Object.keys(localStorage).filter(
    (k) => k.startsWith("sb-") && k.includes("auth-token"),
  );
  keys.forEach((k) => localStorage.removeItem(k));
  _currentUser = null;
}

function showLanding() {
  document.getElementById("loading-screen").style.display = "none";
  document.getElementById("landing-page").style.display = "block";
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "none";
  document.getElementById("mobile-nav").style.display = "none";
  setTimeout(initLanding, 100);
}

function hideLanding() {
  document.getElementById("landing-page").style.display = "none";
}

function landingLogin() {
  hideLanding();
  showLoginScreen();
  setTimeout(() => switchAuthTab("login"), 50);
}

function landingRegister() {
  hideLanding();
  showLoginScreen();
  setTimeout(() => switchAuthTab("register"), 50);
}

let _landingLang = "it";
function setLandingLang(lang) {
  _landingLang = lang;
  document.querySelectorAll("[data-it]").forEach((el) => {
    el.textContent = lang === "it" ? el.dataset.it : el.dataset.en;
  });
  document.querySelectorAll("[data-it-html]").forEach((el) => {
    el.innerHTML = lang === "it" ? el.dataset.itHtml : el.dataset.enHtml;
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("lang-active", btn.dataset.lang === lang);
  });
  document.querySelectorAll(".lp-lang-toggle").forEach((btn) => {
    btn.textContent = lang === "it" ? "EN" : "IT";
  });
  document.querySelectorAll("[data-href-it]").forEach((el) => {
    el.href = lang === "it" ? el.dataset.hrefIt : el.dataset.hrefEn;
  });
}
function toggleLandingLang() {
  setLandingLang(_landingLang === "it" ? "en" : "it");
}

// ═══════════════════════════════════════
//  TRADUZIONE APP (dopo il login)
// ═══════════════════════════════════════
// Sistema separato da quello della landing page: qui il contenuto è per lo
// più generato dinamicamente via JavaScript (le pagine si ricostruiscono
// ad ogni showPage()), quindi usiamo un dizionario + funzione t(chiave)
// per il contenuto dinamico, e gli stessi attributi data-it/data-en per
// gli elementi statici come la barra di navigazione.
let _appLang = "it";

const I18N = {
  it: {
    dashboard_welcome: "Benvenuto nel gestionale",
    dashboard_totale: "Totale",
    dashboard_maschi: "Maschi",
    dashboard_femmine: "Femmine",
    dashboard_pasti_mese: "Pasti/mese",
    dashboard_deposizioni: "Deposizioni",
    dashboard_pasti_7gg: "Pasti (7gg)",
    dashboard_attenzione: "Attenzione",
    dashboard_nessun_pasto: "Nessun pasto",
    dashboard_vai: "Vai",
    dashboard_giorni_fa: "g fa",
    dashboard_ieri: "ieri",
    dashboard_oggi: "oggi",
    dashboard_tutto_regola: "Tutto in regola!",
    dashboard_dati_non_disponibili: "— dati non disponibili",
    load_error_title: "Impossibile caricare i tuoi dati",
    load_error_desc:
      "I tuoi serpenti sono al sicuro: è un problema temporaneo di connessione, non li hai persi.",
    load_error_retry: "Riprova",
    dashboard_inizia: "Inizia l'allevamento",
    dashboard_aggiungi_primo: "Aggiungi il primo serpente per cominciare.",
    dashboard_aggiungi_serpente: "Aggiungi Serpente",
    serpenti_title: "I Miei Serpenti",
    serpenti_count_suffix: "esemplari registrati",
    serpenti_aggiungi: "Aggiungi",
    serpenti_locked_singular: "esemplare",
    serpenti_locked_plural: "esemplari",
    serpenti_locked_suffix: "in sola lettura",
    serpenti_locked_desc:
      "Il piano Free consente la gestione attiva dei primi {N} serpenti inseriti. I dati degli altri restano salvati e consultabili.",
    serpenti_sblocca_pro: "Sblocca con Pro",
    serpenti_empty_title: "Nessun serpente",
    serpenti_empty_desc: "Inizia aggiungendo il primo esemplare.",
    serpenti_specie: "Specie",
    serpenti_eta: "Età",
    serpenti_ultimo_pasto: "Ultimo pasto",
    serpenti_ultime_feci: "Ultime feci",
    serpenti_dettagli: "Dettagli",
    serpenti_locked_tooltip: "Sola lettura — passa a Pro per gestirlo",
    aggiungi_title: "Nuovo Serpente",
    aggiungi_subtitle: "Registra un nuovo esemplare",
    aggiungi_piano_free: "Piano Free",
    aggiungi_serpenti_usati: "serpenti usati",
    aggiungi_foto_opz: "Foto (opzionale)",
    aggiungi_carica_foto: "Carica foto",
    aggiungi_dati_anagrafici: "Dati Anagrafici",
    aggiungi_nome: "Nome *",
    aggiungi_specie: "Specie",
    aggiungi_morfo: "Morfo / Varietà",
    aggiungi_sesso: "Sesso *",
    aggiungi_seleziona: "— Seleziona —",
    aggiungi_maschio: "Maschio",
    aggiungi_femmina: "Femmina",
    aggiungi_nascita: "Data di nascita",
    aggiungi_peso: "Peso attuale (g)",
    aggiungi_provenienza: "Provenienza",
    aggiungi_icd: "Codice ICD",
    aggiungi_note: "Note",
    aggiungi_note_ph: "Eventuali annotazioni...",
    aggiungi_salva: "Salva",
    aggiungi_annulla: "Annulla",
    aggiungi_ph_nome: "es. Kaa",
    aggiungi_ph_specie: "es. Python regius",
    aggiungi_ph_morfo: "es. Albino, Pastel...",
    aggiungi_ph_peso: "es. 450",
    aggiungi_ph_provenienza: "es. Allevamento XYZ",
    err_nome_richiesto: "Inserisci il nome!",
    err_sesso_richiesto: "Seleziona il sesso!",
    err_nome_usato: "già utilizzato",
    det_indietro: "Indietro",
    det_pasti: "Pasti",
    det_cibo_tot: "Cibo tot.",
    det_feci: "Feci",
    det_pulizie: "Pulizie",
    det_mute: "Mute",
    det_stampa: "Stampa",
    det_vendi: "Vendi",
    det_tab_pasti: "Pasti",
    det_tab_feci: "Feci",
    det_tab_uova: "Uova",
    det_tab_pulizia: "Pulizia",
    det_tab_mute: "Mute",
    det_tab_peso: "Peso",
    det_tab_info: "Info",
    label_data: "Data *",
    label_note: "Note",
    label_storico: "Storico",
    nessuna_registrazione: "Nessuna registrazione",
    reg_pasto: "Registra Pasto",
    tipo_cibo: "Tipo di cibo",
    peso_preda: "Peso preda (g)",
    quantita: "Quantità",
    food_topo_sc: "Topo scongelato",
    food_topo_vivo: "Topo vivo",
    food_ratto_sc: "Ratto scongelato",
    food_ratto_vivo: "Ratto vivo",
    food_pulcino: "Pulcino",
    food_coniglio: "Coniglio",
    food_altro: "Altro",
    ph_pasto_note: "es. Ha mangiato con entusiasmo",
    salva_pasto: "Salva Pasto",
    reg_feci: "Registra Feci",
    consistenza: "Consistenza",
    feci_normale: "Normale",
    feci_liquide: "Liquide",
    feci_dure: "Dure",
    feci_urati: "Con urati",
    feci_sangue: "Sanguinolente",
    ph_feci_note: "es. Aspetto normale",
    reg_deposizione: "Registra Deposizione",
    n_uova: "N° uova",
    n_fertili: "N° fertili",
    temp_incubazione: "Temp. incubaz. (°C)",
    ph_uova_note: "es. Incubazione avviata",
    reg_pulizia: "Registra Pulizia Vasca",
    tipo_pulizia: "Tipo pulizia",
    pulizia_completa: "Pulizia completa",
    pulizia_parziale: "Pulizia parziale",
    cambio_acqua: "Cambio acqua",
    disinfezione: "Disinfezione",
    ph_pulizia_note: "es. Sostituito substrato",
    storico_pulizie: "Storico Pulizie",
    nessuna_pulizia: "Nessuna pulizia registrata",
    reg_muta: "Registra Muta",
    esito: "Esito",
    muta_completa: "Completa",
    muta_parziale: "Parziale",
    muta_problematica: "Problematica",
    muta_in_corso: "In corso",
    ph_muta_note: "es. Muta completa in un pezzo unico",
    salva_muta: "Salva Muta",
    storico_mute: "Storico Mute",
    nessuna_muta: "Nessuna muta registrata",
    reg_peso: "Registra Peso",
    peso_g: "Peso (g) *",
    ph_peso_note: "es. Post pasto, pre muta...",
    salva_peso: "Salva Peso",
    curva_crescita: "Curva di Crescita",
    servono_2_pesate: "Servono almeno 2 pesate per il grafico",
    storico_pesate: "Storico Pesate",
    nessuna_pesata: "Nessuna pesata registrata",
    scheda_anagrafica: "Scheda Anagrafica",
    modifica: "Modifica",
    salva_modifiche: "Salva Modifiche",
    lbl_nome: "Nome",
    lbl_specie: "Specie",
    lbl_morfo: "Morfo",
    lbl_sesso: "Sesso",
    lbl_nascita: "Nascita",
    lbl_peso: "Peso",
    lbl_provenienza: "Provenienza",
    lbl_icd: "Codice ICD",
    lbl_data_nascita: "Data nascita",
    err_data_richiesta: "Inserisci la data!",
    log_cibo_default: "Cibo",
    log_uova_desc: "uova",
    log_fertili_desc: "fertili",
    registro_title: "Registro",
    registro_ultime: "Ultime {N} attività",
    registro_empty_title: "Nessuna attività",
    registro_empty_desc: "Le attività appariranno qui.",
    log_feci_prefix: "Feci: ",
    log_deposizione_prefix: "Deposizione: ",
    log_pulizia_prefix: "Pulizia: ",
    venduti_title: "Serpenti Venduti",
    venduti_count: "esemplari venduti",
    venduti_incasso: "Incasso totale:",
    venduti_empty_title: "Nessuna vendita",
    venduti_empty_desc:
      "I serpenti venduti appariranno qui con tutto il loro storico.",
    venduti_badge: "VENDUTO",
    venduti_data_vendita: "Data vendita",
    venduti_acquirente: "Acquirente",
    venduti_prezzo: "Prezzo",
    err_elimina_venduto: "Eliminare questo record dalla lista venduti?",
    eliminato: "Eliminato",
    dv_venduto_il: "Venduto il",
    dv_non_specificato: "Non specificato",
    dv_giorni: "Giorni",
    dv_storico_alimentazione: "Storico Alimentazione",
    dv_nessun_pasto: "Nessun pasto registrato",
    dv_storico_feci: "Storico Feci",
    dv_storico_deposizioni: "Storico Deposizioni",
    dv_nessuna_deposizione: "Nessuna deposizione",
    dv_giorni_allevamento: "Giorni in allevamento",
    profilo_title: "Il mio profilo",
    profilo_subtitle: "Gestisci il tuo account e abbonamento",
    profilo_account: "Account",
    profilo_membro_dal: "Membro dal",
    logo_title: "Logo allevamento",
    logo_desc:
      "Se carichi un logo (immagine o PDF), verrà mostrato automaticamente sull'etichetta stampabile dei serpenti e sui PDF esportati. Il logo viene centrato automaticamente. Se non lo carichi, quelle sezioni restano semplicemente senza logo.",
    logo_cambia: "Cambia logo",
    logo_carica_btn: "Carica logo",
    logo_rimuovi: "Rimuovi logo",
    piano_attuale: "Piano attuale",
    piano_free_desc:
      "Stai usando il piano gratuito. Puoi gestire fino a {N} serpenti.",
    piano_pro_desc:
      "Hai accesso completo a tutte le funzionalità di SnakeKeeper Pro.",
    piano_admin_desc: "Accesso amministratore completo — nessun limite.",
    piano_forever_desc:
      "Hai accesso completo a SnakeKeeper gratuitamente per sempre.",
    passa_a_pro: "Passa a Pro",
    serpenti_utilizzati: "Serpenti utilizzati",
    limite_raggiunto: "Hai raggiunto il limite — passa a Pro per continuare",
    serpenti_illimitati_lbl: "Serpenti registrati:",
    serpenti_illimitati_suffix: "(illimitati)",
    pro_features_title: "Cosa include Pro",
    pf1_t: "Serpenti illimitati",
    pf1_d: "Nessun limite al numero di esemplari",
    pf2_t: "Statistiche avanzate",
    pf2_d: "Grafici e analisi dettagliate",
    pf3_t: "Export PDF & Excel",
    pf3_d: "Esporta i tuoi dati",
    pf4_t: "Backup prioritario",
    pf4_d: "I tuoi dati sempre al sicuro",
    pf5_t: "Supporto dedicato",
    pf5_d: "Risposte prioritarie",
    pf6_t: "Aggiornamenti gratuiti",
    pf6_d: "Tutte le future funzionalità",
    price_mese: "€4.99/mese",
    price_anno: "€47.99/anno",
    price_forlife: "For Life — €199 una tantum",
    gestione_abbonamento: "Gestione abbonamento",
    caricamento_dettagli: "Caricamento dettagli...",
    disdici_abbonamento: "Disdici abbonamento",
    azioni_account: "Azioni account",
    cambia_password: "Cambia password",
    esci_account: "Esci dall'account",
    zona_pericolosa: "Zona pericolosa",
    zona_pericolosa_desc:
      "Elimina definitivamente il tuo account e tutti i dati associati: serpenti, registri, archivio venduti e abbonamento. Questa azione non può essere annullata.",
    elimina_account_btn: "Elimina account definitivamente",
    privacy_policy: "Privacy Policy",
    termini_servizio: "Termini di Servizio",
    gestisci_cookie: "Gestisci Cookie",
    pdf_scheda_serpente: "Scheda Serpente",
    pdf_doc_generato: "Documento generato il",
    pdf_pasti_tot: "Pasti tot.",
    pdf_pesate: "Pesate",
    pdf_peso_attuale: "Peso attuale",
    pdf_storico_pasti: "Storico Pasti",
    pdf_storico_mute: "Storico Mute",
    pdf_storico_peso: "Storico Peso",
    pdf_storico_feci: "Storico Feci",
    pdf_deposizioni: "Deposizioni",
    pdf_col_data: "Data",
    pdf_col_tipo: "Tipo",
    pdf_col_peso: "Peso",
    pdf_col_qty: "Qty",
    pdf_col_note: "Note",
    pdf_col_esito: "Esito",
    pdf_col_uova: "Uova",
    pdf_col_fertili: "Fertili",
    pdf_col_temp: "Temp",
    pdf_generato_footer: "Generato:",
    pdf_no_popup: "Abilita i popup per visualizzare il PDF",
    pdf_gestionale_sub: "Gestionale Allevamento Serpenti",
    pdf_scheda_titolo_tab: "Scheda",
    pdf_venduto_a: "Venduto a",
    pdf_acquirente: "Acquirente",
    pdf_prezzo_vendita: "Prezzo di vendita",
    pdf_giorni_allevamento: "Giorni in allevamento",
    pdf_riepilogo_vendita: "Riepilogo Vendita",
    pdf_resoconto_vita: "Resoconto Vita",
    pdf_scansiona_qr: "Scansiona il QR per la scheda completa",
    pdf_resoconto_esemplare: "Resoconto Esemplare",
    pdf_storico_completo: "Storico completo vita in allevamento",
    pdf_stampa_salva: "Stampa / Salva PDF",
    pdf_chiudi: "Chiudi",
    pdf_peso_registrato: "Peso registrato",
    pdf_ingresso_allevamento: "Ingresso allevamento",
    pdf_riepilogo_attivita: "Riepilogo Attività",
    pdf_pasti_totali: "Pasti totali",
    pdf_cibo_somministrato: "Cibo somministrato",
    pdf_feci_registrate: "Feci registrate",
    pdf_giorni_tra_pasti: "Giorni tra pasti",
    pdf_totale: "Totale",
    pdf_uova_deposte: "Uova deposte",
    pdf_temp_c: "Temp. (°C)",
    pdf_dettagli_vendita: "Dettagli Vendita",
    pdf_giorni_suffix: "giorni",
    pdf_scansiona_apri: "Scansiona per aprire la scheda",
    pdf_inquadra_camera:
      "📷 Inquadra con la fotocamera<br>per aprire su qualsiasi smartphone",
    pdf_scheda_esemplare: "Scheda esemplare",
    pdf_ritaglia_prefix: "✂️ Ritaglia e applica sulla teca",
    pdf_nascita_short: "Nascita",
    venduti_filtro_anno: "Anno",
    venduti_tutti_anni: "Tutti gli anni",
    venduti_filtro_mese: "Mese",
    venduti_tutti_mesi: "Tutti i mesi",
    venduti_reset_filtri: "✕ Rimuovi filtri",
    venduti_grafico_title: "Andamento vendite",
    venduti_grafico_hint:
      "💡 Grafico interattivo — clicca le barre per applicare il filtro",
    venduti_vendite_label: "vendite",
    venduti_nessuna_nel_periodo: "Nessuna vendita in questo periodo.",
    foto_pos_label: "Posizione foto",
    gen_title: "Genealogia",
    gen_padre: "Padre",
    gen_madre: "Madre",
    gen_genetica: "Genetica",
    gen_genetica_ph: "es. het Pastel, Clown visivo",
    gen_nessuno: "— Nessuno —",
    gen_esterno_label: "Esterno (non in archivio)",
    gen_esterno_ph: "Nome esterno",
    gen_figli: "Figli",
    gen_fratelli: "Fratelli di cova",
    gen_nessun_figlio: "Nessun figlio registrato",
    gen_nessun_fratello: "Nessun fratello di cova",
    gen_partner: "Partner (maschio)",
    gen_esterno_badge: "esterno",
    gen_genitori: "Genitori",
    gen_non_impostato: "Non impostato",
    trial_badge_prefix: "Pro gratis per",
    trial_badge_days: "giorni",
    trial_badge_code: "codice",
    trial_badge_expires: "Scade il",
    trial_countdown_title: "La tua prova gratuita sta per scadere",
    trial_countdown_desc_1: "Il tuo periodo Pro gratuito con il codice",
    trial_countdown_desc_2: "scade tra",
    trial_countdown_days_left: "giorni",
    trial_countdown_day_left: "giorno",
    trial_countdown_desc_3:
      "Dopo la scadenza il tuo account tornerà al piano Free.",
    trial_countdown_cta: "Passa a Pro ora",
    trial_countdown_dismiss: "Ho capito",
    trasf_stato_pending: "IN ATTESA",
    trasf_stato_accepted: "ACCETTATO",
    trasf_stato_rejected: "RIFIUTATO",
    trasf_invia: "Invia al cliente",
    trasf_ritira: "Ritira invito",
    trasf_modal_title: "Invia al cliente",
    trasf_modal_sub: "Stai inviando la scheda di",
    trasf_email_label: "Email del cliente",
    trasf_cosa_invii: "Cosa riceverà il cliente",
    trasf_foto_ok: "Foto inclusa nell'invio",
    trasf_foto_manca: "Nessuna foto salvata per questa vendita",
    trasf_foto_cambia: "Cambia foto",
    trasf_foto_aggiungi: "Aggiungi una foto",
    trasf_gen_ph: "Nome del genitore",
    trasf_riepilogo:
      "Scheda completa (specie, morfo, sesso, nascita, peso, provenienza, ICD, genetica), foto, genealogia e le ultime {N} registrazioni del registro.",
    trasf_non_invii:
      "Restano tuoi e non vengono inviati: prezzo, nome dell'acquirente, note della vendita, le tue note sul serpente e quelle sulle singole registrazioni.",
    trasf_annulla: "Annulla",
    trasf_conferma: "Invia richiesta",
    trasf_invio_corso: "Invio…",
    trasf_inviato: "Richiesta inviata al cliente!",
    trasf_err_email: "Inserisci un indirizzo email valido",
    trasf_err_generico: "Invio non riuscito",
    trasf_conferma_ritiro:
      "Ritirare l'invito inviato a {EMAIL}?\n\nIl cliente non potrà più accettarlo. Potrai inviarne uno nuovo quando vuoi.",
    trasf_ritirato: "Invito ritirato",
    trasf_err_non_trovato: "Richiesta non trovata",
    trasf_err_non_in_attesa: "Questa richiesta non è più in attesa",
    trasf_err_scaduto: "Questa richiesta è scaduta",
    trasf_err_limite_free:
      "Hai raggiunto il limite di 3 serpenti del piano Free. La richiesta resta valida: passa a Pro o libera un posto, poi accettala.",
    trasf_err_gia_accettato:
      "Il cliente ha già accettato il trasferimento: non puoi più annullare questa vendita.",
    trasf_page_title: "Trasferimenti",
    trasf_page_sub:
      "Serpenti ricevuti dagli allevatori e richieste che hai inviato",
    trasf_empty_title: "Nessun trasferimento",
    trasf_empty_desc:
      "Qui compaiono i serpenti che un allevatore ti invia dopo un acquisto.",
    trasf_in_arrivo: "In arrivo per te",
    trasf_inviati: "Richieste inviate",
    trasf_da: "Da",
    trasf_scade: "Scade il",
    trasf_contenuto:
      "Include scheda completa, foto, genealogia e {N} registrazioni recenti.",
    trasf_accetta: "Accetta",
    trasf_rifiuta: "Rifiuta",
    trasf_vendita_rimossa: "Vendita rimossa",
    trasf_conferma_accetta:
      'Aggiungere "{NOME}" ai tuoi serpenti?\n\nAccettando, la scheda e le registrazioni inviate dall\'allevatore vengono copiate sul tuo account.',
    trasf_conferma_rifiuta:
      'Rifiutare "{NOME}"?\n\nLa richiesta viene chiusa e nessun dato verrà copiato sul tuo account.',
    trasf_accettato: "Serpente aggiunto alla tua collezione!",
    trasf_rifiutato: "Richiesta rifiutata",
  },
  en: {
    dashboard_welcome: "Welcome to your dashboard",
    dashboard_totale: "Total",
    dashboard_maschi: "Males",
    dashboard_femmine: "Females",
    dashboard_pasti_mese: "Meals/month",
    dashboard_deposizioni: "Clutches",
    dashboard_pasti_7gg: "Meals (7d)",
    dashboard_attenzione: "Attention",
    dashboard_nessun_pasto: "No meal logged",
    dashboard_vai: "Go",
    dashboard_giorni_fa: "d ago",
    dashboard_ieri: "yesterday",
    dashboard_oggi: "today",
    dashboard_tutto_regola: "All good!",
    dashboard_dati_non_disponibili: "— data unavailable",
    load_error_title: "Couldn't load your data",
    load_error_desc:
      "Your snakes are safe: this is a temporary connection issue, you haven't lost anything.",
    load_error_retry: "Retry",
    dashboard_inizia: "Start your collection",
    dashboard_aggiungi_primo: "Add your first snake to get started.",
    dashboard_aggiungi_serpente: "Add Snake",
    serpenti_title: "My Snakes",
    serpenti_count_suffix: "snakes registered",
    serpenti_aggiungi: "Add",
    serpenti_locked_singular: "snake",
    serpenti_locked_plural: "snakes",
    serpenti_locked_suffix: "in read-only mode",
    serpenti_locked_desc:
      "The Free plan allows active management of the first {N} snakes added. Data for the others remains saved and viewable.",
    serpenti_sblocca_pro: "Unlock with Pro",
    serpenti_empty_title: "No snakes yet",
    serpenti_empty_desc: "Start by adding your first snake.",
    serpenti_specie: "Species",
    serpenti_eta: "Age",
    serpenti_ultimo_pasto: "Last meal",
    serpenti_ultime_feci: "Last feces",
    serpenti_dettagli: "Details",
    serpenti_locked_tooltip: "Read-only — upgrade to Pro to manage it",
    aggiungi_title: "New Snake",
    aggiungi_subtitle: "Register a new animal",
    aggiungi_piano_free: "Free plan",
    aggiungi_serpenti_usati: "snakes used",
    aggiungi_foto_opz: "Photo (optional)",
    aggiungi_carica_foto: "Upload photo",
    aggiungi_dati_anagrafici: "Basic Info",
    aggiungi_nome: "Name *",
    aggiungi_specie: "Species",
    aggiungi_morfo: "Morph / Variety",
    aggiungi_sesso: "Sex *",
    aggiungi_seleziona: "— Select —",
    aggiungi_maschio: "Male",
    aggiungi_femmina: "Female",
    aggiungi_nascita: "Date of birth",
    aggiungi_peso: "Current weight (g)",
    aggiungi_provenienza: "Origin",
    aggiungi_icd: "ICD Code",
    aggiungi_note: "Notes",
    aggiungi_note_ph: "Any notes...",
    aggiungi_salva: "Save",
    aggiungi_annulla: "Cancel",
    aggiungi_ph_nome: "e.g. Kaa",
    aggiungi_ph_specie: "e.g. Python regius",
    aggiungi_ph_morfo: "e.g. Albino, Pastel...",
    aggiungi_ph_peso: "e.g. 450",
    aggiungi_ph_provenienza: "e.g. XYZ Breeder",
    err_nome_richiesto: "Enter a name!",
    err_sesso_richiesto: "Select a sex!",
    err_nome_usato: "already in use",
    det_indietro: "Back",
    det_pasti: "Meals",
    det_cibo_tot: "Total food",
    det_feci: "Feces",
    det_pulizie: "Cleanings",
    det_mute: "Sheds",
    det_stampa: "Print",
    det_vendi: "Sell",
    det_tab_pasti: "Meals",
    det_tab_feci: "Feces",
    det_tab_uova: "Eggs",
    det_tab_pulizia: "Cleaning",
    det_tab_mute: "Sheds",
    det_tab_peso: "Weight",
    det_tab_info: "Info",
    label_data: "Date *",
    label_note: "Notes",
    label_storico: "History",
    nessuna_registrazione: "No entries yet",
    reg_pasto: "Log a Meal",
    tipo_cibo: "Food type",
    peso_preda: "Prey weight (g)",
    quantita: "Quantity",
    food_topo_sc: "Frozen/thawed mouse",
    food_topo_vivo: "Live mouse",
    food_ratto_sc: "Frozen/thawed rat",
    food_ratto_vivo: "Live rat",
    food_pulcino: "Chick",
    food_coniglio: "Rabbit",
    food_altro: "Other",
    ph_pasto_note: "e.g. Ate enthusiastically",
    salva_pasto: "Save Meal",
    reg_feci: "Log Feces",
    consistenza: "Consistency",
    feci_normale: "Normal",
    feci_liquide: "Loose",
    feci_dure: "Hard",
    feci_urati: "With urates",
    feci_sangue: "Bloody",
    ph_feci_note: "e.g. Normal appearance",
    reg_deposizione: "Log a Clutch",
    n_uova: "No. of eggs",
    n_fertili: "No. fertile",
    temp_incubazione: "Incubation temp. (°C)",
    ph_uova_note: "e.g. Incubation started",
    reg_pulizia: "Log Enclosure Cleaning",
    tipo_pulizia: "Cleaning type",
    pulizia_completa: "Full cleaning",
    pulizia_parziale: "Partial cleaning",
    cambio_acqua: "Water change",
    disinfezione: "Disinfection",
    ph_pulizia_note: "e.g. Substrate replaced",
    storico_pulizie: "Cleaning History",
    nessuna_pulizia: "No cleanings logged yet",
    reg_muta: "Log a Shed",
    esito: "Outcome",
    muta_completa: "Complete",
    muta_parziale: "Partial",
    muta_problematica: "Problematic",
    muta_in_corso: "In progress",
    ph_muta_note: "e.g. Complete shed in one piece",
    salva_muta: "Save Shed",
    storico_mute: "Shed History",
    nessuna_muta: "No sheds logged yet",
    reg_peso: "Log Weight",
    peso_g: "Weight (g) *",
    ph_peso_note: "e.g. Post-meal, pre-shed...",
    salva_peso: "Save Weight",
    curva_crescita: "Growth Chart",
    servono_2_pesate: "At least 2 weigh-ins are needed for the chart",
    storico_pesate: "Weight History",
    nessuna_pesata: "No weigh-ins logged yet",
    scheda_anagrafica: "Profile Sheet",
    modifica: "Edit",
    salva_modifiche: "Save Changes",
    lbl_nome: "Name",
    lbl_specie: "Species",
    lbl_morfo: "Morph",
    lbl_sesso: "Sex",
    lbl_nascita: "Born",
    lbl_peso: "Weight",
    lbl_provenienza: "Origin",
    lbl_icd: "ICD Code",
    lbl_data_nascita: "Date of birth",
    err_data_richiesta: "Enter a date!",
    log_cibo_default: "Food",
    log_uova_desc: "eggs",
    log_fertili_desc: "fertile",
    registro_title: "Log",
    registro_ultime: "Last {N} activities",
    registro_empty_title: "No activity yet",
    registro_empty_desc: "Activity will show up here.",
    log_feci_prefix: "Feces: ",
    log_deposizione_prefix: "Clutch: ",
    log_pulizia_prefix: "Cleaning: ",
    venduti_title: "Sold Snakes",
    venduti_count: "snakes sold",
    venduti_incasso: "Total revenue:",
    venduti_empty_title: "No sales yet",
    venduti_empty_desc:
      "Sold snakes will show up here with their full history.",
    venduti_badge: "SOLD",
    venduti_data_vendita: "Sale date",
    venduti_acquirente: "Buyer",
    venduti_prezzo: "Price",
    err_elimina_venduto: "Delete this record from the sold list?",
    eliminato: "Deleted",
    dv_venduto_il: "Sold on",
    dv_non_specificato: "Not specified",
    dv_giorni: "Days",
    dv_storico_alimentazione: "Feeding History",
    dv_nessun_pasto: "No meals logged",
    dv_storico_feci: "Feces History",
    dv_storico_deposizioni: "Clutch History",
    dv_nessuna_deposizione: "No clutches",
    dv_giorni_allevamento: "Days in collection",
    profilo_title: "My Profile",
    profilo_subtitle: "Manage your account and subscription",
    profilo_account: "Account",
    profilo_membro_dal: "Member since",
    logo_title: "Breeder Logo",
    logo_desc:
      "If you upload a logo (image or PDF), it will automatically appear on printable snake labels and exported PDFs. The logo is centered automatically. If you don't upload one, those sections simply stay without a logo.",
    logo_cambia: "Change logo",
    logo_carica_btn: "Upload logo",
    logo_rimuovi: "Remove logo",
    piano_attuale: "Current plan",
    piano_free_desc:
      "You are on the Free plan. You can manage up to {N} snakes.",
    piano_pro_desc: "You have full access to all SnakeKeeper Pro features.",
    piano_admin_desc: "Full administrator access — no limits.",
    piano_forever_desc:
      "You have full access to SnakeKeeper for free, forever.",
    passa_a_pro: "Upgrade to Pro",
    serpenti_utilizzati: "Snakes used",
    limite_raggiunto: "You've reached the limit — upgrade to Pro to continue",
    serpenti_illimitati_lbl: "Snakes registered:",
    serpenti_illimitati_suffix: "(unlimited)",
    pro_features_title: "What's included in Pro",
    pf1_t: "Unlimited snakes",
    pf1_d: "No limit on the number of animals",
    pf2_t: "Advanced statistics",
    pf2_d: "Detailed charts and analytics",
    pf3_t: "PDF & Excel export",
    pf3_d: "Export your data",
    pf4_t: "Priority backup",
    pf4_d: "Your data always safe",
    pf5_t: "Dedicated support",
    pf5_d: "Priority responses",
    pf6_t: "Free updates",
    pf6_d: "All future features",
    price_mese: "€4.99/month",
    price_anno: "€47.99/year",
    price_forlife: "For Life — €199 one-time",
    gestione_abbonamento: "Manage subscription",
    caricamento_dettagli: "Loading details...",
    disdici_abbonamento: "Cancel subscription",
    azioni_account: "Account actions",
    cambia_password: "Change password",
    esci_account: "Sign out",
    zona_pericolosa: "Danger zone",
    zona_pericolosa_desc:
      "Permanently delete your account and all associated data: snakes, logs, sold archive and subscription. This action cannot be undone.",
    elimina_account_btn: "Permanently delete account",
    privacy_policy: "Privacy Policy",
    termini_servizio: "Terms of Service",
    gestisci_cookie: "Manage Cookies",
    pdf_scheda_serpente: "Snake Profile",
    pdf_doc_generato: "Document generated on",
    pdf_pasti_tot: "Total meals",
    pdf_pesate: "Weigh-ins",
    pdf_peso_attuale: "Current weight",
    pdf_storico_pasti: "Feeding History",
    pdf_storico_mute: "Shed History",
    pdf_storico_peso: "Weight History",
    pdf_storico_feci: "Feces History",
    pdf_deposizioni: "Clutches",
    pdf_col_data: "Date",
    pdf_col_tipo: "Type",
    pdf_col_peso: "Weight",
    pdf_col_qty: "Qty",
    pdf_col_note: "Notes",
    pdf_col_esito: "Outcome",
    pdf_col_uova: "Eggs",
    pdf_col_fertili: "Fertile",
    pdf_col_temp: "Temp",
    pdf_generato_footer: "Generated:",
    pdf_no_popup: "Please enable pop-ups to view the PDF",
    pdf_gestionale_sub: "Snake Breeding Management",
    pdf_scheda_titolo_tab: "Profile",
    pdf_venduto_a: "Sold to",
    pdf_acquirente: "Buyer",
    pdf_prezzo_vendita: "Sale price",
    pdf_giorni_allevamento: "Days in collection",
    pdf_riepilogo_vendita: "Sale Summary",
    pdf_resoconto_vita: "Life Summary",
    pdf_scansiona_qr: "Scan the QR code for the full profile",
    pdf_resoconto_esemplare: "Animal Report",
    pdf_storico_completo: "Complete life history in the collection",
    pdf_stampa_salva: "Print / Save PDF",
    pdf_chiudi: "Close",
    pdf_peso_registrato: "Recorded weight",
    pdf_ingresso_allevamento: "Added to collection",
    pdf_riepilogo_attivita: "Activity Summary",
    pdf_pasti_totali: "Total meals",
    pdf_cibo_somministrato: "Food given",
    pdf_feci_registrate: "Feces logged",
    pdf_giorni_tra_pasti: "Days between meals",
    pdf_totale: "Total",
    pdf_uova_deposte: "Eggs laid",
    pdf_temp_c: "Temp. (°C)",
    pdf_dettagli_vendita: "Sale Details",
    pdf_giorni_suffix: "days",
    pdf_scansiona_apri: "Scan to open the profile",
    pdf_inquadra_camera:
      "📷 Point your camera at it<br>to open on any smartphone",
    pdf_scheda_esemplare: "Animal Profile",
    pdf_ritaglia_prefix: "✂️ Cut out and attach to the enclosure",
    pdf_nascita_short: "Born",
    venduti_filtro_anno: "Year",
    venduti_tutti_anni: "All years",
    venduti_filtro_mese: "Month",
    venduti_tutti_mesi: "All months",
    venduti_reset_filtri: "✕ Clear filters",
    venduti_grafico_title: "Sales trend",
    venduti_grafico_hint:
      "💡 Interactive chart — click a bar to apply the filter",
    venduti_vendite_label: "sales",
    venduti_nessuna_nel_periodo: "No sales in this period.",
    foto_pos_label: "Photo position",
    gen_title: "Genealogy",
    gen_padre: "Father",
    gen_madre: "Mother",
    gen_genetica: "Genetics",
    gen_genetica_ph: "e.g. het Pastel, visual Clown",
    gen_nessuno: "— None —",
    gen_esterno_label: "External (not in your records)",
    gen_esterno_ph: "External name",
    gen_figli: "Offspring",
    gen_fratelli: "Clutch siblings",
    gen_nessun_figlio: "No offspring registered",
    gen_nessun_fratello: "No clutch siblings",
    gen_partner: "Partner (male)",
    gen_esterno_badge: "external",
    gen_genitori: "Parents",
    gen_non_impostato: "Not set",
    trial_badge_prefix: "Free Pro for",
    trial_badge_days: "days",
    trial_badge_code: "code",
    trial_badge_expires: "Expires on",
    trial_countdown_title: "Your free trial is ending soon",
    trial_countdown_desc_1: "Your free Pro period with code",
    trial_countdown_desc_2: "expires in",
    trial_countdown_days_left: "days",
    trial_countdown_day_left: "day",
    trial_countdown_desc_3:
      "After it ends your account will return to the Free plan.",
    trial_countdown_cta: "Upgrade to Pro now",
    trial_countdown_dismiss: "Got it",
    trasf_stato_pending: "PENDING",
    trasf_stato_accepted: "ACCEPTED",
    trasf_stato_rejected: "DECLINED",
    trasf_invia: "Send to buyer",
    trasf_ritira: "Withdraw",
    trasf_modal_title: "Send to buyer",
    trasf_modal_sub: "You are sending the record for",
    trasf_email_label: "Buyer's email",
    trasf_cosa_invii: "What the buyer will receive",
    trasf_foto_ok: "Photo included",
    trasf_foto_manca: "No photo saved for this sale",
    trasf_foto_cambia: "Change photo",
    trasf_foto_aggiungi: "Add a photo",
    trasf_gen_ph: "Parent name",
    trasf_riepilogo:
      "Full record (species, morph, sex, birth, weight, origin, ICD, genetics), photo, genealogy and the latest {N} log entries.",
    trasf_non_invii:
      "Kept private and not sent: price, buyer name, sale notes, your notes on the snake and on individual log entries.",
    trasf_annulla: "Cancel",
    trasf_conferma: "Send request",
    trasf_invio_corso: "Sending…",
    trasf_inviato: "Request sent to the buyer!",
    trasf_err_email: "Enter a valid email address",
    trasf_err_generico: "Sending failed",
    trasf_conferma_ritiro:
      "Withdraw the request sent to {EMAIL}?\n\nThe buyer will no longer be able to accept it. You can send a new one at any time.",
    trasf_ritirato: "Request withdrawn",
    trasf_err_non_trovato: "Request not found",
    trasf_err_non_in_attesa: "This request is no longer pending",
    trasf_err_scaduto: "This request has expired",
    trasf_err_limite_free:
      "You have reached the Free plan limit of 3 snakes. The request stays valid: upgrade to Pro or free up a slot, then accept it.",
    trasf_err_gia_accettato:
      "The buyer has already accepted the transfer, so this sale can no longer be undone.",
    trasf_page_title: "Transfers",
    trasf_page_sub:
      "Snakes sent to you by breeders, and requests you have sent",
    trasf_empty_title: "No transfers",
    trasf_empty_desc:
      "Snakes a breeder sends you after a purchase will show up here.",
    trasf_in_arrivo: "Waiting for you",
    trasf_inviati: "Requests you sent",
    trasf_da: "From",
    trasf_scade: "Expires on",
    trasf_contenuto:
      "Includes the full record, photo, genealogy and {N} recent log entries.",
    trasf_accetta: "Accept",
    trasf_rifiuta: "Decline",
    trasf_vendita_rimossa: "Sale removed",
    trasf_conferma_accetta:
      'Add "{NOME}" to your snakes?\n\nBy accepting, the record and log entries sent by the breeder are copied to your account.',
    trasf_conferma_rifiuta:
      'Decline "{NOME}"?\n\nThe request will be closed and no data will be copied to your account.',
    trasf_accettato: "Snake added to your collection!",
    trasf_rifiutato: "Request declined",
  },
};

function t(key) {
  return (I18N[_appLang] && I18N[_appLang][key]) || I18N.it[key] || key;
}

// Applica la lingua corrente agli elementi statici (navigazione).
// Le pagine generate dinamicamente (dashboard, serpenti, ecc.) si
// auto-traducono da sole ogni volta che vengono ridisegnate, perché
// usano t() direttamente nel loro HTML.
function applyAppLang() {
  document
    .querySelectorAll(
      "#mobile-drawer [data-it], aside [data-it], #mobile-nav [data-it]",
    )
    .forEach((el) => {
      el.textContent = _appLang === "it" ? el.dataset.it : el.dataset.en;
    });
}

function showLoginScreen() {
  document.getElementById("login-screen").style.display = "flex";
  document.getElementById("app").style.display = "none";
  document.getElementById("mobile-nav").style.display = "none";
  document.getElementById("landing-page").style.display = "none";
  // Riporta i pulsanti login/registrati allo stato normale: doLogin() li blocca
  // con uno spinner durante la richiesta e li sblocca solo in caso di errore
  // (in caso di successo la schermata semplicemente spariva, prima). Se poi si
  // torna qui - es. dopo un logout - lo stesso pulsante ricompare ancora
  // bloccato dall'ultimo accesso riuscito, impedendo di riaccedere.
  const btnLogin = document.getElementById("btn-login");
  if (btnLogin) {
    btnLogin.disabled = false;
    btnLogin.innerHTML = "🔓 Accedi";
  }
  const btnRegister = document.getElementById("btn-register");
  if (btnRegister) {
    btnRegister.disabled = false;
    btnRegister.innerHTML = "🐍 Crea Account";
  }
}

function hideLoginScreen() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";
  document.getElementById("mobile-nav").style.display = "";
  // Mostra email utente nella sidebar
  if (_currentUser) {
    const el = document.getElementById("user-info");
    if (el) el.textContent = "👤 " + (_currentUser.email || "");
  }
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("form-login").style.display = isLogin ? "" : "none";
  document.getElementById("form-register").style.display = isLogin
    ? "none"
    : "";
  document.getElementById("tab-login-btn").classList.toggle("active", isLogin);
  document
    .getElementById("tab-register-btn")
    .classList.toggle("active", !isLogin);
  document
    .getElementById("tab-login-btn")
    .setAttribute("aria-selected", String(isLogin));
  document
    .getElementById("tab-register-btn")
    .setAttribute("aria-selected", String(!isLogin));
  document.getElementById("auth-message").style.display = "none";
}

function showAuthMsg(msg, isError = false) {
  const el = document.getElementById("auth-message");
  el.textContent = msg;
  el.style.display = "block";
  el.style.background = isError
    ? "rgba(192,57,43,0.15)"
    : "rgba(109,181,109,0.15)";
  el.style.color = isError ? "var(--accent-red)" : "var(--accent-lime)";
  el.style.border = isError
    ? "1px solid rgba(192,57,43,0.3)"
    : "1px solid rgba(109,181,109,0.3)";
}

async function doLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  if (!email || !password) {
    showAuthMsg("Inserisci email e password", true);
    return;
  }
  const btn = document.getElementById("btn-login");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Accesso...';
  try {
    const captchaToken = await getCaptchaToken("login-captcha");
    const data = await authReq(
      "token?grant_type=password",
      { email, password },
      captchaToken,
    );
    saveSession(data);
    hideLoginScreen();
    await loadAll();
    await loadUserPlan();
    showPage("dashboard");
    setTimeout(initCookieBanner, 1500);
  } catch (e) {
    showAuthMsg("❌ " + e.message, true);
    btn.disabled = false;
    btn.innerHTML = "🔓 Accedi";
  }
}

let _regLang = "it";
function selectRegLang(lang) {
  _regLang = lang;
  document
    .getElementById("reg-lang-it")
    .classList.toggle("active", lang === "it");
  document
    .getElementById("reg-lang-en")
    .classList.toggle("active", lang === "en");
}

async function doRegister() {
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  if (!email || !password) {
    showAuthMsg("Inserisci email e password", true);
    return;
  }
  if (password.length < 10) {
    showAuthMsg("La password deve avere almeno 10 caratteri", true);
    return;
  }
  const btn = document.getElementById("btn-register");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Registrazione...';
  try {
    const captchaToken = await getCaptchaToken("register-captcha");
    await authReq(
      "signup",
      { email, password, data: { lang: _regLang } },
      captchaToken,
    );
    showAuthMsg(
      "✅ Registrazione completata! Controlla SUBITO la tua email (anche lo spam) e clicca il link per verificare l'account. Il link scade dopo un po', quindi verificalo appena possibile.",
    );
    btn.disabled = false;
    btn.innerHTML = "🐍 Crea Account";
  } catch (e) {
    showAuthMsg("❌ " + e.message, true);
    btn.disabled = false;
    btn.innerHTML = "🐍 Crea Account";
  }
}

async function doForgotPassword() {
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    showAuthMsg("Inserisci prima la tua email", true);
    return;
  }
  try {
    // Il recupero password rientra nell'interruttore CAPTCHA di Supabase: parte
    // dalla schermata di login, quindi riusa il contenitore di quella form.
    const captchaToken = await getCaptchaToken("login-captcha");
    await authReq("recover", { email }, captchaToken);
    showAuthMsg("✅ Email di recupero inviata! Controlla la tua casella.");
  } catch (e) {
    showAuthMsg("❌ " + e.message, true);
  }
}

// ===========================================
//  ELIMINAZIONE ACCOUNT (diritto alla cancellazione)
// ===========================================
function showDeleteAccountModal() {
  const prev = document.getElementById("delete-account-modal");
  if (prev) prev.remove();
  const modal = document.createElement("div");
  modal.id = "delete-account-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:700;background:rgba(8,15,9,0.92);display:flex;align-items:center;justify-content:center;padding:24px";
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid rgba(192,57,43,0.4);border-radius:16px;padding:28px;max-width:440px;width:100%;box-shadow:var(--shadow)">
      <div style="font-size:40px;text-align:center;margin-bottom:10px">⚠️</div>
      <div style="font-family:'Cinzel',serif;font-size:19px;color:var(--accent-red);margin-bottom:14px;text-align:center">Eliminare l'account?</div>
      <p style="color:var(--text-mid);font-size:13px;line-height:1.6;margin:0 0 10px">
        Verranno eliminati <strong style="color:var(--text-bright)">definitivamente e senza possibilità di recupero</strong>:
      </p>
      <ul style="color:var(--text-mid);font-size:13px;line-height:1.8;margin:0 0 16px;padding-left:20px">
        <li>Tutti i serpenti e le loro schede</li>
        <li>Tutti i registri (pasti, feci, pulizie, mute, pesate)</li>
        <li>L'archivio degli esemplari venduti</li>
        <li>L'abbonamento attivo (verrà cancellato, senza rimborso automatico per il periodo residuo)</li>
        <li>Il tuo account di accesso</li>
      </ul>
      <p style="color:var(--text-mid);font-size:13px;line-height:1.6;margin:0 0 8px">
        Per confermare, scrivi <strong style="color:var(--accent-red)">ELIMINA</strong> qui sotto:
      </p>
      <input type="text" id="delete-account-confirm-input" autocomplete="off"
        style="width:100%;padding:12px;background:var(--bg-moss);border:1px solid var(--border);border-radius:8px;color:var(--text-bright);font-family:'Inter',sans-serif;font-size:14px;margin-bottom:16px;box-sizing:border-box"
        placeholder="ELIMINA">
      <div class="flex-row" style="justify-content:center;gap:10px">
        <button id="btn-confirm-delete-account" onclick="doDeleteAccount()" disabled
          style="padding:12px 20px;background:var(--accent-red);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;opacity:0.5">
          🗑️ Elimina definitivamente
        </button>
        <button class="btn btn-ghost" onclick="closeModalEl(document.getElementById('delete-account-modal'))">Annulla</button>
      </div>
    </div>`;
  openModalEl(modal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModalEl(modal);
  });
  // Il pulsante conferma resta disabilitato finche' il testo non corrisponde esattamente
  const input = document.getElementById("delete-account-confirm-input");
  const confirmBtn = document.getElementById("btn-confirm-delete-account");
  input.addEventListener("input", function () {
    const match = this.value.trim() === "ELIMINA";
    confirmBtn.disabled = !match;
    confirmBtn.style.opacity = match ? "1" : "0.5";
  });
}

async function doDeleteAccount() {
  const btn = document.getElementById("btn-confirm-delete-account");
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Eliminazione in corso...';
  try {
    const _authSession = await getSession();
    if (!_authSession)
      throw new Error("Sessione non valida, effettua di nuovo il login.");
    const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${_authSession.access_token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok || data.error)
      throw new Error(data.error || "Errore durante l'eliminazione");

    clearSession();
    document.getElementById("delete-account-modal")?.remove();
    alert(
      "Il tuo account e tutti i dati associati sono stati eliminati definitivamente.",
    );
    window.location.href = window.location.pathname;
  } catch (e) {
    toast("❌ " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "🗑️ Elimina definitivamente";
  }
}

async function doLogout() {
  clearSession();
  showLoginScreen();
}

// ═══════════════════════════════════════
//  GESTIONE AUTH SUPABASE (email verify)
// ═══════════════════════════════════════
function getHashParams() {
  const hash = window.location.hash.replace("#", "");
  const params = {};
  hash.split("&").forEach((p) => {
    const [k, v] = p.split("=");
    if (k) params[k] = decodeURIComponent(v || "");
  });
  return params;
}

// Modal per link email scaduto/non valido
function showExpiredLinkModal(errorCode, errorDesc) {
  const isExpired =
    errorCode === "otp_expired" ||
    (errorDesc || "").toLowerCase().includes("expired");
  const modal = document.createElement("div");
  modal.id = "expired-link-modal";
  modal.style.cssText =
    "position:fixed;inset:0;z-index:800;background:rgba(8,15,9,0.95);display:flex;align-items:center;justify-content:center;padding:24px";
  modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;padding:32px;max-width:400px;width:100%;text-align:center;box-shadow:var(--shadow)">
      <div style="font-size:48px;margin-bottom:12px">${isExpired ? "⏰" : "⚠️"}</div>
      <div style="font-family:'Cinzel',serif;font-size:22px;color:var(--accent-gold);margin-bottom:8px">
        ${isExpired ? "Link scaduto" : "Link non valido"}
      </div>
      <div style="color:var(--text-mid);font-size:14px;line-height:1.6;margin-bottom:20px">
        ${
          isExpired
            ? "Il link di verifica è scaduto. Inserisci la tua email qui sotto per riceverne uno nuovo."
            : "Questo link non è più valido. Richiedi una nuova email di verifica inserendo il tuo indirizzo."
        }
      </div>
      <div class="form-group" style="text-align:left;margin-bottom:14px">
        <label>La tua email</label>
        <input type="email" id="resend-email" placeholder="nome@email.com" autocomplete="email" style="width:100%">
      </div>
      <div id="resend-captcha" style="display:flex;justify-content:center;margin-bottom:10px"></div>
      <button id="btn-resend" onclick="resendVerificationEmail()"
        style="width:100%;padding:14px;background:var(--accent-gold);color:#0a1a0a;border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:'Inter',sans-serif;cursor:pointer;margin-bottom:10px">
        📧 Invia nuova email di verifica
      </button>
      <button onclick="closeModalEl(document.getElementById('expired-link-modal'))"
        style="width:100%;padding:10px;background:transparent;color:var(--text-dim);border:1px solid var(--border);border-radius:10px;font-size:13px;font-family:'Inter',sans-serif;cursor:pointer">
        Torna al login
      </button>
    </div>`;
  openModalEl(modal);
}

async function resendVerificationEmail() {
  const email = document.getElementById("resend-email").value.trim();
  if (!email || !email.includes("@")) {
    toast("Inserisci un'email valida!", "#c0392b");
    return;
  }
  const btn = document.getElementById("btn-resend");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Invio in corso...';
  try {
    const captchaToken = await getCaptchaToken("resend-captcha");
    const res = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "signup",
        email: email,
        options: { emailRedirectTo: BASE_URL },
        ...(captchaToken
          ? { gotrue_meta_security: { captcha_token: captchaToken } }
          : {}),
      }),
    });
    if (res.ok) {
      closeModalEl(document.getElementById("expired-link-modal"));
      toast("✅ Email inviata! Controlla la tua casella (anche lo spam).");
    } else {
      const err = await res.json().catch(() => ({}));
      // Supabase a volte risponde ok anche se già verificato
      if (err.msg && err.msg.toLowerCase().includes("already")) {
        closeModalEl(document.getElementById("expired-link-modal"));
        toast("✅ Questo account è già verificato! Puoi accedere.");
      } else {
        throw new Error(err.msg || err.error_description || "Errore invio");
      }
    }
  } catch (e) {
    toast("❌ " + e.message, "#c0392b");
    btn.disabled = false;
    btn.innerHTML = "📧 Riprova";
  }
}

function showAuthSuccess(type) {
  // Rimuovi hash dall'URL senza ricaricare
  history.replaceState(null, "", window.location.pathname);

  // Mostra overlay di successo
  const overlay = document.createElement("div");
  overlay.id = "auth-overlay";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:999;
    background:rgba(8,15,9,0.97);
    display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    gap:16px;text-align:center;padding:24px;
  `;

  const messages = {
    signup: {
      icon: "✅",
      title: "Email verificata!",
      sub: "Il tuo account SnakeKeeper è attivo.",
      color: "var(--accent-lime)",
      btn: "🐍 Entra nel gestionale",
    },
    recovery: {
      icon: "🔑",
      title: "Accesso confermato",
      sub: "Puoi ora accedere al gestionale.",
      color: "var(--accent-gold)",
      btn: "🐍 Entra nel gestionale",
    },
    magiclink: {
      icon: "✨",
      title: "Accesso effettuato!",
      sub: "Bentornato su SnakeKeeper.",
      color: "var(--accent-lime)",
      btn: "🐍 Entra nel gestionale",
    },
  };

  const m = messages[type] || messages.signup;

  overlay.innerHTML = `
    <div style="font-size:72px;animation:bounceIn .5s ease">${m.icon}</div>
    <div style="font-family:'Cinzel',serif;font-size:28px;color:${m.color}">${m.title}</div>
    <div style="font-size:16px;color:var(--text-mid);max-width:300px;line-height:1.6">${m.sub}</div>
    <div style="width:60px;height:3px;background:${m.color};border-radius:2px;margin:4px 0"></div>
    <div style="font-size:13px;color:var(--text-dim)">🐍 SnakeKeeper — Gestionale Allevamento</div>
    <button onclick="document.getElementById('auth-overlay').remove()" 
      style="margin-top:12px;padding:14px 32px;background:${m.color};color:#0a1a0a;
             border:none;border-radius:10px;font-size:16px;font-weight:700;
             font-family:'Inter',sans-serif;cursor:pointer;
             box-shadow:0 4px 20px rgba(109,181,109,0.3)">
      ${m.btn}
    </button>
  `;

  document.body.appendChild(overlay);

  // Auto-dismiss dopo 4 secondi
  setTimeout(() => {
    const el = document.getElementById("auth-overlay");
    if (el) {
      el.style.transition = "opacity .5s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 500);
    }
  }, 4000);
}

window.addEventListener("DOMContentLoaded", async () => {
  // Timeout di sicurezza: se dopo 20s siamo ancora sul loading, mostra login
  // 45s: copre il caso peggiore di loadAll() con retry automatico incluso
  // (8s getSession + 15s + 1.5s pausa + 15s ≈ 39.5s) con margine, altrimenti un
  // utente già loggato su rete lenta vedrebbe comparire il login proprio mentre
  // il caricamento sta per completarsi con successo.
  const safetyTimeout = setTimeout(() => {
    const ls = document.getElementById("loading-screen");
    if (ls && ls.style.display !== "none") {
      ls.style.display = "none";
      showLoginScreen();
    }
  }, 45000);

  try {
    // Controlla se arriviamo da link email Supabase (token nell'hash)
    const params = getHashParams();

    // GESTIONE ERRORI dal link email (es. link scaduto)
    if (params.error) {
      history.replaceState(null, "", window.location.pathname);
      clearTimeout(safetyTimeout);
      document.getElementById("loading-screen").style.display = "none";
      showLoginScreen();
      showExpiredLinkModal(params.error_code, params.error_description);
      return;
    }

    if (params.access_token && params.type) {
      // Arrivo da link email — pulisci SUBITO l'URL per evitare confusione
      history.replaceState(null, "", window.location.pathname);

      // Salva sessione
      saveSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
        expires_in: parseInt(params.expires_in) || 3600,
        user: { email: params.email || "" },
      });

      // IMPORTANTE: il payload del link email contiene solo l'email, non l'id
      // utente completo. Senza l'id, ogni inserimento (serpenti/logs/venduti)
      // verrebbe rifiutato dalle policy RLS (auth.uid() = user_id non potrebbe
      // mai essere valorizzato). Recuperiamo quindi l'utente reale da Supabase,
      // esattamente come fa già getSession() per il login normale.
      try {
        const freshSession = await withTimeout(getSession(), 8000, null);
        if (freshSession && freshSession.user && freshSession.user.id) {
          _currentUser = freshSession.user;
        }
      } catch (sessErr) {
        console.warn(
          "Recupero utente completo dopo link email fallito:",
          sessErr,
        );
      }

      // Carica dati con gestione errori
      try {
        await loadAll();
        await loadUserPlan();
      } catch (loadErr) {
        console.error("loadAll dopo email:", loadErr);
      }

      clearTimeout(safetyTimeout);
      document.getElementById("loading-screen").style.display = "none";
      hideLoginScreen();
      showPage("dashboard");
      setTimeout(initCookieBanner, 1500);
      setTimeout(() => showAuthSuccess(params.type), 300);
      return;
    }

    // Controlla sessione esistente
    let session = null;
    try {
      session = await withTimeout(getSession(), 8000, null);
    } catch (e) {
      console.warn("getSession errore (probabile Safari privata):", e);
      session = null;
    }

    if (session && session.access_token) {
      // Utente già loggato
      _currentUser = session.user || {};
      try {
        await loadAll();
        await loadUserPlan();
      } catch (e) {
        console.warn("loadAll errore:", e);
      }
      clearTimeout(safetyTimeout);
      document.getElementById("loading-screen").style.display = "none";
      hideLoginScreen();
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("checkout") === "success") {
        const sessionId = urlParams.get("session_id");
        history.replaceState(null, "", window.location.pathname);
        if (!checkHash()) showPage("dashboard");
        if (sessionId) {
          setTimeout(() => verifyAndUpdatePlan(sessionId), 500);
        } else {
          setTimeout(() => loadUserPlan(), 1000);
        }
      } else if (urlParams.get("checkout") === "cancel") {
        history.replaceState(null, "", window.location.pathname);
        if (!checkHash()) showPage("dashboard");
        toast("Pagamento annullato", "#c0392b");
      } else {
        if (!checkHash()) showPage("dashboard");
      }
      setTimeout(initCookieBanner, 1500);
    } else {
      // Nessuna sessione — mostra landing page
      clearTimeout(safetyTimeout);
      showLanding();
      setTimeout(initCookieBanner, 1500);
    }
  } catch (e) {
    clearTimeout(safetyTimeout);
    console.warn("Init errore generale, mostro landing:", e);
    document.getElementById("loading-screen").style.display = "none";
    showLanding();
  }
});
