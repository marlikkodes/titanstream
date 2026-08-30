"""
Comprehensive 40-Point Acceptance Test Suite for Antigravity Superengineering OS.
Verifies all 40 harvest, autonomy, resilience, security, and economics capabilities end-to-end.
"""

import sys
import os

# Add root paths first
workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, workspace_root)
sys.path.insert(0, os.path.join(workspace_root, "AgentOS"))
sys.path.insert(0, os.path.join(workspace_root, ".agents"))

import time
import unittest
from pathlib import Path

from AgentOS.engine import (
    AgentCommander, RepoIntelligence, ContextEconomy, FailureMemory,
    TaskGraphEngine, AutoDebugger, VerificationGateManager,
    MissionStateManager, AgentObservability, AutonomyLevel,
    AgentRole, TaskStatus, ContextTier
)
from AgentOS.engine.mission.event_source import MissionEventStore
from AgentOS.engine.safety.policy_guard import SafetyGuard, TOOL_PROFILES
from AgentOS.engine.safety.hooks import HookEngine
from AgentOS.engine.safety.capability_firewall import CapabilityFirewall, ActionDescriptor, Decision
from AgentOS.engine.orchestration.merge_guardian import MergeGuardian
from AgentOS.engine.intelligence.interface import CodeIntelligence
from AgentOS.engine.intelligence.impact.impact_analyzer import ImpactAnalyzer
from AgentOS.engine.intelligence.ast.structural_editor import StructuralEditor
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph
from AgentOS.engine.repository.onboarding import RepositoryOnboarding
from AgentOS.engine.context.context_engine_v2 import ContextEngineV2
from AgentOS.engine.economics.model_router import ModelRouter, ComplexityTier
from AgentOS.engine.economics.telemetry_v2 import EconomicTelemetry
from AgentOS.engine.browser.browser_engine import BrowserEngine
from AgentOS.engine.security.security_engine import SecurityEngine
from AgentOS.engine.verification.evidence_engine import EvidenceEngine
from AgentOS.engine.recovery.rollback_manager import RollbackManager
from AgentOS.engine.diagnostics.doctor import AgentOSDoctor
from AgentOS.workers.swe_worker import SWEWorker
from AgentOS.workers.openhands_worker import OpenHandsWorker

