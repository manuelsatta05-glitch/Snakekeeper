# Edge Functions

Sorgenti delle Supabase Edge Functions del progetto.

**Questa cartella non viene pubblicata sul sito.** Il workflow
`.github/workflows/deploy.yml` copia in `_site/` una lista esplicita di file: tutto
il resto del repo, questa cartella compresa, resta fuori da GitHub Pages.

## Attenzione: il deploy non è automatico

Un `git push` **non** aggiorna le Edge Functions. Modificare un file qui cambia solo
la copia versionata: la funzione che gira davvero va ri-pubblicata a mano dalla
dashboard Supabase (Edge Functions → la funzione → Deploy), incollando il contenuto
aggiornato.

Finché non lo si fa, il codice in questa cartella e quello in produzione divergono.

## verify_jwt

Le funzioni chiamate dal frontend hanno **`Verify JWT` disattivato** e verificano il
token da sole, risolvendolo contro `/auth/v1/user`. Non è una scorciatoia: la chiave
anon è a sua volta un JWT valido e firmato dal progetto, quindi il controllo
automatico da solo la lascerebbe passare. È il controllo manuale a distinguere un
utente vero da chiunque abbia copiato la chiave pubblica dal sorgente della pagina.

Se si ri-deploya una di queste funzioni, `Verify JWT` va lasciato **off**.

## Funzioni presenti qui

| Funzione | Cosa fa |
|---|---|
| `transfer-snake` | Crea l'invito a trasferire un serpente venduto all'account del cliente e manda l'email di notifica via Resend. Accettazione, rifiuto e ritiro passano invece dalle RPC Postgres `accetta_trasferimento` / `rifiuta_trasferimento` / `annulla_trasferimento`. |

Le altre funzioni attive sul progetto (`create-checkout`, `verify-checkout`,
`cancel-subscription`, `delete-account`, `stripe-webhook`, `daily-health-check`,
`usage-monitor`, …) esistono solo dentro Supabase e non sono ancora versionate qui.

## Segreti

Nessun segreto va scritto in questi file: si leggono a runtime con `Deno.env.get()`
e sono configurati fra i secrets del progetto Supabase
(`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`,
`STRIPE_SECRET_KEY`, `CRON_SECRET`, …). **Il repository è pubblico.**
