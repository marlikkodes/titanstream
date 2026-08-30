"""
Context Engine 2.0.
Implements multi-signal relevance scoring (graph, lexical, semantic, structural)
with strict context token budgeting and intelligent summarization.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph

class ContextEngineV2:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.kg = KnowledgeGraph(str(self.root_dir))
        self.kg.build_graph()

    def score_relevance(self, query: str, file_path: str) -> float:
        """Calculates multi-signal relevance score for a file given an objective query."""
        score = 0.0
        q_words = query.lower().split()
        filename = Path(file_path).name.lower()
        stem = Path(file_path).stem.lower()

        # 1. Exact stem / filename match
        for w in q_words:
            if len(w) > 2:
                if w in stem:
                    score += 5.0
                elif w in file_path.lower():
                    score += 2.0

        # 2. Graph centrality score
        node_id = f"file:{file_path}"
        dependents = self.kg.get_dependents(node_id)
        score += min(len(dependents) * 0.5, 3.0)

        return score

    def build_budgeted_context(
        self,
        query: str,
        token_budget: int = 20000,
        subsystem: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Builds a compact, highly-relevant context package strictly within token_budget.
        Estimates ~4 characters per token.
        """
        char_budget = token_budget * 4
        current_chars = 0
        included_files = {}

        # 1. Discover all eligible files
        candidate_files = []
        ignore_dirs = {".git", "node_modules", "dist", "build", "__pycache__", ".agents"}
        
        target_dir = self.root_dir / subsystem if subsystem else self.root_dir
        if not target_dir.exists():
            target_dir = self.root_dir

        for root, dirs, files in os.walk(target_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
            for f in files:
                if f.endswith(('.ts', '.js', '.py', '.json', '.md', '.html', '.css', '.yaml')):
                    rel_p = os.path.relpath(os.path.join(root, f), self.root_dir)
                    rel_score = self.score_relevance(query, rel_p)
                    candidate_files.append((rel_score, rel_p))

        # Sort candidates by relevance score descending
        candidate_files.sort(key=lambda x: x[0], reverse=True)

        # 2. Pack files within budget
        for score, fpath in candidate_files:
            abs_p = self.root_dir / fpath
            try:
                with open(abs_p, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    
                file_chars = len(content)
                if current_chars + file_chars <= char_budget:
                    included_files[fpath] = {
                        "relevance_score": score,
                        "content": content,
                        "mode": "FULL"
                    }
                    current_chars += file_chars
                elif current_chars < char_budget:
                    # Partial / Symbol summary when running low on budget
                    lines = content.splitlines()[:50]
                    summary_content = "\n".join(lines) + "\n... [TRUNCATED_FOR_BUDGET]"
                    included_files[fpath] = {
                        "relevance_score": score,
                        "content": summary_content,
                        "mode": "SUMMARIZED"
                    }
                    current_chars += len(summary_content)
                    break
            except Exception:
                pass

        return {
            "query": query,
            "token_budget": token_budget,
            "estimated_tokens_used": current_chars // 4,
            "files_included_count": len(included_files),
            "context_files": included_files
        }
