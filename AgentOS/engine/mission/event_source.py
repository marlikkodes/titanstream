"""
Event-Sourced Mission Engine for Antigravity Agent OS.
Maintains an immutable event log (events.jsonl), checkpoints, evidence directory,
and state reconstruction from raw events.
"""

import os
import json
import time
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional

EVENT_TYPES = [
    "MISSION_CREATED",
    "TASK_CREATED",
    "AGENT_STARTED",
    "AGENT_COMPLETED",
    "TOOL_FAILED",
    "REPAIR_STARTED",
    "REPAIR_COMPLETED",
    "TEST_PASSED",
    "TEST_FAILED",
    "HUMAN_ESCALATED",
    "MISSION_COMPLETED"
]

class MissionEventStore:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.missions_dir = self.workspace_root / ".agents" / "missions"
        self.missions_dir.mkdir(parents=True, exist_ok=True)

    def get_mission_dir(self, mission_id: str) -> Path:
        m_dir = self.missions_dir / mission_id
        m_dir.mkdir(parents=True, exist_ok=True)
        (m_dir / "evidence").mkdir(exist_ok=True)
        return m_dir

    def create_mission(self, objective: str, autonomy_level: str = "L1_LOCAL_DEV", token_budget: int = 50000) -> Dict[str, Any]:
        timestamp_str = time.strftime("%Y-%m-%d")
        unique_suffix = uuid.uuid4().hex[:6]
        safe_name = "-".join(objective.lower().split()[:4])
        safe_name = "".join(c for c in safe_name if c.isalnum() or c == "-")
        mission_id = f"{timestamp_str}-{safe_name}-{unique_suffix}"
        
        m_dir = self.get_mission_dir(mission_id)
        
        meta = {
            "mission_id": mission_id,
            "objective": objective,
            "autonomy_level": autonomy_level,
            "token_budget": token_budget,
            "status": "INITIALIZED",
            "created_at": time.time()
        }
        
        with open(m_dir / "mission.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        self.append_event(mission_id, "MISSION_CREATED", {
            "objective": objective,
            "autonomy_level": autonomy_level,
            "token_budget": token_budget
        })

        return meta

    def append_event(self, mission_id: str, event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        m_dir = self.get_mission_dir(mission_id)
        events_file = m_dir / "events.jsonl"
        
        event = {
            "event_id": f"evt_{uuid.uuid4().hex[:8]}",
            "mission_id": mission_id,
            "type": event_type,
            "timestamp": time.time(),
            "payload": payload
        }
        
        with open(events_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")
            
        self._update_checkpoint(mission_id)
        return event

    def load_events(self, mission_id: str) -> List[Dict[str, Any]]:
        m_dir = self.get_mission_dir(mission_id)
        events_file = m_dir / "events.jsonl"
        if not events_file.exists():
            return []
        events = []
        with open(events_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    events.append(json.loads(line.strip()))
        return events

    def reconstruct_state(self, mission_id: str) -> Dict[str, Any]:
        """Reconstruct the entire mission state by replaying its event stream."""
        events = self.load_events(mission_id)
        state = {
            "mission_id": mission_id,
            "objective": "",
            "status": "UNKNOWN",
            "tasks": {},
            "completed_tasks": [],
            "failed_tasks": [],
            "repair_attempts": 0,
            "test_results": {},
            "escalated": False,
            "escalation_reason": None,
            "tokens_consumed": 0,
            "created_at": None,
            "completed_at": None
        }

        for ev in events:
            etype = ev.get("type")
            payload = ev.get("payload", {})
            ts = ev.get("timestamp")

            if etype == "MISSION_CREATED":
                state["objective"] = payload.get("objective", "")
                state["status"] = "ACTIVE"
                state["created_at"] = ts

            elif etype == "TASK_CREATED":
                t_id = payload.get("task_id")
                if t_id:
                    state["tasks"][t_id] = {
                        "id": t_id,
                        "title": payload.get("title", ""),
                        "role": payload.get("role", ""),
                        "status": "PENDING",
                        "dependencies": payload.get("dependencies", [])
                    }

            elif etype == "AGENT_STARTED":
                t_id = payload.get("task_id")
                if t_id and t_id in state["tasks"]:
                    state["tasks"][t_id]["status"] = "RUNNING"

            elif etype == "AGENT_COMPLETED":
                t_id = payload.get("task_id")
                if t_id and t_id in state["tasks"]:
                    state["tasks"][t_id]["status"] = "COMPLETED"
                    state["tasks"][t_id]["output"] = payload.get("output")
                    if t_id not in state["completed_tasks"]:
                        state["completed_tasks"].append(t_id)
                state["tokens_consumed"] += payload.get("tokens", 0)

            elif etype == "TOOL_FAILED":
                t_id = payload.get("task_id")
                if t_id and t_id in state["tasks"]:
                    state["tasks"][t_id]["status"] = "TOOL_FAILED"

            elif etype == "REPAIR_STARTED":
                state["repair_attempts"] += 1

            elif etype == "REPAIR_COMPLETED":
                pass

            elif etype == "TEST_PASSED":
                test_name = payload.get("test_name", "test")
                state["test_results"][test_name] = True

            elif etype == "TEST_FAILED":
                test_name = payload.get("test_name", "test")
                state["test_results"][test_name] = False

            elif etype == "HUMAN_ESCALATED":
                state["escalated"] = True
                state["status"] = "ESCALATED"
                state["escalation_reason"] = payload.get("reason")

            elif etype == "MISSION_COMPLETED":
                state["status"] = "COMPLETED"
                state["completed_at"] = ts

        return state

    def _update_checkpoint(self, mission_id: str):
        state = self.reconstruct_state(mission_id)
        m_dir = self.get_mission_dir(mission_id)
        with open(m_dir / "checkpoint.json", "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
