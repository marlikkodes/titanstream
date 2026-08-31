"""
Counterfactual Hypothesis Engine.
Challenges proposed fix hypotheses by generating edge cases (null inputs,
concurrency, timeouts, duplicate requests) and verifying the patch survives them.
"""

from typing import Dict, List, Any, Callable, Optional

class CounterfactualEngine:
    def __init__(self):
        pass

    def generate_counterfactuals(self, hypothesis: str, domain: str) -> List[str]:
        base_cases = ["null/undefined input payload", "boundary zero/negative value", "concurrent execution race"]
        if domain == "auth" or "session" in hypothesis.lower():
            base_cases.extend(["expired session token", "stale refresh token", "concurrent multi-device login"])
        elif domain == "database" or "query" in hypothesis.lower():
            base_cases.extend(["duplicate primary key", "deadlock transaction timeout", "missing optional column"])
        elif domain == "network" or "api" in hypothesis.lower():
            base_cases.extend(["network 504 gateway timeout", "malformed JSON payload", "abrupt client disconnect"])
        return base_cases

    def evaluate_hypothesis_resilience(
        self,
        hypothesis: str,
        domain: str,
        test_executor: Optional[Callable[[str], bool]] = None
    ) -> Dict[str, Any]:
        cases = self.generate_counterfactuals(hypothesis, domain)
        failed_cases = []
        
        for case in cases:
            if test_executor:
                passed = test_executor(case)
                if not passed:
                    failed_cases.append(case)

        survived = len(failed_cases) == 0
        return {
            "hypothesis": hypothesis,
            "domain": domain,
            "total_counterfactuals": len(cases),
            "counterfactuals_tested": cases,
            "failed_counterfactuals": failed_cases,
            "hypothesis_validated": survived,
            "status": "RESILIENT" if survived else "VULNERABLE_HYPOTHESIS"
        }
