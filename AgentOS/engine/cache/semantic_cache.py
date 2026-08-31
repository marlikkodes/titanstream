"""
Dependency-Aware Semantic Cache.
Caches ASTs, symbols, semgrep scans, and test results with dependency invalidation.
"""

import time
from typing import Dict, List, Any, Optional
from pathlib import Path

class SemanticCache:
    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            entry = self.cache[key]
            return entry["data"]
        return None

    def set(self, key: str, data: Any, dependencies: Optional[List[str]] = None):
        self.cache[key] = {
            "data": data,
            "timestamp": time.time(),
            "dependencies": dependencies or []
        }

    def invalidate_file(self, changed_file: str):
        """Invalidates all cached entries dependent on changed_file."""
        keys_to_remove = []
        for k, entry in self.cache.items():
            if changed_file in entry["dependencies"] or changed_file in k:
                keys_to_remove.append(k)
        for k in keys_to_remove:
            del self.cache[k]
