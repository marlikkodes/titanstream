"""
Structural AST Editor & Refactoring Engine.
Performs syntax-aware AST modifications and validates AST integrity before writing.
"""

import ast
import os
from pathlib import Path
from typing import Dict, List, Any, Optional

class StructuralEditor:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()

    def replace_function_signature(self, file_path: str, old_fn_name: str, new_fn_name: str, new_args: Optional[List[str]] = None) -> Dict[str, Any]:
        """Refactors a function signature using AST inspection and targeted replacement."""
        fpath = self.root_dir / file_path
        if not fpath.exists():
            return {"status": "ERROR", "reason": f"File not found: {file_path}"}

        with open(fpath, "r", encoding="utf-8") as f:
            code = f.read()

        try:
            tree = ast.parse(code, filename=file_path)
        except SyntaxError as e:
            return {"status": "SYNTAX_ERROR", "error": str(e)}

        fn_found = False
        target_lineno = None
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == old_fn_name:
                fn_found = True
                target_lineno = node.lineno
                break

        if not fn_found:
            return {"status": "FUNCTION_NOT_FOUND", "function": old_fn_name}

        # Modify code line
        lines = code.splitlines()
        line_idx = target_lineno - 1
        old_line = lines[line_idx]
        
        args_str = ", ".join(new_args) if new_args is not None else ""
        if new_args is not None:
            new_line = f"def {new_fn_name}({args_str}):"
        else:
            new_line = old_line.replace(f"def {old_fn_name}", f"def {new_fn_name}")

        lines[line_idx] = new_line
        new_code = "\n".join(lines) + "\n"

        # Validate syntax of refactored code
        try:
            ast.parse(new_code, filename=file_path)
        except SyntaxError as e:
            return {"status": "REFACTOR_SYNTAX_ERROR", "error": str(e)}

        with open(fpath, "w", encoding="utf-8") as f:
            f.write(new_code)

        return {
            "status": "REFACTOR_SUCCESS",
            "file": file_path,
            "old_function": old_fn_name,
            "new_function": new_fn_name,
            "line": target_lineno
        }
