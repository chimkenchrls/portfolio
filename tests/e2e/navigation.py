"""In-place navigation retains the shell, cached content, drafts and history."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from common import URL, check, finish, offline_api

BASE = URL.split('#')[0].split('?')[0]
SHOTS = os.environ.get('SHOTS')
source = Path('/site/assets/data.js')
if not source.exists():
    source = Path(__file__).resolve().parents[2] / 'assets/data.js'
fixture = {'slug': 'navigation-fixture', 'title': 'Navigation fixture', 'excerpt': 'Synthetic browser fixture.', 'date': '2026-10-15', 'body': 'A test article, used only in this browser.'}
script = source.read_text() + '\nPORTFOLIO_DATA.writing.push(' + json.dumps(fixture) + ');'


def session(browser, width=1280, height=900, reduced='reduce', **options):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion=reduced, **options)
    offline_api(ctx, cover=True)
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


def click_view(page, view, phone=False):
    if phone:
        page.click('.menu-toggle')
    page.click(f'.nav-link[data-view="{view}"]')
    page.wait_for_function('view => document.documentElement.classList.contains("view-" + view)', arg=view)


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx, page, errors, reads = session(browser)
    page.goto(BASE + '#contact')
    page.fill('#contact-message', 'A draft kept through page changes.')
    page.wait_for_function('getComputedStyle(document.querySelector(".sidebar")).visibility === "visible"')
    page.evaluate('window.shellProof = { sidebar: document.querySelector(".sidebar"), main: document.querySelector("main"), form: document.querySelector(".contact-form"), sky: document.querySelector(".sky"), origin: performance.timeOrigin }; document.querySelector("#assistant-input").value = "A chat draft";')
    documents = []
    page.on('request', lambda request: documents.append(request.url) if request.resource_type == 'document' else None)
    for view in ('links', 'more', 'projects', 'stack', 'blog', 'guestbook'):
        click_view(page, view)
        check(f'{view}: the shell and document survive', page.evaluate('shellProof.sidebar === document.querySelector(".sidebar") && shellProof.main === document.querySelector("main") && shellProof.sky === document.querySelector(".sky") && shellProof.origin === performance.timeOrigin'))
        check(f'{view}: the current page is marked', page.get_attribute(f'.nav-link[data-view="{view}"]', 'aria-current') == 'page')
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
    page.wait_for_url('**view=case&p=ambiancy')
    check('project links open a case study in place', page.locator('.case-name').inner_text() == 'Ambiancy' and page.evaluate('shellProof.origin === performance.timeOrigin'))
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
    click_view(page, 'blog')
    page.click('a[href$="p=navigation-fixture"]')
    check('published posts render without reloading', page.locator('.writing-name').inner_text() == fixture['title'] and 'test article' in page.locator('.writing-body').inner_text())
    page.click('.case-back:visible')
    check('the Blog list returns after a post', page.locator('.writing-link').count() == 1)
    page.click('.collapse-toggle')
    check('the rail is enabled', page.locator('body.is-rail').count() == 1)
    click_view(page, 'stack')
    click_view(page, 'links')
    check('collapse state and nav counts remain stable', page.locator('body.is-rail').count() == 1 and page.locator('.nav-count').count() == 3)
    page.click('.collapse-toggle')
    page.click('.nav-link[data-section="home"]')
    check('Home restores every project row with navigation visible', page.locator('.project-row:visible').count() == 5 and page.locator('.sidebar').evaluate('n => getComputedStyle(n).visibility === "visible" && n.getBoundingClientRect().left >= 0'))
    if SHOTS:
        page.screenshot(path=f'{SHOTS}/navigation-home.png')
    check('internal visits made no document requests', documents == [], str(documents))
    check('desktop has no JavaScript errors', not errors, str(errors))
    ctx.close()

    ctx, page, errors, _ = session(browser, reduced='no-preference')
    page.goto(BASE + '?view=case&p=ambiancy')
    page.evaluate('window.firstSidebar = document.querySelector(".sidebar")')
    page.click('.nav-link[data-section="home"]')
    check('Home from a direct case-study URL replays the intro', page.locator('.intro-tiles').count() == 1 and page.locator('html.intro-play').count() == 1)
    check('the sidebar stays visible during that intro', page.evaluate('firstSidebar === document.querySelector(".sidebar") && getComputedStyle(firstSidebar).visibility === "visible" && firstSidebar.getBoundingClientRect().left >= 0'))
    page.keyboard.press('Escape')
    check('the Home preview hooks initialize when entering from another page', page.locator('.project-hover').count() == 1 and page.locator('.project-row').count() == 5)
    ctx.close()

    ctx, page, errors, _ = session(browser, width=390, height=844, is_mobile=True, has_touch=True)
    page.goto(BASE + '?view=links')
    page.evaluate('window.phoneSidebar = document.querySelector(".sidebar")')
    for view in ('more', 'projects', 'stack', 'guestbook', 'blog'):
        click_view(page, view, phone=True)
        check(f'phone {view}: the drawer closes and its DOM stays mounted', not page.locator('body.drawer-open').count() and page.evaluate('phoneSidebar === document.querySelector(".sidebar")'))
    page.click('.menu-toggle')
    page.click('.nav-link[data-section="home"]')
    check('phone Home keeps the top bar visible and has no overflow', page.locator('.topbar').evaluate('n => n.getBoundingClientRect().top >= 0') and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.wait_for_timeout(250)
    check('phone Home keeps the closed drawer offscreen', page.locator('.sidebar').evaluate('n => n.getBoundingClientRect().right <= 0'))
    if SHOTS:
        page.screenshot(path=f'{SHOTS}/navigation-phone.png')
    check('phone has no JavaScript errors', not errors, str(errors))
    ctx.close()
    browser.close()
finish()
