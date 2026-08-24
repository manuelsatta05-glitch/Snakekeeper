import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const SUPPORT_EMAIL = 'snakekeeper.it@gmail.com';
const APP_URL = 'https://snakekeeper.it';
const GIORNI_VALIDITA = 30;

const SB_HEADERS = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: { ...SB_HEADERS },
      body: JSON.stringify({ p_key: key, p_max_requests: maxRequests, p_window_seconds: windowSeconds })
    });
    if (!res.ok) return true;
    return await res.json();
  } catch(e) { return true; }
}

async function log(message: string, data: any = null) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/debug_log`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ source: 'transfer-snake', message, data })
    });
  } catch(e) {}
}

async function getAuthenticatedUser(req: Request): Promise<{ id: string, email: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id) return null;
    return { id: user.id, email: user.email || '' };
  } catch(e) { return null; }
}

// Il nome del serpente finisce dentro un'email HTML ed e' testo scritto dall'utente:
// va sempre scappato e accorciato, altrimenti il template diventa un veicolo di spam.
function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function short(value: unknown, max = 60): string {
  const s = value === null || value === undefined ? '' : String(value);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Solo l'ultima registrazione per ogni tipo. Senza almeno queste, sull'account del
// cliente il serpente comparirebbe subito nell'alert "nessun pasto" della dashboard.
function ultimiLogPerTipo(snapshot: any[]): any[] {
  if (!Array.isArray(snapshot)) return [];
  const perTipo: Record<string, any> = {};
  for (const l of snapshot) {
    if (!l || !l.tipo) continue;
    const prev = perTipo[l.tipo];
    if (!prev) { perTipo[l.tipo] = l; continue; }
    const a = `${l.data || ''}|${l.created_at || ''}`;
    const b = `${prev.data || ''}|${prev.created_at || ''}`;
    if (a > b) perTipo[l.tipo] = l;
  }
  // Scartati di proposito: id, snake_id, user_id, created_at (rigenerati lato DB),
  // `note` e `partner_id` (annotazioni interne / riferimenti ai serpenti dell'allevatore).
  return Object.values(perTipo).map((l: any) => ({
    tipo: l.tipo, data: l.data ?? null,
    grammi: l.grammi ?? null, qty: l.qty ?? null,
    food_tipo: l.food_tipo ?? null, feci_tipo: l.feci_tipo ?? null,
    num_uova: l.num_uova ?? null, fertili: l.fertili ?? null,
    temp: l.temp ?? null, pulizia_tipo: l.pulizia_tipo ?? null,
    partner_esterno: l.partner_esterno ?? null,
  }));
}

function buildPayload(v: any) {
  return {
    nome: v.nome ?? null,
    specie: v.specie ?? null,
    morfo: v.morfo ?? null,
    sesso: v.sesso ?? null,
    nascita: v.nascita ?? null,
    peso: v.peso ?? null,
    provenienza: v.provenienza ?? null,
    icd: v.icd ?? null,
    genetica: v.genetica ?? null,
    foto_url: v.foto_url ?? null,
    foto_position: v.foto_position ?? null,
    // La genealogia viaggia sempre come testo: padre_id/madre_id puntano ai serpenti
    // dell'allevatore e sull'account del cliente non avrebbero alcun significato.
    padre_esterno: v.padre_nome ?? v.padre_esterno ?? null,
    madre_esterna: v.madre_nome ?? v.madre_esterna ?? null,
    logs: ultimiLogPerTipo(v.logs_snapshot),
  };
}

function emailHtml(nomeSerpente: string, mittente: string): string {
  const n = esc(short(nomeSerpente, 60));
  const m = esc(short(mittente, 120));
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#222">
    <h2 style="color:#0f2d14;margin-bottom:4px">🐍 SnakeKeeper</h2>

    <p style="font-size:15px">Ciao,</p>
    <p style="font-size:15px">
      <strong>${m}</strong> ti ha inviato la scheda di <strong>${n}</strong> su SnakeKeeper:
      anagrafica, foto e ultime registrazioni sono gia' pronte e ti aspettano.
    </p>
    <p style="font-size:15px">
      Accedi con <em>questo indirizzo email</em> (o registrati, se non hai ancora un account):
      troverai la richiesta nella sezione <strong>Trasferimenti</strong>, dove potrai accettarla o rifiutarla.
      Nessun dato viene copiato sul tuo account finche' non accetti.
    </p>
    <p style="margin:24px 0">
      <a href="${APP_URL}" style="background:#c9a84c;color:#1a0f00;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;display:inline-block">Apri SnakeKeeper</a>
    </p>
    <p style="font-size:13px;color:#666">La richiesta scade tra ${GIORNI_VALIDITA} giorni.</p>

    <hr style="border:none;border-top:1px solid #ddd;margin:26px 0">

    <p style="font-size:15px">Hi,</p>
    <p style="font-size:15px">
      <strong>${m}</strong> has sent you the record for <strong>${n}</strong> on SnakeKeeper —
      profile, photo and latest entries are already prepared for you.
    </p>
    <p style="font-size:15px">
      Sign in with <em>this email address</em> (or sign up, if you don't have an account yet).
      You'll find the request under <strong>Transfers</strong>, where you can accept or decline it.
      Nothing is copied to your account until you accept. The request expires in ${GIORNI_VALIDITA} days.
    </p>

    <p style="font-size:12px;color:#999;margin-top:28px">
      Se non hai acquistato nulla puoi semplicemente ignorare questo messaggio, non verra' creato
      alcun account a tuo nome. Per segnalazioni: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a><br>
      If you didn't buy anything you can simply ignore this message — no account will be created for you.
    </p>
  </div>`;
}

