import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const REFUND_WINDOW_DAYS = 14;

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

function makeJson(cors: Record<string, string>) {
  return (body: any, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json' }
    });
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
      body: JSON.stringify({ source: 'cancel-subscription', message, data })
    });
  } catch(e) {}
}

// ═══════════════════════════════════════════════════════════════
//  SICUREZZA: verifica che il chiamante sia DAVVERO l'utente di
//  cui sta chiedendo di cancellare l'abbonamento. Senza questo
//  controllo, chiunque potrebbe passare un userId altrui nel body
//  e cancellare/rimborsare l'abbonamento di un altro cliente.
// ═══════════════════════════════════════════════════════════════
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

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) {
    await log('Email saltata', { to: !!to, hasKey: !!RESEND_API_KEY });
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SnakeKeeper <noreply@snakekeeper.it>',
        to: [to],
        subject,
        html,
      }),
    });
    const data = await res.json();
    await log('Email disdetta inviata', { to, subject, resendId: data.id, error: data.message });
  } catch(e) {
    await log('Errore invio email disdetta', { error: e.message });
  }
}

function cancellationEmailHtml(refunded: boolean, refundAmount: number, accessUntil: number | null): string {
  const now = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const accessDate = accessUntil
    ? new Date(accessUntil * 1000).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;
  const refundStr = refundAmount > 0 ? refundAmount.toFixed(2).replace('.', ',') : '0,00';

  return `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #0f1a0f; color: #e8f5e8; margin: 0; padding: 20px; }
  .container { max-width: 560px; margin: 0 auto; background: #1a2e1a; border-radius: 12px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #2d5a27, #1a3d15); padding: 32px 24px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; color: #c9a84c; }
  .header p { margin: 8px 0 0; color: #a8d8a8; font-size: 14px; }
  .body { padding: 28px 24px; }
  .body h2 { color: #e8a84c; margin-top: 0; }
  .info-box { background: rgba(109,181,109,0.08); border: 1px solid rgba(109,181,109,0.25); border-radius: 8px; padding: 16px; margin: 20px 0; }
  .info-box.refund { background: rgba(201,168,76,0.08); border-color: rgba(201,168,76,0.3); }
  .info-box strong { color: #6dbf6d; font-size: 16px; }
  .info-box.refund strong { color: #c9a84c; }
  .info-box p { margin: 6px 0 0; color: #a8d8a8; font-size: 13px; }
  .btn { display: inline-block; background: #2d7a2d; color: #e8f5e8; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; margin: 16px 0; }
  .footer { padding: 16px 24px; border-top: 1px solid #2d4a2d; text-align: center; font-size: 12px; color: #6b8f6b; }
  .icon { font-size: 40px; display: block; text-align: center; margin-bottom: 12px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🐍 SnakeKeeper</h1>
    <p>Gestione professionale per allevatori</p>
  </div>
  <div class="body">
    <span class="icon">🔔</span>
    <h2>Abbonamento disdetto</h2>
    <p>Ciao,</p>
    <p>la tua richiesta di disdetta è stata elaborata con successo in data <strong>${now}</strong>.</p>
    ${refunded ? `
    <div class="info-box refund">
      <strong>💸 Rimborso in elaborazione: €${refundStr}</strong>
      <p>Il rimborso completo sarà accreditato sul tuo metodo di pagamento originale entro <strong>5–10 giorni lavorativi</strong>, a seconda della tua banca.</p>
    </div>
    <div class="info-box">
      <strong>Accesso terminato</strong>
      <p>Il tuo piano Pro è stato disattivato immediatamente. Il tuo account è ora sul piano gratuito.</p>
    </div>
    ` : accessDate ? `
    <div class="info-box">
      <strong>📅 Accesso garantito fino al ${accessDate}</strong>
      <p>Il tuo piano Pro rimarrà attivo fino alla fine del periodo di fatturazione già pagato. Dopo questa data il tuo account passerà automaticamente al piano gratuito.</p>
    </div>
    ` : `
    <div class="info-box">
      <strong>Accesso terminato</strong>
      <p>Il tuo piano Pro è stato disattivato. Il tuo account è ora sul piano gratuito.</p>
    </div>
    `}
    <p>Siamo dispiaciuti di vederti andare. Se hai suggerimenti o hai riscontrato problemi, scrivici a <a href="mailto:noreply@snakekeeper.it" style="color:#6dbf6d;">noreply@snakekeeper.it</a>.</p>
    <p>Puoi riattivare un piano in qualsiasi momento dalla sezione Impostazioni del sito.</p>
    <p style="text-align:center">
      <a href="https://snakekeeper.it" class="btn">Accedi a SnakeKeeper</a>
    </p>
  </div>
  <div class="footer">
    <p>SnakeKeeper · snakekeeper.it · <a href="mailto:noreply@snakekeeper.it" style="color:#6b8f6b;">noreply@snakekeeper.it</a></p>
  </div>
</div>
</body></html>`;
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });
    const user = await res.json();
    return user?.email || null;
  } catch(e) { return null; }
}

