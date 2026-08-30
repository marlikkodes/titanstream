"""
Context Economy and Tier Manager.
Enforces strict token budgets, context tiering (L0-L4), log compression,
and structured compact summarization to eliminate wasteful context consumption.
"""

import os
import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from .agent_os_core import ContextTier

class ContextEconomy:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.knowledge_dir = self.root_dir / ".agents" / "knowledge"

    def get_tier_context(self, tier: ContextTier, subsystem: Optional[str] = None, files: Optional[List[str]] = None) -> Dict[str, Any]:
        """Retrieve targeted context for the specified tier without loading entire repo."""
        if tier == ContextTier.L0_METADATA:
            return self._get_l0_metadata()
        elif tier == ContextTier.L1_ARCHITECTURE:
            return self._get_l1_architecture()
        elif tier == ContextTier.L2_SUBSYSTEM:
            return self._get_l2_subsystem(subsystem)
        elif tier == ContextTier.L3_EXACT_CODE:
            return self._get_l3_exact_code(files or [])
        elif tier == ContextTier.L4_HISTORY:
            return self._get_l4_history(files or [])
        return self._get_l0_metadata()

    def _get_l0_metadata(self) -> Dict[str, Any]:
        arch_path = self.knowledge_dir / "architecture_map.json"
        stack = []
        if arch_path.exists():
            with open(arch_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                stack = data.get("primary_stack", [])
        return {
            "tier": ContextTier.L0_METADATA.value,
            "primary_stack": stack,
            "root": str(self.root_dir.name)
        }

    def _get_l1_architecture(self) -> Dict[str, Any]:
        arch_path = self.knowledge_dir / "architecture_map.json"
        data = {}
        if arch_path.exists():
            with open(arch_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        return {
            "tier": ContextTier.L1_ARCHITECTURE.value,
            "subsystems": data.get("subsystems", {}),
            "design_patterns": data.get("design_patterns", [])
        }

    def _get_l2_subsystem(self, subsystem: Optional[str]) -> Dict[str, Any]:
        subsystem = subsystem or "apps"
        sub_path = self.root_dir / subsystem
        files = []
        if sub_path.exists() and sub_path.is_dir():
            for root, _, fs in os.walk(sub_path):
                if any(p in root for p in ["node_modules", ".git", "dist", "build"]):
                    continue
                for f in fs:
                    if not f.startswith("."):
                        files.append(os.path.relpath(os.path.join(root, f), self.root_dir))
        return {
            "tier": ContextTier.L2_SUBSYSTEM.value,
            "subsystem": subsystem,
            "file_count": len(files),
            "files": files[:50]
        }

    def _get_l3_exact_code(self, files: List[str]) -> Dict[str, Any]:
        snippets = {}
        for f in files:
            p = self.root_dir / f
            if p.exists() and p.is_file():
                try:
                    with open(p, 'r', encoding='utf-8', errors='ignore') as code_f:
                        content = code_f.read()
                        lines = content.splitlines()
                        snippets[f] = {
                            "total_lines": len(lines),
                            "content": "\n".join(lines[:300])
                        }
                except Exception as e:
                    snippets[f] = {"error": str(e)}
        return {
            "tier": ContextTier.L3_EXACT_CODE.value,
            "files": snippets
        }

    def _get_l4_history(self, files: List[str]) -> Dict[str, Any]:
        mem_path = self.root_dir / ".agents" / "memory" / "failure_memory.json"
        failures = []
        if mem_path.exists():
            try:
                with open(mem_path, 'r', encoding='utf-8') as f:
                    all_failures = json.load(f)
                    for item in all_failures:
                        if any(f in item.get("files_touched", []) for f in files):
                            failures.append(item)
            except Exception:
                pass
        return {
            "tier": ContextTier.L4_HISTORY.value,
            "matched_failures": failures
        }

    @staticmethod
    def compress_logs(raw_log: str, max_lines: int = 40) -> Dict[str, Any]:
        lines = raw_log.strip().splitlines()
        first_error = None
        stack_trace = []
        in_stack = False
        error_type = "UnknownError"

        error_regex = re.compile(r'(error|exception|fail|fatal|assertionerror|typeerror|referenceerror|syntaxerror)', re.IGNORECASE)
        
        for idx, line in enumerate(lines):
            if not first_error and error_regex.search(line):
                first_error = line.strip()
                if ":" in line:
                    error_type = line.split(":")[0].strip()

            if "Traceback" in line or "Error:" in line or "at " in line or "File " in line:
                in_stack = True

            if in_stack:
                stack_trace.append(line.strip())
                if len(stack_trace) >= max_lines:
                    break

        return {
            "total_raw_lines": len(lines),
            "error_type": error_type,
            "first_error": first_error or (lines[-1] if lines else "No log output"),
            "compressed_stack": stack_trace[:max_lines],
            "summary": f"{error_type}: {first_error}" if first_error else "Execution completed with logs"
        }

    @staticmethod
    def format_structured_summary(what_changed: str, why: str, files: List[str], tests: List[str], failures: List[str], root_cause: str, fix: str, remaining_risk: str) -> str:
        files_str = ', '.join(files) if files else 'None'
        tests_str = ', '.join(tests) if tests else 'None'
        failures_str = ', '.join(failures) if failures else 'None'
        return f"""
[SUMMARY]
WHAT CHANGED: {what_changed}
WHY: {why}
FILES: {files_str}
TESTS: {tests_str}
FAILURES: {failures_str}
ROOT CAUSE: {root_cause}
FIX: {fix}
REMAINING RISK: {remaining_risk}
[/SUMMARY]""".strip()
