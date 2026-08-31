"""
Autonomous Test Selector & Adaptive Verification Engine for Agent OS Phase II.
Selects and orders the minimal sufficient test suite that yields maximum confidence
for the smallest execution cost using blast radius, changed symbols, and failure history.
"""

from typing import List, Dict, Set, Any
from dataclasses import dataclass

@dataclass
class SelectedTestPlan:
    priority_tests: List[str]
    skipped_tests: List[str]
    estimated_duration_seconds: float
    confidence_coverage_pct: float
    selection_rationale: str

class AutonomousTestSelector:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = workspace_root

    def select_tests_for_changes(
        self,
        changed_files: List[str],
        changed_symbols: List[str] = None,
        available_tests: List[str] = None,
        historical_failures: List[str] = None,
    ) -> SelectedTestPlan:
        """
        Determines the optimal test subset and execution order.
        """
        if available_tests is None:
            available_tests = [
                "unit:auth_service_spec",
                "unit:balance_service_spec",
                "unit:settlement_router_spec",
                "unit:machine_fleet_spec",
                "integration:growth_rewards_spec",
                "integration:e2e_settlement_spec",
                "security:auth_rbac_audit_spec",
                "ui:browser_hub_spec",
            ]
        
        changed_symbols = changed_symbols or []
        historical_failures = set(historical_failures or [])
        
        selected: List[str] = []
        skipped: List[str] = []

        is_css_only = all(f.endswith(".css") or f.endswith(".scss") or "styles" in f for f in changed_files)
        is_auth_change = any("auth" in f.lower() or "jwt" in f.lower() or "session" in f.lower() for f in changed_files)
        is_settlement_change = any("settlement" in f.lower() or "finance" in f.lower() or "ledger" in f.lower() for f in changed_files)

        for test in available_tests:
            score = 0
            # 1. Historical failure boost
            if test in historical_failures:
                score += 50

            # 2. Domain matching
            if is_css_only:
                if "ui:" in test or "browser" in test:
                    score += 100
                else:
                    skipped.append(test)
                    continue
            elif is_auth_change:
                if "auth" in test or "security" in test:
                    score += 100
                elif "integration" in test:
                    score += 40
            elif is_settlement_change:
                if "settlement" in test or "balance" in test or "growth" in test:
                    score += 100
                elif "integration" in test:
                    score += 60
            else:
                score += 30

            if score > 0:
                selected.append((score, test))
            else:
                skipped.append(test)

        # Sort by score descending (highest priority first)
        selected.sort(key=lambda x: x[0], reverse=True)
        ordered_tests = [t[1] for t in selected]

        if not ordered_tests and available_tests:
            # Fallback to smoke tests
            ordered_tests = available_tests[:2]
            skipped = available_tests[2:]

        est_time = len(ordered_tests) * 1.2
        coverage_pct = min(100.0, (len(ordered_tests) / max(1, len(available_tests))) * 100.0 + (30.0 if not is_css_only else 50.0))

        rationale = f"Selected {len(ordered_tests)} tests based on {len(changed_files)} changed files (Pruned {len(skipped)} non-blast-radius tests)."

        return SelectedTestPlan(
            priority_tests=ordered_tests,
            skipped_tests=skipped,
            estimated_duration_seconds=round(est_time, 1),
            confidence_coverage_pct=round(min(100.0, coverage_pct), 1),
            selection_rationale=rationale,
        )
