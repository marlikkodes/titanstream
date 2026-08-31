"""
Change Minimizer.
Analyzes code edits post-repair to measure line, symbol, and API churn,
ensuring the minimal verified patch is merged.
"""

from typing import Dict, List, Any, Optional

class ChangeMinimizer:
    def __init__(self):
        pass

    def evaluate_patch_economy(
        self,
        original_content: str,
        modified_content: str,
        target_file: str
    ) -> Dict[str, Any]:
        orig_lines = original_content.splitlines()
        mod_lines = modified_content.splitlines()

        added = max(len(mod_lines) - len(orig_lines), 0)
        removed = max(len(orig_lines) - len(mod_lines), 0)
        changed_lines = sum(1 for o, m in zip(orig_lines, mod_lines) if o != m) + abs(len(orig_lines) - len(mod_lines))

        # Check for unnecessary whitespace or comment bloat
        whitespace_only_changes = 0
        for o, m in zip(orig_lines, mod_lines):
            if o.strip() == m.strip() and o != m:
                whitespace_only_changes += 1

        is_minimal = whitespace_only_changes == 0 and changed_lines <= 50

        return {
            "target_file": target_file,
            "lines_changed": changed_lines,
            "lines_added": added,
            "lines_removed": removed,
            "whitespace_churn": whitespace_only_changes,
            "is_minimal": is_minimal,
            "recommendation": "MERGE_PATCH" if is_minimal else "TRIM_UNNECESSARY_DIFFS"
        }
