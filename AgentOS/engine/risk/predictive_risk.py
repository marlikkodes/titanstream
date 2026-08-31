"""
Predictive Risk Engine.
Calculates multidimensional risk score (0-100) and risk class based on blast radius,
historical churn, security sensitivity, database impact, destructive operations, and failure history.
"""

from enum import Enum
from typing import Dict, List, Any, Optional
from pathlib import Path
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph

class RiskClass(str, Enum):
    LOW = "LOW"             # 0-20
    MODERATE = "MODERATE"   # 21-40
    ELEVATED = "ELEVATED"   # 41-60
    HIGH = "HIGH"           # 61-80
    CRITICAL = "CRITICAL"   # 81-100

class PredictiveRiskEngine:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.kg = KnowledgeGraph(str(self.workspace_root))
        self.kg.build_graph()

    def evaluate_risk(
        self,
        target_files: List[str],
        objective: str,
        is_production: bool = False,
        historical_failure_count: int = 0
    ) -> Dict[str, Any]:
        score = 10  # Baseline
        failure_domains = []

        obj_lower = objective.lower()

        # 1. Target files count
        score += min(len(target_files) * 5, 25)

        # 2. Blast radius / Dependents
        total_dependents = 0
        for f in target_files:
            node_id = f"file:{f}"
            deps = self.kg.get_dependents(node_id)
            total_dependents += len(deps)
        score += min(total_dependents * 4, 25)

        # 3. Destructive operations (drop, delete, truncate, destroy)
        if any(k in obj_lower for k in ["drop", "truncate", "destroy", "rm -rf", "delete database", "drop table"]):
            score += 25
            failure_domains.append("data_loss")

        # 4. Security sensitivity
        if any(k in obj_lower for k in ["auth", "jwt", "secret", "token", "crypto", "permission", "password"]):
            score += 25
            failure_domains.append("security")

        # 5. Database impact
        if any(f.endswith((".sql", ".prisma")) or "migration" in f or "schema" in f for f in target_files) or "database" in obj_lower:
            score += 20
            failure_domains.append("database_integrity")

        # 6. Production sensitivity
        if is_production or "production" in obj_lower:
            score += 30
            failure_domains.append("production_availability")

        # 7. Historical failure multiplier
        score += min(historical_failure_count * 5, 20)

        # Clamp 0-100
        score = min(max(score, 0), 100)

        # Classify
        if score <= 20:
            r_class = RiskClass.LOW
            rec_verif = "TARGETED_UNIT_TESTS"
            rec_review = ["repo_analyst"]
        elif score <= 40:
            r_class = RiskClass.MODERATE
            rec_verif = "UNIT_AND_INTEGRATION_TESTS"
            rec_review = ["code_reviewer"]
        elif score <= 60:
            r_class = RiskClass.ELEVATED
            rec_verif = "FULL_INTEGRATION_AND_LINT"
            rec_review = ["code_reviewer", "test_engineer"]
        elif score <= 80:
            r_class = RiskClass.HIGH
            rec_verif = "FULL_TEST_SUITE_AND_SECURITY_SCAN"
            rec_review = ["architect", "security_engineer", "code_reviewer"]
        else:
            r_class = RiskClass.CRITICAL
            rec_verif = "EXHAUSTIVE_REGRESSION_SECURITY_AND_MANUAL_APPROVAL"
            rec_review = ["architect", "security_engineer", "escalation_manager"]

        return {
            "risk_score": score,
            "risk_class": r_class.value,
            "failure_domains": failure_domains,
            "recommended_verification": rec_verif,
            "recommended_agent_review": rec_review
        }
