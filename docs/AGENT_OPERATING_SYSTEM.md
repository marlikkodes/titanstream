# Antigravity Superengineering Operating System (Agent OS)
## Architectural & Operational Guide

The **Antigravity Superengineering Operating System** is an autonomous, multi-agent software-engineering operating system designed to automate end-to-end development, testing, debugging, and verification with minimal human intervention, optimized token economy, and strict safety guardrails.

---

## 1. System Architecture

```
                               ┌──────────────────────────┐
                               │      USER OBJECTIVE      │
                               └────────────┬─────────────┘
                                            │
                                            ▼
                               ┌──────────────────────────┐
                               │     AGENT COMMANDER      │
                               │ - Intent Interpretation  │
                               │ - Repo Intelligence AST │
                               │ - Failure Memory Query   │
                               │ - Task DAG Planner       │
                               └────────────┬─────────────┘
                                            │
               ┌────────────────────────────┼───────────────────────────┐
               ▼                            ▼                           ▼
      ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
      │    Architect     │        │Frontend Engineer │        │Backend Engineer  │
      │  (L0/L1 Tier)    │        │   (L2/L3 Tier)   │        │   (L2/L3 Tier)   │
      └────────┬─────────┘        └────────┬─────────┘        └────────┬─────────┘
               │                           │                           │
               └───────────────────────────┼───────────────────────────┘
                                           ▼
                               ┌──────────────────────────┐
                               │  DETERMINISTIC GATES     │
                               │ - Typecheck / Syntax     │
                               │ - Lint / Clean code      │
                               │ - Unit / Integration     │
                               │ - Security & Secret Scan │
                               │ - Red-Team Audit         │
                               └────────────┬─────────────┘
                                            │
                       ┌────────────────────┴────────────────────┐
                       │ (Pass)                                  │ (Fail)
                       ▼                                         ▼
         ┌──────────────────────────┐              ┌──────────────────────────┐
         │         DELIVERY         │              │      AUTO-DEBUGGER       │
         │ - Mission Checkpoint     │              │ - 8-Step Repair Loop     │
         │ - Metrics Telemetry      │              │ - Max 3 Repair Attempts  │
         │ - Concise UI Report      │              │ - Regression Test & Mem  │
         └──────────────────────────┘              └──────────────────────────┘
```

---

## 2. Global Agent Directory Layout

- `.agents/`
  - `bin/agent-commander`: Executable CLI facilitating all workflows and commands.
  - `engine/`: Core Python engine modules:
    - `agent_os_core.py`: Data models, contracts, enums, and schemas.
    - `repo_intelligence.py`: Autonomous repository intelligence and symbol mapping.
    - `context_tier.py`: Context economy manager (L0–L4) and log compressor.
    - `failure_memory.py`: Persistent defect and fix database.
    - `task_graph.py`: DAG constructor, dynamic routing, and parallel execution waves.
    - `auto_debugger.py`: 8-step evidence-based repair loop with repair limits.
    - `verification_gates.py`: Deterministic verification and red-team review.
    - `mission_state.py`: Machine-readable mission state and checkpointing.
    - `observability.py`: Telemetry, token usage, and latency tracking.
    - `agent_commander.py`: Unified orchestrator.
  - `agents/`: 15 specialized JSON agent manifests.
  - `config/`: Safety policies, permission limits, and routing matrices.
  - `workflows/`: Reusable multi-phase DAG templates.
  - `memory/`: Persistent failure database (`failure_memory.json`).
  - `knowledge/`: Cached repository intelligence maps (`repo_map.json`, `architecture_map.json`, etc.).
  - `state/`: Mission execution checkpoints and metrics telemetry.

---

## 3. Specialized Agents

