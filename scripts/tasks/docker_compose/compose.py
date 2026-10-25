"""Start, stop and restart the containers in docker/docker-compose.yaml."""

import json
import os
import shutil
import subprocess
from pathlib import Path

from ...console import Color
from ...env import SHELL_ENVIRON

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_COMPOSE_FILE = "docker/docker-compose-postgres-redis-elasticsearch8.yaml"
WAIT_TIMEOUT = 300  # seconds `run` / `restart` wait for containers to become healthy

# CLI service names -> compose service names, so `run database` matches `check database`.
ALIASES = {"server": "conductor-server", "database": "postgres", "identity": "keycloak"}


def _compose_base():
    if subprocess.run(["docker", "compose", "version"], capture_output=True).returncode == 0:
        binary = ["docker", "compose"]
    elif shutil.which("docker-compose"):
        binary = ["docker-compose"]
    else:
        raise RuntimeError("Docker Compose not found (install Docker with the compose plugin)")
    compose_file = ROOT / SHELL_ENVIRON.get("COMPOSE_FILE", DEFAULT_COMPOSE_FILE)
    if not compose_file.is_file():
        raise RuntimeError(f"compose file not found: {compose_file}")
    return [*binary, "-f", str(compose_file)]


def _compose(base, *args):
    """Run a compose command and return its stdout, or raise with compose's own error message."""
    # SHELL_ENVIRON, not os.environ: root .env values would otherwise override docker/.env in the containers.
    result = subprocess.run([*base, *args], capture_output=True, text=True, cwd=ROOT, env=SHELL_ENVIRON)
    if result.returncode != 0:
        lines = [line.strip() for line in result.stderr.splitlines() if line.strip()]
        errors = [line for line in lines if "error" in line.lower() or "unhealthy" in line.lower()]
        raise RuntimeError((errors or lines or [f"exited with code {result.returncode}"])[-1])
    return result.stdout


def _resolve(base, names):
    """Map CLI names (with aliases) to compose services; an empty list means all services."""
    available = _compose(base, "config", "--services").split()
    services = [ALIASES.get(name, name) for name in names]
    unknown = [name for name, service in zip(names, services) if service not in available]
    if unknown:
        raise RuntimeError(f"unknown service: {', '.join(unknown)} (choose from {', '.join(available)})")
    return services


def service_names():
    """Compose services plus their aliases, for tab completion. Empty if compose isn't usable."""
    try:
        services = _compose(_compose_base(), "config", "--services").split()
    except (RuntimeError, OSError):
        return []
    return services + [alias for alias, service in ALIASES.items() if service in services]


def _containers(base, services):
    """Return compose's container list, handling both JSON-lines (newer) and JSON-array (older) output."""
    out = _compose(base, "ps", "--all", "--format", "json", *services).strip()
    if not out:
        return []
    if out.startswith("["):
        return json.loads(out)
    return [json.loads(line) for line in out.splitlines() if line.strip()]


def _log_status(sp, base, services):
    """One compact line, e.g. `postgres [✓ healthy], redis [✓ running], keycloak [■ exited]`."""
    try:
        containers = _containers(base, services)
    except (RuntimeError, ValueError) as e:  # don't hide the error that brought us here
        sp.warn(f"couldn't read container status: {e}")
        return
    marks = []
    for container in sorted(containers, key=lambda c: c.get("Service", "")):
        color, text = _state(container)
        marks.append(f"{container.get('Service', container.get('Name', '?'))} [{color}{text}{Color.RESET}]")
    sp.write("        " + (", ".join(marks) if marks else f"{Color.DIM}no containers{Color.RESET}"))


def _state(container):
    """(color, text) for a container's state, e.g. (GREEN, '✓ healthy') or (DIM, '■ exited')."""
    state, health = container.get("State", "unknown"), container.get("Health", "")
    if state == "running" and health in ("", "healthy"):
        return Color.GREEN, f"✓ {health or state}"
    if state == "running":
        unhealthy = health == "unhealthy"
        return (Color.RED if unhealthy else Color.YELLOW), f"{'✗' if unhealthy else '⚠'} {health}"
    return Color.DIM, f"■ {state}"


