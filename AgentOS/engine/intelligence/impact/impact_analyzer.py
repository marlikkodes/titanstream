"""
Deterministic Impact Analysis Engine.
Calculates direct and indirect dependencies, affected test suites,
and minimum verification depth prior to applying code edits.
"""

from typing import Dict, List, Set, Any, Optional
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph

class ImpactAnalyzer:
    def __init__(self, root_dir: str = "."):
        self.kg = KnowledgeGraph(root_dir)
        self.kg.build_graph()

    def analyze_impact(self, target_file: str) -> Dict[str, Any]:
        """Compute the blast radius of changes to target_file."""
        file_node_id = f"file:{target_file}"
        
        # 1. Direct dependencies
        direct_deps = self.kg.get_dependents(file_node_id)
        
        # 2. Transitive / indirect dependencies (2 degrees)
        indirect_deps = set()
        for d in direct_deps:
            for ind in self.kg.get_dependents(d):
                if ind != file_node_id and ind not in direct_deps:
                    indirect_deps.add(ind)

        # 3. Affected test suites
        affected_tests = []
        stem = target_file.split("/")[-1].split(".")[0]
        for node_id, node in self.kg.nodes.items():
            if node.get("type") in ["test_suite", "function"] and ("test" in node_id or "spec" in node_id):
                if stem in node_id or any(d in node_id for d in direct_deps):
                    affected_tests.append(node.get("file", node_id))

        # Deduplicate tests
        affected_tests = list(set(t for t in affected_tests if t))

        # 4. Recommended verification depth
        risk_level = "LOW"
        if len(direct_deps) > 5 or len(indirect_deps) > 10:
            risk_level = "HIGH"
        elif len(direct_deps) > 1:
            risk_level = "MEDIUM"

        return {
            "target_file": target_file,
            "risk_level": risk_level,
            "direct_dependent_count": len(direct_deps),
            "direct_dependents": [d.replace("file:", "") for d in direct_deps],
            "indirect_dependent_count": len(indirect_deps),
            "indirect_dependents": [i.replace("file:", "") for i in indirect_deps],
            "affected_tests": affected_tests,
            "recommended_verification_depth": "FULL_SUITE" if risk_level == "HIGH" else "TARGETED_TESTS"
        }
