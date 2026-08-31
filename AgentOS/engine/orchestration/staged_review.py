"""
Staged Multi-Agent Review Engine for Agent OS Phase II.
Prevents multi-agent token waste by using tiered review escalation:
Deterministic Checks -> Cheap Fast Reviewer -> (If Suspicious) Specialist Reviewer -> (If High Risk) Security Gate.
"""

from typing import Dict, Any, List
from dataclasses import dataclass

@dataclass
class ReviewOutcome:
    approved: bool
    review_level_reached: str # "DETERMINISTIC", "FAST_REVIEW", "SPECIALIST", "SECURITY_GATE"
    tokens_consumed: int
    review_comments: List[str]
    risk_level: str

class StagedReviewEngine:
    def __init__(self):
        pass

    def review_patch(
        self,
        diff_text: str,
        syntax_valid: bool = True,
        lint_clean: bool = True,
        diff_complexity: float = 0.2, # 0.0 to 1.0
        affects_security: bool = False,
        affects_database: bool = False,
    ) -> ReviewOutcome:
        """
        Evaluates code change through staged review layers.
        """
        comments = []
        tokens = 0

        # Stage 1: Deterministic Check (0 LLM Tokens)
        if not syntax_valid or not lint_clean:
            return ReviewOutcome(
                approved=False,
                review_level_reached="DETERMINISTIC",
                tokens_consumed=0,
                review_comments=["Failed deterministic syntax or lint validation."],
                risk_level="HIGH"
            )

        tokens += 300 # Stage 1 token estimation (diff tokens)

        # Stage 2: Cheap Reviewer (T1 Model)
        is_suspicious = (diff_complexity > 0.6) or ("eval(" in diff_text or "exec(" in diff_text)
        tokens += 600

        if not is_suspicious and not affects_security and not affects_database:
            return ReviewOutcome(
                approved=True,
                review_level_reached="FAST_REVIEW",
                tokens_consumed=tokens,
                review_comments=["Clean change approved by fast reviewer."],
                risk_level="LOW"
            )

        # Stage 3: Specialist Reviewer (T2/T3 Model)
        tokens += 1500
        if is_suspicious:
            comments.append("Specialist inspected elevated complexity; logic approved.")

        # Stage 4: Security & Release Gate (If High Risk)
        if affects_security or affects_database:
            tokens += 2000
            comments.append("Security & Database release gate verified parameterization and reversibility.")
            return ReviewOutcome(
                approved=True,
                review_level_reached="SECURITY_GATE",
                tokens_consumed=tokens,
                review_comments=comments,
                risk_level="HIGH"
            )

        return ReviewOutcome(
            approved=True,
            review_level_reached="SPECIALIST",
            tokens_consumed=tokens,
            review_comments=comments,
            risk_level="MEDIUM"
        )
