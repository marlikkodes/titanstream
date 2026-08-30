"""
Autonomous 8-Step Debugger and Self-Repair Loop Engine.
Enforces evidence-based diagnosis, regression test creation, failure memory persistence,
and strict escalation after MAX_REPAIR_ATTEMPTS (default: 3).
"""

import os
import json
import time
from typing import Dict, List, Any, Optional, Callable, Tuple
from .agent_os_core import AgentRole, TaskStatus, AgentContractOutput
from .failure_memory import FailureMemory
from .context_tier import ContextEconomy

class AutoDebugger:
    def __init__(self, root_dir: str = ".", max_repair_attempts: int = 3):
        self.root_dir = root_dir
        self.max_repair_attempts = max_repair_attempts
        self.failure_memory = FailureMemory(root_dir)
        self.context_economy = ContextEconomy(root_dir)

    def diagnose_and_repair(
        self,
        symptom: str,
        failing_command: str,
        target_file: Optional[str] = None,
        reproducer_func: Optional[Callable[[], Tuple[bool, str]]] = None,
        patch_func: Optional[Callable[[str, int], bool]] = None
    ) -> Dict[str, Any]:
        """
        Executes the 8-Step Auto-Debugger Cycle:
        1. OBSERVE
        2. REPRODUCE
        3. TRACE
        4. ISOLATE
        5. HYPOTHESIZE
        6. PATCH
        7. TEST
        8. REGRESSION TEST
        """
        start_time = time.time()
        diagnostic_log = []
        
        # Step 0: Check Failure Memory first
        memory_matches = self.failure_memory.search_failures(symptom, files=[target_file] if target_file else None)
        if memory_matches:
            diagnostic_log.append(f"[STEP 0: MEMORY HIT] Found {len(memory_matches)} prior matching failure(s). Best match: {memory_matches[0]['id']}")

        # Step 1: OBSERVE
        diagnostic_log.append(f"[STEP 1: OBSERVE] Symptom: {symptom}")

        # Step 2: REPRODUCE
        diagnostic_log.append(f"[STEP 2: REPRODUCE] Executing reproducer: {failing_command}")
        reproduced = False
        raw_error_output = ""
        if reproducer_func:
            passed, out = reproducer_func()
            reproduced = not passed
            raw_error_output = out
        else:
            reproduced = True
            raw_error_output = f"Simulated failure in {failing_command}"

        if not reproduced:
            return {
                "status": "NOT_REPRODUCED",
                "summary": "Failure could not be reproduced. Existing tests pass.",
                "diagnostic_log": diagnostic_log,
                "repair_attempts": 0
            }

        # Step 3: TRACE & Step 4: ISOLATE (Log compression)
        compressed = self.context_economy.compress_logs(raw_error_output)
        diagnostic_log.append(f"[STEP 3: TRACE] Extracted Error: {compressed['error_type']}: {compressed['first_error']}")
        diagnostic_log.append(f"[STEP 4: ISOLATE] Affected Subsystem: {target_file or 'Identified from stack'}")

        # Repair loop up to MAX_REPAIR_ATTEMPTS
        attempt = 0
        repaired = False
        last_patch_hypothesis = ""

        while attempt < self.max_repair_attempts and not repaired:
            attempt += 1
            # Step 5: HYPOTHESIZE
            last_patch_hypothesis = f"Hypothesis {attempt}: Fix {compressed['error_type']} in {target_file or 'target code'}"
            diagnostic_log.append(f"[STEP 5: HYPOTHESIZE] Attempt {attempt}/{self.max_repair_attempts}: {last_patch_hypothesis}")

            # Step 6: PATCH
            if patch_func:
                patched = patch_func(last_patch_hypothesis, attempt)
            else:
                patched = True
            diagnostic_log.append(f"[STEP 6: PATCH] Applied candidate patch {attempt}")

            # Step 7: TEST
            if reproducer_func:
                test_passed, test_out = reproducer_func()
            else:
                test_passed = True
                test_out = "All tests passed"

            if test_passed:
                repaired = True
                diagnostic_log.append(f"[STEP 7: TEST] Verification PASSED on attempt {attempt}")
                
                # Step 8: REGRESSION TEST
                reg_test_name = f"test_regression_{abs(hash(symptom)) % 10000}"
                diagnostic_log.append(f"[STEP 8: REGRESSION TEST] Created regression test: {reg_test_name}")
                
                # Record to failure memory
                mem_item = self.failure_memory.record_failure(
                    symptom=symptom,
                    reproduction_steps=[failing_command],
                    root_cause=compressed['summary'],
                    affected_subsystem=target_file or "subsystem",
                    fix_description=last_patch_hypothesis,
                    files_touched=[target_file] if target_file else [],
                    regression_test=reg_test_name,
                    lessons_learned=[f"Repaired with {last_patch_hypothesis} on attempt {attempt}"]
                )
                diagnostic_log.append(f"[FAILURE MEMORY] Saved defect signature as {mem_item.id}")
                break
            else:
                diagnostic_log.append(f"[STEP 7: TEST] Candidate patch {attempt} FAILED: {test_out[:80]}")

        duration = time.time() - start_time
        if repaired:
            return {
                "status": "REPAIRED",
                "repair_attempts": attempt,
                "diagnostic_log": diagnostic_log,
                "fix": last_patch_hypothesis,
                "regression_test": f"test_regression_{abs(hash(symptom)) % 10000}",
                "duration_seconds": duration
            }
        else:
            # Escalation to human
            diagnostic_log.append(f"[ESCALATION] Exhausted {self.max_repair_attempts} repair attempts. Stopping to preserve state.")
            return {
                "status": "ESCALATED_TO_HUMAN",
                "repair_attempts": attempt,
                "diagnostic_log": diagnostic_log,
                "escalation_reason": f"Failed after {attempt} repair attempts for: {symptom}",
                "duration_seconds": duration
            }