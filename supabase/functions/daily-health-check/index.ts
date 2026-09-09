import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const ALERT_EMAIL = 'manuel.satta05@gmail.com';

// Sopra questa soglia, i tentativi respinti smettono di essere rumore di fondo e
// diventano un segnale: qualcuno sta sondando gli endpoint in modo sistematico.
// Sotto, sono la normale vita di un sito esposto su internet.
const SOGLIA_EVENTI_SICUREZZA = 20;

const SB_HEADERS = {
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json'
};

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendEmail(subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'SnakeKeeper Monitor <noreply@snakekeeper.it>', to: [ALERT_EMAIL], subject, html }),
  });
}

// Una richiesta respinta NON e' un errore: e' la sicurezza che funziona. Metterla
// nella stessa lista delle eccezioni vere porta ad aprire ogni mattina un'email
// con l'allarme rosso finche' non la si smette di leggere del tutto — e sara'
// proprio quella volta che dentro c'e' qualcosa di serio.
function eDiSicurezza(msg: string): boolean {
  return /rifiutat|non autorizzat/i.test(msg || '');
}

Deno.serve(async (req: Request) => {
  // Il segreto si accetta SOLO dall'header. Prima era ammesso anche ?secret=...
  // in query string, che finisce nei log del server e nella cronologia. Il cron
  // in cron.job usa gia' l'header, quindi non cambia nulla per lui.
  const providedSecret = req.headers.get('x-cron-secret') ?? '';
  if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: 'Non autorizzato' }), { status: 401 });
  }

  // problemi = richiedono attenzione. sicurezza = informativi, salvo soglia.
  const problemi: string[] = [];
  const sicurezza: string[] = [];
  const infoLines: string[] = [];
  let numProblemi = 0; // conteggio reale, non il numero di righe dell'email

  // 1. Il sito e' raggiungibile?
  try {
    const siteRes = await fetch('https://snakekeeper.it/', { method: 'GET' });
    if (!siteRes.ok) {
      problemi.push(`🔴 Il sito risponde con stato ${siteRes.status} invece di 200`);
      numProblemi++;
    }
  } catch(e) {
    problemi.push(`🔴 Il sito non e' raggiungibile: ${esc(e.message)}`);
    numProblemi++;
  }

  // 2. Eventi delle ultime 24 ore, separati in errori veri ed eventi di sicurezza
  try {
    const since = new Date(Date.now() - 24*3600*1000).toISOString();
    const errRes = await fetch(
      `${SUPABASE_URL}/rest/v1/debug_log?created_at=gte.${since}&or=(message.ilike.*eccezione*,message.ilike.*rifiutata*,message.ilike.*errore*,message.ilike.*fallit*,message.ilike.*non+autorizzat*)&select=source,message,created_at&order=created_at.desc&limit=500`,
      { headers: SB_HEADERS }
    );
    const righe = await errRes.json();
    const tutte: any[] = Array.isArray(righe) ? righe : [];

    const eventiSicurezza = tutte.filter((r) => eDiSicurezza(r.message));
    const erroriVeri = tutte.filter((r) => !eDiSicurezza(r.message));

    // ── Errori veri: sempre un problema ──
    if (erroriVeri.length > 0) {
      numProblemi++;
      problemi.push(`🟡 ${erroriVeri.length} error${erroriVeri.length === 1 ? 'e' : 'i'} nelle ultime 24h${erroriVeri.length > 5 ? ' (mostro i primi 5)' : ''}:`);
      erroriVeri.slice(0, 5).forEach((e: any) => {
        problemi.push(`&nbsp;&nbsp;&bull; [${esc(e.source)}] ${esc(e.message)}`);
      });
    }

    // ── Eventi di sicurezza: informativi sotto soglia, allarme sopra ──
    if (eventiSicurezza.length > 0) {
      // Raggruppati per tipo: cinque righe identiche non dicono nulla di piu'
      // di "cinque volte la stessa cosa", ma occupano cinque righe.
      const conteggi = new Map<string, number>();
      for (const e of eventiSicurezza) {
        const k = `[${e.source}] ${e.message}`;
        conteggi.set(k, (conteggi.get(k) || 0) + 1);
      }
      const righeRaggruppate = [...conteggi.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, n]) => `&nbsp;&nbsp;&bull; ${esc(k)} — ${n}×`);

      if (eventiSicurezza.length > SOGLIA_EVENTI_SICUREZZA) {
        numProblemi++;
        problemi.push(`🔴 ${eventiSicurezza.length} richieste respinte nelle ultime 24h (soglia: ${SOGLIA_EVENTI_SICUREZZA}) — possibile sondaggio sistematico degli endpoint:`);
        problemi.push(...righeRaggruppate);
      } else {
        sicurezza.push(`🛡️ ${eventiSicurezza.length} richiest${eventiSicurezza.length === 1 ? 'a respinta' : 'e respinte'} nelle ultime 24h — normale, è la protezione che funziona:`);
        sicurezza.push(...righeRaggruppate);
      }
    }
  } catch(e) {
    problemi.push(`⚠️ Impossibile controllare debug_log: ${esc(e.message)}`);
    numProblemi++;
  }

  // 3. Rimborsi Stripe falliti nelle ultime 24 ore
  try {
    const since = new Date(Date.now() - 24*3600*1000).toISOString();
    const refRes = await fetch(
      `${SUPABASE_URL}/rest/v1/debug_log?source=eq.cancel-subscription&message=eq.Risultato+refund&created_at=gte.${since}&select=data,created_at`,
      { headers: SB_HEADERS }
    );
    const refs = await refRes.json();
    const failed = Array.isArray(refs) ? refs.filter((r: any) => r.data && r.data.error) : [];
    if (failed.length > 0) {
      problemi.push(`🔴 ${failed.length} rimborso/i Stripe fallito/i nelle ultime 24h — controlla manualmente`);
      numProblemi++;
    }
  } catch(e) {}

  // 4. Statistiche generali (informative, non allarmi)
  try {
    const since = new Date(Date.now() - 24*3600*1000).toISOString();
    const [usersRes, snakesRes, salesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/user_plans?created_at=gte.${since}&select=user_id`, { headers: { ...SB_HEADERS, Prefer: 'count=exact' } }),
      fetch(`${SUPABASE_URL}/rest/v1/serpenti?created_at=gte.${since}&select=id`, { headers: { ...SB_HEADERS, Prefer: 'count=exact' } }),
      fetch(`${SUPABASE_URL}/rest/v1/venduti?created_at=gte.${since}&select=id`, { headers: { ...SB_HEADERS, Prefer: 'count=exact' } }),
    ]);
    const newUsers = usersRes.headers.get('content-range')?.split('/')[1] || '0';
    const newSnakes = snakesRes.headers.get('content-range')?.split('/')[1] || '0';
    const newSales = salesRes.headers.get('content-range')?.split('/')[1] || '0';
    infoLines.push(`👤 Nuovi utenti: ${newUsers} · 🐍 Nuovi serpenti: ${newSnakes} · 💰 Nuove vendite: ${newSales}`);
  } catch(e) {}

  const hasIssues = numProblemi > 0;
  const subject = hasIssues
    ? `⚠️ SnakeKeeper: ${numProblemi} problem${numProblemi === 1 ? 'a' : 'i'} da rivedere`
    : `✅ SnakeKeeper: tutto regolare`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:${hasIssues ? '#c0392b' : '#2d7a2d'}">${hasIssues ? '⚠️ Report giornaliero — attenzione richiesta' : '✅ Report giornaliero — tutto regolare'}</h2>
      <p style="color:#666;font-size:13px">Controllo automatico delle ultime 24 ore — ${new Date().toLocaleString('it-IT')}</p>
      ${hasIssues
        ? `<div style="background:#fdecea;border-left:4px solid #c0392b;padding:12px 16px;margin:16px 0">${problemi.join('<br>')}</div>`
        : `<div style="background:#eafaf1;border-left:4px solid #2d7a2d;padding:12px 16px;margin:16px 0">Nessun errore, sito raggiungibile, nessun rimborso fallito.</div>`}
      ${sicurezza.length
        ? `<div style="background:#eef4fb;border-left:4px solid #4a7ab8;padding:12px 16px;margin:16px 0;font-size:13px;color:#334">${sicurezza.join('<br>')}</div>`
        : ''}
      ${infoLines.length ? `<p style="font-size:13px;color:#444">${infoLines.join('<br>')}</p>` : ''}
      <p style="font-size:11px;color:#999;margin-top:24px">Email automatica — SnakeKeeper Monitor</p>
    </div>`;

  await sendEmail(subject, html);

  return new Response(JSON.stringify({
    ok: true,
    hasIssues,
    problemi: numProblemi,
    eventiSicurezza: sicurezza.length > 0 || problemi.some((p) => p.includes('richieste respinte')),
  }), { headers: { 'Content-Type': 'application/json' } });
});
