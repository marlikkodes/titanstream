"""
Diff Intelligence Engine for Agent OS Phase II.
Performs semantic and structural analysis of code diffs:
Computes complexity delta, affected symbols, API surface changes, database impact, and risk category.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Set
import re

@dataclass
class DiffAnalysisReport:
    total_files_changed: int
    total_symbols_affected: int
    complexity_delta: float       # -1.0 to +1.0
    api_surface_changed: bool
    database_impact: bool
    security_impact: bool
    risk_rating: str              # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    summary_line: str

class DiffAnalyzer:
    def __init__(self):
        pass

    def analyze_diff(self, diff_text: str, changed_files: List[str] = None) -> DiffAnalysisReport:
        """
        Extracts structural impact signals from unified diff text.
        """
        changed_files = changed_files or []
        added_lines = [l for l in diff_text.splitlines() if l.startswith("+") and not l.startswith("+++")]
        removed_lines = [l for l in diff_text.splitlines() if l.startswith("-") and not l.startswith("---")]

        # Count symbol mentions (functions, classes, variables)
        symbol_matches = set(re.findall(r'\b(def|class|function|const|let|var)\s+([A-Za-z0-9_]+)', diff_text))
        symbols_count = max(len(symbol_matches), len(changed_files) * 2)

        # Detect API surface modification
        api_changed = any("route" in f.lower() or "controller" in f.lower() or "api" in f.lower() for f in changed_files)
        api_changed = api_changed or any("@Get" in l or "@Post" in l or "export async function" in l for l in added_lines + removed_lines)

        # Detect database schema modification
        db_impact = any("schema.prisma" in f or "migration" in f or ".sql" in f for f in changed_files)

        # Detect security-sensitive changes
        sec_keywords = ["jwt", "password", "token", "crypto", "auth", "secret", "permission", "rbac"]
        sec_impact = any(k in diff_text.lower() for k in sec_keywords) or any("auth" in f.lower() for f in changed_files)

        # Calculate complexity delta
        net_lines = len(added_lines) - len(removed_lines)
        cyclomatic_indicators = sum(1 for l in added_lines if any(k in l for k in ["if ", "for ", "while ", "switch ", "catch "]))
        complexity_delta = round(min(1.0, max(0.05, (cyclomatic_indicators * 0.1) + (len(changed_files) * 0.05))), 2)

        # Determine risk rating
        if db_impact or (sec_impact and api_changed):
            risk = "CRITICAL" if len(changed_files) > 5 else "HIGH"
        elif api_changed or sec_impact:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        summary = f"Change Risk: {risk} | Files: {len(changed_files)} | Symbols: {symbols_count} | API: {'YES' if api_changed else 'NO'} | DB: {'YES' if db_impact else 'NO'} | Sec: {'YES' if sec_impact else 'NO'}"

        return DiffAnalysisReport(
            total_files_changed=len(changed_files),
            total_symbols_affected=symbols_count,
            complexity_delta=complexity_delta,
            api_surface_changed=api_changed,
            database_impact=db_impact,
            security_impact=sec_impact,
            risk_rating=risk,
            summary_line=summary,
        )
