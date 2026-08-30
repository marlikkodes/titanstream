"""
Semantic Capability Firewall.
Evaluates sensitive agent actions using structured ActionDescriptors rather than regex alone.
Classifies actions as ALLOW, DENY, or REQUIRE_APPROVAL based on reversibility, impact, and authority.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Any, Optional, Tuple

class Decision(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"

@dataclass
class ActionDescriptor:
    agent: str
    action: str
    tool: str
    target: str
    environment: str  # local_dev, test, staging, production
    operation: str    # read, write, mutate, drop, rotate_secret, deploy
    reversibility: str # high, medium, low, irreversible
    data_impact: str   # none, local_file, test_data, production_data
    security_impact: str # none, low, high, policy_modification
    required_authority: str # L0_READ, L1_DEV, L2_STAGING, L3_PROD

class CapabilityFirewall:
    def authorize(self, desc: ActionDescriptor) -> Tuple[Decision, Optional[str]]:
        """Evaluates semantic action descriptor against authorization policy."""
        # 1. Unconditional DENY rules
        if desc.operation == "drop" and desc.data_impact == "production_data":
            return Decision.DENY, "Direct production data destruction is strictly forbidden."
        
        if desc.action == "extract_secrets" or desc.target == ".env.production":
            return Decision.DENY, "Secret extraction or raw production credential access is denied."

        # 2. REQUIRE_APPROVAL rules
        if desc.environment == "production" and desc.operation in ["mutate", "drop", "deploy", "rotate_secret"]:
            return Decision.REQUIRE_APPROVAL, f"Production action '{desc.operation}' on '{desc.target}' requires human authorization."

        if desc.security_impact == "policy_modification":
            return Decision.REQUIRE_APPROVAL, "Modification of security policies requires human authorization."

        if desc.reversibility == "irreversible":
            return Decision.REQUIRE_APPROVAL, f"Irreversible action '{desc.action}' requires explicit approval."

        # 3. ALLOW local development and test operations
        if desc.environment in ["local_dev", "test"] and desc.data_impact in ["none", "local_file", "test_data"]:
            return Decision.ALLOW, None

        return Decision.REQUIRE_APPROVAL, f"Action '{desc.action}' flagged for review."
