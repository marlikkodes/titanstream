"""
Mission State & Interruption/Resume Manager.
Persists execution state after every task node, enabling seamless resumption
without repeating previously completed work.
"""

import os
import json
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Any
from engine.agent_os_core import MissionState, TaskNode, TaskStatus, AutonomyLevel

class MissionStateManager:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.state_dir = self.root_dir / ".agents" / "state"
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.current_mission_file = self.state_dir / "current_mission.json"

    def create_mission(
        self,
        objective: str,
        autonomy_level: AutonomyLevel = AutonomyLevel.LEVEL_1_LOCAL_DEV,
        token_budget: int = 50000
    ) -> MissionState:
        mission_id = f"mission_{int(time.time())}_{uuid.uuid4().hex[:6]}"
        state = MissionState(
            mission_id=mission_id,
            objective=objective,
            status="ACTIVE",
            current_phase="INITIALIZATION",
            autonomy_level=autonomy_level,
            token_budget=token_budget,
            tokens_consumed=0,
            tasks={},
            completed_tasks=[],
            failed_tasks=[],
            repair_attempts={},
            verification_status={},
            active_branches=[f"agent/{mission_id}"],
            risks=[]
        )
        self.save_mission(state)
        self.set_current_mission_id(mission_id)
        return state

    def save_mission(self, state: MissionState):
        state.updated_at = time.time()
        file_path = self.state_dir / f"{state.mission_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(state.to_dict(), f, indent=2)

    def load_mission(self, mission_id: str) -> Optional[MissionState]:
        file_path = self.state_dir / f"{mission_id}.json"
        if not file_path.exists():
            return None
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return MissionState.from_dict(data)

    def set_current_mission_id(self, mission_id: str):
        with open(self.current_mission_file, "w", encoding="utf-8") as f:
            json.dump({"current_mission_id": mission_id}, f, indent=2)

    def get_current_mission(self) -> Optional[MissionState]:
        if not self.current_mission_file.exists():
            return None
        try:
            with open(self.current_mission_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                mid = data.get("current_mission_id")
                if mid:
                    return self.load_mission(mid)
        except Exception:
            pass
        return None

    def checkpoint_task(self, mission_id: str, task_node: TaskNode):
        """Save incremental state after a single task node finishes."""
        state = self.load_mission(mission_id)
        if not state:
            return
        state.tasks[task_node.id] = task_node
        status_val = task_node.status.value if hasattr(task_node.status, 'value') else str(task_node.status)
        if status_val == "COMPLETED" and task_node.id not in state.completed_tasks:
            state.completed_tasks.append(task_node.id)
        elif status_val == "FAILED" and task_node.id not in state.failed_tasks:
            state.failed_tasks.append(task_node.id)

        if task_node.contract_output:
            state.tokens_consumed += task_node.contract_output.tokens_consumed

        self.save_mission(state)

    def resume_mission(self, mission_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Resume mission from last checkpoint, finding pending tasks."""
        state = self.load_mission(mission_id) if mission_id else self.get_current_mission()
        if not state:
            return None
        
        pending_tasks = []
        for t in state.tasks.values():
            s_val = t.status.value if hasattr(t.status, 'value') else str(t.status)
            if s_val in ["PENDING", "SCHEDULED", "RUNNING"]:
                pending_tasks.append(t)

        return {
            "mission_id": state.mission_id,
            "objective": state.objective,
            "total_tasks": len(state.tasks),
            "completed_count": len(state.completed_tasks),
            "pending_count": len(pending_tasks),
            "status": state.status,
            "current_phase": state.current_phase,
            "pending_task_ids": [t.id for t in pending_tasks]
        }