async function getStripeCustomerEmail(customerId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
    });
    const customer = await res.json();
    return customer.email || null;
  } catch(e) { return null; }
}

function extractPeriodEnd(sub: any): number | null {
  if (sub.current_period_end) return sub.current_period_end;
  if (sub.cancel_at) return sub.cancel_at;
  if (sub.ended_at) return sub.ended_at;
  const item = sub.items?.data?.[0];
  if (item?.current_period_end) return item.current_period_end;
  return null;
}

async function findChargeForInvoice(customerId: string, invoiceAmount: number, invoiceCreated: number): Promise<string | null> {
  try {
    const piRes = await fetch(`https://api.stripe.com/v1/payment_intents?customer=${customerId}&limit=20`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
    });
    const pis = await piRes.json();
    const candidates = (pis.data || []).filter((p: any) => p.status === 'succeeded' && p.amount === invoiceAmount && p.latest_charge);
    if (candidates.length === 0) return null;
    candidates.sort((a: any, b: any) => Math.abs(a.created - invoiceCreated) - Math.abs(b.created - invoiceCreated));
    return candidates[0].latest_charge;
  } catch(e) { return null; }
}

Deno.serve(async (req: Request) => {
  const CORS = corsFor(req);
  const json = makeJson(CORS);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Max 10 richieste ogni 5 minuti per IP.
  //
  // Volutamente FAIL-OPEN, al contrario di transfer-snake e delete-account:
  // impedire una disdetta e' un danno diretto per il cliente, che continua a
  // essere addebitato e puo' perdere la finestra di rimborso di 14 giorni.
  // L'abuso possibile e' invece limitato: serve un token valido E il token deve
  // corrispondere esattamente all'utente richiesto, quindi si puo' agire solo
  // sul proprio abbonamento. L'esito 'error' resta registrato nei log.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`cancel-subscription:${ip}`, 10, 300);
  if (rl === 'limited') {
    return json({ error: 'Troppe richieste. Riprova tra qualche minuto.' }, 429);
  }
  if (rl === 'error') {
    await log('Rate limit non verificabile: si prosegue comunque (fail-open voluto)', { ip });
  }

  try {
    const { userId, action } = await req.json();
    if (!userId) return json({ error: 'userId mancante' }, 400);

    // ═══ CONTROLLO DI SICUREZZA ═══
    // Il chiamante deve essere autenticato E il token deve appartenere
    // esattamente allo userId richiesto. Blocca ogni tentativo di agire
    // sull'abbonamento di un altro utente.
    const authenticatedId = await getAuthenticatedUserId(req);
    if (!authenticatedId) {
      await log('Richiesta rifiutata: nessun token valido', { requestedUserId: userId });
      return json({ error: 'Non autenticato' }, 401);
    }
    if (authenticatedId !== userId) {
      await log('Richiesta rifiutata: tentativo di agire su un altro account', { authenticatedId, requestedUserId: userId });
      return json({ error: 'Non autorizzato' }, 403);
    }

    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=*`, { headers: SB_HEADERS });
    const plans = await pRes.json();
    const userPlan = plans?.[0];

    if (!userPlan) return json({ error: 'Piano non trovato' }, 404);
    if (userPlan.plan === 'free') return json({ error: 'Nessun abbonamento attivo' }, 400);
    if (userPlan.plan === 'admin' || userPlan.plan === 'free_forever') {
      return json({ error: 'Questo piano non può essere cancellato' }, 400);
    }

    const customerId = userPlan.stripe_customer_id;
    const subId = userPlan.stripe_subscription_id;

    const userEmail = await getUserEmail(userId)
      || (customerId ? await getStripeCustomerEmail(customerId) : null);

    // ═══ INFO ═══
    if (action === 'info') {
      let purchaseDate: number | null = null;
      let amount = 0;
      let currency = 'eur';
      let periodEnd: number | null = null;
      let isSubscription = false;
      let cancelAtPeriodEnd = false;
      let status = '';

      if (subId) {
        const sRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
        });
        const sub = await sRes.json();
        if (!sub.error) {
          isSubscription = true;
          purchaseDate = sub.start_date || sub.created;
          periodEnd = extractPeriodEnd(sub);
          amount = sub.items?.data?.[0]?.price?.unit_amount || 0;
          currency = sub.currency || 'eur';
          cancelAtPeriodEnd = !!sub.cancel_at_period_end;
          status = sub.status || '';
        }
      } else if (customerId) {
        const piRes = await fetch(`https://api.stripe.com/v1/payment_intents?customer=${customerId}&limit=10`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
        });
        const pis = await piRes.json();
        const paid = pis.data?.find((p: any) => p.status === 'succeeded');
        if (paid) {
          purchaseDate = paid.created;
          amount = paid.amount;
          currency = paid.currency;
        }
      }

      const now = Math.floor(Date.now() / 1000);
      const daysSince = purchaseDate ? Math.floor((now - purchaseDate) / 86400) : 999;
      const refundEligible = daysSince <= REFUND_WINDOW_DAYS;

      return json({
        plan: userPlan.plan, isSubscription, purchaseDate, daysSince, refundEligible,
        refundDaysLeft: Math.max(0, REFUND_WINDOW_DAYS - daysSince),
        amount: amount / 100, currency, periodEnd, cancelAtPeriodEnd, status,
      });
    }

    // ═══ CANCEL ═══
    if (action !== 'cancel') return json({ error: 'Azione non valida' }, 400);

    let refunded = false;
    let refundAmount = 0;

    if (subId) {
      const sRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
      });
      const sub = await sRes.json();
      if (sub.error) return json({ error: 'Abbonamento non trovato su Stripe' }, 404);

      const purchaseDate = sub.start_date || sub.created;
      const now = Math.floor(Date.now() / 1000);
      const daysSince = Math.floor((now - purchaseDate) / 86400);
      const eligible = daysSince <= REFUND_WINDOW_DAYS;
      await log('Valutazione cancellazione', { daysSince, eligible, subId });

      if (eligible) {
        const delRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
        });
        const delData = await delRes.json();
        await log('Subscription cancellata', { status: delData.status });

        const invRes = await fetch(`https://api.stripe.com/v1/invoices?subscription=${subId}&limit=5`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
        });
        const invs = await invRes.json();
        const paidInv = invs.data?.find((i: any) => i.status === 'paid');
        await log('Fatture trovate', { count: invs.data?.length, paidInvId: paidInv?.id, amount: paidInv?.amount_paid, created: paidInv?.created });

        if (paidInv) {
          const chargeId = await findChargeForInvoice(customerId, paidInv.amount_paid, paidInv.created);
          await log('Charge identificato', { chargeId });

          if (chargeId) {
            const rParams = new URLSearchParams();
            rParams.append('charge', chargeId);
            rParams.append('reason', 'requested_by_customer');
            const rRes = await fetch('https://api.stripe.com/v1/refunds', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
              body: rParams.toString()
            });
            const refund = await rRes.json();
            await log('Risultato refund', { error: refund.error, status: refund.status, amount: refund.amount });
            if (!refund.error) {
              refunded = true;
              refundAmount = (refund.amount || 0) / 100;
            }
          }
        }

        await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ plan: 'free', stripe_subscription_id: null, valid_until: null })
        });

        if (userEmail) {
          await sendEmail(
            userEmail,
            refunded ? '🔔 Abbonamento SnakeKeeper disdetto — Rimborso in arrivo' : '🔔 Abbonamento SnakeKeeper disdetto',
            cancellationEmailHtml(refunded, refundAmount, null)
          );
        }

        return json({ success: true, refunded, refundAmount, immediate: true });

      } else {
        const cParams = new URLSearchParams();
        cParams.append('cancel_at_period_end', 'true');
        const cRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: cParams.toString()
        });
        const updated = await cRes.json();
        const accessUntil = extractPeriodEnd(updated);

        await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ valid_until: accessUntil ? new Date(accessUntil * 1000).toISOString() : null })
        });

        if (userEmail) {
          await sendEmail(
            userEmail,
            '🔔 Abbonamento SnakeKeeper disdetto',
            cancellationEmailHtml(false, 0, accessUntil)
          );
        }

        return json({ success: true, refunded: false, immediate: false, accessUntil });
      }

    } else if (customerId) {
      const piRes = await fetch(`https://api.stripe.com/v1/payment_intents?customer=${customerId}&limit=10`, {
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
      });
      const pis = await piRes.json();
      const paid = pis.data?.find((p: any) => p.status === 'succeeded');
      if (!paid) return json({ error: 'Pagamento non trovato' }, 404);

      const now = Math.floor(Date.now() / 1000);
      const daysSince = Math.floor((now - paid.created) / 86400);
      if (daysSince > REFUND_WINDOW_DAYS) {
        return json({ error: `Il periodo di rimborso di ${REFUND_WINDOW_DAYS} giorni è scaduto.` }, 400);
      }

      const chargeId = paid.latest_charge;
      if (!chargeId) return json({ error: 'Charge non trovato per questo pagamento' }, 404);

      const rParams = new URLSearchParams();
      rParams.append('charge', chargeId);
      rParams.append('reason', 'requested_by_customer');
      const rRes = await fetch('https://api.stripe.com/v1/refunds', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${STRIPE_SECRET}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: rParams.toString()
      });
      const refund = await rRes.json();
      if (refund.error) return json({ error: refund.error.message }, 400);

      await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ plan: 'free', valid_until: null })
      });

      if (userEmail) {
        await sendEmail(
          userEmail,
          '🔔 Piano SnakeKeeper disdetto — Rimborso in arrivo',
          cancellationEmailHtml(true, (refund.amount || 0) / 100, null)
        );
      }

      return json({ success: true, refunded: true, refundAmount: (refund.amount || 0) / 100, immediate: true });
    }

    return json({ error: 'Nessun abbonamento o pagamento collegato' }, 400);

  } catch (e) {
    await log('ECCEZIONE', { error: e.message });
    return json({ error: e.message }, 500);
  }
});
