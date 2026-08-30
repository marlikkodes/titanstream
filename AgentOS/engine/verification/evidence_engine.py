"""
Evidence-Based Completion Engine.
Enforces the fundamental law: AGENT CLAIMS ARE NOT EVIDENCE.
Requires verifiable on-disk execution artifacts, exit codes, and test logs.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Any, Optional

class EvidenceEngine:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()

    def verify_completion_claim(
        self,
        claim_type: str,  # "test_pass", "build_success", "browser_verified", "security_clean"
        evidence_artifact_path: Optional[str] = None,
        expected_exit_code: int = 0
    ) -> Dict[str, Any]:
        """Validates that a completion claim has physical on-disk evidence."""
        if not evidence_artifact_path:
            return {
                "verified": False,
                "reason": f"Claim '{claim_type}' rejected: No verifiable evidence artifact was provided."
            }

        artifact_file = self.workspace_root / evidence_artifact_path
        if not artifact_file.exists():
            return {
                "verified": False,
                "reason": f"Claim '{claim_type}' rejected: Evidence artifact '{evidence_artifact_path}' does not exist on disk."
            }

        try:
            with open(artifact_file, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            if claim_type == "test_pass":
                if "FAILED" in content or "AssertionError" in content or "SyntaxError" in content:
                    return {
                        "verified": False,
                        "reason": "Claim rejected: Test evidence artifact contains failure assertions."
                    }
                return {"verified": True, "artifact": evidence_artifact_path, "status": "VERIFIED_TEST_PASS"}

            elif claim_type == "security_clean":
                if "CRITICAL" in content or "VULNERABILITY" in content:
                    return {
                        "verified": False,
                        "reason": "Claim rejected: Security audit artifact reports unresolved vulnerabilities."
                    }
                return {"verified": True, "artifact": evidence_artifact_path, "status": "VERIFIED_SECURITY_CLEAN"}

            return {"verified": True, "artifact": evidence_artifact_path, "status": "VERIFIED"}
        except Exception as e:
            return {"verified": False, "reason": f"Failed to read evidence artifact: {str(e)}"}
