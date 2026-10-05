"""Phone polish: no blue tap highlight anywhere, taps still give feedback."""
from playwright.sync_api import sync_playwright
from common import check, finish, new_page

TAPPABLE = [
    ".topbar-brand", ".yard-chimken", ".menu-toggle", ".nav-link", ".game-trigger", ".copy-email",
    ".theme-toggle", ".hero-photo", ".btn-primary", ".social a", ".social-copy", ".github-user",
    ".deck", ".terminal-link", ".terminal-input", ".terminal-run", ".terminal-chip", ".game-close", ".game-canvas",
]
CLEAR = ("rgba(0, 0, 0, 0)", "transparent")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx, p, errors = new_page(b, 375, 812, has_touch=True, is_mobile=True, reduced_motion="reduce")
    p.wait_for_timeout(600)
    missing, blue = [], []
    for selector in TAPPABLE:
        if p.locator(selector).count() == 0:
            missing.append(selector)
            continue
        color = p.eval_on_selector(selector, "n => getComputedStyle(n).webkitTapHighlightColor")
        if color not in CLEAR:
            blue.append(f"{selector}: {color}")
    check("every tappable element exists", not missing, str(missing))
    check("no blue tap highlight on any tappable element", not blue, "; ".join(blue))
    anything = p.evaluate("""() => [...document.querySelectorAll('a, button, input, [tabindex], label, summary')]
        .filter(n => !['rgba(0, 0, 0, 0)', 'transparent'].includes(getComputedStyle(n).webkitTapHighlightColor))
        .map(n => n.className || n.tagName).slice(0, 8)""")
    check("no interactive element at all keeps the default highlight", anything == [], str(anything))
    pressed = p.evaluate("""() => [...document.styleSheets].some(sheet => { try { return [...sheet.cssRules].some(r => /\(hover: none\)/.test(r.conditionText || '') && /:active/.test(r.cssText)); } catch (e) { return false; } })""")
    check("taps still give feedback (a touch-only :active style exists)", pressed)
    outline = p.evaluate("""() => [...document.styleSheets].some(sheet => { try { return [...sheet.cssRules].some(r => (r.selectorText || '').trim() === ':focus-visible' && /outline/.test(r.cssText)); } catch (e) { return false; } })""")
    check("keyboard focus outline is kept", outline)
    check("no console errors", not errors, "; ".join(errors))
    ctx.close()
    b.close()
finish()
