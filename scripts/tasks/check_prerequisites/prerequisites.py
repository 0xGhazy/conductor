import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def tool_version(executable, args, timeout=30):
    """Return the first line of the tool's version output, or raise RuntimeError."""
    path = shutil.which(executable)  # resolves .exe/.cmd via PATHEXT on Windows
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


def _parse_java_version(output):
    """Extract major version and first line from 'java -version' output.

    Handles standard version patterns such as:
    - 'openjdk version "21.0.3" ...' -> major 21
    - 'java version "17.0.7" ...'    -> major 17
    - 'java version "1.8.0_351"'     -> major 8
    """
    first_line = output.splitlines()[0].strip() if output else "unknown"
    m = re.search(r'version\s+"?(\d+)(?:\.(\d+))?', output, re.IGNORECASE)
    if not m:
        m = re.search(r'(?:openjdk|java)\s+"?(\d+)(?:\.(\d+))?', output, re.IGNORECASE)
    if not m:
        m = re.search(r'(\d+)(?:\.(\d+))?', output)
    if not m:
        return None, first_line
    major = int(m.group(1))
    if major == 1 and m.group(2):
        major = int(m.group(2))
    return major, first_line


def check_java_21():
    """Check for Java 21+ installation.

    Inspects:
    1. Executable on PATH (shutil.which('java'))
    2. JAVA_HOME environment variable
    3. Common JDK installation paths if neither PATH nor JAVA_HOME is Java 21+

    Returns:
        (ok: bool, message: str, major_version: int | None)
    """
    candidates = []
    which_java = shutil.which("java")
    if which_java:
        candidates.append(("PATH", Path(which_java)))

    jh = os.environ.get("JAVA_HOME")
    if jh:
        jh_java = Path(jh) / "bin" / ("java.exe" if os.name == "nt" else "java")
        if jh_java.is_file() and not any(p == jh_java for _, p in candidates):
            candidates.append(("JAVA_HOME", jh_java))

    best_version_str = None
    best_major = None
    best_src = None

    for src, p in candidates:
        try:
            r = subprocess.run([str(p), "-version"], capture_output=True, text=True, timeout=15)
            raw = ((r.stdout or "") + "\n" + (r.stderr or "")).strip()
            major, first_line = _parse_java_version(raw)
            if major is not None:
                if major >= 21:
                    return True, f"{first_line} ({src})", major
                if best_major is None or major > best_major:
                    best_major = major
                    best_version_str = first_line
                    best_src = src
        except Exception:
            continue

    # If neither PATH nor JAVA_HOME meets Java 21+, inspect standard directory locations
    discovered = []
    if os.name == "nt":
        search_dirs = [
            Path("C:/Program Files/Java"),
            Path("C:/Program Files/Eclipse Adoptium"),
            Path("C:/Program Files/Microsoft"),
            Path.home() / ".antigravity/extensions",
        ]
        for base in search_dirs:
            if base.is_dir():
                try:
                    for java_bin in base.glob("**/bin/java.exe"):
                        if not any(p == java_bin for _, p in candidates):
                            try:
                                r = subprocess.run(
                                    [str(java_bin), "-version"],
                                    capture_output=True,
                                    text=True,
                                    timeout=10,
                                )
                                raw = ((r.stdout or "") + "\n" + (r.stderr or "")).strip()
                                major, first_line = _parse_java_version(raw)
                                if major and major >= 21:
                                    discovered.append((java_bin.parent.parent, first_line))
                                    break
                            except Exception:
                                pass
                except Exception:
                    pass

    if discovered:
        jdk_home, vline = discovered[0]
        return (
            False,
            f"found {vline} at {jdk_home}, but PATH/JAVA_HOME points to Java {best_major} "
            f"(set JAVA_HOME={jdk_home})",
            best_major,
        )

    if best_version_str:
        return False, f"{best_version_str} ({best_src}) - Java 21+ required, found Java {best_major}", best_major

    return False, "not installed (Java 21+ required)", None


def check_maven():
    """Check for Maven on PATH, MAVEN_HOME / M2_HOME, or project wrapper."""
    which_mvn = shutil.which("mvn")
    if which_mvn:
        try:
            r = subprocess.run([which_mvn, "-v"], capture_output=True, text=True, timeout=20)
            if r.returncode == 0 and (r.stdout or r.stderr):
                return True, (r.stdout or r.stderr).strip().splitlines()[0]
        except Exception:
            pass

    for env_var in ("MAVEN_HOME", "M2_HOME"):
        val = os.environ.get(env_var)
        if val:
            p = Path(val) / "bin" / ("mvn.cmd" if os.name == "nt" else "mvn")
            if p.is_file():
                try:
                    r = subprocess.run([str(p), "-v"], capture_output=True, text=True, timeout=20)
                    if r.returncode == 0 and (r.stdout or r.stderr):
                        return True, (r.stdout or r.stderr).strip().splitlines()[0]
                except Exception:
                    pass

    wrapper = ROOT / ("mvnw.cmd" if os.name == "nt" else "mvnw")
    if wrapper.is_file():
        try:
            r = subprocess.run([str(wrapper), "-v"], capture_output=True, text=True, timeout=20)
            if r.returncode == 0 and (r.stdout or r.stderr):
                return True, f"{(r.stdout or r.stderr).strip().splitlines()[0]} (wrapper)"
        except Exception:
            pass

    return False, "not installed"


