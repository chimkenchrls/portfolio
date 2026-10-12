"""Cover: the hero is its own opening screen. It assembles once on load; the sidebar only arrives
after the hero has scrolled away, and leaves again (with no replay) when the visitor scrolls back up."""
import os
from playwright.sync_api import sync_playwright
from common import check, finish, offline_api

SHOTS = os.environ.get("SHOTS")
PLAIN = "http://localhost:8000/"
STATE = """() => { const r = s => document.querySelector(s).getBoundingClientRect(); const o = s => getComputedStyle(document.querySelector(s)).opacity;
  const hero = r('.hero'), photo = r('.hero-photo'), text = r('.hero-text');
  return { cover: document.documentElement.classList.contains('at-cover'), play: document.documentElement.classList.contains('intro-play'),
    sidebarLeft: Math.round(r('.sidebar').left), sidebarRight: Math.round(r('.sidebar').right), sidebarSeen: getComputedStyle(document.querySelector('.sidebar')).visibility,
    heroTop: Math.round(hero.top), heroH: Math.round(hero.height), contentMidX: Math.round((photo.left + text.right) / 2), contentMidY: Math.round((Math.min(photo.top, text.top) + Math.max(photo.bottom, text.bottom)) / 2),
    aboutTop: Math.round(r('#about').top), about: o('#about'), name: document.querySelector('.hero-name').textContent, photo: o('.hero-photo'), title: o('.hero-title'),
    tiles: document.querySelectorAll('.intro-tiles').length, hint: o('.intro-hint'), y: Math.round(scrollY) }; }"""
settle = lambda p: p.wait_for_timeout(750)


def page(b, url=PLAIN, width=1280, height=900, **opts):
    ctx = b.new_context(viewport={"width": width, "height": height}, color_scheme="dark", **opts)
    offline_api(ctx, cover=True)
    ctx.route("**/github-contributions-api.jogruber.de/**", lambda r: r.abort())
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(url); p.wait_for_load_state("domcontentloaded")
    return ctx, p, errors


