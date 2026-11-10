"""In-place navigation retains the shell, cached content, drafts and history."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from common import URL, check, finish, offline_api

BASE = URL.split('#')[0].split('?')[0]
SHOTS = os.environ.get('SHOTS')
source = Path('/site/assets/data.js')
if not source.exists():
    source = Path(__file__).resolve().parents[2] / 'assets/data.js'
script = source.read_text()


def session(browser, width=1280, height=900, reduced='reduce', **options):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion=reduced, **options)
    offline_api(ctx)
    ctx.route('**/assets/data.js*', lambda route: route.fulfill(content_type='text/javascript', body=script))
    reads = []
    def notes(route):
        reads.append(route.request.method)
        route.fulfill(json={'entries': [], 'total': 0, 'nextCursor': None})
    ctx.route('**/api/guestbook*', notes)
    ctx.route('**/github-contributions-api.jogruber.de/**', lambda route: route.fulfill(json={'contributions': []}))
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    return ctx, page, errors, reads


NOTCH = ('projects', 'stack', 'more')


def click_view(page, view, phone=False):
    # Projects, Stack and More sit in the notch on wider screens; everything is in CK's menu.
    if view in NOTCH and not phone:
        page.click(f'.notch .nav-link[data-notch="{view}"]')
    else:
        page.click('.notch-ck')
        page.click(f'.ck-panel [data-view="{view}"]')
    page.wait_for_function('view => document.documentElement.classList.contains("view-" + view)', arg=view)


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx, page, errors, reads = session(browser)
    page.goto(BASE + '#contact')
    page.fill('#contact-message', 'A draft kept through page changes.')
    page.evaluate('window.shellProof = { notch: document.querySelector(".notch"), main: document.querySelector("main"), form: document.querySelector(".contact-form"), sky: document.querySelector(".sky"), origin: performance.timeOrigin }; document.querySelector("#assistant-input").value = "A chat draft";')
    documents = []
    page.on('request', lambda request: documents.append(request.url) if request.resource_type == 'document' else None)
    for view in ('links', 'more', 'projects', 'stack', 'resources', 'guestbook'):
        click_view(page, view)
        check(f'{view}: the shell and document survive', page.evaluate('shellProof.notch === document.querySelector(".notch") && shellProof.main === document.querySelector("main") && shellProof.sky === document.querySelector(".sky") && shellProof.origin === performance.timeOrigin'))
        lit = page.evaluate('[...document.querySelectorAll(".notch [aria-current]")].map(n => n.dataset.notch)')
        check(f'{view}: the notch lights its own link, or none', lit == ([view] if view in NOTCH else []), str(lit))
        check(f'{view}: CK\'s menu is closed after the visit', not page.locator('.ck-panel[open]').count())
    page.locator('.guestbook-form').wait_for(state='visible')
    page.fill('#guestbook-name', 'Browser fixture')
    click_view(page, 'links')
    click_view(page, 'guestbook')
    check('guestbook draft and loaded notes survive a return', page.input_value('#guestbook-name') == 'Browser fixture' and reads == ['GET'])
    check('contact and assistant drafts survive all page visits', page.input_value('#contact-message') == 'A draft kept through page changes.' and page.input_value('#assistant-input') == 'A chat draft' and page.evaluate('shellProof.form === document.querySelector(".contact-form")'))
    click_view(page, 'more')
    check('More about me keeps the fan deck and omits Now', page.locator('.deck.is-fan').count() == 1 and not page.is_visible('#now'))
    click_view(page, 'projects')
    page.evaluate('window.cachedCard = document.querySelector(".project")')
    page.locator('.project-open').first.click()
    page.wait_for_url('**/?view=case&p=ambiancy')
    check('project links open a case study in place', page.locator('.case-name').inner_text() == 'Ambiancy' and page.evaluate('shellProof.origin === performance.timeOrigin'))
    page.wait_for_function('document.querySelector(".sr-status").textContent === document.title')
    check('page changes are announced to screen readers', 'Ambiancy' in page.locator('.sr-status').text_content())
    page.click('.case-back:visible')
    check('returning restores the same project cards', page.evaluate('cachedCard === document.querySelector(".project")'))
    page.go_back()
    page.wait_for_selector('.case-name')
    check('Back restores the case-study route', page.locator('.case-name').inner_text() == 'Ambiancy')
    page.go_forward()
    page.wait_for_selector('.project-open')
    page.evaluate('window.scrollTo(0, 500)')
    page.wait_for_timeout(100)
    click_view(page, 'links')
    page.go_back()
    page.wait_for_function('document.documentElement.classList.contains("view-projects") && Math.abs(scrollY - 500) < 2')
    check('Back restores the previous scroll position', abs(page.evaluate('scrollY') - 500) < 2)
    click_view(page, 'resources')
    check('Resources lists its four groups, links opening in a new tab', page.locator('#resources .links-group:visible').count() == 4 and page.locator('#resources a.profile-link[target="_blank"]').count() == 12)
    page.click('.notch .nav-link[data-notch="home"]')
    page.wait_for_function('document.documentElement.classList.contains("is-home")')
    check('Home restores every project card under the same notch', page.locator('.project-row:visible').count() == 5 and page.evaluate('shellProof.notch === document.querySelector(".notch")') and page.get_attribute('.notch [aria-current]', 'data-notch') == 'home')
    if SHOTS:
        page.screenshot(path=f'{SHOTS}/navigation-home.png')
    check('internal visits made no document requests', documents == [], str(documents))
    check('desktop has no JavaScript errors', not errors, str(errors))
    ctx.close()

    ctx, page, errors, _ = session(browser, reduced='no-preference')
    page.goto(BASE + '?view=case&p=ambiancy')
    page.evaluate('window.firstNotch = document.querySelector(".notch")')
    page.click('.notch .nav-link[data-notch="home"]')
    check('Home from a direct case-study URL replays the poster intro', page.locator('html.intro-play').count() == 1)
    page.keyboard.press('Escape')
    check('a key press skips it and the same notch is in place', not page.locator('html.intro-play').count() and page.evaluate('firstNotch === document.querySelector(".notch") && firstNotch.getBoundingClientRect().top >= 0'))
    check('the Home preview hooks initialize when entering from another page', page.locator('.project-hover').count() == 1 and page.locator('.project-row').count() == 5)
    page.evaluate('document.querySelector("#about").scrollIntoView({behavior:"instant"})')
    page.wait_for_timeout(250)
    check('the notch stays pinned at the top while scrolling', page.evaluate('Math.abs(firstNotch.getBoundingClientRect().top) <= 1'))
    page.evaluate('scrollTo({top:0,behavior:"instant"})')
    page.wait_for_timeout(250)
    check('scrolling back to the poster does not replay the intro', not page.locator('html.intro-play').count())
    ctx.close()

    # Keyboard: CK's menu is reachable, traps focus like a dialog and gives it back.
    ctx, page, errors, _ = session(browser)
    page.goto(BASE + '#about')
    page.focus('.notch-ck')
    page.keyboard.press('Enter')
    check('Enter on CK opens his menu with focus inside', page.locator('.ck-panel[open]').count() == 1 and page.evaluate('!!document.activeElement.closest(".ck-panel")'))
    page.keyboard.press('Escape')
    check('Escape closes it and focus returns to CK', not page.locator('.ck-panel[open]').count() and page.evaluate('document.activeElement.matches(".notch-ck")'))
    page.click('.notch-ck'); page.mouse.click(5, 600)
    check('a click outside closes it', not page.locator('.ck-panel[open]').count())
    page.keyboard.press('t')
    check('T still toggles the theme with the menu closed', page.evaluate('document.documentElement.dataset.theme') == 'light')
    page.keyboard.press('Alt+k'); page.wait_for_timeout(200)
    check('Alt+K still opens chimken', page.locator('.game[open]').count() == 1)
    page.keyboard.press('Escape')
    page.keyboard.press('3'); page.wait_for_timeout(300)
    check('number keys still jump to Home sections', page.evaluate('Math.abs(document.querySelector("#projects").getBoundingClientRect().top) < 120'))
    ctx.close()

    # Deep links and no JavaScript: nothing is left hidden.
    ctx, page, errors, _ = session(browser, reduced='no-preference')
    page.goto(BASE + '#projects')
    page.wait_for_load_state('networkidle')
    where = page.evaluate('[document.documentElement.className, Math.round(document.querySelector("#projects").getBoundingClientRect().top)]')
    check('a #section link opens there without the intro', 'intro-play' not in where[0] and -40 <= where[1] <= 120, str(where))
    page.goto(BASE + '?view=case&p=ambiancy')
    check('a case study link opens with no intro and its title visible', not page.locator('html.intro-play').count() and page.is_visible('.case-name'))
    ctx.close()
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, java_script_enabled=False)
    page = ctx.new_page(); page.goto(BASE)
    check('without JavaScript the poster and the panels are visible', page.evaluate('getComputedStyle(document.querySelector(".poster-name")).clipPath === "none" && getComputedStyle(document.querySelector(".poster-title")).opacity === "1" && getComputedStyle(document.querySelector("#about")).display !== "none"'))
    ctx.close()

    ctx, page, errors, _ = session(browser, width=390, height=844, is_mobile=True, has_touch=True)
    page.goto(BASE + '?view=links')
    page.evaluate('window.phoneNotch = document.querySelector(".notch")')
    for view in ('more', 'projects', 'stack', 'guestbook', 'resources'):
        click_view(page, view, phone=True)
        check(f'phone {view}: CK\'s menu closes and the notch stays mounted', not page.locator('.ck-panel[open]').count() and page.evaluate('phoneNotch === document.querySelector(".notch")'))
    page.click('.notch-ck')
    page.click('.ck-panel .nav-link[data-notch="home"]')
    page.wait_for_function('document.documentElement.classList.contains("is-home")')
    check('phone Home has no overflow and the notch shows CK alone', page.evaluate('document.documentElement.scrollWidth <= innerWidth') and page.is_visible('.notch-ck') and not page.is_visible('.notch .nav-link'))
    if SHOTS:
        page.screenshot(path=f'{SHOTS}/navigation-phone.png')
    check('phone has no JavaScript errors', not errors, str(errors))
    ctx.close()
    browser.close()
finish()
