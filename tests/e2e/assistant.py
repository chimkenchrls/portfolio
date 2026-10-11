"""Portfolio assistant: launcher opens the dialogue with pixel CK, replies and errors are handled, phones get a full-screen chat.

Chat requests are intercepted, so no Gemini key or Node server is needed."""
import json
import os
from playwright.sync_api import sync_playwright
from common import URL, check, finish

SHOTS = os.environ.get("SHOTS")
calls = []
mode = {"next": "ok"}


def answer(route):
    body = json.loads(route.request.post_data)
    calls.append(body)
    if mode["next"] == "off":
        route.fulfill(status=503, content_type="application/json", body=json.dumps({"code": "NOT_CONFIGURED", "error": "Live chat is not connected yet."}))
    else:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"reply": f"Reply {len(calls)} about Kenneth."}))


def open_page(b, width=1280, height=900, **opts):
    ctx = b.new_context(viewport={"width": width, "height": height}, **opts)
    ctx.route("**/api/chat", answer)
    ctx.route("**/github-contributions-api.jogruber.de/**", lambda r: r.abort())
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    # A failed request logs a console error by design (the 503 case below).
    p.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ERR_FAILED" not in m.text and "503" not in m.text else None)
    p.goto(URL); p.wait_for_load_state("networkidle")
    return ctx, p, errors


