"""Contact form: under the terminal, checked before sending, emailed through the API, with a mail-app fallback."""
import json
import os
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


status = lambda p: " ".join(p.inner_text(".contact-status").split())
box = lambda p, sel: p.eval_on_selector(sel, "n => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx, p, errors = page(b)
    check("the form is shown on Home, and the terminal is not (it lives on More about me)", p.is_visible(".contact-form") and not p.is_visible(".terminal"))
    name, email = box(p, "#contact-name"), box(p, "#contact-email")
    check("name and email sit side by side on desktop", abs(name["y"] - email["y"]) < 2 and email["x"] > name["r"])
    check("the bot trap is invisible and out of the tab order", box(p, ".contact-trap")["w"] <= 1 and box(p, ".contact-trap")["h"] <= 1 and p.get_attribute("#contact-website", "tabindex") == "-1")
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-empty.png")

    p.click(".contact-send")
    check("an empty form is not sent; each field says what is missing", sent == [] and p.inner_text("#contact-name-error") != "" and p.inner_text("#contact-email-error") != "" and p.inner_text("#contact-message-error") != "")
    check("focus goes to the first problem", p.evaluate("document.activeElement.id") == "contact-name")
    p.fill("#contact-name", "Ada Recruiter")
    check("a fixed field clears its message as you type", p.inner_text("#contact-name-error") == "" and p.get_attribute("#contact-name", "aria-invalid") is None)
    p.fill("#contact-email", "ada@example")
    p.fill("#contact-message", "Hi Ken, we have an internship opening you might like.")
    p.click(".contact-send")
    check("a bad email is caught before sending", sent == [] and "look right" in p.inner_text("#contact-email-error"))
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-errors.png")

    p.fill("#contact-email", "ada@example.com")
    p.click(".contact-send")
    p.wait_for_function("document.querySelector('.contact-status').textContent.includes('Sent')")
    check("a good message is posted once, with the trap left empty", len(sent) == 1 and sent[0] == {"name": "Ada Recruiter", "email": "ada@example.com", "message": "Hi Ken, we have an internship opening you might like.", "website": ""}, str(sent))
    check("the visitor is told it was sent and where the reply will go", "ada@example.com" in status(p))
    check("the form is cleared and ready again", p.input_value("#contact-message") == "" and p.inner_text(".contact-send") == "Send" and not p.is_disabled(".contact-send"))
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-sent.png")

    mode["next"] = "down"
    p.fill("#contact-name", "Ada Recruiter"); p.fill("#contact-email", "ada@example.com"); p.fill("#contact-message", "Second try, still interested.")
    p.click(".contact-send")
    p.wait_for_selector(".contact-status a")
    href = p.get_attribute(".contact-status a", "href")
    check("if sending fails, the same message is offered through their mail app", href.startswith("mailto:charleskenneth129@gmail.com?") and "Second%20try" in href and p.input_value("#contact-message") == "Second try, still interested.", href)
    mode["next"] = "refused"
    p.click(".contact-send")
    p.wait_for_function("document.querySelector('.contact-status').textContent.includes('slightly longer')")
    check("a refusal from the server is shown in its own words", p.locator(".contact-status a").count() == 0)
    mode["next"] = "no-mail"
    p.fill("#contact-email", "ada@nosuchdomain.example")
    p.click(".contact-send")
    p.wait_for_function("document.getElementById('contact-email-error').textContent.includes('receive mail')")
    check("an address that cannot receive mail is flagged at the email field, which takes focus", p.get_attribute("#contact-email", "aria-invalid") == "true" and p.evaluate("document.activeElement.id") == "contact-email" and p.input_value("#contact-message") != "")
    p.fill("#contact-email", "ada@gmial.com")
    p.press("#contact-email", "Tab")
    check("a common typo gets a suggestion", p.is_visible(".contact-suggest") and p.inner_text(".contact-suggest") == "Did you mean ada@gmail.com?")
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-suggest.png")
    p.click(".contact-suggest")
    check("one click applies it", p.input_value("#contact-email") == "ada@gmail.com" and not p.is_visible(".contact-suggest"))
    check("no errors", not errors, "; ".join(errors))
    ctx.close()

    ctx, p, errors = page(b, 375, 812, is_mobile=True, has_touch=True)
    name, email, send = box(p, "#contact-name"), box(p, "#contact-email"), box(p, ".contact-send")
    check("phone: fields stack and the button is full width", email["y"] > name["b"] and send["w"] > 300 and p.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    check("phone: inputs are 16px so iOS does not zoom", p.eval_on_selector("#contact-email", "n => getComputedStyle(n).fontSize") == "16px")
    if SHOTS: p.locator(".contact-form").screenshot(path=f"{SHOTS}/contact-phone.png")
    ctx.close()
    b.close()
finish()
