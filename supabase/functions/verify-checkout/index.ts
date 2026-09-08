import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

// Esito esplicito invece di un booleano, cosi' 'error' non viene confuso con 'ok'.
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

async function log(message: string, data: any = null) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/debug_log`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ source: 'verify-checkout', message, data })
    });
  } catch(e) {}
}

async function getCurrentPlan(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=plan`, { headers: SB_HEADERS });
  const data = await res.json();
  return data?.[0]?.plan || null;
}

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  // Max 20 richieste ogni 5 minuti per IP (puo' essere richiamata piu' volte
  // in automatico dal client dopo il redirect da Stripe).
  //
  // Volutamente FAIL-OPEN: questa funzione e' l'ultimo passaggio dopo un
  // pagamento gia' avvenuto. Rifiutarla per un problema del database
  // significherebbe che l'utente ha pagato e non riceve il piano — il danno
  // peggiore possibile in questo flusso. L'esito 'error' resta pero' nei log.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`verify-checkout:${ip}`, 20, 300);
  if (rl === 'limited') {
    return new Response(JSON.stringify({ error: 'Troppe richieste. Riprova tra qualche minuto.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '300', ...CORS }
    });
  }
  if (rl === 'error') {
    await log('Rate limit non verificabile: si prosegue comunque (fail-open voluto)', { ip });
  }

  try {
    const { session_id } = await req.json();
    await log('Richiesta ricevuta', { session_id });

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id mancante' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // 1. Recupera la sessione da Stripe
    const sRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
    });
    const session = await sRes.json();
    await log('Sessione Stripe', {
      payment_status: session.payment_status,
      mode: session.mode,
      customer: session.customer,
      customer_email: session.customer_email,
      metadata: session.metadata,
      error: session.error
    });

    if (session.error) {
      return new Response(JSON.stringify({ error: session.error.message }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // 2. Verifica che sia pagato
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      await log('Pagamento non completato', { payment_status: session.payment_status, status: session.status });
      return new Response(JSON.stringify({ paid: false, plan: null }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // 3. Determina user_id: prima dai metadata (impostati da create-checkout
    //    dall'id ricavato dal JWT verificato), poi da email come fallback per
    //    le sessioni create prima che il metadata esistesse.
    let userId = session.metadata?.user_id || null;
    const email = session.customer_email || session.customer_details?.email;
    await log('Identificazione utente', { userId_from_metadata: userId, email });

    if (!userId && email) {
      const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_id_by_email`, {
        method: 'POST', headers: SB_HEADERS,
        body: JSON.stringify({ p_email: email })
      });
      const rpcData = await rpcRes.json();
      userId = (typeof rpcData === 'string' && rpcData) ? rpcData : null;
      await log('User ID da RPC', { userId, rpcData });
    }

    if (!userId) {
      await log('ERRORE: utente non identificato');
      return new Response(JSON.stringify({ error: 'Utente non identificato' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // 3.5 NON sovrascrivere mai un piano protetto (admin / free_forever),
    // impostato manualmente. Stesso identico controllo gia' presente nel webhook.
    const currentPlan = await getCurrentPlan(userId);
    if (currentPlan === 'admin' || currentPlan === 'free_forever') {
      await log('Skip: piano protetto, non sovrascritto', { userId, currentPlan });
      return new Response(JSON.stringify({ paid: true, plan: currentPlan }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // 4. Determina il piano
    const planFromMeta = session.metadata?.plan;
    const newPlan = (session.mode === 'payment' || planFromMeta === 'for_life') ? 'for_life' : 'pro';
    await log('Piano determinato', { mode: session.mode, planFromMeta, newPlan });

    // 5. Upsert user_plans
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_plans`, {
      method: 'POST',
      headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: userId,
        email: email || null,
        plan: newPlan,
        stripe_customer_id: session.customer || null,
        stripe_subscription_id: session.subscription || null,
      })
    });
    const upsertData = await upsertRes.json();
    await log('Upsert risultato', { status: upsertRes.status, data: upsertData });

    // 6. Verifica finale
    const verifyRes = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=plan`, { headers: SB_HEADERS });
    const verifyData = await verifyRes.json();
    const finalPlan = verifyData?.[0]?.plan;
    await log('Verifica finale', { finalPlan });

    return new Response(JSON.stringify({ paid: true, plan: finalPlan || newPlan }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    await log('ECCEZIONE', { error: e.message, stack: e.stack });
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
});
