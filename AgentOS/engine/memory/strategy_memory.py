"""
Strategy Memory & Bandit-Style Strategy Optimizer for Agent OS Phase II.
Captures successful multi-step engineering strategies and uses Thompson Sampling / UCB
to select optimal strategies balancing success probability, cost, latency, and human intervention.
"""

import json
import os
import math
import time
from pathlib import Path
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional

@dataclass
class EngineeringStrategy:
    strategy_id: str
    task_type: str
    subsystem: str
    steps: List[str]               # e.g. ["repo_graph", "auth_subsystem", "patch_middleware", "integration_test"]
    agent_sequence: List[str]
    tool_sequence: List[str]
    model_tier: str
    success_count: int = 1
    failure_count: int = 0
    total_cost_usd: float = 0.02
    avg_duration_seconds: float = 4.5
    human_interventions: int = 0
    provenance_mission_id: str = "init"
    confidence_score: float = 0.95

class StrategyMemory:
    def __init__(self, storage_path: str = ".agents/memory/strategy_memory.json"):
        self.storage_path = Path(storage_path)
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        self.strategies: Dict[str, EngineeringStrategy] = {}
        self._load_or_seed()

    def _load_or_seed(self):
        if self.storage_path.exists():
            try:
                with open(self.storage_path, "r") as f:
                    data = json.load(f)
                    for k, v in data.items():
                        self.strategies[k] = EngineeringStrategy(**v)
                return
            except Exception:
                pass

        # Seed default golden strategies
        seeds = [
            EngineeringStrategy(
                strategy_id="strat_auth_jwt_regression",
                task_type="BUG_FIX",
                subsystem="AUTHENTICATION",
                steps=["knowledge_graph", "auth_subsystem_trace", "ast_edit", "unit_test", "security_scan"],
                agent_sequence=["debugger", "backend_engineer", "test_engineer"],
                tool_sequence=["knowledge_graph", "ast_edit", "run_test", "security_scanner"],
                model_tier="T3_COMPLEX",
                success_count=5,
                failure_count=0,
                total_cost_usd=0.015,
                avg_duration_seconds=3.2,
                human_interventions=0,
            ),
            EngineeringStrategy(
                strategy_id="strat_db_schema_migration",
                task_type="DB_MIGRATION",
                subsystem="DATA_PERSISTENCE",
                steps=["schema_diff", "migration_generator", "rollback_verifier", "integration_test"],
                agent_sequence=["database_engineer", "backend_engineer", "test_engineer"],
                tool_sequence=["knowledge_graph", "write_file", "run_test"],
                model_tier="T4_CRITICAL",
                success_count=4,
                failure_count=0,
                total_cost_usd=0.025,
                avg_duration_seconds=5.1,
                human_interventions=0,
            ),
            EngineeringStrategy(
                strategy_id="strat_css_responsive_layout",
                task_type="CSS_STYLING",
                subsystem="FRONTEND_PRESENTATION",
                steps=["dom_inspection", "style_patch", "browser_assertion"],
                agent_sequence=["frontend_engineer", "browser_engineer"],
                tool_sequence=["ripgrep", "replace_content", "browser_engine"],
                model_tier="T1_CHEAP",
                success_count=8,
                failure_count=0,
                total_cost_usd=0.004,
                avg_duration_seconds=1.8,
                human_interventions=0,
            )
        ]
        for s in seeds:
            self.strategies[s.strategy_id] = s
        self._save()

    def _save(self):
        with open(self.storage_path, "w") as f:
            json.dump({k: asdict(v) for k, v in self.strategies.items()}, f, indent=2)

    def record_strategy_outcome(
        self,
        strategy_id: str,
        success: bool,
        cost_usd: float,
        duration_sec: float,
        human_intervention: bool,
        provenance_mission_id: str,
    ):
        """
        Safely records strategy result with anti-poisoning validation.
        """
        # Anti-poisoning check: require non-empty mission ID
        if not provenance_mission_id or provenance_mission_id == "unverified":
            return

        if strategy_id in self.strategies:
            strat = self.strategies[strategy_id]
            if success:
                strat.success_count += 1
            else:
                strat.failure_count += 1
            strat.total_cost_usd = (strat.total_cost_usd + cost_usd) / 2.0
            strat.avg_duration_seconds = (strat.avg_duration_seconds + duration_sec) / 2.0
            if human_intervention:
                strat.human_interventions += 1
        self._save()

    def select_best_strategy_bandit(self, task_type: str, subsystem: str) -> Optional[EngineeringStrategy]:
        """
        Upper Confidence Bound (UCB) / Multi-Armed Bandit strategy selection.
        Score = SuccessRate / (Cost * Latency * (1 + HumanIntervention)) + ExplorationBonus
        """
        candidates = [s for s in self.strategies.values() if s.task_type == task_type or s.subsystem == subsystem]
        if not candidates:
            candidates = list(self.strategies.values())
        if not candidates:
            return None

        total_trials = sum(s.success_count + s.failure_count for s in candidates) or 1

        best_score = -1.0
        best_strat = None

        for s in candidates:
            trials = s.success_count + s.failure_count
            if trials == 0:
                return s # Unexplored arm
            success_prob = s.success_count / float(trials)
            cost_factor = max(0.001, s.total_cost_usd)
            latency_factor = max(0.5, s.avg_duration_seconds)
            penalty = 1.0 + (s.human_interventions * 0.5)
            
            # Exploitation value
            efficiency_score = success_prob / (cost_factor * latency_factor * penalty)
            # UCB Exploration bonus
            exploration_bonus = math.sqrt((2 * math.log(total_trials)) / trials)
            ucb_score = efficiency_score + (exploration_bonus * 5.0)

            if ucb_score > best_score:
                best_score = ucb_score
                best_strat = s

        return best_strat
