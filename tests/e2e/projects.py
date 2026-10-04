"""Projects: device-pair screenshots beside the text, viewer dialog, layout on desktop and phone."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, new_page

SHOTS = os.environ.get("SHOTS")
GEO = """() => [...document.querySelectorAll('.project.has-media')].map(li => {
  const r = (s) => { const n = li.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const imgs = [...li.querySelectorAll('.device img')];
  return { title: li.querySelector('.project-title').textContent, info: r('.project-info'), media: r('.project-media'), desktop: r('.device-desktop'), mobile: r('.device-mobile'),
           loaded: imgs.every(i => i.complete && i.naturalWidth > 0), gray: imgs.every(i => getComputedStyle(i).filter.includes('grayscale(1)')) };
})"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, width, height, opts in [("desktop", 1280, 900, {}), ("phone", 375, 812, {"has_touch": True, "is_mobile": True})]:
        ctx, p, errors = new_page(b, width, height, reduced_motion="reduce", **opts)
        p.evaluate("document.getElementById('projects').scrollIntoView(); 0"); p.wait_for_timeout(1500)
        expected = p.evaluate("PORTFOLIO_DATA.projects.filter(x => x.media).map(x => x.title)")
        plain = p.evaluate("PORTFOLIO_DATA.projects.filter(x => !x.media).length")
        rows = p.evaluate(GEO)
        check(f"{name}: every project with screenshots shows frames", [r["title"] for r in rows] == expected and len(rows) >= 2, str([r["title"] for r in rows]))
        check(f"{name}: projects without screenshots stay text-only", p.locator(".project:not(.has-media)").count() == plain)
        for r in rows:
            t = r["title"]
            check(f"{name}: {t}: screenshots loaded", r["loaded"])
            check(f"{name}: {t}: black-and-white at rest", r["gray"])
            check(f"{name}: {t}: phone frame overlaps the browser frame's corner", r["mobile"]["r"] > r["desktop"]["r"] - 1 and r["mobile"]["b"] > r["desktop"]["b"] - 1 and r["mobile"]["l"] < r["desktop"]["r"] and r["mobile"]["w"] < r["desktop"]["w"] / 2, str(r["mobile"]))
            if name == "desktop":
                check(f"desktop: {t}: frames sit to the right of the text", r["info"]["r"] <= r["media"]["l"] + 1, f'{r["info"]["r"]} vs {r["media"]["l"]}')
            else:
                check(f"phone: {t}: frames sit under the text", r["info"]["b"] <= r["media"]["t"] + 1)
        check(f"{name}: no sideways page scroll", p.evaluate("document.documentElement.scrollWidth <= innerWidth"))

        first = p.locator(".device-desktop").first
        label = first.get_attribute("aria-label")
        check(f"{name}: frames are labelled buttons", (label or "").startswith("Enlarge screenshot: ") and label.endswith(" on desktop"), str(label))
        (first.tap if opts else first.click)(); p.wait_for_timeout(300)
        check(f"{name}: clicking a frame opens the viewer", p.eval_on_selector(".shot-viewer", "d => d.open"))
        v = p.evaluate("(() => { const i = document.querySelector('.shot-viewer-stage img'); const r = i.getBoundingClientRect(); return { src: i.getAttribute('src'), alt: i.alt, w: r.width, fits: r.right <= innerWidth + 1, color: getComputedStyle(i).filter }; })()")
        check(f"{name}: viewer shows that shot, in color, within the screen", v["src"] == first.get_attribute("data-shot") and v["alt"].endswith("on desktop") and v["fits"] and v["color"] == "none", str(v))
        if SHOTS:
            p.screenshot(path=f"{SHOTS}/projects-viewer-{name}.png")
        p.keyboard.press("Escape"); p.wait_for_timeout(200)
        check(f"{name}: Esc closes the viewer", not p.eval_on_selector(".shot-viewer", "d => d.open"))
        p.locator(".device-mobile").first.click(); p.wait_for_timeout(300)
        m = p.evaluate("(() => { const r = document.querySelector('.shot-viewer-stage img').getBoundingClientRect(); return r.height <= innerHeight && r.width <= innerWidth; })()")
        check(f"{name}: a phone screenshot fits the screen in the viewer", m)
        p.click(".shot-viewer-close"); p.wait_for_timeout(200)
        check(f"{name}: the close button closes it", not p.eval_on_selector(".shot-viewer", "d => d.open"))
        if SHOTS:
            p.evaluate("document.getElementById('projects').scrollIntoView(); 0"); p.wait_for_timeout(300)
            p.locator("#projects").screenshot(path=f"{SHOTS}/projects-{name}.png")
        check(f"{name}: no console errors", not errors, "; ".join(errors))
        ctx.close()

    ctx, p, errors = new_page(b, 1280, 900)
    p.evaluate("document.getElementById('projects').scrollIntoView(); 0"); p.wait_for_timeout(1200)
    p.hover(".device-desktop"); p.wait_for_timeout(400)
    check("hover shows the screenshot in color", p.eval_on_selector(".device-desktop img", "i => getComputedStyle(i).filter") == "none")
    ctx.close()
    b.close()
finish()
