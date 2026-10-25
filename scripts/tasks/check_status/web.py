import base64
import json
import os
import socket
import ssl
import urllib.error
import urllib.request


def env(name, default):
    """Environment variable, falling back to `default` when unset or empty."""
    return os.environ.get(name) or default


def env_flag(name, default=False):
    """Boolean environment variable: true / 1 / yes (any case) count as on."""
    value = os.environ.get(name)
    return default if not value else value.strip().lower() in ("true", "1", "yes")


def http_get(url, timeout=5, username=None, password=None):
    """GET `url` and return (status, body). Non-2xx statuses are returned, not raised."""
    request = urllib.request.Request(url, headers={"Accept": "application/json"})
    if username:
        token = base64.b64encode(f"{username}:{password or ''}".encode()).decode()
        request.add_header("Authorization", f"Basic {token}")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")
    except urllib.error.URLError as e:
        if isinstance(e.reason, ssl.SSLCertVerificationError):
            raise RuntimeError(f"{url} has an untrusted TLS certificate ({e.reason.verify_message})")
        if isinstance(e.reason, ssl.SSLError):
            raise RuntimeError(f"TLS handshake with {url} failed; is the server serving HTTPS?")
        reason = getattr(e.reason, "strerror", None) or e.reason
        raise RuntimeError(f"can't reach {url} ({reason})")
    except (socket.timeout, TimeoutError):
        raise RuntimeError(f"{url} timed out")


def parse_json(url, body):
    try:
        return json.loads(body)
    except ValueError:
        raise RuntimeError(f"{url} didn't return JSON")


def get_json(url, **kwargs):
    """GET `url`, require HTTP 200 and return the parsed JSON body."""
    status, body = http_get(url, **kwargs)
    if status != 200:
        raise RuntimeError(f"{url} returned HTTP {status}")
    return parse_json(url, body)
