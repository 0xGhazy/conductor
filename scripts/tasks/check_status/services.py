"""HTTP-based service checks. URLs come from .env, with the docker-compose defaults as fallback."""

import os

from ...console import Color
from .. import StageSkipped
from .web import env, env_flag, get_json, http_get, parse_json


def check_server(sp):
    scheme = "https" if env_flag("WEAVER_TLS_ENABLED") else "http"
    host = env("WEAVER_HOST", "localhost")
    port = env("WEAVER_PORT", env("SERVER_PORT", "9090"))
    base = f"{scheme}://{host}:{port}"
    url = _server_url(base, "WEAVER_HEALTH_URL", "/actuator/health")
    sp.info(f"requesting {url}")
    status, body = http_get(url)  # any response means the server is up; actuator answers 503 when a component is DOWN
    sp.success(f"server responded at {base} (HTTP {status})")
    try:
        _log_health(sp, parse_json(url, body))
    except RuntimeError:
        sp.warn("health response isn't JSON, can't list components")
    _log_links(sp, base, f"{scheme}://{host}:{env('WEAVER_UI_PORT', '8127')}", url)


def _server_url(base, variable, default_path):
    return base + "/" + env(variable, default_path).lstrip("/")


def _log_links(sp, base, ui_url, health_url):
    """Print the server's useful URLs, e.g. `API Docs:   http://localhost:8080/api-docs`."""
    links = [
        ("API Docs", _server_url(base, "WEAVER_API_DOCS_URL", "/api-docs")),
        ("Swagger", _server_url(base, "WEAVER_SWAGGER_URL", "/swagger-ui/index.html")),
        ("Frontend", ui_url),
        ("Health", health_url),
        ("Prometheus", _server_url(base, "WEAVER_PROMETHEUS_URL", "/actuator/prometheus")),
    ]
    width = max(len(label) for label, _ in links) + 1
    for label, link in links:
        sp.write(f"        {Color.DIM}{label + ':':<{width}}{Color.RESET} {Color.BLUE}{link}{Color.RESET}")


def _log_health(sp, data):
    unused = _unused_search_components()
    components = [
        (name, component) for name, component in _health_components(data.get("components", {}))
        if name.split(".")[0] not in unused
    ]
    if not components:
        sp.warn("no health components exposed (see management.endpoint.health.show-components)")
    else:
        _log_components(sp, components)
    # Skip the overall warning when only a hidden, unused search component is pulling it down.
    if data.get("status", "UP") != "UP" and any(c.get("status") != "UP" for _, c in components):
        sp.warn(f"server reports overall health {data['status']}")


def _unused_search_components():
    """Search engine health components to hide because indexing doesn't use them (e.g. provider is postgres)."""
    provider = env("WEAVER_INDEXING_PROVIDER", "postgres").lower() if env_flag("WEAVER_INDEXING_ENABLED") else ""
    return {engine for engine in ("elasticsearch", "opensearch") if not provider.startswith(engine)}


def _health_components(components, parent=""):
    """Yield (name, component) for each actuator health component, flattening groups like db.primary."""
    for name, component in components.items():
        full_name = f"{parent}{name}"
        if "components" in component:
            yield from _health_components(component["components"], f"{full_name}.")
        else:
            yield full_name, component


# Actuator component names shown under friendlier labels; `ping` only says the server answered, which we know.
_COMPONENT_LABELS = {"db": "database"}
_HIDDEN_COMPONENTS = {"ping"}


def _log_components(sp, components):
    """One compact line, e.g. `database [✓], redis [✓], elasticsearch [✗]`, then the reason for each problem."""
    shown = [(name, c) for name, c in components if name not in _HIDDEN_COMPONENTS]
    marks, problems = [], []
    for name, component in shown:
        top, dot, rest = name.partition(".")
        label = _COMPONENT_LABELS.get(top, top) + dot + rest
        state = component.get("status", "UNKNOWN")
        if state == "UP":
            marks.append(f"{label} [{Color.GREEN}✓{Color.RESET}]")
            continue
        color = Color.RED if state == "DOWN" else Color.YELLOW
        marks.append(f"{label} [{color}{'✗' if state == 'DOWN' else '⚠'}{Color.RESET}]")
        details = component.get("details", {})
        error = (str(details.get("error", "")).splitlines() or [""])[0][:150] if isinstance(details, dict) else ""
        problems.append(f"{color}{label}: {state}{f' ({error})' if error else ''}{Color.RESET}")
    if marks:
        sp.write("        " + ", ".join(marks))
    for problem in problems:
        sp.write("          " + problem)


