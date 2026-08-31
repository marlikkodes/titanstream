"""
Tool Selection Engine & Capability-Based Tool Router for Agent OS Phase II.
Routes engineering subtasks to the cheapest reliable tool combination based on capability fit.
"""

from typing import List, Dict, Any

class ToolRouter:
    def __init__(self):
        self.tool_matrix = {
            "SYMBOL_LOOKUP": ["knowledge_graph", "ripgrep"],
            "STRUCTURAL_REFACTOR": ["ast_edit", "knowledge_graph"],
            "SECURITY_AUDIT": ["security_scanner", "ast_edit"],
            "BROWSER_VERIFICATION": ["browser_engine"],
            "TEXT_SEARCH": ["ripgrep"],
            "COMPLEX_GRAPH_REASONING": ["knowledge_graph", "ast_edit"],
            "TEST_EXECUTION": ["run_test", "evidence_engine"],
            "ROLLBACK_RECOVERY": ["rollback_manager"],
        }

    def route_tools_for_capability(self, capability: str) -> List[str]:
        """Returns ordered tools matching capability."""
        return self.tool_matrix.get(capability.upper(), ["ripgrep", "knowledge_graph"])

    def get_cheapest_tool_combination(self, subtask_description: str) -> List[str]:
        """
        Determines minimal reliable tools for a task description.
        """
        lower = subtask_description.lower()
        if "security" in lower or "vulnerability" in lower:
            return ["security_scanner", "knowledge_graph"]
        elif "ast" in lower or "refactor" in lower or "rename" in lower:
            return ["ast_edit", "knowledge_graph"]
        elif "dom" in lower or "browser" in lower or "ui" in lower:
            return ["browser_engine"]
        elif "test" in lower or "verify" in lower:
            return ["run_test", "evidence_engine"]
        elif "find" in lower or "search" in lower:
            return ["ripgrep"]
        return ["knowledge_graph", "ripgrep"]
