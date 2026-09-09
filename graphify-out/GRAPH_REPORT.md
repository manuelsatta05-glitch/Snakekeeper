# Graph Report - Snakekeeper-repo  (2026-09-09)

## Corpus Check
- 24 files · ~214,422 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 474 nodes · 942 edges · 46 communities (39 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `969c895e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- SnakeKeeper Web App
- Plan & Billing System
- Video/Audio Transcription Reference
- Query, Path, Explain Reference
- t
- Manifest PWA
- toast
- app.js
- stripe-webhook/index.ts
- Pagine Legali (Privacy/Termini)
- GitHub Clone & Cross-Repo Merge Reference
- Usage Monitor Dashboard
- Sync Offline (Feature)
- Service Worker
- doLogin
- loadAll
- initLanding
- cancel-subscription/index.ts
- transfer-snake/index.ts
- Drawer Mobile
- landingLogin
- Fisica Touch (Rubberband)
- usage-monitor/index.ts
- Edge Functions
- delete-account/index.ts
- Snake Management Feature
- getSupabaseToken
- check_fiera_code RPC
- Admin Panel Feature
- loadUserPlan
- Auth System
- Dashboard Feature
- renderDettaglio
- closeModalEl
- create-checkout/index.ts
- verify-checkout/index.ts
- Step 3: Extract Entities and Relationships
- saveSerpente
- Extraction Subagent Prompt Spec
- _refreshLastLogsForSnake
- Add URL & Watch Folder Reference
- Extra Exports & Benchmark Reference
- Part A: Structural (AST) Extraction
- Incremental Update & Cluster-Only Reference
- previewFoto
- daily-health-check/index.ts

## God Nodes (most connected - your core abstractions)
1. `toast()` - 48 edges
2. `t()` - 38 edges
3. `esc()` - 32 edges
4. `showPage()` - 26 edges
5. `renderDettaglio()` - 22 edges
6. `SnakeKeeper Web App` - 19 edges
7. `closeModalEl()` - 17 edges
8. `renderVenduti()` - 17 edges
9. `requireEditable()` - 14 edges
10. `openModalEl()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Registro Mute (Molt Log)` --semantically_similar_to--> `Molt Log Feature`  [INFERRED] [semantically similar]
  guide/muta-serpenti.html → index.html
- `Registro Pasti (Feeding Log)` --semantically_similar_to--> `Feeding Log Feature`  [INFERRED] [semantically similar]
  guide/pasti-serpenti.html → index.html
- `Codice Promozionale Fiera` --semantically_similar_to--> `Fiera Event Admin Feature`  [INFERRED] [semantically similar]
  fiera.html → index.html
- `graphify claude install` --references--> `SnakeKeeper graphify Project Rules`  [INFERRED]
  .claude/skills/graphify/references/hooks.md → CLAUDE.md
- `SnakeKeeper Overview (llms.txt)` --references--> `SnakeKeeper Web App`  [EXTRACTED]
  llms.txt → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Step 3 AST + Semantic Extraction Merge** — _claude_skills_graphify_skill_step3_extraction, _claude_skills_graphify_skill_ast_extraction, _claude_skills_graphify_skill_semantic_extraction, _claude_skills_graphify_skill_extraction_cache [EXTRACTED 1.00]
- **graphify Build Pipeline (Steps 1-9)** — _claude_skills_graphify_skill_step1_interpreter_detection, _claude_skills_graphify_skill_step2_detect_files, _claude_skills_graphify_skill_step3_extraction, _claude_skills_graphify_skill_step4_build_graph, _claude_skills_graphify_skill_step4_5_health_check, _claude_skills_graphify_skill_step5_label_communities, _claude_skills_graphify_skill_step6_exports, _claude_skills_graphify_skill_step9_manifest_cost [EXTRACTED 1.00]
- **showPage() Page Router Dispatch Table** — index_showpage, index_renderdashboard, index_renderserpenti, index_renderaggiungi, index_renderdettaglio, index_renderregistro, index_rendervenduti, index_renderadmin, index_renderprofilo [EXTRACTED 1.00]

## Communities (46 total, 7 thin omitted)

### Community 0 - "SnakeKeeper Web App"
Cohesion: 0.15
Nodes (14): Guida alla muta (ecdisi) nei serpenti, Registro Mute (Molt Log), Come tracciare i pasti del serpente, Registro Pasti (Feeding Log), Come organizzare un registro di allevamento serpenti, Quaderno vs Excel vs App Comparison, Egg-Laying Log Feature, Feces/Cleaning Log Feature (+6 more)

### Community 1 - "Plan & Billing System"
Cohesion: 0.16
Nodes (9): applySnakeLockUI(), canAddSnake(), canEditSnake(), FREE_SNAKE_LIMIT (3 snakes), isPro(), Plan & Billing System, Plan Tiers (free/pro/admin/free_forever/for_life), requireEditable() (+1 more)

### Community 2 - "Video/Audio Transcription Reference"
Cohesion: 0.29
Nodes (8): graphify Skill Directive, Video/Audio Transcription Reference, graphify.transcribe.transcribe_all(), Whisper Domain-Hint Prompt Strategy, /graphify Command, Step 1: Ensure graphify Installed, Step 2.5: Video/Audio Transcription, Step 2: Detect Files

### Community 3 - "Query, Path, Explain Reference"
Cohesion: 0.29
Nodes (10): MCP Server (graphify.serve), BFS/DFS Traversal Modes, /graphify explain, /graphify path, Query, Path, Explain Reference, Constrained Query Expansion, graphify reflect / LESSONS.md, save-result Work Memory Loop (+2 more)

### Community 4 - "t"
Cohesion: 0.14
Nodes (40): accettaTrasferimento(), annullaVendita(), applyTrasferimentiUI(), bindTrasferimentiActions(), bindVendutiActions(), checkHash(), confermaInvioCliente(), deleteVenduto() (+32 more)

### Community 5 - "Manifest PWA"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 6 - "toast"
Cohesion: 0.09
Nodes (41): adminAddUser(), applyAppLang(), applyPlanUI(), centerOnSquareCanvas(), changeAppLang(), changePlan(), checkTrialCountdown(), clearSession() (+33 more)

### Community 7 - "app.js"
Cohesion: 0.05
Nodes (26): _annullaInFlight, _fieraEventiCache, getFilteredVenduti(), getVendutiYears(), I18N, _lastLogsPerSnake, LOG_FIELDS, _logsCache (+18 more)

### Community 8 - "stripe-webhook/index.ts"
Cohesion: 0.19
Nodes (13): collegaCustomerAUtente(), getCurrentPlan(), getStripeCustomerEmail(), getUserIdByEmail(), log(), planLabel(), purchaseEmailHtml(), resolveUserId() (+5 more)

### Community 9 - "Pagine Legali (Privacy/Termini)"
Cohesion: 0.43
Nodes (8): getLegalStyles(), getPrivacyContent(), getPrivacyContentEN(), getTermsContent(), getTermsContentEN(), renderPrivacy(), renderTerms(), showLegalPage()

### Community 10 - "GitHub Clone & Cross-Repo Merge Reference"
Cohesion: 0.60
Nodes (5): GitHub Clone & Cross-Repo Merge Reference, graphify clone Command, graphify merge-graphs Command, Multi-Subfolder / Monorepo Extraction, Step 0: GitHub Clone & Merge

### Community 14 - "doLogin"
Cohesion: 0.19
Nodes (14): applyCookiePrefs(), authReq(), cookieChoice(), doForgotPassword(), doLogin(), doRegister(), emailGiaRegistrata(), getCaptchaToken() (+6 more)

### Community 15 - "loadAll"
Cohesion: 0.24
Nodes (10): addToOfflineQueue(), getOfflineQueue(), loadAll(), replayOfflineQueue(), retryLoadAll(), saveOfflineQueue(), setOnline(), syncPendingOfflineData() (+2 more)

### Community 16 - "initLanding"
Cohesion: 0.22
Nodes (9): closeMobileNav(), initFeatureShowcaseScroll(), initLanding(), initLandingNav(), initParticles(), initScrollReveal(), mobileNavGo(), showLanding() (+1 more)

### Community 17 - "cancel-subscription/index.ts"
Cohesion: 0.13
Nodes (5): ALLOWED_ORIGINS, log(), RateLimitResult, SB_HEADERS, sendEmail()

### Community 18 - "transfer-snake/index.ts"
Cohesion: 0.17
Nodes (9): ALLOWED_ORIGINS, buildPayload(), emailHtml(), esc(), RateLimitResult, SB_HEADERS, sendEmail(), short() (+1 more)

### Community 19 - "Drawer Mobile"
Cohesion: 0.40
Nodes (5): closeDrawer(), onUp(), openDrawer(), refreshDrawerSnakes(), settle()

### Community 20 - "landingLogin"
Cohesion: 0.47
Nodes (6): doLogout(), hideLanding(), landingLogin(), landingRegister(), showLoginScreen(), switchAuthTab()

### Community 21 - "Fisica Touch (Rubberband)"
Cohesion: 0.50
Nodes (4): applyTranslate(), clampWithRubberband(), onMove(), rubberband()

### Community 22 - "usage-monitor/index.ts"
Cohesion: 0.24
Nodes (6): ALLOWED_ORIGINS, fetchWithTimeout(), getResendUsage(), getStripeUsage(), getUptimeRobotUsage(), startOfMonthISO()

### Community 23 - "Edge Functions"
Cohesion: 0.33
Nodes (5): Attenzione: il deploy non è automatico, Edge Functions, Funzioni presenti qui, Segreti, verify_jwt

### Community 24 - "delete-account/index.ts"
Cohesion: 0.24
Nodes (6): ALLOWED_ORIGINS, checkRateLimit(), getAuthenticatedUser(), json(), RateLimitResult, SB_HEADERS

### Community 25 - "Snake Management Feature"
Cohesion: 0.22
Nodes (5): Weight Growth Chart Feature, Genealogy Tracking Feature, PDF/Print Export Feature, renderDettaglio(), Snake Management Feature

### Community 26 - "getSupabaseToken"
Cohesion: 0.67
Nodes (3): getSupabaseToken(), refreshAccessToken(), saveSession()

### Community 27 - "check_fiera_code RPC"
Cohesion: 0.53
Nodes (6): check_fiera_code RPC, Codice Promozionale Fiera, Offerta Fiera Registration Page, Supabase Auth Signup, createFieraEvent(), Fiera Event Admin Feature

### Community 28 - "Admin Panel Feature"
Cohesion: 0.50
Nodes (3): Admin Panel Feature, isAdmin(), renderAdmin()

### Community 32 - "renderDettaglio"
Cohesion: 0.28
Nodes (16): addLogToCaches(), applySnakeLockUI(), canEditSnake(), deleteLogEntry(), logFeci(), logFood(), logMuta(), logPeso() (+8 more)

### Community 33 - "closeModalEl"
Cohesion: 0.19
Nodes (15): age(), closeModalEl(), confermaVendita(), editLogEntry(), logsForSnake(), nomeGenitore(), openModalEl(), printSchedaSerpente() (+7 more)

### Community 34 - "create-checkout/index.ts"
Cohesion: 0.20
Nodes (4): ALLOWED_ORIGINS, PRICES, RateLimitResult, SB_HEADERS

### Community 35 - "verify-checkout/index.ts"
Cohesion: 0.22
Nodes (3): ALLOWED_ORIGINS, RateLimitResult, SB_HEADERS

### Community 36 - "Step 3: Extract Entities and Relationships"
Cohesion: 0.28
Nodes (9): Honesty Rules, PowerShell Scrolling Troubleshooting, graph.json Shrink Guard (#479), Step 3: Extract Entities and Relationships, Step 4.5: Graph Health Check, Step 4: Build Graph, Cluster, Analyze, Step 5: Label Communities, Step 6: Obsidian Vault + HTML Export (+1 more)

### Community 37 - "saveSerpente"
Cohesion: 0.25
Nodes (8): canAddSnake(), genICD(), genId(), isNameTaken(), isPro(), lockedSnakesCount(), readParentFields(), saveSerpente()

### Community 38 - "Extraction Subagent Prompt Spec"
Cohesion: 0.33
Nodes (7): Confidence Score Rubric, Extraction Subagent Prompt Spec, Hyperedge Extraction Rule, semantically_similar_to Edge Rule, Semantic Extraction Cache, Gemini Semantic Extraction Backend, Part B: Semantic Extraction (Subagents)

### Community 39 - "_refreshLastLogsForSnake"
Cohesion: 0.29
Nodes (7): addLogsToCaches(), _isNewerLog(), _lastLogKey(), _refreshLastLogsForSnake(), removeLogFromCaches(), ultimiLogInvio(), updateLogInCaches()

### Community 40 - "Add URL & Watch Folder Reference"
Cohesion: 0.33
Nodes (5): Add URL & Watch Folder Reference, /graphify add, graphify.watch Module, --watch Flag, /graphify add & --watch

### Community 41 - "Extra Exports & Benchmark Reference"
Cohesion: 0.33
Nodes (6): Extra Exports & Benchmark Reference, FalkorDB Export, Neo4j Export, SVG/GraphML Export, Token Reduction Benchmark, Wiki Export (--wiki)

### Community 42 - "Part A: Structural (AST) Extraction"
Cohesion: 0.33
Nodes (6): Node ID Format Rule, graphify claude install, Commit Hook & CLAUDE.md Integration Reference, graphify hook install, Part A: Structural (AST) Extraction, Commit Hook & CLAUDE.md Integration

### Community 43 - "Incremental Update & Cluster-Only Reference"
Cohesion: 0.47
Nodes (6): build_merge(), graphify cluster-only Command, detect_incremental(), prune_sources Deletion-Only Rule, Incremental Update & Cluster-Only Reference, --update / --cluster-only Subcommands

### Community 44 - "previewFoto"
Cohesion: 0.47
Nodes (6): compressImageToDataUrl(), previewFoto(), previewFotoAdd(), previewFotoInvio(), renderPosPicker(), setFotoPosition()

## Knowledge Gaps
- **76 isolated node(s):** `SB_HEADERS`, `RateLimitResult`, `RateLimitResult`, `RateLimitResult`, `RateLimitResult` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SnakeKeeper Web App` connect `SnakeKeeper Web App` to `Plan & Billing System`, `Snake Management Feature`, `Admin Panel Feature`, `Auth System`, `Dashboard Feature`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `Plan & Billing System` connect `Plan & Billing System` to `SnakeKeeper Web App`, `Admin Panel Feature`, `loadUserPlan`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `Step 3: Extract Entities and Relationships` connect `Step 3: Extract Entities and Relationships` to `Video/Audio Transcription Reference`, `Part A: Structural (AST) Extraction`, `Extraction Subagent Prompt Spec`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `showPage()` (e.g. with `renderAdmin()` and `renderAggiungi()`) actually correct?**
  _`showPage()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `SB_HEADERS`, `RateLimitResult`, `RateLimitResult` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `t` be split into smaller, more focused modules?**
  _Cohesion score 0.1371794871794872 - nodes in this community are weakly interconnected._
- **Should `toast` be split into smaller, more focused modules?**
  _Cohesion score 0.08780487804878048 - nodes in this community are weakly interconnected._