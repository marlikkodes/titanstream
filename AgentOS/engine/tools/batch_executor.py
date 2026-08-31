"""
Tool Batching & Coalescing Executor.
Combines multiple independent code intelligence lookups into a single structured query.
"""

from typing import Dict, List, Any, Optional
from AgentOS.engine.intelligence.interface import CodeIntelligence
from AgentOS.engine.intelligence.impact.impact_analyzer import ImpactAnalyzer

class BatchToolExecutor:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = workspace_root
        self.code_intel = CodeIntelligence(workspace_root)
        self.impact_analyzer = ImpactAnalyzer(workspace_root)

    def execute_code_bundle_query(
        self,
        target_file: str,
        search_symbol: Optional[str] = None
    ) -> Dict[str, Any]:
        """Batches symbol extraction, impact blast radius, and pattern search in one call."""
        symbols = self.code_intel.symbols(target_file)
        impact = self.impact_analyzer.analyze_impact(target_file)
        searches = self.code_intel.search(search_symbol) if search_symbol else []

        return {
            "target_file": target_file,
            "symbols_count": len(symbols),
            "symbols": symbols,
            "impact": impact,
            "related_occurrences_count": len(searches),
            "batched_calls_saved": 3
        }
