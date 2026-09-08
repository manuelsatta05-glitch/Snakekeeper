import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

// Confronto a tempo costante tra due stringhe esadecimali (evita timing attack sulla firma).
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const parts = signature.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1];
    // Stripe puo' inviare piu' firme v1 (durante la rotazione del secret): le raccogliamo tutte.
    const sigs = parts.filter(p => p.startsWith('v1=')).map(p => p.split('=')[1]).filter(Boolean);
    if (!timestamp || sigs.length === 0) return false;

    // Tolleranza timestamp: rifiuta payload piu' vecchi di 5 minuti (protezione anti-replay).
    const tolerance = 300;
    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > tolerance) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Confronto a tempo costante contro ogni firma fornita da Stripe.
    return sigs.some(s => timingSafeEqualHex(expectedSig, s));
  } catch (e) {
    return false;
  }
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
      body: JSON.stringify({ source: 'stripe-webhook', message, data })
    });
  } catch(e) {}
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
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
    await log('Email inviata', { to, subject, resendId: data.id, error: data.message });
  } catch(e) {
    await log('Errore invio email', { to, subject, error: e.message });
  }
}

function planLabel(plan: string): string {
  if (plan === 'for_life') return 'For Life';
  if (plan === 'yearly') return 'Pro Annuale';
  return 'Pro Mensile';
}

