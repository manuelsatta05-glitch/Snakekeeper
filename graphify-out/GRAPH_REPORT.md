# Graph Report - Snakekeeper-repo  (2026-08-14)

## Corpus Check
- 27 files · ~55,634 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 141 nodes · 162 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.86)
- Token cost: 0 input · 195,647 output

## Community Hubs (Navigation)
- Contenuti SEO & Registri Base
- Piani & Limiti Free
- Graphify: Ingest & Estrazione
- Graphify: Export & Pipeline
- Graphify: Comando & Estrazione Semantica
- Manifest PWA
- Graphify: Query & MCP
- Trial Fiera & Pannello Admin
- Gestione Serpenti & Export PDF
- Graphify: Aggiornamento Incrementale
- Graphify: Clone & Merge Repo
- Dashboard Monitoraggio Uso
- Sync Offline
- Service Worker

## God Nodes (most connected - your core abstractions)
1. `SnakeKeeper Web App` - 19 edges
2. `Plan & Billing System` - 10 edges
3. `Extra Exports & Benchmark Reference` - 7 edges
4. `Query, Path, Explain Reference` - 7 edges
5. `Incremental Update & Cluster-Only Reference` - 6 edges
6. `SnakeKeeper graphify Project Rules` - 5 edges
7. `Extraction Subagent Prompt Spec` - 5 edges
8. `Snake Management Feature` - 5 edges
9. `Step 3: Extract Entities and Relationships` - 4 edges
10. `Part A: Structural (AST) Extraction` - 4 edges

## Surprising Connections (you probably didn't know these)
- `graphify claude install` --references--> `SnakeKeeper graphify Project Rules`  [INFERRED]
  .claude/skills/graphify/references/hooks.md → CLAUDE.md
- `Codice Promozionale Fiera` --semantically_similar_to--> `Fiera Event Admin Feature`  [INFERRED] [semantically similar]
  fiera.html → index.html
- `Registro Mute (Molt Log)` --semantically_similar_to--> `Molt Log Feature`  [INFERRED] [semantically similar]
  guide/muta-serpenti.html → index.html
- `Registro Pasti (Feeding Log)` --semantically_similar_to--> `Feeding Log Feature`  [INFERRED] [semantically similar]
  guide/pasti-serpenti.html → index.html
- `Private Usage Monitor Dashboard` --semantically_similar_to--> `Usage Monitor Dashboard`  [INFERRED] [semantically similar]
  private-monitor-9x7k2.html → monitor.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **graphify Build Pipeline (Steps 1-9)** — _claude_skills_graphify_skill_step1_interpreter_detection, _claude_skills_graphify_skill_step2_detect_files, _claude_skills_graphify_skill_step3_extraction, _claude_skills_graphify_skill_step4_build_graph, _claude_skills_graphify_skill_step4_5_health_check, _claude_skills_graphify_skill_step5_label_communities, _claude_skills_graphify_skill_step6_exports, _claude_skills_graphify_skill_step9_manifest_cost [EXTRACTED 1.00]
- **Step 3 AST + Semantic Extraction Merge** — _claude_skills_graphify_skill_step3_extraction, _claude_skills_graphify_skill_ast_extraction, _claude_skills_graphify_skill_semantic_extraction, _claude_skills_graphify_skill_extraction_cache [EXTRACTED 1.00]
- **showPage() Page Router Dispatch Table** — index_showpage, index_renderdashboard, index_renderserpenti, index_renderaggiungi, index_renderdettaglio, index_renderregistro, index_rendervenduti, index_renderadmin, index_renderprofilo [EXTRACTED 1.00]

## Communities (14 total, 2 thin omitted)

### Community 0 - "Contenuti SEO & Registri Base"
Cohesion: 0.11
Nodes (16): Guida alla muta (ecdisi) nei serpenti, Registro Mute (Molt Log), Come tracciare i pasti del serpente, Registro Pasti (Feeding Log), Come organizzare un registro di allevamento serpenti, Quaderno vs Excel vs App Comparison, Auth System, Dashboard Feature (+8 more)

