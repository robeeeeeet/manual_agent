#!/usr/bin/env python3
"""
Claude Code PostToolUse hook: Auto-format Python files with ruff.

This hook runs after Write/Edit operations on Python files.
It automatically formats the file using ruff to maintain code style consistency.
"""
import json
import os
import subprocess
import sys


def main():
    try:
        # Read tool input from stdin
        data = json.load(sys.stdin)
        file_path = data.get("tool_input", {}).get("file_path", "")

        # Only process Python files in backend directory
        if not file_path.endswith(".py"):
            return 0

        if "/backend/" not in file_path and not file_path.startswith("backend/"):
            return 0

        # Get project directory
        project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
        backend_dir = os.path.join(project_dir, "backend")

        # Run ruff check (errors are logged but don't block)
        check_result = subprocess.run(
            ["uv", "run", "ruff", "check", "--fix", file_path],
            cwd=backend_dir,
            capture_output=True,
            text=True,
        )
        if check_result.returncode != 0 and check_result.stderr:
            print(f"Ruff check warnings: {check_result.stderr}", file=sys.stderr)

        # Run ruff format
        format_result = subprocess.run(
            ["uv", "run", "ruff", "format", file_path],
            cwd=backend_dir,
            capture_output=True,
            text=True,
        )
        if format_result.returncode != 0:
            print(f"Ruff format error: {format_result.stderr}", file=sys.stderr)
            return 1

        return 0

    except json.JSONDecodeError:
        # No input or invalid JSON - skip silently
        return 0
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