def check_node():
    """Check for Node.js executable and version."""
    which_node = shutil.which("node")
    if not which_node:
        return False, "not installed"
    try:
        r = subprocess.run([which_node, "--version"], capture_output=True, text=True, timeout=15)
        if r.returncode == 0 and (r.stdout or r.stderr):
            return True, (r.stdout or r.stderr).strip().splitlines()[0]
        return False, f"exited with code {r.returncode}"
    except Exception as e:
        return False, str(e)


def check_npm():
    """Check for NPM executable and version."""
    which_npm = shutil.which("npm")
    if not which_npm:
        return False, "not installed"
    try:
        r = subprocess.run([which_npm, "--version"], capture_output=True, text=True, timeout=15)
        if r.returncode == 0 and (r.stdout or r.stderr):
            return True, (r.stdout or r.stderr).strip().splitlines()[0]
        return False, f"exited with code {r.returncode}"
    except Exception as e:
        return False, str(e)


def check_docker():
    """Check for Docker CLI."""
    which_docker = shutil.which("docker")
    if not which_docker:
        return False, "not installed"
    try:
        r = subprocess.run([which_docker, "--version"], capture_output=True, text=True, timeout=15)
        if r.returncode == 0 and (r.stdout or r.stderr):
            return True, (r.stdout or r.stderr).strip().splitlines()[0]
        return False, f"exited with code {r.returncode}"
    except Exception as e:
        return False, str(e)


def check_docker_compose():
    """Check for Docker Compose (compose plugin or docker-compose)."""
    try:
        version = compose_version()
        return True, version
    except RuntimeError as e:
        return False, str(e)


def check_env(sp, verbose=False):
    """Verify prerequisites and report readiness for service and containerized installation."""
    # 1. Service Prerequisites
    sp.update("Checking service prerequisites")
    java_ok, java_msg, java_major = check_java_21()
    maven_ok, maven_msg = check_maven()
    node_ok, node_msg = check_node()
    npm_ok, npm_msg = check_npm()

    if verbose:
        sp.info("Service prerequisites:")
        (sp.success if java_ok else sp.error)(f"Java 21: {java_msg}")
        (sp.success if maven_ok else sp.error)(f"Maven: {maven_msg}")
        (sp.success if node_ok else sp.error)(f"Node: {node_msg}")
        (sp.success if npm_ok else sp.error)(f"NPM: {npm_msg}")

    # 2. Containerized Prerequisites
    sp.update("Checking containerized prerequisites")
    docker_ok, docker_msg = check_docker()
    compose_ok, compose_msg = check_docker_compose()

    if verbose:
        sp.info("Containerized prerequisites:")
        (sp.success if docker_ok else sp.error)(f"Docker: {docker_msg}")
        (sp.success if compose_ok else sp.error)(f"Docker Compose: {compose_msg}")

    # 3. Installation Readiness Evaluation
    service_missing = []
    if not java_ok:
        if java_major is not None:
            service_missing.append(f"Java 21 (found Java {java_major})")
        else:
            service_missing.append("Java 21")
    if not maven_ok:
        service_missing.append("Maven")
    if not node_ok:
        service_missing.append("Node")
    if not npm_ok:
        service_missing.append("NPM")

    container_missing = []
    if not docker_ok:
        container_missing.append("Docker")
    if not compose_ok:
        container_missing.append("Docker Compose")

    sp.update("Evaluating readiness")

    can_service = len(service_missing) == 0
    can_containerized = len(container_missing) == 0

    if can_service:
        sp.success("Service installation: READY")
    elif verbose or not can_containerized:
        sp.warn(f"Service installation: NOT READY (missing: {', '.join(service_missing)})")

    if can_containerized:
        sp.success("Containerized installation: READY")
    elif verbose or not can_service:
        sp.warn(f"Containerized installation: NOT READY (missing: {', '.join(container_missing)})")

    if not can_service and not can_containerized:
        raise RuntimeError(
            "Neither service nor containerized environment is ready for installation"
        )


def check_prerequisites(sp):
    """Pipeline stage: legacy alias for check_env."""
    return check_env(sp)
