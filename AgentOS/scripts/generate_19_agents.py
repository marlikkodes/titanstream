import json
from pathlib import Path

agents = [
    # 15 core roles
    {"name": "architect", "role": "Software Architect", "description": "System design, module boundaries, architectural specifications, and migration blueprints."},
    {"name": "repo_analyst", "role": "Repository Intelligence Analyst", "description": "Explores, maps, and analyzes codebase symbols, dependencies, and impact zones."},
    {"name": "frontend_engineer", "role": "Frontend Engineer", "description": "UI components, responsive styling, client state, web standards, and visual performance budgets."},
    {"name": "backend_engineer", "role": "Backend Engineer", "description": "API endpoints, server business logic, middleware, authentication, and service integrations."},
    {"name": "database_engineer", "role": "Database Engineer", "description": "Data schema design, database migrations, SQL query optimization, and data integrity guarantees."},
    {"name": "integration_engineer", "role": "Integration Engineer", "description": "Cross-service glue, external webhook contracts, messaging flows, and end-to-end service wiring."},
    {"name": "devops_engineer", "role": "DevOps & Release Engineer", "description": "CI/CD pipelines, containerization, build scripts, deployment configs, and environment setup."},
    {"name": "qa_engineer", "role": "QA Engineer", "description": "Test plans, boundary/edge case testing, suite execution, and test gap analysis."},
    {"name": "browser_engineer", "role": "Browser & E2E Engineer", "description": "Headless browser automation, UI state validation, console error capture, and E2E verification."},
    {"name": "debugger", "role": "Autonomous Debugger", "description": "8-step root cause analysis, hypothesis testing, minimal targeted patches, and regression test authoring."},
    {"name": "security_engineer", "role": "Security Engineer", "description": "Static vulnerability scanning, secret leakage prevention, OWASP compliance, and threat audits."},
    {"name": "performance_engineer", "role": "Performance Engineer", "description": "Execution profiling, memory leak detection, bundle size analysis, and latency optimization."},
    {"name": "code_reviewer", "role": "Code Reviewer & Quality Gate", "description": "Architectural adherence, coding style enforcement, maintainability review, and clean code standards."},
    {"name": "test_engineer", "role": "Test Engineer", "description": "Unit test generation, test fixture creation, mock scaffolding, and regression test suites."},
    {"name": "doc_engineer", "role": "Documentation Engineer", "description": "API documentation, architecture runbooks, changelog generation, and user guides."},
    
    # 4 Meta-agents
    {"name": "mission_controller", "role": "Mission Controller", "description": "Owns execution state, DAG wave transitions, event stream appending, and checkpoint persistence."},
    {"name": "context_engineer", "role": "Context Economy Engineer", "description": "Owns tiered context retrieval (L0-L4), log compression, token budgeting, and relevance scoring."},
    {"name": "merge_guardian", "role": "Merge Guardian", "description": "Owns multi-agent workspace conflict detection, branch isolation, diff reconciliation, and merge safety."},
    {"name": "escalation_manager", "role": "Escalation Manager", "description": "Owns human interaction gating, policy violation analysis, and missing credential verification."}
]

out_dir = Path("AgentOS/agents")
out_dir.mkdir(parents=True, exist_ok=True)

for a in agents:
    with open(out_dir / f"{a['name']}.json", "w", encoding="utf-8") as f:
        json.dump(a, f, indent=2)

print(f"Wrote {len(agents)} agent manifests to AgentOS/agents/")