def check_identity(sp):
    provider = env("WEAVER_IDENTITY_PROVIDER", "none").lower()
    if provider == "none":
        raise StageSkipped("no identity provider configured (WEAVER_IDENTITY_PROVIDER=none)")
    if provider != "keycloak":
        raise RuntimeError(f"unknown WEAVER_IDENTITY_PROVIDER '{provider}' (expected keycloak or none)")

    base = f"http://{env('WEAVER_IDENTITY_HOST', env('WEAVER_KEYCLOAK_HOST', 'localhost'))}:{env('WEAVER_IDENTITY_PORT', env('WEAVER_KEYCLOAK_PORT', '8085'))}"
    realm = env("WEAVER_IDENTITY_REALM", env("WEAVER_KEYCLOAK_REALM", "weaver"))
    url = f"{base}/realms/{realm}/.well-known/openid-configuration"
    sp.info(f"requesting {url}")
    status, body = http_get(url)
    if status == 404:
        raise RuntimeError(f"Keycloak is up but realm '{realm}' doesn't exist")
    if status != 200:
        raise RuntimeError(f"{url} returned HTTP {status}")
    parse_json(url, body)
    sp.success(f"Keycloak realm '{realm}' at {base}")


def check_frontend(sp):
    base = env("FRONTEND_URL", f"http://localhost:{env('FRONTEND_PORT_HOST', '5173')}").rstrip("/")
    sp.info(f"requesting {base}/")
    status, _ = http_get(f"{base}/")
    if status != 200:
        raise RuntimeError(f"{base}/ returned HTTP {status}")
    sp.success(f"frontend is serving at {base}")


_HEALTH_RANK = {"red": 0, "yellow": 1, "green": 2}


def check_search(sp, prefix, product, distribution, required_major=None):
    """Shared OpenSearch / Elasticsearch check: right product and major version, and cluster health at
    least <prefix>_INDEX_CLUSTER_HEALTH_COLOR (default yellow)."""
    base = env(f"{prefix}_URL", "http://localhost:9200").rstrip("/")
    auth = {"username": os.environ.get(f"{prefix}_USERNAME"), "password": os.environ.get(f"{prefix}_PASSWORD")}
    minimum = env(f"{prefix}_INDEX_CLUSTER_HEALTH_COLOR", "yellow").lower()
    if minimum not in _HEALTH_RANK:
        raise RuntimeError(f"{prefix}_INDEX_CLUSTER_HEALTH_COLOR must be green, yellow or red, not '{minimum}'")

    sp.info(f"requesting {base}")
    version = get_json(f"{base}/", **auth).get("version", {})
    found = version.get("distribution", "elasticsearch")  # Elasticsearch doesn't report a distribution
    if found != distribution:
        raise RuntimeError(f"{base} is {found}, not {product}")
    number = version.get("number", "unknown version")
    if required_major is not None and number.split(".")[0] != str(required_major):
        raise RuntimeError(f"{product} {required_major} required, found {number}")

    health = get_json(f"{base}/_cluster/health", **auth).get("status", "unknown")
    if _HEALTH_RANK.get(health, -1) < _HEALTH_RANK[minimum]:
        raise RuntimeError(f"cluster health is {health}, {minimum} or better required")
    if health != "green":
        sp.warn(f"cluster health is {health}")
    sp.success(f"{product} {number} at {base}")


def check_opensearch(sp):
    check_search(sp, "WEAVER_OPENSEARCH", "OpenSearch", "opensearch")


def check_elasticsearch(sp):
    check_search(sp, "WEAVER_ELASTICSEARCH", "Elasticsearch", "elasticsearch",
                 required_major=os.environ.get("WEAVER_ELASTICSEARCH_VERSION") or None)
