"""The photo deck must never draw over the drawer, the top bar, or the game popup."""
from playwright.sync_api import sync_playwright
from common import MORE, check, finish, new_page

PROBE = "(pt) => { const e = document.elementFromPoint(pt[0], pt[1]); return e ? [!!e.closest('#sidebar'), !!e.closest('.deck'), String(e.className)] : null; }"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx, p, errors = new_page(b, 375, 812, has_touch=True, is_mobile=True, url=MORE)
    p.evaluate("document.querySelector('.deck').scrollIntoView({ block: 'center' }); 0"); p.wait_for_timeout(900)
    box = p.locator(".deck").bounding_box()
    p.click(".menu-toggle"); p.wait_for_timeout(400)
    side = p.locator("#sidebar").bounding_box()
    pts = [[box["x"] + 20, box["y"] + 40], [box["x"] + 60, box["y"] + box["height"] / 2], [box["x"] + 30, box["y"] + box["height"] - 30]]
    pts = [pt for pt in pts if pt[0] < side["x"] + side["width"] - 4 and side["y"] < pt[1] < side["y"] + side["height"]]
    res = [p.evaluate(PROBE, pt) for pt in pts]
    check("open drawer covers the photo deck", len(res) >= 2 and all(r and r[0] and not r[1] for r in res), str(res))
    p.keyboard.press("Escape"); p.wait_for_timeout(300)
    p.evaluate("(() => { const d = document.querySelector('.deck').getBoundingClientRect(); window.scrollBy(0, d.top - 20); return 0; })()"); p.wait_for_timeout(400)
    top = p.evaluate("(() => { const e = document.elementFromPoint(120, 28); return [!!e.closest('.topbar'), !!e.closest('.deck')]; })()")
    check("sticky top bar stays above the deck", top[0] and not top[1], str(top))
    p.tap(".deck"); p.wait_for_timeout(500)
    check("deck still flips", p.inner_text(".deck-count").startswith("2 /"), p.inner_text(".deck-count"))
    check("no errors (phone)", not errors, "; ".join(errors))
    ctx.close()

    ctx, p, errors = new_page(b, url=MORE)
    p.evaluate("document.querySelector('.deck').scrollIntoView({ block: 'center' }); 0"); p.wait_for_timeout(600)
    p.keyboard.press("Alt+k"); p.wait_for_timeout(300)
    g = p.evaluate("(() => { const r = document.querySelector('.game').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width - 60, r.top + r.height / 2); return !!e.closest('.game'); })()")
    check("game popup stays above the deck", g)
    ctx.close()
    b.close()
finish()
