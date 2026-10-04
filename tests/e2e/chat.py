"""AmIgo chat replay + diagram: real conversation plays, pauses, loops scenes; static with reduced motion."""
import os
from playwright.sync_api import sync_playwright
from common import URL, check, finish

SHOTS = os.environ.get("SHOTS")
norm = lambda s: " ".join(s.split())
log_text = lambda p: norm(p.inner_text(".chat-log"))
rows = lambda p: p.locator(".chat-log > *").count()


SPEED = 10  # the test serves a copy of script.js whose replay timers run 10x faster


def open_page(b, width=1280, height=900, fast=True, **opts):
    ctx = b.new_context(viewport={"width": width, "height": height}, **opts)
    if fast:
        src = open("/site/script.js").read()
        patched = src.replace("const wait = (fn, ms) => { timer = window.setTimeout(fn, ms); };",
                              f"const wait = (fn, ms) => {{ timer = window.setTimeout(fn, ms / {SPEED}); }};")
        assert patched != src, "replay timer not found to patch"
        ctx.route("**/script.js*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=patched))
    # Keep the layout still: the GitHub panel loads late and would push the chat down.
    ctx.route("**/github-contributions-api.jogruber.de/**", lambda r: r.abort())
    p = ctx.new_page(); errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ERR_FAILED" not in m.text else None)
    p.goto(URL); p.wait_for_load_state("networkidle")
    # No scroll-reveal slide in this suite: Playwright re-scrolls the page when it
    # clicks an element that is still moving, which would push the chat off screen.
    p.add_style_tag(content=".reveal { opacity: 1 !important; transform: none !important; transition: none !important; }")
    return ctx, p, errors


def to_chat(p):
    # Instant, not smooth: a later click would interrupt an animated scroll halfway.
    p.evaluate("document.querySelector('.chat').scrollIntoView({ block: 'center', behavior: 'instant' }); 0")
    p.wait_for_function("(() => { const r = document.querySelector('.chat').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })()", timeout=3000)


def until(p, js, timeout=8000):
    """True once the page condition holds (polls), False on timeout."""
    try:
        p.wait_for_function(js, timeout=timeout)
        return True
    except Exception:
        return False


SCENE = "document.querySelector('.chat-scene').textContent"
LOG = "document.querySelector('.chat-log').innerText"

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # --- desktop, animated (10x) ---------------------------------------------
    ctx, p, errors = open_page(b)
    chat = p.evaluate("PORTFOLIO_DATA.projects.find(x => x.chat).chat")
    scene1 = [m["text"] for m in chat["scenes"][0]["messages"]]
    plain = lambda t: norm(t.replace("**", "").replace("`", ""))
    p.wait_for_timeout(600)
    check("nothing plays before the chat is on screen", rows(p) == 0, str(rows(p)))
    geo = p.evaluate("(() => { const li = document.querySelector('.project.has-chat'); const r = s => li.querySelector(s).getBoundingClientRect(); return { title: li.querySelector('.project-title').textContent, infoRight: r('.project-info').right, chatLeft: r('.chat').left, chatW: r('.chat').width }; })()")
    check("the chat window sits beside AmIgo's text", geo["title"] == "AmIgo" and geo["infoRight"] <= geo["chatLeft"] + 1 and 340 <= geo["chatW"] <= 362, str(geo))
    # Record streaming as it happens (at 10x it is over in a fraction of a second).
    p.evaluate("""() => { window.__streamed = 0; const log = document.querySelector('.chat-log');
      new MutationObserver(() => { window.__streamed = Math.max(window.__streamed, log.querySelectorAll('.chat-line[hidden]').length); })
        .observe(log, { childList: true, subtree: true, attributes: true }); }""")
    to_chat(p)
    check("the slash command appears first", until(p, "document.querySelector('.chat-log > *')") and p.locator(".chat-log > *").first.inner_text() == "ck used /study")
    check("the bar names the bot and the scene", p.text_content(".chat-title") == "AmIgo" and p.text_content(".chat-scene") == "study mode")
    check("then the bot shows a typing indicator", until(p, "document.querySelector('.chat-typing')") and "AmIgo is typing" in p.inner_text(".chat-typing"))
    check("then its reply replaces the indicator", until(p, "document.querySelector('.chat-msg.is-bot') && !document.querySelector('.chat-typing')"))
    check("the reply is word for word, with formatting", plain(scene1[1]) in log_text(p) and p.locator(".chat-msg.is-bot strong").first.inner_text() == "Study mode on." and p.locator(".chat-msg.is-bot code").first.inner_text() == "@mention", log_text(p))
    check("the bot is labelled as an app", p.inner_text(".chat-msg.is-bot .chat-app") == "APP")
    av = p.evaluate("(() => { const b = document.querySelector('.chat-msg.is-bot .chat-avatar img'); return { src: b && b.getAttribute('src'), loaded: !!b && b.complete && b.naturalWidth > 0, gray: !!b && getComputedStyle(b).filter.includes('grayscale(1)'), round: getComputedStyle(document.querySelector('.chat-avatar')).borderRadius }; })()")
    check("AmIgo's chat head is its picture, black-and-white and round", av["src"] == "./assets/projects/amigo-avatar.jpg" and av["loaded"] and av["gray"] and av["round"] == "50%", str(av))
    check("no book emoji in the replay", "📚" not in log_text(p) and "📕" not in log_text(p))

    p.click(".chat-toggle"); p.wait_for_timeout(100); count = rows(p)
    p.wait_for_timeout(1500)
    check("pause freezes the replay", rows(p) == count and p.inner_text(".chat-toggle") == "play" and p.get_attribute(".chat-toggle", "aria-pressed") == "true", f"{count} -> {rows(p)}")
    p.click(".chat-toggle")
    check("play resumes it", until(p, f"{LOG}.includes('amigo explain how CI/CD works')") and p.inner_text(".chat-toggle") == "pause")

    check("ck's chat head is the chimken icon", p.locator(".chat-msg.is-user .chat-avatar .icon-chimken").count() == 1 and p.inner_text(".chat-msg.is-user .chat-avatar").strip() == "")
    check("then the full CI/CD answer is shown", until(p, f"{LOG}.includes('should the pipeline catch and stop the broken code?') && !document.querySelector('.chat-line[hidden]')"))
    check("the CI/CD answer is word for word", plain(scene1[3]) in log_text(p), log_text(p)[-200:])
    streamed = p.evaluate("window.__streamed")
    check("the long answer streamed in line by line", streamed >= 5, f"most lines hidden at once: {streamed}")
    check("the window stays a fixed height and scrolls inside", p.eval_on_selector(".chat-log", "l => l.clientHeight === 340 && l.scrollHeight > l.clientHeight"), str(p.eval_on_selector(".chat-log", "l => [l.clientHeight, l.scrollHeight]")))
    check("the scene ends with study mode switched off", until(p, f"{LOG}.includes('Study mode off')"))
    p.wait_for_timeout(150)  # now inside the end-of-scene reading pause
    p.click(".chat-toggle"); p.wait_for_timeout(300)
    check("pausing during the reading pause keeps the conversation on screen", rows(p) == 6 and "Study mode off" in log_text(p), f"{rows(p)} rows")
    p.click(".chat-toggle")
    if SHOTS:
        p.locator(".project.has-chat").screenshot(path=f"{SHOTS}/chat-desktop.png")

    check("after a reading pause the next scene plays", until(p, f"{SCENE} === 'banter' && {LOG}.includes('hello amigo')") and "CI/CD" not in log_text(p), log_text(p)[:160])
    check("the Taglish reply is word for word", until(p, f"{LOG}.includes('kamusta bro?')") and plain(chat["scenes"][1]["messages"][1]["text"]) in log_text(p), log_text(p))
    check("then it loops back to the first scene", until(p, f"{SCENE} === 'study mode' && {LOG}.includes('ck used /study')") and "hello amigo" not in log_text(p), log_text(p)[:160])

    p.evaluate("window.scrollTo({ top: 0, behavior: 'instant' }); 0"); p.wait_for_timeout(500)
    count = rows(p); p.wait_for_timeout(2000)
    check("it stops while scrolled out of view", rows(p) <= count, f"{count} -> {rows(p)}")
    to_chat(p)
    check("and resumes when scrolled back", until(p, f"document.querySelectorAll('.chat-log > *').length > {count}"))

    d = p.evaluate("(() => { const g = document.querySelector('.project.has-chat .diagram'); return { label: g.getAttribute('aria-label'), nodes: [...g.querySelectorAll('.diagram-flow .diagram-node strong')].map(n => n.textContent), store: g.querySelector('.is-store strong').textContent, arrows: g.querySelectorAll('.diagram-flow .diagram-arrow').length }; })()")
    check("the diagram shows Discord, AmIgo, Gemini API with SQLite underneath", d["nodes"] == ["Discord", "AmIgo", "Gemini API"] and d["store"] == "SQLite" and d["arrows"] == 2 and "SQLite" in d["label"], str(d))
    check("no console errors (desktop)", not errors, "; ".join(errors))
    ctx.close()

    # --- phone ---------------------------------------------------------------
    ctx, p, errors = open_page(b, 375, 812, has_touch=True, is_mobile=True)
    to_chat(p)
    check("phone: replay runs", until(p, "document.querySelectorAll('.chat-log > *').length >= 3"), str(rows(p)))
    g = p.evaluate("(() => { const li = document.querySelector('.project.has-chat'); const r = s => li.querySelector(s).getBoundingClientRect(); return { below: r('.project-info').bottom <= r('.chat').top + 1, w: r('.chat').width, dw: r('.diagram').width, overflow: document.documentElement.scrollWidth > innerWidth }; })()")
    check("phone: chat sits under the text at full width, diagram fits, no sideways scroll", g["below"] and g["w"] > 320 and g["dw"] <= 343 and not g["overflow"], str(g))
    if SHOTS:
        until(p, f"{LOG}.includes('Worked Example')")
        p.locator(".project.has-chat").screenshot(path=f"{SHOTS}/chat-phone.png")
    check("no console errors (phone)", not errors, "; ".join(errors))
    ctx.close()

    # --- reduced motion: static transcript -----------------------------------
    ctx, p, errors = open_page(b, fast=False, reduced_motion="reduce")
    to_chat(p); p.wait_for_timeout(300)
    text = log_text(p)
    every = [plain(m["text"]) for s in chat["scenes"] for m in s["messages"]]
    check("reduced motion: the whole transcript is shown at once, nothing animates", all(t in text for t in every) and p.locator(".chat-typing").count() == 0 and p.eval_on_selector(".chat-toggle", "t => t.hidden"), text[:120])
    ctx.close()

    # --- typed text can never become markup ----------------------------------
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, reduced_motion="reduce")
    src = open("/site/assets/data.js").read().replace('{ from: "user", text: "hello amigo" }', '{ from: "user", text: "<img src=x onerror=alert(1)> **b** <b>x</b>" }')
    ctx.route("**/assets/data.js*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=src))
    p = ctx.new_page(); fired = []
    p.on("dialog", lambda d: (fired.append(d.message), d.dismiss()))
    p.goto(URL); p.wait_for_load_state("networkidle"); to_chat(p); p.wait_for_timeout(300)
    check("message text is never rendered as HTML", p.locator(".chat-text img, .chat-text b").count() == 0 and not fired and "<img src=x onerror=alert(1)>" in p.inner_text(".chat-log"))
    ctx.close()
    b.close()
finish()
