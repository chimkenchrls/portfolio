"""Outside the IDE: cards sit inside the deck, counter + hint are below it, flipping works."""
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, MORE

GEO = """() => {
  const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const deck = r('.deck'), card = [...document.querySelectorAll('.deck-card')].find(c => c.style.zIndex === '100').getBoundingClientRect();
  return { inside: !!document.querySelector('.deck .deck-card'), deck, card: { w: card.width, h: card.height, l: card.left, t: card.top },
           dots: r('.deck-dots'), hint: r('.deck-hint'), intro: r('.outside-intro') };
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, width, opts in [("desktop", 1280, {}), ("phone", 375, {"has_touch": True, "is_mobile": True})]:
        ctx, p, errors = new_page(b, width, 900 if width > 400 else 812, reduced_motion="reduce", **opts, url=MORE)
        p.evaluate("document.getElementById('outside').scrollIntoView(); 0"); p.wait_for_timeout(700)
        g = p.evaluate(GEO)
        check(f"{name}: photo cards are inside the deck", g["inside"])
        check(f"{name}: front photo is narrower than the fan stage", g["card"]["w"] < g["deck"]["w"] * 0.5 and abs(g["card"]["h"] / g["card"]["w"] - 1.25) < 0.02, str(g["card"]))
        check(f"{name}: dots are below the deck", g["dots"]["t"] >= g["deck"]["b"], f'{g["dots"]["t"]} vs {g["deck"]["b"]}')
        check(f"{name}: hint is below the dots", g["hint"]["t"] >= g["dots"]["b"] - 1)
        mid = lambda box: box["l"] + box["w"] / 2
        check(f"{name}: dots and hint are centered under the deck", abs(mid(g["dots"]) - mid(g["deck"])) < 3 and abs(mid(g["hint"]) - mid(g["deck"])) < 3)
        check(f"{name}: description sits below the deck", g["intro"]["t"] >= g["hint"]["b"])
        if name == "phone":
            check("phone: no sideways page scroll", p.evaluate("document.documentElement.scrollWidth <= 375"))
        check(f"{name}: counter starts at 1 / 8", p.inner_text(".deck-count") == "1 / 8", p.inner_text(".deck-count"))
        (p.tap if opts else p.click)(".deck"); p.wait_for_timeout(300)
        check(f"{name}: tapping the deck flips to 2 / 8", p.inner_text(".deck-count") == "2 / 8", p.inner_text(".deck-count"))
        check(f"{name}: dots track the active photo", p.locator('.deck-dot[aria-pressed="true"]').get_attribute("aria-label") == "Show photo 2 of 8")
        p.locator(".deck-dot").nth(7).click()
        check(f"{name}: a dot opens its photo", p.inner_text(".deck-count") == "8 / 8")
        # A side photo comes forward when clicked, not just the next one.
        count = lambda: p.inner_text(".deck-count")
        p.locator(".deck-dot").nth(0).click(); p.wait_for_timeout(100)
        side = p.evaluate("(() => { const d = document.querySelector('.deck').getBoundingClientRect(); const c = [...document.querySelectorAll('.deck-card')].find(n => n.style.zIndex === '98'); const b = c.getBoundingClientRect(); const y = b.top + b.height / 2; const out = b.left + b.width / 2 < d.left + d.width / 2 ? -1 : 1; const x = b.left + b.width / 2 + out * b.width * 0.35; const hit = document.elementFromPoint(x, y); return { x, y, i: [...document.querySelectorAll('.deck-card')].indexOf(c), on: !!hit && hit.closest('.deck-card') === c }; })()")
        check(f"{name}: (the probe lands on a side photo)", side["on"], str(side))
        (p.touchscreen.tap if opts else p.mouse.click)(side["x"], side["y"]); p.wait_for_timeout(150)
        check(f"{name}: clicking a side photo brings that photo forward", count() == f'{side["i"] + 1} / 8', f'{count()} wanted {side["i"] + 1}')
        if not opts:
            p.locator(".deck-dot").nth(0).click(); p.wait_for_timeout(100)
            p.focus(".deck")
            for _ in range(3): p.keyboard.press("ArrowRight")
            check("desktop: quick key presses all count", count() == "4 / 8", count())
            p.keyboard.press("End"); check("desktop: End jumps to the last photo", count() == "8 / 8", count())
            p.keyboard.press("Home"); check("desktop: Home jumps to the first", count() == "1 / 8", count())
            box = p.locator(".deck").bounding_box()
            p.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
            p.mouse.wheel(120, 0); p.wait_for_timeout(100)
            check("desktop: a sideways trackpad swipe flips the deck", count() == "2 / 8", count())
            p.mouse.wheel(0, 120); p.wait_for_timeout(100)
            check("desktop: scrolling up and down still scrolls the page, not the deck", count() == "2 / 8", count())
            front = "[...document.querySelectorAll('.deck-card')].find(n => n.style.zIndex === '100').querySelector('img, video')"
            p.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2); p.wait_for_timeout(350)
            check("desktop: hovering a photo shows its colour", p.evaluate(f"getComputedStyle({front}).filter") == "none", p.evaluate(f"getComputedStyle({front}).filter"))
            # Dragging: the fan follows the mouse, even off the deck, then flips on release.
            x0, y0 = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            p.mouse.down(); p.mouse.move(x0 - 60, y0, steps=4)
            moved = p.evaluate("getComputedStyle(document.querySelector('.deck-cards')).translate")
            check("desktop: the fan follows a drag", moved not in ("none", "0px") and moved.startswith("-"), moved)
            p.mouse.move(x0 - 400, y0 + 220, steps=6); p.mouse.up(); p.wait_for_timeout(150)
            check("desktop: a drag that leaves the deck still flips it", count() == "3 / 8", count())
            check("desktop: and the fan settles back", p.evaluate("getComputedStyle(document.querySelector('.deck-cards')).translate") in ("none", "0px"))
        check(f"{name}: the hint says what a click does", "bring it forward" in p.inner_text(".deck-hint"), p.inner_text(".deck-hint"))
        check(f"{name}: no console errors", not errors, "; ".join(errors))
        ctx.close()
    # With motion on, quick input is not swallowed while the fan is still moving.
    ctx, p, errors = new_page(b, 1280, 900, url=MORE)
    p.evaluate("document.getElementById('outside').scrollIntoView(); 0"); p.wait_for_timeout(900)
    p.focus(".deck")
    for _ in range(3): p.keyboard.press("ArrowRight"); p.wait_for_timeout(60)
    check("motion on: quick key presses all count", p.inner_text(".deck-count") == "4 / 8", p.inner_text(".deck-count"))
    ctx.close()
    b.close()
finish()
