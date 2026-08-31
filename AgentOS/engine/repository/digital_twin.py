"""
Engineering Digital Twin & Hotspot Engine.
Maintains a dynamic model of codebase structure, dependencies, churn, failure hotspots,
and test coverage.
"""

import os
from pathlib import Path
from typing import Dict, List, Any, Optional
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph

class DigitalTwin:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.kg = KnowledgeGraph(str(self.workspace_root))
        self.kg.build_graph()

    def get_hotspot_score(self, file_path: str, churn_count: int = 5, failure_history: int = 1) -> Dict[str, Any]:
        node_id = f"file:{file_path}"
        dependents = self.kg.get_dependents(node_id)
        
        # Hotspot equation: (dependents * 3) + (churn * 2) + (failures * 5)
        raw_score = (len(dependents) * 3) + (churn_count * 2) + (failure_history * 5)
        normalized_score = min(max(raw_score, 0), 100)

        is_hotspot = normalized_score >= 40

        return {
            "file": file_path,
            "hotspot_score": normalized_score,
            "is_hotspot": is_hotspot,
            "direct_dependents": len(dependents),
            "churn_count": churn_count,
            "failure_history": failure_history,
            "recommended_treatment": "HIGH_TIER_MODEL_AND_DEEP_VERIFICATION" if is_hotspot else "STANDARD_PIPELINE"
        }
