"""
Persistent Failure Memory for Antigravity Superengineering OS.
Records, indexes, and retrieves past defects, root causes, fixes, regression tests,
and lessons learned so agents never repeatedly rediscover known engineering problems.
"""

import os
import json
import uuid
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from .agent_os_core import FailureMemoryItem

class FailureMemory:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.mem_dir = self.root_dir / ".agents" / "memory"
        self.mem_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.mem_dir / "failure_memory.json"
        self._ensure_db()

    def _ensure_db(self):
        if not self.db_path.exists():
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump([], f, indent=2)

    def _load_all(self) -> List[Dict[str, Any]]:
        try:
            with open(self.db_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []

    def _save_all(self, items: List[Dict[str, Any]]):
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2)

    def record_failure(
        self,
        symptom: str,
        reproduction_steps: List[str],
        root_cause: str,
        affected_subsystem: str,
        fix_description: str,
        files_touched: List[str],
        regression_test: str,
        relevant_dependencies: Optional[List[str]] = None,
        lessons_learned: Optional[List[str]] = None
    ) -> FailureMemoryItem:
        item = FailureMemoryItem(
            id=f"fail_{uuid.uuid4().hex[:8]}",
            symptom=symptom,
            reproduction_steps=reproduction_steps,
            root_cause=root_cause,
            affected_subsystem=affected_subsystem,
            fix_description=fix_description,
            files_touched=files_touched,
            regression_test=regression_test,
            relevant_dependencies=relevant_dependencies or [],
            lessons_learned=lessons_learned or [],
            timestamp=time.time()
        )
        data = self._load_all()
        data.append({
            "id": item.id,
            "symptom": item.symptom,
            "reproduction_steps": item.reproduction_steps,
            "root_cause": item.root_cause,
            "affected_subsystem": item.affected_subsystem,
            "fix_description": item.fix_description,
            "files_touched": item.files_touched,
            "regression_test": item.regression_test,
            "relevant_dependencies": item.relevant_dependencies,
            "lessons_learned": item.lessons_learned,
            "timestamp": item.timestamp
        })
        self._save_all(data)
        return item

    def search_failures(self, query: str, subsystem: Optional[str] = None, files: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """Search failure memory for matching symptoms, subsystems, or files."""
        all_items = self._load_all()
        results = []
        q_lower = query.lower() if query else ""

        for item in all_items:
            score = 0
            if q_lower:
                if q_lower in item["symptom"].lower():
                    score += 5
                if q_lower in item["root_cause"].lower():
                    score += 3
                if any(q_lower in l.lower() for l in item.get("lessons_learned", [])):
                    score += 2
            
            if subsystem and item.get("affected_subsystem") == subsystem:
                score += 3
                
            if files:
                for f in files:
                    if f in item.get("files_touched", []):
                        score += 4
                        break

            if score > 0 or (not q_lower and not subsystem and not files):
                results.append((score, item))

        results.sort(key=lambda x: x[0], reverse=True)
        return [r[1] for r in results]

    def get_by_id(self, item_id: str) -> Optional[Dict[str, Any]]:
        for item in self._load_all():
            if item.get("id") == item_id:
                return item
        return None