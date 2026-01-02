#!/usr/bin/env python3
"""
Simple API test script

Usage:
  uv run python test_api.py

Note: Server must be running on http://localhost:8000
"""

import sys
import requests


def test_health():
    """Test health check endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get("http://localhost:8000/health")
        response.raise_for_status()
        data = response.json()
        print(f"✅ Health check OK: {data}")
        return True
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False


def test_root():
    """Test root endpoint"""
    print("\nTesting root endpoint...")
    try:
        response = requests.get("http://localhost:8000/")
        response.raise_for_status()
        data = response.json()
        print(f"✅ Root endpoint OK: {data}")
        return True
    except Exception as e:
        print(f"❌ Root endpoint failed: {e}")
        return False


def main():
    print("=" * 60)
    print("FastAPI Backend API Test")
    print("=" * 60)
    print("\nMake sure the server is running:")
    print("  uv run uvicorn app.main:app --reload")
    print()

    results = []
    results.append(test_health())
    results.append(test_root())

    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    print(f"Passed: {passed}/{total}")

    if passed == total:
        print("✅ All tests passed!")
        sys.exit(0)
    else:
        print("❌ Some tests failed")
        sys.exit(1)


if __name__ == "__main__":
    main()
