import os
import sys


class Color:
    """ANSI colors; blank when output isn't a terminal or NO_COLOR is set."""

    _on = sys.stdout.isatty() and "NO_COLOR" not in os.environ
    RESET = "\033[0m" if _on else ""
    DIM = "\033[2m" if _on else ""
    RED = "\033[91m" if _on else ""      # errors
    GREEN = "\033[92m" if _on else ""    # success
    YELLOW = "\033[93m" if _on else ""   # warnings
    BLUE = "\033[94m" if _on else ""     # info
    MAGENTA = "\033[95m" if _on else ""  # loading
