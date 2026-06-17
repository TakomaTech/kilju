from __future__ import annotations

import sys
from pathlib import Path

from parser import parse_source
from interpreter import Interpreter


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python kilju.py <file.kj>")
        sys.exit(1)
    path = Path(sys.argv[1])
    source = path.read_text()
    program = parse_source(source)
    interpreter = Interpreter()
    interpreter.execute(program)


if __name__ == "__main__":
    main()
