"""
Architecture Invariants Engine.
Enforces structural, layering, and domain isolation invariants across the codebase.
"""

import ast
import os
import re
from pathlib import Path
from typing import Dict, List, Any, Optional

class ArchitectureInvariantsEngine:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()

    def check_layer_invariants(self, file_path: str, content: str) -> List[Dict[str, Any]]:
        violations = []
        rel_p = str(Path(file_path).relative_to(self.workspace_root)) if Path(file_path).is_absolute() else file_path

        # Invariant 1: Controllers cannot directly import database drivers / raw SQL
        if "controller" in rel_p.lower():
            if any(k in content for k in ["import sqlite3", "from psycopg2", "from sqlalchemy", "CREATE TABLE"]):
                violations.append({
                    "rule": "CONTROLLERS_CANNOT_ACCESS_DB_DIRECTLY",
                    "file": rel_p,
                    "severity": "HIGH",
                    "message": "Controllers must delegate persistence to service/repository layers."
                })

        # Invariant 2: Financial/Payment mutations must pass through ledger
        if "payment" in rel_p.lower() or "transaction" in rel_p.lower():
            if "balance" in content and "ledger" not in content.lower():
                violations.append({
                    "rule": "FINANCIAL_MUTATIONS_REQUIRE_LEDGER",
                    "file": rel_p,
                    "severity": "CRITICAL",
                    "message": "Mutations to user balances must be audited via the ledger subsystem."
                })

        return violations
