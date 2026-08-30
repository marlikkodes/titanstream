"""
Zero-Config Repository Onboarding Engine.
Inspects a new repository and automatically detects language, framework,
test runner, and build tool, writing a tailored .agents/project.yaml.
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Any

class RepositoryOnboarding:
    def __init__(self, target_dir: str = "."):
        self.target_dir = Path(target_dir).resolve()

    def onboard(self) -> Dict[str, Any]:
        """Automatically scans repository and generates .agents/project.yaml."""
        detected_lang = "unknown"
        detected_framework = "unknown"
        package_manager = "none"
        test_runner = "unknown"

        # Python detection
        py_files = list(self.target_dir.glob("**/*.py"))
        if (self.target_dir / "pyproject.toml").exists() or (self.target_dir / "requirements.txt").exists() or py_files:
            detected_lang = "python"
            package_manager = "pip"
            test_runner = "pytest"
            
            if "flask" in str(self.target_dir).lower() or (self.target_dir / "app.py").exists():
                detected_framework = "flask"
            elif (self.target_dir / "manage.py").exists() or "django" in str(self.target_dir).lower():
                detected_framework = "django"
            elif any("fastapi" in str(f).lower() for f in py_files):
                detected_framework = "fastapi"
            else:
                for pf in py_files[:10]:
                    try:
                        with open(pf, "r", encoding="utf-8", errors="ignore") as f:
                            c = f.read().lower()
                            if "flask" in c:
                                detected_framework = "flask"
                                break
                            elif "fastapi" in c:
                                detected_framework = "fastapi"
                                break
                            elif "django" in c:
                                detected_framework = "django"
                                break
                    except Exception:
                        pass

        # Node / TypeScript detection
        pkg_json = self.target_dir / "package.json"
        if pkg_json.exists():
            detected_lang = "typescript" if list(self.target_dir.glob("**/*.ts")) else "javascript"
            package_manager = "pnpm" if (self.target_dir / "pnpm-lock.yaml").exists() else "npm"
            test_runner = "vitest" if (self.target_dir / "vitest.config.ts").exists() else "jest"
            try:
                with open(pkg_json, "r") as f:
                    pj = json.load(f)
                    name = pj.get("name", "").lower()
                    deps = {**pj.get("dependencies", {}), **pj.get("devDependencies", {})}
                    if "next" in deps or "next" in name:
                        detected_framework = "nextjs"
                    elif "react" in deps or "react" in name or "vite" in name:
                        detected_framework = "react"
                    elif "express" in deps or "express" in name:
                        detected_framework = "express"
            except Exception:
                pass

        config = {
            "name": self.target_dir.name,
            "language": detected_lang,
            "framework": detected_framework,
            "package_manager": package_manager,
            "test_runner": test_runner,
            "auto_generated": True
        }

        agents_dir = self.target_dir / ".agents"
        agents_dir.mkdir(parents=True, exist_ok=True)
        with open(agents_dir / "project.json", "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)

        return config
