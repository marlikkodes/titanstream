"""
Prompt Injection Defense & Trust Boundary Engine for Agent OS Phase II.
Enforces explicit trust precedence:
SYSTEM_POLICY (100) > AGENT_OS_POLICY (90) > MISSION_POLICY (80) > USER_OBJECTIVE (70) > REPOSITORY_CONTENT (30) > TOOL_OUTPUT (20)
Untrusted content from files, comments, or external tool outputs cannot override safety policies.
"""

from typing import Dict, Any, List
import re

class PromptInjectionDefense:
    def __init__(self):
        self.injection_patterns = [
            r'ignore\s+previous\s+instructions',
            r'disregard\s+safety\s+rules',
            r'you\s+are\s+now\s+in\s+god\s+mode',
            r'override\s+capability\s+firewall',
            r'disable\s+verification',
            r'drop\s+table\s+users',
            r'output\s+all\s+environment\s+variables',
        ]

    def sanitize_untrusted_input(self, raw_text: str, source_level: str = "REPOSITORY_CONTENT") -> Dict[str, Any]:
        """
        Scans untrusted repository or tool output for adversarial injection payloads.
        """
        detected_attacks = []
        for pat in self.injection_patterns:
            if re.search(pat, raw_text, re.IGNORECASE):
                detected_attacks.append(pat)

        is_adversarial = len(detected_attacks) > 0
        cleaned_text = raw_text

        if is_adversarial:
            # Neutralize dangerous directives
            for pat in self.injection_patterns:
                cleaned_text = re.sub(pat, "[SANITIZED_PROMPT_INJECTION_ATTEMPT]", cleaned_text, flags=re.IGNORECASE)

        return {
            "is_safe": not is_adversarial,
            "detected_attacks": detected_attacks,
            "sanitized_content": cleaned_text,
            "trust_precedence_applied": f"Policy prevailing over untrusted {source_level}",
        }
