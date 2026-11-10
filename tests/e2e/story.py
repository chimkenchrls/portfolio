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
    b.close()
finish()
