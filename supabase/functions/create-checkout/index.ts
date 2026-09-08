import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const BASE_URL = 'https://snakekeeper.it/';

// Il prezzo non arriva MAI dal client: il browser manda solo la chiave del piano
// e il price id lo risolve il server da questa mappa.
const PRICES: Record<string, { id: string; mode: string }> = {
  monthly:  { id: 'price_1TyteJ2V7PprrT59S3uhFmUm', mode: 'subscription' },
  yearly:   { id: 'price_1Tytez2V7PprrT594TmhtdCf', mode: 'subscription' },
  for_life: { id: 'price_1TytI32V7PprrT59MjzwPC9i', mode: 'payment' },
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

const SB_HEADERS = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

async function log(message: string, data: any = null) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/debug_log`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ source: 'create-checkout', message, data })
    });
  } catch(e) {}
}

// ═══════════════════════════════════════
//  RATE LIMITING
// ═══════════════════════════════════════
function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

// Esito esplicito invece di un booleano: 'error' non deve essere confuso con
// 'ok'. Qui si sceglie comunque di lasciar passare (vedi sotto), ma almeno
// resta scritto nei log invece di sparire in silenzio.
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
  } catch(e) {
    return 'error';
  }
}

// Deriva l'id utente reale dal token di sessione, invece di fidarsi del
// valore mandato dal client: evita che qualcuno possa far accreditare
// l'acquisto (pagato da lui) sull'account di un'altra persona.
async function getAuthenticatedUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const user = await res.json();
    return user?.id || null;
  } catch(e) { return null; }
}

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  // Max 10 richieste ogni 5 minuti per indirizzo IP.
  //
  // Volutamente FAIL-OPEN, al contrario di transfer-snake e delete-account: qui
  // non si manda nessuna email e non si addebita nulla, si crea solo una
  // sessione di checkout. Rifiutare per un problema temporaneo del database
  // significherebbe far fallire un acquisto — un danno certo, per prevenire un
  // abuso che non costa nulla. L'esito 'error' resta pero' registrato nei log,
  // cosi' un rate limit rotto e' visibile invece di sparire.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`create-checkout:${ip}`, 10, 300);
  if (rl === 'limited') {
    return new Response(JSON.stringify({ error: 'Troppe richieste. Riprova tra qualche minuto.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '300', ...CORS }
    });
  }
  if (rl === 'error') {
    await log('Rate limit non verificabile: si prosegue comunque (fail-open voluto)', { ip });
  }

  try {
    const { plan, email } = await req.json();
    const price = PRICES[plan];
    if (!price) {
      return new Response(JSON.stringify({ error: 'Piano non valido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    // L'id utente viene SEMPRE dal token verificato, mai da quello che manda il client.
    const authenticatedUserId = await getAuthenticatedUserId(req);
    if (!authenticatedUserId) {
      return new Response(JSON.stringify({ error: 'Devi essere loggato per acquistare un piano.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    const params = new URLSearchParams();
    params.append('line_items[0][price]', price.id);
    params.append('line_items[0][quantity]', '1');
    params.append('mode', price.mode);
    params.append('success_url', BASE_URL + '?checkout=success&session_id={CHECKOUT_SESSION_ID}');
    params.append('cancel_url', BASE_URL + '?checkout=cancel');
    params.append('payment_method_types[0]', 'card');
    params.append('managed_payments[enabled]', 'false');
    if (email) params.append('customer_email', email);

    if (price.mode === 'payment') {
      if (email) params.append('payment_intent_data[receipt_email]', email);
      params.append('payment_intent_data[description]', `SnakeKeeper ${plan === 'for_life' ? 'For Life' : 'Pro'}`);
    } else {
      params.append('subscription_data[description]', `SnakeKeeper Pro (${plan === 'yearly' ? 'annuale' : 'mensile'})`);
    }

    // Questo metadata e' l'unico identificatore affidabile che arriva fino al
    // webhook e a verify-checkout: entrambi lo usano come prima scelta.
    params.append('metadata[user_id]', authenticatedUserId);
    params.append('metadata[plan]', plan);

    params.append('locale', 'it');
    params.append('billing_address_collection', 'auto');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS }
      });
    }

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { 'Content-Type': 'application/json', ...CORS }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS }
    });
  }
});
