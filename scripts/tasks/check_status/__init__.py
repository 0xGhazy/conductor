from .database import check_database
from .indexing import check_indexing
from .redis import check_redis
from .services import (
    check_elasticsearch,
    check_frontend,
    check_identity,
    check_opensearch,
    check_server,
)

# Service name -> check. Each check takes the stage's Spinner and raises RuntimeError when the service is down.
SERVICES = {
    "server": check_server,
    "identity": check_identity,
    "frontend": check_frontend,
    "redis": check_redis,
    "database": check_database,
    "indexing": check_indexing,
    "opensearch": check_opensearch,
    "elasticsearch": check_elasticsearch,
}

# What a bare `check` runs. OpenSearch / Elasticsearch are covered by `indexing` when they're the provider,
# so they only run on their own when named explicitly.
DEFAULT_SERVICES = ["server", "identity", "frontend", "redis", "database", "indexing"]


def service_name(value):
    """Normalize user input so 'open-search' / 'Elastic-Search' match 'opensearch' / 'elasticsearch'."""
    return value.lower().replace("-", "").replace("_", "")
