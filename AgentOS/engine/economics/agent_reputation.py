"""
Agent Performance & Reputation Memory.
Tracks empirical success rates, repair frequencies, regressions, token efficiency,
and domain mastery for each specialized agent.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional

class AgentReputationEngine:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.state_dir = self.workspace_root / ".agents" / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.reputation_file = self.state_dir / "agent_reputation.json"
        self._ensure_file()

    def _ensure_file(self):
        if not self.reputation_file.exists():
            with open(self.reputation_file, "w", encoding="utf-8") as f:
                json.dump({}, f, indent=2)

    def record_agent_task(
        self,
        agent_role: str,
        domain: str,
        first_pass_success: bool,
        repairs_needed: int,
        tokens_used: int,
        latency_seconds: float,
        regression_caused: bool = False
    ):
        with open(self.reputation_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        if agent_role not in data:
            data[agent_role] = {
                "tasks_assigned": 0,
                "first_pass_successes": 0,
                "total_repairs": 0,
                "regressions_caused": 0,
                "total_tokens": 0,
                "total_latency": 0.0,
                "domain_scores": {}
            }

        rec = data[agent_role]
        rec["tasks_assigned"] += 1
        if first_pass_success:
            rec["first_pass_successes"] += 1
        rec["total_repairs"] += repairs_needed
        if regression_caused:
            rec["regressions_caused"] += 1
        rec["total_tokens"] += tokens_used
        rec["total_latency"] += latency_seconds

        if domain not in rec["domain_scores"]:
            rec["domain_scores"][domain] = {"successes": 0, "total": 0}
        rec["domain_scores"][domain]["total"] += 1
        if first_pass_success and not regression_caused:
            rec["domain_scores"][domain]["successes"] += 1

        with open(self.reputation_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def get_agent_score(self, agent_role: str, domain: Optional[str] = None) -> float:
        """Returns 0.0 - 1.0 reputation score based on past track record."""
        with open(self.reputation_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        if agent_role not in data or data[agent_role]["tasks_assigned"] == 0:
            return 0.8  # Default initial prior

        rec = data[agent_role]
        fps_rate = rec["first_pass_successes"] / rec["tasks_assigned"]
        reg_rate = rec["regressions_caused"] / rec["tasks_assigned"]
        
        score = (fps_rate * 0.7) - (reg_rate * 0.5) + 0.3
        
        if domain and domain in rec["domain_scores"] and rec["domain_scores"][domain]["total"] > 0:
            d_rate = rec["domain_scores"][domain]["successes"] / rec["domain_scores"][domain]["total"]
            score = (score * 0.5) + (d_rate * 0.5)

        return round(min(max(score, 0.1), 1.0), 2)