box = lambda p, sel: p.eval_on_selector(sel, "n => { const r = n.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; }")
messages = lambda p: p.locator(".assistant-message").count()
said = lambda p: " ".join(p.inner_text(".assistant-say").split())
settled = "!document.querySelector('.assistant-say').classList.contains('is-typing') && !document.querySelector('.assistant-say').hidden"
face = lambda p: p.eval_on_selector(".assistant-character .assistant-sprite", "n => (n.classList.contains('is-reacting') ? 'r' : 'd') + n.style.backgroundPosition")

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # Desktop -----------------------------------------------------------------
    ctx, p, errors = open_page(b)
    check("launcher is shown with its label", p.is_visible(".assistant-launcher") and p.inner_text(".assistant-bubble").strip() != "")
    launcher = box(p, ".assistant-launcher")
    check("launcher sits in the lower-right corner", launcher["r"] > 1280 - 60 and launcher["b"] > 900 - 60, str(launcher))
    sprite = p.eval_on_selector(".assistant-launcher .assistant-sprite", "n => getComputedStyle(n).backgroundImage")
    check("launcher draws the character sprite", "mini-ck" in sprite, sprite)
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-launcher.png")

    p.click(".assistant-launcher")
    p.wait_for_selector(".assistant-dialog[open]")
    check("the greeting types itself out the first time", p.evaluate("document.querySelector('.assistant-say').classList.contains('is-typing')"))
    p.wait_for_function(settled)
    greeting = said(p)
    check("CK greets in the first person", "I’m CK" in greeting and "my projects" in greeting, greeting)
    p.wait_for_timeout(300)
    character, speech, dialog, form = box(p, ".assistant-character"), box(p, ".assistant-speech"), box(p, ".assistant-dialog"), box(p, ".assistant-form")
    check("CK stands to the left of his speech bubble", character["r"] <= speech["x"] and character["w"] >= 160, f"{character} {speech}")
    check("he leans on the line above the question box", abs(character["b"] - form["y"]) <= 1, f"{character} {form}")
    check("the dialog is centred in the window", abs((dialog["x"] + dialog["r"]) / 2 - 640) <= 1 and abs((dialog["y"] + dialog["b"]) / 2 - 450) <= 1, str(dialog))
    check("there is no footer note or pause control", p.locator(".assistant-foot, .assistant-privacy, .assistant-motion").count() == 0)
    check("dialog fits inside the window", dialog["x"] >= 0 and dialog["y"] >= 0 and dialog["r"] <= 1280 and dialog["b"] <= 900, str(dialog))
    check("one column: the dialog is narrower than the old split panel", dialog["w"] <= 720, str(dialog))
    check("the transcript starts empty", messages(p) == 0)
    check("the title is Chat with me", p.inner_text("#assistant-title").strip() == "Chat with me")
    check("typing starts in the question box", p.evaluate("document.activeElement.id") == "assistant-input")
    check("send is disabled until there is a question", p.is_disabled(".assistant-send"))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-open.png")

    theme = p.evaluate("document.documentElement.dataset.theme")
    p.keyboard.type("t1")
    check("page shortcuts are off while typing in the chat", p.evaluate("document.documentElement.dataset.theme") == theme and p.input_value("#assistant-input") == "t1")
    p.fill("#assistant-input", "")

    p.route("**/api/chat", lambda r: (p.wait_for_timeout(900), answer(r)))
    p.click(".assistant-suggestion >> nth=0")
    p.wait_for_selector(".assistant-dots:not([hidden])")
    check("he looks surprised, then thinks while the reply loads", face(p) == "r0% 50%", face(p))
    p.wait_for_timeout(650)
    check("thinking: eyes down, three dots in the bubble", face(p).startswith("d") and face(p).endswith("100%"), face(p))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-thinking.png")
    p.wait_for_function(settled)
    p.unroute("**/api/chat")
    check("a suggestion sends one question", len(calls) == 1 and [m["role"] for m in calls[0]["messages"]] == ["user"], str(calls))
    check("the reply is CK's speech bubble", said(p) == "Reply 1 about Kenneth.", said(p))
    check("the greeting and the question move up into the transcript", messages(p) == 2 and greeting in " ".join(p.inner_text(".assistant-log").split()))
    check("he grins when the answer is out", face(p) == "r100% 50%", face(p))
    check("suggestions hide after the first question", not p.is_visible(".assistant-suggestions"))
    grown = box(p, ".assistant-dialog")
    check("it stays centred as the talk grows", abs((grown["y"] + grown["b"]) / 2 - 450) <= 1, str(grown))

    p.fill("#assistant-input", "Tell me more")
    p.keyboard.press("Enter")
    p.wait_for_function(f"{settled} && document.querySelectorAll('.assistant-message').length === 4")
    check("a follow-up carries the earlier turn", [m["role"] for m in calls[-1]["messages"]] == ["user", "assistant", "user"], str(calls[-1]))
    check("the question box clears after sending", p.input_value("#assistant-input") == "")
    check("the announcement for screen readers is the whole reply", p.inner_text(".assistant-status") == "Reply 2 about Kenneth.")
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-chat.png")

    mode["next"] = "off"
    p.fill("#assistant-input", "Is chat connected?")
    p.keyboard.press("Enter")
    p.wait_for_selector(".assistant-recovery:not([hidden])")
    check("an unconnected server is explained in his voice, with a way out", "connected" in said(p) and "email me" in said(p) and p.get_attribute(".assistant-email", "href").startswith("mailto:"), said(p))
    check("he raises an eyebrow at the error", face(p) == "r50% 100%", face(p))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-error.png")
    mode["next"] = "ok"
    before = messages(p)
    p.click(".assistant-retry")
    p.wait_for_function(f"{settled} && !document.querySelector('.assistant-form').matches('[aria-busy=true]')")
    check("retry resends the question without repeating it on screen", calls[-1]["messages"][-1]["text"] == "Is chat connected?" and messages(p) == before and not p.is_visible(".assistant-recovery"))
    check("a failed turn is not kept in the history", [m["role"] for m in calls[-1]["messages"]] == ["user", "assistant", "user", "assistant", "user"], str(calls[-1]))
    check("the error itself never enters the transcript", "connected yet" not in p.inner_text(".assistant-log"))

    long = "Long answer. " * 300
    p.route("**/api/chat", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"reply": long})))
    p.fill("#assistant-input", "Tell me everything")
    p.keyboard.press("Enter")
    p.wait_for_selector(".assistant-say.is-typing")
    p.click(".assistant-say")
    check("a click on the bubble skips the typing", said(p) == long.strip() and not p.evaluate("document.querySelector('.assistant-say').classList.contains('is-typing')"))
    stuck = box(p, ".assistant-character")
    check("CK stays in view beside a long answer", abs(stuck["b"] - box(p, ".assistant-form")["y"]) <= 1, str(stuck))
    check("a long answer scrolls inside the dialog", box(p, ".assistant-dialog")["h"] <= 680 and p.evaluate("(() => { const s = document.querySelector('.assistant-scene'); return s.scrollHeight > s.clientHeight; })()"))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-long.png")
    p.unroute("**/api/chat")
    before = messages(p)

    p.keyboard.press("Escape")
    p.wait_for_function("!document.body.classList.contains('assistant-open')")
    check("Escape closes the chat and focus returns to the launcher", p.evaluate("document.activeElement.classList.contains('assistant-launcher')"))
    check("the page scrolls again after closing", not p.evaluate("document.body.classList.contains('assistant-open')"))
    p.click(".assistant-launcher")
    p.wait_for_selector(".assistant-dialog[open]")
    check("the conversation is still there when reopened", messages(p) == before and said(p) == long.strip())
    check("no console errors on desktop", not errors, "; ".join(errors))
    ctx.close()

    # Dark theme ---------------------------------------------------------------
    ctx, p, errors = open_page(b, color_scheme="dark")
    p.click(".assistant-launcher")
    p.wait_for_selector(".assistant-dialog[open]")
    p.wait_for_function(settled)
    p.click(".assistant-suggestion >> nth=1")
    p.wait_for_function(f"{settled} && document.querySelectorAll('.assistant-message').length === 2")
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-dark.png")
    ctx.close()

    # Phone --------------------------------------------------------------------
    ctx, p, errors = open_page(b, 375, 812, has_touch=True, is_mobile=True)
    check("launcher is shown on phones", p.is_visible(".assistant-launcher"))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-phone-launcher.png")
    p.tap(".assistant-launcher")
    p.wait_for_selector(".assistant-dialog[open]")
    p.wait_for_function(settled)
    p.wait_for_timeout(300)
    dialog, character, speech = box(p, ".assistant-dialog"), box(p, ".assistant-character"), box(p, ".assistant-speech")
    check("on phones the chat is a sheet on the bottom edge", dialog["w"] == 375 and abs(dialog["b"] - 812) <= 1 and 0 < dialog["y"] and dialog["h"] < 520, str(dialog))
    check("no empty gap above CK", character["y"] - box(p, ".assistant-header")["b"] < 80, str(character))
    check("a smaller CK stands beside his bubble", character["w"] <= 104 and character["r"] <= speech["x"] and speech["r"] <= 375, f"{character} {speech}")
    check("the keyboard stays closed until the visitor taps the box", p.evaluate("document.activeElement.id") != "assistant-input")
    check("nothing overflows sideways", p.evaluate("document.querySelector('.assistant-dialog').scrollWidth") <= 375)
    form = box(p, ".assistant-form")
    check("the question box is on screen", form["b"] <= 812 and form["x"] >= 0 and form["r"] <= 375, str(form))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-phone-open.png")
    p.tap(".assistant-suggestion >> nth=1")
    p.wait_for_function(f"{settled} && document.querySelectorAll('.assistant-message').length === 2")
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-phone-chat.png")
    for n in range(4):
        p.fill("#assistant-input", f"Question {n} that is long enough to wrap onto a second line on a phone")
        p.tap(".assistant-send")
        p.wait_for_function(f"{settled} && document.querySelectorAll('.assistant-message').length === {4 + 2 * n}")
    sheet = box(p, ".assistant-dialog")
    check("a long talk tops out below the status bar and scrolls", sheet["y"] >= 16 and abs(sheet["b"] - 812) <= 1 and box(p, ".assistant-form")["b"] <= 812, str(sheet))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-phone-long.png")
    p.tap(".assistant-close")
    p.wait_for_function("!document.body.classList.contains('assistant-open')")
    check("the close button works on phones", not p.is_visible(".assistant-dialog"))
    check("no console errors on phones", not errors, "; ".join(errors))
    ctx.close()

    # Reduced motion -----------------------------------------------------------
    ctx, p, errors = open_page(b, reduced_motion="reduce")
    p.click(".assistant-launcher")
    p.wait_for_selector(".assistant-dialog[open]")
    check("the greeting is simply there, not typed", "I’m CK" in said(p) and not p.evaluate("document.querySelector('.assistant-say').classList.contains('is-typing')"))
    first = face(p)
    p.mouse.move(200, 200)
    p.wait_for_timeout(2600)
    check("the character holds still under reduced motion", face(p) == first, f"{first} -> {face(p)}")
    p.click(".assistant-suggestion >> nth=0")
    p.wait_for_function(f"{settled} && document.querySelectorAll('.assistant-message').length === 2")
    check("the answer appears at once and he holds a grin", "Reply" in said(p) and face(p) == "r100% 50%", face(p))
    ctx.close()
    b.close()
finish()
