"""Verify the PostgreSQL database from .env accepts a login, using only the standard library.

Speaks just enough of the PostgreSQL wire protocol to authenticate (trust, cleartext, md5 or
SCRAM-SHA-256) and read the server version, then disconnects.
"""

import base64
import hashlib
import hmac
import os
import re
import socket
import struct
from urllib.parse import urlsplit

URL_VAR = "SPRING_DATASOURCE_URL"
USER_VAR = "SPRING_DATASOURCE_USERNAME"
PASSWORD_VAR = "SPRING_DATASOURCE_PASSWORD"


def parse_jdbc_url(url):
    """'jdbc:postgresql://host:5432/db?x=y' -> (host, port, db)."""
    unresolved = re.findall(r"\$\{([^}:]+)", url)
    if unresolved:
        raise RuntimeError(f"{URL_VAR} uses undefined variables: {', '.join(unresolved)}")
    parts = urlsplit(url.removeprefix("jdbc:"))
    try:
        port = parts.port or 5432
    except ValueError:
        raise RuntimeError(f"{URL_VAR} has an invalid port: {url}")
    if parts.scheme != "postgresql" or not parts.hostname or not parts.path.strip("/"):
        raise RuntimeError(f"{URL_VAR} is not a postgresql URL: {url}")
    return parts.hostname, port, parts.path.strip("/")


class PgConnection:
    def __init__(self, host, port, timeout):
        try:
            self.sock = socket.create_connection((host, port), timeout=timeout)
        except socket.timeout:
            raise RuntimeError(f"can't reach {host}:{port} (timed out)")
        except OSError as e:
            raise RuntimeError(f"can't reach {host}:{port} ({e.strerror or e})")

    def close(self):
        try:
            self.sock.sendall(b"X" + struct.pack("!I", 4))  # Terminate
        except OSError:
            pass
        self.sock.close()

    def send(self, msg_type, payload):
        self.sock.sendall(msg_type + struct.pack("!I", len(payload) + 4) + payload)

    def _recv_exact(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise RuntimeError("server closed the connection")
            buf += chunk
        return buf

    def recv(self):
        """Return (type, payload) of the next message; raise on ErrorResponse."""
        msg_type = self._recv_exact(1)
        (length,) = struct.unpack("!I", self._recv_exact(4))
        payload = self._recv_exact(length - 4)
        if msg_type == b"E":
            fields = dict((f[:1], f[1:].decode(errors="replace")) for f in payload.split(b"\0") if f)
            raise RuntimeError(fields.get(b"M", "server returned an error"))
        return msg_type, payload


def _scram_sha256(conn, password, mechanisms):
    if b"SCRAM-SHA-256" not in mechanisms.split(b"\0"):
        raise RuntimeError(f"unsupported auth mechanisms: {mechanisms.decode(errors='replace')}")
    nonce = base64.b64encode(os.urandom(18)).decode()
    client_first_bare = f"n=,r={nonce}"
    client_first = ("n,," + client_first_bare).encode()
    conn.send(b"p", b"SCRAM-SHA-256\0" + struct.pack("!I", len(client_first)) + client_first)

    _, payload = conn.recv()
    server_first = payload[4:].decode()
    attrs = dict(item.split("=", 1) for item in server_first.split(","))
    if not attrs["r"].startswith(nonce):
        raise RuntimeError("SCRAM nonce mismatch")
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(attrs["s"]), int(attrs["i"]))
    client_key = hmac.digest(salted, b"Client Key", "sha256")
    client_final_no_proof = f"c=biws,r={attrs['r']}"
    auth_message = f"{client_first_bare},{server_first},{client_final_no_proof}".encode()
    signature = hmac.digest(hashlib.sha256(client_key).digest(), auth_message, "sha256")
    proof = base64.b64encode(bytes(a ^ b for a, b in zip(client_key, signature))).decode()
    conn.send(b"p", f"{client_final_no_proof},p={proof}".encode())

    _, payload = conn.recv()
    server_signature = hmac.digest(hmac.digest(salted, b"Server Key", "sha256"), auth_message, "sha256")
    if payload[4:].decode() != "v=" + base64.b64encode(server_signature).decode():
        raise RuntimeError("server SCRAM signature mismatch")


def postgres_login(host, port, database, user, password, timeout=5):
    """Log in and return the server version, or raise RuntimeError."""
    conn = PgConnection(host, port, timeout)
    try:
        params = f"user\0{user}\0database\0{database}\0\0".encode()
        conn.sock.sendall(struct.pack("!II", len(params) + 8, 196608) + params)  # protocol 3.0

        server_version = "unknown version"
        while True:
            msg_type, payload = conn.recv()
            if msg_type == b"R":
                (code,) = struct.unpack("!I", payload[:4])
                if code == 3:  # cleartext
                    conn.send(b"p", password.encode() + b"\0")
                elif code == 5:  # md5
                    inner = hashlib.md5((password + user).encode()).hexdigest()
                    digest = hashlib.md5(inner.encode() + payload[4:8]).hexdigest()
                    conn.send(b"p", f"md5{digest}".encode() + b"\0")
                elif code == 10:  # SASL
                    _scram_sha256(conn, password, payload[4:])
                elif code != 0:
                    raise RuntimeError(f"unsupported authentication method (code {code})")
            elif msg_type == b"S":
                name, value = payload.split(b"\0")[:2]
                if name == b"server_version":
                    server_version = value.decode()
            elif msg_type == b"Z":  # ReadyForQuery: logged in
                return server_version
    except socket.timeout:
        raise RuntimeError(f"{host}:{port} stopped responding")
    finally:
        conn.close()


def check_database(sp):
    """Pipeline stage: read the datasource from .env and log in to PostgreSQL."""
    missing = [var for var in (URL_VAR, USER_VAR, PASSWORD_VAR) if var not in os.environ]
    if missing:
        raise RuntimeError(f"not set in .env: {', '.join(missing)}")

    host, port, database = parse_jdbc_url(os.environ[URL_VAR])
    user = os.environ[USER_VAR]
    sp.info(f"connecting to {host}:{port}/{database} as {user}")
    version = postgres_login(host, port, database, user, os.environ[PASSWORD_VAR])
    sp.success(f"PostgreSQL {version}")
