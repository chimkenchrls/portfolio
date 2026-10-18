"""Page changes (in place, through the router): the highlight slides from the old link, the page column fades up."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, ALL_PROJECTS

SHOTS = os.environ.get("SHOTS")
STATE = """() => { const a = document.querySelector('.nav-link.nav-slide');
  return { arrived: document.querySelector('.main').classList.contains('page-in'),
           slide: a ? a.dataset.view : null, from: a ? a.style.getPropertyValue('--nav-from') : null,
           fade: getComputedStyle(document.querySelector('.main')).animationName }; }"""

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx, page, errors = new_page(browser, url=ALL_PROJECTS)
    page.click('.sidebar .nav-link[data-view="stack"]')
    page.wait_for_function("location.search.includes('view=stack')")
    state = page.evaluate(STATE)
    check("arriving through the sidebar fades the page up", state["arrived"] and state["fade"] == "page-in", str(state))
    check("the highlight slides down from Projects to Stack", state["slide"] == "stack" and state["from"].startswith("-"), str(state))
    if SHOTS:
        page.screenshot(path=f"{SHOTS}/nav-mid.png")
    page.wait_for_timeout(600)
    check("the slide cleans up after itself", page.locator(".nav-slide").count() == 0)
    page.click('.sidebar .nav-link[data-view="projects"]')
    page.wait_for_function("location.search.includes('view=projects')")
    check("and slides back up the other way", page.evaluate(STATE)["from"].startswith("") and not page.evaluate(STATE)["from"].startswith("-"), str(page.evaluate(STATE)))
    page.reload()
    page.wait_for_load_state("networkidle")
    check("a reload does not animate", not page.evaluate(STATE)["arrived"])
    check("no errors", not errors, str(errors))
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    page = ctx.new_page()
    page.goto(ALL_PROJECTS)
    page.click('.sidebar .nav-link[data-view="stack"]')
    page.wait_for_function("location.search.includes('view=stack')")
    state = page.evaluate(STATE)
    check("reduced motion: nothing moves", state["slide"] is None and state["fade"] == "none", str(state))
    ctx.close()
    browser.close()
finish()
