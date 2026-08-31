import sys
import os

from .agent_os_core import (
    AutonomyLevel, TaskStatus, TaskPriority, ContextTier, AgentRole,
    AgentContractInput, AgentContractOutput, FailureMemoryItem, TaskNode, MissionState
)
from .repository.repo_graph import RepoIntelligence
from .context.tier_manager import ContextEconomy
from .memory.failure_memory import FailureMemory
from .routing.domain_detector import TaskGraphEngine
from .diagnostics.auto_debugger import AutoDebugger
from .verification.deterministic_gates import VerificationGateManager
from .mission.event_source import MissionEventStore
from .mission_state import MissionStateManager
from .economics.token_tracker import AgentObservability
from .agent_commander import AgentCommander
from .safety.policy_guard import SafetyGuard, TOOL_PROFILES, FORBIDDEN_COMMANDS
from .safety.hooks import HookEngine
from .orchestration.merge_guardian import MergeGuardian

# Phase II Subsystems
from .policy.policy_engine import EngineeringPolicyEngine, Environment, TaskType, RiskLevel, VerificationDepth, ApprovalRequirement, PolicyEvaluationResult
from .mission.mission_planner_v2 import MissionPlannerV2, MissionPlanV2, PlannedSubtask
from .intelligence.confidence.confidence_engine import ConfidenceEngine, ConfidenceReport
from .verification.test_selector import AutonomousTestSelector, SelectedTestPlan
from .mission.replay import MissionReplayEngine, MissionReplayLog, ReplayStep
from .memory.strategy_memory import StrategyMemory, EngineeringStrategy
from .context.context_cache import ContextCache
from .routing.tool_router import ToolRouter
from .routing.mcp_governor import MCPGovernor
from .orchestration.agent_composition import DynamicAgentComposer, AgentTeam
from .orchestration.staged_review import StagedReviewEngine, ReviewOutcome
from .intelligence.diff_analyzer import DiffAnalyzer, DiffAnalysisReport
from .intelligence.regression_predictor import RegressionPredictor, RegressionForecast
from .mission.incident_mode import IncidentModeEngine, IncidentReport
from .safety.environment_safety import EnvironmentSafetyGuard
from .safety.prompt_injection_defense import PromptInjectionDefense
from .safety.supply_chain import SupplyChainDefense, SupplyChainAuditResult
from .economics.engineering_score import EngineeringScoreCalculator, MissionEngineeringScore
from .diagnostics.learning_dashboard import LearningDashboard

__all__ = [
    'AutonomyLevel', 'TaskStatus', 'TaskPriority', 'ContextTier', 'AgentRole',
    'AgentContractInput', 'AgentContractOutput', 'FailureMemoryItem', 'TaskNode', 'MissionState',
    'RepoIntelligence', 'ContextEconomy', 'FailureMemory', 'TaskGraphEngine',
    'AutoDebugger', 'VerificationGateManager', 'MissionEventStore', 'MissionStateManager',
    'AgentObservability', 'AgentCommander', 'SafetyGuard', 'HookEngine', 'MergeGuardian',
    'TOOL_PROFILES', 'FORBIDDEN_COMMANDS',
    # Phase II Exports
    'EngineeringPolicyEngine', 'Environment', 'TaskType', 'RiskLevel', 'VerificationDepth', 'ApprovalRequirement', 'PolicyEvaluationResult',
    'MissionPlannerV2', 'MissionPlanV2', 'PlannedSubtask',
    'ConfidenceEngine', 'ConfidenceReport',
    'AutonomousTestSelector', 'SelectedTestPlan',
    'MissionReplayEngine', 'MissionReplayLog', 'ReplayStep',
    'StrategyMemory', 'EngineeringStrategy',
    'ContextCache',
    'ToolRouter',
    'MCPGovernor',
    'DynamicAgentComposer', 'AgentTeam',
    'StagedReviewEngine', 'ReviewOutcome',
    'DiffAnalyzer', 'DiffAnalysisReport',
    'RegressionPredictor', 'RegressionForecast',
    'IncidentModeEngine', 'IncidentReport',
    'EnvironmentSafetyGuard',
    'PromptInjectionDefense',
    'SupplyChainDefense', 'SupplyChainAuditResult',
    'EngineeringScoreCalculator', 'MissionEngineeringScore',
    'LearningDashboard',
]
