# Antigravity Superengineering Operating System — Capability Registry

This registry catalogues every tool, adapter, worker, MCP integration, and dependency integrated into the Agent OS control plane.

---

## 1. Code Intelligence & Search Adapters

| Component / Adapter | Source / Standard | Internal Interface | Capabilities | Fallback Chain |
| :--- | :--- | :--- | :--- | :--- |
| **`CodeIntelligence`** | Native Bus (`intelligence/interface.py`) | Search, AST, Symbols, Rewrite | Unified code intelligence API | Dispatches to available adapters |
| **`ast-grep` Adapter** | [ast-grep](https://github.com/ast-grep/ast-grep) | `structural_search()`, `rewrite()` | Pattern-based AST matching & replacement | Python `ast` / regex AST parser |
| **`Tree-sitter` Adapter** | Tree-sitter AST | `parse()`, `symbols()` | Multi-language syntax tree navigation | Standard language parsers |
| **`Semble` Adapter** | [Semble](https://github.com/johunsang/semble_rs) | `search()`, `semantic_search()` | BM25 lexical ranking + AST chunking | Bounded ripgrep scan |
| **`KnowledgeGraph 2.0`** | [Code-Graph-RAG](https://github.com/vitali87/code-graph-rag) | `get_dependents()`, `get_dependencies()` | Multi-layer relational graph (`CALLS`, `IMPORTS`, `TESTS`, etc.) | Flat repository intelligence maps |
| **`ImpactAnalyzer`** | Deterministic Graph Engine | `analyze_impact()` | Direct/indirect blast radius calculation & test resolution | Static directory mapping |

---

## 2. Specialized Workers & Substrates

| Worker Name | Inspired By | Location | Purpose & Specialization | Trigger Condition |
| :--- | :--- | :--- | :--- | :--- |
| **`SWEWorker`** | [SWE-agent](https://github.com/SWE-agent/SWE-agent) | `AgentOS/workers/swe_worker/` | GitHub issue resolution, iterative patch generation, and test-driven repair | Issue-solving missions, bug tickets |
| **`OpenHandsWorker`** | [OpenHands](https://github.com/All-Hands-AI/OpenHands) | `AgentOS/workers/openhands_worker/` | Interactive terminal execution, sandboxed multi-step workflows | Complex multi-stage execution tasks |

---

## 3. Security & Browser Superpowers

| Superpower | Tool / Standard | Location | Capabilities | Security Mode |
| :--- | :--- | :--- | :--- | :--- |
| **`SecurityEngine`** | [Semgrep](https://github.com/semgrep/semgrep) rules | `engine/security/` | Semantic static analysis, SQLi/XSS/Command injection detection, secret scanning | Deterministic AST pattern analysis |
| **`BrowserEngine`** | [Playwright](https://github.com/microsoft/playwright) standard | `engine/browser/` | Headless DOM verification, accessibility tree checks, console error capture | Sandboxed headless verification |

---

## 4. Safety & Policy Control

| Component | Purpose | Input Schema | Enforcement Decisions |
| :--- | :--- | :--- | :--- |
| **`CapabilityFirewall`** | Semantic Action Authorization | `ActionDescriptor(agent, action, tool, target, environment, operation, reversibility, data_impact, security_impact, required_authority)` | `ALLOW`, `DENY`, `REQUIRE_APPROVAL` |
| **`EvidenceEngine`** | Evidence-based completion | `verify_completion_claim(claim_type, evidence_artifact_path, expected_exit_code)` | Rejects unsupported agent assertions |
| **`RollbackManager`** | Automatic pristine rollback | `create_snapshot(mission_id, files)` $\to$ `rollback(mission_id)` | Restores pre-mutation files on failure |
| **`HookEngine`** | Lifecycle Interception | `pre_tool_hook()`, `post_tool_hook()`, `tool_failure_hook()` | Secret redaction, transient error backoff |

---

## 5. Economics & Model Gateway

| Component | Standard | Complexity Tiers | Target Models |
| :--- | :--- | :--- | :--- |
| **`ModelRouter`** | [LiteLLM](https://github.com/BerriAI/litellm) principles | T0 (Deterministic), T1 (Cheap), T2 (Standard), T3 (Complex), T4 (Critical) | `local_tool` $\to$ `gemini-2.5-flash-lite` $\to$ `gemini-2.5-flash` $\to$ `gemini-2.5-pro` $\to$ `pro-extended` |
| **`EconomicTelemetry`** | OpenTelemetry standard | Granular token & cost tracking | Tracks prompt, completion, cached tokens, USD cost, and human minutes saved |
