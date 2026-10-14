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
        check(f"{name}: no console errors", not errors, "; ".join(errors))
        ctx.close()
    b.close()
finish()
