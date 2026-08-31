"""
Superengineering Score Engine.
Evaluates multi-dimensional performance across:
correctness, autonomy, speed, token efficiency, cost efficiency, reliability, and human interruption rate.
"""

from typing import Dict, List, Any, Optional

class SuperengineeringScore:
    def __init__(self):
        pass

    def calculate_mission_score(
        self,
        tests_passed: bool,
        repairs_count: int,
        human_interruptions: int,
        tokens_used: int,
        latency_seconds: float,
        scope_expanded: bool = False
    ) -> Dict[str, Any]:
        # Component weights:
        # Correctness: 35%
        # Autonomy (no human interruption): 25%
        # Repair efficiency: 15%
        # Token efficiency: 15%
        # Speed: 10%

        correctness_score = 100 if tests_passed else 0
        autonomy_score = max(100 - (human_interruptions * 40), 0)
        repair_score = max(100 - (repairs_count * 20), 20)
        token_score = max(100 - (tokens_used // 500), 20)
        speed_score = max(100 - int(latency_seconds * 2), 20)

        composite_score = (
            correctness_score * 0.35 +
            autonomy_score * 0.25 +
            repair_score * 0.15 +
            token_score * 0.15 +
            speed_score * 0.10
        )

        if scope_expanded:
            composite_score *= 0.85

        score = round(min(max(composite_score, 0), 100), 1)

        grade = "A+" if score >= 95 else "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "F"

        return {
            "superengineering_score": score,
            "grade": grade,
            "breakdown": {
                "correctness": correctness_score,
                "autonomy": autonomy_score,
                "repair_efficiency": repair_score,
                "token_efficiency": token_score,
                "speed": speed_score
            }
        }
