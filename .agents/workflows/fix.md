# Workflow: /fix
Autonomous defect repair workflow.

## Steps
1. **Discover & Classify**: Scan repository and identify target subsystem.
2. **Failure Memory Search**: Query `.agents/memory/failure_memory.json` for prior solutions.
3. **Execute 8-Step Repair Loop**:
   - Observe symptom
   - Reproduce via test command
   - Trace and isolate minimal function
   - Formulate hypothesis (Attempt 1-3)
   - Apply minimal patch
   - Verify reproduction passes
   - Author regression test
4. **Verification Gates**: Execute typecheck, lint, and security scan.
5. **Report Result**: Present concise outcome.
