"""Shared helpers for the browser checks in tests/e2e (see run.sh)."""
import sys

# The suites open the page through a deep link, which skips the hero intro (see intro.py).
URL = "http://localhost:8000/#home"
# The full project cards (screenshots, chat replay) live on the all-projects page.
ALL_PROJECTS = "http://localhost:8000/?view=projects"
# Outside the IDE and the terminal live on the More about me page.
MORE = "http://localhost:8000/?view=more"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))


# The other suites test the page itself, so they switch the hero cover off: the hero
# keeps its ordinary size and place, and the sidebar, top bar and floating CK are
# there from the start. intro.py leaves the cover on.
NO_COVER = """
html.has-cover .hero { min-height: min(620px, calc(100vh - 96px)) !important; margin-top: 0 !important; padding-top: 8px !important; padding-bottom: 88px !important; translate: none !important; }
@media (min-width: 640px) and (max-width: 860px) { html.has-cover .hero { min-height: 0 !important; justify-content: normal !important; } }
@media (max-width: 639.98px) { html.has-cover .hero { min-height: calc(100svh - var(--topbar-h) - 28px) !important; padding-bottom: 48px !important; } }
html.has-cover .sidebar, html.has-cover .topbar { visibility: visible !important; translate: none !important; }
html.has-cover .assistant-launcher { opacity: 1 !important; pointer-events: auto !important; }
.intro-hint { display: none !important; }
"""


def offline_api(context, cover=False):
    """Keep the suites off the live API: no shared poke total, and chat answers "not connected"."""
    context.route("**/api/pokes", lambda r: r.fulfill(status=200, content_type="application/json", body='{"total": null}'))
    context.route("**/api/chat", lambda r: r.fulfill(status=503, content_type="application/json", body='{"code": "NOT_CONFIGURED", "error": "Live chat is not connected yet."}'))
    context.route("**/api/contact", lambda r: r.fulfill(status=503, content_type="application/json", body='{"code": "NOT_CONFIGURED", "error": "The contact form is not connected yet."}'))
    if not cover:
        context.add_init_script("document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = %r; document.head.append(s); });" % NO_COVER)


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
