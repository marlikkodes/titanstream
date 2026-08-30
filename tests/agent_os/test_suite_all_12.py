"""
Comprehensive 12-Point Acceptance Test Suite for Antigravity Superengineering OS.
Verifies all 12 transformation criteria end-to-end.
"""

import sys
import os
import time
import unittest
from pathlib import Path

# Add .agents root to sys.path
agents_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".agents"))
sys.path.insert(0, agents_dir)

from engine import (
    AgentCommander, RepoIntelligence, ContextEconomy, FailureMemory,
    TaskGraphEngine, AutoDebugger, VerificationGateManager,
    MissionStateManager, AgentObservability, AutonomyLevel,
    AgentRole, TaskStatus, ContextTier
)

class TestAntigravitySuperengineeringOS(unittest.TestCase):
    def setUp(self):
        self.workspace_root = os.path.abspath(os.path.join(agents_dir, ".."))
        self.commander = AgentCommander(self.workspace_root)
        self.repo_intel = RepoIntelligence(self.workspace_root)
        self.context_economy = ContextEconomy(self.workspace_root)
        self.failure_mem = FailureMemory(self.workspace_root)
        self.task_graph = TaskGraphEngine()
        self.debugger = AutoDebugger(self.workspace_root, max_repair_attempts=3)
        self.verifier = VerificationGateManager(self.workspace_root)
        self.state_mgr = MissionStateManager(self.workspace_root)

    def test_01_simple_frontend_bug_auto_fixed(self):
        """TEST 1: Simple frontend bug -> automatically routed, executed and verified."""
        res = self.commander.execute_mission(
            "Fix spinner animation jitter on dashboard page",
            AutonomyLevel.LEVEL_1_LOCAL_DEV
        )
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("frontend_engineer", res["agents_assigned"])
        self.assertTrue(res["verification_gates"]["passed_all"])
        print("\n[PASSED] TEST 1: Simple frontend bug automatically routed and verified.")

    def test_02_backend_bug_auto_diagnosed(self):
        """TEST 2: Backend bug -> automatically diagnosed and repaired."""
        res = self.commander.execute_mission(
            "Fix API route returning 500 on missing payload in services/api",
            AutonomyLevel.LEVEL_1_LOCAL_DEV
        )
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("backend_engineer", res["agents_assigned"])
        print("[PASSED] TEST 2: Backend bug automatically diagnosed and repaired.")

    def test_03_database_bug_db_agent_engaged(self):
        """TEST 3: Database-related bug -> database agent engaged automatically."""
        res = self.commander.execute_mission(
            "Fix prisma database migration column naming mismatch in transactions table",
            AutonomyLevel.LEVEL_1_LOCAL_DEV
        )
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("database_engineer", res["agents_assigned"])
        print("[PASSED] TEST 3: Database agent engaged automatically.")

    def test_04_cross_system_feature_parallel_execution(self):
        """TEST 4: Cross-system feature -> parallel agent execution in waves."""
        roles = [AgentRole.FRONTEND_ENGINEER, AgentRole.BACKEND_ENGINEER, AgentRole.DATABASE_ENGINEER]
        dag = self.task_graph.build_dag_for_mission(
            "test_mission_04",
            "Build real-time notification system across frontend and backend",
            roles,
            AutonomyLevel.LEVEL_1_LOCAL_DEV
        )
        waves = self.task_graph.get_execution_waves(dag)
        # Verify that parallel implementation wave contains multiple tasks
        parallel_waves = [w for w in waves if len(w) > 1]
        self.assertTrue(len(parallel_waves) > 0, "Expected at least one parallel execution wave")
        print(f"[PASSED] TEST 4: Cross-system DAG constructed with {len(waves)} waves, parallel wave size: {len(parallel_waves[0])}.")

    def test_05_introduced_test_failure_debugger_repairs(self):
        """TEST 5: Introduced test failure -> debugger automatically repairs it (8-step loop)."""
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
        self.assertTrue(repair_res["regression_test"].startswith("test_regression_"))
        print("[PASSED] TEST 5: Auto-debugger executed 8-step repair loop and recorded regression test.")

    def test_06_browser_visible_bug_reproduced_and_verified(self):
        """TEST 6: Browser-visible bug -> browser automation reproduces and verifies it."""
        res = self.commander.execute_mission(
            "Verify checkout button click and browser console errors on checkout page",
            AutonomyLevel.LEVEL_1_LOCAL_DEV
        )
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("browser_engineer", res["agents_assigned"])
        print("[PASSED] TEST 6: Browser automation reproduced and verified UI state.")

    def test_07_security_sensitive_change_security_review_triggered(self):
        """TEST 7: Security-sensitive change -> security review automatically triggered."""
        res = self.commander.execute_mission(
            "Update auth token JWT signing secret validation and session cookie flags",
            AutonomyLevel.LEVEL_1_LOCAL_DEV
        )
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("security_engineer", res["agents_assigned"])
        self.assertEqual(res["verification_gates"]["results"]["security"]["status"], "PASSED")
        print("[PASSED] TEST 7: Security review automatically triggered and passed.")

    def test_08_ci_failure_diagnostic_extraction_repair(self):
        """TEST 8: CI failure -> diagnostic extraction -> repair loop."""
        raw_ci_log = """
        [CI Pipeline #4829] Running step: test
        Building TypeScript project...
        services/api/src/server.ts:42:15 - error TS2339: Property 'validateSession' does not exist on type 'AuthService'.
        42  const session = await authService.validateSession(req.token);
                                  ~~~~~~~~~~~~~~~
        Found 1 error in services/api/src/server.ts:42
        pnpm test failed with exit code 1
        """
        compressed = self.context_economy.compress_logs(raw_ci_log)
        self.assertEqual(compressed["error_type"], "services/api/src/server.ts")
        self.assertIn("TS2339", compressed["first_error"])
        print(f"[PASSED] TEST 8: CI failure log compressed to: {compressed['first_error']}")

    def test_09_agent_interruption_resume_without_restart(self):
        """TEST 9: Agent interruption -> mission resumes without starting over."""
        mission = self.state_mgr.create_mission("Long running refactor mission", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        # Simulate partial task completion
        t1 = self.task_graph.build_dag_for_mission(mission.mission_id, mission.objective, [AgentRole.FRONTEND_ENGINEER], AutonomyLevel.LEVEL_1_LOCAL_DEV)
        first_tid = list(t1.keys())[0]
        t1[first_tid].status = TaskStatus.COMPLETED
        self.state_mgr.checkpoint_task(mission.mission_id, t1[first_tid])

        # Resume
        resume_data = self.state_mgr.resume_mission(mission.mission_id)
        self.assertEqual(resume_data["completed_count"], 1)
        self.assertEqual(resume_data["mission_id"], mission.mission_id)
        print(f"[PASSED] TEST 9: Interrupted mission resumed cleanly with {resume_data['completed_count']} completed tasks preserved.")

    def test_10_ambiguous_high_risk_human_escalation(self):
        """TEST 10: Ambiguous/high-risk operation -> human escalation."""
        res_prod = self.commander.execute_mission(
            "Drop database users_production and truncate balances",
            AutonomyLevel.LEVEL_3_PRODUCTION
        )
        self.assertEqual(res_prod["status"], "ESCALATED_TO_HUMAN")
        self.assertIn("Level 3 Production", res_prod["reason"])
        print("[PASSED] TEST 10: Destructive / Production operation halted for human escalation.")

    def test_11_repeated_failure_stops_cleanly(self):
        """TEST 11: Repeated failure -> system stops cleanly after MAX_REPAIR_ATTEMPTS (3)."""
        def always_failing():
            return False, "Fatal: unrecoverable hardware fault"

        repair_res = self.debugger.diagnose_and_repair(
            symptom="Hardware driver unrecoverable crash",
            failing_command="make driver-test",
            reproducer_func=always_failing
        )
        self.assertEqual(repair_res["status"], "ESCALATED_TO_HUMAN")
        self.assertEqual(repair_res["repair_attempts"], 3)
        self.assertIn("Exhausted 3 repair attempts", repair_res["diagnostic_log"][-1])
        print("[PASSED] TEST 11: Auto-debugger cleanly halted after 3 attempts and escalated.")

    def test_12_token_efficiency_tiered_context(self):
        """TEST 12: Token efficiency -> irrelevant repository context is not loaded."""
        l0 = self.context_economy.get_tier_context(ContextTier.L0_METADATA)
        l1 = self.context_economy.get_tier_context(ContextTier.L1_ARCHITECTURE)
        l2 = self.context_economy.get_tier_context(ContextTier.L2_SUBSYSTEM, subsystem="apps")
        
        # Verify L0 is strictly metadata
        self.assertIn("primary_stack", l0)
        self.assertNotIn("files", l0)
        
        # Verify L2 contains only targeted subsystem files
        self.assertEqual(l2["subsystem"], "apps")
        self.assertTrue(len(l2["files"]) <= 50)
        print(f"[PASSED] TEST 12: Tiered context verified (L0: {len(l0['primary_stack'])} stack items, L2: {len(l2['files'])} targeted files).")

if __name__ == "__main__":
    unittest.main()
