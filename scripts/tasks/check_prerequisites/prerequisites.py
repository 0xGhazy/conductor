import shutil
import subprocess


def tool_version(executable, args, timeout=30):
    """Return the first line of the tool's version output, or raise RuntimeError."""
    path = shutil.which(executable)  # resolves docker.exe via PATHEXT on Windows
    if path is None:
        raise RuntimeError("not installed")
    try:
        r = subprocess.run([path, *args], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"'{executable} {' '.join(args)}' timed out")
    output = (r.stdout or r.stderr).strip()
    if r.returncode != 0 or not output:
        raise RuntimeError(f"'{executable} {' '.join(args)}' exited with code {r.returncode}")
    return output.splitlines()[0]


def compose_version(timeout=30):
    """Return the first line of docker compose version output, or raise RuntimeError."""
    docker_path = shutil.which("docker")
    if docker_path is not None:
        try:
            r = subprocess.run([docker_path, "compose", "version"], capture_output=True, text=True, timeout=timeout)
            if r.returncode == 0 and (r.stdout or r.stderr).strip():
                return (r.stdout or r.stderr).strip().splitlines()[0]
        except (subprocess.TimeoutExpired, Exception):
            pass

    compose_path = shutil.which("docker-compose")
    if compose_path is not None:
        try:
            r = subprocess.run([compose_path, "--version"], capture_output=True, text=True, timeout=timeout)
            if r.returncode == 0 and (r.stdout or r.stderr).strip():
                return (r.stdout or r.stderr).strip().splitlines()[0]
        except subprocess.TimeoutExpired:
            raise RuntimeError("'docker-compose --version' timed out")

    raise RuntimeError("not installed (install Docker with compose plugin or docker-compose)")


def check_prerequisites(sp):
    """Pipeline stage: verify Docker and Docker Compose are installed."""
    missing = []

    # 1. Check Docker
    sp.update("Checking Docker")
    try:
        version = tool_version("docker", ["--version"])
        sp.success(f"Docker: {version}")
    except RuntimeError as e:
        sp.error(f"Docker: {e}")
        missing.append("Docker")

    # 2. Check Docker Compose
    sp.update("Checking Docker Compose")
    try:
        version = compose_version()
        sp.success(f"Docker Compose: {version}")
    except RuntimeError as e:
        sp.error(f"Docker Compose: {e}")
        missing.append("Docker Compose")

    if missing:
        raise RuntimeError(f"missing or broken: {', '.join(missing)}")

