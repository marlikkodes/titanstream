"""
Mission Learning & DAG Optimization.
Compares planned DAG vs actual executed tasks to eliminate orchestration waste.
"""

from typing import Dict, List, Any, Optional

class MissionLearningEngine:
    def __init__(self):
        pass

    def evaluate_mission_execution(
        self,
        planned_tasks: List[str],
        executed_tasks: List[str],
        retries_count: int,
        context_tokens: int
    ) -> Dict[str, Any]:
        unnecessary = [t for t in planned_tasks if t not in executed_tasks]
        unexpected = [t for t in executed_tasks if t not in planned_tasks]

        efficiency_ratio = len(executed_tasks) / max(len(planned_tasks) + retries_count, 1)

        recommendations = []
        if retries_count > 1:
            recommendations.append("Increase initial context depth for domain to reduce repair retries.")
        if unnecessary:
            recommendations.append(f"Trim planned tasks: {unnecessary} in future similar missions.")

        return {
            "planned_count": len(planned_tasks),
            "executed_count": len(executed_tasks),
            "retries_count": retries_count,
            "unnecessary_tasks": unnecessary,
            "unexpected_tasks": unexpected,
            "efficiency_ratio": round(efficiency_ratio, 2),
            "orchestration_recommendations": recommendations
        }
