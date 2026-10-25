"""Workflow execution indexing check, driven by WEAVER_INDEXING_ENABLED and WEAVER_INDEXING_PROVIDER."""

from .. import StageSkipped
from .database import check_database
from .services import check_search
from .web import env, env_flag

# Provider -> (settings prefix, product name, distribution reported by the server, supported major version)
SEARCH_PROVIDERS = {
    "elasticsearch8": ("WEAVER_ELASTICSEARCH", "Elasticsearch", "elasticsearch", 8),
    "opensearch3": ("WEAVER_OPENSEARCH", "OpenSearch", "opensearch", 3),
}


def check_indexing(sp):
    if not env_flag("WEAVER_INDEXING_ENABLED"):
        raise StageSkipped("indexing is disabled (WEAVER_INDEXING_ENABLED)")

    provider = env("WEAVER_INDEXING_PROVIDER", "postgres").lower()
    if provider == "postgres":
        sp.info("indexing provider is postgres, checking the database")
        check_database(sp)
    elif provider in SEARCH_PROVIDERS:
        prefix, product, distribution, major = SEARCH_PROVIDERS[provider]
        sp.info(f"indexing provider is {provider}")
        check_search(sp, prefix, product, distribution, required_major=major)
    else:
        choices = ", ".join(["postgres", *SEARCH_PROVIDERS])
        raise RuntimeError(f"unknown WEAVER_INDEXING_PROVIDER '{provider}' (expected {choices})")
