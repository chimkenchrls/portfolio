"""Portfolio assistant: CK's menu opens the dialogue with pixel CK, replies and errors are handled, phones get a full-screen chat.

Chat requests are intercepted, so no Gemini key or Node server is needed."""
import json
import os
import re
from pathlib import Path
from playwright.sync_api import sync_playwright
from common import URL, check, finish, offline_api

SHOTS = os.environ.get("SHOTS")
calls = []
mode = {"next": "ok"}
source = Path('/site/assets/data.js')
if not source.exists():
    source = Path(__file__).resolve().parents[2] / 'assets/data.js'
src = source.read_text()


def answer(route):
    body = json.loads(route.request.post_data)
    calls.append(body)
    if mode["next"] == "off":
        route.fulfill(status=503, content_type="application/json", body=json.dumps({"code": "NOT_CONFIGURED", "error": "Live chat is not connected yet."}))
    else:
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"reply": f"Reply {len(calls)} about Kenneth."}))


def open_page(b, width=1280, height=900, **opts):
    ctx = b.new_context(viewport={"width": width, "height": height}, **opts)
    offline_api(ctx)
    local_data = re.sub(r'pokes: \{ endpoint: [^}]+\}', 'pokes: { endpoint: null }', src)
    ctx.route("**/assets/data.js*", lambda r: r.fulfill(content_type="text/javascript", body=local_data))
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
    check("there is no floating CK; CK sits in the notch", p.locator(".assistant-launcher").count() == 0 and p.is_visible(".notch .notch-ck"))
    p.click(".notch-ck"); p.wait_for_selector(".ck-panel[open]")
    chat_btn, poke_row, side = box(p, ".sidebar-chat"), box(p, ".poke"), box(p, ".ck-panel")
    check("Chat with me sits in CK's menu, under the poke row", p.inner_text(".sidebar-chat").strip() == "Chat with me" and chat_btn["y"] >= poke_row["b"] and chat_btn["x"] >= side["x"] and chat_btn["r"] <= side["r"], f"{chat_btn} {poke_row}")
    check("CK's menu drops from the notch, centred", abs((side["x"] + side["r"]) / 2 - 640) <= 1 and side["y"] < 80, str(side))
    check("nothing in CK's menu is cut off", p.evaluate("(() => { const s = document.querySelector('.ck-panel'); return s.scrollHeight <= s.clientHeight + 1; })()"))
    poke_face = lambda: p.eval_on_selector(".poke-button .assistant-sprite", "n => (n.classList.contains('is-reacting') ? 'r' : 'd') + n.style.backgroundPosition")
    check("the poke counter starts at zero", p.inner_text(".poke-value").strip() == "0")
    p.click(".poke-button")
    check("a poke counts and CK reacts", p.inner_text(".poke-value").strip() == "1" and poke_face() == "r0% 50%", poke_face())
    p.click(".poke-button")
    check("the next poke gets a different face", p.inner_text(".poke-value").strip() == "2" and poke_face() == "r50% 50%", poke_face())
    if SHOTS: p.screenshot(path=f"{SHOTS}/sidebar-desktop-light.png")
    p.wait_for_timeout(1400)
    check("then he goes back to idling", poke_face().startswith("d") or poke_face() == "r0% 0%", poke_face())
    p.reload(); p.wait_for_load_state("networkidle")
    p.click(".notch-ck"); p.wait_for_selector(".ck-panel[open]")
    check("the poke count is remembered", p.inner_text(".poke-value").strip() == "2")
    p.wait_for_timeout(300)
    p.click(".poke-button")
    check("a poke pops the emote for that face beside his head, upper left", p.get_attribute(".poke .poke-emote", "data-emote") == "delighted" and p.locator(".poke .poke-emote svg rect").count() > 3 and p.evaluate("(() => { const e = document.querySelector('.poke-emote').getBoundingClientRect(), b = document.querySelector('.poke-button').getBoundingClientRect(); return e.top >= b.top - 14 && e.bottom <= b.top + b.height / 2 + 8 && e.right <= b.left + b.width / 2 && e.left >= b.left - 2; })()"))
    if SHOTS: p.locator(".ck-panel").screenshot(path=f"{SHOTS}/poke-emote.png")
    p.wait_for_timeout(2100)  # long enough that this poke is not part of the combo below
    check("the emote clears", p.locator(".poke-emote").count() == 0)
    for _ in range(5): p.click(".poke-button"); p.wait_for_timeout(60)
    dizzy_at = p.inner_text(".poke-value").strip()
    check("five quick pokes make him dizzy", dizzy_at == "8" and poke_face() == "r0% 100%" and p.get_attribute(".poke .poke-emote", "data-emote") == "dizzy", f"{dizzy_at} {poke_face()}")
    if SHOTS: p.locator(".ck-panel").screenshot(path=f"{SHOTS}/poke-dizzy.png")
    p.click(".poke-button"); p.click(".poke-button")
    check("he ignores pokes while dizzy", p.inner_text(".poke-value").strip() == "8")
    p.wait_for_timeout(1750)
    p.click(".poke-button")
    check("and counts again once he has recovered", p.inner_text(".poke-value").strip() == "9" and poke_face() != "r0% 100%", poke_face())

    p.click(".sidebar-chat")
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
    check("one column, fixed size", dialog["w"] == 720 and dialog["h"] == 600, str(dialog))
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
    p.wait_for_function("!document.querySelector('.assistant-character .assistant-sprite').classList.contains('is-reacting')", timeout=3000)
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
    check("the container keeps its size as the talk grows", grown["w"] == 720 and grown["h"] == 600 and abs((grown["y"] + grown["b"]) / 2 - 450) <= 1, str(grown))

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
    check("a long answer scrolls inside the dialog", box(p, ".assistant-dialog")["h"] == 600 and p.evaluate("(() => { const s = document.querySelector('.assistant-scene'); return s.scrollHeight > s.clientHeight; })()"))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-long.png")
    p.unroute("**/api/chat")
    before = messages(p)

    p.keyboard.press("Escape")
    p.wait_for_function("!document.body.classList.contains('assistant-open')")
    check("Escape closes the chat and focus returns to CK in the notch", p.evaluate("document.activeElement.classList.contains('notch-ck')"))
    check("the page scrolls again after closing", not p.evaluate("document.body.classList.contains('assistant-open')"))
    p.click(".notch-ck"); p.click(".sidebar-chat")
    p.wait_for_selector(".assistant-dialog[open]")
    check("the conversation is still there when reopened", messages(p) == before and said(p) == long.strip())
    check("no console errors on desktop", not errors, "; ".join(errors))
    ctx.close()

    # Tablet -------------------------------------------------------------------
    ctx, p, errors = open_page(b, 820, 1000)
    check("tablet: the notch shows the page links and CK", p.is_visible(".notch .nav-link[data-notch='projects']") and p.is_visible(".notch-ck"))
    p.click(".notch-ck"); p.wait_for_selector(".ck-panel[open]")
    check("tablet: CK's menu has the chat button and pokes", p.is_visible(".sidebar-chat") and p.is_visible(".poke-button"))
    if SHOTS: p.screenshot(path=f"{SHOTS}/ck-menu-tablet.png")
    check("no console errors on tablet", not errors, "; ".join(errors))
    ctx.close()

    # Shared poke counter ---------------------------------------------------------
    # data.js is served with the counter switched on; the API itself is intercepted.
    server = {"total": 1000, "posts": [], "down": True}
    def pokes_api(route):
        if server['down']:
            route.fulfill(status=503, json={'error': 'Unavailable'})
            return
        if route.request.method == "POST":
            count = json.loads(route.request.post_data)["count"]
            server["posts"].append(count); server["total"] += count
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"total": server["total"]}))
    ctx = b.new_context(viewport={"width": 1280, "height": 900})
    offline_api(ctx)
    poke_url = URL.split('#')[0].split('?')[0].rstrip('/') + '/api/pokes'
    patched = re.sub(r'pokes: \{ endpoint: [^}]+\}', 'pokes: { endpoint: ' + json.dumps(poke_url) + ' }', src)
    assert poke_url in patched, "pokes setting not found in data.js"
    ctx.route("**/assets/data.js*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=patched))
    ctx.route("**/api/pokes", pokes_api)
    ctx.route("**/github-contributions-api.jogruber.de/**", lambda r: r.abort())
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.add_init_script("localStorage.setItem('ck-pokes', '99')")
    p.goto(URL); p.wait_for_load_state("networkidle")
    p.click(".notch-ck")
    check("an unavailable shared counter keeps Total pokes and does not show the personal count", p.inner_text('.poke-label') == 'Total pokes' and p.inner_text('.poke-value') == '—')
    p.click('.poke-button')
    check("a poke during an outage keeps the shared count unavailable", p.inner_text('.poke-label') == 'Total pokes' and p.inner_text('.poke-value') == '—')
    p.wait_for_timeout(1600)
    server['down'] = False
    p.reload(); p.wait_for_load_state('networkidle')
    p.click(".notch-ck")
    p.wait_for_function("document.querySelector('.poke-value').textContent === '1,000'")
    check("with a server CK's menu shows everyone's total", p.inner_text(".poke-value").strip() == "1,000")
    for _ in range(3): p.click(".poke-button")
    check("a poke shows at once, before the server answers", p.inner_text(".poke-value").strip() == "1,003" and server["posts"] == [])
    p.wait_for_function("document.querySelector('.poke-value').textContent.trim() === '1,003'")
    p.wait_for_timeout(1600)
    check("three quick pokes are sent as one request", server["posts"] == [3] and p.inner_text(".poke-value").strip() == "1,003", str(server))
    server["total"] += 50  # other visitors poke meanwhile
    p.click(".poke-button")
    p.wait_for_timeout(1600)
    check("the total picks up other visitors' pokes", server["posts"] == [3, 1] and p.inner_text(".poke-value").strip() == "1,054", p.inner_text(".poke-value"))
    check("no errors with the shared counter", not errors, "; ".join(errors))
    ctx.close()

    # Dark theme ---------------------------------------------------------------
    ctx, p, errors = open_page(b, color_scheme="dark")
    p.click(".notch-ck")
    if SHOTS: p.screenshot(path=f"{SHOTS}/ck-menu-desktop-dark.png")
    p.click(".sidebar-chat")
    p.wait_for_selector(".assistant-dialog[open]")
    p.wait_for_function(settled)
    p.click(".assistant-suggestion >> nth=1")
    p.wait_for_function(f"{settled} && document.querySelectorAll('.assistant-message').length === 2")
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-desktop-dark.png")
    ctx.close()

    # Phone --------------------------------------------------------------------
    ctx, p, errors = open_page(b, 375, 812, has_touch=True, is_mobile=True)
    ck = box(p, ".notch-ck")
    check("on phones the notch holds CK alone, centred at the top", abs((ck["x"] + ck["r"]) / 2 - 187.5) <= 1 and ck["y"] < 60 and not p.is_visible(".notch .nav-link"), str(ck))
    sprite = p.eval_on_selector(".notch-ck .assistant-sprite", "n => getComputedStyle(n).backgroundImage")
    check("the notch CK draws the character sprite", "mini-ck" in sprite, sprite)
    look = lambda: p.eval_on_selector(".notch-ck .assistant-sprite", "n => (n.classList.contains('is-reacting') ? 'r' : 'd') + n.style.backgroundPosition")
    p.touchscreen.tap(20, 40)
    p.wait_for_timeout(150)
    first = look()
    p.touchscreen.tap(360, 40)
    p.wait_for_timeout(150)
    left_right = (first, look())
    p.touchscreen.tap(188, 600)
    p.wait_for_timeout(150)
    check("he looks toward each touch (left, right, then down)", left_right == ("d0% 50%", "d100% 50%") and look() == "d50% 100%", f"{left_right} {look()}")
    p.evaluate("window.scrollTo(0, 0)")
    p.tap(".notch-ck")
    p.wait_for_selector(".ck-panel[open]")
    panel = box(p, ".ck-panel")
    check("CK's menu fits the phone and holds the page links, chat and pokes", panel["x"] >= 0 and panel["r"] <= 375 and p.is_visible(".ck-panel .nav-link[data-notch='projects']") and p.is_visible(".sidebar-chat") and p.is_visible(".poke-button"), str(panel))
    if SHOTS: p.screenshot(path=f"{SHOTS}/ck-menu-phone.png")
    p.tap(".poke-button")
    p.wait_for_timeout(120)
    check("a poke in the menu counts", p.inner_text(".poke-value").strip() == "1" and p.evaluate("localStorage.getItem('ck-pokes')") == "1")
    p.tap(".sidebar-chat")
    p.wait_for_selector(".assistant-dialog[open]")
    p.wait_for_function(settled)
    p.wait_for_timeout(300)
    dialog, character, speech = box(p, ".assistant-dialog"), box(p, ".assistant-character"), box(p, ".assistant-speech")
    check("on phones the chat is a fixed sheet on the bottom edge", dialog["w"] == 375 and abs(dialog["b"] - 812) <= 1 and abs(dialog["h"] - 796) <= 1, str(dialog))
    check("the bubble sits above CK, tail pointing down at him", speech["b"] <= character["y"] and character["w"] == 80 and speech["x"] <= 17 and speech["r"] <= 375, f"{character} {speech}")
    check("the keyboard stays closed until the visitor taps the box", p.evaluate("document.activeElement.id") != "assistant-input")
    check("nothing overflows sideways", p.evaluate("document.querySelector('.assistant-dialog').scrollWidth") <= 375)
    form = box(p, ".assistant-form")
    check("the question box is on screen", form["b"] <= 812 and form["x"] >= 0 and form["r"] <= 375, str(form))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-phone-open.png")
    p.tap(".assistant-suggestion >> nth=1")
    p.wait_for_function(f"{settled} && document.querySelectorAll('.assistant-message').length === 2")
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-phone-chat.png")
    long = "Kenneth-length answer with several projects in it. " * 9
    p.route("**/api/chat", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"reply": long})))
    p.fill("#assistant-input", "What have you built?")
    p.tap(".assistant-send")
    p.wait_for_selector(".assistant-say.is-typing")
    p.tap(".assistant-say")
    p.wait_for_timeout(250)
    speech, character, sheet = box(p, ".assistant-speech"), box(p, ".assistant-character"), box(p, ".assistant-dialog")
    check("a long answer uses the full width of the phone", speech["w"] >= 340, str(speech))
    check("CK stays in view under it", abs(character["b"] - box(p, ".assistant-form")["y"]) <= 1, str(character))
    check("the sheet keeps its size", abs(sheet["h"] - 796) <= 1 and abs(sheet["b"] - 812) <= 1, str(sheet))
    if SHOTS: p.screenshot(path=f"{SHOTS}/assistant-phone-long.png")
    p.unroute("**/api/chat")
    p.tap(".assistant-close")
    p.wait_for_function("!document.body.classList.contains('assistant-open')")
    p.wait_for_timeout(350)
    check("the close button works on phones", not p.is_visible(".assistant-dialog"))
    p.tap(".notch-ck")
    p.wait_for_selector(".ck-panel[open]")
    check("the menu shows the same count", p.inner_text(".poke-value").strip() == "1")
    p.tap(".sidebar-chat")
    p.wait_for_selector(".assistant-dialog[open]")
    check("Chat with me reopens the chat, with the conversation kept, and the menu closes", messages(p) >= 2 and not p.locator(".ck-panel[open]").count())
    p.tap(".assistant-close")
    p.wait_for_function("!document.body.classList.contains('assistant-open')")
    p.wait_for_timeout(350)
    check("no console errors on phones", not errors, "; ".join(errors))
    ctx.close()

    # Reduced motion -----------------------------------------------------------
    ctx, p, errors = open_page(b, reduced_motion="reduce")
    p.click(".notch-ck"); p.click(".sidebar-chat")
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
