"""The notch: CK is Home on desktop; on phones he opens a full-screen menu."""
from playwright.sync_api import sync_playwright
from common import check, finish, new_page

BASE = "http://localhost:8000/"

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # Desktop: Projects · Stack · [CK] · Resources · More; CK goes home.
    ctx, p, errors = new_page(b, url=BASE + "?view=stack")
    order = p.evaluate("[...document.querySelectorAll('.notch .notch-side .nav-link')].map(n => n.dataset.notch)")
    check("desktop: the notch sides read Projects, Stack | Resources, More", order == ["projects", "stack", "resources", "more"], str(order))
    check("desktop: CK is a link home", p.evaluate("document.querySelector('.notch-ck').matches('a[href=\"./\"]')"))
    p.click(".notch-ck")
    p.wait_for_function("document.documentElement.classList.contains('is-home')")
    check("desktop: clicking CK goes Home and he is lit", p.evaluate("document.querySelector('.notch-ck').matches('[aria-current]')"))
    check("desktop: no menu opens", p.locator(".phone-menu[open]").count() == 0)
    p.hover(".notch-ck"); p.click('.notch .nav-link[data-notch="resources"]')
    p.wait_for_function("document.documentElement.classList.contains('view-resources')")
    check("desktop: Resources lights its own link", p.evaluate("[...document.querySelectorAll('.notch [aria-current]')].map(n => n.dataset.notch)") == ["resources"])
    # Hovering a link rolls its letters up instead of lighting a white pill.
    link = '.notch .nav-link[data-notch="projects"]'
    p.hover(".notch-ck"); p.wait_for_timeout(400)
    p.hover(link); p.wait_for_timeout(700)
    check("desktop: a hovered notch link gets no pill", p.eval_on_selector(link, "n => { const s = getComputedStyle(n); return s.backgroundImage === 'none' && s.boxShadow === 'none' && s.backgroundColor === 'rgba(0, 0, 0, 0)'; }"))
    letters = p.eval_on_selector_all(link + " .roll > span", "ns => ns.map(n => [n.textContent, getComputedStyle(n).translate])")
    check("desktop: its letters roll up, every one of them", "".join(t for t, _ in letters) == "Projects" and all(tr not in ("none", "0px") for _, tr in letters), str(letters))
    check("desktop: screen readers still hear the word", p.eval_on_selector(link, "n => n.getAttribute('aria-label')") == "Projects" and p.eval_on_selector(link + " .roll", "n => n.getAttribute('aria-hidden')") == "true")
    p.mouse.move(640, 500); p.wait_for_timeout(700)
    check("desktop: and roll back when the cursor leaves", all(tr in ("none", "0px") for tr in p.eval_on_selector_all(link + " .roll > span", "ns => ns.map(n => getComputedStyle(n).translate)")))
    check("desktop: no errors", not errors, str(errors))
    ctx.close()

    # A first visit opens light, whatever the system prefers; a choice made with the toggle is remembered.
    theme = lambda p: p.evaluate("document.documentElement.getAttribute('data-theme')")
    for scheme in ("light", "dark"):
        ctx, p, errors = new_page(b, color_scheme=scheme, first_visit=True)
        check(f"a first visit on a {scheme} system opens light", theme(p) == "light", theme(p))
        ctx.close()
    ctx, p, errors = new_page(b, color_scheme="light", first_visit=True)
    p.emulate_media(color_scheme="dark"); p.wait_for_timeout(100)
    check("the system changing does not change the theme", theme(p) == "light", theme(p))
    p.evaluate("document.querySelector('.footer .theme-toggle').click()"); p.wait_for_timeout(600)
    check("the toggle switches to dark", theme(p) == "dark", theme(p))
    p.reload(); p.wait_for_load_state("networkidle")
    check("and the choice is remembered", theme(p) == "dark", theme(p))
    check("theme: no errors", not errors, str(errors))
    ctx.close()

    # Phone: CK opens the menu.
    ctx, p, errors = new_page(b, 390, 844, url=BASE + "?view=links", is_mobile=True, has_touch=True)
    is_open = lambda: p.locator(".phone-menu[open]").count() == 1
    p.tap(".notch-ck")
    p.wait_for_timeout(400)
    check("phone: tapping CK opens the menu", is_open())
    words = p.evaluate("[...document.querySelectorAll('.phone-menu-pages a')].map(n => n.textContent.trim().toUpperCase())")
    check("phone: five pages in the menu", words == ["HOME", "PROJECTS", "STACK", "RESOURCES", "MORE"], str(words))
    check("phone: Get in touch, Chat with CK, the email and a copy button",
          p.locator(".phone-menu a", has_text="Get in touch").count() == 1
          and p.locator(".phone-menu [data-chat]", has_text="Chat with CK").count() == 1
          and p.locator(".phone-menu a[href^='mailto:']").count() == 1
          and p.locator(".phone-menu [data-copy]").count() == 1)
    check("phone: no phone number", p.locator("a[href^='tel:']").count() == 0)
    p.keyboard.press("Escape"); p.wait_for_timeout(400)
    check("phone: Escape closes it and focus returns to CK", not is_open() and p.evaluate("document.activeElement.matches('.notch-ck')"))
    p.tap(".notch-ck"); p.wait_for_timeout(400)
    p.tap(".phone-menu-close"); p.wait_for_timeout(400)
    check("phone: the × closes it", not is_open())
    p.tap(".notch-ck"); p.wait_for_timeout(400)
    inside = []
    for _ in range(12):
        p.keyboard.press("Tab")
        inside.append(p.evaluate("!!document.activeElement.closest('.phone-menu')"))
    check("phone: Tab stays inside the menu", all(inside), str(inside))
    p.tap(".phone-menu-pages a[data-notch='stack']")
    p.wait_for_function("document.documentElement.classList.contains('view-stack')")
    p.wait_for_timeout(400)
    check("phone: choosing a page closes the menu and opens it", not is_open())
    p.tap(".notch-ck"); p.wait_for_timeout(400)
    check("phone: the menu marks the current page", p.evaluate("document.querySelector('.phone-menu-pages [aria-current]')?.dataset.notch") == "stack")
    p.tap(".phone-menu [data-chat]"); p.wait_for_timeout(400)
    check("phone: Chat with CK opens the chat", p.locator(".assistant-dialog[open]").count() == 1 and not is_open())
    check("phone: no errors", not errors, str(errors))
    ctx.close()

    # Phone: CK on stage — big, pokeable, sharing the footer's count; everything fits.
    for width, height in ((390, 844), (320, 568)):
        ctx, p, errors = new_page(b, width, height, url=BASE + "?view=links", is_mobile=True, has_touch=True)
        p.tap(".notch-ck"); p.wait_for_timeout(500)
        ck = p.evaluate("(() => { const r = document.querySelector('.phone-menu-poke .assistant-sprite').getBoundingClientRect(); return [r.width, r.height]; })()")
        check(f"{width}×{height}: CK stands on the stage at his real shape", ck[0] >= 72 and abs(ck[0] - ck[1]) < 1, str(ck))
        lines = p.evaluate("[...document.querySelectorAll('.phone-menu-actions .btn')].map(n => { const r = document.createRange(); r.selectNodeContents(n); return r.getClientRects().length; })")
        check(f"{width}×{height}: Get in touch and Chat with CK each fit on one line", lines and all(n == 1 for n in lines), str(lines))
        fits = p.evaluate("[...document.querySelectorAll('.phone-menu button, .phone-menu a')].every(n => { const r = n.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })")
        check(f"{width}×{height}: everything in the menu is on screen", fits)
        if width == 390:
            saved = lambda: p.evaluate("Number(localStorage.getItem('ck-pokes') || 0)")
            before = saved()
            p.tap(".phone-menu-poke"); p.wait_for_timeout(250)
            shown = p.evaluate("[document.querySelector('.phone-menu .poke-value').textContent, document.querySelector('footer .poke-value').textContent]")
            check("phone: poking CK in the menu counts, shown the same as in the footer", saved() == before + 1 and shown[0] == shown[1], f"{before} -> {saved()}, {shown}")
            check("phone: and he reacts", p.locator(".phone-menu-poke .poke-emote").count() == 1)
            check("phone: poking him keeps the menu open", p.locator(".phone-menu[open]").count() == 1)
        check(f"{width}×{height}: no errors", not errors, str(errors))
        ctx.close()

    # Reduced motion: it simply appears.
    ctx, p, errors = new_page(b, 390, 844, url=BASE + "?view=links", is_mobile=True, has_touch=True, reduced_motion="reduce")
    p.tap(".notch-ck")
    check("reduced motion: the menu is fully shown at once", p.evaluate("getComputedStyle(document.querySelector('.phone-menu')).opacity") == "1")
    ctx.close()

    # The theme toggle: also in the poster's bottom row (desktop) and in the phone menu.
    THEME = "document.documentElement.dataset.theme"
    LABELS = "[...document.querySelectorAll('.theme-toggle')].map(n => n.getAttribute('aria-label'))"
    ctx, p, errors = new_page(b, 1280, 800, url=BASE, reduced_motion="reduce")
    check("desktop: no theme toggle hangs in the frame's corner", p.locator(".theme-corner").count() == 0)
    hero = p.eval_on_selector(".poster-meta .theme-toggle", "n => { const r = n.getBoundingClientRect(), s = document.querySelector('.poster-meta .social').getBoundingClientRect(); return { x: r.left, gap: r.left - s.right, mid: r.top + r.height / 2, smid: s.top + s.height / 2 }; }")
    check("desktop: the poster's bottom row ends with a theme toggle, just after the links", p.is_visible(".poster-meta .theme-toggle") and 0 <= hero["gap"] <= 32 and abs(hero["mid"] - hero["smid"]) <= 3, str(hero))
    before = p.evaluate(THEME)
    p.click(".poster-meta .theme-toggle")
    labels = p.evaluate(LABELS)
    check("desktop: it switches the theme, and every toggle says what comes next", p.evaluate(THEME) != before and len(labels) == 3 and len(set(labels)) == 1, f"{before} {labels}")
    check("desktop theme toggle: no errors", not errors, str(errors))
    ctx.close()

    ctx, p, errors = new_page(b, 390, 844, url=BASE + "?view=links", is_mobile=True, has_touch=True, reduced_motion="reduce")
    p.goto(BASE); p.wait_for_timeout(300)
    check("phone: the poster has no toggle of its own (the menu has one)", not p.is_visible(".poster-meta .theme-toggle"))
    p.tap(".notch-ck"); p.wait_for_timeout(300)
    box = p.eval_on_selector(".phone-menu .theme-toggle", "n => { const r = n.getBoundingClientRect(); return { x: r.left, w: r.width, h: r.height }; }")
    close = p.eval_on_selector(".phone-menu-close", "n => n.getBoundingClientRect().top")
    toggle_top = p.eval_on_selector(".phone-menu .theme-toggle", "n => n.getBoundingClientRect().top")
    check("phone menu: a theme toggle at the top left, across from the ×, easy to tap", box["x"] < 60 and box["w"] >= 44 and box["h"] >= 44 and abs(toggle_top - close) <= 1, f"{box} {toggle_top} {close}")
    before = p.evaluate(THEME)
    p.tap(".phone-menu .theme-toggle"); p.wait_for_timeout(100)
    check("phone menu: tapping it switches the theme and the menu stays open", p.evaluate(THEME) != before and p.locator(".phone-menu[open]").count() == 1)
    check("phone theme toggle: no errors", not errors, str(errors))
    ctx.close()
    b.close()
finish()
