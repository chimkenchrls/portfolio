"""Case study pages: ./?view=case&p=<slug> shows one project's card with its study under it."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, ALL_PROJECTS

CASE = "http://localhost:8000/?view=case&p="
SHOTS = os.environ.get("SHOTS")

with sync_playwright() as p:
    browser = p.chromium.launch()
    for width, height, name in [(1280, 900, "desktop"), (390, 844, "phone")]:
        if SHOTS:
            ctx, page, errors = new_page(browser, width, height, url=CASE + "amigo")
            page.screenshot(path=f"{SHOTS}/case-amigo-{name}.png", full_page=True)
            ctx.close()
        ctx, page, errors = new_page(browser, width, height, url=CASE + "thready")
        check(f"{name}: an article, not a card: Thready", page.locator(".project").count() == 0 and page.locator(".case-name").inner_text() == "Thready")
        check(f"{name}: role under the title", "Frontend and DevOps lead" in page.locator(".case-who").inner_text())
        check(f"{name}: four parts and Built with", page.locator(".case-part").count() == 5 and page.locator(".case-built-row").count() >= 2)
        check(f"{name}: screenshots shown", page.locator(".case-media img").count() >= 1)
        check(f"{name}: pipeline drawn in How it ships", page.locator(".case-part:nth-child(3) .diagram-node").count() == 5)
        check(f"{name}: no source link for a private repository", page.locator(".case-page a", has_text="source").count() == 0)
        check(f"{name}: only Projects is shown", page.locator(".main > .section:visible").count() == 1)
        check(f"{name}: links back", page.locator(".case-back").get_attribute("href") == "./?view=projects")
        check(f"{name}: no sideways scroll", page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
        check(f"{name}: no errors", not errors, str(errors))
        if SHOTS:
            page.screenshot(path=f"{SHOTS}/case-{name}.png", full_page=True)
        ctx.close()

    ctx, page, errors = new_page(browser, url=ALL_PROJECTS)
    check("projects page: no 'case study' link, the card itself opens it", page.locator(".project-links a", has_text="case study").count() == 0 and page.locator(".project-open").count() == 5)
    with page.expect_popup() as popup:
        page.locator(".project").first.locator(".project-links a", has_text="source").click()
    check("a card's own links still work", "github.com" in popup.value.url)
    popup.value.close()
    # Anywhere on the card that is not one of its own controls.
    page.locator(".project").first.click(position={"x": 300, "y": 110})
    page.wait_for_load_state("networkidle")
    check("clicking the card opens that project's case study", "view=case&p=ambiancy" in page.url and page.locator(".case-part").count() == 5)
    ctx.close()

    ctx, page, errors = new_page(browser)
    check("home rows open the case study", "view=case&p=" in page.locator(".project-list a").first.get_attribute("href"))
    ctx.close()

    ctx, page, errors = new_page(browser, url=CASE + "nope")
    check("unknown project falls back to the full list", page.locator(".project").count() == 5 and page.locator(".case").count() == 0 and "All projects" in page.locator("#projects-heading").text_content())
    ctx.close()
    browser.close()
finish()
