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


def shot(p, clip):
    return Image.open(io.BytesIO(p.screenshot(clip=clip))).convert("RGB")


def styled(p, css, clip):
    """A screenshot of `clip` with a temporary style applied."""
    p.evaluate("css => { const s = document.createElement('style'); s.id = 'probe'; s.textContent = css; document.head.append(s); }", css)
    p.wait_for_timeout(50)
    image = shot(p, clip)
    p.evaluate("document.getElementById('probe').remove()")
    p.wait_for_timeout(50)
    return image


def lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


NAME = (".poster-name, .poster-name-over", ".poster-name-over { display: none !important; } #hero-name { color: #ff0000 !important; mix-blend-mode: normal !important; }")
META = (".poster-meta", ".poster-meta, .poster-meta * { color: #ff0000 !important; mix-blend-mode: normal !important; }")


def glyph_stats(p, clip, target=NAME):
    """How far the text's own pixels sit from what is behind them, and how grey they are."""
    hide, paint = target
    real = shot(p, clip)
    behind = styled(p, hide + " { visibility: hidden !important; }", clip)
    mask = styled(p, paint + " .poster-photo, .poster-light { visibility: hidden !important; }", clip)
    inside = [i for i, (r, g, b) in enumerate(mask.getdata()) if r > 200 and g < 60 and b < 60]
    if not inside:
        return 0, 0, 0
    rp, bp = list(real.getdata()), list(behind.getdata())
    contrast = sum(abs(lum(rp[i]) - lum(bp[i])) for i in inside) / len(inside) / 255
    tint = sorted(max(abs(rp[i][0] - rp[i][1]), abs(rp[i][1] - rp[i][2])) for i in inside)[int(len(inside) * 0.95)]
    return contrast, tint, len(inside)


def legible(p, label, over_suit=True):
    """The name must stand out over the background, the suit and the shirt, never tinted."""
    # The text itself, not the full-width line box it is centred in.
    name = p.evaluate("(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('#hero-name')); const b = r.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })()")
    poster = box(p, ".poster")
    y0, y1 = name["y"] + name["h"] * 0.15, name["y"] + name["h"] * 0.85
    spots = {"background": (name["x"] + 2, name["x"] + name["w"] * 0.07)}
    if over_suit:
        mid = poster["x"] + poster["w"] / 2
        spots["suit"] = (mid + poster["w"] * 0.1, mid + poster["w"] * 0.16)
        spots["shirt"] = (mid - poster["w"] * 0.035, mid - poster["w"] * 0.005)
    for where, (x0, x1) in spots.items():
        contrast, tint, count = glyph_stats(p, {"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0})
        check(f"{label}: the name stands out over the {where}", contrast >= 0.25 and count > 20, f"contrast {contrast:.2f}, {count} px")
        check(f"{label}: the name over the {where} stays grey", tint <= 12, f"tint {tint}")


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

    # The bottom row is clickable, not hidden under the About panel ------------------
    for width, height, mobile in ((1280, 800, False), (390, 844, True)):
        ctx, p, errors = page(b, width, height, has_touch=mobile, is_mobile=mobile, reduced_motion="reduce")
        p.wait_for_timeout(500)
        hits = p.evaluate("[...document.querySelectorAll('.poster-meta .social a, .poster-meta .social button')].map(n => { const r = n.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && n.contains(e); })")
        check(f"{width}px: the social links in the bottom row can be clicked", hits and all(hits), str(hits))
        ctx.close()

    # A real 360px phone (no layout widening): nothing pushes the page sideways --------
    for width in (360, 320):
        ctx, p, errors = page(b, width, 740, reduced_motion="reduce")
        p.wait_for_timeout(500)
        check(f"{width}px without zoom-out: no sideways scroll anywhere on Home", p.evaluate("document.documentElement.scrollWidth <= innerWidth"), str(p.evaluate("document.documentElement.scrollWidth")))
        ctx.close()

    # Tablet held upright ----------------------------------------------------------
    ctx, p, errors = page(b, 768, 1024, theme="light", has_touch=True, reduced_motion="reduce")
    p.wait_for_timeout(500)
    title = box(p, ".poster-title")
    photo = p.evaluate("(() => { const i = document.querySelector('.poster-photo-desktop'); const r = i.getBoundingClientRect(); const h = Math.min(r.height, r.width * i.naturalHeight / i.naturalWidth); return { top: r.bottom - h, h }; })()")
    check("768×1024: the title sits clear of his head", title["b"] <= photo["top"] + 4, f"{title} {photo}")
    check("768×1024: the bottom row is one line", box(p, ".poster-meta")["h"] < 40, str(box(p, ".poster-meta")))
    social = box(p, ".poster-meta .social")
    contrast, _, count = glyph_stats(p, {"x": social["x"], "y": social["y"], "width": social["w"], "height": social["h"]}, META)
    check("768×1024: the social links read clearly where they cross the suit", contrast >= 0.25 and count > 20, f"contrast {contrast:.2f}, {count} px")
    p.evaluate("document.querySelector('.poster').classList.add('is-colour')")
    legible(p, "768×1024 light, in colour")
    if SHOTS: p.screenshot(path=f"{SHOTS}/poster-tablet.png")
    ctx.close()

    ctx, p, errors = page(b, 1280, 800, reduced_motion="reduce")
    p.wait_for_timeout(500)
    check("1280×800: the poster fills the first screen (About starts below it)", box(p, "#about")["y"] >= 799, str(box(p, "#about")))
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
        about = box(p, "#about")
        check(f"{width}px: the poster fills the first screen (About starts below it)", about["y"] >= height - 1, str(about))
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
