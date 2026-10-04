"""'Get in touch' terminal: contact on load, chips, typing, history, completion, nav key 6."""
from playwright.sync_api import sync_playwright
from common import check, finish, new_page

EMAIL = "charleskenneth129@gmail.com"
screen = lambda p: p.inner_text(".terminal-screen")
lines = lambda p: p.eval_on_selector_all(".terminal-line", "ns => ns.map(n => n.innerText.replace(/\\s+/g, ' ').trim())")


def type_run(p, text):
    p.fill(".terminal-input", text)
    p.keyboard.press("Enter")
    p.wait_for_timeout(150)


with sync_playwright() as pw:
    b = pw.chromium.launch()

    # --- desktop -------------------------------------------------------------
    ctx, p, errors = new_page(b, permissions=["clipboard-read", "clipboard-write"])
    order = p.evaluate("[...document.querySelectorAll('main section')].map(s => s.id)")
    check("contact is the last section", order[-1] == "contact" and order[-2] == "outside", str(order))
    contact_link = p.locator('.nav-link[data-section="contact"]')
    check("nav has Contact, no shortcut badge, key in the tooltip", contact_link.inner_text().split() == ["Contact"] and contact_link.get_attribute("title") == "Contact (6)" and p.locator("#sidebar kbd").count() == 0)
    check("intro: nothing is printed before the terminal is on screen", EMAIL not in screen(p), screen(p))
    p.keyboard.press("6"); p.wait_for_timeout(450)
    mid = screen(p)
    p.wait_for_timeout(1700)
    check("intro: `contact` types itself out when scrolled into view", EMAIL not in mid and "$" in mid and EMAIL in screen(p), repr(mid))
    check("classic $ prompt", lines(p)[0] == "$ contact" and p.inner_text(".terminal-prompt .terminal-ps1") == "$", lines(p)[0])
    bar = p.inner_text(".terminal-bar")
    check("title bar: window dots, chimkenchrls title, Philippine clock", p.locator(".terminal-dots span").count() == 3 and "chimkenchrls: ~" in bar and __import__("re").search(r"\b\d{2}:\d{2} PHT", bar) is not None, bar)
    clock_right = p.evaluate("(() => { const b = document.querySelector('.terminal-bar').getBoundingClientRect(), c = document.querySelector('.terminal-clock').getBoundingClientRect(); return b.right - c.right < 24; })()")
    check("clock sits at the right end of the title bar", clock_right)
    check("no tmux status bar", p.locator(".terminal-status").count() == 0)
    above = p.evaluate("(() => { const i = document.querySelector('.contact-intro').getBoundingClientRect(), t = document.querySelector('.terminal').getBoundingClientRect(); return i.bottom <= t.top; })()")
    check("short description sits above the terminal", above and p.inner_text(".contact-intro").startswith("This is a working terminal."))
    check("key 6 jumps to contact and marks it active", p.evaluate("location.hash") == "#contact" and p.get_attribute('.nav-link[aria-current]', "data-section") == "contact")

    out = screen(p)
    check("contact block shown on load without typing", "$ contact" in out.replace("\n", " ") and EMAIL in out and "github.com/chimkenchrls" in out and "de4dicated" in out and "linkedin.com/in/kennethcharlesvaldez" in out, out[:200])
    check("email is a real mailto link", p.get_attribute(f'.terminal-screen a[href^="mailto:"]', "href") == f"mailto:{EMAIL}")
    gh = p.locator('.terminal-screen a[href="https://github.com/chimkenchrls"]')
    check("github link opens in a new tab safely", gh.get_attribute("target") == "_blank" and "noopener" in gh.get_attribute("rel"))
    check("hint invites typing or tapping", "try `help`" in out)

    colors = p.evaluate("(() => { const t = getComputedStyle(document.querySelector('.terminal')); const b = getComputedStyle(document.body); return [t.backgroundColor, b.color, t.color, b.backgroundColor]; })()")
    check("terminal is inverted against the page", colors[0] == colors[1] and colors[2] == colors[3], str(colors))

    p.click(".terminal-screen", position={"x": 300, "y": 250})
    check("clicking the screen focuses the prompt", p.evaluate("document.activeElement.id") == "terminal-input")

    type_run(p, "whoami")
    out = screen(p)
    check("whoami prints identity", "Kenneth Charles Valdez" in out and "Sariaya, Quezon, Philippines" in out and "STI College Lucena" in out, out[-300:])
    check("input clears after running", p.input_value(".terminal-input") == "")
    check("output scrolls to the newest line", p.eval_on_selector(".terminal-screen", "s => s.scrollTop + s.clientHeight >= s.scrollHeight - 2"))

    theme0 = p.evaluate("document.documentElement.dataset.theme")
    p.fill(".terminal-input", "t1"); p.wait_for_timeout(100)
    check("typing t/1 in the prompt does not trigger site shortcuts", p.evaluate("document.documentElement.dataset.theme") == theme0 and p.evaluate("location.hash") == "#contact")
    p.fill(".terminal-input", "")

    type_run(p, "nope --force")
    check("unknown command gets a helpful error", "command not found: nope — try help" in lines(p)[-1], lines(p)[-1])
    type_run(p, "<b>hi</b>")
    check("typed HTML is shown as text, never rendered", p.locator(".terminal-screen b").count() == 0 and "$ <b>hi</b>" in screen(p).replace("\n", " "))

    type_run(p, "help")
    check("help lists commands", all(c in screen(p) for c in ["sudo hire-me", "message <text>", "chimken", "clear"]))

    p.fill(".terminal-input", "con"); p.keyboard.press("Tab")
    check("Tab completes a unique prefix", p.input_value(".terminal-input") == "contact")
    p.fill(".terminal-input", "c"); p.keyboard.press("Tab"); p.wait_for_timeout(100)
    check("Tab lists ambiguous matches", "chimken clear contact" in lines(p)[-1], lines(p)[-1])
    p.fill(".terminal-input", "")

    p.keyboard.press("ArrowUp")
    check("ArrowUp recalls the last command", p.input_value(".terminal-input") == "help", p.input_value(".terminal-input"))
    p.keyboard.press("ArrowUp"); p.keyboard.press("ArrowUp")
    check("ArrowUp keeps walking back", p.input_value(".terminal-input") == "nope --force", p.input_value(".terminal-input"))
    for _ in range(5):
        p.keyboard.press("ArrowDown")
    check("ArrowDown returns to an empty line", p.input_value(".terminal-input") == "")

    type_run(p, "email")
    check("email copies the address", p.evaluate("navigator.clipboard.readText()") == EMAIL)
    type_run(p, "discord")
    check("discord copies the username", p.evaluate("navigator.clipboard.readText()") == "de4dicated")

    type_run(p, "projects")
    jump = p.locator('.terminal-screen a[href="#projects"]').last
    titles = p.evaluate("PORTFOLIO_DATA.projects.map(x => x.title)")
    check("projects lists data and links to the section", all(t in screen(p) for t in titles) and jump.count() == 1, str(titles))
    jump.click(); p.wait_for_timeout(900)
    check("section link jumps there", p.evaluate("location.hash") == "#projects")

    p.keyboard.press("6"); p.wait_for_timeout(900)
    p.focus(".terminal-input")
    theme0 = p.evaluate("document.documentElement.dataset.theme")
    type_run(p, "theme"); p.wait_for_timeout(800)
    check("theme command toggles the theme", p.evaluate("document.documentElement.dataset.theme") != theme0)
    colors = p.evaluate("(() => { const t = getComputedStyle(document.querySelector('.terminal')); const b = getComputedStyle(document.body); return [t.backgroundColor, b.color]; })()")
    check("terminal stays inverted after the theme change", colors[0] == colors[1], str(colors))

    type_run(p, "neofetch")
    art = p.eval_on_selector(".terminal-art-pic", "n => n.textContent").split("\n")
    check("neofetch draws chimken as one block of pixel art", len(art) == 6 and any("█" in a for a in art), str(art[:3]))
    side = p.evaluate("(() => { const a = document.querySelector('.terminal-art-pic').getBoundingClientRect(), i = document.querySelector('.terminal-art-info').getBoundingClientRect(); return a.right <= i.left + 1; })()")
    check("desktop: art sits beside the facts", side)
    nf = screen(p)
    check("neofetch shows real facts", "chimkenchrls ------------" in " ".join(nf.split()) and "tools in" in nf and "high score 3236" in nf and "STI College Lucena" in nf)
    check("neofetch art keeps its spacing", p.eval_on_selector(".terminal-art-pic", "n => getComputedStyle(n).whiteSpace") == "pre")
    p.locator(".terminal").screenshot(path="/tmp/shots/neofetch.png") if __import__("os").path.isdir("/tmp/shots") else None

    type_run(p, "ls")
    check("ls lists sections and files", "projects/" in screen(p) and "about.txt" in screen(p))
    type_run(p, "cat about.txt")
    check("cat about.txt prints the bio", "4th-year BS Computer Science student" in screen(p))
    type_run(p, "history")
    check("history numbers past commands", any(l.endswith("neofetch") and l[0].isdigit() for l in lines(p)), str(lines(p)[-6:]))
    type_run(p, "help")
    check("help lists the aliases", all(c in screen(p) for c in ["neofetch", "cd <section>", "cat <file>", "history"]))
    type_run(p, "cd stack"); p.wait_for_timeout(900)
    check("cd jumps to the section", p.evaluate("location.hash") == "#stack" and p.get_attribute('.nav-link[aria-current]', "data-section") == "stack")
    p.keyboard.press("6"); p.wait_for_timeout(900); p.focus(".terminal-input")
    type_run(p, "cd nowhere")
    check("cd to a missing section explains itself", "cd: no such section: nowhere — try ls" in lines(p)[-1], lines(p)[-1])

    type_run(p, "clear")
    check("clear empties the screen", lines(p) == [], str(lines(p)))

    nav = []
    p.on("framenavigated", lambda f: nav.append(f.url))
    opened = p.evaluate("""() => { window.__href = null; return true; }""")
    type_run(p, "sudo hire-me")
    out = screen(p)
    link = p.locator('.terminal-screen a[href^="mailto:"]').last.get_attribute("href")
    check("sudo hire-me shows the gag and a pre-filled email link", "[sudo] password for recruiter" in out and "access granted." in out and link == f"mailto:{EMAIL}?subject=OJT%20%2F%20Internship%20opportunity", str(link))

    type_run(p, "chimken"); p.wait_for_timeout(300)
    check("chimken command opens the game", p.eval_on_selector(".game", "d => d.open"))
    p.keyboard.press("Escape")
    check("no console errors (desktop)", not errors, "; ".join(errors))
    p.evaluate("document.getElementById('contact').scrollIntoView(); 0"); p.wait_for_timeout(500)
    p.locator("#contact").screenshot(path="/tmp/terminal-desktop.png")
    ctx.close()

    # --- phone ---------------------------------------------------------------
    ctx, p, errors = new_page(b, 375, 812, has_touch=True, is_mobile=True)
    p.evaluate("document.getElementById('contact').scrollIntoView(); 0"); p.wait_for_timeout(300)
    p.tap('.terminal-chip[data-command="email"]'); p.wait_for_timeout(200)
    early = lines(p)
    idx = lambda cmd: early.index("$ " + cmd)
    check("phone: a chip tapped mid-intro finishes the intro first", EMAIL in screen(p) and idx("email") > idx("contact"), str(early))
    check("phone: contact block visible on load", EMAIL in screen(p))
    p.fill(".terminal-input", "neofetch"); p.tap(".terminal-run"); p.wait_for_timeout(200)
    check("phone: neofetch fits without sideways scrolling", p.eval_on_selector(".terminal-screen", "s => s.scrollWidth <= s.clientWidth + 1"), str(p.eval_on_selector(".terminal-screen", "s => [s.scrollWidth, s.clientWidth]")))
    check("phone: the run button submits", "------------" in screen(p))
    geo = p.evaluate("(() => { const a = document.querySelector('.terminal-art-pic').getBoundingClientRect(), i = document.querySelector('.terminal-art-info').getBoundingClientRect(); return [a.bottom <= i.top + 1, Math.round(a.width), Math.round(a.height)]; })()")
    check("phone: art is stacked above the facts and stays square", geo[0] and 0.7 < geo[1] / geo[2] < 1.4, str(geo))
    p.tap('.terminal-chip[data-command="whoami"]'); p.wait_for_timeout(200)
    check("phone: tapping a chip runs the command", "$ whoami" in screen(p).replace("\n", " ") and "Kenneth Charles Valdez" in screen(p))
    check("phone: chips do not pop the keyboard (prompt not focused)", p.evaluate("document.activeElement.id") != "terminal-input")
    p.tap(".terminal-screen", position={"x": 150, "y": 120}); p.wait_for_timeout(100)
    check("phone: tapping the screen does not focus the prompt", p.evaluate("document.activeElement.id") != "terminal-input")
    check("phone: no page overflow", p.evaluate("document.documentElement.scrollWidth <= 375"), str(p.evaluate("document.documentElement.scrollWidth")))
    check("phone: prompt text is 16px (no iOS zoom)", p.eval_on_selector(".terminal-input", "i => getComputedStyle(i).fontSize") == "16px")
    p.click(".menu-toggle"); p.wait_for_timeout(300)
    check("phone: drawer has the Contact link", p.is_visible('#sidebar .nav-link[data-section="contact"]'))
    check("no console errors (phone)", not errors, "; ".join(errors))
    ctx.close()

    # --- dark theme, clipboard blocked, no JS --------------------------------
    ctx, p, errors = new_page(b, reduced_motion="reduce")
    check("reduced motion: contact is printed immediately, no typing", EMAIL in screen(p))
    ctx.close()

    ctx, p, errors = new_page(b, color_scheme="dark")
    p.evaluate("document.getElementById('contact').scrollIntoView(); 0"); p.wait_for_timeout(1800)
    colors = p.evaluate("(() => { const t = getComputedStyle(document.querySelector('.terminal')); const b = getComputedStyle(document.body); return [t.backgroundColor, b.color]; })()")
    check("dark theme: terminal is the light, inverted block", colors[0] == colors[1], str(colors))
    p.evaluate("Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); 0")
    type_run(p, "email"); p.wait_for_timeout(200)
    check("copy failure is reported honestly", "couldn't copy automatically" in screen(p), screen(p)[-200:])
    p.locator("#contact").screenshot(path="/tmp/terminal-dark.png")
    ctx.close()

    ctx = b.new_context(viewport={"width": 1280, "height": 900}, java_script_enabled=False)
    p = ctx.new_page(); p.goto("http://localhost:8000/")
    out = p.inner_text(".terminal-screen")
    check("without JavaScript the contact details are still readable", EMAIL in out and "github.com/chimkenchrls" in out and "de4dicated" in out, out)
    ctx.close()
    b.close()
finish()