class TestAntigravitySuperengineeringOS40(unittest.TestCase):
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
        self.firewall = CapabilityFirewall()
        self.code_intel = CodeIntelligence(self.workspace_root)
        self.impact_analyzer = ImpactAnalyzer(self.workspace_root)
        self.structural_editor = StructuralEditor(self.workspace_root)
        self.knowledge_graph = KnowledgeGraph(self.workspace_root)
        self.context_v2 = ContextEngineV2(self.workspace_root)
        self.model_router = ModelRouter()
        self.telemetry_v2 = EconomicTelemetry(self.workspace_root)
        self.browser_engine = BrowserEngine()
        self.security_engine = SecurityEngine(self.workspace_root)
        self.evidence_engine = EvidenceEngine(self.workspace_root)
        self.rollback_mgr = RollbackManager(self.workspace_root)
        self.doctor = AgentOSDoctor(self.workspace_root)
        self.swe_worker = SWEWorker(self.workspace_root)
        self.oh_worker = OpenHandsWorker(self.workspace_root)

    # --- Tests 1 to 10 ---
    def test_01_simple_frontend_bug(self):
        res = self.commander.execute_mission("Fix spinner animation jitter on dashboard page", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("frontend_engineer", res["agents_assigned"])

    def test_02_backend_bug(self):
        res = self.commander.execute_mission("Fix API route returning 500 on missing payload in services/api", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("backend_engineer", res["agents_assigned"])

    def test_03_database_bug(self):
        res = self.commander.execute_mission("Fix prisma database migration column naming mismatch in transactions table", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("database_engineer", res["agents_assigned"])

    def test_04_cross_system_feature(self):
        roles = [AgentRole.FRONTEND_ENGINEER, AgentRole.BACKEND_ENGINEER, AgentRole.DATABASE_ENGINEER]
        dag = self.task_graph.build_dag_for_mission("t4", "Build real-time notification system", roles, AutonomyLevel.LEVEL_1_LOCAL_DEV)
        waves = self.task_graph.get_execution_waves(dag)
        self.assertTrue(len([w for w in waves if len(w) > 1]) > 0)

    def test_05_test_failure_repair(self):
        calls = 0
        def reproducer():
            nonlocal calls
            calls += 1
            return (calls > 1), "Test result"
        rep = self.debugger.diagnose_and_repair("Failing test", "pytest", reproducer_func=reproducer)
        self.assertEqual(rep["status"], "REPAIRED")

    def test_06_browser_bug(self):
        res = self.commander.execute_mission("Verify checkout button click and browser console errors on checkout page", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("browser_engineer", res["agents_assigned"])

    def test_07_security_change(self):
        res = self.commander.execute_mission("Update auth token JWT signing secret validation and session cookie flags", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        self.assertEqual(res["status"], "COMPLETED")
        self.assertIn("security_engineer", res["agents_assigned"])

    def test_08_ci_failure_compression(self):
        raw = "error TS2339: Property 'validateSession' does not exist on type 'AuthService'."
        comp = self.context_economy.compress_logs(raw)
        self.assertIn("TS2339", comp["first_error"])

    def test_09_interruption_resume(self):
        m = self.state_mgr.create_mission("Interruption Test", AutonomyLevel.LEVEL_1_LOCAL_DEV)
        t = self.task_graph.build_dag_for_mission(m.mission_id, m.objective, [AgentRole.FRONTEND_ENGINEER], AutonomyLevel.LEVEL_1_LOCAL_DEV)
        t_id = list(t.keys())[0]
        t[t_id].status = TaskStatus.COMPLETED
        self.state_mgr.checkpoint_task(m.mission_id, t[t_id])
        res = self.state_mgr.resume_mission(m.mission_id)
        self.assertEqual(res["completed_count"], 1)

    def test_10_human_escalation_prod(self):
        res = self.commander.execute_mission("Drop database users_production", AutonomyLevel.LEVEL_3_PRODUCTION)
        self.assertEqual(res["status"], "ESCALATED_TO_HUMAN")

    # --- Tests 11 to 20 ---
    def test_11_repeated_failure_halt(self):
        rep = self.debugger.diagnose_and_repair("Unrecoverable error", "cmd", reproducer_func=lambda: (False, "Fatal crash"))
        self.assertEqual(rep["status"], "ESCALATED_TO_HUMAN")

    def test_12_context_economy_tiers(self):
        l0 = self.context_economy.get_tier_context(ContextTier.L0_METADATA)
        self.assertIn("primary_stack", l0)

    def test_13_agent_conflict_merge_guardian(self):
        outs = [{"agent": "a1", "files_changed": ["f1.py"]}, {"agent": "a2", "files_changed": ["f1.py"]}]
        res = MergeGuardian.detect_conflicts(outs)
        self.assertTrue(res["has_conflict"])

    def test_14_mcp_outage_fallback(self):
        res = self.hook_engine.tool_failure_hook("backend", "terminal", "ETIMEDOUT: Connection reset")
        self.assertEqual(res["classified_type"], "TRANSIENT")

    def test_15_context_overflow_compression(self):
        log = "\n".join([f"Trace {i}" for i in range(2000)]) + "\nError: Overflow\n"
        comp = self.context_economy.compress_logs(log, max_lines=15)
        self.assertTrue(len(comp["compressed_stack"]) <= 15)

    def test_16_secret_exposure_redaction(self):
        sanitized, c = self.safety_guard.redact_secrets("Secret sk-1234567890abcdef1234567890")
        self.assertEqual(c, 1)
        self.assertIn("[REDACTED_SECRET]", sanitized)

    def test_17_dangerous_command_blocked(self):
        safe, reason = self.safety_guard.inspect_command("rm -rf /")
        self.assertFalse(safe)

    def test_18_false_success_claim_rejected(self):
        tmp_err = os.path.join(self.workspace_root, "AgentOS", "tests", "_bad.py")
        with open(tmp_err, "w") as f:
            f.write("syntax error (:")
        res = self.verifier.run_all_gates(["AgentOS/tests/_bad.py"])
        os.remove(tmp_err)
        self.assertFalse(res["passed_all"])

    def test_19_concurrent_missions_isolation(self):
        m1 = self.event_store.create_mission("Mission 1")
        m2 = self.event_store.create_mission("Mission 2")
        self.assertNotEqual(m1["mission_id"], m2["mission_id"])

    def test_20_crash_recovery_event_log(self):
        m = self.event_store.create_mission("Crash Mission")
        self.event_store.append_event(m["mission_id"], "TASK_CREATED", {"task_id": "t1", "title": "T1"})
        self.event_store.append_event(m["mission_id"], "AGENT_COMPLETED", {"task_id": "t1", "tokens": 500})
        st = self.event_store.reconstruct_state(m["mission_id"])
        self.assertIn("t1", st["completed_tasks"])

    # --- Tests 21 to 30 ---
    def test_21_no_hint_debugging(self):
        roles = self.task_graph.route_mission("Users cannot complete checkout because session token expires immediately")
        self.assertIn(AgentRole.BACKEND_ENGINEER, roles)

    def test_22_semantic_dangerous_action_firewall(self):
        desc = ActionDescriptor(
            agent="database_engineer", action="drop_table", tool="db_client",
            target="users_table", environment="production", operation="drop",
            reversibility="irreversible", data_impact="production_data",
            security_impact="high", required_authority="L3_PROD"
        )
        decision, reason = self.firewall.authorize(desc)
        self.assertEqual(decision, Decision.DENY)

    def test_23_automatic_rollback(self):
        test_file = "AgentOS/tests/_temp_rollback_target.txt"
        abs_p = os.path.join(self.workspace_root, test_file)
        with open(abs_p, "w") as f:
            f.write("Pristine Version 1.0")

        self.rollback_mgr.create_snapshot("mission_test_rollback", [test_file])
        
        with open(abs_p, "w") as f:
            f.write("Corrupted State 2.0")

        res = self.rollback_mgr.rollback("mission_test_rollback")
        self.assertEqual(res["status"], "ROLLBACK_SUCCESSFUL")
        with open(abs_p, "r") as f:
            restored = f.read()
        os.remove(abs_p)
        self.assertEqual(restored, "Pristine Version 1.0")

    def test_24_adversarial_agent_unauthorized_tool(self):
        allowed, reason, _ = self.hook_engine.pre_tool_hook("repo_analyst", "destructive_database_drop", {})
        self.assertFalse(allowed)

    def test_25_secret_access_attempt(self):
        desc = ActionDescriptor(
            agent="hacker_agent", action="extract_secrets", tool="fs_read",
            target=".env.production", environment="production", operation="read",
            reversibility="high", data_impact="production_data",
            security_impact="high", required_authority="L3_PROD"
        )
        decision, _ = self.firewall.authorize(desc)
        self.assertEqual(decision, Decision.DENY)

    def test_26_policy_bypass_attempt(self):
        desc = ActionDescriptor(
            agent="subagent", action="modify_security_policy", tool="file_edit",
            target="safety_policy.json", environment="local_dev", operation="write",
            reversibility="medium", data_impact="local_file",
            security_impact="policy_modification", required_authority="L2_STAGING"
        )
        decision, _ = self.firewall.authorize(desc)
        self.assertEqual(decision, Decision.REQUIRE_APPROVAL)

    def test_27_mcp_timeout_fallback(self):
        res = self.hook_engine.tool_failure_hook("devops", "mcp_client", "Gateway Timeout 504")
        self.assertEqual(res["action"], "RETRY_WITH_BACKOFF")

    def test_28_malformed_mcp_response(self):
        res = self.hook_engine.tool_failure_hook("devops", "mcp_client", "JSONDecodeError: Unterminated string")
        self.assertEqual(res["classified_type"], "PERMANENT")

    def test_29_non_idempotent_tool_failure_safety(self):
        res = self.hook_engine.tool_failure_hook("payment_engineer", "charge_card_api", "Payment processing error")
        self.assertEqual(res["classified_type"], "PERMANENT")

    def test_30_budget_exhaustion_telemetry(self):
        self.telemetry_v2.record_mission_economics("m_budget", prompt_tokens=15000, completion_tokens=3000, tool_calls=4, repairs=1)
        summary = self.telemetry_v2.get_summary()
        self.assertTrue(summary["total_prompt_tokens"] >= 15000)

    # --- Tests 31 to 40 (Harvest Superpowers) ---
    def test_31_large_repo_knowledge_graph(self):
        graph_stats = self.knowledge_graph.build_graph()
        self.assertTrue(graph_stats["total_nodes"] > 0)
        self.assertTrue(graph_stats["total_edges"] > 0)

    def test_32_unfamiliar_framework_onboarding(self):
        onboarding = RepositoryOnboarding("AgentOS/benchmarks/python_flask")
        config = onboarding.onboard()
        self.assertEqual(config["framework"], "flask")
        self.assertEqual(config["language"], "python")

    def test_33_unfamiliar_language_onboarding(self):
        onboarding = RepositoryOnboarding("AgentOS/benchmarks/react_vite_app")
        config = onboarding.onboard()
        self.assertIn(config["language"], ["typescript", "javascript"])

    def test_34_model_outage_fallback(self):
        route_info = self.model_router.route("Perform critical architecture redesign", ["architecture", "security"])
        self.assertEqual(route_info["tier"], ComplexityTier.T4_CRITICAL.value)
        self.assertTrue(len(route_info["fallbacks"]) > 0)

    def test_35_browser_page_state_verification(self):
        res = self.browser_engine.verify_page_state("http://localhost:3000/dashboard", ["#main-header", ".spinner"])
        self.assertEqual(res["status"], "VERIFIED")
        self.assertEqual(len(res["console_errors"]), 0)

    def test_36_dependency_vulnerability_security_engine(self):
        tmp_sec = os.path.join(self.workspace_root, "AgentOS", "tests", "_sec_vuln.py")
        with open(tmp_sec, "w") as f:
            f.write("def run_query(user_input): execute('SELECT * FROM users WHERE name = %s' % user_input)\n")
        
        scan_res = self.security_engine.scan_repository(["AgentOS/tests/_sec_vuln.py"])
        os.remove(tmp_sec)
        self.assertEqual(scan_res["status"], "VULNERABILITIES_FOUND")
        self.assertTrue(scan_res["total_findings"] > 0)

    def test_37_structural_ast_refactor(self):
        target = "AgentOS/tests/_temp_refactor.py"
        abs_p = os.path.join(self.workspace_root, target)
        with open(abs_p, "w") as f:
            f.write("def old_compute_sum(a, b):\n    return a + b\n")

        res = self.structural_editor.replace_function_signature(target, "old_compute_sum", "new_compute_total", ["a", "b", "c=0"])
        self.assertEqual(res["status"], "REFACTOR_SUCCESS")
        with open(abs_p, "r") as f:
            code = f.read()
        os.remove(abs_p)
        self.assertIn("def new_compute_total(a, b, c=0):", code)

    def test_38_impact_analyzer_blast_radius(self):
        impact = self.impact_analyzer.analyze_impact("AgentOS/engine/agent_os_core.py")
        self.assertIn("risk_level", impact)
        self.assertIn("recommended_verification_depth", impact)

    def test_39_self_diagnosis_doctor(self):
        diag = self.doctor.run_health_check()
        self.assertEqual(diag["overall_status"], "HEALTHY")
        self.assertTrue(diag["checks"]["agents"]["count"] >= 15)

    def test_40_agent_os_self_repair(self):
        swe_res = self.swe_worker.solve_issue("Fix broken import in module", "pytest tests")
        self.assertEqual(swe_res["status"], "RESOLVED")
        
        oh_res = self.oh_worker.execute_task("Run environment inspection")
        self.assertEqual(oh_res["status"], "COMPLETED")

if __name__ == "__main__":
    unittest.main()
