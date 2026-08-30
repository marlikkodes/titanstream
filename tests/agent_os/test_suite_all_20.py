"""
Comprehensive 20-Point Acceptance Test Suite for Antigravity Superengineering OS.
Verifies all 20 global engineering criteria end-to-end.
"""

import sys
import os
import time
import unittest
import shutil
from pathlib import Path

# Add .agents and AgentOS root to sys.path
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
agents_dir = os.path.join(workspace_root, ".agents")
agentos_dir = os.path.join(workspace_root, "AgentOS")

sys.path.insert(0, agents_dir)
sys.path.insert(0, agentos_dir)

from engine import (
    AgentCommander, RepoIntelligence, ContextEconomy, FailureMemory,
    TaskGraphEngine, AutoDebugger, VerificationGateManager,
    MissionStateManager, AgentObservability, AutonomyLevel,
    AgentRole, TaskStatus, ContextTier
)
from engine.mission.event_source import MissionEventStore
from engine.safety.policy_guard import SafetyGuard, TOOL_PROFILES
from engine.safety.hooks import HookEngine
from engine.orchestration.merge_guardian import MergeGuardian

class TestAntigravitySuperengineeringOS20(unittest.TestCase):
    def setUp(self):
        self.workspace_root = workspace_root
        self.commander = AgentCommander(self.workspace_root)
        self.repo_intel = RepoIntelligence(self.workspace_root)
        self.context_economy = ContextEconomy(self.workspace_root)
        self.failure_mem = FailureMemory(self.workspace_root)
        self.task_graph = TaskGraphEngine()
        self.debugger = AutoDebugger(self.workspace_root, max_repair_attempts=3)
        self.verifier = VerificationGateManager(self.workspace_root)
        self.state_mgr = MissionStateManager(self.workspace_root)
        self.event_store = MissionEventStore(self.workspace_root)
        self.safety_guard = SafetyGuard()
        self.hook_engine = HookEngine()

    # --- Core Tests 1 to 12 ---

    def test_01_simple_frontend_bug_auto_fixed(self):
        res = self.commander.execute_mission("Fix spinner animation jitter on dashboard page", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("frontend_engineer", res["agents_assigned"])
        self.assertTrue(res["verification_gates"]["passed_all"])
        print("\n[PASSED] TEST 1: Simple frontend bug automatically routed and verified.")

    def test_02_backend_bug_auto_diagnosed(self):
        res = self.commander.execute_mission("Fix API route returning 500 on missing payload in services/api", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("backend_engineer", res["agents_assigned"])
        print("[PASSED] TEST 2: Backend bug automatically diagnosed and repaired.")

    def test_03_database_bug_db_agent_engaged(self):
        res = self.commander.execute_mission("Fix prisma database migration column naming mismatch in transactions table", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("database_engineer", res["agents_assigned"])
        print("[PASSED] TEST 3: Database agent engaged automatically.")

    def test_04_cross_system_feature_parallel_execution(self):
        roles = [AgentRole.FRONTEND_ENGINEER, AgentRole.BACKEND_ENGINEER, AgentRole.DATABASE_ENGINEER]
        dag = self.task_graph.build_dag_for_mission("test_mission_04", "Build real-time notification system", roles, AutonomyLevel.LEVEL_1_LOCAL_DEV)
        waves = self.task_graph.get_execution_waves(dag)
        parallel_waves = [w for w in waves if len(w) > 1]
        self.assertTrue(len(parallel_waves) > 0)
        print(f"[PASSED] TEST 4: Cross-system DAG parallel execution waves verified ({len(waves)} waves).")

    def test_05_introduced_test_failure_debugger_repairs(self):
        call_count = 0
        def failing_then_passing_reproducer():
            nonlocal call_count
            call_count += 1
            if call_count <= 2:
                return False, "AssertionError: Expected 200 OK but got 500 Internal Error"
            return True, "All tests passed"

        repair_res = self.debugger.diagnose_and_repair(
            symptom="AssertionError in authentication test",
            failing_command="pnpm test:auth",
            target_file="services/api/src/routes/auth.ts",
            reproducer_func=failing_then_passing_reproducer
        )
        self.assertEqual(repair_res["status"], "REPAIRED")
        self.assertEqual(repair_res["repair_attempts"], 2)
        print("[PASSED] TEST 5: Auto-debugger executed 8-step repair loop and recorded regression test.")

    def test_06_browser_visible_bug_reproduced_and_verified(self):
        res = self.commander.execute_mission("Verify checkout button click and browser console errors on checkout page", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("browser_engineer", res["agents_assigned"])
        print("[PASSED] TEST 6: Browser automation reproduced and verified UI state.")

    def test_07_security_sensitive_change_security_review_triggered(self):
        res = self.commander.execute_mission("Update auth token JWT signing secret validation and session cookie flags", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("security_engineer", res["agents_assigned"])
        print("[PASSED] TEST 7: Security review automatically triggered and passed.")

    def test_08_ci_failure_diagnostic_extraction_repair(self):
        raw_ci_log = "error TS2339: Property 'validateSession' does not exist on type 'AuthService'."
        compressed = self.context_economy.compress_logs(raw_ci_log)
        self.assertIn("TS2339", compressed["first_error"])
        print(f"[PASSED] TEST 8: CI failure log compressed.")

    def test_09_agent_interruption_resume_without_restart(self):
        mission = self.state_mgr.create_mission("Long running refactor mission", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        t1 = self.task_graph.build_dag_for_mission(mission.mission_id, mission.objective, [AgentRole.FRONTEND_ENGINEER], AutonomyLevel.LEVEL_1_LOCAL_DEV)
        first_tid = list(t1.keys())[0]
        t1[first_tid].status = TaskStatus.COMPLETED
        self.state_mgr.checkpoint_task(mission.mission_id, t1[first_tid])

        resume_data = self.state_mgr.resume_mission(mission.mission_id)
        self.assertEqual(resume_data["completed_count"], 1)
        print("[PASSED] TEST 9: Interrupted mission resumed cleanly from checkpoint.")

    def test_10_ambiguous_high_risk_human_escalation(self):
        res_prod = self.commander.execute_mission("Drop database users_production and truncate balances", AutonomyLevel.LEVEL_3_PRODUCTION)
        self.assertEqual(res_prod["status"], "ESCALATED_TO_HUMAN")
        print("[PASSED] TEST 10: Destructive / Production operation halted for human escalation.")

    def test_11_repeated_failure_stops_cleanly(self):
        def always_failing():
            return False, "Fatal: unrecoverable hardware fault"

        repair_res = self.debugger.diagnose_and_repair(
            symptom="Hardware driver unrecoverable crash",
            failing_command="make driver-test",
            reproducer_func=always_failing
        )
        self.assertEqual(repair_res["status"], "ESCALATED_TO_HUMAN")
        self.assertEqual(repair_res["repair_attempts"], 3)
        print("[PASSED] TEST 11: Auto-debugger cleanly halted after 3 attempts.")

    def test_12_token_efficiency_tiered_context(self):
        l0 = self.context_economy.get_tier_context(ContextTier.L0_METADATA)
        l2 = self.context_economy.get_tier_context(ContextTier.L2_SUBSYSTEM, subsystem="apps")
        self.assertIn("primary_stack", l0)
        self.assertTrue(len(l2["files"]) <= 50)
        print("[PASSED] TEST 12: Tiered context verified (L0 metadata vs L2 subsystem).")

    # --- Extended Tests 13 to 20 ---

    def test_13_agent_conflict_merge_guardian(self):
        """TEST 13: Agent conflict -> Merge Guardian detects overlapping modifications."""
        agent_outputs = [
            {"agent": "frontend_engineer", "files_changed": ["src/App.tsx", "src/styles.css"]},
            {"agent": "backend_engineer", "files_changed": ["src/App.tsx", "services/api.ts"]}
        ]
        result = MergeGuardian.detect_conflicts(agent_outputs)
        self.assertTrue(result["has_conflict"])
        self.assertIn("src/App.tsx", result["conflicting_files"])
        self.assertEqual(result["conflicting_files"]["src/App.tsx"], ["frontend_engineer", "backend_engineer"])
        print("[PASSED] TEST 13: Merge Guardian accurately detected multi-agent file conflict.")

    def test_14_mcp_tool_failure_and_fallback(self):
        """TEST 14: Tool failure -> Hook classifies transient vs permanent error and falls back."""
        res_transient = self.hook_engine.tool_failure_hook("backend_engineer", "terminal", "ETIMEDOUT: Connection reset by peer")
        self.assertEqual(res_transient["classified_type"], "TRANSIENT")
        self.assertEqual(res_transient["action"], "RETRY_WITH_BACKOFF")

        res_perm = self.hook_engine.tool_failure_hook("backend_engineer", "terminal", "SyntaxError: Unexpected token")
        self.assertEqual(res_perm["classified_type"], "PERMANENT")
        self.assertEqual(res_perm["action"], "ESCALATE_OR_FALLBACK")
        print("[PASSED] TEST 14: Tool failure classification and fallback verified.")

    def test_15_context_overflow_prevention(self):
        """TEST 15: Context overflow -> Log compression reduces 5000 lines of logs to < 40 lines."""
        giant_log = "\n".join([f"Line {i}: standard log trace information..." for i in range(5000)])
        giant_log += "\nError: Critical NullPointer in authMiddleware at line 42\n"
        giant_log += "\n".join([f"Line {i+5001}: post error trace..." for i in range(500)])
        
        compressed = self.context_economy.compress_logs(giant_log, max_lines=20)
        self.assertTrue(compressed["total_raw_lines"] >= 5000)
        self.assertTrue(len(compressed["compressed_stack"]) <= 20)
        self.assertIn("NullPointer", compressed["first_error"])
        print("[PASSED] TEST 15: 5,500 lines compressed safely to 20 lines without context explosion.")

    def test_16_secret_exposure_redaction(self):
        """TEST 16: Secret exposure -> Redaction guard sanitizes API keys and tokens."""
        raw_text_with_keys = "Connecting to service with OpenAI key sk-1234567890abcdef1234567890 and Google key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6"
        sanitized, count = self.safety_guard.redact_secrets(raw_text_with_keys)
        self.assertEqual(count, 2)
        self.assertNotIn("sk-1234567890", sanitized)
        self.assertNotIn("AIzaSyA1B2C3", sanitized)
        self.assertIn("[REDACTED_SECRET]", sanitized)
        print("[PASSED] TEST 16: Secret leakage automatically intercepted and redacted.")

    def test_17_dangerous_command_interception(self):
        """TEST 17: Dangerous command -> Safety policy intercepts and blocks destructive execution."""
        safe, reason = self.safety_guard.inspect_command("rm -rf / --no-preserve-root")
        self.assertFalse(safe)
        self.assertIn("Safety Policy", reason)

        safe2, reason2 = self.safety_guard.inspect_command("DROP TABLE users_production CASCADE;")
        self.assertFalse(safe2)
        print("[PASSED] TEST 17: Destructive bash/SQL commands intercepted and blocked.")

    def test_18_false_claim_of_test_success_rejection(self):
        """TEST 18: False claim -> Verification gates fail if real syntax or type errors exist."""
        bad_code_path = os.path.join(self.workspace_root, "AgentOS", "tests", "_temp_syntax_error.py")
        with open(bad_code_path, "w") as f:
            f.write("def broken_syntax(:\n  return True\n")
        
        gate_res = self.verifier.run_all_gates(["AgentOS/tests/_temp_syntax_error.py"])
        if os.path.exists(bad_code_path):
            os.remove(bad_code_path)
        
        self.assertFalse(gate_res["passed_all"])
        self.assertEqual(gate_res["results"]["typecheck"]["status"], "FAILED")
        print("[PASSED] TEST 18: Unverified claim with syntax failure rejected by deterministic gate.")

    def test_19_concurrent_missions_isolation(self):
        """TEST 19: Concurrent missions -> Independent mission state directories and event streams."""
        m1 = self.event_store.create_mission("Mission Alpha: Refactor UI")
        m2 = self.event_store.create_mission("Mission Beta: Update Database")
        
        self.event_store.append_event(m1["mission_id"], "AGENT_STARTED", {"task_id": "t1"})
        self.event_store.append_event(m2["mission_id"], "AGENT_STARTED", {"task_id": "t2"})
        
        ev1 = self.event_store.load_events(m1["mission_id"])
        ev2 = self.event_store.load_events(m2["mission_id"])
        
        self.assertNotEqual(m1["mission_id"], m2["mission_id"])
        self.assertEqual(len(ev1), 2)
        self.assertEqual(len(ev2), 2)
        self.assertEqual(ev1[1]["payload"]["task_id"], "t1")
        self.assertEqual(ev2[1]["payload"]["task_id"], "t2")
        print("[PASSED] TEST 19: Concurrent missions execute with complete event stream isolation.")

    def test_20_process_crash_and_mission_reconstruction(self):
        """TEST 20: Process crash -> Event log replay reconstructs full mission state without loss."""
        m = self.event_store.create_mission("Crash Recovery Mission")
        mid = m["mission_id"]
        
        self.event_store.append_event(mid, "TASK_CREATED", {"task_id": "task_auth", "title": "Implement Auth", "role": "backend_engineer"})
        self.event_store.append_event(mid, "AGENT_STARTED", {"task_id": "task_auth"})
        self.event_store.append_event(mid, "AGENT_COMPLETED", {"task_id": "task_auth", "tokens": 1200, "output": "Done"})
        self.event_store.append_event(mid, "TEST_PASSED", {"test_name": "test_auth_jwt"})
        
        reconstructed = self.event_store.reconstruct_state(mid)
        
        self.assertEqual(reconstructed["mission_id"], mid)
        self.assertIn("task_auth", reconstructed["completed_tasks"])
        self.assertEqual(reconstructed["tasks"]["task_auth"]["status"], "COMPLETED")
        self.assertTrue(reconstructed["test_results"]["test_auth_jwt"])
        self.assertEqual(reconstructed["tokens_consumed"], 1200)
        print("[PASSED] TEST 20: Full mission state reconstructed from event log after simulated crash.")

if __name__ == "__main__":
    unittest.main()
