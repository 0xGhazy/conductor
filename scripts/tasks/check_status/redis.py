"""Verify Redis answers PING, using only the standard library (RESP protocol over a socket) or docker exec."""

import os
import shutil
import socket
import ssl
import subprocess

from .web import env, env_flag


def _command(conn, reader, *args):
    """Send one command and return its reply (simple string or bulk string); raise on error replies."""
    payload = f"*{len(args)}\r\n" + "".join(f"${len(a.encode())}\r\n{a}\r\n" for a in args)
    conn.sendall(payload.encode())
    line = reader.readline().decode(errors="replace").rstrip("\r\n")
    if not line:
        raise RuntimeError("server closed the connection")
    if line.startswith("-"):
        raise RuntimeError(line[1:])
    if line.startswith("$"):
        length = int(line[1:])
        return "" if length < 0 else reader.read(length + 2)[:-2].decode(errors="replace")
    return line[1:]


def _check_via_socket(host, port, username, password, ssl_enabled, connect_timeout, read_timeout):
    conn = socket.create_connection((host, port), timeout=connect_timeout)
    if ssl_enabled:
        context = ssl.create_default_context()
        conn = context.wrap_socket(conn, server_hostname=host)
    conn.settimeout(read_timeout)
    reader = conn.makefile("rb")
    try:
        if password:
            auth_args = ["AUTH"]
            if username:
                auth_args.append(username)
            auth_args.append(password)
            _command(conn, reader, *auth_args)
        reply = _command(conn, reader, "PING")
        if reply != "PONG":
            raise RuntimeError(f"unexpected PING reply: {reply}")
        info = _command(conn, reader, "INFO", "server")
        version = next((l.split(":", 1)[1] for l in info.splitlines() if l.startswith("redis_version:")), "unknown")
        return version
    finally:
        reader.close()
        conn.close()


LOCAL_HOSTS = {"rs", "conductor-redis", "redis", "localhost", "127.0.0.1", "0.0.0.0"}


def _find_redis_containers(host=None):
    """Find running redis containers when host refers to a local or docker service."""
    if not shutil.which("docker"):
        return []
    try:
        r = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if r.returncode != 0:
            return []
        names = [n.strip() for n in r.stdout.splitlines() if n.strip()]

        is_local_or_docker = (
            host is None
            or host.lower() in LOCAL_HOSTS
            or any(host.lower() in n.lower() for n in names)
        )
        if not is_local_or_docker:
            return []

        matches = []
        if host:
            matches.extend([n for n in names if n == host or host in n.split("-") or host in n.split("_")])
        matches.extend([n for n in names if "redis" in n.lower() and n not in matches])
        return matches
    except Exception:
        return []


def _check_via_docker(container, port, username, password, timeout=5):
    """Check redis reachability and get server version via docker exec redis-cli."""
    base_cmd = ["docker", "exec", container, "redis-cli"]
    if port:
        base_cmd.extend(["-p", str(port)])
    if username:
        base_cmd.extend(["--user", username])
    if password:
        base_cmd.extend(["-a", password])

    ping_res = subprocess.run([*base_cmd, "ping"], capture_output=True, text=True, timeout=timeout)
    if ping_res.returncode != 0:
        err = (ping_res.stderr or ping_res.stdout).strip()
        raise RuntimeError(f"docker exec {container} failed: {err}")
    if "PONG" not in ping_res.stdout:
        raise RuntimeError(f"unexpected PING reply: {ping_res.stdout.strip()}")

    info_res = subprocess.run([*base_cmd, "info", "server"], capture_output=True, text=True, timeout=timeout)
    version = "unknown"
    if info_res.returncode == 0:
        version = next((l.split(":", 1)[1].strip() for l in info_res.stdout.splitlines() if l.startswith("redis_version:")), "unknown")
    return version


def check_redis(sp):
    host = env("WEAVER_REDIS_HOST", env("SPRING_DATA_REDIS_HOST", "localhost"))
    port = int(env("WEAVER_REDIS_PORT", env("SPRING_DATA_REDIS_PORT", "6379")))
    username = os.environ.get("WEAVER_REDIS_USERNAME") or os.environ.get("SPRING_DATA_REDIS_USERNAME") or None
    password = os.environ.get("WEAVER_REDIS_PASSWORD") or os.environ.get("SPRING_DATA_REDIS_PASSWORD") or None
    ssl_enabled = env_flag("WEAVER_REDIS_SSL_ENABLED", False)

    try:
        connect_timeout = float(env("WEAVER_REDIS_CONNECT_TIMEOUT", "5000")) / 1000.0
    except ValueError:
        connect_timeout = 5.0

    try:
        read_timeout = float(env("WEAVER_REDIS_TIMEOUT", "3000")) / 1000.0
    except ValueError:
        read_timeout = 3.0

    sp.info(f"connecting to {host}:{port}")

    socket_err = None
    try:
        version = _check_via_socket(host, port, username, password, ssl_enabled, connect_timeout, read_timeout)
        sp.success(f"Redis {version}")
        return
    except (socket.timeout, TimeoutError):
        socket_err = f"can't reach {host}:{port} (timed out)"
    except OSError as e:
        socket_err = f"can't reach {host}:{port} ({e.strerror or e})"
    except RuntimeError as e:
        socket_err = str(e)

    # If direct socket connection fails (e.g. host is a Docker network alias like 'rs' or unmapped port),
    # fallback to validating via running Docker redis container
    containers = _find_redis_containers(host)
    if containers:
        for container in containers:
            try:
                version = _check_via_docker(container, port, username, password, timeout=read_timeout or 5.0)
                sp.success(f"Redis {version}")
                return
            except Exception:
                continue

    raise RuntimeError(socket_err or f"can't reach {host}:{port}")
