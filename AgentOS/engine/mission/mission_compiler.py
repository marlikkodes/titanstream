"""
Mission Compiler.
Translates natural-language engineering objectives into machine-readable MissionSpecs
with complete domain, risk, constraint, artifact, and verification definitions.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from pathlib import Path
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph

@dataclass
class MissionSpec:
    objective: str
    scope: List[str]
    constraints: List[str]
    affected_domains: List[str]
    risk_level: str
    expected_artifacts: List[str]
    required_evidence: List[str]
    verification_depth: str
    candidate_agents: List[str]
    candidate_tools: List[str]
    completion_criteria: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "objective": self.objective,
            "scope": self.scope,
            "constraints": self.constraints,
            "affected_domains": self.affected_domains,
            "risk_level": self.risk_level,
            "expected_artifacts": self.expected_artifacts,
            "required_evidence": self.required_evidence,
            "verification_depth": self.verification_depth,
            "candidate_agents": self.candidate_agents,
            "candidate_tools": self.candidate_tools,
            "completion_criteria": self.completion_criteria
        }

class MissionCompiler:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.kg = KnowledgeGraph(str(self.workspace_root))
        self.kg.build_graph()

    def compile(self, objective: str, user_constraints: Optional[List[str]] = None) -> MissionSpec:
        obj_lower = objective.lower()
        
        # 1. Affected domains
        domains = []
        if any(k in obj_lower for k in ["ui", "frontend", "css", "page", "button", "spinner", "screen"]):
            domains.append("frontend")
        if any(k in obj_lower for k in ["api", "route", "backend", "service", "endpoint", "controller"]):
            domains.append("backend")
        if any(k in obj_lower for k in ["db", "database", "migration", "prisma", "sql", "table", "column"]):
            domains.append("database")
        if any(k in obj_lower for k in ["security", "auth", "token", "jwt", "secret", "cookie"]):
            domains.append("security")
        if any(k in obj_lower for k in ["ci", "pipeline", "deploy", "docker", "k8s"]):
            domains.append("devops")
        if not domains:
            domains.append("general_engineering")

        # 2. Risk classification
        risk_level = "LOW"
        if "production" in obj_lower or "drop" in obj_lower or "security" in obj_lower or "migration" in obj_lower:
            risk_level = "CRITICAL" if "drop" in obj_lower or "production" in obj_lower else "HIGH"
        elif "backend" in domains or "database" in domains:
            risk_level = "MODERATE"

        # 3. Candidate agents
        agents = []
        if "frontend" in domains:
            agents.extend(["frontend_engineer", "browser_engineer"])
        if "backend" in domains:
            agents.extend(["backend_engineer", "test_engineer"])
        if "database" in domains:
            agents.extend(["database_engineer", "backend_engineer"])
        if "security" in domains:
            agents.extend(["security_engineer", "code_reviewer"])
        if "devops" in domains:
            agents.extend(["devops_engineer"])
        if not agents:
            agents.extend(["repo_analyst", "debugger"])

        # Deduplicate agents
        agents = list(dict.fromkeys(agents))

        # 4. Verification Depth & Required Evidence
        if risk_level in ["CRITICAL", "HIGH"]:
            v_depth = "FULL_SECURITY_AND_REGRESSION"
            evidence = ["test_pass_artifact", "security_scan_clean", "git_diff_verified"]
        elif risk_level == "MODERATE":
            v_depth = "TARGETED_TESTS_AND_LINT"
            evidence = ["test_pass_artifact", "typecheck_clean"]
        else:
            v_depth = "MINIMAL_LINT_AND_TEST"
            evidence = ["test_pass_artifact"]

        # 5. Candidate tools
        tools = ["code_search", "ast_grep", "structural_rewrite", "test_runner"]
        if "frontend" in domains:
            tools.append("playwright_browser")
        if "security" in domains:
            tools.append("semgrep_security_scan")

        constraints = user_constraints if user_constraints else []
        constraints.extend([
            "No breaking changes without migration",
            "Zero unverified completion claims",
            "Preserve all existing non-bug behaviors"
        ])

        return MissionSpec(
            objective=objective,
            scope=domains,
            constraints=constraints,
            affected_domains=domains,
            risk_level=risk_level,
            expected_artifacts=[".agents/evidence/test_run.json"],
            required_evidence=evidence,
            verification_depth=v_depth,
            candidate_agents=agents,
            candidate_tools=tools,
            completion_criteria=[
                "Deterministic verification gates passed",
                "No unexpected scope expansion",
                "Evidence artifact saved on disk"
            ]
        )
