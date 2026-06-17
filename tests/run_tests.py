import sys
from pathlib import Path

# Ensure tests directory is on sys.path so imports work when running from repo root
sys.path.insert(0, str(Path(__file__).parent))
from test_parser import test_into_postfix, test_pipe_and_into

failed = 0
for fn in (test_into_postfix, test_pipe_and_into):
    try:
        fn()
        print(f"{fn.__name__}: OK")
    except AssertionError as e:
        failed += 1
        print(f"{fn.__name__}: FAIL -> {e}")

if failed:
    raise SystemExit(1)
