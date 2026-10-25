"""Interactive shell for weaver-cli.py (`python3 weaver-cli.py -i`)."""

import os
import shlex
import subprocess
from pathlib import Path

from .completion import subcommands
from .console import Color
from .env import SHELL_ENVIRON

try:
    import readline  # line editing, history and TAB completion; not available on plain Windows Python
except ImportError:
    readline = None

HISTORY_FILE = Path.home() / ".weaver_cli_history"
SHELL_WORDS = ["help", "exit", "quit"]


def _prompt(last_status):
    color = Color.MAGENTA if last_status == 0 else Color.RED
    if readline and color:
        # \001 / \002 tell readline the color codes take no space, so line editing stays aligned
        return f"\001{color}\002weaver\001{Color.RESET}\002> "
    return f"{color}weaver{Color.RESET}> "


def _setup_readline(complete):
    if readline is None:
        return
    if "libedit" in (readline.__doc__ or ""):  # macOS Python links libedit, which has its own syntax
        readline.parse_and_bind("bind ^I rl_complete")
    else:
        readline.parse_and_bind("tab: complete")
    readline.set_completer_delims(" \t\n")

    def completer(text, state):
        if state == 0:
            before = readline.get_line_buffer()[:readline.get_begidx()]
            try:
                words = shlex.split(before)
            except ValueError:  # unbalanced quote while typing
                words = before.split()
            matches = complete(words + [text])
            if not words:
                matches += [w for w in SHELL_WORDS if w.startswith(text)]
            completer.matches = [m + " " for m in matches]
        return completer.matches[state] if state < len(completer.matches) else None

    readline.set_completer(completer)
    try:
        readline.read_history_file(HISTORY_FILE)
    except (FileNotFoundError, OSError):
        pass
    readline.set_history_length(1000)


def _save_history():
    if readline is None:
        return
    try:
        readline.write_history_file(HISTORY_FILE)
    except OSError:
        pass


def _change_directory(words):
    target = Path(os.path.expanduser(words[1] if len(words) > 1 else "~"))
    try:
        os.chdir(target)
    except OSError as e:
        print(f"{Color.RED}✗ cd: {e.strerror}: {target}{Color.RESET}")
        return 1
    return 0


def _run_system(line):
    """Run `line` in the user's shell, as if typed in their terminal (without the root .env values)."""
    shell = os.environ.get("SHELL") if os.name != "nt" else None
    try:
        return subprocess.run(line, shell=True, executable=shell, env=SHELL_ENVIRON).returncode
    except KeyboardInterrupt:  # Ctrl+C stops the command, not the Weaver shell
        print()
        return 130


def run_shell(parser, execute, complete):
    """Read commands until `exit`, `quit` or Ctrl+D. `execute(args)` runs one parsed command and returns its
    exit code; `complete(words)` returns TAB completions. Returns the last command's exit code."""
    _setup_readline(complete)
    tab = " TAB completes." if readline else ""
    print(f"{Color.BLUE}ℹ Interactive mode: type a command such as `check`, `ps` or `logs server`, "
          f"`help`, or `exit`.{tab}\n  Anything else runs in your system shell; prefix with ! to force it "
          f"(e.g. `!ps`).{Color.RESET}")
    commands = set(subcommands(parser))

    status = 0
    try:
        while True:
            try:
                line = input(_prompt(status))
            except EOFError:  # Ctrl+D
                print()
                break
            except KeyboardInterrupt:  # Ctrl+C at the prompt clears the line
                print()
                continue

            if line.lstrip().startswith("!"):  # force the system shell, e.g. `!ps` for the system's ps
                status = _run_system(line.lstrip()[1:]) if line.lstrip()[1:].strip() else status
                continue
            try:
                words = shlex.split(line)
            except ValueError as e:
                print(f"{Color.RED}✗ {e}{Color.RESET}")
                status = 2
                continue
            if not words:
                continue
            if words[0] == "cd":
                status = _change_directory(words)
                continue
            if words[0] not in commands and words[0] not in ("exit", "quit", "help", "?") \
                    and not words[0].startswith("-"):
                status = _run_system(line)
                continue
            if words[0] in ("exit", "quit"):
                break
            if words[0] in ("help", "?"):
                words = [*words[1:], "-h"]  # `help check` shows `check -h`
            if words[0] in ("-i", "--interactive"):
                print(f"{Color.YELLOW}⚠ already in interactive mode{Color.RESET}")
                continue

            try:
                args = parser.parse_args(words)
            except SystemExit as e:  # argparse printed help or a usage error
                status = e.code or 0
                continue
            if args.command is None:
                parser.print_help()
                continue

            try:
                status = execute(args)
            except KeyboardInterrupt:
                print(f"\n{Color.YELLOW}⚠ cancelled{Color.RESET}")
                status = 130
    finally:
        _save_history()
    return status
