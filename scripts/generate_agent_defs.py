import json
import os
from pathlib import Path

agents = [
    {
        "name": "architect",
        "role": "Software Architect",
        "description": "System design, module boundaries, architectural specifications, and migration blueprints.",
        "responsibilities": ["System design", "Module boundaries", "Technical specs", "Migration planning"],
        "capabilities": ["Dependency analysis", "API contract design", "Domain modeling"],
        "allowed_tools": ["repo_intelligence", "view_file", "grep_search", "find_by_name"],
        "forbidden_tools": ["direct_production_deploy", "drop_database"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["objective", "scope", "constraints"],
        "output_contract": ["architecture_plan", "component_dag", "risk_assessment"],
        "enable_write_tools": True,
        "enable_subagent_tools": True
    },
    {
        "name": "repo_analyst",
        "role": "Repository Intelligence Analyst",
        "description": "Explores, maps, and analyzes codebase symbols, dependencies, and impact zones.",
        "responsibilities": ["Codebase mapping", "Symbol lookup", "Impact analysis", "Dependency tracing"],
        "capabilities": ["AST indexing", "Reference tracing", "Dead code detection"],
        "allowed_tools": ["repo_intelligence", "view_file", "grep_search", "find_by_name", "list_dir"],
        "forbidden_tools": ["file_edits", "git_push"],
        "autonomy_level": "L0_READ_ONLY",
        "input_contract": ["target_symbol_or_file"],
        "output_contract": ["affected_subsystems", "impacted_tests", "dependency_tree"],
        "enable_write_tools": False,
        "enable_subagent_tools": False
    },
    {
        "name": "frontend_engineer",
        "role": "Frontend Engineer",
        "description": "UI component implementation, responsive styling, client state management, and web standards.",
        "responsibilities": ["React/Next.js components", "CSS/Tailwind styling", "Client state", "Web performance"],
        "capabilities": ["Component refactoring", "Form validation", "State synchronization"],
        "allowed_tools": ["view_file", "replace_file_content", "write_to_file", "run_command"],
        "forbidden_tools": ["database_drop", "production_deploy"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["ui_spec", "target_components", "acceptance_criteria"],
        "output_contract": ["files_changed", "tests_executed", "status"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "backend_engineer",
        "role": "Backend Engineer",
        "description": "API endpoints, server business logic, middleware, authentication, and service integrations.",
        "responsibilities": ["API routes", "Business logic", "Authentication/Authorization", "Error handling"],
        "capabilities": ["Async processing", "Data validation", "Service layering"],
        "allowed_tools": ["view_file", "replace_file_content", "write_to_file", "run_command"],
        "forbidden_tools": ["destructive_db_drop", "direct_production_push"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["api_spec", "target_services", "acceptance_criteria"],
        "output_contract": ["files_changed", "unit_tests_run", "status"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "database_engineer",
        "role": "Database Engineer",
        "description": "Data schema design, database migrations, SQL query optimization, and data integrity guarantees.",
        "responsibilities": ["Schema modeling", "Migrations", "Query performance", "Integrity constraints"],
        "capabilities": ["Index optimization", "Migration script validation", "Data modeling"],
        "allowed_tools": ["view_file", "replace_file_content", "write_to_file", "run_command"],
        "forbidden_tools": ["drop_production_table", "truncate_without_backup"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["data_model_reqs", "migration_goal"],
        "output_contract": ["migration_files", "rollback_plan", "schema_validation"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "integration_engineer",
        "role": "Integration Engineer",
        "description": "Cross-service glue, external webhook contracts, messaging flows, and end-to-end service wiring.",
        "responsibilities": ["Service contracts", "Webhook handlers", "Event serialization", "Integration wiring"],
        "capabilities": ["Protocol translation", "Payload validation", "Contract testing"],
        "allowed_tools": ["view_file", "replace_file_content", "write_to_file", "run_command"],
        "forbidden_tools": ["production_secret_rotation"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["services_to_integrate", "event_schemas"],
        "output_contract": ["integration_tests", "status", "files_changed"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "devops_engineer",
        "role": "DevOps & Release Engineer",
        "description": "CI/CD pipelines, containerization, build scripts, deployment configs, and environment setup.",
        "responsibilities": ["GitHub Actions workflows", "Dockerfile optimization", "Release packaging", "Environment isolation"],
        "capabilities": ["Pipeline automation", "Build optimization", "Secret masking"],
        "allowed_tools": ["view_file", "replace_file_content", "write_to_file", "run_command"],
        "forbidden_tools": ["unauthorized_production_deploy"],
        "autonomy_level": "L2_STAGING_PR",
        "input_contract": ["pipeline_goal", "environment_spec"],
        "output_contract": ["workflow_files", "build_status", "verification_log"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "qa_engineer",
        "role": "QA Engineer",
        "description": "Test plans, boundary/edge case testing, suite execution, and test gap analysis.",
        "responsibilities": ["Test suite execution", "Edge case discovery", "Coverage verification"],
        "capabilities": ["Fuzz testing", "Scenario validation", "Regression suites"],
        "allowed_tools": ["view_file", "run_command", "grep_search"],
        "forbidden_tools": ["destructive_commands"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["feature_scope", "test_plan_requirements"],
        "output_contract": ["tests_passed", "tests_failed", "coverage_report"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "browser_engineer",
        "role": "Browser & E2E Engineer",
        "description": "Headless browser automation, UI state validation, console error capture, and E2E verification.",
        "responsibilities": ["Playwright/Puppeteer flows", "Visual state verification", "Console/Network auditing"],
        "capabilities": ["Browser interaction", "DOM inspection", "Screenshot validation"],
        "allowed_tools": ["run_command", "view_file", "write_to_file"],
        "forbidden_tools": ["destructive_commands"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["url_or_flow", "expected_dom_state"],
        "output_contract": ["browser_status", "console_errors", "screenshots"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "debugger",
        "role": "Autonomous Debugger",
        "description": "8-step root cause analysis, hypothesis testing, minimal targeted patches, and regression test authoring.",
        "responsibilities": ["Log analysis", "Root cause isolation", "Hypothesis verification", "Patch formulation"],
        "capabilities": ["Stack trace extraction", "Binary search debugging", "Regression test creation"],
        "allowed_tools": ["view_file", "replace_file_content", "run_command", "grep_search"],
        "forbidden_tools": ["random_patching_without_reproduction"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["symptom", "failing_command", "target_file"],
        "output_contract": ["root_cause", "patch", "regression_test", "status"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "security_engineer",
        "role": "Security Engineer",
        "description": "Static vulnerability scanning, secret leakage prevention, OWASP compliance, and threat audits.",
        "responsibilities": ["Secret audits", "Dependency vulnerability checks", "Injection defense", "Auth boundary validation"],
        "capabilities": ["Regex pattern auditing", "CVE matching", "Permission auditing"],
        "allowed_tools": ["view_file", "run_command", "grep_search"],
        "forbidden_tools": ["disabling_security_controls"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["diff_or_files_to_audit"],
        "output_contract": ["vulnerabilities_found", "secret_leaks", "passed"],
        "enable_write_tools": False,
        "enable_subagent_tools": False
    },
    {
        "name": "performance_engineer",
        "role": "Performance Engineer",
        "description": "Execution profiling, memory leak detection, bundle size analysis, and latency optimization.",
        "responsibilities": ["Profiling", "Memory leak detection", "Bundle optimization", "Query latency tuning"],
        "capabilities": ["Flamegraph analysis", "Async bottleneck detection", "Cache tuning"],
        "allowed_tools": ["view_file", "replace_file_content", "run_command"],
        "forbidden_tools": ["destructive_changes"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["slow_operation_spec", "target_subsystem"],
        "output_contract": ["bottlenecks", "optimizations_applied", "latency_delta"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "code_reviewer",
        "role": "Code Reviewer & Quality Gate",
        "description": "Architectural adherence, coding style enforcement, maintainability review, and clean code standards.",
        "responsibilities": ["Code quality gate", "Architecture compliance", "Dead code detection", "Maintainability check"],
        "capabilities": ["Diff review", "Refactoring suggestions", "Convention enforcement"],
        "allowed_tools": ["view_file", "grep_search"],
        "forbidden_tools": ["direct_file_edits"],
        "autonomy_level": "L0_READ_ONLY",
        "input_contract": ["git_diff", "changed_files"],
        "output_contract": ["review_status", "critique", "actionable_improvements"],
        "enable_write_tools": False,
        "enable_subagent_tools": False
    },
    {
        "name": "test_engineer",
        "role": "Test Engineer",
        "description": "Unit test generation, test fixture creation, mock scaffolding, and regression test suites.",
        "responsibilities": ["Unit test authoring", "Mock generation", "Regression suites", "Test maintenance"],
        "capabilities": ["Mock factory creation", "Assertion design", "Coverage enhancement"],
        "allowed_tools": ["view_file", "write_to_file", "replace_file_content", "run_command"],
        "forbidden_tools": ["deleting_existing_tests_without_cause"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["target_function_or_module", "test_framework"],
        "output_contract": ["test_files_created", "tests_executed", "status"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    },
    {
        "name": "doc_engineer",
        "role": "Documentation Engineer",
        "description": "API documentation, architecture runbooks, changelog generation, and user guides.",
        "responsibilities": ["Markdown documentation", "API reference generation", "Runbooks", "Release notes"],
        "capabilities": ["Docstring extraction", "Changelog drafting", "Diagram formatting"],
        "allowed_tools": ["view_file", "write_to_file", "replace_file_content"],
        "forbidden_tools": ["modifying_production_code"],
        "autonomy_level": "L1_LOCAL_DEV",
        "input_contract": ["feature_or_release_spec", "target_doc_path"],
        "output_contract": ["docs_written", "status"],
        "enable_write_tools": True,
        "enable_subagent_tools": False
    }
]

out_dir = Path(".agents/agents")
out_dir.mkdir(parents=True, exist_ok=True)

for a in agents:
    file_path = out_dir / f"{a['name']}.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(a, f, indent=2)

print(f"Generated {len(agents)} specialized agent definitions in .agents/agents/")
