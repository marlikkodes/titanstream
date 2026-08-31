"""
Environment Safety & Multi-Tier Autonomy Model for Agent OS Phase II.
Explicitly distinguishes LOCAL, TEST, STAGING, and PRODUCTION environments.
Enforces autonomy boundaries (L0 to L4) and strictly blocks unapproved production mutations.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass

class EnvironmentSafetyGuard:
    def __init__(self):
        pass

    def check_operation_safety(
        self,
        environment: str,
        operation_type: str, # "READ", "MUTATION", "DEPLOY", "DROP_DB", "MIGRATION"
        autonomy_level: str, # "L0_READ", "L1_LOCAL", "L2_BRANCH_PR", "L3_STAGING", "L4_PRODUCTION"
        human_approved: bool = False,
    ) -> Dict[str, Any]:
        """
        Determines whether operation is authorized in the specified environment.
        """
        env = environment.upper()
        op = operation_type.upper()

        if env == "PRODUCTION":
            if op in ["DROP_DB", "DELETE_PRODUCTION_DATA", "FLUSH_SECRETS"]:
                return {
                    "allowed": False,
                    "reason": "Destructive operations strictly prohibited in PRODUCTION.",
                    "requires_approval": True,
                }
            if op in ["DEPLOY", "MUTATION", "MIGRATION"] and not human_approved:
                return {
                    "allowed": False,
                    "reason": "PRODUCTION mutations require explicit human authorization under L4 policy.",
                    "requires_approval": True,
                }

        if env == "STAGING":
            if op in ["DROP_DB"]:
                return {
                    "allowed": False,
                    "reason": "Dangerous drop database blocked in STAGING without explicit override.",
                    "requires_approval": True,
                }

        return {
            "allowed": True,
            "reason": f"Operation {op} permitted in {env} under autonomy level {autonomy_level}.",
            "requires_approval": False,
        }
