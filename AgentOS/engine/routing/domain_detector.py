"""
Task Graph and DAG Engine for Antigravity Superengineering OS.
Constructs mission dependency graphs, determines topological execution waves,
routes tasks to the minimal competent agent set, and parallelizes independent work.
"""

import os
import json
import uuid
import time
from typing import Dict, List, Set, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from engine.agent_os_core import AgentRole, TaskNode, TaskStatus, AgentContractInput, AgentContractOutput, AutonomyLevel

class TaskGraphEngine:
    def __init__(self):
        self.routing_rules = {
            "frontend_bug": [AgentRole.FRONTEND_ENGINEER, AgentRole.BROWSER_ENGINEER, AgentRole.QA_ENGINEER],
            "backend_bug": [AgentRole.BACKEND_ENGINEER, AgentRole.DEBUGGER, AgentRole.TEST_ENGINEER],
            "database_issue": [AgentRole.DATABASE_ENGINEER, AgentRole.BACKEND_ENGINEER, AgentRole.QA_ENGINEER],
            "cross_system_feature": [AgentRole.ARCHITECT, AgentRole.FRONTEND_ENGINEER, AgentRole.BACKEND_ENGINEER, AgentRole.INTEGRATION_ENGINEER, AgentRole.QA_ENGINEER],
            "security_change": [AgentRole.SECURITY_ENGINEER, AgentRole.BACKEND_ENGINEER, AgentRole.CODE_REVIEWER],
            "performance_issue": [AgentRole.PERFORMANCE_ENGINEER, AgentRole.BACKEND_ENGINEER],
            "release_deployment": [AgentRole.DEVOPS_ENGINEER, AgentRole.SECURITY_ENGINEER, AgentRole.QA_ENGINEER],
            "general_feature": [AgentRole.ARCHITECT, AgentRole.REPO_ANALYST, AgentRole.BACKEND_ENGINEER, AgentRole.FRONTEND_ENGINEER, AgentRole.QA_ENGINEER]
        }

    def route_mission(self, intent: str, affected_subsystems: Optional[List[str]] = None) -> List[AgentRole]:
        """Select the smallest competent agent set for a given intent."""
        intent_lower = intent.lower()
        if any(k in intent_lower for k in ["ui", "css", "component", "button", "frontend", "browser", "page", "render"]):
            if "backend" not in intent_lower and "api" not in intent_lower and "database" not in intent_lower:
                return self.routing_rules["frontend_bug"]
        if any(k in intent_lower for k in ["database", "sql", "prisma", "migration", "schema", "table", "query"]):
            return self.routing_rules["database_issue"]
        if any(k in intent_lower for k in ["security", "auth", "permission", "token", "vulnerability", "secret", "cve"]):
            return self.routing_rules["security_change"]
        if any(k in intent_lower for k in ["slow", "memory leak", "latency", "performance", "profile", "bottleneck"]):
            return self.routing_rules["performance_issue"]
        if any(k in intent_lower for k in ["deploy", "ci", "docker", "release", "github actions", "railway", "pipeline"]):
            return self.routing_rules["release_deployment"]
        if any(k in intent_lower for k in ["full", "cross", "integration", "end-to-end", "system"]) or (affected_subsystems and len(affected_subsystems) > 1):
            return self.routing_rules["cross_system_feature"]
        if any(k in intent_lower for k in ["api", "server", "backend", "route", "controller", "service", "endpoint"]):
            return self.routing_rules["backend_bug"]
        return self.routing_rules["general_feature"]

    def build_dag_for_mission(self, mission_id: str, objective: str, roles: List[AgentRole], autonomy_level: AutonomyLevel) -> Dict[str, TaskNode]:
        """Construct a structured DAG representing the mission's execution graph."""
        tasks: Dict[str, TaskNode] = {}
        
        # Phase 1: Planning / Analysis (Architect or Repo Analyst)
        plan_id = f"task_plan_{uuid.uuid4().hex[:6]}"
        lead_role = AgentRole.ARCHITECT if AgentRole.ARCHITECT in roles else (AgentRole.REPO_ANALYST if AgentRole.REPO_ANALYST in roles else roles[0])
        tasks[plan_id] = TaskNode(
            id=plan_id,
            title=f"Architecture & Analysis for: {objective[:40]}",
            description=f"Analyze requirements and plan implementation for {objective}",
            agent_role=lead_role,
            dependencies=[],
            contract_input=AgentContractInput(
                task_id=plan_id,
                objective=objective,
                scope=["planning", "architecture"],
                constraints=["minimal blast radius", "preserve existing behavior"],
                relevant_files=[],
                autonomy_level=autonomy_level
            )
        )

        # Phase 2: Parallel Implementation Tasks
        impl_task_ids = []
        impl_roles = [r for r in roles if r in [AgentRole.FRONTEND_ENGINEER, AgentRole.BACKEND_ENGINEER, AgentRole.DATABASE_ENGINEER, AgentRole.DEVOPS_ENGINEER, AgentRole.DEBUGGER]]
        if not impl_roles:
            impl_roles = [roles[0]]

        for r in impl_roles:
            task_id = f"task_{r.value}_{uuid.uuid4().hex[:6]}"
            impl_task_ids.append(task_id)
            tasks[task_id] = TaskNode(
                id=task_id,
                title=f"{r.value.replace('_', ' ').title()} Implementation",
                description=f"Execute {r.value} scope for {objective}",
                agent_role=r,
                dependencies=[plan_id],
                contract_input=AgentContractInput(
                    task_id=task_id,
                    objective=objective,
                    scope=[r.value],
                    constraints=["deterministic tests required"],
                    relevant_files=[],
                    dependencies=[plan_id],
                    autonomy_level=autonomy_level
                )
            )

        # Phase 3: Integration (if cross-system)
        prev_deps = impl_task_ids
        if AgentRole.INTEGRATION_ENGINEER in roles and len(impl_task_ids) > 1:
            integ_id = f"task_integ_{uuid.uuid4().hex[:6]}"
            tasks[integ_id] = TaskNode(
                id=integ_id,
                title="Cross-System Integration Verification",
                description="Verify module interfaces, contracts, and data flows",
                agent_role=AgentRole.INTEGRATION_ENGINEER,
                dependencies=impl_task_ids,
                contract_input=AgentContractInput(
                    task_id=integ_id,
                    objective="Verify integration",
                    scope=["integration"],
                    constraints=["no contract breaks"],
                    relevant_files=[],
                    dependencies=impl_task_ids,
                    autonomy_level=autonomy_level
                )
            )
            prev_deps = [integ_id]

        # Phase 4: QA & Security Review (Parallel)
        verify_ids = []
        if AgentRole.QA_ENGINEER in roles or AgentRole.BROWSER_ENGINEER in roles or AgentRole.TEST_ENGINEER in roles:
            qa_id = f"task_qa_{uuid.uuid4().hex[:6]}"
            qa_role = AgentRole.BROWSER_ENGINEER if AgentRole.BROWSER_ENGINEER in roles else AgentRole.QA_ENGINEER
            tasks[qa_id] = TaskNode(
                id=qa_id,
                title="QA & Regression Verification",
                description="Run test suites, edge case verification, and regression tests",
                agent_role=qa_role,
                dependencies=prev_deps,
                contract_input=AgentContractInput(
                    task_id=qa_id,
                    objective="QA Verification",
                    scope=["qa", "testing"],
                    constraints=["100% pass required"],
                    relevant_files=[],
                    dependencies=prev_deps,
                    autonomy_level=autonomy_level
                )
            )
            verify_ids.append(qa_id)

        if AgentRole.SECURITY_ENGINEER in roles or AgentRole.CODE_REVIEWER in roles:
            sec_id = f"task_sec_{uuid.uuid4().hex[:6]}"
            sec_role = AgentRole.SECURITY_ENGINEER if AgentRole.SECURITY_ENGINEER in roles else AgentRole.CODE_REVIEWER
            tasks[sec_id] = TaskNode(
                id=sec_id,
                title="Security & Red-Team Code Audit",
                description="Audit changes for secrets, vulnerabilities, and architectural integrity",
                agent_role=sec_role,
                dependencies=prev_deps,
                contract_input=AgentContractInput(
                    task_id=sec_id,
                    objective="Security Audit",
                    scope=["security", "audit"],
                    constraints=["zero secret leaks", "OWASP compliance"],
                    relevant_files=[],
                    dependencies=prev_deps,
                    autonomy_level=autonomy_level
                )
            )
            verify_ids.append(sec_id)

        return tasks

    def get_execution_waves(self, tasks: Dict[str, TaskNode]) -> List[List[str]]:
        """Group task IDs into topological execution waves for parallel processing."""
        waves = []
        completed: Set[str] = set()
        remaining = set(tasks.keys())

        while remaining:
            current_wave = []
            for tid in remaining:
                node = tasks[tid]
                # Check if all dependencies are satisfied
                if all(dep in completed for dep in node.dependencies):
                    current_wave.append(tid)

            if not current_wave:
                # Cyclic dependency safeguard: pick first available
                current_wave.append(list(remaining)[0])

            waves.append(current_wave)
            for tid in current_wave:
                completed.add(tid)
                remaining.remove(tid)

        return waves

    def execute_dag(
        self,
        tasks: Dict[str, TaskNode],
        executor_func: Callable[[TaskNode], AgentContractOutput],
        max_workers: int = 4
    ) -> Dict[str, TaskNode]:
        """Execute tasks wave by wave, parallelizing independent tasks within each wave."""
        waves = self.get_execution_waves(tasks)
        for wave in waves:
            if len(wave) == 1:
                tid = wave[0]
                node = tasks[tid]
                node.status = TaskStatus.RUNNING
                out = executor_func(node)
                node.contract_output = out
                node.status = out.status
                node.completed_at = time.time()
                if out.status == TaskStatus.FAILED:
                    node.error_message = out.summary
            else:
                # Parallel execution of independent tasks
                with ThreadPoolExecutor(max_workers=min(len(wave), max_workers)) as executor:
                    futures = {}
                    for tid in wave:
                        node = tasks[tid]
                        node.status = TaskStatus.RUNNING
                        futures[executor.submit(executor_func, node)] = node
                    
                    for fut in as_completed(futures):
                        node = futures[fut]
                        try:
                            out = fut.result()
                            node.contract_output = out
                            node.status = out.status
                            node.completed_at = time.time()
                            if out.status == TaskStatus.FAILED:
                                node.error_message = out.summary
                        except Exception as e:
                            node.status = TaskStatus.FAILED
                            node.error_message = str(e)
        return tasks