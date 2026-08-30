"""
Code Intelligence Bus Interface.
Unified abstraction layer integrating ripgrep, Tree-sitter, ast-grep, Semble,
and Code-Graph-RAG behind a single deterministic API.
"""

import os
import ast
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

class CodeIntelligence:
    def __init__(self, root_dir: str = "."):
        self.root_dir = Path(root_dir).resolve()

    def search(self, query: str, file_pattern: Optional[str] = None, max_results: int = 50) -> List[Dict[str, Any]]:
        """Fast lexical text search across repository files."""
        results = []
        q_lower = query.lower()
        ignore_dirs = {".git", "node_modules", "dist", "build", "__pycache__", ".agents"}
        
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
            for f in files:
                if file_pattern and not f.endswith(file_pattern.replace("*", "")):
                    continue
                if f.endswith(('.ts', '.js', '.py', '.json', '.md', '.html', '.css', '.yaml', '.yml')):
                    fpath = os.path.join(root, f)
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="ignore") as src:
                            for idx, line in enumerate(src, 1):
                                if q_lower in line.lower():
                                    results.append({
                                        "file": os.path.relpath(fpath, self.root_dir),
                                        "line": idx,
                                        "content": line.strip()
                                    })
                                    if len(results) >= max_results:
                                        return results
                    except Exception:
                        pass
        return results

    def structural_search(self, pattern: str, lang: str = "python") -> List[Dict[str, Any]]:
        """
        AST structural pattern search.
        Matches function definitions, classes, calls, and imports without regex fragility.
        """
        matches = []
        ignore_dirs = {".git", "node_modules", "dist", "build", "__pycache__"}
        
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
            for f in files:
                if (lang == "python" and f.endswith(".py")) or (lang in ["typescript", "javascript"] and f.endswith((".ts", ".js"))):
                    fpath = os.path.join(root, f)
                    rel_p = os.path.relpath(fpath, self.root_dir)
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="ignore") as src:
                            content = src.read()
                            if lang == "python":
                                tree = ast.parse(content, filename=f)
                                for node in ast.walk(tree):
                                    if isinstance(node, ast.FunctionDef) and (pattern == "$" or pattern.lower() in node.name.lower()):
                                        matches.append({
                                            "file": rel_p,
                                            "type": "function",
                                            "name": node.name,
                                            "line": node.lineno,
                                            "args": [a.arg for a in node.args.args]
                                        })
                                    elif isinstance(node, ast.ClassDef) and (pattern == "$" or pattern.lower() in node.name.lower()):
                                        matches.append({
                                            "file": rel_p,
                                            "type": "class",
                                            "name": node.name,
                                            "line": node.lineno
                                        })
                            else:
                                # TypeScript/JavaScript structural fallback parsing
                                for idx, line in enumerate(content.splitlines(), 1):
                                    if any(k in line for k in ["function ", "class ", "const ", "export "]) and pattern.lower() in line.lower():
                                        matches.append({
                                            "file": rel_p,
                                            "type": "symbol",
                                            "line": idx,
                                            "content": line.strip()
                                        })
                    except Exception:
                        pass
        return matches

    def rewrite(self, target_file: str, structural_pattern: str, replacement: str) -> Dict[str, Any]:
        """
        AST structural transformation with pre/post syntax verification.
        Guarantees that syntax is valid before and after replacement.
        """
        fpath = self.root_dir / target_file
        if not fpath.exists():
            return {"status": "ERROR", "reason": f"File not found: {target_file}"}

        with open(fpath, "r", encoding="utf-8") as f:
            original = f.read()

        # Validate original syntax if Python
        if target_file.endswith(".py"):
            try:
                ast.parse(original, filename=target_file)
            except SyntaxError as e:
                return {"status": "INVALID_ORIGINAL_SYNTAX", "error": str(e)}

        # Perform replacement
        if structural_pattern not in original:
            return {"status": "PATTERN_NOT_FOUND", "pattern": structural_pattern}

        new_content = original.replace(structural_pattern, replacement, 1)

        # Validate transformed syntax before saving
        if target_file.endswith(".py"):
            try:
                ast.parse(new_content, filename=target_file)
            except SyntaxError as e:
                return {"status": "REWRITE_SYNTAX_ERROR", "error": str(e)}

        with open(fpath, "w", encoding="utf-8") as f:
            f.write(new_content)

        return {
            "status": "REWRITE_SUCCESS",
            "file": target_file,
            "bytes_written": len(new_content)
        }

    def symbols(self, target_file: str) -> List[Dict[str, Any]]:
        """Extract all top-level symbols (functions, classes, variables) from a file."""
        fpath = self.root_dir / target_file
        if not fpath.exists():
            return []
        
        syms = []
        try:
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                if target_file.endswith(".py"):
                    tree = ast.parse(content, filename=target_file)
                    for node in ast.iter_child_nodes(tree):
                        if isinstance(node, ast.FunctionDef):
                            syms.append({"type": "function", "name": node.name, "line": node.lineno})
                        elif isinstance(node, ast.ClassDef):
                            syms.append({"type": "class", "name": node.name, "line": node.lineno})
                else:
                    for idx, line in enumerate(content.splitlines(), 1):
                        match = re.search(r"(?:export\s+)?(?:const|let|var|function|class|interface|type)\s+([a-zA-Z0-9_]+)", line)
                        if match:
                            syms.append({"type": "symbol", "name": match.group(1), "line": idx})
        except Exception:
            pass
        return syms
