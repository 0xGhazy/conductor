"""Bash tab completion for weaver-cli.py.

`python3 weaver-cli.py completion` prints a bash script. On each TAB, that script calls back into
`weaver-cli.py __complete <words...>`, so commands and options always come from the argparse definitions.
"""

import argparse
import shlex

# Commands whose positional arguments are docker-compose services.
CONTAINER_COMMANDS = {"run", "stop", "restart", "ps", "logs"}
# Options that take a value, so the word after them shouldn't be completed.
VALUE_OPTIONS = {"-n", "--tail"}


def subcommands(parser):
    for action in parser._actions:  # argparse has no public API for listing subcommands
        if isinstance(action, argparse._SubParsersAction):
            return action.choices
    return {}


def candidates(parser, words, container_services, check_services):
    """Completions for `words` (everything typed after the script name; the last word is being completed)."""
    current = words[-1] if words else ""
    commands = subcommands(parser)
    if len(words) <= 1:
        options = ["-h", "--help"]
        return [c for c in [*commands, *options] if c.startswith(current)]

    command, previous = words[0], words[-2]
    subparser = commands.get(command)
    if subparser is None or previous in VALUE_OPTIONS:
        return []
    if current.startswith("-"):
        return sorted(o for o in subparser._option_string_actions if o.startswith(current))

    if command in CONTAINER_COMMANDS:
        services = container_services()
    elif command == "check":
        services = check_services
    else:
        return []
    typed = set(words[1:-1])
    return [s for s in services if s.startswith(current) and s not in typed]


def bash_script(python, script_path):
    python, script_path = shlex.quote(python), shlex.quote(script_path)
    return f"""\
# weaver-cli.py bash completion. Load it in ~/.bashrc with:
#   eval "$(python3 {script_path} completion)"

_weaver_cli_complete_from() {{
    # $1: index of the weaver-cli.py word in COMP_WORDS
    local IFS=$'\\n'
    COMPREPLY=($({python} {script_path} __complete "${{COMP_WORDS[@]:$(($1 + 1)):$((COMP_CWORD - $1))}}" 2>/dev/null))
}}

_weaver_cli() {{
    _weaver_cli_complete_from 0
}}

# `python3 weaver-cli.py ...`: complete our words, otherwise behave as before.
_weaver_cli_python_fallback="$(complete -p python3 2>/dev/null | sed -n 's/.*-F \\([^ ]*\\).*/\\1/p')"
_weaver_cli_python() {{
    if [[ $COMP_CWORD -ge 2 && "${{COMP_WORDS[1]}}" == *weaver-cli.py ]]; then
        _weaver_cli_complete_from 1
    elif [[ -n "$_weaver_cli_python_fallback" && "$_weaver_cli_python_fallback" != _weaver_cli_python ]]; then
        "$_weaver_cli_python_fallback" "$@"
    else
        compopt -o default   # plain filename completion
        COMPREPLY=()
    fi
}}

complete -F _weaver_cli weaver-cli.py ./weaver-cli.py
complete -F _weaver_cli_python python3 python
"""
