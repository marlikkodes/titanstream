import json
from pathlib import Path

# 1. safety_policy.json
safety_policy = {
    "version": "1.0.0",
    "autonomy_levels": {
        "L0_READ_ONLY": {
            "description": "Inspection, symbol analysis, and knowledge retrieval only. No file modifications or destructive commands.",
            "allowed_tools": ["view_file", "grep_search", "find_by_name", "list_dir", "repo_intelligence"]
        },
        "L1_LOCAL_DEV": {
            "description": "Autonomous local code editing, running tests, linting, formatting, and local builds.",
            "allowed_tools": ["view_file", "replace_file_content", "write_to_file", "run_command", "grep_search", "find_by_name"]
        },
        "L2_STAGING_PR": {
            "description": "Branch creation, staging deployment triggers, smoke testing, and pull request generation.",
            "allowed_tools": ["git_branch", "git_pr", "run_command", "browser_verification"]
        },
        "L3_PRODUCTION": {
            "description": "Production deployments and critical migrations. REQUIRES EXPLICIT HUMAN AUTHORIZATION.",
            "allowed_tools": ["deployment_tools"],
            "requires_human_approval": True
        }
    },
    "forbidden_patterns": [
        "rm -rf /",
        "drop database",
        "drop table",
        "truncate table",
        "format disk",
        "gcloud projects delete",
        "git push origin main --force",
        "git reset --hard origin/main"
    ],
    "secret_redaction_patterns": [
        "sk-[a-zA-Z0-9]{20,}",
        "AIzaSy[a-zA-Z0-9_-]{33}",
        "ghp_[a-zA-Z0-9]{30,}",
        "BEGIN RSA PRIVATE KEY"
    ],
    "human_escalation_triggers": [
        "Repeated failure exceeding MAX_REPAIR_ATTEMPTS (3)",
        "Genuinely ambiguous business requirements with multiple valid architectures",
        "Level 3 Production release or migration authorization",
        "Destructive data or infrastructure modification",
        "Missing required production credentials"
    ]
}

with open(".agents/config/safety_policy.json", "w", encoding="utf-8") as f:
    json.dump(safety_policy, f, indent=2)

# 2. routing_matrix.json
routing_matrix = {
    "version": "1.0.0",
    "mappings": {
        "frontend_bug": ["frontend_engineer", "browser_engineer", "qa_engineer"],
        "backend_bug": ["backend_engineer", "debugger", "test_engineer"],
        "database_issue": ["database_engineer", "backend_engineer", "qa_engineer"],
        "cross_system_feature": ["architect", "frontend_engineer", "backend_engineer", "integration_engineer", "qa_engineer"],
        "security_change": ["security_engineer", "backend_engineer", "code_reviewer"],
        "performance_issue": ["performance_engineer", "backend_engineer"],
        "release_deployment": ["devops_engineer", "security_engineer", "qa_engineer"],
        "finish_feature": ["architect", "repo_analyst", "frontend_engineer", "backend_engineer", "integration_engineer", "security_engineer", "qa_engineer"]
    }
}

with open(".agents/config/routing_matrix.json", "w", encoding="utf-8") as f:
    json.dump(routing_matrix, f, indent=2)

# 3. Workflows
workflows = {
    "finish_feature": {
        "name": "Universal Finish-This Workflow",
        "phases": [
            {"phase": "analysis", "agents": ["repo_analyst", "architect"], "desc": "Identify TODOs, broken integrations, and missing tests"},
            {"phase": "implementation", "agents": ["frontend_engineer", "backend_engineer", "database_engineer"], "desc": "Implement incomplete features in parallel"},
            {"phase": "integration", "agents": ["integration_engineer"], "desc": "Wire cross-system interfaces and end-to-end flows"},
            {"phase": "verification", "agents": ["qa_engineer", "security_engineer", "code_reviewer"], "desc": "Run deterministic gates, red-team review, and regression suites"}
        ]
    },
    "fix_bug": {
        "name": "Autonomous 8-Step Bug Repair Workflow",
        "phases": [
            {"phase": "diagnosis", "agents": ["debugger", "repo_analyst"], "desc": "Observe, reproduce, trace, isolate, and formulate hypothesis"},
            {"phase": "patch", "agents": ["debugger"], "desc": "Apply minimal targeted patch"},
            {"phase": "verify", "agents": ["qa_engineer", "test_engineer"], "desc": "Verify reproducer passes, create regression test, and update failure memory"}
        ]
    },
    "security_audit": {
        "name": "Security & Red-Team Audit Workflow",
        "phases": [
            {"phase": "scan", "agents": ["security_engineer"], "desc": "Scan diff for secret leaks, dependency CVEs, and OWASP issues"},
            {"phase": "red_team", "agents": ["code_reviewer", "qa_engineer"], "desc": "Adversarial review across QA, Security, Performance, and Architecture"}
        ]
    }
}

for wname, wdata in workflows.items():
    with open(f".agents/workflows/{wname}.json", "w", encoding="utf-8") as f:
        json.dump(wdata, f, indent=2)

print("Generated config/safety_policy.json, routing_matrix.json, and workflows/*.json")
