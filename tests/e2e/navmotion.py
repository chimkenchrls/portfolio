"""Page changes (in place, through the router): the highlight slides from the old link, the page column shows through dropping tiles."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, ALL_PROJECTS

SHOTS = os.environ.get("SHOTS")
STATE = """() => { const a = document.querySelector('.nav-link.nav-slide');
  return { arrived: document.querySelectorAll('.page-tiles span').length > 0,
           slide: a ? a.dataset.view : null, from: a ? a.style.getPropertyValue('--nav-from') : null,
           tiles: document.querySelectorAll('.page-tiles').length }; }"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx, page, errors = new_page(browser, url=ALL_PROJECTS)
    page.click('.sidebar .nav-link[data-view="stack"]')
    page.wait_for_function("location.search.includes('view=stack')")
    state = page.evaluate(STATE)
    check("arriving through the sidebar covers the page in tiles", state["arrived"] and state["tiles"] == 1, str(state))
    check("the highlight slides down from Projects to Stack", state["slide"] == "stack" and state["from"].startswith("-"), str(state))
    if SHOTS:
        page.screenshot(path=f"{SHOTS}/nav-mid.png")
    page.wait_for_timeout(600)
    check("the slide and the tiles clean up after themselves", page.locator(".nav-slide").count() == 0 and page.locator(".page-tiles").count() == 0)
    page.click('.sidebar .nav-link[data-view="projects"]')
    page.wait_for_function("location.search.includes('view=projects')")
    check("and slides back up the other way", page.evaluate(STATE)["from"].startswith("") and not page.evaluate(STATE)["from"].startswith("-"), str(page.evaluate(STATE)))
    page.reload()
    page.wait_for_load_state("networkidle")
    check("a reload does not animate", not page.evaluate(STATE)["arrived"])
    check("no errors", not errors, str(errors))
    ctx.close()

    # Home: section labels decode into place, and CK reacts to the scroll.
    ctx, page, errors = new_page(browser)
    page.wait_for_timeout(2500)
    page.evaluate("""() => { window.seen = []; const l = document.querySelector('#projects .divider-label');
      new MutationObserver(() => seen.push([l.textContent.trim(), l.getAttribute('aria-label')])).observe(l, { subtree: true, characterData: true, attributes: true });
      l.scrollIntoView(); }""")
    page.wait_for_timeout(700)
    seen = page.evaluate("seen")
    check("a label flickers through other characters while it decodes", any(text != "03 // Projects" for text, _ in seen), str(seen))
    check("screen readers get the real heading meanwhile", all(label == "Projects" for text, label in seen if text != "03 // Projects"), str(seen))
    settled = page.evaluate("document.querySelector('#projects .divider-label').textContent.trim()")
    check("and it settles on the real text", settled == "03 // Projects", settled)
    face = "document.querySelector('.poke-button .assistant-sprite').style.backgroundPosition"
    page.mouse.move(700, 400)
    page.wait_for_timeout(400)
    page.mouse.wheel(0, 200)
    page.wait_for_timeout(80)
    check("CK looks down while the page scrolls down", page.evaluate(face) == "50% 100%", page.evaluate(face))
    page.mouse.wheel(0, -200)
    page.wait_for_timeout(80)
    check("and up while it scrolls up", page.evaluate(face) == "50% 0%", page.evaluate(face))
    page.evaluate("scrollTo({ top: 0, behavior: 'instant' })")
    page.wait_for_timeout(800)
    for _ in range(6):
        page.mouse.wheel(0, 900)
        page.wait_for_timeout(40)
    check("a hard fling makes him dizzy", page.evaluate("[...document.querySelectorAll('.poke-emote')].map(e => e.dataset.emote)") == ["dizzy"])
    check("decode and CK: no errors", not errors, str(errors))
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(ALL_PROJECTS)
    page.click('.sidebar .nav-link[data-view="stack"]')
    page.wait_for_function("location.search.includes('view=stack')")
    state = page.evaluate(STATE)
    check("reduced motion: nothing moves", state["slide"] is None and not state["arrived"], str(state))
    ctx.close()
    browser.close()
finish()
