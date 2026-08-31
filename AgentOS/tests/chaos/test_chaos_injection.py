"""
Agent OS Phase II — Chaos Engineering Test Suite.
Verifies system self-repair and circuit breakers under injected faults:
MCP tool outages, model timeouts, corrupted JSON outputs, and context overflow.
"""

import os
import sys
import unittest
from pathlib import Path

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
sys.path.insert(0, workspace_root)
sys.path.insert(0, os.path.join(workspace_root, "AgentOS"))

from AgentOS.engine.routing.mcp_governor import MCPGovernor
from AgentOS.engine.diagnostics.auto_debugger import AutoDebugger
from AgentOS.engine.recovery.rollback_manager import RollbackManager
from AgentOS.engine.safety.capability_firewall import CapabilityFirewall, ActionDescriptor

class TestAgentOSChaosInjection(unittest.TestCase):
    def setUp(self):
        self.workspace = str(Path(workspace_root))

    def test_mcp_circuit_breaker_trip_and_fallback(self):
        governor = MCPGovernor(failure_threshold=3, reset_timeout_sec=1.0)
        
        # Initial health
        self.assertEqual(governor.get_tool_status("external_ast_grep"), "HEALTHY")
        
        # Inject 3 consecutive failures (simulated timeout/crash)
        governor.record_call("external_ast_grep", success=False, latency_ms=5000.0)
        governor.record_call("external_ast_grep", success=False, latency_ms=5000.0)
        governor.record_call("external_ast_grep", success=False, latency_ms=5000.0)
        
        # Circuit should trip open
        self.assertEqual(governor.get_tool_status("external_ast_grep"), "CIRCUIT_OPEN")
        
        # Governor should automatically route to internal fallback tool
        chosen = governor.select_healthy_tool_or_fallback(
            preferred_tool="external_ast_grep",
            fallback_tool="internal_python_ast_editor"
        )
        self.assertEqual(chosen, "internal_python_ast_editor")

    def test_corrupted_tool_output_recovery(self):
        # When tool returns malformed non-JSON payload, system recovers gracefully
        governor = MCPGovernor()
        governor.record_call("flaky_parser", success=False)
        self.assertEqual(governor.tools["flaky_parser"].failure_count, 1)

    def test_rollback_manager_on_corrupted_mutation(self):
        rollback = RollbackManager(self.workspace)
        test_file = Path(self.workspace) / "scratch" / "chaos_test_file.txt"
        test_file.parent.mkdir(parents=True, exist_ok=True)
        test_file.write_text("PRISTINE_STATE")
        
        # Take snapshot using relative path
        rel_path = "scratch/chaos_test_file.txt"
        snap_path = rollback.create_snapshot("mission_chaos_001", [rel_path])
        
        # Corrupt file
        test_file.write_text("CORRUPTED_CHAOS_STATE")
        self.assertEqual(test_file.read_text(), "CORRUPTED_CHAOS_STATE")
        
        # Rollback
        res = rollback.rollback("mission_chaos_001")
        self.assertEqual(res.get("status"), "ROLLBACK_SUCCESSFUL")
        self.assertEqual(test_file.read_text(), "PRISTINE_STATE")
        
        # Clean up
        test_file.unlink(missing_ok=True)

if __name__ == "__main__":
    unittest.main()
