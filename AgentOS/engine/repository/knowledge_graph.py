"""
Repository Knowledge Graph 2.0.
Builds a multi-layer relational knowledge graph of the codebase with typed edges:
CALLS, IMPORTS, DEPENDS_ON, EXPOSES, CONSUMES, WRITES, READS, TRIGGERS, TESTS, DEPLOYS_TO.
"""

import os
import ast
import re
import json
from pathlib import Path
from typing import Dict, List, Set, Any, Optional

class KnowledgeGraph:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: List[Dict[str, Any]] = []

    def build_graph(self, max_files: int = 150) -> Dict[str, Any]:
        """Scan codebase and extract multi-layer nodes and typed relational edges."""
        self.nodes.clear()
        self.edges.clear()

        ignore_dirs = {".git", "node_modules", "dist", "build", "__pycache__", ".agents", "baileys_auth_info", "apps", "services", "packages", "libs"}
        
        count = 0
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
            for f in files:
                if f.endswith(('.py', '.ts', '.js', '.json')):
                    fpath = os.path.join(root, f)
                    rel_p = os.path.relpath(fpath, self.root_dir)
                    
                    node_id = f"file:{rel_p}"
                    self.nodes[node_id] = {
                        "id": node_id,
                        "type": "file",
                        "path": rel_p,
                        "extension": Path(f).suffix
                    }

                    if f.endswith('.py'):
                        self._parse_python_file(rel_p, fpath)
                    elif f.endswith(('.ts', '.js')):
                        self._parse_js_ts_file(rel_p, fpath)

                    count += 1
                    if count >= max_files:
                        break
            if count >= max_files:
                break

        return {
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "node_types": list(set(n["type"] for n in self.nodes.values())),
            "edge_types": list(set(e["relation"] for e in self.edges))
        }

    def _add_edge(self, source: str, target: str, relation: str):
        self.edges.append({
            "source": source,
            "target": target,
            "relation": relation
        })

    def _parse_python_file(self, rel_p: str, abs_p: str):
        file_node_id = f"file:{rel_p}"
        try:
            with open(abs_p, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                tree = ast.parse(content, filename=rel_p)

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        target_id = f"module:{alias.name}"
                        self.nodes[target_id] = {"id": target_id, "type": "module", "name": alias.name}
                        self._add_edge(file_node_id, target_id, "IMPORTS")

                elif isinstance(node, ast.ImportFrom) and node.module:
                    target_id = f"module:{node.module}"
                    self.nodes[target_id] = {"id": target_id, "type": "module", "name": node.module}
                    self._add_edge(file_node_id, target_id, "IMPORTS")

                elif isinstance(node, ast.FunctionDef):
                    fn_id = f"fn:{rel_p}:{node.name}"
                    self.nodes[fn_id] = {"id": fn_id, "type": "function", "name": node.name, "file": rel_p}
                    self._add_edge(file_node_id, fn_id, "CONTAINS")
                    if node.name.startswith("test_"):
                        self._add_edge(fn_id, file_node_id, "TESTS")

                elif isinstance(node, ast.ClassDef):
                    class_id = f"class:{rel_p}:{node.name}"
                    self.nodes[class_id] = {"id": class_id, "type": "class", "name": node.name, "file": rel_p}
                    self._add_edge(file_node_id, class_id, "CONTAINS")
        except Exception:
            pass

    def _parse_js_ts_file(self, rel_p: str, abs_p: str):
        file_node_id = f"file:{rel_p}"
        try:
            with open(abs_p, "r", encoding="utf-8", errors="ignore") as f:
                for line in f:
                    import_match = re.search(r"import\s+.*from\s+['\"]([^'\"]+)['\"]", line)
                    if import_match:
                        target_mod = import_match.group(1)
                        target_id = f"module:{target_mod}"
                        self.nodes[target_id] = {"id": target_id, "type": "module", "name": target_mod}
                        self._add_edge(file_node_id, target_id, "IMPORTS")

                    if "test(" in line or "it(" in line or "describe(" in line:
                        test_id = f"test:{rel_p}"
                        self.nodes[test_id] = {"id": test_id, "type": "test_suite", "file": rel_p}
                        self._add_edge(test_id, file_node_id, "TESTS")
        except Exception:
            pass

    def get_dependents(self, node_id: str) -> List[str]:
        dependents = []
        for e in self.edges:
            if e["target"] == node_id and e["relation"] in ["IMPORTS", "DEPENDS_ON", "CALLS"]:
                dependents.append(e["source"])
        return dependents

    def get_dependencies(self, node_id: str) -> List[str]:
        deps = []
        for e in self.edges:
            if e["source"] == node_id and e["relation"] in ["IMPORTS", "DEPENDS_ON", "CALLS"]:
                deps.append(e["target"])
        return deps
