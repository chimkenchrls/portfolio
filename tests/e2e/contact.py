"""Contact form: under the terminal, checked before sending, emailed through the API, with a mail-app fallback."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from common import URL, check, finish, offline_api

SHOTS = os.environ.get("SHOTS")
sent = []
mode = {"next": "ok"}


def api(route):
    sent.append(json.loads(route.request.post_data))
    if mode["next"] == "ok":
        route.fulfill(status=200, content_type="application/json", body='{"ok": true}')
    elif mode["next"] == "refused":
        route.fulfill(status=400, content_type="application/json", body='{"code": "INVALID_MESSAGE", "error": "Please write a slightly longer message."}')
    elif mode["next"] == "no-mail":
        route.fulfill(status=400, content_type="application/json", body='{"code": "INVALID_EMAIL", "error": "That email’s domain can’t receive mail. Please check it for typos."}')
    else:
        route.fulfill(status=502, content_type="application/json", body='{"code": "UPSTREAM_ERROR", "error": "The message could not be sent."}')


def page(b, width=1280, height=900, **opts):
    ctx = b.new_context(viewport={"width": width, "height": height}, color_scheme="dark", reduced_motion="reduce", **opts)
    offline_api(ctx)
    ctx.route("**/api/contact", api)
    ctx.route("**/github-contributions-api.jogruber.de/**", lambda r: r.abort())
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(URL); p.wait_for_load_state("networkidle")
    p.evaluate("document.querySelector('.contact-form').scrollIntoView({ block: 'center' }); 0"); p.wait_for_timeout(400)
    return ctx, p, errors


status = lambda p: " ".join(p.inner_text(".contact-form:not(.contact-placeholder) .contact-status").split())
box = lambda p, sel: p.eval_on_selector(sel, "n => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx, p, errors = page(b)
    check("the form is shown on Home, and the terminal is not (it lives on More about me)", p.is_visible(".contact-form") and not p.is_visible(".terminal"))
    name, last, email = box(p, "#contact-name"), box(p, "#contact-last-name"), box(p, "#contact-email")
    check("first and last names share a row, with email below", abs(name["y"] - last["y"]) < 2 and last["x"] > name["r"] and email["y"] > name["b"])
    check("the bot trap is invisible and out of the tab order", box(p, ".contact-form:not(.contact-placeholder) .contact-trap")["w"] <= 1 and box(p, ".contact-form:not(.contact-placeholder) .contact-trap")["h"] <= 1 and p.get_attribute("#contact-website", "tabindex") == "-1")
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-empty.png")

    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    check("an empty form is not sent; each field says what is missing", sent == [] and p.inner_text("#contact-name-error") != "" and p.inner_text("#contact-email-error") != "" and p.inner_text("#contact-message-error") != "")
    check("focus goes to the first problem", p.evaluate("document.activeElement.id") == "contact-name")
    p.fill("#contact-name", "Ada")
    p.fill("#contact-last-name", "Recruiter")
    check("a fixed field clears its message as you type", p.inner_text("#contact-name-error") == "" and p.get_attribute("#contact-name", "aria-invalid") is None)
    p.fill("#contact-email", "ada@example")
    p.fill("#contact-message", "Hi Ken, we have an internship opening you might like.")
    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    check("a bad email is caught before sending", sent == [] and "look right" in p.inner_text("#contact-email-error"))
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-errors.png")

    p.fill("#contact-email", "ada@example.com")
    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    p.wait_for_function("document.querySelector('.contact-form:not(.contact-placeholder) .contact-status').textContent.includes('Sent')")
    check("a good message is posted once, with the trap left empty", len(sent) == 1 and sent[0] == {"name": "Ada Recruiter", "email": "ada@example.com", "message": "Hi Ken, we have an internship opening you might like.", "website": ""}, str(sent))
    check("the visitor is told it was sent and where the reply will go", "ada@example.com" in status(p))
    check("the form is cleared and ready again", p.input_value("#contact-message") == "" and p.inner_text(".contact-form:not(.contact-placeholder) .contact-send") == "Send" and not p.is_disabled(".contact-form:not(.contact-placeholder) .contact-send"))
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-sent.png")

    mode["next"] = "down"
    p.fill("#contact-name", "Ada Recruiter"); p.fill("#contact-email", "ada@example.com"); p.fill("#contact-message", "Second try, still interested.")
    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    p.wait_for_selector(".contact-form:not(.contact-placeholder) .contact-status a")
    href = p.get_attribute(".contact-form:not(.contact-placeholder) .contact-status a", "href")
    check("if sending fails, the same message is offered through their mail app", href.startswith("mailto:charleskenneth129@gmail.com?") and "Second%20try" in href and p.input_value("#contact-message") == "Second try, still interested.", href)
    mode["next"] = "refused"
    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    p.wait_for_function("document.querySelector('.contact-form:not(.contact-placeholder) .contact-status').textContent.includes('slightly longer')")
    check("a refusal from the server is shown in its own words", p.locator(".contact-form:not(.contact-placeholder) .contact-status a").count() == 0)
    mode["next"] = "no-mail"
    p.fill("#contact-email", "ada@nosuchdomain.example")
    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    p.wait_for_function("document.getElementById('contact-email-error').textContent.includes('receive mail')")
    check("an address that cannot receive mail is flagged at the email field, which takes focus", p.get_attribute("#contact-email", "aria-invalid") == "true" and p.evaluate("document.activeElement.id") == "contact-email" and p.input_value("#contact-message") != "")
    p.fill("#contact-email", "ada@gmial.com")
    p.press("#contact-email", "Tab")
    check("a common typo gets a suggestion", p.is_visible(".contact-suggest") and p.inner_text(".contact-suggest") == "Did you mean ada@gmail.com?")
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-suggest.png")
    p.click(".contact-suggest")
    check("one click applies it", p.input_value("#contact-email") == "ada@gmail.com" and not p.is_visible(".contact-suggest"))

    p.fill("#contact-message", "A draft to keep when the dialog closes.")
    p.click(".sidebar-contact")
    check("sidebar Contact opens a labelled modal with the existing live form", p.is_visible(".contact-dialog[open]") and p.locator(".contact-dialog .contact-form").count() == 1 and p.locator("#contact-message").count() == 1)
    check("Home keeps a visible, inert copy while the live form is in the modal", p.is_visible("#contact > .contact-form") and p.locator("#contact > .contact-form[inert][aria-hidden=true]").count() == 1)
    check("the Home copy preserves the draft without duplicate IDs", p.input_value("#contact .contact-placeholder textarea") == "A draft to keep when the dialog closes." and p.evaluate("(() => { const ids = [...document.querySelectorAll('[id]')].map(n => n.id); return new Set(ids).size === ids.length; })()"))
    check("desktop: the close button takes focus and the draft survives", p.evaluate("document.activeElement.matches('.contact-dialog-close')") and p.input_value("#contact-message") == "A draft to keep when the dialog closes.")
    panel, sidebar, trigger = box(p, ".contact-dialog"), box(p, ".sidebar"), box(p, ".sidebar-contact")
    check("desktop: the modal sits beside the sidebar, aligned to Contact", abs(panel["x"] - sidebar["r"] - 12) < 1 and abs(panel["y"] - trigger["y"]) < 1, str((panel, sidebar, trigger)))
    if SHOTS: p.locator(".contact-dialog").screenshot(path=f"{SHOTS}/contact-modal-dark.png")
    p.evaluate("document.documentElement.setAttribute('data-theme', 'light')")
    if SHOTS: p.locator(".contact-dialog").screenshot(path=f"{SHOTS}/contact-modal-light.png")
    if SHOTS: p.screenshot(path=f"{SHOTS}/contact-beside-sidebar.png")
    p.evaluate("document.documentElement.setAttribute('data-theme', 'dark')")
    p.set_viewport_size({"width": 1280, "height": 420})
    p.wait_for_function("document.querySelector('.contact-dialog').getBoundingClientRect().bottom <= innerHeight - 15")
    panel = box(p, ".contact-dialog")
    check("a short window keeps the anchored modal fully on screen", panel["y"] >= 15 and panel["b"] <= 405, str(panel))
    p.set_viewport_size({"width": 1280, "height": 900})
    p.focus(".contact-dialog-close")
    p.keyboard.press("Shift+Tab")
    check("Tab stays within the contact modal", p.evaluate("!!document.activeElement.closest('.contact-dialog')"))
    p.keyboard.press("Tab")
    check("Tab wraps back to the close button", p.evaluate("document.activeElement.matches('.contact-dialog-close')"))
    p.keyboard.press("Escape")
    check("Escape restores the form, its draft and the opener's focus", not p.locator(".contact-dialog[open]").count() and p.locator("#contact > .contact-form").count() == 1 and p.input_value("#contact-message") == "A draft to keep when the dialog closes." and p.evaluate("document.activeElement.matches('.sidebar-contact')"))
    p.click(".sidebar-contact")
    p.mouse.click(5, 5)
    check("clicking the backdrop closes the modal", not p.locator(".contact-dialog[open]").count())
    for view in ("more", "projects", "stack", "links", "blog"):
        p.goto(URL.split("#")[0] + "?view=" + view, wait_until="domcontentloaded")
        p.click(".sidebar-contact")
        check(f"Contact works on the {view} page", p.is_visible(".contact-dialog .contact-form") and p.is_visible("#contact-message"))
        p.click(".contact-dialog-close")
    p.click(".sidebar-contact")
    mode["next"] = "ok"
    before = len(sent)
    p.fill("#contact-name", "Ada")
    p.fill("#contact-last-name", "Recruiter")
    p.fill("#contact-email", "ada@example.com")
    p.fill("#contact-message", "A message sent from the contact modal.")
    p.fill("#contact-name", "")
    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    check("a last name alone still asks for a first name before sending", len(sent) == before and "first name" in p.inner_text("#contact-name-error"))
    p.fill("#contact-name", "Ada")
    p.click(".contact-form:not(.contact-placeholder) .contact-send")
    p.wait_for_function("document.querySelector('.contact-form:not(.contact-placeholder) .contact-status').textContent.includes('Sent')")
    check("the modal sends once and joins both names for the existing endpoint", len(sent) == before + 1 and sent[-1]["name"] == "Ada Recruiter" and sent[-1]["message"] == "A message sent from the contact modal.")
    check("no errors", not errors, "; ".join(errors))
    ctx.close()

    ctx, p, errors = page(b, 375, 812, is_mobile=True, has_touch=True)
    name, email, send = box(p, "#contact-name"), box(p, "#contact-email"), box(p, ".contact-form:not(.contact-placeholder) .contact-send")
    check("phone: fields stack and the button is full width", email["y"] > name["b"] and send["w"] > 300 and p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    check("phone: inputs are 16px so iOS does not zoom", p.eval_on_selector("#contact-email", "n => getComputedStyle(n).fontSize") == "16px")
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-phone.png")
    p.click(".menu-toggle")
    p.click(".sidebar-contact")
    check("phone: Contact closes the drawer and opens the form", p.is_visible(".contact-dialog[open]") and not p.locator("body.drawer-open").count() and p.is_visible("#contact-message"))
    check("phone: it fits the viewport and waits to open the keyboard", p.evaluate("document.querySelector('.contact-dialog').getBoundingClientRect().width <= innerWidth - 24") and p.evaluate("document.activeElement.matches('.contact-dialog-close')"))
    panel = box(p, ".contact-dialog")
    check("phone: the modal stays centered", abs(panel["x"] + panel["w"] / 2 - 187.5) < 1 and not p.locator(".contact-dialog[data-anchored]").count(), str(panel))
    if SHOTS: p.locator(".contact-dialog").screenshot(path=f"{SHOTS}/contact-modal-phone.png")
    p.click(".contact-dialog-close")
    check("phone: closing restores focus to the menu button", p.evaluate("document.activeElement.matches('.menu-toggle')") and not p.locator("body.contact-open").count())
    ctx.close()

    ctx = b.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    offline_api(ctx)
    data_file = Path("/site/assets/data.js")  # Read-only source mount in run.sh.
    if not data_file.is_file():
        data_file = Path(__file__).resolve().parents[2] / "assets/data.js"
    data = data_file.read_text()
    data = data.replace('endpoint: "https://kenchrls-api.kenchrls.workers.dev/api/contact"', 'endpoint: null')
    ctx.route("**/assets/data.js", lambda r: r.fulfill(content_type="text/javascript", body=data))
    p = ctx.new_page()
    p.goto(URL, wait_until="domcontentloaded")
    p.click(".sidebar-contact")
    check("without a contact endpoint, the modal offers a direct email link", p.is_visible(".contact-dialog-fallback a") and p.get_attribute(".contact-dialog-fallback a", "href").startswith("mailto:") and not p.is_visible(".contact-form"))
    ctx.close()
    b.close()
finish()
