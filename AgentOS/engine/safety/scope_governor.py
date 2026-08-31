"""
Scope Governor.
Guards against uncontrolled scope creep by classifying proposed file edits
and halting missions if unexpected blast radius expansion occurs.
"""

from enum import Enum
from typing import Dict, List, Set, Any, Optional
from pathlib import Path
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph

class ScopeClassification(str, Enum):
    IN_SCOPE = "IN_SCOPE"
    DEPENDENCY_REQUIRED = "DEPENDENCY_REQUIRED"
    INCIDENTAL = "INCIDENTAL"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"

class ScopeGovernor:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.kg = KnowledgeGraph(str(self.workspace_root))
        self.kg.build_graph()

    def audit_proposed_changes(
        self,
        planned_files: List[str],
        proposed_files: List[str],
        max_expansion_factor: float = 2.5
    ) -> Dict[str, Any]:
        planned_set = set(planned_files)
        classifications = {}
        out_of_scope_files = []

        # Find valid direct/indirect dependencies
        allowed_deps = set()
        for pf in planned_set:
            node_id = f"file:{pf}"
            allowed_deps.update(self.kg.get_dependents(node_id))
            allowed_deps.update(self.kg.get_dependencies(node_id))

        allowed_deps_cleaned = {d.replace("file:", "") for d in allowed_deps}

        for f in proposed_files:
            if f in planned_set:
                classifications[f] = ScopeClassification.IN_SCOPE
            elif f in allowed_deps_cleaned:
                classifications[f] = ScopeClassification.DEPENDENCY_REQUIRED
            elif any(f.endswith(ext) for ext in [".test.ts", ".spec.ts", "_test.py", ".md"]):
                classifications[f] = ScopeClassification.INCIDENTAL
            else:
                classifications[f] = ScopeClassification.OUT_OF_SCOPE
                out_of_scope_files.append(f)

        # Check for scope explosion
        is_explosion = len(proposed_files) > max(len(planned_files) * max_expansion_factor, 10)
        has_out_of_scope = len(out_of_scope_files) > 0

        action = "PROCEED"
        if is_explosion:
            action = "REPLAN_REQUIRED"
        elif has_out_of_scope:
            action = "WARN_AND_CONFIRM"

        return {
            "action": action,
            "is_explosion": is_explosion,
            "planned_count": len(planned_files),
            "proposed_count": len(proposed_files),
            "classifications": {k: v.value for k, v in classifications.items()},
            "out_of_scope_files": out_of_scope_files
        }
