"""
Complexity-Based Model Router and Provider Gateway.
Maps task complexity (T0-T4) to the optimal model tier, optimizing for correctness,
cost, and latency with automated provider fallback chains.
"""

from enum import Enum
from typing import Dict, List, Any, Optional

class ComplexityTier(str, Enum):
    T0_DETERMINISTIC = "T0_DETERMINISTIC"  # Format, lint, AST check, ripgrep -> 0 LLM cost
    T1_LOW_COST = "T1_LOW_COST"            # Discovery, log compression, summary -> Flash-lite
    T2_STANDARD = "T2_STANDARD"            # Normal feature coding, unit tests -> Flash
    T3_COMPLEX = "T3_COMPLEX"              # Tricky debugging, cross-system -> Pro
    T4_CRITICAL = "T4_CRITICAL"            # Architecture, security, migrations -> Strongest + Review

class ModelRouter:
    def __init__(self):
        self.tier_models = {
            ComplexityTier.T0_DETERMINISTIC: {"provider": "local_tool", "model": "none", "cost_per_1k": 0.0},
            ComplexityTier.T1_LOW_COST: {"provider": "gemini", "model": "gemini-2.5-flash-lite", "cost_per_1k": 0.0001},
            ComplexityTier.T2_STANDARD: {"provider": "gemini", "model": "gemini-2.5-flash", "cost_per_1k": 0.0005},
            ComplexityTier.T3_COMPLEX: {"provider": "gemini", "model": "gemini-2.5-pro", "cost_per_1k": 0.003},
            ComplexityTier.T4_CRITICAL: {"provider": "gemini", "model": "gemini-2.5-pro-extended", "cost_per_1k": 0.005}
        }
        self.fallbacks = {
            "gemini-2.5-pro-extended": ["gemini-2.5-pro", "gemini-2.5-flash", "local_deterministic"],
            "gemini-2.5-pro": ["gemini-2.5-flash", "gemini-1.5-pro", "local_deterministic"],
            "gemini-2.5-flash": ["gemini-2.5-flash-lite", "local_deterministic"]
        }

    def classify_task_complexity(self, task_title: str, task_scope: List[str]) -> ComplexityTier:
        title_lower = task_title.lower()
        scope_str = " ".join(task_scope).lower()

        # T0: Pure formatting / typecheck
        if any(k in title_lower for k in ["format", "lint", "syntax check", "compile check"]):
            return ComplexityTier.T0_DETERMINISTIC

        # T4: Critical security / architecture / production migration
        if any(k in title_lower or k in scope_str for k in ["security", "vulnerability", "auth bypass", "schema destruction", "architecture", "critical"]):
            return ComplexityTier.T4_CRITICAL

        # T3: Complex debugging / cross-system integration / database migration
        if any(k in title_lower or k in scope_str for k in ["cross-system", "migration", "race condition", "memory leak", "deadlock", "investigate"]):
            return ComplexityTier.T3_COMPLEX

        # T1: Discovery / log compression / documentation
        if any(k in title_lower or k in scope_str for k in ["discover", "summarize", "docstring", "compress log", "map symbols"]):
            return ComplexityTier.T1_LOW_COST

        # T2: Standard engineering
        return ComplexityTier.T2_STANDARD

    def route(self, task_title: str, task_scope: List[str]) -> Dict[str, Any]:
        tier = self.classify_task_complexity(task_title, task_scope)
        config = self.tier_models[tier]
        primary_model = config["model"]
        return {
            "tier": tier.value,
            "provider": config["provider"],
            "model": primary_model,
            "fallbacks": self.fallbacks.get(primary_model, ["local_deterministic"]),
            "cost_per_1k": config["cost_per_1k"],
            "requires_extra_verification": tier == ComplexityTier.T4_CRITICAL
        }
