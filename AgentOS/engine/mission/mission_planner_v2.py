"""
Mission Planner 2.0 for Agent OS Phase II.
Autonomous multi-signal planning engine that decomposes high-level engineering objectives
into structured DAGs with unknowns, evidence requirements, tools, agents, and verification gates.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
import re

@dataclass
class PlannedSubtask:
    id: str
    name: str
    description: str
    assigned_role: str
    dependencies: List[str]
    required_tools: List[str]
    input_context_keys: List[str]
    verification_gates: List[str]
    expected_artifact: str

@dataclass
class MissionPlanV2:
    objective: str
    task_type: str
    unknowns: List[str]
    repository_areas: List[str]
    likely_subsystems: List[str]
    required_evidence: List[str]
    candidate_agents: List[str]
    required_tools: List[str]
    verification_requirements: List[str]
    execution_dag: List[PlannedSubtask]
    estimated_context_tokens: int

class MissionPlannerV2:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = workspace_root

    def plan_objective(self, objective: str) -> MissionPlanV2:
        """
        Derives full engineering plan from natural language objective.
        """
        lower = objective.lower()

        # 1. Classify Task Type & Subsystems
        if any(w in lower for w in ["whatsapp", "login", "auth", "session", "jwt", "token", "password"]):
            task_type = "BUG_FIX"
            likely_subsystems = ["AUTHENTICATION", "SESSION_MANAGEMENT", "SECURITY_GATEWAY"]
            repo_areas = ["services/api/src/modules/auth", "services/api/src/modules/notification", "apps/web/src/pages/admin/whatsapp"]
            unknowns = [
                "Is the issue at the token verification layer or session transport?",
                "Are database credentials/session hashes corrupted or expired?",
                "Does the frontend handle the auth error gracefully?"
            ]
            candidate_agents = ["debugger", "backend_engineer", "security_engineer", "test_engineer"]
            required_tools = ["knowledge_graph", "ripgrep", "ast_edit", "run_test", "security_scanner"]
            evidence = ["Passing authentication integration test", "Verified session token generation", "Security scan clean of credential leakage"]
            verification = ["typecheck", "unit_test", "security_scan", "integration_test"]
            
        elif any(w in lower for w in ["database", "migration", "prisma", "schema", "table", "sql"]):
            task_type = "DB_MIGRATION"
            likely_subsystems = ["DATA_PERSISTENCE", "PRISMA_ORM", "MIGRATION_RUNNER"]
            repo_areas = ["services/api/prisma", "services/api/src/database"]
            unknowns = [
                "Are there breaking schema changes requiring data backfills?",
                "Is rollback migration script deterministic and reversible?"
            ]
            candidate_agents = ["database_engineer", "backend_engineer", "test_engineer"]
            required_tools = ["knowledge_graph", "ripgrep", "write_file", "run_test"]
            evidence = ["Prisma schema validation pass", "Successful forward & reverse migration run", "Zero orphaned foreign keys"]
            verification = ["schema_validation", "migration_test", "integration_test", "rollback_verification"]

        elif any(w in lower for w in ["css", "style", "ui", "align", "color", "layout", "visual", "font"]):
            task_type = "CSS_STYLING"
            likely_subsystems = ["FRONTEND_PRESENTATION", "TAILWIND_THEME", "UI_COMPONENTS"]
            repo_areas = ["apps/web/src/styles", "apps/web/src/components", "apps/web/src/pages"]
            unknowns = [
                "Does the style modification cause responsive layout overflow on mobile form factors?",
                "Are CSS variables aligned with the Design System?"
            ]
            candidate_agents = ["frontend_engineer", "browser_engineer", "qa_engineer"]
            required_tools = ["ripgrep", "replace_content", "browser_engine"]
            evidence = ["Clean browser DOM inspection", "Zero layout overflow warnings", "Passing frontend build"]
            verification = ["typecheck", "browser_verify"]

        else:
            task_type = "GENERAL_ENGINEERING"
            likely_subsystems = ["CORE_APPLICATION", "BUSINESS_LOGIC"]
            repo_areas = ["services/api/src", "apps/web/src"]
            unknowns = [
                "What is the exact blast radius across callers and downstream services?"
            ]
            candidate_agents = ["repo_analyst", "backend_engineer", "test_engineer", "code_reviewer"]
            required_tools = ["knowledge_graph", "ripgrep", "replace_content", "run_test"]
            evidence = ["Passing test suites", "Clean static analysis"]
            verification = ["typecheck", "lint", "unit_test"]

        # 2. Build Dependency DAG Waves
        dag = [
            PlannedSubtask(
                id="task_1_investigate",
                name="Inspect & Trace Subsystem",
                description=f"Trace dependency graph and AST definitions across {', '.join(repo_areas)}",
                assigned_role=candidate_agents[0],
                dependencies=[],
                required_tools=["knowledge_graph", "ripgrep"],
                input_context_keys=["repo_graph", "ast_map"],
                verification_gates=["typecheck"],
                expected_artifact="investigation_summary.json"
            ),
            PlannedSubtask(
                id="task_2_patch",
                name="Implement Fix / Mutation",
                description=f"Apply deterministic structural changes to resolve: {objective}",
                assigned_role=candidate_agents[1] if len(candidate_agents) > 1 else candidate_agents[0],
                dependencies=["task_1_investigate"],
                required_tools=["ast_edit", "replace_content", "write_file"],
                input_context_keys=["investigation_summary.json", "target_files"],
                verification_gates=["typecheck", "lint"],
                expected_artifact="patch_diff.patch"
            ),
            PlannedSubtask(
                id="task_3_verify",
                name="Deterministic Verification & Evidence Capture",
                description="Execute automated test suite and capture deterministic completion evidence.",
                assigned_role="test_engineer",
                dependencies=["task_2_patch"],
                required_tools=["run_test", "evidence_engine"],
                input_context_keys=["patch_diff.patch"],
                verification_gates=verification,
                expected_artifact="verification_evidence.json"
            ),
        ]

        return MissionPlanV2(
            objective=objective,
            task_type=task_type,
            unknowns=unknowns,
            repository_areas=repo_areas,
            likely_subsystems=likely_subsystems,
            required_evidence=evidence,
            candidate_agents=candidate_agents,
            required_tools=required_tools,
            verification_requirements=verification,
            execution_dag=dag,
            estimated_context_tokens=8500
        )
