"""
Economic Telemetry & Cost Engine.
Tracks prompt tokens, completion tokens, cached tokens, tool calls,
monetary cost, and human minutes saved per mission.
"""

import json
import time
from pathlib import Path
from typing import Dict, List, Any, Optional

class EconomicTelemetry:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.state_dir = self.workspace_root / ".agents" / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.telemetry_file = self.state_dir / "economic_telemetry.json"
        self._ensure_file()

    def _ensure_file(self):
        if not self.telemetry_file.exists():
            with open(self.telemetry_file, "w", encoding="utf-8") as f:
                json.dump({
                    "total_missions": 0,
                    "total_prompt_tokens": 0,
                    "total_completion_tokens": 0,
                    "total_cached_tokens": 0,
                    "total_cost_usd": 0.0,
                    "total_human_minutes_saved": 0.0,
                    "records": []
                }, f, indent=2)

    def record_mission_economics(
        self,
        mission_id: str,
        prompt_tokens: int,
        completion_tokens: int,
        cached_tokens: int = 0,
        tool_calls: int = 0,
        repairs: int = 0,
        success: bool = True
    ):
        # Estimated cost model ($0.0005 per 1k prompt, $0.0015 per 1k completion)
        cost = (prompt_tokens * 0.0005 + completion_tokens * 0.0015) / 1000.0
        # Estimated human time: 10 minutes per standard task + 15 min per repair
        minutes_saved = (tool_calls * 3.0 + repairs * 15.0) if success else 0.0

        with open(self.telemetry_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["total_missions"] += 1
        data["total_prompt_tokens"] += prompt_tokens
        data["total_completion_tokens"] += completion_tokens
        data["total_cached_tokens"] += cached_tokens
        data["total_cost_usd"] = round(data["total_cost_usd"] + cost, 4)
        data["total_human_minutes_saved"] = round(data["total_human_minutes_saved"] + minutes_saved, 1)

        data["records"].append({
            "mission_id": mission_id,
            "timestamp": time.time(),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cost_usd": round(cost, 4),
            "human_minutes_saved": minutes_saved,
            "success": success
        })

        with open(self.telemetry_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_summary(self) -> Dict[str, Any]:
        with open(self.telemetry_file, "r", encoding="utf-8") as f:
            return json.load(f)
