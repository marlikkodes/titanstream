# Workflow: /debug
Evidence-based diagnostic and root cause isolation workflow.

## Steps
1. **Log Ingestion & Compression**: Ingest raw failing output and extract stack traces.
2. **AST & Reference Tracing**: Trace call hierarchy in repository intelligence graph.
3. **Hypothesis Generation**: Formulate testable root causes.
4. **Targeted Verification**: Run minimal reproducer to validate hypothesis.
5. **Diagnostic Delivery**: Present findings and suggested fix.
