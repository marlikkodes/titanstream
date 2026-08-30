"""
Antigravity Lifecycle Hooks Engine.
Provides Pre-tool, Post-tool, Tool-failure, and Mission-completion interception.
"""

from typing import Dict, Any, Tuple, Optional
from .policy_guard import SafetyGuard

class HookEngine:
    def __init__(self):
        self.guard = SafetyGuard()

    def pre_tool_hook(self, agent_role: str, tool_name: str, tool_args: Dict[str, Any]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        if not self.guard.validate_tool_access(agent_role, tool_name):
            return False, f"Permission Denied: Agent role '{agent_role}' is not granted tool '{tool_name}'", tool_args

        if tool_name in ["run_command", "terminal"]:
            cmd = tool_args.get("command") or tool_args.get("CommandLine") or ""
            safe, reason = self.guard.inspect_command(cmd)
            if not safe:
                return False, reason, tool_args

        clean_args = {}
        for k, v in tool_args.items():
            if isinstance(v, str):
                cleaned_val, _ = self.guard.redact_secrets(v)
                clean_args[k] = cleaned_val
            else:
                clean_args[k] = v

        return True, None, clean_args

    def post_tool_hook(self, agent_role: str, tool_name: str, tool_result: Any) -> Any:
        if isinstance(tool_result, str):
            cleaned, _ = self.guard.redact_secrets(tool_result)
            return cleaned
        return tool_result

    def tool_failure_hook(self, agent_role: str, tool_name: str, error: str) -> Dict[str, Any]:
        err_lower = error.lower()
        is_transient = any(w in err_lower for w in ["timeout", "timedout", "etimedout", "reset", "econnreset", "socket hang up", "rate limit", "503"])
        return {
            "error": error,
            "classified_type": "TRANSIENT" if is_transient else "PERMANENT",
            "action": "RETRY_WITH_BACKOFF" if is_transient else "ESCALATE_OR_FALLBACK"
        }
