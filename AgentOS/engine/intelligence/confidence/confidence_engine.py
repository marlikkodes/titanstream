"""
Confidence Engine for Agent OS Phase II.
Evaluates multi-signal, evidence-grounded confidence scores for engineering decisions
(Root Cause, Impact Analysis, Patch Quality, Verification Depth, and Overall Mission).
"""

from dataclasses import dataclass
from typing import Dict, Any, List, Optional

@dataclass
class ConfidenceReport:
    root_cause_confidence: float     # 0.0 - 1.0
    impact_analysis_confidence: float # 0.0 - 1.0
    patch_confidence: float           # 0.0 - 1.0
    verification_confidence: float    # 0.0 - 1.0
    overall_mission_confidence: float # 0.0 - 1.0
    signals_used: List[str]
    is_acceptable_for_completion: bool # True if overall >= 0.85 and verification >= 0.90

class ConfidenceEngine:
    def __init__(self):
        pass

    def evaluate_mission_confidence(
        self,
        reproduction_verified: bool = True,
        graph_coverage_pct: float = 100.0,
        ast_syntax_valid: bool = True,
        test_pass_rate: float = 1.0,
        security_scan_clean: bool = True,
        diff_complexity_score: float = 0.2, # 0.0 (clean) to 1.0 (chaotic)
        has_historical_regression: bool = False,
        static_analysis_errors: int = 0,
    ) -> ConfidenceReport:
        """
        Calculates grounded multi-signal confidence scores.
        """
        signals = []

        # 1. Root Cause Confidence
        rc_score = 0.5
        if reproduction_verified:
            rc_score += 0.4
            signals.append("deterministic_reproduction_verified")
        if static_analysis_errors == 0:
            rc_score += 0.1
            signals.append("clean_static_analysis")
        rc_score = min(1.0, rc_score)

        # 2. Impact Analysis Confidence
        impact_score = (graph_coverage_pct / 100.0) * 0.85
        if not has_historical_regression:
            impact_score += 0.15
            signals.append("no_historical_regression_in_subsystem")
        impact_score = min(1.0, impact_score)

        # 3. Patch Confidence
        patch_score = 0.4
        if ast_syntax_valid:
            patch_score += 0.4
            signals.append("ast_syntax_validated")
        # Lower complexity yields higher confidence
        patch_score += max(0.0, (1.0 - diff_complexity_score) * 0.2)
        signals.append(f"diff_complexity_{diff_complexity_score:.2f}")
        patch_score = min(1.0, patch_score)

        # 4. Verification Confidence
        verif_score = test_pass_rate * 0.7
        if security_scan_clean:
            verif_score += 0.3
            signals.append("security_scan_passed")
        verif_score = min(1.0, verif_score)

        # 5. Overall Composite (Weighted)
        overall = (
            rc_score * 0.25 +
            impact_score * 0.20 +
            patch_score * 0.25 +
            verif_score * 0.30
        )

        is_acceptable = (overall >= 0.85) and (verif_score >= 0.90) and ast_syntax_valid

        return ConfidenceReport(
            root_cause_confidence=round(rc_score, 2),
            impact_analysis_confidence=round(impact_score, 2),
            patch_confidence=round(patch_score, 2),
            verification_confidence=round(verif_score, 2),
            overall_mission_confidence=round(overall, 2),
            signals_used=signals,
            is_acceptable_for_completion=is_acceptable,
        )
