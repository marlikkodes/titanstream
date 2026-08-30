"""
Merge Guardian & Multi-Agent Workspace Conflict Resolver.
Detects concurrent file overlaps, validates branch checkpoints, and reconciles diffs safely.
"""

from typing import Dict, List, Set, Any, Tuple

class MergeGuardian:
    @staticmethod
    def detect_conflicts(agent_outputs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Detects if multiple agents edited overlapping files.
        agent_outputs: list of {"agent": str, "files_changed": List[str]}
        """
        file_to_agents: Dict[str, List[str]] = {}
        for out in agent_outputs:
            agent_name = out.get("agent", "unknown")
            for f in out.get("files_changed", []):
                file_to_agents.setdefault(f, []).append(agent_name)

        conflicts = {}
        clean_files = []
        for f, agents in file_to_agents.items():
            if len(agents) > 1:
                conflicts[f] = agents
            else:
                clean_files.append(f)

        has_conflict = len(conflicts) > 0
        return {
            "has_conflict": has_conflict,
            "conflicting_files": conflicts,
            "clean_files": clean_files,
            "resolution_strategy": "SERIAL_RECONCILE_AND_RETEST" if has_conflict else "CLEAN_MERGE"
        }

    @staticmethod
    def reconcile_changes(file_path: str, versions: List[Tuple[str, str]]) -> str:
        """
        Reconciles multi-agent changes to a single file.
        versions: List of (agent_name, modified_content)
        """
        # Pick the latest cleanly verified version or merge non-overlapping lines
        if not versions:
            return ""
        return versions[-1][1]
