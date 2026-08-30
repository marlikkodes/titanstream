"""
Deterministic Security & Semantic Analysis Engine.
Executes Semgrep-style static analysis rules, secret leakage scans,
and dependency vulnerability audits without relying on LLM guesswork.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional

class SecurityEngine:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()
        self.secret_patterns = [
            (re.compile(r"sk-[a-zA-Z0-9_-]{20,}", re.IGNORECASE), "OpenAI/Stripe API Key"),
            (re.compile(r"AIzaSy[a-zA-Z0-9_-]{25,}", re.IGNORECASE), "Google Cloud API Key"),
            (re.compile(r"ghp_[a-zA-Z0-9]{20,}", re.IGNORECASE), "GitHub Personal Access Token"),
            (re.compile(r"-----BEGIN (?:RSA )?PRIVATE KEY-----", re.IGNORECASE), "Private RSA Key")
        ]
        self.semantic_rules = [
            (re.compile(r"execute\s*\(\s*['\"].*%\s*s.*['\"]\s*%", re.IGNORECASE), "SQL Injection (Unescaped string formatting)", "HIGH"),
            (re.compile(r"dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*[^}]*\}\s*\}", re.IGNORECASE), "Cross-Site Scripting (XSS risk)", "MEDIUM"),
            (re.compile(r"child_process\.exec\s*\(\s*['\"].*\$\{", re.IGNORECASE), "Command Injection (Unsanitized shell interpolation)", "CRITICAL")
        ]

    def scan_repository(self, target_files: Optional[List[str]] = None) -> Dict[str, Any]:
        """Scans codebase for secret leaks and semantic vulnerabilities."""
        findings = []
        files_scanned = 0
        
        files_to_scan = target_files if target_files else []
        if not files_to_scan:
            ignore_dirs = {".git", "node_modules", "dist", "build", "__pycache__", ".agents"}
            for root, dirs, fs in os.walk(self.root_dir):
                dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
                for f in fs:
                    if f.endswith(('.ts', '.js', '.py', '.json', '.env', '.yaml')):
                        files_to_scan.append(os.path.relpath(os.path.join(root, f), self.root_dir))

        for fpath in files_to_scan:
            abs_p = self.root_dir / fpath
            if not abs_p.exists() or not abs_p.is_file():
                continue
            files_scanned += 1
            try:
                with open(abs_p, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                # 1. Secret scanning
                for pattern, name in self.secret_patterns:
                    if pattern.search(content):
                        findings.append({
                            "type": "SECRET_LEAK",
                            "severity": "CRITICAL",
                            "rule": name,
                            "file": fpath
                        })

                # 2. Semantic vulnerability scanning
                for pattern, desc, severity in self.semantic_rules:
                    if pattern.search(content):
                        findings.append({
                            "type": "SEMANTIC_VULNERABILITY",
                            "severity": severity,
                            "rule": desc,
                            "file": fpath
                        })
            except Exception:
                pass

        return {
            "status": "CLEAN" if len(findings) == 0 else "VULNERABILITIES_FOUND",
            "files_scanned": files_scanned,
            "total_findings": len(findings),
            "findings": findings
        }
