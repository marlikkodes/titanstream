import os
import re

engine_dir = "AgentOS/engine"

for root, _, files in os.walk(engine_dir):
    for f in files:
        if f.endswith(".py") and f != "__init__.py":
            fpath = os.path.join(root, f)
            with open(fpath, "r", encoding="utf-8") as file:
                content = file.read()
            
            # Replace relative imports with engine. imports or ..
            content = re.sub(r'from \.agent_os_core import', 'from engine.agent_os_core import', content)
            content = re.sub(r'from \.failure_memory import', 'from engine.memory.failure_memory import', content)
            content = re.sub(r'from \.context_tier import', 'from engine.context.tier_manager import', content)
            content = re.sub(r'from \.repo_intelligence import', 'from engine.repository.repo_graph import', content)
            content = re.sub(r'from \.task_graph import', 'from engine.routing.domain_detector import', content)
            content = re.sub(r'from \.auto_debugger import', 'from engine.diagnostics.auto_debugger import', content)
            content = re.sub(r'from \.verification_gates import', 'from engine.verification.deterministic_gates import', content)
            content = re.sub(r'from \.mission_state import', 'from engine.mission_state import', content)
            content = re.sub(r'from \.observability import', 'from engine.economics.token_tracker import', content)
            
            with open(fpath, "w", encoding="utf-8") as file:
                file.write(content)

print("Fixed imports across AgentOS/engine")
