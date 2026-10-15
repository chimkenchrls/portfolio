"""Now, Guestbook and project demos. Public notes below are browser fixtures only."""
import json
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
from common import URL, check, finish, offline_api

BASE = URL.split('#')[0].split('?')[0]
SHOTS = os.environ.get('SHOTS')
state = {'down': True, 'post': 'down', 'notes': []}
posted = []


def api(route):
    if route.request.method == 'POST':
        posted.append(json.loads(route.request.post_data))
        route.fulfill(status=503 if state['post'] == 'down' else 200, content_type='application/json', body=json.dumps({'ok': True, 'pending': True} if state['post'] == 'ok' else {'error': 'Unavailable'}))
        return
    if state['down']:
        route.fulfill(status=503, content_type='application/json', body='{"error":"Unavailable"}')
        return
    before = parse_qs(urlparse(route.request.url).query).get('before', [None])[0]
    notes = [entry for entry in state['notes'] if before is None or entry['id'] < int(before)]
    page = notes[:20]
    route.fulfill(content_type='application/json', body=json.dumps({'entries': page, 'total': len(state['notes']), 'nextCursor': str(page[-1]['id']) if len(notes) > 20 else None}))


def context(browser, width=1280, height=900, **opts):
    ctx = browser.new_context(viewport={'width': width, 'height': height}, reduced_motion='reduce', **opts)
    offline_api(ctx)
    ctx.route('**/api/guestbook*', api)
    ctx.route('**/github-contributions-api.jogruber.de/**', lambda r: r.abort())
    return ctx


def shot(page, name, selector=None):
    if not SHOTS:
        return
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(300)
    for video in page.locator('.demo-video').all():
        video.evaluate('async v => { const poster = new Image(); poster.src = v.poster; await poster.decode(); }')
        page.wait_for_function("document.querySelector('.demo-video').readyState >= 1")
    if selector:
        page.locator(selector).screenshot(path=f'{SHOTS}/{name}.png', animations='disabled')
    else:
        page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
        page.screenshot(path=f'{SHOTS}/{name}.png', full_page=True, animations='disabled')


