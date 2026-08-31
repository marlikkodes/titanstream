"""
Engineering Score Engine for Agent OS Phase II.
Computes multi-dimensional performance and efficiency metrics for every mission.
"""

from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class MissionEngineeringScore:
    correctness: float         # 0 - 100
    autonomy: float            # 0 - 100
    speed: float               # 0 - 100
    token_efficiency: float    # 0 - 100
    cost_efficiency: float     # 0 - 100
    safety: float              # 0 - 100
    verification: float        # 0 - 100
    human_interaction: float   # 0 - 100
    total_composite: float     # 0 - 100

class EngineeringScoreCalculator:
    def __init__(self):
        pass

    def compute_score(
        self,
        tests_passed: bool = True,
        auto_repaired_steps: int = 0,
        duration_seconds: float = 3.5,
        tokens_consumed: int = 12000,
        cost_usd: float = 0.018,
        safety_violations: int = 0,
        evidence_present: bool = True,
        human_prompts_required: int = 0,
    ) -> MissionEngineeringScore:
        """
        Calculates normalized scores across all 8 dimensions.
        """
        corr = 100.0 if tests_passed else 0.0
        
        # Autonomy: penalize excessive manual escalations
        auto = max(0.0, 100.0 - (human_prompts_required * 25.0) - (auto_repaired_steps * 5.0))
        
        # Speed: baseline 5.0s
        speed = max(0.0, min(100.0, 100.0 - ((duration_seconds - 2.0) * 10.0)))
        
        # Token efficiency: baseline 15,000 tokens
        tok = max(0.0, min(100.0, 100.0 - ((tokens_consumed - 5000) / 200.0)))
        
        # Cost efficiency: baseline $0.05
        cost = max(0.0, min(100.0, 100.0 - ((cost_usd - 0.01) * 1000.0)))
        
        # Safety: 0 violations = 100
        safe = 100.0 if safety_violations == 0 else 0.0
        
        # Verification: evidence artifact present
        verif = 100.0 if evidence_present else 0.0
        
        # Human interaction: 0 prompts = 100
        hi = max(0.0, 100.0 - (human_prompts_required * 30.0))

        # Weighted Composite
        composite = (
            corr * 0.25 +
            auto * 0.15 +
            speed * 0.10 +
            tok * 0.10 +
            cost * 0.10 +
            safe * 0.15 +
            verif * 0.10 +
            hi * 0.05
        )

        return MissionEngineeringScore(
            correctness=round(corr, 1),
            autonomy=round(auto, 1),
            speed=round(speed, 1),
            token_efficiency=round(tok, 1),
            cost_efficiency=round(cost, 1),
            safety=round(safe, 1),
            verification=round(verif, 1),
            human_interaction=round(hi, 1),
            total_composite=round(composite, 1),
        )