def _ports(container):
    """Published ports as `host→container`, e.g. `8127→5000`; IPv4/IPv6 duplicates collapsed."""
    published = {
        f"{p['PublishedPort']}→{p['TargetPort']}"
        for p in container.get("Publishers") or [] if p.get("PublishedPort")
    }
    return ", ".join(sorted(published, key=lambda port: int(port.split("→")[0])))


def show_logs(names, tail, follow, timestamps):
    """Stream container logs straight to the terminal (no spinner). Returns the process exit code."""
    try:
        base = _compose_base()
        services = _resolve(base, names)
    except RuntimeError as e:
        print(f"{Color.RED}✗ {e}{Color.RESET}", flush=True)
        return 1

    args = ["logs", "--tail", str(tail)]
    if follow:
        args.append("--follow")
    if timestamps:
        args.append("--timestamps")
    hint = f" {Color.DIM}(Ctrl+C to stop){Color.RESET}" if follow else ""
    # flush, or the header lands after the logs when output is piped (compose writes to the terminal directly)
    print(f"{Color.BLUE}ℹ logs for {_target(services)}, last {tail} lines{Color.RESET}{hint}\n", flush=True)
    try:
        return subprocess.run([*base, *args, *services], cwd=ROOT, env=SHELL_ENVIRON).returncode
    except KeyboardInterrupt:  # Ctrl+C is how you leave --follow, not an error
        print()
        return 0


def list_containers(names):
    def action(sp):
        base = _compose_base()
        services = _resolve(base, names)
        containers = {c.get("Service"): c for c in _containers(base, services)}
        rows = []
        for service in services or _compose(base, "config", "--services").split():
            container = containers.get(service)
            if container is None:
                rows.append((service, "-", (Color.DIM, "■ not created"), "", ""))
            else:
                rows.append((service, container.get("Name", "?"), _state(container),
                             container.get("Status", ""), _ports(container)))

        header = ("SERVICE", "CONTAINER", "STATE", "STATUS", "PORTS")
        widths = [max(len(header[i]), *(len(row[i] if i != 2 else row[i][1]) for row in rows)) for i in range(4)]
        padded_header = [h.ljust(w) for h, w in zip(header, widths)] + [header[4]]
        sp.write("        " + Color.DIM + "  ".join(padded_header) + Color.RESET)
        for service, name, (color, state), status, ports in rows:
            # pad before adding color codes, which would otherwise count toward the column width
            sp.write("        " + "  ".join([service.ljust(widths[0]), name.ljust(widths[1]),
                                              f"{color}{state.ljust(widths[2])}{Color.RESET}",
                                              status.ljust(widths[3]), ports]))
        running = sum(1 for c in containers.values() if c.get("State") == "running")
        sp.info(f"{running} of {len(rows)} running")
    return action


def _target(services):
    return ", ".join(services) if services else "all services"


def run_containers(names):
    def action(sp):
        base = _compose_base()
        services = _resolve(base, names)
        sp.info(f"starting {_target(services)}")
        sp.update("Waiting for containers to be healthy")
        try:
            _compose(base, "up", "--detach", "--wait", "--wait-timeout", str(WAIT_TIMEOUT), *services)
        finally:
            _log_status(sp, base, services)
    return action


def stop_containers(names):
    def action(sp):
        base = _compose_base()
        services = _resolve(base, names)
        sp.info(f"stopping {_target(services)}")
        try:
            _compose(base, "stop", *services)
        finally:
            _log_status(sp, base, services)
    return action


def restart_containers(names):
    def action(sp):
        base = _compose_base()
        services = _resolve(base, names)
        sp.info(f"restarting {_target(services)}")
        try:
            _compose(base, "restart", *services)
            sp.update("Waiting for containers to be healthy")
            # `restart` can't wait for health checks; `up --wait --no-recreate` on running containers only waits.
            # Without --no-recreate, compose would rebuild containers whose config looks changed, e.g. when they
            # were created from Windows (D:\...) and this runs in WSL (/mnt/d/...).
            _compose(base, "up", "--detach", "--no-recreate", "--wait", "--wait-timeout", str(WAIT_TIMEOUT), *services)
        finally:
            _log_status(sp, base, services)
    return action
