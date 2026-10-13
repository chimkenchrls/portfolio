"""Outside the IDE: cards sit inside the deck, counter + hint are below it, flipping works."""
from playwright.sync_api import sync_playwright
from common import check, finish, new_page, MORE

GEO = """() => {
  const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const deck = r('.deck'), card = [...document.querySelectorAll('.deck-card')].find(c => c.style.zIndex === '100').getBoundingClientRect();
  return { inside: !!document.querySelector('.deck .deck-card'), deck, card: { w: card.width, h: card.height, l: card.left, t: card.top },
           count: r('.deck-count'), hint: r('.deck-hint'), intro: r('.outside-intro') };
}"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, width, opts in [("desktop", 1280, {}), ("phone", 375, {"has_touch": True, "is_mobile": True})]:
        ctx, p, errors = new_page(b, width, 900 if width > 400 else 812, reduced_motion="reduce", **opts, url=MORE)
        p.evaluate("document.getElementById('outside').scrollIntoView(); 0"); p.wait_for_timeout(700)
        g = p.evaluate(GEO)
        check(f"{name}: photo cards are inside the deck", g["inside"])
        check(f"{name}: top card matches the deck size", abs(g["card"]["w"] - g["deck"]["w"]) < 2 and abs(g["card"]["h"] - g["deck"]["h"]) < 2, str(g["card"]))
        check(f"{name}: counter is below the deck", g["count"]["t"] >= g["deck"]["b"], f'{g["count"]["t"]} vs {g["deck"]["b"]}')
        check(f"{name}: hint is below the counter", g["hint"]["t"] >= g["count"]["b"] - 1)
        mid = lambda box: box["l"] + box["w"] / 2
        check(f"{name}: counter and hint are centered under the deck", abs(mid(g["count"]) - mid(g["deck"])) < 3 and abs(mid(g["hint"]) - mid(g["deck"])) < 3, f'{mid(g["count"])} {mid(g["hint"])} {mid(g["deck"])}')
        if name == "desktop":
            check("desktop: description sits beside the deck", g["intro"]["r"] <= g["deck"]["l"])
        else:
            check("phone: description sits above the deck", g["intro"]["b"] <= g["deck"]["t"])
            check("phone: no sideways page scroll", p.evaluate("document.documentElement.scrollWidth <= 375"))
        check(f"{name}: counter starts at 1 / 8", p.inner_text(".deck-count") == "1 / 8", p.inner_text(".deck-count"))
        (p.tap if opts else p.click)(".deck"); p.wait_for_timeout(300)
        check(f"{name}: tapping the deck flips to 2 / 8", p.inner_text(".deck-count") == "2 / 8", p.inner_text(".deck-count"))
        check(f"{name}: no console errors", not errors, "; ".join(errors))
        ctx.close()
    b.close()
finish()
