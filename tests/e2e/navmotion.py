"""Page changes (in place, through the router): the highlight slides from the old link, the page column shows through dropping tiles."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, ALL_PROJECTS

SHOTS = os.environ.get("SHOTS")
STATE = """() => { const a = document.querySelector('.nav-link.nav-slide');
  return { arrived: document.querySelectorAll('.page-tiles span').length > 0,
           slide: a ? a.dataset.notch : null, from: a ? a.style.getPropertyValue('--nav-from') : null,
           tiles: document.querySelectorAll('.page-tiles').length }; }"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx, page, errors = new_page(browser, url=ALL_PROJECTS)
    page.click('.notch .nav-link[data-notch="stack"]')
    page.wait_for_function("location.search.includes('view=stack')")
    state = page.evaluate(STATE)
    check("arriving through the notch covers the page in tiles", state["arrived"] and state["tiles"] == 1, str(state))
    check("the underline slides right from Projects to Stack", state["slide"] == "stack" and state["from"].startswith("-"), str(state))
    if SHOTS:
        page.screenshot(path=f"{SHOTS}/nav-mid.png")
    page.wait_for_timeout(600)
    check("the slide and the tiles clean up after themselves", page.locator(".nav-slide").count() == 0 and page.locator(".page-tiles").count() == 0)
    page.click('.notch .nav-link[data-notch="projects"]')
    page.wait_for_function("location.search.includes('view=projects')")
    check("and slides back the other way", page.evaluate(STATE)["from"].startswith("") and not page.evaluate(STATE)["from"].startswith("-"), str(page.evaluate(STATE)))
    page.reload()
    page.wait_for_load_state("networkidle")
    check("a reload does not animate", not page.evaluate(STATE)["arrived"])
    check("no errors", not errors, str(errors))
    ctx.close()

    # Home: panel labels decode into place.
    ctx, page, errors = new_page(browser)
    page.wait_for_timeout(2500)
    page.evaluate("""() => { window.seen = []; const l = document.querySelector('#projects .divider-label');
      new MutationObserver(() => seen.push([l.textContent.trim(), l.getAttribute('aria-label')])).observe(l, { subtree: true, characterData: true, attributes: true });
      l.scrollIntoView(); }""")
    page.wait_for_function("document.querySelector('#projects .divider-label').textContent.trim() === '02 · Projects' && seen.length > 1", timeout=2000)
    seen = page.evaluate("seen")
    check("a label flickers through other characters while it decodes", any(text != "02 · Projects" for text, _ in seen), str(seen))
    check("screen readers get the real label meanwhile", all(label == "02 · Projects" for text, label in seen if text != "02 · Projects"), str(seen))
    settled = page.evaluate("document.querySelector('#projects .divider-label').textContent.trim()")
    check("and it settles on the real text", settled == "02 · Projects", settled)
    check("decode: no errors", not errors, str(errors))
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(ALL_PROJECTS)
    page.click('.notch .nav-link[data-notch="stack"]')
    page.wait_for_function("location.search.includes('view=stack')")
    state = page.evaluate(STATE)
    check("reduced motion: nothing moves", state["slide"] is None and not state["arrived"], str(state))
    ctx.close()
    browser.close()
finish()
