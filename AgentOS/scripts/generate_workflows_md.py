from pathlib import Path

workflows = {
    "fix": """# Workflow: /fix
Autonomous defect repair workflow.

## Steps
1. **Discover & Classify**: Scan repository and identify target subsystem.
2. **Failure Memory Search**: Query `.agents/memory/failure_memory.json` for prior solutions.
3. **Execute 8-Step Repair Loop**:
   - Observe symptom
   - Reproduce via test command
   - Trace and isolate minimal function
   - Formulate hypothesis (Attempt 1-3)
   - Apply minimal patch
   - Verify reproduction passes
   - Author regression test
4. **Verification Gates**: Execute typecheck, lint, and security scan.
5. **Report Result**: Present concise outcome.
""",
    "debug": """# Workflow: /debug
Evidence-based diagnostic and root cause isolation workflow.

## Steps
1. **Log Ingestion & Compression**: Ingest raw failing output and extract stack traces.
2. **AST & Reference Tracing**: Trace call hierarchy in repository intelligence graph.
3. **Hypothesis Generation**: Formulate testable root causes.
4. **Targeted Verification**: Run minimal reproducer to validate hypothesis.
5. **Diagnostic Delivery**: Present findings and suggested fix.
""",
    "finish": """# Workflow: /finish
Universal Finish-This mode.

## Steps
1. **Inspection**: Scan repository for unfinished TODOs, failing tests, and missing implementations.
2. **Decomposition**: Construct dependency DAG across frontend, backend, database, and integration layers.
3. **Parallel Execution**: Dispatch specialized agents concurrently in topological waves.
4. **Integration Wiring**: Validate end-to-end service contracts.
5. **Deterministic Gate Verification**: Run full test suites and red-team review.
6. **Delivery**: Deliver finished feature.
""",
    "audit": """# Workflow: /audit
Comprehensive quality, architecture, and maintainability audit.

## Steps
1. **Codebase AST Scan**: Measure module complexity, dead code, and dependency health.
2. **Lint & Style Check**: Enforce project conventions.
3. **Performance Audit**: Inspect bundle sizes and async bottlenecks.
4. **Report**: Deliver prioritized remediation list.
""",
    "security": """# Workflow: /security
Security & Red-Team vulnerability audit.

## Steps
1. **Secret Leak Scan**: Audit repository and diff for exposed tokens and private keys.
2. **OWASP Audit**: Verify injection defense, auth boundaries, and CORS/CSRF protections.
3. **Tool Permission Check**: Validate least-privilege tool profiles.
4. **Red-Team Critique**: Independent adversarial review.
""",
    "review": """# Workflow: /review
Independent code review and quality gate.

## Steps
1. **Git Diff Inspection**: Analyze changed files and patch hunks.
2. **Architectural Conformance**: Check consistency with established design patterns.
3. **Regression Safety**: Verify existing tests remain intact.
4. **Review Summary**: Output clean code review verdict.
""",
    "ship": """# Workflow: /ship
Production readiness verification and release deployment.

## Steps
1. **Run All Deterministic Gates**: Typecheck, lint, unit tests, integration tests, E2E browser tests.
2. **Deployment Health Verification**: Test health endpoints, database connection, and latency.
3. **Autonomy Guardrail**: Enforce human authorization for Level 3 Production deployments.
4. **Delivery**: Tag release and summarize deployment metrics.
""",
    "recover": """# Workflow: /recover
Mission state recovery and post-crash resumption.

## Steps
1. **Replay Event Log**: Load `events.jsonl` from current mission directory.
2. **Reconstruct State**: Restore completed tasks, active branches, and pending DAG nodes.
3. **Resume Execution**: Continue from the last valid checkpoint without restarting from zero.
""",
    "status": """# Workflow: /status
Displays current mission execution state, task progress, and telemetry metrics.
"""
}

for d in [Path("AgentOS/workflows"), Path(".agents/workflows")]:
    d.mkdir(parents=True, exist_ok=True)
    for name, content in workflows.items():
        with open(d / f"{name}.md", "w", encoding="utf-8") as f:
            f.write(content.strip() + "\n")

print("Generated 9 native Markdown workflows in AgentOS/workflows/ and .agents/workflows/")
