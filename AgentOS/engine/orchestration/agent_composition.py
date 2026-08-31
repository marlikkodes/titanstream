"""
Agent Composition Engine for Agent OS Phase II.
Assembles dynamic, temporary agent teams tailored to specific engineering missions,
orchestrating handoffs and cleanly disbanding the team upon mission conclusion.
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

@dataclass
class AgentTeam:
    mission_id: str
    objective: str
    active_roles: List[str]
    lead_agent: str
    handoff_protocol: List[Dict[str, str]]
    status: str = "ACTIVE"

class DynamicAgentComposer:
    def __init__(self):
        self.active_teams: Dict[str, AgentTeam] = {}

    def compose_team_for_mission(self, mission_id: str, objective: str, likely_subsystems: List[str]) -> AgentTeam:
        """
        Dynamically selects minimal necessary agent roles to tackle objective.
        """
        roles = set()
        subsystems_str = " ".join(likely_subsystems).upper()

        if "AUTHENTICATION" in subsystems_str or "SECURITY" in subsystems_str:
            roles.update(["debugger", "backend_engineer", "security_engineer", "test_engineer"])
            lead = "debugger"
        elif "DATABASE" in subsystems_str or "PERSISTENCE" in subsystems_str:
            roles.update(["database_engineer", "backend_engineer", "test_engineer"])
            lead = "database_engineer"
        elif "FRONTEND" in subsystems_str or "PRESENTATION" in subsystems_str:
            roles.update(["frontend_engineer", "browser_engineer", "qa_engineer"])
            lead = "frontend_engineer"
        else:
            roles.update(["repo_analyst", "backend_engineer", "test_engineer"])
            lead = "repo_analyst"

        ordered_roles = [lead] + [r for r in roles if r != lead]

        # Build handoff protocol
        handoffs = []
        for i in range(len(ordered_roles) - 1):
            handoffs.append({
                "from": ordered_roles[i],
                "to": ordered_roles[i+1],
                "handoff_artifact": f"context_from_{ordered_roles[i]}.json"
            })

        team = AgentTeam(
            mission_id=mission_id,
            objective=objective,
            active_roles=ordered_roles,
            lead_agent=lead,
            handoff_protocol=handoffs,
            status="ACTIVE",
        )
        self.active_teams[mission_id] = team
        return team

    def disband_team(self, mission_id: str) -> bool:
        """Disbands temporary agent team and frees allocated resources."""
        if mission_id in self.active_teams:
            self.active_teams[mission_id].status = "DISBANDED"
            del self.active_teams[mission_id]
            return True
        return False
