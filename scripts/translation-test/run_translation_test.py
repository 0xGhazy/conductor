#!/usr/bin/env python3
"""End-to-end check of workflow translations and message resolving.

Registers the `translation-test` workflow, stores one translated message, then runs the
workflow synchronously in different languages and checks the returned message.

Usage:
    python scripts/translation-test/run_translation_test.py [--base-url http://localhost:8080] [--token JWT]

Needs a running server. Only the Python standard library is used.
Exit code 0 when every check passes, 1 otherwise.
"""
import argparse
import json
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request

WORKFLOW_FILE = pathlib.Path(__file__).with_name("translation-test-workflow.json")
WORKFLOW_NAME = "translation-test"
WORKFLOW_VERSION = 1
MESSAGE_CODE = "ORDER_CONFIRMED"

# Templates use ${input.x} (workflow input) and ${variables.x} (the Respond task's variables).
TRANSLATIONS = {
    "en-US": "Hello ${input.customerName}, your order ${variables.orderId} is confirmed.",
    "ar-EG": "مرحبا ${input.customerName}، تم تأكيد طلبك رقم ${variables.orderId}.",
}
EXPECTED_EN = "Hello Ahmed, your order 1001 is confirmed."
EXPECTED_AR = "مرحبا Ahmed، تم تأكيد طلبك رقم 1001."


class Api:
    def __init__(self, base_url, token=None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def call(self, method, path, body=None, headers=None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        request = urllib.request.Request(self.base_url + path, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        request.add_header("Accept", "application/json")
        if self.token:
            request.add_header("Authorization", "Bearer " + self.token)
        for name, value in (headers or {}).items():
            request.add_header(name, value)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                raw = response.read().decode("utf-8")
                return response.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else raw)
        except urllib.error.HTTPError as error:
            raw = error.read().decode("utf-8", errors="replace")
            try:
                return error.code, json.loads(raw)
            except ValueError:
                return error.code, raw


def setup(api):
    workflow = json.loads(WORKFLOW_FILE.read_text(encoding="utf-8"))
    status, body = api.call("PUT", "/api/metadata/workflow", [workflow])
    if status >= 300:
        sys.exit(f"Could not register workflow ({status}): {body}")
    print(f"Registered workflow {WORKFLOW_NAME} v{WORKFLOW_VERSION}")

    key = "/".join(urllib.parse.quote(p, safe="") for p in (WORKFLOW_NAME, str(WORKFLOW_VERSION), MESSAGE_CODE))
    payload = {
        "workflowName": WORKFLOW_NAME,
        "workflowVersion": WORKFLOW_VERSION,
        "messageCode": MESSAGE_CODE,
        "translations": TRANSLATIONS,
    }
    status, body = api.call("POST", "/api/workflows/translations", payload)
    if status == 409:  # already there from an earlier run: replace its languages
        status, body = api.call("PUT", f"/api/workflows/translations/{key}", payload)
    if status >= 300:
        sys.exit(f"Could not save translation ({status}): {body}")
    print(f"Saved translation {MESSAGE_CODE} in {', '.join(TRANSLATIONS)}")


def run(api, workflow_input, accept_language=None):
    headers = {"Accept-Language": accept_language} if accept_language else {}
    status, body = api.call(
        "POST",
        f"/api/workflow/execute/{WORKFLOW_NAME}/{WORKFLOW_VERSION}?waitForSeconds=10",
        {"input": workflow_input},
        headers,
    )
    if status >= 300 or not isinstance(body, dict):
        return None, f"HTTP {status}: {body}"
    return body.get("output") or {}, None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--token", help="Bearer token, only needed when security is enabled")
    args = parser.parse_args()
    api = Api(args.base_url, args.token)

    setup(api)

    base_input = {"messageCode": MESSAGE_CODE, "customerName": "Ahmed", "orderId": "1001"}
    checks = [
        # (description, workflow input, Accept-Language header, expected message, expected language)
        ("Accept-Language ar-EG gives Arabic", base_input, "ar-EG", EXPECTED_AR, "ar-EG"),
        ("Accept-Language en-US gives English", base_input, "en-US", EXPECTED_EN, "en-US"),
        ("Accept-Language in lower case still matches", base_input, "ar-eg", EXPECTED_AR, "ar-EG"),
        ("Highest-priority language in the header wins", base_input, "fr;q=0.3, en-US;q=0.9, ar-EG;q=0.5", EXPECTED_EN, "en-US"),
        ("_language in the body overrides the header", {**base_input, "_language": "en-US"}, "ar-EG", EXPECTED_EN, "en-US"),
        ("Unknown message code returns the code itself", {**base_input, "messageCode": "NO_SUCH_CODE"}, "en-US", "NO_SUCH_CODE", None),
        (
            "Placeholder text in workflow input is never expanded",
            {**base_input, "customerName": "#{S:PATH} ${weaver.env.PATH}"},
            "en-US",
            "Hello #{S:PATH} ${weaver.env.PATH}, your order 1001 is confirmed.",
            "en-US",
        ),
    ]

    failures = 0
    for description, workflow_input, accept_language, expected_message, expected_language in checks:
        output, error = run(api, workflow_input, accept_language)
        if error:
            failures += 1
            print(f"FAIL  {description}\n      {error}")
            continue
        message, language = output.get("message"), output.get("languageCode")
        ok = message == expected_message and (expected_language is None or language == expected_language)
        failures += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  {description}")
        if not ok:
            print(f"      expected [{expected_language}] {expected_message}")
            print(f"      got      [{language}] {message}")

    # Reported, not asserted: with no language at all, the workflow's metadata.defaultLanguage
    # (en-US) should be used, but the Respond task does not read it yet (task list, Task 4).
    output, error = run(api, base_input)
    if error:
        print(f"INFO  No language given: request failed: {error}")
    else:
        print(f"INFO  No language given: got [{output.get('languageCode')}] {output.get('message')}"
              " (expected en-US once Task 4 is done)")

    print(f"\n{len(checks) - failures}/{len(checks)} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