function purchaseEmailHtml(plan: string, email: string): string {
  const label = planLabel(plan);
  const now = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
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
  .body h2 { color: #c9a84c; margin-top: 0; }
  .plan-box { background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); border-radius: 8px; padding: 16px; margin: 20px 0; }
  .plan-box strong { color: #c9a84c; font-size: 18px; }
  .plan-box p { margin: 6px 0 0; color: #a8d8a8; font-size: 13px; }
  .btn { display: inline-block; background: #2d7a2d; color: #e8f5e8; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; margin: 16px 0; }
  .footer { padding: 16px 24px; border-top: 1px solid #2d4a2d; text-align: center; font-size: 12px; color: #6b8f6b; }
  .checkmark { color: #6dbf6d; font-size: 48px; display: block; text-align: center; margin-bottom: 12px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>🐍 SnakeKeeper</h1>
    <p>Gestione professionale per allevatori</p>
  </div>
  <div class="body">
    <span class="checkmark">✅</span>
    <h2>Acquisto confermato!</h2>
    <p>Ciao,</p>
    <p>il tuo pagamento è andato a buon fine. Il piano <strong>${label}</strong> è ora attivo sul tuo account.</p>
    <div class="plan-box">
      <strong>Piano ${label}</strong>
      <p>Attivato il ${now}</p>
    </div>
    <p>Puoi ora accedere a tutte le funzionalità premium di SnakeKeeper: esportazione PDF, archivio illimitato di serpenti, e molto altro.</p>
    <p style="text-align:center">
      <a href="https://snakekeeper.it" class="btn">Accedi a SnakeKeeper</a>
    </p>
    <p style="font-size:13px; color:#a8d8a8;">La fattura del tuo acquisto è stata generata da Stripe e sarà disponibile nel tuo account. Hai 14 giorni di tempo per richiedere un rimborso completo dalla sezione <em>Impostazioni &gt; Abbonamento</em> del sito.</p>
  </div>
  <div class="footer">
    <p>SnakeKeeper · snakekeeper.it · <a href="mailto:noreply@snakekeeper.it" style="color:#6b8f6b;">noreply@snakekeeper.it</a></p>
    <p>Hai ricevuto questa email perché hai effettuato un acquisto su SnakeKeeper.</p>
  </div>
</div>
</body></html>`;
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

async function getUserIdByEmail(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_id_by_email`, {
      method: 'POST', headers: SB_HEADERS,
      body: JSON.stringify({ p_email: email })
    });
    const userId = await res.json();
    return (typeof userId === 'string' && userId) ? userId : null;
  } catch(e) { return null; }
}

async function resolveUserId(customerId: string, emailHint: string | null): Promise<string | null> {
  const r1 = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?stripe_customer_id=eq.${customerId}&select=user_id`, { headers: SB_HEADERS });
  const d1 = await r1.json();
  if (d1?.length > 0) return d1[0].user_id;

  let email = emailHint;
  if (!email) email = await getStripeCustomerEmail(customerId);
  if (!email) return null;

  const userId = await getUserIdByEmail(email);
  if (!userId) return null;

  await fetch(`${SUPABASE_URL}/rest/v1/user_plans`, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, email, stripe_customer_id: customerId })
  });
  return userId;
}

// Collega il customer Stripe all'utente. Serve agli eventi successivi
// (customer.subscription.*, invoice.payment_failed), che portano solo `customer`
// e non il metadata del checkout: senza questo collegamento resolveUserId
// dovrebbe ricadere di nuovo sull'email.
async function collegaCustomerAUtente(userId: string, customerId: string) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ stripe_customer_id: customerId })
    });
  } catch(e) {
    await log('Collegamento customer->utente fallito', { userId, customerId, error: e.message });
  }
}

async function getAuthoritativeSubscriptionState(subId: string): Promise<{ status: string; current_period_end: number | null; id: string } | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
    });
    const sub = await res.json();
    if (sub.error) return null;
    const item = sub.items?.data?.[0];
    return {
      status: sub.status,
      current_period_end: sub.current_period_end || item?.current_period_end || null,
      id: sub.id,
    };
  } catch(e) { return null; }
}

// Difesa in profondita': ri-legge la sessione di checkout direttamente da Stripe
// per confermare che il pagamento sia realmente avvenuto prima di attivare "for_life".
async function getCheckoutSession(sessionId: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
    });
    const s = await res.json();
    if (s.error) return null;
    return s;
  } catch(e) { return null; }
}

async function getCurrentPlan(userId: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}&select=plan`, { headers: SB_HEADERS });
  const data = await res.json();
  return data?.[0]?.plan || null;
}

async function updateUserPlan(userId: string, plan: string, subscriptionId: string | null, validUntil: string | null) {
  const currentPlan = await getCurrentPlan(userId);
  if (currentPlan === 'admin' || currentPlan === 'free_forever') {
    await log('Skip: piano protetto, non sovrascritto', { userId, currentPlan, attemptedPlan: plan });
    return;
  }
  await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ plan, stripe_subscription_id: subscriptionId, valid_until: validUntil })
  });
  await log('Piano aggiornato', { userId, plan, subscriptionId });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';

  // ── VERIFICA FIRMA SEMPRE OBBLIGATORIA ──────────────────────────────────────
  // Nessuna eccezione: senza secret configurato o senza firma valida, si rifiuta.
  // Questo chiude il bypass in cui una richiesta senza header 'stripe-signature'
  // veniva processata come autentica.
  if (!STRIPE_WEBHOOK_SECRET) {
    await log('CONFIG ERROR: STRIPE_WEBHOOK_SECRET mancante — webhook rifiutato');
    return new Response('Webhook secret not configured', { status: 500 });
  }
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }
  if (!await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/stripe_events?id=eq.${event.id}&select=id`, { headers: SB_HEADERS });
  const existing = await checkRes.json();
  if (existing?.length > 0) return new Response('Already processed', { status: 200 });
  await fetch(`${SUPABASE_URL}/rest/v1/stripe_events`, {
    method: 'POST',
    headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ id: event.id, type: event.type })
  });

  const obj = event.data?.object;
  await log('Evento ricevuto', { type: event.type, subId: obj?.id, customer: obj?.customer, eventCreated: event.created });

  switch (event.type) {
    case 'checkout.session.completed': {
      const customerId = obj.customer;
      const email = obj.customer_email || obj.customer_details?.email;

      // metadata.user_id lo imposta create-checkout ricavandolo dal JWT verificato:
      // e' l'unico identificatore affidabile che arriva fin qui. Prima veniva
      // ignorato e l'account si risolveva da customer_email, che invece parte dal
      // client — quindi un acquisto poteva essere accreditato all'account
      // sbagliato, per un errore di battitura o di proposito.
      // Il fallback su resolveUserId resta per le sessioni create prima che il
      // metadata esistesse.
      const trustedUserId = typeof obj.metadata?.user_id === 'string' && obj.metadata.user_id
        ? obj.metadata.user_id
        : null;
      let userId: string | null = trustedUserId;
      if (userId) {
        await collegaCustomerAUtente(userId, customerId);
      } else {
        await log('metadata.user_id assente: si ricade sulla risoluzione via email', { sessionId: obj.id, customer: customerId });
        userId = await resolveUserId(customerId, email);
      }

      if (userId) {
        const plan = obj.metadata?.plan || (obj.mode === 'payment' ? 'for_life' : 'monthly');
        if (obj.mode === 'payment') {
          // Ri-verifica su Stripe che la sessione sia davvero pagata prima di attivare for_life.
          const session = await getCheckoutSession(obj.id);
          if (session && session.payment_status === 'paid') {
            await updateUserPlan(userId, 'for_life', null, null);
          } else {
            await log('for_life NON attivato: pagamento non confermato da Stripe', { sessionId: obj.id, payment_status: session?.payment_status ?? 'non recuperabile' });
          }
        } else if (obj.subscription) {
          const authState = await getAuthoritativeSubscriptionState(obj.subscription);
          if (authState) {
            const newPlan = (authState.status === 'active' || authState.status === 'trialing') ? 'pro' : 'free';
            const validUntil = authState.current_period_end ? new Date(authState.current_period_end * 1000).toISOString() : null;
            await updateUserPlan(userId, newPlan, authState.id, validUntil);
          }
        }
        // Invia email di conferma acquisto
        if (email) {
          await sendEmail(
            email,
            `✅ Acquisto confermato — SnakeKeeper ${planLabel(plan)}`,
            purchaseEmailHtml(plan, email)
          );
        }
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const authState = await getAuthoritativeSubscriptionState(obj.id);
      const userId = await resolveUserId(obj.customer, null);
      if (userId && authState) {
        const plan = (authState.status === 'active' || authState.status === 'trialing') ? 'pro' : 'free';
        const validUntil = authState.current_period_end ? new Date(authState.current_period_end * 1000).toISOString() : null;
        await updateUserPlan(userId, plan, plan === 'free' ? null : authState.id, validUntil);
      } else if (userId && !authState) {
        await updateUserPlan(userId, 'free', null, null);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const userId = await resolveUserId(obj.customer, null);
      if (userId) await updateUserPlan(userId, 'free', null, null);
      break;
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' }, status: 200 });
});
