#!/usr/bin/env python3
"""End-to-end check of workflow translations and message resolving.

Registers the `translation-test` workflow, whose TERMINATE tasks resolve translated messages
themselves (no Respond task), stores its translated messages, then runs it synchronously in
different languages and checks the returned message, including a FAILED ending.

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

HERE = pathlib.Path(__file__).parent

# Templates use ${input.x} (workflow input) and ${variables.x} (variables given to the task).
ORDER_CONFIRMED = {
    "en-US": "Hello ${input.customerName}, your order ${variables.orderId} is confirmed.",
    "ar-EG": "مرحبا ${input.customerName}، تم تأكيد طلبك رقم ${variables.orderId}.",
}
PAYMENT_DECLINED = {
    "en-US": "Sorry ${input.customerName}, your payment was declined.",
    "ar-EG": "عذرا ${input.customerName}، تم رفض الدفع.",
}
EXPECTED_EN = "Hello Ahmed, your order 1001 is confirmed."
EXPECTED_AR = "مرحبا Ahmed، تم تأكيد طلبك رقم 1001."
DECLINED_AR = "عذرا Ahmed، تم رفض الدفع."

SUITES = {
    "terminate": {
        "file": "translation-test-workflow.json",
        "messages": {"ORDER_CONFIRMED": ORDER_CONFIRMED, "PAYMENT_DECLINED": PAYMENT_DECLINED},
        "default_language_supported": True,
        "has_failure_path": True,
    },
}


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


class Suite:
    def __init__(self, api, key, config):
        self.api = api
        self.key = key
        self.config = config
        self.workflow = json.loads((HERE / config["file"]).read_text(encoding="utf-8"))
        self.name = self.workflow["name"]
        self.version = self.workflow["version"]
        self.failures = 0
        self.total = 0

    def setup(self):
        status, body = self.api.call("PUT", "/api/metadata/workflow", [self.workflow])
        if status >= 300:
            sys.exit(f"Could not register workflow {self.name} ({status}): {body}")
        for code, translations in self.config["messages"].items():
            payload = {
                "workflowName": self.name,
                "workflowVersion": self.version,
                "messageCode": code,
                "translations": translations,
            }
            status, body = self.api.call("POST", "/api/workflows/translations", payload)
            if status == 409:  # already there from an earlier run: replace its languages
                key = "/".join(urllib.parse.quote(str(p), safe="") for p in (self.name, self.version, code))
                status, body = self.api.call("PUT", f"/api/workflows/translations/{key}", payload)
            if status >= 300:
                sys.exit(f"Could not save translation {code} for {self.name} ({status}): {body}")
        print(f"\n== {self.key}: {self.name} v{self.version} "
              f"(messages: {', '.join(self.config['messages'])})")

    def run(self, workflow_input, accept_language=None):
        headers = {"Accept-Language": accept_language} if accept_language else {}
        status, body = self.api.call(
            "POST",
            f"/api/workflow/execute/{self.name}/{self.version}?waitForSeconds=10",
            {"input": workflow_input},
            headers,
        )
        if status >= 300 or not isinstance(body, dict):
            return None, f"HTTP {status}: {body}"
        return body, None

    def check(self, description, ok, details=""):
        self.total += 1
        self.failures += 0 if ok else 1
        print(f"{'PASS' if ok else 'FAIL'}  {description}")
        if not ok and details:
            print(f"      {details}")

    def check_message(self, description, workflow_input, accept_language, expected_message, expected_language):
        run, error = self.run(workflow_input, accept_language)
        if error:
            self.check(description, False, error)
            return
        output = run.get("output") or {}
        message, language = output.get("message"), output.get("languageCode")
        ok = message == expected_message and (expected_language is None or language == expected_language)
        self.check(
            description,
            ok,
            f"expected [{expected_language}] {expected_message}\n      got      [{language}] {message}",
        )

    def run_checks(self):
        base = {"messageCode": "ORDER_CONFIRMED", "customerName": "Ahmed", "orderId": "1001"}
        self.check_message("Accept-Language ar-EG gives Arabic", base, "ar-EG", EXPECTED_AR, "ar-EG")
        self.check_message("Accept-Language en-US gives English", base, "en-US", EXPECTED_EN, "en-US")
        self.check_message("Accept-Language in lower case still matches", base, "ar-eg", EXPECTED_AR, "ar-EG")
        self.check_message(
            "Highest-priority language in the header wins",
            base, "fr;q=0.3, en-US;q=0.9, ar-EG;q=0.5", EXPECTED_EN, "en-US")
        self.check_message(
            "_language in the body overrides the header", {**base, "_language": "en-US"}, "ar-EG", EXPECTED_EN, "en-US")
        self.check_message(
            "Unknown message code returns the code itself",
            {**base, "messageCode": "NO_SUCH_CODE"}, "en-US", "NO_SUCH_CODE", None)
        self.check_message(
            "Placeholder text in workflow input is never expanded",
            {**base, "customerName": "#{S:PATH} ${weaver.env.PATH}"},
            "en-US",
            "Hello #{S:PATH} ${weaver.env.PATH}, your order 1001 is confirmed.",
            "en-US",
        )

        if self.config["default_language_supported"]:
            self.check_message(
                "No language given uses the workflow's default language (en-US)",
                base, None, EXPECTED_EN, "en-US")
        else:
            run, error = self.run(base)
            output = (run or {}).get("output") or {}
            print(f"INFO  No language given: got [{output.get('languageCode')}] {output.get('message')}"
                  " (this task ignores the workflow's default language)")

        if self.config["has_failure_path"]:
            self.check_failure_path(base)

    def check_failure_path(self, base):
        description = "FAILED ending returns the translated message and uses it as the failure reason"
        run, error = self.run({**base, "outcome": "failure"}, "ar-EG")
        if error:
            self.check(description, False, error)
            return
        output = run.get("output") or {}
        status, workflow = self.api.call("GET", f"/api/workflow/{run.get('workflowId')}?includeTasks=false")
        reason = workflow.get("reasonForIncompletion") if isinstance(workflow, dict) else None
        ok = (
            workflow.get("status") == "FAILED"
            and output.get("message") == DECLINED_AR
            and output.get("responseCode") == "PAYMENT_DECLINED"
            and output.get("orderId") == "1001"
            and reason == DECLINED_AR
        ) if isinstance(workflow, dict) else False
        self.check(
            description,
            ok,
            f"status={workflow.get('status') if isinstance(workflow, dict) else status} "
            f"output={output} reason={reason}",
        )


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--token", help="Bearer token, only needed when security is enabled")
    args = parser.parse_args()
    api = Api(args.base_url, args.token)

    failures = total = 0
    for key in SUITES:
        suite = Suite(api, key, SUITES[key])
        suite.setup()
        suite.run_checks()
        failures += suite.failures
        total += suite.total

    print(f"\n{total - failures}/{total} checks passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
