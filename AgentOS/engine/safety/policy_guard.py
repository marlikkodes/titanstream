"""
Safety Policy and Tool Permission Guard.
Enforces multi-layer safety, dangerous command blocking, secret redaction,
and least-privilege tool profiles.
"""

import re
from typing import Dict, List, Any, Optional, Tuple

FORBIDDEN_COMMANDS = [
    r"\brm\s+-rf\s+/(?:\s|$)",
    r"\bdrop\s+(?:database|schema|table)\b",
    r"\btruncate\s+(?:table\s+)?[a-zA-Z0-9_]+\b",
    r"\bformat\s+[a-zA-Z]:",
    r"\bgcloud\s+projects\s+delete\b",
    r"\bgit\s+push\s+.*--force\s+.*main\b",
    r"\bgit\s+reset\s+--hard\s+origin/main\b"
]

SECRET_PATTERNS = [
    re.compile(r"sk-[a-zA-Z0-9_-]{20,}", re.IGNORECASE),
    re.compile(r"AIzaSy[a-zA-Z0-9_-]{25,}", re.IGNORECASE),
    re.compile(r"ghp_[a-zA-Z0-9]{20,}", re.IGNORECASE),
    re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----", re.IGNORECASE)
]

TOOL_PROFILES = {
    "frontend_engineer": ["filesystem", "git", "browser", "test_runner"],
    "backend_engineer": ["filesystem", "git", "terminal", "logs", "test_runner"],
    "database_engineer": ["filesystem", "database", "git", "test_runner"],
    "security_engineer": ["filesystem", "git", "security_scanner"],
    "devops_engineer": ["git", "github", "deployment", "terminal"],
    "repo_analyst": ["filesystem_readonly", "git_readonly"],
    "debugger": ["filesystem", "git", "terminal", "test_runner"],
    "qa_engineer": ["test_runner", "filesystem_readonly", "browser"],
    "browser_engineer": ["browser", "filesystem_readonly"],
    "mission_controller": ["state_store", "event_log"],
    "context_engineer": ["index_query", "log_compressor"],
    "merge_guardian": ["git", "diff_checker"],
    "escalation_manager": ["human_ui", "state_store"]
}

class SafetyGuard:
    @staticmethod
    def inspect_command(command: str) -> Tuple[bool, Optional[str]]:
        for pattern in FORBIDDEN_COMMANDS:
            if re.search(pattern, command, re.IGNORECASE):
                return False, f"Command blocked by Safety Policy: matches dangerous pattern '{pattern}'"
        return True, None

    @staticmethod
    def redact_secrets(text: str) -> Tuple[str, int]:
        redacted = text
        count = 0
        for pattern in SECRET_PATTERNS:
            matches = list(pattern.finditer(redacted))
            if matches:
                count += len(matches)
                redacted = pattern.sub("[REDACTED_SECRET]", redacted)
        return redacted, count

    @staticmethod
    def validate_tool_access(role: str, tool_name: str) -> bool:
        allowed = TOOL_PROFILES.get(role, ["filesystem", "terminal"])
        return tool_name in allowed or "all" in allowed
