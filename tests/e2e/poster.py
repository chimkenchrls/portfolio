"""The poster: Home's opening screen, its intro, the name's legibility in every state, colour on hover/tap."""
import io
import os
from PIL import Image
from playwright.sync_api import sync_playwright
from common import check, finish, offline_api

SHOTS = os.environ.get("SHOTS")
PLAIN = "http://localhost:8000/"


def page(b, width=1280, height=800, theme="dark", url=PLAIN, **opts):
    ctx = b.new_context(viewport={"width": width, "height": height}, **opts)
    offline_api(ctx)
    ctx.route("**/github-contributions-api.jogruber.de/**", lambda r: r.abort())
    ctx.add_init_script(f"try {{ localStorage.setItem('theme', '{theme}'); localStorage.setItem('ck-hint-seen', '1'); }} catch (e) {{}}")
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(url); p.wait_for_load_state("domcontentloaded")
    return ctx, p, errors


def box(p, sel):
    return p.eval_on_selector(sel, "n => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }")


def window_stats(p, x0, x1, y0, y1):
    """Luminance spread inside a window of the screen, and how grey its bright pixels are."""
    img = Image.open(io.BytesIO(p.screenshot(clip={"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0}))).convert("RGB")
    px = list(img.getdata())
    lum = [0.2126 * r + 0.7152 * g + 0.0722 * b for r, g, b in px]
    bright = [c for c, l in zip(px, lum) if l > 150]
    tint = max((max(abs(r - g), abs(g - b)) for r, g, b in bright), default=0)
    return (max(lum) - min(lum)) / 255, tint


def legible(p, label, over_suit=True):
    """The name must stand out over the background and over the suit, never tinted."""
    # The text itself, not the full-width line box it is centred in.
    name = p.evaluate("(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#hero-name')); const b = r.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()")
    poster = box(p, ".poster")
    y0, y1 = name["y"] + name["h"] * 0.2, name["y"] + name["h"] * 0.8
    spots = {"background": (name["x"] + 4, name["x"] + name["w"] * 0.07)}
    if over_suit:
        mid = poster["x"] + poster["w"] / 2
        spots["suit"] = (mid + poster["w"] * 0.1, mid + poster["w"] * 0.16)
    for where, (x0, x1) in spots.items():
        spread, tint = window_stats(p, x0, x1, y0, y1)
        check(f"{label}: the name stands out over the {where}", spread >= 0.25, f"spread {spread:.2f}")
        check(f"{label}: the name over the {where} stays grey", tint <= 8, f"tint {tint}")


with sync_playwright() as pw:
    b = pw.chromium.launch()

    # The intro on a plain load -------------------------------------------------
    ctx, p, errors = page(b)
    p.wait_for_timeout(250)
    check("a plain load plays the intro", p.evaluate("document.documentElement.classList.contains('intro-play')"))
    check("the name is whole for screen readers during the intro", p.inner_text("#hero-name").strip() == "Kenneth Charles Valdez")
    if SHOTS: p.screenshot(path=f"{SHOTS}/poster-intro.png")
    p.wait_for_function("!document.documentElement.classList.contains('intro-play')", timeout=2600)
    check("it ends by itself in about two seconds", True)
    check("after it everything is in place", p.evaluate("['.poster-title', '.poster-side', '.poster-meta', '.poster-light'].every(s => getComputedStyle(document.querySelector(s)).opacity === '1') && getComputedStyle(document.querySelector('.notch')).translate === 'none'"))
    check("no errors in the intro", not errors, "; ".join(errors))
    ctx.close()
    ctx, p, errors = page(b)
    p.wait_for_timeout(300)
    p.keyboard.press("Escape")
    check("a key press skips it", not p.evaluate("document.documentElement.classList.contains('intro-play')"))
    ctx.close()

    # Name legibility in all four states (desktop) -----------------------------
    for theme in ("dark", "light"):
        ctx, p, errors = page(b, theme=theme, reduced_motion="reduce")
        p.wait_for_timeout(700)
        legible(p, f"desktop {theme}, black and white")
        if SHOTS: p.screenshot(path=f"{SHOTS}/poster-{theme}.png")
        p.evaluate("document.querySelector('.poster').classList.add('is-colour')")
        p.wait_for_timeout(100)
        legible(p, f"desktop {theme}, in colour")
        check(f"desktop {theme}: colour shows the photo's colour", p.eval_on_selector(".poster-photo-desktop", "n => getComputedStyle(n).filter") == "none")
        if SHOTS: p.screenshot(path=f"{SHOTS}/poster-{theme}-colour.png")
        ctx.close()

    # Hover for colour on desktop ---------------------------------------------
    ctx, p, errors = page(b, reduced_motion="reduce")
    p.wait_for_timeout(500)
    check("desktop: black and white until hovered", "grayscale(1)" in p.eval_on_selector(".poster-photo-desktop", "n => getComputedStyle(n).filter"))
    p.mouse.move(640, 300)
    p.wait_for_timeout(100)
    check("desktop: hovering shows colour", p.eval_on_selector(".poster-photo-desktop", "n => getComputedStyle(n).filter") == "none")
    ctx.close()

    # Short and narrow windows -------------------------------------------------
    ctx, p, errors = page(b, 1366, 650, reduced_motion="reduce")
    p.wait_for_timeout(500)
    actions, meta = box(p, ".poster-actions"), box(p, ".poster-meta")
    check("1366×650: the buttons and the bottom row stay on the first screen", actions["b"] <= 650 and meta["b"] <= 650, f"{actions} {meta}")
    check("1366×650: no sideways scroll", p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    ctx.close()
    for width, height in ((390, 844), (320, 640)):
        ctx, p, errors = page(b, width, height, has_touch=True, is_mobile=True, reduced_motion="reduce")
        p.wait_for_timeout(500)
        name = box(p, "#hero-name")
        check(f"{width}px: the name is one line inside the screen", name["x"] >= 0 and name["r"] <= width and name["h"] < 80, str(name))
        check(f"{width}px: no sideways scroll", p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        side, title = box(p, ".poster-side"), box(p, ".poster-title")
        check(f"{width}px: title, buttons and name do not overlap", title["b"] <= side["y"] and side["b"] <= name["y"], f"{title} {side} {name}")
        legible(p, f"{width}px phone", over_suit=False)
        if SHOTS: p.screenshot(path=f"{SHOTS}/poster-phone-{width}.png")
        ctx.close()

    # Phone taps: a tap during the intro only skips it; later taps toggle colour ----
    ctx, p, errors = page(b, 390, 844, has_touch=True, is_mobile=True)
    is_colour = lambda: p.evaluate("document.querySelector('.poster').classList.contains('is-colour')")
    p.wait_for_timeout(300)
    p.tap(".poster-photo-phone", force=True)
    p.wait_for_timeout(200)
    check("phone: a tap during the intro skips it without turning colour on", not p.evaluate("document.documentElement.classList.contains('intro-play')") and not is_colour())
    p.wait_for_timeout(800)
    p.tap(".poster-photo-phone", force=True)
    p.wait_for_timeout(200)
    check("phone: a later tap turns colour on", is_colour())
    p.wait_for_timeout(400)
    p.tap(".poster-photo-phone", force=True)
    p.wait_for_timeout(200)
    check("phone: and the next tap turns it off", not is_colour())
    check("no errors on the phone", not errors, "; ".join(errors))
    ctx.close()
    b.close()
finish()
