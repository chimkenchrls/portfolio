"""The big footer: on every page, holding CK's extras; the page lifts off it when it fits."""
import datetime
from playwright.sync_api import sync_playwright
from common import check, finish, new_page

BASE = "http://localhost:8000/"
LINKS = ["HOME", "PROJECTS", "STACK", "RESOURCES", "MORE", "LINKS", "GUESTBOOK"]

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for where in ("", "?view=stack", "?view=resume"):
        ctx, p, errors = new_page(b, 1280, 900, url=BASE + where, reduced_motion="reduce")
        f = p.locator("footer.footer")
        label = where or "home"
        check(f"{label}: one footer", f.count() == 1)
        check(f"{label}: the poke CK and his count", f.locator(".poke-button").count() == 1 and f.locator(".poke-value").count() == 1)
        check(f"{label}: an arrow back to the top", f.locator("a.footer-top").count() == 1)
        check(f"{label}: name, big email with a copy button", "Kenneth Charles Valdez" in f.locator(".footer-name").text_content()
              and f.locator(".footer-email a[href^='mailto:']").text_content().strip() == "charleskenneth129@gmail.com"
              and f.locator(".footer-email [data-copy]").count() == 1)
        small = [t.strip().lower() for t in f.locator(".footer-links a").all_inner_texts()]
        check(f"{label}: GitHub · LinkedIn · Résumé", small == ["github", "linkedin", "résumé"], str(small))
        pages = [t.strip().upper() for t in f.locator(".footer-nav a").all_inner_texts()]
        check(f"{label}: the page list", pages[:7] == LINKS, str(pages))
        check(f"{label}: chat, chimken, score row and theme toggle", f.locator("[data-chat]").count() == 1 and f.locator(".game-trigger").count() == 1
              and f.locator(".score-row").count() == 1 and f.locator(".theme-toggle").count() == 1)
        text = " ".join(f.text_content().split())
        check(f"{label}: © year and the location with the time", f"© {datetime.date.today().year} Kenneth Charles" in text and "Sariaya, Quezon, Philippines" in text and "GMT+8" in text
              and f.locator(".footer-clock").inner_text().strip() != "", text[-200:])
        check(f"{label}: no phone number anywhere", p.locator("a[href^='tel:']").count() == 0)
        check(f"{label}: CK's old menu is gone", p.locator(".ck-panel").count() == 0)
        check(f"{label}: no errors", not errors, str(errors))
        ctx.close()

    # Using it.
    ctx, p, errors = new_page(b, 1280, 900, url=BASE + "?view=links")
    p.evaluate("scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})"); p.wait_for_timeout(300)
    p.click("footer .poke-button"); p.wait_for_timeout(200)
    check("a poke gets a reaction", p.locator("footer .poke-emote").count() >= 1)
    p.click("footer [data-chat]"); p.wait_for_timeout(400)
    check("Chat with me opens the chat", p.locator(".assistant-dialog[open]").count() == 1)
    p.keyboard.press("Escape"); p.wait_for_timeout(400)
    check("and closing it gives focus back to that button", p.evaluate("document.activeElement.matches('footer [data-chat]')"))
    theme = p.evaluate("document.documentElement.dataset.theme")
    p.click("footer .theme-toggle"); p.wait_for_timeout(700)
    check("the theme toggle flips the theme", p.evaluate("document.documentElement.dataset.theme") != theme)
    p.click("footer .footer-nav a[data-view='guestbook']")
    p.wait_for_function("document.documentElement.classList.contains('view-guestbook')")
    check("its page links open in place", True)
    p.evaluate("scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})"); p.wait_for_timeout(200)
    p.click("footer a.footer-top"); p.wait_for_timeout(900)
    check("the arrow goes back to the top", p.evaluate("scrollY") < 5, str(p.evaluate("scrollY")))
    check("using it: no errors", not [e for e in errors if "Failed to load resource" not in e], str(errors))
    ctx.close()

    # The page lifts off it when it fits; an ordinary footer otherwise.
    ctx, p, errors = new_page(b, 1280, 900)
    check("1280×900: the footer fits, so the page lifts off it", p.evaluate("document.documentElement.classList.contains('footer-reveal') && getComputedStyle(document.querySelector('footer.footer')).position === 'fixed'"))
    p.evaluate("scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})"); p.wait_for_timeout(300)
    box = p.evaluate("(() => { const r = document.querySelector('footer.footer').getBoundingClientRect(); return [r.top, r.bottom]; })()")
    check("at the very bottom the whole footer shows", box[0] >= 0 and box[1] <= 900, str(box))
    hit = p.evaluate("(() => { const a = document.querySelector('footer .footer-nav a'); const r = a.getBoundingClientRect(); return a.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })()")
    check("and its links can be clicked", hit)
    p.evaluate("scrollTo({top: 0, behavior: 'instant'})"); p.wait_for_timeout(200)
    hidden = p.evaluate("(() => { const a = document.querySelector('footer .footer-nav a'); const r = a.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !e || !a.contains(e); })()")
    check("at the top of the page the footer is covered", hidden)
    ctx.close()
    for width, height, mobile, fits in ((390, 844, True, None), (1366, 650, False, None), (1280, 420, False, False)):
        ctx, p, errors = new_page(b, width, height, is_mobile=mobile, has_touch=mobile)
        if fits is False:
            check(f"{width}×{height}: the footer does not fit, so it is ordinary", not p.evaluate("document.documentElement.classList.contains('footer-reveal')"))
        p.evaluate("scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})"); p.wait_for_timeout(300)
        links = p.locator("footer a, footer button")
        ok = []
        for i in range(links.count()):
            node = links.nth(i)
            if not node.is_visible():
                continue
            if fits is False:
                node.scroll_into_view_if_needed()
            ok.append(node.evaluate("n => { const r = n.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && n.contains(e); }"))
        check(f"{width}×{height}: every footer control can be clicked", ok and all(ok), str(ok))
        check(f"{width}×{height}: no sideways scroll", p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        ctx.close()
    ctx, p, errors = new_page(b, 1280, 900, reduced_motion="reduce")
    check("reduced motion: an ordinary footer", not p.evaluate("document.documentElement.classList.contains('footer-reveal')"))
    ctx.close()
    b.close()
finish()
