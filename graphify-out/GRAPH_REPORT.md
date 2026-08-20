# Graph Report - Snakekeeper-repo  (2026-08-21)

## Corpus Check
- 32 files · ~59,710 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 342 nodes · 698 edges · 24 communities (22 shown, 2 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d528fc54`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SnakeKeeper Web App
- Piani & Limiti Free
- Extraction Subagent Prompt Spec
- Query, Path, Explain Reference
- Gestione Serpenti & Registro
- Manifest PWA
- Admin, Abbonamento & Profilo
- Stato Globale & Utility UI
- Modali & Popup UI
- Pagine Legali (Privacy/Termini)
- GitHub Clone & Cross-Repo Merge Reference
- Dashboard Monitoraggio Uso
- Sync Offline (Feature)
- Service Worker
- Autenticazione & Sessione
- Sync Offline & Coda
- Landing Page & Animazioni
- Gestione Venduti
- Cache Ultimi Log
- Drawer Mobile
- Transizioni Login/Landing
- Fisica Touch (Rubberband)
- Posizionamento Foto
- Extra Exports & Benchmark Reference

## God Nodes (most connected - your core abstractions)
1. `toast()` - 39 edges
2. `t()` - 25 edges
3. `esc()` - 24 edges
4. `renderDettaglio()` - 22 edges
5. `showPage()` - 21 edges
6. `SnakeKeeper Web App` - 19 edges
7. `closeModalEl()` - 15 edges
8. `requireEditable()` - 14 edges
9. `renderVenduti()` - 13 edges
10. `openModalEl()` - 13 edges

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

## Communities (24 total, 2 thin omitted)

### Community 0 - "SnakeKeeper Web App"
Cohesion: 0.07
Nodes (21): Guida alla muta (ecdisi) nei serpenti, Registro Mute (Molt Log), Come tracciare i pasti del serpente, Registro Pasti (Feeding Log), Come organizzare un registro di allevamento serpenti, Quaderno vs Excel vs App Comparison, Auth System, Weight Growth Chart Feature (+13 more)

### Community 1 - "Piani & Limiti Free"
Cohesion: 0.08
Nodes (19): check_fiera_code RPC, Codice Promozionale Fiera, Offerta Fiera Registration Page, Supabase Auth Signup, Admin Panel Feature, applySnakeLockUI(), canAddSnake(), canEditSnake() (+11 more)

### Community 2 - "Extraction Subagent Prompt Spec"
Cohesion: 0.08
Nodes (27): graphify Skill Directive, Add URL & Watch Folder Reference, /graphify add, graphify.watch Module, --watch Flag, Confidence Score Rubric, Extraction Subagent Prompt Spec, Hyperedge Extraction Rule (+19 more)

### Community 3 - "Query, Path, Explain Reference"
Cohesion: 0.17
Nodes (16): MCP Server (graphify.serve), BFS/DFS Traversal Modes, /graphify explain, /graphify path, Query, Path, Explain Reference, Constrained Query Expansion, graphify reflect / LESSONS.md, save-result Work Memory Loop (+8 more)

### Community 4 - "Gestione Serpenti & Registro"
Cohesion: 0.10
Nodes (47): addLogToCaches(), age(), applySnakeLockUI(), canAddSnake(), canEditSnake(), checkHash(), confermaVendita(), deleteLogEntry() (+39 more)

### Community 5 - "Manifest PWA"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 6 - "Admin, Abbonamento & Profilo"
Cohesion: 0.10
Nodes (36): adminAddUser(), applyAppLang(), applyPlanUI(), centerOnSquareCanvas(), changeAppLang(), changePlan(), checkTrialCountdown(), clearSession() (+28 more)

### Community 7 - "Stato Globale & Utility UI"
Cohesion: 0.06
Nodes (20): _annullaInFlight, _fieraEventiCache, I18N, _lastLogsPerSnake, loadAdminFiera(), LOG_FIELDS, _logsCache, MESI_ABBR (+12 more)

### Community 8 - "Modali & Popup UI"
Cohesion: 0.26
Nodes (13): closeModalEl(), editFieraEvent(), editLogEntry(), openModalEl(), resendVerificationEmail(), showCancelSubscriptionModal(), showDeleteAccountModal(), showExpiredLinkModal() (+5 more)

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

### Community 15 - "Sync Offline & Coda"
Cohesion: 0.32
Nodes (8): addToOfflineQueue(), getOfflineQueue(), loadAll(), replayOfflineQueue(), saveOfflineQueue(), setOnline(), syncPendingOfflineData(), withTimeout()

### Community 16 - "Landing Page & Animazioni"
Cohesion: 0.25
Nodes (8): closeMobileNav(), initLanding(), initLandingNav(), initParticles(), initScrollReveal(), mobileNavGo(), showLanding(), smoothScrollTo()

### Community 17 - "Gestione Venduti"
Cohesion: 0.29
Nodes (7): deleteVenduto(), getFilteredVenduti(), getVendutiYears(), renderVenduti(), resetVendutiFiltri(), setVendutiMonth(), setVendutiYear()

### Community 18 - "Cache Ultimi Log"
Cohesion: 0.29
Nodes (7): addLogsToCaches(), annullaVendita(), _isNewerLog(), _lastLogKey(), _refreshLastLogsForSnake(), removeLogFromCaches(), updateLogInCaches()

### Community 19 - "Drawer Mobile"
Cohesion: 0.40
Nodes (5): closeDrawer(), onUp(), openDrawer(), refreshDrawerSnakes(), settle()

### Community 20 - "Transizioni Login/Landing"
Cohesion: 0.50
Nodes (5): doLogout(), hideLanding(), landingLogin(), landingRegister(), showLoginScreen()

### Community 21 - "Fisica Touch (Rubberband)"
Cohesion: 0.50
Nodes (4): applyTranslate(), clampWithRubberband(), onMove(), rubberband()

### Community 22 - "Posizionamento Foto"
Cohesion: 0.67
Nodes (4): previewFoto(), previewFotoAdd(), renderPosPicker(), setFotoPosition()

### Community 23 - "Extra Exports & Benchmark Reference"
Cohesion: 0.16
Nodes (14): Extra Exports & Benchmark Reference, FalkorDB Export, Neo4j Export, SVG/GraphML Export, Token Reduction Benchmark, Wiki Export (--wiki), Honesty Rules, PowerShell Scrolling Troubleshooting (+6 more)

## Knowledge Gaps
- **48 isolated node(s):** `STATIC_ASSETS`, `background_color`, `description`, `display`, `icons` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SnakeKeeper Web App` connect `SnakeKeeper Web App` to `Piani & Limiti Free`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `Plan & Billing System` connect `Piani & Limiti Free` to `SnakeKeeper Web App`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `Step 3: Extract Entities and Relationships` connect `Extraction Subagent Prompt Spec` to `Extra Exports & Benchmark Reference`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `showPage()` (e.g. with `renderAdmin()` and `renderAggiungi()`) actually correct?**
  _`showPage()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `STATIC_ASSETS`, `background_color`, `description` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SnakeKeeper Web App` be split into smaller, more focused modules?**
  _Cohesion score 0.07459677419354839 - nodes in this community are weakly interconnected._
- **Should `Piani & Limiti Free` be split into smaller, more focused modules?**
  _Cohesion score 0.08465608465608465 - nodes in this community are weakly interconnected._