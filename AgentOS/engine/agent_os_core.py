"""
Agent OS Core Types, Data Contracts, Enums, and Schemas.
Production-grade foundation for autonomous multi-agent orchestration.
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Dict, List, Optional, Any, Set
import json
import time

class AutonomyLevel(str, Enum):
    LEVEL_0_READ_ONLY = "L0_READ_ONLY"
    LEVEL_1_LOCAL_DEV = "L1_LOCAL_DEV"
    LEVEL_2_STAGING_PR = "L2_STAGING_PR"
    LEVEL_3_PRODUCTION = "L3_PRODUCTION"

class TaskStatus(str, Enum):
    PENDING = "PENDING"
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ESCALATED = "ESCALATED"
    BLOCKED = "BLOCKED"
    SKIPPED = "SKIPPED"

class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class ContextTier(str, Enum):
    L0_METADATA = "L0_METADATA"          # Repo metadata, language, frameworks
    L1_ARCHITECTURE = "L1_ARCHITECTURE"  # Subsystems, architecture map, modules
    L2_SUBSYSTEM = "L2_SUBSYSTEM"        # Specific affected module/directory
    L3_EXACT_CODE = "L3_EXACT_CODE"      # Exact functions, symbols, targeted files
    L4_HISTORY = "L4_HISTORY"            # Git diff, commit history, failure memory

class AgentRole(str, Enum):
    ARCHITECT = "architect"
    REPO_ANALYST = "repo_analyst"
    FRONTEND_ENGINEER = "frontend_engineer"
    BACKEND_ENGINEER = "backend_engineer"
    DATABASE_ENGINEER = "database_engineer"
    INTEGRATION_ENGINEER = "integration_engineer"
    DEVOPS_ENGINEER = "devops_engineer"
    QA_ENGINEER = "qa_engineer"
    BROWSER_ENGINEER = "browser_engineer"
    DEBUGGER = "debugger"
    SECURITY_ENGINEER = "security_engineer"
    PERFORMANCE_ENGINEER = "performance_engineer"
    CODE_REVIEWER = "code_reviewer"
    TEST_ENGINEER = "test_engineer"
    DOC_ENGINEER = "doc_engineer"

@dataclass
class AgentContractInput:
    task_id: str
    objective: str
    scope: List[str]
    constraints: List[str]
    relevant_files: List[str]
    relevant_symbols: List[str] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)
    acceptance_criteria: List[str] = field(default_factory=list)
    current_known_failures: List[str] = field(default_factory=list)
    required_tests: List[str] = field(default_factory=list)
    permissions: List[str] = field(default_factory=list)
    context_tier: ContextTier = ContextTier.L2_SUBSYSTEM
    autonomy_level: AutonomyLevel = AutonomyLevel.LEVEL_1_LOCAL_DEV
    token_budget: int = 15000

@dataclass
class AgentContractOutput:
    task_id: str
    agent_role: AgentRole
    status: TaskStatus
    files_changed: List[str] = field(default_factory=list)
    tests_executed: List[str] = field(default_factory=list)
    tests_passed: List[str] = field(default_factory=list)
    tests_failed: List[str] = field(default_factory=list)
    root_causes: List[str] = field(default_factory=list)
    remaining_risks: List[str] = field(default_factory=list)
    confidence: float = 1.0  # 0.0 to 1.0
    recommended_next_action: str = ""
    summary: str = ""
    tokens_consumed: int = 0
    duration_seconds: float = 0.0

@dataclass
class FailureMemoryItem:
    id: str
    symptom: str
    reproduction_steps: List[str]
    root_cause: str
    affected_subsystem: str
    fix_description: str
    files_touched: List[str]
    regression_test: str
    relevant_dependencies: List[str]
    lessons_learned: List[str]
    timestamp: float = field(default_factory=time.time)

@dataclass
class TaskNode:
    id: str
    title: str
    description: str
    agent_role: AgentRole
    dependencies: List[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING
    contract_input: Optional[AgentContractInput] = None
    contract_output: Optional[AgentContractOutput] = None
    retry_count: int = 0
    max_retries: int = 3
    error_message: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None

@dataclass
class MissionState:
    mission_id: str
    objective: str
    status: str  # ACTIVE, PAUSED, COMPLETED, FAILED, ESCALATED
    current_phase: str
    autonomy_level: AutonomyLevel
    token_budget: int
    tokens_consumed: int
    tasks: Dict[str, TaskNode] = field(default_factory=dict)
    completed_tasks: List[str] = field(default_factory=list)
    failed_tasks: List[str] = field(default_factory=list)
    repair_attempts: Dict[str, int] = field(default_factory=dict)
    verification_status: Dict[str, bool] = field(default_factory=dict)
    active_branches: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    escalation_reason: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["autonomy_level"] = self.autonomy_level.value
        for t_id, t_node in d["tasks"].items():
            t_node["agent_role"] = t_node["agent_role"]
            t_node["status"] = t_node["status"]
            if t_node.get("contract_input"):
                t_node["contract_input"]["context_tier"] = t_node["contract_input"]["context_tier"]
                t_node["contract_input"]["autonomy_level"] = t_node["contract_input"]["autonomy_level"]
            if t_node.get("contract_output"):
                t_node["contract_output"]["agent_role"] = t_node["contract_output"]["agent_role"]
                t_node["contract_output"]["status"] = t_node["contract_output"]["status"]
        return d

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MissionState':
        tasks_data = data.get("tasks", {})
        tasks = {}
        for t_id, t_dict in tasks_data.items():
            c_in = None
            if t_dict.get("contract_input"):
                ci_dict = t_dict["contract_input"]
                c_in = AgentContractInput(
                    task_id=ci_dict["task_id"],
                    objective=ci_dict["objective"],
                    scope=ci_dict["scope"],
                    constraints=ci_dict["constraints"],
                    relevant_files=ci_dict["relevant_files"],
                    relevant_symbols=ci_dict.get("relevant_symbols", []),
                    dependencies=ci_dict.get("dependencies", []),
                    acceptance_criteria=ci_dict.get("acceptance_criteria", []),
                    current_known_failures=ci_dict.get("current_known_failures", []),
                    required_tests=ci_dict.get("required_tests", []),
                    permissions=ci_dict.get("permissions", []),
                    context_tier=ContextTier(ci_dict.get("context_tier", ContextTier.L2_SUBSYSTEM.value)),
                    autonomy_level=AutonomyLevel(ci_dict.get("autonomy_level", AutonomyLevel.LEVEL_1_LOCAL_DEV.value)),
                    token_budget=ci_dict.get("token_budget", 15000)
                )
            c_out = None
            if t_dict.get("contract_output"):
                co_dict = t_dict["contract_output"]
                c_out = AgentContractOutput(
                    task_id=co_dict["task_id"],
                    agent_role=AgentRole(co_dict["agent_role"]),
                    status=TaskStatus(co_dict["status"]),
                    files_changed=co_dict.get("files_changed", []),
                    tests_executed=co_dict.get("tests_executed", []),
                    tests_passed=co_dict.get("tests_passed", []),
                    tests_failed=co_dict.get("tests_failed", []),
                    root_causes=co_dict.get("root_causes", []),
                    remaining_risks=co_dict.get("remaining_risks", []),
                    confidence=co_dict.get("confidence", 1.0),
                    recommended_next_action=co_dict.get("recommended_next_action", ""),
                    summary=co_dict.get("summary", ""),
                    tokens_consumed=co_dict.get("tokens_consumed", 0),
                    duration_seconds=co_dict.get("duration_seconds", 0.0)
                )
            node = TaskNode(
                id=t_dict["id"],
                title=t_dict["title"],
                description=t_dict["description"],
                agent_role=AgentRole(t_dict["agent_role"]),
                dependencies=t_dict.get("dependencies", []),
                status=TaskStatus(t_dict.get("status", TaskStatus.PENDING.value)),
                contract_input=c_in,
                contract_output=c_out,
                retry_count=t_dict.get("retry_count", 0),
                max_retries=t_dict.get("max_retries", 3),
                error_message=t_dict.get("error_message"),
                created_at=t_dict.get("created_at", time.time()),
                completed_at=t_dict.get("completed_at")
            )
            tasks[t_id] = node

        return cls(
            mission_id=data["mission_id"],
            objective=data["objective"],
            status=data["status"],
            current_phase=data["current_phase"],
            autonomy_level=AutonomyLevel(data.get("autonomy_level", AutonomyLevel.LEVEL_1_LOCAL_DEV.value)),
            token_budget=data.get("token_budget", 50000),
            tokens_consumed=data.get("tokens_consumed", 0),
            tasks=tasks,
            completed_tasks=data.get("completed_tasks", []),
            failed_tasks=data.get("failed_tasks", []),
            repair_attempts=data.get("repair_attempts", {}),
            verification_status=data.get("verification_status", {}),
            active_branches=data.get("active_branches", []),
            risks=data.get("risks", []),
            escalation_reason=data.get("escalation_reason"),
            created_at=data.get("created_at", time.time()),
            updated_at=data.get("updated_at", time.time())
        )
