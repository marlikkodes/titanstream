"""
Comprehensive 60-Point Acceptance Test Suite for Antigravity Superengineering OS.
Verifies all 60 adaptive intelligence, risk prediction, reputation, counterfactual,
mutation, invariants, MCP circuit breaker, cache, and economics capabilities end-to-end.
"""

import sys
import os

# Root paths
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
from AgentOS.engine.mission.mission_compiler import MissionCompiler
from AgentOS.engine.safety.policy_guard import SafetyGuard, TOOL_PROFILES
from AgentOS.engine.safety.hooks import HookEngine
from AgentOS.engine.safety.capability_firewall import CapabilityFirewall, ActionDescriptor, Decision
from AgentOS.engine.safety.scope_governor import ScopeGovernor, ScopeClassification
from AgentOS.engine.orchestration.merge_guardian import MergeGuardian
from AgentOS.engine.orchestration.mission_learning import MissionLearningEngine
from AgentOS.engine.intelligence.interface import CodeIntelligence
from AgentOS.engine.intelligence.impact.impact_analyzer import ImpactAnalyzer
from AgentOS.engine.intelligence.ast.structural_editor import StructuralEditor
from AgentOS.engine.repository.knowledge_graph import KnowledgeGraph
from AgentOS.engine.repository.onboarding import RepositoryOnboarding
from AgentOS.engine.repository.digital_twin import DigitalTwin
from AgentOS.engine.context.context_engine_v2 import ContextEngineV2
from AgentOS.engine.economics.model_router import ModelRouter, ComplexityTier
from AgentOS.engine.economics.telemetry_v2 import EconomicTelemetry
from AgentOS.engine.economics.agent_reputation import AgentReputationEngine
from AgentOS.engine.economics.model_performance import ModelPerformanceMemory
from AgentOS.engine.economics.superengineering_score import SuperengineeringScore
from AgentOS.engine.browser.browser_engine import BrowserEngine
from AgentOS.engine.security.security_engine import SecurityEngine
from AgentOS.engine.verification.evidence_engine import EvidenceEngine
from AgentOS.engine.verification.counterfactual_engine import CounterfactualEngine
from AgentOS.engine.recovery.rollback_manager import RollbackManager
from AgentOS.engine.diagnostics.doctor import AgentOSDoctor
from AgentOS.engine.risk.predictive_risk import PredictiveRiskEngine, RiskClass
from AgentOS.engine.optimization.change_minimizer import ChangeMinimizer
from AgentOS.engine.testing.mutation_engine import MutationTestingEngine
from AgentOS.engine.runtime.golden_traces import GoldenTraceSystem
from AgentOS.engine.runtime.shadow_mode import ProductionShadowMode
from AgentOS.engine.architecture.invariants import ArchitectureInvariantsEngine
from AgentOS.engine.mcp.mcp_control_plane import MCPControlPlane, CircuitState
from AgentOS.engine.tools.batch_executor import BatchToolExecutor
from AgentOS.engine.cache.semantic_cache import SemanticCache
from AgentOS.workers.swe_worker import SWEWorker
from AgentOS.workers.openhands_worker import OpenHandsWorker

