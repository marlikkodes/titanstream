"""
Persistent Failure Memory 2.0 with Similarity Retrieval.
Stores failure signatures, root causes, attempted fixes, and regression tests.
Provides semantic and keyword similarity lookup for proactive defect prevention.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional

class FailureMemory:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.memory_dir = self.workspace_root / ".agents" / "memory"
        self.memory_dir.mkdir(parents=True, exist_ok=True)
        self.memory_file = self.memory_dir / "failure_memory.json"
        self._ensure_file()

    def _ensure_file(self):
        if not self.memory_file.exists():
            with open(self.memory_file, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)

    def record_defect(
        self,
        defect_id: str,
        symptom: str,
        root_cause: str,
        fix_applied: str,
        regression_test: str,
        domain: str = "general"
    ):
        with open(self.memory_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        data.append({
            "id": defect_id,
            "domain": domain,
            "symptom": symptom,
            "root_cause": root_cause,
            "fix_applied": fix_applied,
            "regression_test": regression_test
        })

        with open(self.memory_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def search_similar_defects(self, symptom_query: str) -> List[Dict[str, Any]]:
        with open(self.memory_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        q_words = set(symptom_query.lower().split())
        matches = []
        for entry in data:
            s_words = set(entry.get("symptom", "").lower().split())
            rc_words = set(entry.get("root_cause", "").lower().split())
            intersection = q_words.intersection(s_words.union(rc_words))
            if intersection:
                score = len(intersection)
                matches.append((score, entry))

        matches.sort(key=lambda x: x[0], reverse=True)
        return [m[1] for m in matches]
