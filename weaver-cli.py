import argparse
import functools
import itertools
import os
import random
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from scripts.console import Color
from scripts.env import SHELL_ENVIRON, load_env
from scripts.tasks import StageSkipped
from scripts.tasks.check_prerequisites import check_prerequisites
from scripts.tasks.check_status import DEFAULT_SERVICES, SERVICES, service_name
from scripts.tasks.docker_compose import (
    ALIASES,
    list_containers,
    restart_containers,
    run_containers,
    service_names,
    show_logs,
    stop_containers,
)
from scripts.completion import bash_script, candidates
from scripts.interactive import run_shell

ENV_FILE = Path(__file__).resolve().parent / ".env"

banner = r"""
                           .
                          | \/|
                          ) )|/|
    v2.0 LTS        _----. /.'.'
.-._________..      .' @ _\  .'
'.._______.   '.   /    (_| .')  __    __
  '._____.  /   '-/      | _.'  / / /\ \ \___  __ ___   _____ _ __
   '.______ (         ) ) \     \ \/  \/ / _ \/ _` \ \ / / _ \ '__|
     '..____ '._       )  )      \  /\  /  __/ (_| |\ V /  __/ |
        .' __.--\  , ,  // ((     \/  \/ \___|\__,_| \_/ \___|_|
        '.'     |  \/   (_.'(
                '   \ .'
                 \   (
                  \   '.
                   \ \ '.)
                    '-'-'
"""