with sync_playwright() as pw:
    b = pw.chromium.launch()

    ctx, p, errors = page(b)
    p.wait_for_timeout(250)
    s = p.evaluate(STATE)
    check("the page opens on the hero alone: no sidebar", s["cover"] and s["sidebarRight"] <= 0 and s["sidebarSeen"] == "hidden", str(s))
    check("the hero fills the window", s["heroTop"] == 0 and s["heroH"] == 900 and s["aboutTop"] == 900, str(s))
    check("the photo is assembling from tiles", s["tiles"] == 1 and s["photo"] == "1")
    check("the name is complete for screen readers while it types", p.get_attribute(".hero-name", "aria-label") == "Kenneth Charles Valdez" and s["name"] == "Kenneth Charles Valdez")
    if SHOTS: p.screenshot(path=f"{SHOTS}/intro-1-assembling.png")
    p.wait_for_function("!document.documentElement.classList.contains('intro-play')", timeout=5000)
    p.wait_for_timeout(450)
    s = p.evaluate(STATE)
    check("the hero finishes on its own: photo, name and the rest all shown", s["tiles"] == 0 and s["photo"] == "1" and s["title"] == "1" and s["name"] == "Kenneth Charles Valdez" and p.get_attribute(".hero-name", "aria-label") is None, str(s))
    check("its content is centred on the window, both ways", abs(s["contentMidX"] - 640) <= 2 and abs(s["contentMidY"] - 450) <= 2, str(s))
    check("it stays alone, with a scroll hint", s["cover"] and s["sidebarRight"] <= 0 and s["hint"] == "1")
    if SHOTS: p.screenshot(path=f"{SHOTS}/intro-2-waiting.png")

    COLUMN = "Math.round(document.querySelector('.about-bio').getBoundingClientRect().left)"
    HERO_LEFT = "Math.round(document.querySelector('.hero-photo').getBoundingClientRect().left)"
    centred = p.evaluate(HERO_LEFT)
    steps = []
    for y in (90, 270, 450, 630, 720):
        p.evaluate(f"window.scrollTo({{ top: {y}, behavior: 'instant' }})")
        p.wait_for_timeout(180)
        steps.append((p.evaluate(STATE)["sidebarLeft"], p.evaluate(HERO_LEFT)))
        if SHOTS and y == 450: p.screenshot(path=f"{SHOTS}/intro-3-midway.png")
    check("the sidebar slides in with the scroll, never jumping", all(a[0] < b[0] for a, b in zip(steps, steps[1:])) and steps[0][0] < -200 and steps[-1][0] == 18, str(steps))
    check("the hero glides across in step with it", all(a[1] < b[1] for a, b in zip(steps, steps[1:])) and steps[0][1] - centred < 12, str((centred, steps)))
    check("by the time About takes over, hero and About share one left edge", steps[-1][1] == p.evaluate(COLUMN), str((steps[-1], p.evaluate(COLUMN))))
    s = p.evaluate(STATE)
    check("About is simply there below, never hidden, and the hint is gone", s["about"] == "1" and s["hint"] == "0", str(s))
    p.evaluate("document.getElementById('about').scrollIntoView({ block: 'start', behavior: 'instant' })")
    settle(p)
    s = p.evaluate(STATE)
    check("in About the sidebar is fully in place", not s["cover"] and s["sidebarLeft"] == 18 and s["sidebarSeen"] == "visible", str(s))
    check("About sits beside the sidebar, not under it", p.evaluate(COLUMN) >= 290, str(p.evaluate(COLUMN)))
    if SHOTS: p.screenshot(path=f"{SHOTS}/intro-4-about.png")
    p.evaluate("window.scrollTo({ top: 450, behavior: 'instant' })")
    p.wait_for_timeout(180)
    check("scrolling back up runs it in reverse", p.evaluate(STATE)["sidebarLeft"] == steps[2][0] and p.evaluate(HERO_LEFT) == steps[2][1], str((p.evaluate(STATE)["sidebarLeft"], steps[2])))

    p.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    settle(p)
    s = p.evaluate(STATE)
    check("back at the top the hero is on its own again", s["cover"] and s["sidebarRight"] <= 0 and s["sidebarSeen"] == "hidden" and s["hint"] == "1" and abs(s["contentMidX"] - 640) <= 2, str(s))
    check("and the intro does not replay", not s["play"] and s["tiles"] == 0 and s["photo"] == "1" and s["title"] == "1" and p.get_attribute(".hero-name", "aria-label") is None, str(s))
    if SHOTS: p.screenshot(path=f"{SHOTS}/intro-5-back-up.png")
    check("the hero's own buttons work on the cover", p.evaluate("(() => { const b = document.querySelector('.hero-actions .btn-primary').getBoundingClientRect(); return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2).closest('.btn-primary') !== null; })()"))
    p.click(".intro-hint")
    p.wait_for_timeout(1500)
    s = p.evaluate(STATE)
    check("the hint scrolls to About", s["aboutTop"] < 60 and not s["cover"] and s["sidebarLeft"] == 18, str(s))
    p.keyboard.press("1")
    p.wait_for_timeout(1500)
    check("the Home shortcut goes back to the cover", p.evaluate(STATE)["cover"])
    p.keyboard.press("3")
    p.wait_for_timeout(1500)
    check("and a section shortcut brings the sidebar with it", p.evaluate(STATE)["sidebarLeft"] == 18)
    check("no errors", not errors, "; ".join(errors))
    ctx.close()

    ctx, p, errors = page(b)
    p.wait_for_timeout(300)
    p.mouse.click(640, 860)
    s = p.evaluate(STATE)
    check("a click skips the animation but keeps the hero alone", not s["play"] and s["cover"] and s["tiles"] == 0 and s["title"] == "1", str(s))
    ctx.close()

    ctx, p, errors = page(b, url=PLAIN + "#projects")
    p.wait_for_timeout(600)
    s = p.evaluate(STATE)
    check("a deep link opens with the sidebar and no intro", not s["cover"] and not s["play"] and s["sidebarLeft"] == 18, str(s))
    p.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    settle(p)
    check("but scrolling up from it still reaches the lone hero", p.evaluate(STATE)["cover"])
    ctx.close()

    ctx, p, errors = page(b, reduced_motion="reduce")
    p.wait_for_timeout(400)
    s = p.evaluate(STATE)
    check("reduced motion: the hero is alone but nothing animates", s["cover"] and not s["play"] and s["tiles"] == 0 and s["photo"] == "1" and s["title"] == "1", str(s))
    p.evaluate("document.getElementById('about').scrollIntoView({ block: 'start' })")
    p.wait_for_timeout(200)
    check("reduced motion: the sidebar appears at once in About", p.evaluate(STATE)["sidebarLeft"] == 18)
    p.evaluate("window.scrollTo(0, 120)")
    p.wait_for_timeout(200)
    check("reduced motion: it switches as soon as scrolling starts, with no glide", p.evaluate(STATE)["sidebarLeft"] == 18 and p.evaluate("Math.round(document.querySelector('.hero-photo').getBoundingClientRect().left)") == p.evaluate("Math.round(document.querySelector('.about-bio').getBoundingClientRect().left)"))
    ctx.close()

    ctx, p, errors = page(b, width=820, height=1100)
    p.wait_for_function("!document.documentElement.classList.contains('intro-play')", timeout=5000)
    p.wait_for_timeout(450)
    s = p.evaluate(STATE)
    check("tablet: the stacked hero is centred and the rail is away", s["cover"] and s["sidebarRight"] <= 0 and abs(s["contentMidY"] - 550) <= 3, str(s))
    if SHOTS: p.screenshot(path=f"{SHOTS}/intro-tablet.png")
    ctx.close()

    ctx, p, errors = page(b, width=390, height=844, is_mobile=True, has_touch=True)
    p.wait_for_function("!document.documentElement.classList.contains('intro-play')", timeout=5000)
    top = p.evaluate("Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom)")
    check("phone: the top bar and floating CK wait too", top <= 0 and p.eval_on_selector(".assistant-launcher", "n => getComputedStyle(n).opacity") == "0", str(top))
    check("phone: the name is not broken mid-word", p.evaluate("document.querySelector('.hero-name').scrollWidth <= document.querySelector('.hero-name').clientWidth + 1"))
    if SHOTS: p.screenshot(path=f"{SHOTS}/intro-phone.png")
    p.evaluate("document.getElementById('about').scrollIntoView({ block: 'start', behavior: 'instant' })")
    settle(p)
    check("phone: in About they are back", p.evaluate("Math.round(document.querySelector('.topbar').getBoundingClientRect().top)") == 0 and p.eval_on_selector(".assistant-launcher", "n => getComputedStyle(n).opacity") == "1")
    p.evaluate("window.scrollTo({ top: 0, behavior: 'instant' })")
    settle(p)
    check("phone: and gone again at the top", p.evaluate("Math.round(document.querySelector('.topbar').getBoundingClientRect().bottom)") <= 0)
    ctx.close()
    b.close()
finish()
