import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const SB_HEADERS = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

const ALLOWED_ORIGINS = ['https://snakekeeper.it', 'https://www.snakekeeper.it'];

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Vary': 'Origin',
  };
}

function json(body: any, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

// Prima questa funzione restituiva `true` (= consenti) anche quando il controllo
// falliva: un singolo errore del database faceva sparire il rate limit senza che
// nessuno se ne accorgesse. Ora l'esito e' esplicito e chi chiama decide. Su
// un'azione distruttiva e irreversibile come questa si sceglie fail-closed: meglio
// un "riprova piu' tardi" che una cancellazione di account senza freni.
type RateLimitResult = 'ok' | 'limited' | 'error';

async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<RateLimitResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: { ...SB_HEADERS },
      body: JSON.stringify({ p_key: key, p_max_requests: maxRequests, p_window_seconds: windowSeconds })
    });
    if (!res.ok) return 'error';
    return (await res.json()) === true ? 'ok' : 'limited';
  } catch (e) {
    return 'error';
  }
}

async function log(message: string, data: any = null) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/debug_log`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ source: 'delete-account', message, data })
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

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, CORS);

  // Azione distruttiva e rara: max 5 richieste ogni 60 minuti per IP
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`delete-account:${ip}`, 5, 3600);
  if (rl === 'limited') {
    return json({ error: 'Troppe richieste. Riprova piu\' tardi.' }, 429, CORS);
  }
  if (rl === 'error') {
    await log('Rate limit non verificabile: richiesta rifiutata per prudenza', { ip });
    return json({ error: 'Servizio temporaneamente non disponibile. Riprova tra qualche minuto.' }, 503, CORS);
  }

  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      await log('Richiesta rifiutata: nessun token valido');
      return json({ error: 'Non autenticato' }, 401, CORS);
    }
    const userId = user.id;

    await log('Avvio eliminazione account', { userId });

    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=*`, { headers: SB_HEADERS });
    const plans = await pRes.json();
    const userPlan = plans?.[0];

    if (userPlan?.stripe_subscription_id) {
      try {
        const delRes = await fetch(`https://api.stripe.com/v1/subscriptions/${userPlan.stripe_subscription_id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
        });
        const delData = await delRes.json();
        await log('Abbonamento Stripe cancellato', { status: delData.status, error: delData.error });
      } catch(e) {
        await log('Errore cancellazione Stripe (si procede comunque)', { error: e.message });
      }
    }

    // I trasferimenti non venivano ripuliti: restavano righe con l'email e la scheda
    // dei serpenti di un account ormai cancellato (dato personale che sopravvive alla
    // richiesta di cancellazione), e gli inviti in uscita ancora 'pending' diventavano
    // orfani, accettabili da un destinatario verso un mittente che non esiste piu'.
    // Si cancellano sia quelli inviati (mittente_id) sia quelli ricevuti
    // (destinatario_email): in entrambi i casi la riga contiene l'email dell'utente.
    const trDeleted: Record<string, number> = {};
    const trRes = await fetch(`${SUPABASE_URL}/rest/v1/trasferimenti?mittente_id=eq.${userId}`, {
      method: 'DELETE',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' }
    });
    trDeleted.inviati = trRes.status;

    if (user.email) {
      const trRes2 = await fetch(
        `${SUPABASE_URL}/rest/v1/trasferimenti?destinatario_email=eq.${encodeURIComponent(user.email.toLowerCase())}`,
        { method: 'DELETE', headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' } }
      );
      trDeleted.ricevuti = trRes2.status;
    }
    await log('Trasferimenti ripuliti', trDeleted);

    const tables = ['logs', 'venduti', 'serpenti', 'user_plans'];
    for (const table of tables) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?user_id=eq.${userId}`, {
        method: 'DELETE',
        headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' }
      });
      await log(`Tabella ${table} ripulita`, { status: res.status });
    }

    const authDelRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` }
    });

    if (!authDelRes.ok) {
      const errBody = await authDelRes.text();
      await log('ERRORE: eliminazione utente Auth fallita', { status: authDelRes.status, body: errBody });
      return json({ error: 'Dati eliminati ma la rimozione dell\'account di accesso e\' fallita. Contatta il supporto.' }, 500, CORS);
    }

    await log('Account eliminato con successo', { userId });
    return json({ success: true }, 200, CORS);

  } catch (e) {
    await log('ECCEZIONE', { error: e.message });
    return json({ error: e.message }, 500, CORS);
  }
});
