# Graph Report - Snakekeeper-repo  (2026-08-29)

## Corpus Check
- 17 files · ~69,964 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 387 nodes · 832 edges · 23 communities (21 shown, 2 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.66)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `49e68164`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SnakeKeeper Web App
- Piani & Limiti Free
- Extraction Subagent Prompt Spec
- Extra Exports & Benchmark Reference
- t
- Manifest PWA
- toast
- app.js
- closeModalEl
- Pagine Legali (Privacy/Termini)
- GitHub Clone & Cross-Repo Merge Reference
- Dashboard Monitoraggio Uso
- Sync Offline (Feature)
- Service Worker
- Autenticazione & Sessione
- loadAll
- Landing Page & Animazioni
- showPage
- index.ts
- Drawer Mobile
- landingLogin
- Fisica Touch (Rubberband)
- Edge Functions

## God Nodes (most connected - your core abstractions)
1. `toast()` - 48 edges
2. `t()` - 37 edges
3. `esc()` - 29 edges
4. `showPage()` - 26 edges
5. `renderDettaglio()` - 22 edges
6. `SnakeKeeper Web App` - 19 edges
7. `closeModalEl()` - 17 edges
8. `renderVenduti()` - 17 edges
9. `openModalEl()` - 14 edges
10. `requireEditable()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Registro Mute (Molt Log)` --semantically_similar_to--> `Molt Log Feature`  [INFERRED] [semantically similar]
  guide/muta-serpenti.html → index.html
- `Registro Pasti (Feeding Log)` --semantically_similar_to--> `Feeding Log Feature`  [INFERRED] [semantically similar]
  guide/pasti-serpenti.html → index.html
- `Codice Promozionale Fiera` --semantically_similar_to--> `Fiera Event Admin Feature`  [INFERRED] [semantically similar]
  fiera.html → index.html
- `Private Usage Monitor Dashboard` --semantically_similar_to--> `Usage Monitor Dashboard`  [INFERRED] [semantically similar]
  private-monitor-9x7k2.html → monitor.html
- `graphify claude install` --references--> `SnakeKeeper graphify Project Rules`  [INFERRED]
  .claude/skills/graphify/references/hooks.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Step 3 AST + Semantic Extraction Merge** — _claude_skills_graphify_skill_step3_extraction, _claude_skills_graphify_skill_ast_extraction, _claude_skills_graphify_skill_semantic_extraction, _claude_skills_graphify_skill_extraction_cache [EXTRACTED 1.00]
- **graphify Build Pipeline (Steps 1-9)** — _claude_skills_graphify_skill_step1_interpreter_detection, _claude_skills_graphify_skill_step2_detect_files, _claude_skills_graphify_skill_step3_extraction, _claude_skills_graphify_skill_step4_build_graph, _claude_skills_graphify_skill_step4_5_health_check, _claude_skills_graphify_skill_step5_label_communities, _claude_skills_graphify_skill_step6_exports, _claude_skills_graphify_skill_step9_manifest_cost [EXTRACTED 1.00]
- **showPage() Page Router Dispatch Table** — index_showpage, index_renderdashboard, index_renderserpenti, index_renderaggiungi, index_renderdettaglio, index_renderregistro, index_rendervenduti, index_renderadmin, index_renderprofilo [EXTRACTED 1.00]

## Communities (23 total, 2 thin omitted)

### Community 0 - "SnakeKeeper Web App"
Cohesion: 0.07
Nodes (21): Guida alla muta (ecdisi) nei serpenti, Registro Mute (Molt Log), Come tracciare i pasti del serpente, Registro Pasti (Feeding Log), Come organizzare un registro di allevamento serpenti, Quaderno vs Excel vs App Comparison, Auth System, Weight Growth Chart Feature (+13 more)

### Community 1 - "Piani & Limiti Free"
Cohesion: 0.08
Nodes (19): check_fiera_code RPC, Codice Promozionale Fiera, Offerta Fiera Registration Page, Supabase Auth Signup, Admin Panel Feature, applySnakeLockUI(), canAddSnake(), canEditSnake() (+11 more)

### Community 2 - "Extraction Subagent Prompt Spec"
Cohesion: 0.08
Nodes (27): graphify Skill Directive, Add URL & Watch Folder Reference, /graphify add, graphify.watch Module, --watch Flag, Confidence Score Rubric, Extraction Subagent Prompt Spec, Hyperedge Extraction Rule (+19 more)

### Community 3 - "Extra Exports & Benchmark Reference"
Cohesion: 0.09
Nodes (30): Extra Exports & Benchmark Reference, FalkorDB Export, MCP Server (graphify.serve), Neo4j Export, SVG/GraphML Export, Token Reduction Benchmark, Wiki Export (--wiki), BFS/DFS Traversal Modes (+22 more)

### Community 4 - "t"
Cohesion: 0.11
Nodes (44): addLogToCaches(), age(), applySnakeLockUI(), canAddSnake(), canEditSnake(), deleteLogEntry(), esc(), fmtDate() (+36 more)

