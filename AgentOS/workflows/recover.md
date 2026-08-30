# Workflow: /recover
Mission state recovery and post-crash resumption.

## Steps
1. **Replay Event Log**: Load `events.jsonl` from current mission directory.
2. **Reconstruct State**: Restore completed tasks, active branches, and pending DAG nodes.
3. **Resume Execution**: Continue from the last valid checkpoint without restarting from zero.
