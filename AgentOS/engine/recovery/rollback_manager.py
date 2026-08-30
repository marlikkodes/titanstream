"""
Automatic Workspace Rollback & Snapshot Manager.
Creates pre-mutation tree snapshots and restores pristine repository state on failed missions.
"""

import os
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional

class RollbackManager:
    def __init__(self, workspace_root: str = "."):
        self.workspace_root = Path(workspace_root).resolve()
        self.snapshots_dir = self.workspace_root / ".agents" / "state" / "snapshots"
        self.snapshots_dir.mkdir(parents=True, exist_ok=True)

    def create_snapshot(self, mission_id: str, files_to_backup: List[str]) -> str:
        """Saves a pristine snapshot of targeted files prior to autonomous mutation."""
        snap_dir = self.snapshots_dir / mission_id
        snap_dir.mkdir(parents=True, exist_ok=True)

        for fpath in files_to_backup:
            src = self.workspace_root / fpath
            if src.exists() and src.is_file():
                dest = snap_dir / fpath
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dest)

        return str(snap_dir)

    def rollback(self, mission_id: str) -> Dict[str, Any]:
        """Restores all files from snapshot directory upon mission failure or abort."""
        snap_dir = self.snapshots_dir / mission_id
        if not snap_dir.exists():
            return {"status": "NO_SNAPSHOT_FOUND", "files_restored": 0}

        restored_files = []
        for root, _, files in os.walk(snap_dir):
            for f in files:
                snap_file = Path(root) / f
                rel_p = snap_file.relative_to(snap_dir)
                target_file = self.workspace_root / rel_p
                target_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(snap_file, target_file)
                restored_files.append(str(rel_p))

        return {
            "status": "ROLLBACK_SUCCESSFUL",
            "files_restored": len(restored_files),
            "restored_list": restored_files
        }
