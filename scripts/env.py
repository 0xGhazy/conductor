import os
import re

# ${VAR}, ${VAR:-default} (docker compose) and ${VAR:default} (Spring)
_REFERENCE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-?([^}]*))?\}")
_MAX_DEPTH = 10  # stops self-referencing variables from looping forever

# The environment before load_env() adds .env to it. Pass this to tools with their own config (e.g. Docker
# Compose reads docker/.env), so root .env values don't override theirs.
SHELL_ENVIRON = dict(os.environ)


def _parse(path):
    """Return ({key: raw value}, {keys whose value was single-quoted and must not be expanded})."""
    values, literal = {}, set()
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export "):]
        key, sep, value = line.partition("=")
        if not sep:
            continue
        key, value = key.strip(), value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            if value[0] == "'":
                literal.add(key)
            value = value[1:-1]
        elif " #" in value:
            value = value.split(" #", 1)[0].rstrip()  # inline comment
        values[key] = value
    return values, literal


def load_env(path):
    """Load KEY=VALUE lines from a .env file into os.environ, expanding ${VAR} references.

    References can point at variables defined anywhere in the file or in the environment. Variables
    already set in the environment win over the file. Returns False if the file doesn't exist.
    """
    if not path.is_file():
        return False
    values, literal = _parse(path)
    environment = dict(os.environ)

    def lookup(name, depth):
        if name in environment:
            return environment[name]
        if name in values:
            return values[name] if name in literal else expand(values[name], depth + 1)
        return None

    def expand(value, depth=0):
        if depth > _MAX_DEPTH:
            return value

        def replace(match):
            name, default = match.groups()
            found = lookup(name, depth)
            if found is None or (found == "" and default is not None):
                return match.group(0) if default is None else default
            return found

        return _REFERENCE.sub(replace, value)

    for key, value in values.items():
        os.environ.setdefault(key, value if key in literal else expand(value))
    return True
