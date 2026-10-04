"""GitHub contributions panel: holds its space from the start, so nothing below it jumps."""
import json
import time
from datetime import date, timedelta
from playwright.sync_api import sync_playwright
from common import URL, check, finish

API = "**/github-contributions-api.jogruber.de/**"
days = [{"date": (date(2026, 10, 4) - timedelta(days=367 - i)).isoformat(), "count": (i * 7) % 5, "level": (i * 7) % 5} for i in range(368)]
PAYLOAD = json.dumps({"total": {"lastYear": 335}, "contributions": days})
MEASURE = """() => { const p = document.querySelector('.github-panel'), pr = document.getElementById('projects');
  return { hidden: p.hidden, height: Math.round(p.getBoundingClientRect().height), projectsTop: Math.round(pr.getBoundingClientRect().top + scrollY),
           dots: p.querySelectorAll('svg circle').length, titles: p.querySelectorAll('svg title').length, months: p.querySelectorAll('.github-month').length,
           total: p.querySelector('.github-total').textContent, label: (p.querySelector('svg') || { getAttribute: () => null }).getAttribute('aria-label') }; }"""


def page_with(b, handler, width=1280, height=900, **opts):
    ctx = b.new_context(viewport={"width": width, "height": height}, reduced_motion="reduce", **opts)
    ctx.route(API, handler)
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(URL); p.wait_for_load_state("domcontentloaded"); p.wait_for_timeout(600)
    return ctx, p, errors


def slow_ok(route):
    time.sleep(1.2)
    route.fulfill(status=200, content_type="application/json", body=PAYLOAD)


with sync_playwright() as pw:
    b = pw.chromium.launch()

    for name, width, height, opts in [("desktop", 1280, 900, {}), ("phone", 375, 812, {"has_touch": True, "is_mobile": True})]:
        ctx, p, errors = page_with(b, slow_ok, width, height, **opts)
        before = p.evaluate(MEASURE)
        check(f"{name}: the panel is visible from the start, at full size", not before["hidden"] and before["height"] > 120, str(before))
        check(f"{name}: it shows an empty placeholder grid while loading", before["dots"] == 371 and before["titles"] == 0 and before["months"] == 0 and before["total"] == "loading contributions…" and before["label"] == "Loading GitHub contributions", str(before))
        p.evaluate("document.getElementById('stack').scrollIntoView({ behavior: 'instant' }); 0")
        p.wait_for_function("/^\\d/.test(document.querySelector('.github-total').textContent)", timeout=8000)
        after = p.evaluate(MEASURE)
        check(f"{name}: real data replaces the placeholder", after["dots"] == 368 and after["titles"] == 368 and after["months"] >= 11 and after["total"] == "335 contributions in the last year", str(after))
        check(f"{name}: the panel keeps its height when the data arrives", abs(after["height"] - before["height"]) <= 3, f'{before["height"]} -> {after["height"]}')
        check(f"{name}: nothing below it moves", abs(after["projectsTop"] - before["projectsTop"]) <= 3, f'{before["projectsTop"]} -> {after["projectsTop"]}')
        check(f"{name}: no sideways page scroll", p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        check(f"{name}: no page errors", not errors, "; ".join(errors))
        ctx.close()

    for label, handler in [("API down", lambda r: r.abort()), ("junk data", lambda r: r.fulfill(status=200, content_type="application/json", body='{"contributions": [{"date": "x"}]}'))]:
        ctx, p, errors = page_with(b, handler)
        before = p.evaluate(MEASURE)
        p.evaluate("document.getElementById('stack').scrollIntoView({ behavior: 'instant' }); 0")
        p.wait_for_function("document.querySelector('.github-total').textContent.includes('unavailable')", timeout=8000)
        after = p.evaluate(MEASURE)
        check(f"{label}: the panel stays, with an honest message", not after["hidden"] and after["total"] == "contributions unavailable right now" and after["dots"] == 371, str(after))
        check(f"{label}: nothing below it moves", abs(after["projectsTop"] - before["projectsTop"]) <= 3 and abs(after["height"] - before["height"]) <= 3, f'{before} -> {after}')
        check(f"{label}: the profile link still works", p.get_attribute(".github-user", "href") == "https://github.com/chimkenchrls")
        check(f"{label}: no uncaught errors", not errors, "; ".join(errors))
        ctx.close()

    ctx = b.new_context(viewport={"width": 1280, "height": 900}, java_script_enabled=False)
    p = ctx.new_page(); p.goto(URL)
    check("without JavaScript the empty panel stays hidden", p.eval_on_selector(".github-panel", "n => n.hidden"))
    ctx.close()
    b.close()
finish()
