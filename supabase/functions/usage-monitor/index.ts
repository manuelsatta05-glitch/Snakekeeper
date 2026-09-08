import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const RESEND_READONLY_KEY = Deno.env.get('RESEND_READONLY_KEY') ?? '';
const UPTIMEROBOT_API_KEY = Deno.env.get('UPTIMEROBOT_API_KEY') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const MONITOR_SECRET = Deno.env.get('MONITOR_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Questo endpoint espone il fatturato Stripe del mese ed e' protetto da una sola
// password statica. Solo l'origine del sito puo' leggerlo dal browser.
const ALLOWED_ORIGINS = ['https://snakekeeper.it', 'https://www.snakekeeper.it'];

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-monitor-secret',
    'Vary': 'Origin',
  };
}

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('cf-connecting-ip') || 'unknown';
}

// Confronto a tempo costante: non cambia nulla su rete pubblica (il jitter copre
// qualsiasi differenza), ma costa una riga e toglie il dubbio.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Rate limit volutamente fail-open: qui la vera barriera e' il segreto, e un problema
// temporaneo del database non deve impedire di guardare i consumi. Serve solo a
// rendere impraticabile il brute force della password.
async function checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_rate_limit`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_key: key, p_max_requests: maxRequests, p_window_seconds: windowSeconds }),
    });
    if (!res.ok) return true;
    return await res.json();
  } catch (e) {
    return true;
  }
}

function startOfMonthISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function fetchWithTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(timeoutValue), ms)),
  ]);
}

async function getResendUsage() {
  if (!RESEND_READONLY_KEY) return { error: 'RESEND_READONLY_KEY non configurata (chiave separata, non RESEND_API_KEY)' };
  try {
    const sinceStr = startOfMonthISO();
    let count = 0;
    let cursor: string | null = null;
    let pages = 0;
    const MAX_PAGES = 10;
    while (pages < MAX_PAGES) {
      const url = new URL('https://api.resend.com/emails');
      url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('after', cursor);
      let res: Response;
      try {
        res = await fetchWithTimeout(url.toString(), { headers: { 'Authorization': `Bearer ${RESEND_READONLY_KEY}` } }, 6000);
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return { error: 'Timeout: Resend non ha risposto in tempo' };
        throw e;
      }
      if (!res.ok) return { error: `Resend API ${res.status}` };
      const data = await res.json();
      const items = data.data || [];
      if (items.length === 0) break;
      let stillInMonth = 0;
      for (const item of items) {
        if (item.created_at >= sinceStr) { count++; stillInMonth++; }
      }
      if (stillInMonth < items.length) break;
      cursor = items[items.length - 1].id;
      pages++;
      if (!data.has_more) break;
    }
    return { sentThisMonth: count, monthLimit: 3000, dayLimit: 100 };
  } catch (e) {
    return { error: String(e) };
  }
}

async function getUptimeRobotUsage() {
  if (!UPTIMEROBOT_API_KEY) return { error: 'UPTIMEROBOT_API_KEY non configurata' };
  try {
    const res = await fetchWithTimeout('https://api.uptimerobot.com/v2/getMonitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `api_key=${UPTIMEROBOT_API_KEY}&format=json&limit=50`,
    }, 6000);
    const data = await res.json();
    if (data.stat !== 'ok') return { error: data.error?.message || JSON.stringify(data) };
    const used = (data.monitors || []).length;
    return { monitorsUsed: used, monitorLimit: 50 };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { error: 'Timeout: UptimeRobot non ha risposto in tempo' };
    return { error: String(e) };
  }
}

async function getStripeUsage() {
  if (!STRIPE_SECRET_KEY) return { error: 'STRIPE_SECRET_KEY non configurata' };
  try {
    const sinceUnix = Math.floor(new Date(startOfMonthISO()).getTime() / 1000);
    const res = await fetchWithTimeout(`https://api.stripe.com/v1/charges?created[gte]=${sinceUnix}&limit=100`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
    }, 6000);
    const data = await res.json();
    if (data.error) return { error: data.error.message };
    const charges = (data.data || []).filter((c: any) => c.paid && !c.refunded);
    const totalCents = charges.reduce((s: number, c: any) => s + (c.amount || 0), 0);
    return { paymentsThisMonth: charges.length, revenueThisMonth: (totalCents / 100).toFixed(2) };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return { error: 'Timeout: Stripe non ha risposto in tempo' };
    return { error: String(e) };
  }
}

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  // Il segreto si accetta SOLO dall'header. Prima era ammesso anche ?secret=... in
  // query string: finiva nei log del server, nella cronologia del browser e
  // nell'header Referer verso qualunque risorsa esterna caricata dalla pagina.
  const providedSecret = req.headers.get('x-monitor-secret') ?? '';

  // Senza questo, la password del monitor era brute-forzabile senza alcun freno:
  // e' l'unica cosa che protegge il fatturato Stripe.
  const ip = getClientIp(req);
  if (!await checkRateLimit(`usage-monitor:${ip}`, 20, 900)) {
    return new Response(JSON.stringify({ error: 'Troppi tentativi. Riprova tra qualche minuto.' }), {
      status: 429, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  if (!MONITOR_SECRET || !timingSafeEqual(providedSecret, MONITOR_SECRET)) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), {
      status: 401, headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }

  const [resend, uptimerobot, stripe] = await Promise.all([
    withTimeout(getResendUsage(), 15000, { error: 'Timeout: Resend non ha risposto in tempo' }),
    withTimeout(getUptimeRobotUsage(), 15000, { error: 'Timeout: UptimeRobot non ha risposto in tempo' }),
    withTimeout(getStripeUsage(), 15000, { error: 'Timeout: Stripe non ha risposto in tempo' }),
  ]);

  return new Response(JSON.stringify({ resend, uptimerobot, stripe, checkedAt: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS },
  });
});
