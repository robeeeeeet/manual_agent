#!/usr/bin/env python3
"""
Claude Code PreToolUse hook: Run lint before git commit.

This hook intercepts git commit commands and runs ESLint/ruff checks.
If lint errors are found, the commit is blocked (exit code 2).
"""
import json
import os
import re
import subprocess
import sys


def run_frontend_lint(project_dir: str) -> tuple[bool, str]:
    """Run ESLint on frontend."""
    frontend_dir = os.path.join(project_dir, "frontend")

    result = subprocess.run(
        ["npm", "run", "lint"],
        cwd=frontend_dir,
        capture_output=True,
        text=True,
        timeout=60,
    )

    # Check for errors (not warnings)
    has_errors = result.returncode != 0 and "error" in result.stdout.lower()

    return (not has_errors, result.stdout + result.stderr)


def run_backend_lint(project_dir: str) -> tuple[bool, str]:
    """Run ruff on backend."""
    backend_dir = os.path.join(project_dir, "backend")

    result = subprocess.run(
        ["uv", "run", "ruff", "check", "app/"],
        cwd=backend_dir,
        capture_output=True,
        text=True,
        timeout=30,
    )

    return (result.returncode == 0, result.stdout + result.stderr)


def main():
    try:
        # Read tool input from stdin
        data = json.load(sys.stdin)
        command = data.get("tool_input", {}).get("command", "")

        # Only intercept git commit commands
        if not re.search(r"git\s+(commit|add\s+.*&&.*commit)", command):
            return 0

        project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())

        print("🔍 Pre-commit lint check...", file=sys.stderr)

        errors = []

        # Run frontend lint
        frontend_ok, frontend_output = run_frontend_lint(project_dir)
        if not frontend_ok:
            # Extract only error lines
            error_lines = [
                line for line in frontend_output.split("\n")
                if "error" in line.lower() and not line.strip().startswith("✖")
            ]
            if error_lines:
                errors.append("Frontend ESLint errors:\n" + "\n".join(error_lines[:10]))

        # Run backend lint
        backend_ok, backend_output = run_backend_lint(project_dir)
        if not backend_ok:
            errors.append(f"Backend ruff errors:\n{backend_output[:500]}")

        if errors:
            print("\n❌ Lint errors found! Commit blocked.\n", file=sys.stderr)
            for error in errors:
                print(error, file=sys.stderr)
            print("\nFix the errors and try again.", file=sys.stderr)
            return 2  # Block the command

        print("✅ Lint passed!", file=sys.stderr)
        return 0

    except subprocess.TimeoutExpired:
        print("⚠️ Lint timeout - proceeding with commit", file=sys.stderr)
        return 0
    except json.JSONDecodeError:
        return 0
    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        return 0  # Don't block on hook errors


if __name__ == "__main__":
    sys.exit(main())
