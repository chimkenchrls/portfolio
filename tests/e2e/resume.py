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
        check(f"{name}: tab title", page.title().startswith("Résumé"))
        check(f"{name}: no errors", not errors, str(errors))
        if SHOTS:
            page.screenshot(path=f"{SHOTS}/resume-{name}.png", full_page=True)
        ctx.close()

    ctx, page, errors = new_page(browser)
    button = page.locator(".poster-actions a", has_text="Résumé")
    check("hero Resume button opens the page", button.get_attribute("href") == "./?view=resume" and button.get_attribute("target") is None)
    button.click()
    page.wait_for_timeout(150)
    check("the hero's Résumé button uses the page curtain, carrying Résumé, with no flying sheet", page.locator(".resume-fly").count() == 0
          and page.evaluate("[...document.querySelectorAll('.page-curtain-word span')].map(n => n.textContent).join('')") == "Résumé")
    if SHOTS:
        page.wait_for_timeout(300)
        page.screenshot(path=f"{SHOTS}/resume-curtain.png")
    page.wait_for_function("location.search.includes('view=resume')")
    page.wait_for_function("!document.querySelector('.page-curtain')", timeout=3000)
    check("in place, through the router, and cleaned up", page.locator(".resume-sheet").is_visible() and page.evaluate("getComputedStyle(document.querySelector('#main')).opacity") == "1" and not errors, str(errors))
    check("no notch link for it; the footer has one", page.locator('.notch [data-view="resume"]').count() == 0 and page.locator('footer a[href="./?view=resume"]').count() == 1)
    page.go_back()
    page.wait_for_function("!location.search.includes('view=resume')")
    check("back goes home and hides it", not page.locator("#resume").is_visible())
    ctx.close()

    ctx, page, errors = new_page(browser, url="http://localhost:8000/?view=links")
    row = page.locator(".profile-link", has_text="Résumé")
    check("Links page: the Resume row opens the page too", row.get_attribute("href") == "./?view=resume" and row.get_attribute("target") is None)
    row.click()
    page.wait_for_function("location.search.includes('view=resume')")
    check("…in place, with the same curtain", page.locator(".resume-sheet").is_visible() and page.locator(".resume-fly").count() == 0 and not errors, str(errors))
    ctx.close()

    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    offline_api(ctx)
    page = ctx.new_page()
    page.goto(URL)
    page.locator(".poster-actions a", has_text="Résumé").click()
    page.wait_for_function("location.search.includes('view=resume')")
    check("reduced motion: straight to the page", page.locator(".resume-fly, .page-curtain").count() == 0 and page.locator(".resume-sheet").is_visible())
    ctx.close()

    ctx, page, errors = new_page(browser)
    page.locator(".poster-actions a", has_text="Résumé").click()
    page.wait_for_function("!document.querySelector('.page-curtain') && location.search.includes('view=resume')", timeout=3000)
    check("the curtain lands on the résumé", page.locator(".resume-sheet").is_visible())
    ctx.close()

    # From the poster with its intro: the notch stays in place through the curtain and the way back.
    ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    offline_api(ctx)
    page = ctx.new_page()
    page.goto("http://localhost:8000/")
    page.wait_for_load_state("networkidle")
    page.keyboard.press("Escape")  # skip the intro
    page.wait_for_timeout(300)
    page.evaluate("window.notch = document.querySelector('.notch')")
    page.locator(".poster-actions a", has_text="Résumé").click()
    page.wait_for_function("location.search.includes('view=resume')")
    page.wait_for_function("!document.querySelector('.page-curtain')", timeout=3000)
    check("the curtain lands on the Résumé page under the same notch", page.evaluate("notch === document.querySelector('.notch') && notch.getBoundingClientRect().top >= 0") and page.locator(".resume-sheet").is_visible())
    page.wait_for_timeout(300)
    page.locator(".resume-page-header .case-back").click()
    page.wait_for_function("!location.search.includes('view=resume')")
    page.wait_for_timeout(600)
    check("← Home: back on the poster", page.is_visible(".poster-name") and page.evaluate("document.documentElement.classList.contains('is-home')"))
    ctx.close()
    browser.close()
finish()
