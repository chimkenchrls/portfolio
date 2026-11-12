"""Page changes (in place, through the router): the highlight slides from the old link; the new page rises out of a soft blur."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, ALL_PROJECTS

SHOTS = os.environ.get("SHOTS")
STATE = """() => { const a = document.querySelector('.nav-link.nav-slide');
  const enter = document.getAnimations().filter(n => n.id === 'page-enter');
  const frames = enter.length ? enter[0].effect.getKeyframes() : [];
  return { arrived: enter.length > 0, blocks: enter.length,
           moves: frames.some(f => f.translate && f.translate !== '0px 0px' && f.translate !== 'none'),
           blurs: frames.some(f => f.filter && f.filter.includes('blur')),
           slide: a ? a.dataset.notch : null, from: a ? a.style.getPropertyValue('--nav-from') : null,
           tiles: document.querySelectorAll('.page-tiles').length }; }"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx, page, errors = new_page(browser, url=ALL_PROJECTS)
    page.hover('.notch-ck'); page.click('.notch .nav-link[data-notch="stack"]')
    page.wait_for_timeout(150)
    check("a page change pours the curtain out of the notch, carrying the page's name", page.locator(".page-curtain").count() == 1
          and page.evaluate("[...document.querySelectorAll('.page-curtain-word span')].map(n => n.textContent).join('')") == "Stack"
          and page.evaluate("Number(getComputedStyle(document.querySelector('.page-curtain')).zIndex) < Number(getComputedStyle(document.querySelector('.notch')).zIndex)"))
    check("the old page stays until the curtain covers it", "view=projects" in page.url)
    if SHOTS:
        page.wait_for_timeout(350); page.screenshot(path=f"{SHOTS}/curtain-mid.png")
    page.wait_for_function("location.search.includes('view=stack')")
    slid = page.evaluate(STATE)
    page.wait_for_function("document.getAnimations().some(n => n.id === 'page-enter')", timeout=2000)
    state = page.evaluate(STATE)
    check("arriving through the notch, the new page rises out of a soft blur, block after block", state["arrived"] and state["moves"] and state["blurs"] and state["tiles"] == 0, str(state))
    first = page.evaluate("(() => { const a = document.getAnimations().find(n => n.id === 'page-enter'); return a ? Number(getComputedStyle(a.effect.target).opacity) : 1; })()")
    check("it starts faint, not with a flash of the full page", first < 0.9, str(first))
    check("the underline slides right from Projects to Stack", slid["slide"] == "stack" and slid["from"].startswith("-"), str(slid))
    if SHOTS:
        page.screenshot(path=f"{SHOTS}/nav-mid.png")
    page.wait_for_timeout(900)
    check("the curtain is gone by about a second and a half", page.locator(".page-curtain").count() == 0)
    check("the slide and the entrance clean up after themselves", page.locator(".nav-slide").count() == 0 and page.evaluate("document.getAnimations().filter(n => n.id === 'page-enter').length") == 0
          and page.evaluate("[...document.querySelectorAll('#main *')].every(n => !n.style.translate && !n.style.filter)"))
    page.hover('.notch-ck'); page.click('.notch .nav-link[data-notch="projects"]')
    started = page.evaluate("performance.now()")
    page.wait_for_function("location.search.includes('view=projects')")
    back = page.evaluate(STATE)
    check("and slides back the other way", back["from"] is not None and not back["from"].startswith("-"), str(back))
    page.wait_for_function("!document.querySelector('.page-curtain')", timeout=3000)
    quick = page.evaluate("performance.now()") - started
    check("later page changes are quicker (about 0.9s)", quick < 1200, f"{quick:.0f}ms")
    page.go_back()
    page.wait_for_function("location.search.includes('view=stack')")
    check("back stays instant: no curtain", page.locator(".page-curtain").count() == 0)
    page.click('.notch-ck')
    page.wait_for_timeout(120)
    check("going Home pours the curtain with no name", page.locator(".page-curtain").count() == 1 and page.locator(".page-curtain-word").count() == 0)
    page.wait_for_function("document.documentElement.classList.contains('intro-play')", timeout=2000)
    check("and lifts straight into the intro", True)
    page.wait_for_function("!document.documentElement.classList.contains('intro-play')", timeout=4000)
    page.wait_for_timeout(300)
    page.hover('.notch-ck'); page.click('.notch .nav-link[data-notch="stack"]')
    page.wait_for_timeout(100)
    page.hover('.notch-ck'); page.click('.notch .nav-link[data-notch="more"]')
    page.wait_for_function("location.search.includes('view=more')", timeout=3000)
    page.wait_for_timeout(1300)
    check("a second click mid-curtain goes where it was sent, with one curtain at most", page.locator(".page-curtain").count() == 0 and "view=more" in page.url)
    page.reload()
    page.wait_for_load_state("networkidle")
    check("a reload does not animate", not page.evaluate(STATE)["arrived"])
    check("no errors", not errors, str(errors))
    ctx.close()

    # Home: About's facts decode into place.
    ctx, page, errors = new_page(browser)
    page.wait_for_timeout(2500)
    page.evaluate("""() => { window.seen = []; const l = document.querySelector('#about .fact-value');
      new MutationObserver(() => seen.push([l.textContent.trim(), l.getAttribute('aria-label')])).observe(l, { subtree: true, characterData: true, attributes: true });
      l.scrollIntoView(); }""")
    page.wait_for_function("document.querySelector('#about .fact-value').textContent.trim() === 'BSCS' && seen.length > 1", timeout=2000)
    seen = page.evaluate("seen")
    check("a fact flickers through other characters while it decodes", any(text != "BSCS" for text, _ in seen), str(seen))
    check("screen readers get the real fact meanwhile", all(label == "BSCS" for text, label in seen if text != "BSCS"), str(seen))
    settled = page.evaluate("document.querySelector('#about .fact-value').textContent.trim()")
    check("and it settles on the real text", settled == "BSCS", settled)
    check("decode: no errors", not errors, str(errors))
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(ALL_PROJECTS)
    page.hover('.notch-ck'); page.click('.notch .nav-link[data-notch="stack"]')
    page.wait_for_function("location.search.includes('view=stack')")
    state = page.evaluate(STATE)
    check("reduced motion: nothing moves, the page only fades in", state["slide"] is None and state["arrived"] and not state["moves"] and not state["blurs"], str(state))
    check("reduced motion: no curtain", page.locator(".page-curtain").count() == 0)
    ctx.close()
    browser.close()
finish()