### Community 1 - "Piani & Limiti Free"
Cohesion: 0.12
Nodes (10): applySnakeLockUI(), canAddSnake(), canEditSnake(), FREE_SNAKE_LIMIT (3 snakes), isPro(), loadUserPlan(), Plan & Billing System, Plan Tiers (free/pro/admin/free_forever/for_life) (+2 more)

### Community 2 - "Graphify: Ingest & Estrazione"
Cohesion: 0.13
Nodes (15): Add URL & Watch Folder Reference, /graphify add, graphify.watch Module, --watch Flag, Confidence Score Rubric, Extraction Subagent Prompt Spec, Hyperedge Extraction Rule, Node ID Format Rule (+7 more)

### Community 3 - "Graphify: Export & Pipeline"
Cohesion: 0.16
Nodes (14): Extra Exports & Benchmark Reference, FalkorDB Export, Neo4j Export, SVG/GraphML Export, Token Reduction Benchmark, Wiki Export (--wiki), Honesty Rules, PowerShell Scrolling Troubleshooting (+6 more)

### Community 4 - "Graphify: Comando & Estrazione Semantica"
Cohesion: 0.18
Nodes (12): graphify Skill Directive, Video/Audio Transcription Reference, graphify.transcribe.transcribe_all(), Whisper Domain-Hint Prompt Strategy, Semantic Extraction Cache, Gemini Semantic Extraction Backend, /graphify Command, Part B: Semantic Extraction (Subagents) (+4 more)

### Community 5 - "Manifest PWA"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 6 - "Graphify: Query & MCP"
Cohesion: 0.29
Nodes (10): MCP Server (graphify.serve), BFS/DFS Traversal Modes, /graphify explain, /graphify path, Query, Path, Explain Reference, Constrained Query Expansion, graphify reflect / LESSONS.md, save-result Work Memory Loop (+2 more)

### Community 7 - "Trial Fiera & Pannello Admin"
Cohesion: 0.27
Nodes (9): check_fiera_code RPC, Codice Promozionale Fiera, Offerta Fiera Registration Page, Supabase Auth Signup, Admin Panel Feature, createFieraEvent(), Fiera Event Admin Feature, isAdmin() (+1 more)

### Community 8 - "Gestione Serpenti & Export PDF"
Cohesion: 0.22
Nodes (5): Weight Growth Chart Feature, Genealogy Tracking Feature, PDF/Print Export Feature, renderDettaglio(), Snake Management Feature

### Community 9 - "Graphify: Aggiornamento Incrementale"
Cohesion: 0.47
Nodes (6): build_merge(), graphify cluster-only Command, detect_incremental(), prune_sources Deletion-Only Rule, Incremental Update & Cluster-Only Reference, --update / --cluster-only Subcommands

### Community 10 - "Graphify: Clone & Merge Repo"
Cohesion: 0.60
Nodes (5): GitHub Clone & Cross-Repo Merge Reference, graphify clone Command, graphify merge-graphs Command, Multi-Subfolder / Monorepo Extraction, Step 0: GitHub Clone & Merge

### Community 11 - "Dashboard Monitoraggio Uso"
Cohesion: 1.00
Nodes (3): Usage Monitor Dashboard, usage-monitor Edge Function, Private Usage Monitor Dashboard

## Knowledge Gaps
- **32 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SnakeKeeper Web App` connect `Contenuti SEO & Registri Base` to `Gestione Serpenti & Export PDF`, `Piani & Limiti Free`, `Trial Fiera & Pannello Admin`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `Plan & Billing System` connect `Piani & Limiti Free` to `Contenuti SEO & Registri Base`, `Trial Fiera & Pannello Admin`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `Step 3: Extract Entities and Relationships` connect `Graphify: Comando & Estrazione Semantica` to `Graphify: Ingest & Estrazione`, `Graphify: Export & Pipeline`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Contenuti SEO & Registri Base` be split into smaller, more focused modules?**
  _Cohesion score 0.1067193675889328 - nodes in this community are weakly interconnected._
- **Should `Piani & Limiti Free` be split into smaller, more focused modules?**
  _Cohesion score 0.12418300653594772 - nodes in this community are weakly interconnected._
- **Should `Graphify: Ingest & Estrazione` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._