with sync_playwright() as pw:
    browser = pw.chromium.launch()
    ctx = context(browser)
    if os.environ.get('REAL_GUESTBOOK') == '1':
        headers = {'Origin': BASE.rstrip('/')}
        before = ctx.request.get(BASE + 'api/guestbook', headers=headers)
        check('the real local API loads without provider keys', before.status == 200)
        total = before.json()['total']
        note = {'name': 'Integration test', 'message': 'A private local test note, never approved or published.', 'submissionId': uuid.uuid4().hex, 'website': ''}
        first = ctx.request.post(BASE + 'api/guestbook', headers=headers, data=note)
        again = ctx.request.post(BASE + 'api/guestbook', headers=headers, data=note)
        check('real HTTP submissions and retries stay pending', first.status == 200 and again.status == 200 and first.json().get('pending') is True and ctx.request.get(BASE + 'api/guestbook', headers=headers).json()['total'] == total)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE + '?view=guestbook', wait_until='domcontentloaded')
    page.locator('.guestbook-retry').wait_for(state='visible')
    check('an unavailable API shows a retry and keeps the form hidden', not page.is_visible('.guestbook-form') and page.is_visible('.guestbook-retry'))
    check('Guestbook is the current sidebar page and has no cover', page.get_attribute('[data-view="guestbook"]', 'aria-current') == 'page' and not page.locator('html.has-cover').count())
    state['down'] = False
    page.click('.guestbook-retry')
    page.locator('.guestbook-form').wait_for(state='visible')
    check('retry loads a real empty state with zero public notes', page.inner_text('.guestbook-total') == '0' and page.locator('.guestbook-entry').count() == 0)
    shot(page, 'guestbook-desktop')
    page.click('.guestbook-form .contact-send')
    check('empty notes stay on the page and focus the first missing field', not posted and page.evaluate('document.activeElement.id') == 'guestbook-name')
    page.fill('#guestbook-name', 'Test visitor')
    page.fill('#guestbook-message', 'A browser-test note. This is never posted to the public guestbook.')
    page.click('.guestbook-form .contact-send')
    page.wait_for_function("document.querySelector('.guestbook-submit-status').textContent.length > 0")
    check('a failed send preserves the draft', page.input_value('#guestbook-message').startswith('A browser-test note.'))
    state['post'] = 'ok'
    page.click('.guestbook-form .contact-send')
    page.wait_for_function("document.querySelector('.guestbook-submit-status').textContent.includes('review')")
    check('retry reuses its submission token, confirms review, and clears the form', len(posted) == 2 and posted[0]['submissionId'] == posted[1]['submissionId'] and page.input_value('#guestbook-message') == '')
    check('a pending note never appears as an approved public note', page.locator('.guestbook-entry').count() == 0)

    state['notes'] = [{'id': n, 'name': 'Test visitor', 'message': f'Browser fixture {n}.', 'createdAt': '2026-10-15T00:00:00Z'} for n in range(50, 29, -1)]
    page.reload(wait_until='domcontentloaded')
    page.locator('.guestbook-more').wait_for(state='visible')
    check('the first page is bounded to 20 notes', page.locator('.guestbook-entry').count() == 20)
    page.click('.guestbook-more')
    page.wait_for_function("document.querySelectorAll('.guestbook-entry').length === 21")
    check('pagination appends the remaining note without a duplicate and keeps focus in the list', not page.is_visible('.guestbook-more') and page.evaluate("!!document.activeElement.closest('.guestbook-list')"))
    state['notes'] = [{'id': 2, 'name': '<img src=x onerror=alert(1)>', 'message': '<script>alert(1)</script>', 'createdAt': '2026-10-15T00:00:00Z'}]
    page.reload(wait_until='domcontentloaded')
    page.locator('.guestbook-entry').wait_for()
    check('visitor markup is displayed as text', page.locator('.guestbook-entry img, .guestbook-entry script').count() == 0 and page.inner_text('.guestbook-message') == '<script>alert(1)</script>')

    page.goto(BASE + '?view=more', wait_until='domcontentloaded')
    check('Now appears on More about me with its real update date', page.is_visible('#now') and page.get_attribute('#now time', 'datetime') == '2026-10-15')
    shot(page, 'more-desktop')
    shot(page, 'now-desktop', '#now')
    page.goto(BASE + '?view=case&p=ambiancy', wait_until='domcontentloaded')
    video = page.locator('.demo-video')
    video.wait_for()
    check('the case study has a user-controlled video and captions', page.is_visible('.demo-play') and video.get_attribute('preload') == 'metadata' and video.locator('track[kind="captions"]').count() == 1 and video.get_attribute('autoplay') is None)
    video.scroll_into_view_if_needed()
    page.click('.demo-play')
    page.wait_for_function("document.querySelector('.demo-video').currentTime > 0.3")
    video.evaluate('v => v.pause()')
    check('the actual MP4 decodes and plays in the browser', video.evaluate('v => !v.error && v.controls && v.videoWidth === 1280 && v.videoHeight === 800') and not page.is_visible('.demo-play'))
    page.wait_for_function("Math.abs(document.querySelector('.sidebar').getBoundingClientRect().width - 248) < 1")
    check('the desktop sidebar retains its full width on the case study', page.locator('.sidebar').evaluate('n=>Math.abs(n.getBoundingClientRect().width-248)<1'))
    shot(page, 'demo-desktop')
    page.goto(BASE + '?view=case&p=thready', wait_until='domcontentloaded')
    check('projects without a recording do not show an empty player', page.locator('.demo-video').count() == 0)
    page.goto(BASE + '#about', wait_until='domcontentloaded')
    check('Now and Guestbook are absent from Home', not page.is_visible('#now') and not page.is_visible('#guestbook'))
    check('no browser errors on desktop', not errors, '; '.join(errors))
    ctx.close()

    state['notes'] = [{'id': 1, 'name': 'Test visitor', 'message': 'A fixture for checking how a visitor note wraps on a phone.', 'createdAt': '2026-10-15T00:00:00Z'}]
    ctx = context(browser, 390, 844, is_mobile=True, has_touch=True)
    page = ctx.new_page()
    page.goto(BASE + '?view=guestbook', wait_until='domcontentloaded')
    page.locator('.guestbook-form').wait_for(state='visible')
    check('phone: the guestbook fits and inputs avoid iOS zoom', page.evaluate('document.documentElement.scrollWidth <= innerWidth') and page.locator('#guestbook-name').evaluate('n=>getComputedStyle(n).fontSize') == '16px')
    shot(page, 'guestbook-mobile')
    page.goto(BASE + '?view=more', wait_until='domcontentloaded')
    check('phone: Now remains readable without horizontal overflow', page.is_visible('#now') and page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    shot(page, 'more-mobile')
    shot(page, 'now-mobile', '#now')
    page.goto(BASE + '?view=case&p=ambiancy', wait_until='domcontentloaded')
    check('phone: the demo fits and waits for the visitor to press play', page.is_visible('.demo-play') and page.locator('.demo-video').evaluate('v=>v.getBoundingClientRect().width <= innerWidth && v.paused && !v.controls'))
    shot(page, 'demo-mobile')
    ctx.close()
    browser.close()
finish()
