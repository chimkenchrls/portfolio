"""Resume page: ./?view=resume shows the resume as a sheet, with the PDF beside it."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, URL

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
    page.wait_for_function("location.search.includes('view=resume')")
    check("in place, through the router", page.locator(".resume-sheet").is_visible() and not errors, str(errors))
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
    check("…in place", page.locator(".resume-sheet").is_visible() and not errors, str(errors))
    ctx.close()
    browser.close()
finish()
