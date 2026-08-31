"""
Model Performance Memory.
Tracks empirical success rate, repair counts, and token cost across model tiers
to optimize dynamic model routing.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional

class ModelPerformanceMemory:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.state_dir = self.workspace_root / ".agents" / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.perf_file = self.state_dir / "model_performance.json"
        self._ensure_file()

    def _ensure_file(self):
        if not self.perf_file.exists():
            with open(self.perf_file, "w", encoding="utf-8") as f:
                json.dump({}, f, indent=2)

    def record_outcome(self, model: str, task_tier: str, success: bool, cost_usd: float):
        with open(self.perf_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        key = f"{model}:{task_tier}"
        if key not in data:
            data[key] = {"runs": 0, "successes": 0, "total_cost": 0.0}

        data[key]["runs"] += 1
        if success:
            data[key]["successes"] += 1
        data[key]["total_cost"] += cost_usd

        with open(self.perf_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_success_rate(self, model: str, task_tier: str) -> float:
        with open(self.perf_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        key = f"{model}:{task_tier}"
        if key not in data or data[key]["runs"] == 0:
            return 0.95  # Baseline assumption
        return round(data[key]["successes"] / data[key]["runs"], 2)
