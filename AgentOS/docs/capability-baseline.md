# Antigravity Superengineering Operating System — Capability Baseline & Audit (Phase 0)

## Executive Summary
This document audits the baseline capabilities, architectural strengths, and critical limitations of the Agent OS v1 control plane prior to the capability harvest and superpower integration.

---

## Current Capability Matrix

| Subsystem | Current Implementation | Baseline Strengths | Limitations & Vulnerabilities | Harvest Enhancement | Risk & Token Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Code Intelligence** | Basic file tree scan & regex pattern searches in `repo_graph.py` | Fast directory traversal and basic command registry | No AST structural search, no semantic ranking, regex search breaks on complex multiline AST patterns | Integrate `ast-grep`, `Tree-sitter`, and `Semble` adapters behind a unified `CodeIntelligence` interface | Low risk; reduces token usage by 60–80% through precise symbol extraction |
| **Repository Graph** | Flat JSON maps in `.agents/knowledge/` (repo, arch, api, db) | Simple query interface | No typed relational edges (CALLS, IMPORTS, TESTS, WRITES); cannot answer transitive impact questions | Upgrade to `KnowledgeGraph 2.0` (Code-Graph-RAG concepts) | High value; sub-second dependency and blast radius querying |
| **Impact Analysis** | Basic filename substring search in `repo_graph.py` | Catches direct file references | Misses indirect imports, type aliases, event consumers, and route callers | Implement dedicated `ImpactAnalyzer` computing direct/indirect dependency graphs and minimal verification sets | Eliminates unnecessary test runs; reduces verification latency |
| **Structural Editing** | String replacement (`replace_file_content`) | Works for simple targeted edits | Vulnerable to whitespace formatting differences, cannot perform AST refactoring or API migrations safely | Implement `StructuralEditor` using AST transformations with syntax validation | Eliminates syntax regression errors from agent edits |
| **Context Retrieval** | Fixed L0–L4 tier slices with line caps in `tier_manager.py` | Bounded file reading | Static tier limits without relevance scoring; no lexical/semantic query expansion | Implement `ContextEngine 2.0` with multi-signal relevance scoring and hard context budgeting | Eliminates context bloat; guarantees adherence to strict token budgets |
| **Model Routing** | Single default model selection | Simple configuration | Expensive reasoning tokens wasted on trivial file discovery and formatting tasks | Implement `ModelRouter` (LiteLLM principles) mapping tasks to complexity tiers (T0–T4) with provider fallback | Saves 40–70% of LLM cost without reducing task success rates |
| **Specialized Workers** | Standard multi-agent DAG executor | Clean role separation | Lacks specialized workers for issue solving (SWE-agent style) and complex execution (OpenHands style) | Integrate `SWEWorker` and `OpenHandsWorker` substrates for specialized long-running tasks | Increases autonomy for complex GitHub issue resolution |
| **Browser Automation** | Basic command-based test runner | Checks test exit codes | No headless browser DOM inspection, a11y tree parsing, console error capture, or network request correlation | Implement `BrowserEngine` with Playwright-style DOM, network, and visual assertion capabilities | Enables autonomous reproduction and verification of complex UI/web bugs |
| **Security & Auditing** | Regex pattern matching in `policy_guard.py` | Catches common secret key prefixes | Cannot detect complex semantic vulnerabilities (e.g. SQL injection, SSRF, broken authorization) | Integrate `SecurityEngine` with Semgrep semantic rules and dependency CVE auditing | Deterministic vulnerability detection before any code is merged |
| **Capability Firewall** | Regex command matching in `policy_guard.py` | Blocks exact string patterns | Vulnerable to command variations, aliases, and indirect subshell invocations | Upgrade to `CapabilityFirewall` with structured `ActionDescriptor` (ALLOW, DENY, REQUIRE_APPROVAL) | Robust defense-in-depth preventing accidental production data loss |
| **Rollback & Recovery** | Checkpoint logging in `event_source.py` | State reconstruction | Does not restore filesystem files if an autonomous mission fails midway | Implement `RollbackManager` creating pre-mutation tree snapshots and automatic pristine rollback | Guarantees zero repository corruption from failed agent missions |
| **Evidence & Verification** | Acceptance of agent status strings | Fast execution | Susceptible to hallucinations or unverified agent success claims | Implement `EvidenceEngine` requiring deterministic on-disk test artifacts and exit codes | Zero unverified completions |
| **Self-Diagnostics** | Basic metric counters in `token_tracker.py` | Historical logging | System cannot inspect or diagnose its own internal tool health or MCP outages | Implement `/doctor` and `/health` diagnostic and self-repair engine | Fast MTTR for control plane degradation |
| **Repository Onboarding** | Assumes predefined structure | Works on standard repos | Requires manual configuration for new or unfamiliar languages/frameworks | Implement `ZeroConfigOnboarding` generating `.agents/project.yaml` automatically | Seamless multi-repository portability |

---

## Baseline Conclusion
The Agent OS control plane provides a solid foundational architecture. By selectively harvesting proven open-source techniques (AST structural matching, semantic security rules, multi-layer knowledge graphs, complexity-based model routing, and automatic rollback) and encapsulating them behind clean adapters, the system will achieve industrial-grade reliability, autonomy, and token efficiency.