| Agent Name | Role | Autonomy Level | Allowed Tools | Input Contract | Output Contract |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`architect`** | Software Architect | L1_LOCAL_DEV | Repo Intel, View, Grep, Find | Objective, Constraints | Architecture Plan, Component DAG |
| **`repo_analyst`** | Repo Intelligence Analyst | L0_READ_ONLY | View, Grep, Find, ListDir | Target Symbol/File | Affected Subsystems, Test Map |
| **`frontend_engineer`** | Frontend Engineer | L1_LOCAL_DEV | Filesystem, Run, View | UI Spec, Criteria | Files Changed, Tests Executed |
| **`backend_engineer`** | Backend Engineer | L1_LOCAL_DEV | Filesystem, Run, View | API Spec, Criteria | Files Changed, Unit Tests Run |
| **`database_engineer`** | Database Engineer | L1_LOCAL_DEV | Filesystem, DB Tools | Data Model, Migration | Migration Files, Rollback Plan |
| **`integration_engineer`** | Integration Engineer | L1_LOCAL_DEV | Filesystem, Run | Services, Schemas | Integration Tests, Status |
| **`devops_engineer`** | DevOps & Release | L2_STAGING_PR | Workflows, Docker, Run | Pipeline Spec, Envs | Workflow Files, Build Status |
| **`qa_engineer`** | QA Engineer | L1_LOCAL_DEV | Test Runner, View, Grep | Feature Scope, Test Plan | Test Results, Coverage Report |
| **`browser_engineer`** | Browser & E2E Engineer | L1_LOCAL_DEV | Browser Automation, Run | URL/Flow, Target DOM | Console Errors, Screenshots |
| **`debugger`** | Autonomous Debugger | L1_LOCAL_DEV | Filesystem, Run, Grep | Symptom, Reproducer | Root Cause, Patch, Reg Test |
| **`security_engineer`** | Security Engineer | L1_LOCAL_DEV | Secret Scanner, Grep | Diff, Files to Audit | Vulnerabilities, Secret Leaks |
| **`performance_engineer`**| Performance Engineer | L1_LOCAL_DEV | Profiler, Filesystem | Latency Spec, Subsystem | Bottlenecks, Optimizations |
| **`code_reviewer`** | Code Reviewer | L0_READ_ONLY | Diff Viewer, Grep | Git Diff, Changed Files | Review Status, Critique |
| **`test_engineer`** | Test Engineer | L1_LOCAL_DEV | Filesystem, Test Runner | Function/Module | Test Files, Assertions |
| **`doc_engineer`** | Documentation Engineer| L1_LOCAL_DEV | Doc Writer, View | Feature/Release Spec | Documentation Markdown |

---

## 4. Context Economy Tiers

To maximize token efficiency, context is compartmentalized into 5 progressive tiers:
- **L0: Metadata**: Stack, repository name, language, core dependencies (~100–300 tokens).
- **L1: Architecture**: Subsystems, design patterns, entrypoints (~500–1,500 tokens).
- **L2: Subsystem**: Targeted directory structure and file listings (~1,000–3,000 tokens).
- **L3: Exact Code**: Precise targeted source files and function definitions (~2,000–8,000 tokens).
- **L4: History**: Historical context, Git diffs, and matching failure memory signatures (~1,000–4,000 tokens).

---

## 5. 8-Step Auto-Debugger Repair Protocol

```
[1. OBSERVE]     --> Parse symptom and error signature
[2. REPRODUCE]   --> Execute deterministic test / reproducer command
[3. TRACE]       --> Compress raw logs & isolate exception stack trace
[4. ISOLATE]     --> Identify target function / file boundary
[5. HYPOTHESIZE] --> Formulate concrete fix hypothesis (Attempt N / 3)
[6. PATCH]       --> Apply targeted minimal code modification
[7. TEST]        --> Execute reproduction command to confirm resolution
[8. REGRESSION]  --> Author permanent regression test & persist to Failure Memory
```

If 3 repair attempts fail, the debugger halts immediately, preserves workspace state, records telemetry, and escalates to the human operator with a concise diagnostic report.

---

## 6. Global CLI & Commands

Run commands via `.agents/bin/agent-commander <command> [objective]`:

```bash
# Execute Fix Workflow
.agents/bin/agent-commander fix "Fix token expiration in auth service"

# Execute Debug Workflow
.agents/bin/agent-commander debug "Investigate 500 error in /api/checkout"

# Run Finish-This Universal Mode
.agents/bin/agent-commander finish "Complete withdrawal hardening flow"

# Check Current Mission Status
.agents/bin/agent-commander status

# Resume Interrupted Mission
.agents/bin/agent-commander resume

# Re-index Repository Intelligence
.agents/bin/agent-commander index

# Search Persistent Failure Memory
.agents/bin/agent-commander memory "timeout"

# Display Telemetry Metrics
.agents/bin/agent-commander metrics
```
