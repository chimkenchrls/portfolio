"""Resume page: ./?view=resume shows the resume as a sheet, with the PDF beside it."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, offline_api, URL

RESUME = "http://localhost:8000/?view=resume"
SHOTS = os.environ.get("SHOTS")

with sync_playwright() as p:
    browser = p.chromium.launch()
    for width, height, name in [(1280, 900, "desktop"), (390, 844, "phone")]:
        ctx, page, errors = new_page(browser, width, height, url=RESUME)
        sheet = page.locator(".resume-sheet")
        check(f"{name}: the sheet is shown", sheet.is_visible())
        check(f"{name}: only the Resume section", page.locator(".main > .section:visible").count() == 1)
        check(f"{name}: five parts, About me first", page.locator(".resume-part-title").all_text_contents()[:1] == ["About me"] and page.locator(".resume-part").count() == 5)
        check(f"{name}: no phone number", "+63" not in sheet.inner_text())
        check(f"{name}: Download and Open PDF", page.locator(".resume-side a", has_text="Download PDF").get_attribute("download") is not None and page.locator(".resume-side a", has_text="Open PDF").get_attribute("target") == "_blank")
        check(f"{name}: paper stays white in the dark theme", page.evaluate("getComputedStyle(document.querySelector('.resume-sheet')).backgroundColor") == "rgb(255, 255, 255)")
        check(f"{name}: no sideways scroll", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
        check(f"{name}: tab title", page.title().startswith("Resume"))
        check(f"{name}: no errors", not errors, str(errors))
        if SHOTS:
            page.screenshot(path=f"{SHOTS}/resume-{name}.png", full_page=True)
        ctx.close()

    ctx, page, errors = new_page(browser)
    button = page.locator(".hero-actions a", has_text="Resume")
    check("hero Resume button opens the page", button.get_attribute("href") == "./?view=resume" and button.get_attribute("target") is None)
    button.click()
    page.wait_for_timeout(120)
    check("the hero fades back and a sheet grows from the button", page.evaluate("document.documentElement.classList.contains('resume-hold') && !!document.querySelector('.resume-fly')"))
    if SHOTS:
        page.wait_for_timeout(250)
        page.screenshot(path=f"{SHOTS}/resume-fly.png")
    page.wait_for_function("location.search.includes('view=resume')")
    page.wait_for_function("!document.querySelector('.resume-fly') && !document.documentElement.classList.contains('resume-opening')")
    check("in place, through the router, and cleaned up", page.locator(".resume-sheet").is_visible() and page.evaluate("getComputedStyle(document.querySelector('#main')).opacity") == "1" and not errors, str(errors))
    check("no sidebar link for it", page.locator('.nav-link[data-view="resume"]').count() == 0)
    page.go_back()
    page.wait_for_function("!location.search.includes('view=resume')")
    check("back goes home and hides it", not page.locator("#resume").is_visible())
    ctx.close()

    ctx, page, errors = new_page(browser, url="http://localhost:8000/?view=links")
    row = page.locator(".profile-link", has_text="Resume")
    check("Links page: the Resume row opens the page too", row.get_attribute("href") == "./?view=resume" and row.get_attribute("target") is None)
    row.click()
    page.wait_for_function("location.search.includes('view=resume')")
    check("…in place, with no fly animation", page.locator(".resume-sheet").is_visible() and page.locator(".resume-fly").count() == 0 and not errors, str(errors))
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    offline_api(ctx)
    page = ctx.new_page()
    page.goto(URL)
    page.locator(".hero-actions a", has_text="Resume").click()
    page.wait_for_function("location.search.includes('view=resume')")
    check("reduced motion: straight to the page", page.locator(".resume-fly").count() == 0 and page.locator(".resume-sheet").is_visible())
    ctx.close()

    ctx, page, errors = new_page(browser)
    page.locator(".hero-actions a", has_text="Resume").click()
    page.wait_for_timeout(60)
    page.keyboard.press("Escape")
    page.wait_for_function("!document.querySelector('.resume-fly')", timeout=2000)
    check("a key press skips to the end", "view=resume" in page.url and page.locator(".resume-sheet").is_visible())
    ctx.close()

    # From the real cover: the sidebar slides in during the flight rather than appearing at once.
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    offline_api(ctx, cover=True)
    page = ctx.new_page()
    page.goto("http://localhost:8000/")
    page.wait_for_load_state("networkidle")
    page.keyboard.press("Escape")  # skip the intro
    page.wait_for_timeout(300)
    page.locator(".hero-actions a", has_text="Resume").click()
    page.wait_for_function("location.search.includes('view=resume')")
    page.wait_for_timeout(80)
    mid = page.evaluate("document.querySelector('#sidebar').getBoundingClientRect().left")
    page.wait_for_function("!document.querySelector('.resume-fly')")
    end = page.evaluate("document.querySelector('#sidebar').getBoundingClientRect().left")
    check("from the cover the sidebar slides in, not pops", mid < end - 20 and end > 0, f"mid {mid}, end {end}")
    ctx.close()
    browser.close()
finish()
