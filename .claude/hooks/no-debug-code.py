#!/usr/bin/env python3
"""
Pre-commit hook: Detect debug code (print statements, console.log).

This hook checks staged files for common debug code patterns:
- Python: print() statements (except in specific allowed contexts)
- TypeScript/JavaScript: console.log, console.debug (console.error/warn allowed)

Exit codes:
- 0: No debug code found
- 1: Debug code found (blocks commit)
"""
import re
import subprocess
import sys
from pathlib import Path


# Patterns to detect
PYTHON_DEBUG_PATTERN = re.compile(r'^\s*print\s*\(', re.MULTILINE)
JS_DEBUG_PATTERN = re.compile(r'console\.(log|debug)\s*\(', re.MULTILINE)

# Files/paths to exclude from checks
EXCLUDED_PATHS = [
    '__pycache__',
    'node_modules',
    '.venv',
    'dist',
    'build',
    '.next',
]

# Specific files where debug code is allowed
ALLOWED_FILES = [
    'service-worker.js',
    'sw.js',
    # Test files may have debug output
    'test_',
    '_test.py',
    '.test.ts',
    '.test.tsx',
    '.spec.ts',
    '.spec.tsx',
]


def get_staged_files() -> list[str]:
    """Get list of staged files."""
    result = subprocess.run(
        ['git', 'diff', '--cached', '--name-only', '--diff-filter=ACM'],
        capture_output=True,
        text=True,
    )
    return [f for f in result.stdout.strip().split('\n') if f]


def is_excluded(filepath: str) -> bool:
    """Check if file should be excluded from checks."""
    # Check excluded paths
    for excluded in EXCLUDED_PATHS:
        if excluded in filepath:
            return True

    # Check allowed files
    filename = Path(filepath).name
    for allowed in ALLOWED_FILES:
        if allowed in filename:
            return True

    return False


def check_python_file(filepath: str) -> list[tuple[int, str]]:
    """Check Python file for print statements."""
    issues = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for i, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.lstrip()
            if stripped.startswith('#'):
                continue

            # Skip if it's inside a string (basic check)
            if PYTHON_DEBUG_PATTERN.search(line):
                # Allow print in logging setup or error handling contexts
                if 'logging' in line.lower() or 'logger' in line.lower():
                    continue
                issues.append((i, line.strip()))
    except (IOError, UnicodeDecodeError):
        pass

    return issues


def check_js_file(filepath: str) -> list[tuple[int, str]]:
    """Check JavaScript/TypeScript file for console.log/debug."""
    issues = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for i, line in enumerate(lines, 1):
            # Skip comments
            stripped = line.lstrip()
            if stripped.startswith('//') or stripped.startswith('*'):
                continue

            if JS_DEBUG_PATTERN.search(line):
                issues.append((i, line.strip()))
    except (IOError, UnicodeDecodeError):
        pass

    return issues


def main() -> int:
    staged_files = get_staged_files()

    if not staged_files:
        return 0

    all_issues: dict[str, list[tuple[int, str]]] = {}

    for filepath in staged_files:
        if is_excluded(filepath):
            continue

        if filepath.endswith('.py') and 'backend/' in filepath:
            issues = check_python_file(filepath)
            if issues:
                all_issues[filepath] = issues

        elif filepath.endswith(('.ts', '.tsx', '.js', '.jsx')) and 'frontend/' in filepath:
            issues = check_js_file(filepath)
            if issues:
                all_issues[filepath] = issues

    if all_issues:
        print('\n❌ Debug code detected! Please remove before committing:\n')
        for filepath, issues in all_issues.items():
            print(f'  📄 {filepath}:')
            for line_num, line_content in issues[:5]:  # Show max 5 per file
                # Truncate long lines
                if len(line_content) > 60:
                    line_content = line_content[:57] + '...'
                print(f'     Line {line_num}: {line_content}')
            if len(issues) > 5:
                print(f'     ... and {len(issues) - 5} more')
            print()

        print('💡 Tip: Use logging module (Python) or remove console.log (JS/TS)')
        print()
        return 1

    return 0


if __name__ == '__main__':
    sys.exit(main())
