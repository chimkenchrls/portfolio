"""chimken: opens, plays, ends, restarts; new obstacles, corn, and milestone flash render without errors."""
import os
import re
from playwright.sync_api import sync_playwright
from common import URL, check, finish, new_page

SHOTS = os.environ.get("SHOTS")  # optional: directory for screenshots
score = lambda p: p.inner_text(".game-score")
points = lambda p: int(score(p)[:5])

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # --- the real game -------------------------------------------------------
    ctx, p, errors = new_page(b)
    p.keyboard.press("Alt+k"); p.wait_for_timeout(300)
    check("Alt+K opens the game", p.eval_on_selector(".game", "d => d.open"))
    check("waits for the first jump", score(p) == "00000  HI 00000", score(p))
    p.keyboard.press("Space"); p.wait_for_timeout(1000)
    check("space starts the run and the score climbs", points(p) > 0, score(p))
    p.wait_for_timeout(6500)  # never jumping: the first bug ends the run
    a = score(p); p.wait_for_timeout(400)
    check("running into a bug ends the game", a == score(p), f"{a} -> {score(p)}")
    check("high score is saved", int(p.evaluate("localStorage.getItem('chimken-hi')") or 0) > 0)
    check("loss mentions ck's score", "didn't beat ck's high score: 3236" in p.inner_text(".sr-status"), p.inner_text(".sr-status"))
    p.keyboard.press("Space"); p.wait_for_timeout(800)
    check("restart works after the cooldown", 0 < points(p) < 60, score(p))
    p.keyboard.press("Escape"); p.wait_for_timeout(200)
    check("Esc closes the game", not p.eval_on_selector(".game", "d => d.open"))
    check("no console errors (real game)", not errors, "; ".join(errors))
    ctx.close()

    # --- everything unlocked, always corn (at ground level), invincible -------
    src = open("/site/script.js").read()
    patched = src
    for threshold in ("150", "300", "500"):
        patched = patched.replace(f"{{ at: {threshold}, kinds:", "{ at: 0, kinds:")
    patched = patched.replace("chance: 0.35 }", "chance: 1 }")
    # Corn at ground level so the invincible runner always collects it; that the real
    # height is reachable with a normal jump is proven in tests/chimken.test.js.
    patched = patched.replace("corn: { w: 10, h: 10, y: 92,", "corn: { w: 10, h: 10, y: 8,")
    patched = patched.replace("if (obstacles.some((bug) => hitsObstacle(chimken, bug))) {", "if (false) {")
    check("fixture: script patched (unlocks, corn, invincible)", patched.count("{ at: 0, kinds:") == 4 and "chance: 1 }" in patched and "if (false) {" in patched and "y: 8, points" in patched)

    for name, opts in [("desktop", {}), ("phone", {"has_touch": True, "is_mobile": True})]:
        width, height = (1280, 900) if name == "desktop" else (375, 812)
        context = b.new_context(viewport={"width": width, "height": height}, color_scheme="dark", **opts)
        context.route("**/script.js*", lambda r: r.fulfill(status=200, content_type="text/javascript", body=patched))
        p = context.new_page(); errs = []
        p.on("pageerror", lambda e: errs.append(str(e)))
        p.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        p.goto(URL); p.wait_for_load_state("networkidle")
        if name == "desktop":
            p.keyboard.press("Alt+k"); p.keyboard.press("Space")
        else:
            p.tap(".yard-chimken"); p.wait_for_timeout(300); p.tap(".game-canvas")
        blinked = False
        biggest_jump, last = 0, points(p)
        for i in range(26):  # ~8s on the ground: invincible, so it runs through every corn
            p.wait_for_timeout(300)
            blinked = blinked or p.eval_on_selector(".game-score", "s => s.classList.contains('is-milestone')")
            now = points(p); biggest_jump = max(biggest_jump, now - last); last = now
            if SHOTS and i in (8, 14, 20):
                p.locator(".game-canvas").screenshot(path=f"{SHOTS}/chimken-{name}-{i}.png")
        check(f"{name}: survives 8s with every obstacle on screen (no errors)", not errs, "; ".join(errs))
        check(f"{name}: score flashes at a 100-point milestone", blinked)
        # Distance alone adds ~10 points per 300ms sample; a +25 corn makes one sample jump by 25+.
        check(f"{name}: grabbing corn adds a +25 bonus", biggest_jump >= 25, f"biggest jump {biggest_jump}, score {score(p)}")
        check(f"{name}: game still running", p.eval_on_selector(".game", "d => d.open"))
        context.close()

    # --- reduced motion: no blink animation ----------------------------------
    ctx, p, errors = new_page(b, reduced_motion="reduce")
    anim = p.evaluate("""() => { const s = document.querySelector('.game-score'); s.classList.add('is-milestone'); return getComputedStyle(s).animationName; }""")
    check("reduced motion: milestone does not blink", anim == "none", anim)
    ctx.close()
    b.close()
finish()
