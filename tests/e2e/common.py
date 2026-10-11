"""Shared helpers for the browser checks in tests/e2e (see run.sh)."""
import sys

URL = "http://localhost:8000/"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


def offline_api(context):
    """Keep the suites off the live API: no shared poke total, and chat answers "not connected"."""
    context.route("**/api/pokes", lambda r: r.fulfill(status=200, content_type="application/json", body='{"total": null}'))
    context.route("**/api/chat", lambda r: r.fulfill(status=503, content_type="application/json", body='{"code": "NOT_CONFIGURED", "error": "Live chat is not connected yet."}'))


def new_page(browser, width=1280, height=900, **context_options):
    context = browser.new_context(viewport={"width": width, "height": height}, **context_options)
    offline_api(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(URL)
    page.wait_for_load_state("networkidle")
    return context, page, errors


def finish():
    failed = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    print(f"{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)
