"""Night sky: pixel stars behind the page in the dark theme only; still under reduced motion."""
import os
from playwright.sync_api import sync_playwright
from common import URL, check, finish, offline_api

SHOTS = os.environ.get("SHOTS")
LIT = """() => { const c = document.querySelector('.sky'); if (c.hidden) return -1;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; }"""
HASH = """() => { const c = document.querySelector('.sky'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) h = (h * 31 + i + d[i]) >>> 0; return h; }"""


def page(b, **opts):
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, **opts)
    offline_api(ctx)
    ctx.route("**/github-contributions-api.jogruber.de/**", lambda r: r.abort())
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(URL); p.wait_for_load_state("networkidle")
    return ctx, p, errors


with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx, p, errors = page(b, color_scheme="dark")
    lit = p.evaluate(LIT)
    check("dark theme: stars are drawn", 100 < lit < 4000, str(lit))
    check("the dotted grid is gone", p.evaluate("getComputedStyle(document.body).backgroundImage") == "none")
    check("the sky sits behind everything and ignores the pointer", p.evaluate("(() => { const s = getComputedStyle(document.querySelector('.sky')); return s.zIndex === '-1' && s.pointerEvents === 'none'; })()"))
    first = p.evaluate(HASH)
    p.wait_for_timeout(2500)
    check("the sky moves", p.evaluate(HASH) != first)
    if SHOTS: p.screenshot(path=f"{SHOTS}/sky-dark.png")
    p.evaluate("document.getElementById('projects').scrollIntoView(); 0"); p.wait_for_timeout(900)
    if SHOTS: p.screenshot(path=f"{SHOTS}/sky-dark-projects.png")
    p.keyboard.press("t")
    p.wait_for_timeout(900)
    check("switching to light hides the sky", p.evaluate(LIT) == -1)
    p.keyboard.press("t")
    p.wait_for_timeout(900)
    check("and switching back brings it back", p.evaluate(LIT) > 100)
    check("no errors", not errors, "; ".join(errors))
    ctx.close()

    ctx, p, errors = page(b, color_scheme="light")
    check("dark is the default, whatever the system prefers", p.evaluate("document.documentElement.dataset.theme") == "dark" and p.evaluate(LIT) > 100)
    p.keyboard.press("t")
    p.wait_for_timeout(900)
    p.reload(); p.wait_for_load_state("networkidle")
    check("a visitor's own choice of light is remembered", p.evaluate("document.documentElement.dataset.theme") == "light")
    check("light theme: no sky, plain page", p.evaluate(LIT) == -1 and p.evaluate("getComputedStyle(document.body).backgroundImage") == "none")
    if SHOTS: p.screenshot(path=f"{SHOTS}/sky-light.png")
    ctx.close()

    ctx, p, errors = page(b, color_scheme="dark", reduced_motion="reduce")
    still = p.evaluate(HASH)
    p.wait_for_timeout(1500)
    check("reduced motion: stars are there but nothing moves", p.evaluate(LIT) > 100 and p.evaluate(HASH) == still)
    ctx.close()

    ctx = b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark", is_mobile=True, has_touch=True)
    offline_api(ctx)
    p = ctx.new_page(); p.goto(URL); p.wait_for_load_state("networkidle")
    check("phones get a smaller sky", 20 < p.evaluate(LIT) < 2000, str(p.evaluate(LIT)))
    if SHOTS: p.screenshot(path=f"{SHOTS}/sky-phone.png")
    ctx.close()
    b.close()
finish()