class Spinner:
    """Animated status line (e.g. 'Weaving. . .') shown while a block runs."""

    FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    MIN_VISIBLE = 1.0  # seconds the animation stays up, so fast tasks don't just flash

    def __init__(self, verbs=("Working",), interval=0.1, verb_every=2.0, prefix="", done="Done", started_at=None):
        """`started_at` (a time.monotonic() value) adds a running total, e.g. for a whole pipeline."""
        self.started_at = started_at
        self.verbs = list(verbs)
        self.interval = interval
        self.verb_every = verb_every
        self.prefix = f"{Color.DIM}{prefix}{Color.RESET} " if prefix else ""
        self.done = done
        self._start = None
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._lock = threading.Lock()
        self._verb = self.verbs[0]
        self._line = ""  # last spinner line drawn, redrawn after log lines

    def _run(self):
        start = last_switch = self._start
        for i, frame in enumerate(itertools.cycle(self.FRAMES)):
            if self._stop.is_set():
                break
            now = time.monotonic()
            if len(self.verbs) > 1 and now - last_switch >= self.verb_every:
                self._verb = random.choice([v for v in self.verbs if v != self._verb])
                last_switch = now
            dots = ". " * ((i // 3) % 4)
            elapsed = f"{int(now - start)}s"
            if self.started_at is not None:
                elapsed += f" · total {int(now - self.started_at)}s"
            with self._lock:
                self._line = (
                    f"{self.prefix}{Color.MAGENTA}{frame} {self._verb}{dots:<6}{Color.RESET}"
                    f" {Color.DIM}({elapsed}){Color.RESET}"
                )
                sys.stdout.write(f"\r\033[K{self._line}")
                sys.stdout.flush()
            time.sleep(self.interval)

    def update(self, verb):
        """Change the verb shown, e.g. when the task moves to a new phase."""
        self._verb = verb

    def write(self, msg):
        """Print a log line above the spinner, then redraw the spinner so it never disappears."""
        with self._lock:
            sys.stdout.write(f"\r\033[K{msg}\n{self._line}")
            sys.stdout.flush()

    def info(self, msg):
        self.write(f"    {Color.BLUE}ℹ {msg}{Color.RESET}")

    def success(self, msg):
        self.write(f"    {Color.GREEN}✓ {msg}{Color.RESET}")

    def warn(self, msg):
        self.write(f"    {Color.YELLOW}⚠ {msg}{Color.RESET}")

    def error(self, msg):
        self.write(f"    {Color.RED}✗ {msg}{Color.RESET}")

    def __enter__(self):
        self._start = time.monotonic()
        sys.stdout.write("\033[?25l")  # hide cursor
        self._thread.start()
        return self

    def __exit__(self, exc_type, exc, tb):
        elapsed = time.monotonic() - self._start  # real task time, before any padding below
        interrupted = exc_type is KeyboardInterrupt
        try:
            if sys.stdout.isatty() and not interrupted:
                time.sleep(max(0.0, self.MIN_VISIBLE - elapsed))
        except KeyboardInterrupt:  # Ctrl+C during the padding: still stop the animation, then re-raise below
            interrupted = True
        finally:
            self._stop.set()
            self._thread.join()
        if interrupted:
            status = f"{Color.YELLOW}- {self.verbs[0]} cancelled{Color.RESET}"
        elif exc_type is StageSkipped:
            status = f"{Color.YELLOW}- {self.verbs[0]} skipped: {exc}{Color.RESET}"
        elif exc_type:
            status = f"{Color.RED}✗ {self.verbs[0]} failed: {exc}{Color.RESET}"
        else:
            status = f"{Color.GREEN}✓ {self.done}{Color.RESET}"
        sys.stdout.write(
            f"\r\033[K{self.prefix}{status} {Color.DIM}({elapsed:.1f}s){Color.RESET}\n\033[?25h"  # show cursor again
        )
        sys.stdout.flush()
        if interrupted and exc_type is not KeyboardInterrupt:
            raise KeyboardInterrupt  # the task finished, but the user still asked to cancel
        return False


@dataclass
class Stage:
    """One step of the pipeline. `action` receives the stage's Spinner for logging."""

    verbs: list
    done: str
    action: Callable[[Spinner], None]


def run_pipeline(stages, keep_going=False):
    """Run stages in order. Returns True if all passed.

    By default the first failure skips the remaining stages; with keep_going every stage runs.
    """
    total = len(stages)
    started_at = time.monotonic()
    passed = failed = 0
    for i, stage in enumerate(stages, 1):
        try:
            with Spinner(verbs=stage.verbs, prefix=f"[{i}/{total}]", done=stage.done, started_at=started_at) as sp:
                stage.action(sp)
            passed += 1
        except StageSkipped:
            continue
        except Exception:
            failed += 1
            if keep_going:
                continue
            for j, skipped in enumerate(stages[i:], i + 1):
                print(f"{Color.DIM}[{j}/{total}]{Color.RESET} {Color.YELLOW}- {skipped.verbs[0]} skipped{Color.RESET}")
            break
    print_summary(passed, failed, total - passed - failed, time.monotonic() - started_at)
    return failed == 0


def print_summary(passed, failed, skipped, seconds):
    skipped_part = [f"{skipped} skipped"] if skipped else []
    if failed == 0:
        summary = f"All {passed} passed" if not skipped else ", ".join([f"{passed} passed", *skipped_part])
        print(f"\n{Color.GREEN}✓ {summary}{Color.RESET} {Color.DIM}in {seconds:.1f}s{Color.RESET}")
        return
    parts = [f"{failed} failed", f"{passed} passed", *skipped_part]
    print(f"\n{Color.RED}✗ {', '.join(parts)}{Color.RESET} {Color.DIM}in {seconds:.1f}s{Color.RESET}")


# --- Stage actions: replace the sleeps with real work ---

def install(sp):
    time.sleep(2)
    sp.info("dependencies resolved")
    time.sleep(1)


def deploy(sp):
    sp.warn("no deploy config found, using defaults")
    time.sleep(3)


def test(sp):
    time.sleep(2)


def verify(sp):
    time.sleep(1.5)


PREREQUISITES_STAGE = Stage(["Checking prerequisites"], "Prerequisites found", check_prerequisites)


CONTAINER_COMMANDS = {
    "run": (["Starting containers"], "Containers are up", run_containers),
    "stop": (["Stopping containers"], "Containers stopped", stop_containers),
    "restart": (["Restarting containers"], "Containers restarted", restart_containers),
    "ps": (["Listing containers"], "Containers listed", list_containers),
}


def service_stage(name):
    return Stage([f"Checking {name}"], f"{name} is up", SERVICES[name])


def service_arg(value):
    """argparse type for service names. Validated here, not with `choices`, because Python < 3.12
    checks an empty nargs="*" list against `choices` and rejects it."""
    name = service_name(value)
    if name not in SERVICES:
        raise argparse.ArgumentTypeError(f"unknown service '{value}' (choose from {', '.join(SERVICES)})")
    return name


HELP_EPILOG = """\
examples:
  python3 weaver-cli.py init                  check this machine is ready
  python3 weaver-cli.py check                 check every service
  python3 weaver-cli.py check server redis    check only the named services
  python3 weaver-cli.py check -h              list services and what each check does
  python3 weaver-cli.py run                   start all docker-compose containers
  python3 weaver-cli.py restart database      restart one container
  python3 weaver-cli.py ps                    list containers and their status
  python3 weaver-cli.py logs server           follow a container's logs (Ctrl+C to stop)
  eval "$(python3 weaver-cli.py completion)"  enable TAB completion in bash
  python3 weaver-cli.py -i                    interactive shell (TAB completion, history)

configuration:
  Settings are read from .env next to weaver-cli.py. Variables already set in
  your shell override the file, e.g.  WEAVER_PORT=9090 python3 weaver-cli.py check server

exit codes:
  0  everything passed (skipped stages don't count as failures)
  1  at least one stage failed
  2  usage error, or no command given

docs: WEAVER_CLI.md
"""

CHECK_DESCRIPTION = """\
Check that Weaver's services are up. With no service named, checks:
  {defaults}

Every named service is checked even if an earlier one fails.

services:
  server         Weaver server answers its health URL; lists the health of what it
                 is connected to (database, redis, ...)
  identity       Keycloak realm is reachable. Skipped unless
                 WEAVER_IDENTITY_PROVIDER=keycloak
  frontend       web UI answers with HTTP 200
  redis          Redis answers PING
  database       PostgreSQL accepts a login with the SPRING_DATASOURCE_* settings
  indexing       the configured WEAVER_INDEXING_PROVIDER: postgres (database
                 check), elasticsearch8 or opensearch3. Skipped unless
                 WEAVER_INDEXING_ENABLED=true
  opensearch     OpenSearch cluster version and health (only when named)
  elasticsearch  Elasticsearch cluster version and health (only when named)

Names ignore case, hyphens and underscores: open-search, Elastic_Search, ...
"""


def build_parser():
    formatter = argparse.RawDescriptionHelpFormatter
    parser = argparse.ArgumentParser(
        prog="weaver-cli.py", formatter_class=formatter, epilog=HELP_EPILOG,
        description="Weaver CLI: check that a machine and Weaver's services are ready to run.",
    )
    parser.add_argument("-i", "--interactive", action="store_true",
                        help="start an interactive shell: type commands at a `weaver>` prompt")
    sub = parser.add_subparsers(dest="command", metavar="command")

    sub.add_parser(
        "init", formatter_class=formatter,
        help="check prerequisites (Docker, Java 21, Maven) and the database",
        description="Check this machine is ready for Weaver:\n"
                    "  1. Docker, Java 21 and Maven are installed\n"
                    "  2. the database from .env accepts a login\n\n"
                    "Stops at the first failure.",
    )

    check = sub.add_parser(
        "check", formatter_class=formatter,
        help="check that services are up (all of them if none are named)",
        description=CHECK_DESCRIPTION.format(defaults=", ".join(DEFAULT_SERVICES)),
    )
    check.add_argument(
        "services", nargs="*", type=service_arg, metavar="service",
        help=f"services to check (default: {', '.join(DEFAULT_SERVICES)})",
    )

    aliases = ", ".join(f"{alias} = {service}" for alias, service in ALIASES.items())
    for name, action, extra in [
        ("run", "start", "Starts stopped containers, creates missing ones, then waits until they're healthy."),
        ("stop", "stop", "Stops the containers but keeps them, with their data, for the next run."),
        ("restart", "restart", "Restarts the containers, then waits until they're healthy."),
        ("ps", "list", "Shows each container's state, Docker status and published ports,\n"
                       "including services that have no container yet."),
    ]:
        command = sub.add_parser(
            name, formatter_class=formatter,
            help=f"{action} the docker-compose containers (all, or the ones named)",
            description=f"{action.capitalize()} the containers in docker/docker-compose.yaml. {extra}\n\n"
                        f"Services use their compose names (e.g. postgres, redis), or the same names as\n"
                        f"`check`: {aliases}.\n"
                        f"Set COMPOSE_FILE to use another compose file.",
        )
        command.add_argument("services", nargs="*", type=str.lower, metavar="service",
                             help="services to act on (default: all)")

    logs = sub.add_parser(
        "logs", formatter_class=formatter,
        help="show docker-compose container logs, following new output",
        description="Show the logs of the containers in docker/docker-compose.yaml and keep\n"
                    "following new output until you press Ctrl+C.\n\n"
                    f"Services use their compose names or the `check` names: {aliases}.",
        epilog="examples:\n"
               "  python3 weaver-cli.py logs                  follow every container\n"
               "  python3 weaver-cli.py logs server           follow conductor-server\n"
               "  python3 weaver-cli.py logs database -n 500 --no-follow",
    )
    logs.add_argument("services", nargs="*", type=str.lower, metavar="service",
                      help="services to show (default: all)")
    logs.add_argument("-n", "--tail", type=int, default=100, metavar="N",
                      help="lines of history to show first (default: 100)")
    logs.add_argument("--no-follow", dest="follow", action="store_false",
                      help="print the logs and exit instead of following")
    logs.add_argument("-t", "--timestamps", action="store_true", help="prefix each line with its timestamp")

    sub.add_parser(
        "completion", formatter_class=formatter,
        help="print the bash tab-completion script",
        description="Print a bash script that adds TAB completion for commands, options and\n"
                    "service names. To load it in every new shell, add this to ~/.bashrc:\n\n"
                    f'  eval "$(python3 {Path(__file__).resolve()} completion)"\n\n'
                    "Completion works for `python3 weaver-cli.py ...` and `./weaver-cli.py ...`.",
    )

    sub.add_parser(
        "deploy", formatter_class=formatter,
        help="prerequisites, install, deploy, database, test, verify (install/deploy/test/verify are placeholders)",
        description="Run the full pipeline: prerequisites, install, deploy, database check, test, verify.\n\n"
                    "Note: install, deploy, test and verify are placeholders that don't do real work yet.",
    )
    return parser


def stages_for(args):
    """Return (stages, keep_going) for the parsed command."""
    if args.command == "init":
        return [PREREQUISITES_STAGE, service_stage("database")], False
    if args.command == "check":
        return [service_stage(name) for name in dict.fromkeys(args.services or DEFAULT_SERVICES)], True
    if args.command in CONTAINER_COMMANDS:
        verbs, done, action = CONTAINER_COMMANDS[args.command]
        return [Stage(verbs, done, action(list(dict.fromkeys(args.services))))], False
    return [
        PREREQUISITES_STAGE,
        Stage(["Installing", "Unpacking"], "Installed", install),
        Stage(["Deploying", "Weaving"], "Deployed", deploy),
        service_stage("database"),
        Stage(["Testing", "Clauding"], "Tests passed", test),
        Stage(["Verifying"], "Verified", verify),
    ], False


def main():
    os.system("")  # enable ANSI escape handling on legacy Windows consoles
    sys.stdout.reconfigure(encoding="utf-8")  # braille frames on cp1252 consoles

    parser = build_parser()
    if sys.argv[1:2] == ["__complete"]:  # called by the completion script on every TAB; not a real command
        print("\n".join(candidates(parser, sys.argv[2:], service_names, list(SERVICES))))
        return
    args = parser.parse_args()
    if args.command in ("completion", "logs") and not args.interactive:  # output meant for eval / streaming
        sys.exit(execute(args))

    print(banner)
    if args.interactive:
        complete = lambda words: candidates(parser, words, cached_service_names, list(SERVICES))  # noqa: E731
        sys.exit(run_shell(parser, execute, complete))
    if args.command is None:
        parser.print_help()
        sys.exit(2)
    try:
        sys.exit(execute(args))
    except KeyboardInterrupt:
        sys.exit(130)


@functools.lru_cache(maxsize=None)
def _service_names_once():
    return tuple(service_names())


def cached_service_names():
    """Compose services for TAB completion in the shell, read once per session (each read takes ~0.3s)."""
    return list(_service_names_once())


def execute(args):
    """Run one parsed command and return its exit code (used by both the CLI and the interactive shell)."""
    if args.command == "logs":  # streams output; no .env or spinner needed
        return show_logs(list(dict.fromkeys(args.services)), args.tail, args.follow, args.timestamps)
    if args.command == "completion":
        print(bash_script(sys.executable, str(Path(__file__).resolve())))
        return 0

    # Start from the shell's environment each time, so .env edits apply to the next command in the shell.
    os.environ.clear()
    os.environ.update(SHELL_ENVIRON)
    if load_env(ENV_FILE):
        print(f"{Color.BLUE}ℹ Loaded {ENV_FILE.name}{Color.RESET}")
    else:
        print(f"{Color.YELLOW}⚠ {ENV_FILE} not found, using environment variables only{Color.RESET}")

    stages, keep_going = stages_for(args)
    return 0 if run_pipeline(stages, keep_going=keep_going) else 1


if __name__ == "__main__":
    main()

