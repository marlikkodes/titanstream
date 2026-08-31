"""
Engineering Policy Engine for Agent OS Phase II.
Centralized policy decision engine governing autonomy, verification requirements,
allowed tools, candidate agents, context budgets, model tiers, and approval gates.
"""

import os
from enum import Enum
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Set

class Environment(str, Enum):
    LOCAL = "LOCAL"
    TEST = "TEST"
    STAGING = "STAGING"
    PRODUCTION = "PRODUCTION"

class TaskType(str, Enum):
    INVESTIGATION = "INVESTIGATION"
    BUG_FIX = "BUG_FIX"
    FEATURE = "FEATURE"
    REFACTOR = "REFACTOR"
    SECURITY_AUDIT = "SECURITY_AUDIT"
    DB_MIGRATION = "DB_MIGRATION"
    CSS_STYLING = "CSS_STYLING"
    INCIDENT_REMEDIATION = "INCIDENT_REMEDIATION"

class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class AutonomyLevel(str, Enum):
    L0_READ = "L0_READ"
    L1_LOCAL = "L1_LOCAL"
    L2_BRANCH_PR = "L2_BRANCH_PR"
    L3_STAGING = "L3_STAGING"
    L4_PRODUCTION = "L4_PRODUCTION"

class VerificationDepth(str, Enum):
    MINIMAL = "MINIMAL"       # typecheck + targeted test
    STANDARD = "STANDARD"     # typecheck + lint + unit tests
    EXTENDED = "EXTENDED"     # typecheck + unit + integration + contract
    MAXIMAL = "MAXIMAL"       # typecheck + unit + integration + security + regression + rollback

class ApprovalRequirement(str, Enum):
    AUTOMATIC = "AUTOMATIC"
    HUMAN_CONFIRMATION = "HUMAN_CONFIRMATION"
    STRICT_DENY = "STRICT_DENY"

@dataclass
class PolicyEvaluationResult:
    autonomy_level: AutonomyLevel
    allowed: bool
    approval_required: ApprovalRequirement
    verification_depth: VerificationDepth
    required_gates: List[str]
    allowed_tools: List[str]
    allowed_agents: List[str]
    max_context_tokens: int
    model_tier: str
    rollback_snapshot_required: bool
    rationale: str
    risk_level: RiskLevel

