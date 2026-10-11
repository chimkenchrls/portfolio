"""Projects list: every project as a compact row; a row opens to its full write-up."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page

SHOTS = os.environ.get("SHOTS")
visible = lambda p: p.evaluate("[...document.querySelectorAll('.project')].filter(n => !n.hidden).length")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, width, height, opts in [("desktop", 1280, 900, {}), ("phone", 375, 812, {"has_touch": True, "is_mobile": True})]:
        ctx, p, errors = new_page(b, width, height, reduced_motion="reduce", **opts)
        total = p.evaluate("PORTFOLIO_DATA.projects.length")
        p.evaluate("document.getElementById('projects').scrollIntoView(); 0"); p.wait_for_timeout(800)
        check(f"{name}: every project is listed, with no fold button", visible(p) == total and p.locator(".project-more, .project.is-peek").count() == 0)
        check(f"{name}: details start closed", p.locator(".project-body:visible").count() == 0)
        thumbs = p.evaluate("[...document.querySelectorAll('.project:not([hidden]) .project-thumb img')].every(i => i.complete && i.naturalWidth > 0)")
        check(f"{name}: thumbnails load", thumbs)
        folded = p.eval_on_selector("#projects", "n => n.getBoundingClientRect().height")
        check(f"{name}: with every row closed the section stays compact", folded < (560 if name == "desktop" else 700), str(folded))
        if SHOTS: p.locator("#projects").screenshot(path=f"{SHOTS}/projects-{name}-folded.png")
        p.click(".project-toggle >> nth=0")
        check(f"{name}: a row opens to its write-up, tags and screenshots", p.locator(".project.is-open .project-desc").is_visible() and p.locator(".project.is-open .device").count() >= 1 and p.get_attribute(".project-toggle >> nth=0", "aria-expanded") == "true")
        over = p.evaluate("document.documentElement.scrollWidth > innerWidth")
        check(f"{name}: nothing overflows sideways", not over)
        p.wait_for_timeout(600)
        if SHOTS: p.locator("#projects").screenshot(path=f"{SHOTS}/projects-{name}-open.png")
        p.click(".project-toggle >> nth=0")
        check(f"{name}: and closes again", p.locator(".project-body:visible").count() == 0)
        check(f"{name}: no console errors", not errors, "; ".join(errors))
        ctx.close()
    ctx, p, errors = new_page(b, 1280, 900, color_scheme="dark")
    p.evaluate("document.getElementById('projects').scrollIntoView(); 0"); p.wait_for_timeout(1200)
    if SHOTS: p.locator("#projects").screenshot(path=f"{SHOTS}/projects-dark-folded.png")
    ctx.close()
    b.close()
finish()
