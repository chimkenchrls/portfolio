"""Shared helpers for the browser checks in tests/e2e (see run.sh)."""
import sys
from playwright.sync_api import Browser

# The site opens light on a first visit. The suites were written against the dark theme,
# so their browser starts as a visitor who chose dark with the toggle (a saved choice),
# unless a suite passes first_visit=True to see what a newcomer gets.
_new_context = Browser.new_context
def _chose_dark(self, first_visit=False, **options):
    context = _new_context(self, **options)
    if not first_visit:
        context.add_init_script("try { if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark'); } catch (e) {}")
    return context
Browser.new_context = _chose_dark

# The suites open the page through a deep link, which skips the poster intro (see poster.py).
URL = "http://localhost:8000/#home"
# The full project cards (screenshots, chat replay) live on the all-projects page.
ALL_PROJECTS = "http://localhost:8000/?view=projects"
# Outside the IDE and the terminal live on the More about me page.
MORE = "http://localhost:8000/?view=more"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


def offline_api(context, cover=False):
    """Keep the suites off the live API: no shared poke total, and chat answers "not connected"."""
    context.route("**/api/pokes", lambda r: r.fulfill(status=200, content_type="application/json", body='{"total": null}'))
    context.route("**/api/chat", lambda r: r.fulfill(status=503, content_type="application/json", body='{"code": "NOT_CONFIGURED", "error": "Live chat is not connected yet."}'))
    context.route("**/api/contact", lambda r: r.fulfill(status=503, content_type="application/json", body='{"code": "NOT_CONFIGURED", "error": "The contact form is not connected yet."}'))


def new_page(browser, width=1280, height=900, url=None, **context_options):
    context = browser.new_context(viewport={"width": width, "height": height}, **context_options)
    offline_api(context)
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto(url or URL)
    page.wait_for_load_state("networkidle")
    return context, page, errors


def finish():
    failed = [r for r in results if not r[1]]
    for name, ok, detail in results:
        print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail and not ok else ""))
    print(f"{len(results) - len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)


def to_bottom(page):
    """Scroll straight to the end of the page, where the footer is fully in view."""
    page.evaluate("scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})")
    page.wait_for_timeout(150)