class EngineeringPolicyEngine:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = workspace_root

    def evaluate(
        self,
        task_type: TaskType,
        environment: Environment = Environment.LOCAL,
        risk: Optional[RiskLevel] = None,
        mutation_scope: str = "MODULE",
        is_production_impact: bool = False,
        data_sensitivity: str = "INTERNAL",
        historical_success_rate: float = 1.0,
    ) -> PolicyEvaluationResult:
        """
        Evaluates the unified engineering policy based on task, environment, risk, and impact.
        """
        # Determine risk if not explicitly provided
        if risk is None:
            if environment == Environment.PRODUCTION or task_type == TaskType.INCIDENT_REMEDIATION:
                risk = RiskLevel.CRITICAL if is_production_impact else RiskLevel.HIGH
            elif task_type == TaskType.DB_MIGRATION:
                risk = RiskLevel.HIGH
            elif task_type == TaskType.SECURITY_AUDIT:
                risk = RiskLevel.MEDIUM
            elif task_type == TaskType.CSS_STYLING or task_type == TaskType.INVESTIGATION:
                risk = RiskLevel.LOW
            else:
                risk = RiskLevel.MEDIUM

        # 1. Environment & Autonomy gating
        if environment == Environment.PRODUCTION:
            autonomy = AutonomyLevel.L4_PRODUCTION
            approval = ApprovalRequirement.HUMAN_CONFIRMATION if risk != RiskLevel.LOW else ApprovalRequirement.AUTOMATIC
            rollback_required = True
        elif environment == Environment.STAGING:
            autonomy = AutonomyLevel.L3_STAGING
            approval = ApprovalRequirement.AUTOMATIC
            rollback_required = True
        elif environment == Environment.TEST:
            autonomy = AutonomyLevel.L1_LOCAL
            approval = ApprovalRequirement.AUTOMATIC
            rollback_required = False
        else: # LOCAL
            autonomy = AutonomyLevel.L1_LOCAL
            approval = ApprovalRequirement.AUTOMATIC
            rollback_required = (mutation_scope != "READ_ONLY")

        # 2. Verification Depth & Required Gates
        if task_type == TaskType.CSS_STYLING:
            v_depth = VerificationDepth.MINIMAL
            gates = ["typecheck", "browser_verify"]
            model_tier = "T1_CHEAP"
            token_budget = 4000
        elif task_type == TaskType.INVESTIGATION:
            v_depth = VerificationDepth.MINIMAL
            gates = ["static_analysis"]
            model_tier = "T2_STANDARD"
            token_budget = 6000
        elif task_type == TaskType.DB_MIGRATION:
            v_depth = VerificationDepth.MAXIMAL
            gates = ["schema_validation", "migration_test", "integration_test", "rollback_verification"]
            model_tier = "T4_CRITICAL"
            token_budget = 16000
            rollback_required = True
        elif task_type == TaskType.SECURITY_AUDIT:
            v_depth = VerificationDepth.EXTENDED
            gates = ["typecheck", "security_scan", "secret_audit", "adversarial_tests"]
            model_tier = "T3_COMPLEX"
            token_budget = 12000
        elif task_type == TaskType.INCIDENT_REMEDIATION:
            v_depth = VerificationDepth.MAXIMAL
            gates = ["telemetry_correlation", "reproduction_test", "unit_test", "integration_test", "rollback_verification"]
            model_tier = "T4_CRITICAL"
            token_budget = 20000
            rollback_required = True
        elif risk in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            v_depth = VerificationDepth.MAXIMAL
            gates = ["typecheck", "lint", "unit_test", "integration_test", "security_scan"]
            model_tier = "T3_COMPLEX"
            token_budget = 12000
        else:
            v_depth = VerificationDepth.STANDARD
            gates = ["typecheck", "lint", "unit_test"]
            model_tier = "T2_STANDARD"
            token_budget = 8000

        # 3. Tool & Agent Permissions
        allowed_tools = ["ripgrep", "knowledge_graph", "read_file"]
        if autonomy != AutonomyLevel.L0_READ:
            allowed_tools.extend(["write_file", "replace_content", "ast_edit", "run_test"])

        if task_type in [TaskType.CSS_STYLING, TaskType.FEATURE]:
            allowed_tools.append("browser_engine")
        if task_type in [TaskType.SECURITY_AUDIT, TaskType.BUG_FIX, TaskType.DB_MIGRATION]:
            allowed_tools.append("security_scanner")

        # Prohibit destructive tools in production unless explicitly approved
        if environment == Environment.PRODUCTION and approval == ApprovalRequirement.HUMAN_CONFIRMATION:
            allowed_tools = [t for t in allowed_tools if t not in ["drop_db", "force_push", "delete_secret"]]

        # 4. Candidate Agents
        agent_map = {
            TaskType.INVESTIGATION: ["repo_analyst", "architect"],
            TaskType.BUG_FIX: ["debugger", "backend_engineer", "frontend_engineer", "test_engineer"],
            TaskType.FEATURE: ["architect", "backend_engineer", "frontend_engineer", "test_engineer"],
            TaskType.REFACTOR: ["architect", "backend_engineer", "code_reviewer"],
            TaskType.SECURITY_AUDIT: ["security_engineer", "code_reviewer"],
            TaskType.DB_MIGRATION: ["database_engineer", "backend_engineer", "test_engineer"],
            TaskType.CSS_STYLING: ["frontend_engineer", "browser_engineer", "qa_engineer"],
            TaskType.INCIDENT_REMEDIATION: ["debugger", "backend_engineer", "devops_engineer", "escalation_manager"],
        }
        allowed_agents = agent_map.get(task_type, ["backend_engineer", "test_engineer"])

        rationale = f"Policy configured for {task_type.value} in {environment.value} with {risk.value} risk. Autonomy: {autonomy.value}, Gates: {len(gates)}."

        return PolicyEvaluationResult(
            autonomy_level=autonomy,
            allowed=True,
            approval_required=approval,
            verification_depth=v_depth,
            required_gates=gates,
            allowed_tools=allowed_tools,
            allowed_agents=allowed_agents,
            max_context_tokens=token_budget,
            model_tier=model_tier,
            rollback_snapshot_required=rollback_required,
            rationale=rationale,
            risk_level=risk,
        )
