"""
Context Cache Engine for Agent OS Phase II.
Provides file-hash-invalidated reusable context artifacts
(Architecture, Auth models, Database schemas, API maps, Security models)
to prevent token explosion across repetitive missions.
"""

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Dict, Any, Optional

class ContextCache:
    def __init__(self, cache_dir: str = ".agents/cache/context"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._memory_cache: Dict[str, Any] = {}

    def _compute_hash(self, file_paths: list) -> str:
        hasher = hashlib.sha256()
        for p in sorted(file_paths):
            path = Path(p)
            if path.exists() and path.is_file():
                hasher.update(path.read_bytes())
        return hasher.hexdigest()[:16]

    def get_or_compute(
        self,
        artifact_key: str,
        dependent_files: list,
        compute_fn: callable,
    ) -> Dict[str, Any]:
        """
        Returns cached summary artifact if dependent files are unchanged.
        Otherwise recomputes and updates cache.
        """
        current_hash = self._compute_hash(dependent_files)
        cache_file = self.cache_dir / f"{artifact_key}.json"

        if cache_file.exists():
            try:
                with open(cache_file, "r") as f:
                    cached = json.load(f)
                if cached.get("file_hash") == current_hash:
                    cached["from_cache"] = True
                    return cached
            except Exception:
                pass

        # Recompute
        computed_content = compute_fn()
        payload = {
            "artifact_key": artifact_key,
            "file_hash": current_hash,
            "computed_at": time.time(),
            "content": computed_content,
            "from_cache": False,
            "tokens_saved": max(500, len(str(computed_content)) // 4),
        }

        with open(cache_file, "w") as f:
            json.dump(payload, f, indent=2)

        return payload