async function sendEmail(to: string, nomeSerpente: string, mittente: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'SnakeKeeper <noreply@snakekeeper.it>',
        reply_to: SUPPORT_EMAIL,
        to: [to],
        subject: `🐍 ${short(nomeSerpente, 40)} ti aspetta su SnakeKeeper / is waiting for you`,
        html: emailHtml(nomeSerpente, mittente),
      }),
    });
    return res.ok;
  } catch(e) { return false; }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ip = getClientIp(req);
  if (!await checkRateLimit(`transfer-snake-ip:${ip}`, 20, 3600)) {
    return json({ error: 'Troppe richieste. Riprova piu\' tardi.' }, 429);
  }

  try {
    // L'identita' del mittente viene SEMPRE dal JWT, mai dal body: un user_id
    // passato dal client sarebbe banalmente falsificabile.
    const user = await getAuthenticatedUser(req);
    if (!user) return json({ error: 'Non autenticato' }, 401);

    if (!await checkRateLimit(`transfer-snake:${user.id}`, 10, 3600)) {
      return json({ error: 'Hai inviato troppi trasferimenti nell\'ultima ora. Riprova piu\' tardi.' }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const vendutoId = typeof body?.venduto_id === 'string' ? body.venduto_id.trim() : '';
    const emailRaw  = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!vendutoId) return json({ error: 'Vendita non specificata' }, 400);
    if (!EMAIL_RE.test(emailRaw) || emailRaw.length > 254) {
      return json({ error: 'Indirizzo email non valido' }, 400);
    }
    if (emailRaw === (user.email || '').toLowerCase()) {
      return json({ error: 'Non puoi trasferire un serpente a te stesso.' }, 400);
    }

    // Proprieta' verificata server-side: il venduto deve essere di chi chiama.
    const vRes = await fetch(
      `${SUPABASE_URL}/rest/v1/venduti?id=eq.${encodeURIComponent(vendutoId)}&user_id=eq.${user.id}&select=*`,
      { headers: SB_HEADERS }
    );
    const vRows = await vRes.json();
    const venduto = Array.isArray(vRows) ? vRows[0] : null;
    if (!venduto) {
      await log('Vendita non trovata o non di proprieta\'', { userId: user.id, vendutoId });
      return json({ error: 'Vendita non trovata' }, 404);
    }

    // Un invito scaduto resta 'pending' finche' qualcuno non lo tocca, e l'indice unico
    // parziale impedirebbe di inviarne uno nuovo per la stessa vendita. Si marcano
    // scaduti qui: e' l'unico punto in cui la cosa da' davvero fastidio, e cosi' non
    // serve un cron dedicato.
    await fetch(
      `${SUPABASE_URL}/rest/v1/trasferimenti?venduto_id=eq.${encodeURIComponent(vendutoId)}&stato=eq.pending&expires_at=lt.${new Date().toISOString()}`,
      { method: 'PATCH', headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' }, body: JSON.stringify({ stato: 'expired' }) }
    ).catch(() => {});

    const pRes = await fetch(
      `${SUPABASE_URL}/rest/v1/trasferimenti?venduto_id=eq.${encodeURIComponent(vendutoId)}&stato=eq.pending&select=id`,
      { headers: SB_HEADERS }
    );
    const pending = await pRes.json();
    if (Array.isArray(pending) && pending.length > 0) {
      return json({ error: 'Per questa vendita c\'e\' gia\' un invito in attesa. Ritiralo prima di inviarne un altro.' }, 409);
    }

    const id = 'TR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
    const expiresAt = new Date(Date.now() + GIORNI_VALIDITA * 86400000).toISOString();

    const insRes = await fetch(`${SUPABASE_URL}/rest/v1/trasferimenti`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({
        id,
        mittente_id: user.id,
        mittente_email: user.email,
        destinatario_email: emailRaw,
        venduto_id: vendutoId,
        stato: 'pending',
        payload: buildPayload(venduto),
        expires_at: expiresAt,
      })
    });

    if (!insRes.ok) {
      const errBody = await insRes.text();
      // 23505 = l'indice unico parziale ha gia' un pending per questo venduto
      if (insRes.status === 409) {
        return json({ error: 'Per questa vendita c\'e\' gia\' un invito in attesa.' }, 409);
      }
      await log('ERRORE: insert trasferimento fallito', { status: insRes.status, body: errBody });
      return json({ error: 'Non e\' stato possibile creare il trasferimento.' }, 500);
    }

    const sent = await sendEmail(emailRaw, venduto.nome, user.email);
    await log('Trasferimento creato', { id, mittente: user.id, vendutoId, emailInviata: sent });

    // Risposta volutamente identica che l'indirizzo sia registrato o no:
    // altrimenti questo endpoint diventerebbe un oracolo per scoprire chi ha un account.
    return json({ success: true, id, expires_at: expiresAt, email_sent: sent });

  } catch (e) {
    await log('ECCEZIONE', { error: e.message });
    return json({ error: e.message }, 500);
  }
});