class TestAntigravitySuperengineeringOS60(unittest.TestCase):
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
        self.compiler = MissionCompiler(self.workspace_root)
        self.risk_engine = PredictiveRiskEngine(self.workspace_root)
        self.reputation_engine = AgentReputationEngine(self.workspace_root)
        self.model_perf = ModelPerformanceMemory(self.workspace_root)
        self.scope_gov = ScopeGovernor(self.workspace_root)
        self.minimizer = ChangeMinimizer()
        self.counterfactual = CounterfactualEngine()
        self.mutation_engine = MutationTestingEngine()
        self.golden_traces = GoldenTraceSystem(self.workspace_root)
        self.shadow_mode = ProductionShadowMode(enabled=True)
        self.invariants = ArchitectureInvariantsEngine(self.workspace_root)
        self.mcp_ctrl = MCPControlPlane()
        self.batch_tools = BatchToolExecutor(self.workspace_root)
        self.cache = SemanticCache()
        self.digital_twin = DigitalTwin(self.workspace_root)
        self.mission_learning = MissionLearningEngine()
        self.score_engine = SuperengineeringScore()

    # --- Tests 1 to 20 ---
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

    # --- Tests 21 to 40 ---
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

    # --- Tests 41 to 60 (Superengineering IV Adaptive Capabilities) ---
    def test_41_predictive_risk_engine(self):
        """TEST 41: Predictive Risk Engine scores production database changes as CRITICAL."""
        risk = self.risk_engine.evaluate_risk(["schema.sql"], "Drop production database table", is_production=True)
        self.assertTrue(risk["risk_score"] >= 80)
        self.assertEqual(risk["risk_class"], RiskClass.CRITICAL.value)

    def test_42_agent_reputation_routing(self):
        """TEST 42: Agent Reputation tracks first-pass success and domain mastery."""
        self.reputation_engine.record_agent_task("backend_engineer", "auth", True, 0, 1000, 1.5, False)
        score = self.reputation_engine.get_agent_score("backend_engineer", "auth")
        self.assertTrue(score >= 0.8)

    def test_43_model_learning_and_performance(self):
        """TEST 43: Model Performance Memory records success rates across task tiers."""
        self.model_perf.record_outcome("gemini-2.5-flash", "T2_STANDARD", True, 0.002)
        rate = self.model_perf.get_success_rate("gemini-2.5-flash", "T2_STANDARD")
        self.assertEqual(rate, 1.0)

    def test_44_scope_expansion_detection(self):
        """TEST 44: Scope Governor halts missions on unannounced 10x blast radius expansion."""
        planned = ["src/auth.ts"]
        proposed = [f"src/unrelated_{i}.ts" for i in range(25)]
        audit = self.scope_gov.audit_proposed_changes(planned, proposed)
        self.assertEqual(audit["action"], "REPLAN_REQUIRED")
        self.assertTrue(audit["is_explosion"])

    def test_45_change_minimization_and_trimming(self):
        """TEST 45: Change Minimizer flags unnecessary whitespace churn in patches."""
        orig = "def add(a, b):\n    return a + b\n"
        bloated = "def add(a, b):   \n    return a + b  \n"
        eval_res = self.minimizer.evaluate_patch_economy(orig, bloated, "math.py")
        self.assertTrue(eval_res["whitespace_churn"] > 0)
        self.assertEqual(eval_res["recommendation"], "TRIM_UNNECESSARY_DIFFS")

    def test_46_counterfactual_verification(self):
        """TEST 46: Counterfactual Engine tests edge-case hypotheses."""
        res = self.counterfactual.evaluate_hypothesis_resilience("Stale auth session token", "auth", lambda case: True)
        self.assertEqual(res["status"], "RESILIENT")
        self.assertTrue(res["total_counterfactuals"] >= 3)

    def test_47_mutation_testing_engine(self):
        """TEST 47: Mutation Testing checks whether mutant code fails test assertions."""
        code = "def is_valid(x):\n    return x >= 10\n"
        res = self.mutation_engine.evaluate_test_suite_strength(code, lambda mutant_code: False) # mutant caught
        self.assertEqual(res["test_suite_quality"], "STRONG")
        self.assertEqual(res["kill_ratio"], 1.0)

    def test_48_golden_trace_record_and_replay(self):
        """TEST 48: Golden Trace System records and deterministically replays critical path."""
        self.golden_traces.record_trace("tr_auth_01", "UserLogin", {"user": "alice"}, {"status": "AUTH_OK"}, ["token_present"])
        replay = self.golden_traces.replay_trace("tr_auth_01", lambda inp: {"status": "AUTH_OK"})
        self.assertEqual(replay["status"], "REPLAY_VERIFIED")

    def test_49_architecture_invariant_violation(self):
        """TEST 49: Architecture Invariants Engine rejects raw SQL in controllers."""
        bad_controller = "import sqlite3\ndef handle_req(): sqlite3.connect('db.db')\n"
        violations = self.invariants.check_layer_invariants("src/controllers/user_controller.py", bad_controller)
        self.assertTrue(len(violations) > 0)
        self.assertEqual(violations[0]["rule"], "CONTROLLERS_CANNOT_ACCESS_DB_DIRECTLY")

    def test_50_mcp_circuit_breaker(self):
        """TEST 50: MCP Control Plane trips circuit breaker to OPEN upon repeated errors."""
        self.mcp_ctrl.register_server("database_mcp", ["query_db"], "local_sqlite")
        for _ in range(3):
            self.mcp_ctrl.record_call("database_mcp", 0.5, success=False)
        target_info = self.mcp_ctrl.get_routing_target("database_mcp")
        self.assertEqual(target_info["state"], "CIRCUIT_OPEN")
        self.assertTrue(target_info["use_fallback"])

    def test_51_tool_batching_coalescing(self):
        """TEST 51: Batch Tool Executor combines symbol and impact lookups into 1 query."""
        res = self.batch_tools.execute_code_bundle_query("AgentOS/engine/agent_os_core.py", search_symbol="AgentContractInput")
        self.assertTrue(res["symbols_count"] > 0)
        self.assertEqual(res["batched_calls_saved"], 3)

    def test_52_semantic_cache_invalidation(self):
        """TEST 52: Semantic Cache returns cached data and invalidates on dependent file edit."""
        self.cache.set("ast:user.py", {"ast": "tree"}, dependencies=["user.py"])
        self.assertIsNotNone(self.cache.get("ast:user.py"))
        self.cache.invalidate_file("user.py")
        self.assertIsNone(self.cache.get("ast:user.py"))

    def test_53_failure_similarity_retrieval(self):
        """TEST 53: Failure Memory similarity search retrieves known historical root causes."""
        self.failure_mem.record_defect("d101", "JWT token expired on refresh", "Clock drift in token verifier", "Add 60s leeway", "test_jwt_leeway")
        matches = self.failure_mem.search_similar_defects("JWT token refresh issue")
        self.assertTrue(len(matches) > 0)
        self.assertIn("Clock drift", matches[0]["root_cause"])

    def test_54_mission_dag_optimization(self):
        """TEST 54: Mission Learning compares planned vs executed DAG to identify waste."""
        learn = self.mission_learning.evaluate_mission_execution(["t1", "t2", "t3"], ["t1", "t2"], retries_count=0, context_tokens=4000)
        self.assertIn("t3", learn["unnecessary_tasks"])
        self.assertTrue(len(learn["orchestration_recommendations"]) > 0)

    def test_55_hotspot_detection(self):
        """TEST 55: Digital Twin computes dynamic hotspot scores for heavily-coupled files."""
        hotspot = self.digital_twin.get_hotspot_score("AgentOS/engine/agent_os_core.py", churn_count=10, failure_history=2)
        self.assertTrue(hotspot["hotspot_score"] > 0)
        self.assertIn("recommended_treatment", hotspot)

    def test_56_adaptive_multi_agent_routing(self):
        """TEST 56: Mission Compiler provisions multi-agent reviewer teams for critical tasks."""
        spec = self.compiler.compile("Drop production table and migrate database")
        self.assertEqual(spec.risk_level, "CRITICAL")
        self.assertTrue(len(spec.candidate_agents) >= 2)

    def test_57_predictive_verification(self):
        """TEST 57: Mission Compiler selects minimal sufficient verification depth."""
        spec_low = self.compiler.compile("Update CSS button background color")
        self.assertEqual(spec_low.verification_depth, "MINIMAL_LINT_AND_TEST")
        spec_crit = self.compiler.compile("Modify production JWT signing secret")
        self.assertEqual(spec_crit.verification_depth, "FULL_SECURITY_AND_REGRESSION")

    def test_58_production_shadow_blocking(self):
        """TEST 58: Production Shadow Mode detects behavioral divergence and blocks release."""
        res = self.shadow_mode.run_shadow_comparison({"x": 1}, lambda inp: {"out": 1}, lambda inp: {"out": 2})
        self.assertTrue(res["divergence_detected"])
        self.assertTrue(res["release_blocked"])

    def test_59_self_healing_doctor(self):
        """TEST 59: Agent OS Doctor self_heal automatically restores state and traces dirs."""
        heal_res = self.doctor.self_heal()
        self.assertEqual(heal_res["status"], "HEALED")
        self.assertTrue(len(heal_res["actions_taken"]) >= 3)

    def test_60_token_optimization_score(self):
        """TEST 60: Superengineering Score produces composite mission score and grade."""
        score = self.score_engine.calculate_mission_score(
            tests_passed=True, repairs_count=0, human_interruptions=0,
            tokens_used=2000, latency_seconds=3.5, scope_expanded=False
        )
        self.assertTrue(score["superengineering_score"] >= 90)
        self.assertIn(score["grade"], ["A", "A+"])

if __name__ == "__main__":
    unittest.main()
