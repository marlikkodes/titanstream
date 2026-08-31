"""
Master Acceptance Test Suite for Agent OS Phase II.
Executes and validates all Phase II intelligence, policy, confidence, replay, chaos,
red-team, and golden engineering benchmark suites in a unified runner.
"""

import sys
import os
import time
import unittest

workspace_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path.insert(0, workspace_root)
sys.path.insert(0, os.path.join(workspace_root, "AgentOS"))

# Import all suites
from tests.agent_os.test_suite_all_40 import TestAntigravitySuperengineeringOS40
from AgentOS.tests.self.test_self_subsystems import TestAgentOSSelfSubsystems
from AgentOS.tests.chaos.test_chaos_injection import TestAgentOSChaosInjection
from AgentOS.tests.redteam.test_adversarial_security import TestAgentOSRedTeam
from AgentOS.benchmarks.golden_missions.test_golden_missions import TestGoldenEngineeringMissions

def build_phase2_master_suite() -> unittest.TestSuite:
    suite = unittest.TestSuite()
    loader = unittest.TestLoader()

    # 1. Base 40 Acceptance Tests
    suite.addTests(loader.loadTestsFromTestCase(TestAntigravitySuperengineeringOS40))

    # 2. Phase II Self-Tests
    suite.addTests(loader.loadTestsFromTestCase(TestAgentOSSelfSubsystems))

    # 3. Phase II Chaos Engineering
    suite.addTests(loader.loadTestsFromTestCase(TestAgentOSChaosInjection))

    # 4. Phase II Red Team Security
    suite.addTests(loader.loadTestsFromTestCase(TestAgentOSRedTeam))

    # 5. Phase II 10 Golden Missions
    suite.addTests(loader.loadTestsFromTestCase(TestGoldenEngineeringMissions))

    return suite

if __name__ == "__main__":
    print("=" * 70)
    print("ANTIGRAVITY AGENT OS PHASE II — MASTER ACCEPTANCE CERTIFICATION SUITE")
    print("=" * 70)
    start_time = time.time()
    runner = unittest.TextTestRunner(verbosity=2)
    master_suite = build_phase2_master_suite()
    result = runner.run(master_suite)
    duration = time.time() - start_time

    print("\n" + "=" * 70)
    print(f"Total Tests Run: {result.testsRun}")
    print(f"Errors: {len(result.errors)}, Failures: {len(result.failures)}")
    print(f"Total Execution Duration: {duration:.3f}s")
    print(f"Status: {'PASSED (100% GREEN)' if result.wasSuccessful() else 'FAILED'}")
    print("=" * 70)

    sys.exit(0 if result.wasSuccessful() else 1)