### Community 5 - "Manifest PWA"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 6 - "toast"
Cohesion: 0.09
Nodes (42): adminAddUser(), applyAppLang(), applyPlanUI(), centerOnSquareCanvas(), changeAppLang(), changePlan(), checkTrialCountdown(), clearSession() (+34 more)

### Community 7 - "app.js"
Cohesion: 0.05
Nodes (26): _annullaInFlight, _fieraEventiCache, I18N, _lastLogsPerSnake, loadAdminFiera(), LOG_FIELDS, _logsCache, MESI_ABBR (+18 more)

### Community 8 - "closeModalEl"
Cohesion: 0.15
Nodes (20): closeModalEl(), editFieraEvent(), editLogEntry(), _isNewerLog(), openModalEl(), _refreshLastLogsForSnake(), removeLogFromCaches(), resendVerificationEmail() (+12 more)

### Community 9 - "Pagine Legali (Privacy/Termini)"
Cohesion: 0.43
Nodes (8): getLegalStyles(), getPrivacyContent(), getPrivacyContentEN(), getTermsContent(), getTermsContentEN(), renderPrivacy(), renderTerms(), showLegalPage()

### Community 10 - "GitHub Clone & Cross-Repo Merge Reference"
Cohesion: 0.60
Nodes (5): GitHub Clone & Cross-Repo Merge Reference, graphify clone Command, graphify merge-graphs Command, Multi-Subfolder / Monorepo Extraction, Step 0: GitHub Clone & Merge

### Community 11 - "Dashboard Monitoraggio Uso"
Cohesion: 1.00
Nodes (3): Usage Monitor Dashboard, usage-monitor Edge Function, Private Usage Monitor Dashboard

### Community 14 - "Autenticazione & Sessione"
Cohesion: 0.20
Nodes (12): applyCookiePrefs(), authReq(), cookieChoice(), doForgotPassword(), doLogin(), doRegister(), getSupabaseToken(), hideLoginScreen() (+4 more)

### Community 15 - "loadAll"
Cohesion: 0.24
Nodes (10): addToOfflineQueue(), getOfflineQueue(), loadAll(), replayOfflineQueue(), retryLoadAll(), saveOfflineQueue(), setOnline(), syncPendingOfflineData() (+2 more)

### Community 16 - "Landing Page & Animazioni"
Cohesion: 0.25
Nodes (8): closeMobileNav(), initLanding(), initLandingNav(), initParticles(), initScrollReveal(), mobileNavGo(), showLanding(), smoothScrollTo()

### Community 17 - "showPage"
Cohesion: 0.13
Nodes (25): accettaTrasferimento(), addLogsToCaches(), annullaVendita(), applyTrasferimentiUI(), bindTrasferimentiActions(), bindVendutiActions(), checkHash(), confermaVendita() (+17 more)

### Community 18 - "index.ts"
Cohesion: 0.22
Nodes (11): buildPayload(), checkRateLimit(), CORS, emailHtml(), esc(), getAuthenticatedUser(), json(), SB_HEADERS (+3 more)

### Community 19 - "Drawer Mobile"
Cohesion: 0.40
Nodes (5): closeDrawer(), onUp(), openDrawer(), refreshDrawerSnakes(), settle()

### Community 20 - "landingLogin"
Cohesion: 0.47
Nodes (6): doLogout(), hideLanding(), landingLogin(), landingRegister(), showLoginScreen(), switchAuthTab()

### Community 21 - "Fisica Touch (Rubberband)"
Cohesion: 0.50
Nodes (4): applyTranslate(), clampWithRubberband(), onMove(), rubberband()

### Community 23 - "Edge Functions"
Cohesion: 0.33
Nodes (5): Attenzione: il deploy non è automatico, Edge Functions, Funzioni presenti qui, Segreti, verify_jwt

## Knowledge Gaps
- **57 isolated node(s):** `STRIPE_PRICES`, `SB`, `_snakes`, `_recentLogs`, `_logsCache` (+52 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SnakeKeeper Web App` connect `SnakeKeeper Web App` to `Piani & Limiti Free`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `Plan & Billing System` connect `Piani & Limiti Free` to `SnakeKeeper Web App`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Step 3: Extract Entities and Relationships` connect `Extraction Subagent Prompt Spec` to `Extra Exports & Benchmark Reference`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `showPage()` (e.g. with `renderAdmin()` and `renderDettaglio()`) actually correct?**
  _`showPage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `STRIPE_PRICES`, `SB`, `_snakes` to the rest of the system?**
  _57 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SnakeKeeper Web App` be split into smaller, more focused modules?**
  _Cohesion score 0.07459677419354839 - nodes in this community are weakly interconnected._
- **Should `Piani & Limiti Free` be split into smaller, more focused modules?**
  _Cohesion score 0.08465608465608465 - nodes in this community are weakly interconnected._