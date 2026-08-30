"""
Repository Intelligence System for Antigravity Superengineering OS.
Builds, indexes, and queries repository architecture, symbol maps, dependency trees,
APIs, databases, and command registries with zero human intervention.
"""

import os
import re
import json
import glob
from pathlib import Path
from typing import Dict, List, Any, Optional

class RepoIntelligence:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.knowledge_dir = self.root_dir / ".agents" / "knowledge"
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)
        
        self.repo_map_path = self.knowledge_dir / "repo_map.json"
        self.arch_map_path = self.knowledge_dir / "architecture_map.json"
        self.dep_map_path = self.knowledge_dir / "dependency_map.json"
        self.api_map_path = self.knowledge_dir / "api_map.json"
        self.db_map_path = self.knowledge_dir / "database_map.json"
        self.command_reg_path = self.knowledge_dir / "command_registry.json"
        self.test_map_path = self.knowledge_dir / "testing_map.json"

    def scan_and_index(self) -> Dict[str, Any]:
        """Scan the entire repository and generate all intelligence maps."""
        repo_map = self._build_repo_map()
        arch_map = self._build_architecture_map(repo_map)
        dep_map = self._build_dependency_map()
        api_map = self._build_api_map()
        db_map = self._build_db_map()
        command_reg = self._build_command_registry()
        test_map = self._build_test_map()

        self._save_json(self.repo_map_path, repo_map)
        self._save_json(self.arch_map_path, arch_map)
        self._save_json(self.dep_map_path, dep_map)
        self._save_json(self.api_map_path, api_map)
        self._save_json(self.db_map_path, db_map)
        self._save_json(self.command_reg_path, command_reg)
        self._save_json(self.test_map_path, test_map)

        return {
            "status": "indexed",
            "files_indexed": repo_map.get("total_files", 0),
            "subsystems": list(arch_map.get("subsystems", {}).keys()),
            "commands_registered": list(command_reg.keys()),
            "apis_discovered": len(api_map.get("endpoints", [])),
            "tests_discovered": len(test_map.get("test_suites", []))
        }

    def _save_json(self, path: Path, data: Dict[str, Any]):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _build_repo_map(self) -> Dict[str, Any]:
        files_list = []
        ignore_dirs = {".git", "node_modules", "dist", "build", ".next", "__pycache__", ".agents/state", ".agents/memory"}
        
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".claude") and not d.startswith(".vscode")]
            rel_root = os.path.relpath(root, self.root_dir)
            if rel_root == ".":
                rel_root = ""
            for f in files:
                if f.startswith(".") and f not in [".env.example", ".gitignore", ".prettierrc", ".eslintrc"]:
                    continue
                rel_path = os.path.join(rel_root, f) if rel_root else f
                ext = Path(f).suffix.lower()
                files_list.append({
                    "path": rel_path,
                    "extension": ext,
                    "size_bytes": os.path.getsize(os.path.join(root, f))
                })
        
        return {
            "root": str(self.root_dir),
            "total_files": len(files_list),
            "files": files_list
        }

    def _build_architecture_map(self, repo_map: Dict[str, Any]) -> Dict[str, Any]:
        subsystems = {}
        top_dirs = ["apps", "services", "packages", "libs", "infrastructure", "scripts", "tests"]
        
        for d in top_dirs:
            p = self.root_dir / d
            if p.exists() and p.is_dir():
                children = [c.name for c in p.iterdir() if c.is_dir() and not c.name.startswith(".")]
                subsystems[d] = {
                    "path": d,
                    "type": "core_directory",
                    "components": children if children else [d]
                }

        pkg_json = self.root_dir / "package.json"
        pnpm_ws = self.root_dir / "pnpm-workspace.yaml"
        pyproject = self.root_dir / "pyproject.toml"
        
        stack = []
        if pkg_json.exists():
            stack.append("Node.js/TypeScript")
        if pnpm_ws.exists():
            stack.append("pnpm-monorepo")
        if pyproject.exists() or any(f["extension"] == ".py" for f in repo_map.get("files", [])):
            stack.append("Python")

        return {
            "primary_stack": stack,
            "subsystems": subsystems,
            "design_patterns": ["Monorepo", "Microservices/Modular Apps", "Event/Message-Driven"],
            "entrypoints": ["apps/", "services/", "scripts/"]
        }

    def _build_dependency_map(self) -> Dict[str, Any]:
        deps = {}
        pkg_json_path = self.root_dir / "package.json"
        if pkg_json_path.exists():
            try:
                with open(pkg_json_path, "r", encoding="utf-8") as f:
                    pj = json.load(f)
                    deps["root_package_json"] = {
                        "dependencies": pj.get("dependencies", {}),
                        "devDependencies": pj.get("devDependencies", {}),
                        "scripts": pj.get("scripts", {})
                    }
            except Exception:
                pass
        return deps

    def _build_api_map(self) -> Dict[str, Any]:
        endpoints = []
        for root, _, files in os.walk(self.root_dir):
            if any(part in root for part in ["node_modules", ".git", "dist", "build"]):
                continue
            for f in files:
                if f.endswith(('.ts', '.js', '.py')):
                    fpath = os.path.join(root, f)
                    try:
                        with open(fpath, 'r', encoding='utf-8', errors='ignore') as code_file:
                            for line in code_file:
                                line_s = line.strip()
                                for m in ['app.get', 'app.post', 'app.put', 'app.delete', 'router.get', 'router.post', 'router.put', 'router.delete']:
                                    if m in line_s and '(' in line_s:
                                        endpoints.append({
                                            "call": m,
                                            "line": line_s[:100],
                                            "file": os.path.relpath(fpath, self.root_dir)
                                        })
                    except Exception:
                        pass

        return {"endpoints": endpoints}

    def _build_db_map(self) -> Dict[str, Any]:
        models = []
        schema_files = glob.glob(str(self.root_dir / "**" / "schema.prisma"), recursive=True) +                        glob.glob(str(self.root_dir / "**" / "*schema*.ts"), recursive=True) +                        glob.glob(str(self.root_dir / "**" / "models.py"), recursive=True)

        for sf in schema_files:
            if "node_modules" not in sf:
                models.append({
                    "schema_file": os.path.relpath(sf, self.root_dir),
                    "type": "database_schema"
                })
        return {"schemas": models}

    def _build_command_registry(self) -> Dict[str, str]:
        commands = {
            "build": "pnpm build",
            "test": "pnpm test",
            "lint": "pnpm lint",
            "typecheck": "pnpm typecheck",
            "format": "pnpm prettier --write .",
            "dev": "pnpm dev",
            "git_commit": "python3 scripts/git_plumbing_commit.py"
        }
        pkg_json_path = self.root_dir / "package.json"
        if pkg_json_path.exists():
            try:
                with open(pkg_json_path, "r", encoding="utf-8") as f:
                    pj = json.load(f)
                    scripts = pj.get("scripts", {})
                    for k, v in scripts.items():
                        commands[k] = f"pnpm {k}"
            except Exception:
                pass
        return commands

    def _build_test_map(self) -> Dict[str, Any]:
        test_suites = []
        for root, _, files in os.walk(self.root_dir):
            if any(part in root for part in ["node_modules", ".git", "dist"]):
                continue
            for f in files:
                if f.endswith(('.test.ts', '.spec.ts', '.test.js', '.spec.js')) or (f.startswith('test_') and f.endswith('.py')):
                    test_suites.append(os.path.relpath(os.path.join(root, f), self.root_dir))
        return {"test_suites": test_suites}

    def query_subsystem_for_file(self, file_path: str) -> str:
        norm = os.path.normpath(file_path)
        parts = norm.split(os.sep)
        if len(parts) > 1:
            return parts[0]
        return "root"

    def query_impact(self, target_file: str) -> Dict[str, Any]:
        target_name = Path(target_file).stem
        affected_tests = []
        related_files = []
        
        for root, _, files in os.walk(self.root_dir):
            if any(part in root for part in ["node_modules", ".git", "dist"]):
                continue
            for f in files:
                if f.endswith(('.ts', '.js', '.py')):
                    full_p = os.path.join(root, f)
                    rel_p = os.path.relpath(full_p, self.root_dir)
                    if rel_p == target_file:
                        continue
                    try:
                        with open(full_p, 'r', encoding='utf-8', errors='ignore') as src_file:
                            content = src_file.read()
                            if target_name in content:
                                if "test" in f or "spec" in f:
                                    affected_tests.append(rel_p)
                                else:
                                    related_files.append(rel_p)
                    except Exception:
                        pass
        return {
            "target_file": target_file,
            "related_files": related_files[:10],
            "affected_tests": affected_tests
        }

if __name__ == "__main__":
    intel = RepoIntelligence()
    res = intel.scan_and_index()
    print(json.dumps(res, indent=2))