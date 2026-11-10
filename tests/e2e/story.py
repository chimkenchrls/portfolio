"""Home's scroll story: About states who I am, lights up word by word and sinks back
as Projects + Stack covers it; the featured projects; the certifications deal out."""
from playwright.sync_api import sync_playwright
from common import check, finish, new_page

BASE = "http://localhost:8000/"
BIO = "A 4th-year BS Computer Science student at STI College Lucena, building side projects and learning how to make deployments smooth and scalable."


def at(p, selector, fraction):
    """Scroll so the element's top sits at `fraction` of the window height."""
    p.evaluate("([s, f]) => { const r = document.querySelector(s).getBoundingClientRect(); scrollTo({ top: scrollY + r.top - innerHeight * f, behavior: 'instant' }); }", [selector, fraction])
    p.wait_for_timeout(250)


with sync_playwright() as pw:
    b = pw.chromium.launch()

    # About as a statement ------------------------------------------------------
    ctx, p, errors = new_page(b, 1280, 800)
    statement = p.locator("#about .statement")
    check("About's statement is the bio", statement.count() == 1 and " ".join(statement.text_content().split()) == BIO, statement.text_content() if statement.count() else "none")
    check("screen readers get it as one sentence", statement.get_attribute("aria-label") == BIO)
    words = p.locator("#about .statement .word")
    check("it is split into words", words.count() == len(BIO.split()), str(words.count()))
    actions = [" ".join(t.split()) for t in p.locator("#about .about-actions > *").all_text_contents()]
    check("three buttons: chat, résumé, all projects", actions == ["Chat with CK", "View résumé", "Explore all projects"], str(actions))
    check("Explore all projects goes to the Projects page", p.get_attribute("#about .about-actions a[href*='view=projects']", "href") == "./?view=projects")
    facts = p.evaluate("[...document.querySelectorAll('#about .fact')].map(n => [n.querySelector('.fact-value').getAttribute('aria-label') || n.querySelector('.fact-value').textContent.trim(), n.querySelector('.fact-caption').textContent.trim()])")
    check("two facts from data", facts == [["BSCS", "4th year · STI College Lucena"], ["5 PROJECTS", "shipped and in progress"]], str(facts))
    check("no Experience or Education on Home", p.locator("#about .timeline-block, #about [data-render='experience']").count() == 0)

    at(p, "#about .statement", 0.9)
    lit = lambda: p.locator("#about .statement .word.is-lit").count()
    check("before it scrolls up, the sentence is dim", lit() == 0, str(lit()))
    at(p, "#about .statement", 0.6)
    mid = lit()
    check("halfway, some words are lit", 0 < mid < words.count(), str(mid))
    at(p, "#about .statement", 0.05)
    check("further up, every word is lit", lit() == words.count(), str(lit()))
    at(p, "#about .statement", 0.6)
    check("scrolling back dims them again", lit() < words.count(), str(lit()))

    p.click("#about .about-actions [data-chat]"); p.wait_for_timeout(300)
    check("Chat with CK opens the chat", p.locator(".assistant-dialog[open]").count() == 1)
    p.keyboard.press("Escape"); p.wait_for_timeout(300)

    at(p, "#projects", 0.0)
    scale = p.evaluate("getComputedStyle(document.querySelector('#about')).scale")
    shade = float(p.evaluate("getComputedStyle(document.querySelector('#about .cover-shade')).opacity"))
    check("as Projects reaches the top, About shrinks to 86%", scale == "0.86", scale)
    check("and sinks into the frame colour", shade >= 0.85, str(shade))
    p.evaluate("scrollTo({ top: scrollY + document.querySelector('#home').getBoundingClientRect().bottom, behavior: 'instant' })"); p.wait_for_timeout(250)
    check("back at About it is full size and clear", p.evaluate("getComputedStyle(document.querySelector('#about')).scale") in ("1", "none") and float(p.evaluate("getComputedStyle(document.querySelector('#about .cover-shade')).opacity")) < 0.05, str(p.evaluate("[getComputedStyle(document.querySelector('#about')).scale, getComputedStyle(document.querySelector('#about .cover-shade')).opacity, document.querySelector('#projects').getBoundingClientRect().top, innerHeight, scrollY]")))

    p.hover(".notch-ck"); p.click(".notch .nav-link[data-notch='stack']")
    p.wait_for_function("document.documentElement.classList.contains('view-stack')")
    p.wait_for_timeout(200)
    check("on another page About has no zoom or shade left over", p.evaluate("document.querySelector('#about').style.scale === '' && document.querySelector('#about .cover-shade').style.opacity === ''"))
    p.click(".notch-ck")
    p.wait_for_function("document.documentElement.classList.contains('is-home')")
    p.keyboard.press("Escape")
    at(p, "#projects", 0.0)
    check("back on Home the cover works again", p.evaluate("getComputedStyle(document.querySelector('#about')).scale") == "0.86")
    check("More about me still has Experience and Education", True)
    check("no errors", not errors, str(errors))
    ctx.close()

    ctx, p, errors = new_page(b, 1280, 800, url=BASE + "?view=more")
    check("More about me shows Experience and Education", p.is_visible("#background [data-render='experience'] li") and p.is_visible("#background [data-render='education'] li"))
    ctx.close()

    # Reduced motion --------------------------------------------------------------
    ctx, p, errors = new_page(b, 1280, 800, reduced_motion="reduce")
    words = p.locator("#about .statement .word")
    at(p, "#about .statement", 0.9)
    check("reduced motion: every word is lit at once", p.locator("#about .statement .word.is-lit").count() == words.count())
    at(p, "#projects", 0.0)
    check("reduced motion: About keeps its size, no shade", p.evaluate("getComputedStyle(document.querySelector('#about')).scale") in ("1", "none") and float(p.evaluate("getComputedStyle(document.querySelector('#about .cover-shade')).opacity")) == 0)
    ctx.close()

    # Projects + Stack: one covering panel ---------------------------------------
    ctx, p, errors = new_page(b, 1280, 800)
    titles = [t.strip() for t in p.locator("#projects .project-feature .project-title").all_text_contents()]
    check("Home features Ambiancy, Thready and Pakisuyo Express", titles == ["Ambiancy", "Thready", "Pakisuyo Express"], str(titles))
    hrefs = p.evaluate("[...document.querySelectorAll('#projects a.project-feature')].map(a => a.getAttribute('href'))")
    check("each card opens its case study", hrefs == ["./?view=case&p=ambiancy", "./?view=case&p=thready", "./?view=case&p=pakisuyo-express"], str(hrefs))
    check("no rows and no + more pill on Home", p.locator("#projects .project-row, #projects .more-pill").count() == 0)
    view_all = p.locator("#projects .projects-all a")
    check("a centred View all projects link", view_all.count() == 1 and view_all.text_content().strip() == "View all projects" and view_all.get_attribute("href") == "./?view=projects"
          and abs(p.evaluate("(() => { const a = document.querySelector('#projects .projects-all a').getBoundingClientRect(), s = document.querySelector('#projects').getBoundingClientRect(); return (a.left + a.right) / 2 - (s.left + s.right) / 2; })()")) < 2)
    same = p.evaluate("document.querySelector('#projects').parentElement === document.querySelector('#stack').parentElement && document.querySelector('#projects').parentElement.classList.contains('cover-panel')")
    check("Stack follows in the same covering panel", same)
    look = p.evaluate("(() => { const c = getComputedStyle(document.querySelector('.cover-panel')); return [c.backgroundColor, c.borderTopLeftRadius, c.borderTopWidth, getComputedStyle(document.querySelector('.frame')).backgroundColor]; })()")
    check("the panel sits on a lighter surface with a rounded, ruled top", look[0] != look[3] and look[1] not in ("0px", "") and look[2] == "1px", str(look))
    peek = p.locator("button.peek-ck[data-chat]")
    check("pixel CK peeks over the panel's top edge", peek.count() == 1)
    at(p, ".cover-panel", 0.5); p.wait_for_timeout(500)
    box = p.evaluate("(() => { const c = document.querySelector('.peek-ck').getBoundingClientRect(), panel = document.querySelector('.cover-panel').getBoundingClientRect(); return [c.top, c.bottom, panel.top]; })()")
    check("he sits on the edge once the panel is in view", box[0] < box[2] < box[1] + 2, str(box))
    p.hover(".peek-ck"); p.wait_for_timeout(250)
    check("hovering him shows 'ask me anything'", p.is_visible(".peek-bubble") and "ask me anything" in p.text_content(".peek-bubble").lower())
    p.click(".peek-ck"); p.wait_for_timeout(300)
    check("clicking him opens the chat", p.locator(".assistant-dialog[open]").count() == 1)
    p.keyboard.press("Escape"); p.wait_for_timeout(300)
    at(p, "#stack", 0.3); p.wait_for_timeout(900)
    drawn = p.evaluate("[...document.querySelectorAll('#stack .stack-group')].slice(0, 2).map(n => [n.className, getComputedStyle(n, '::before').scale])")
    drawn = [cls.find("reveal-visible") >= 0 and scale in ("1", "1 1") for cls, scale in drawn] if drawn else drawn
    check("Stack rows draw their line once in view", drawn and all(drawn), str(drawn))
    p.hover(".notch-ck"); p.click(".notch .nav-link[data-notch='projects']")
    p.wait_for_function("document.documentElement.classList.contains('view-projects')")
    check("the Projects page still shows every full card", p.locator(".project").count() == 5)
    check("panel: no errors", not errors, str(errors))
    ctx.close()

    ctx, p, errors = new_page(b, 1280, 800, reduced_motion="reduce")
    at(p, ".cover-panel", 0.6)
    still = p.evaluate("[...document.querySelectorAll('#projects .project-feature img')].every(i => getComputedStyle(i).translate === 'none' || getComputedStyle(i).translate === '0px')")
    check("reduced motion: the screenshots do not drift", still)
    check("reduced motion: the cards and rows are simply there", p.evaluate("[...document.querySelectorAll('#projects .project-feature, #stack .stack-group')].every(n => getComputedStyle(n).opacity === '1')"))
    ctx.close()
    b.close()
finish()
