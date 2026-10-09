"""Run against a local Vite server with Python Playwright installed."""

import argparse
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5173')
args = parser.parse_args()

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel='chromium')
    try:
        page = browser.new_page()
        errors = []
        page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        page.wait_for_load_state('networkidle')
        expect(page.get_by_role('heading', name='Lim Tools Web', exact=True)).to_be_visible()

        search = page.get_by_placeholder('输入「瓜」试试')
        search.fill('瓜')
        expect(page.get_by_text('匹配到：西瓜、哈密瓜', exact=True)).to_be_visible()
        page.get_by_role('button', name='聚焦', exact=True).click()
        expect(search).to_be_focused()

        subscribe = page.locator('form').filter(has=page.get_by_placeholder('you@example.com'))
        subscribe.get_by_role('button', name='订阅', exact=True).click()
        expect(subscribe.get_by_text('邮箱格式看起来不太对', exact=True)).to_be_visible()
        subscribe.get_by_placeholder('you@example.com').fill('test@example.com')
        subscribe.get_by_role('button', name='订阅', exact=True).click()
        expect(subscribe.get_by_text('已订阅 test@example.com', exact=True)).to_be_visible()

        page.get_by_role('button', name='加载待办', exact=True).click()
        expect(page.get_by_text('加载中…', exact=True)).to_be_visible()
        expect(page.get_by_text('form action 直接用 async 函数', exact=True)).to_be_visible()
        page.get_by_role('button', name='重新加载', exact=True).click()
        expect(page.get_by_text('加载中…', exact=True)).to_be_visible()
        expect(page.get_by_text('form action 直接用 async 函数', exact=True)).to_be_visible()

        page.get_by_role('button', name='+2000 条', exact=True).click()
        expect(page.get_by_text('2300 / 2300 条', exact=True)).to_be_visible()
        page.get_by_placeholder('筛选条目').fill('2300')
        expect(page.get_by_text('1 / 2300 条', exact=True)).to_be_visible()

        form = page.locator('form').filter(has=page.get_by_placeholder('说点什么'))
        text = form.get_by_placeholder('说点什么')
        send = form.get_by_role('button', name='发送', exact=True)
        text.fill('repeat')
        send.click()
        expect(form.get_by_text('repeat · 发送中', exact=True)).to_have_count(1)
        text.fill('repeat')
        send.click()
        expect(form.get_by_text('repeat · 发送中', exact=True)).to_have_count(2)
        text.fill('draft while sending')
        expect(form.get_by_text('repeat', exact=True)).to_have_count(2)
        expect(form.get_by_text('repeat · 发送中', exact=True)).to_have_count(0)
        expect(text).to_have_value('draft while sending')

        old_dark = page.locator('html').evaluate("element => element.classList.contains('dark')")
        page.get_by_role('button', name='切换主题', exact=True).click()
        expected_theme = 'light' if old_dark else 'dark'
        page.wait_for_function("theme => localStorage.getItem('lim-tools-theme') === theme", arg=expected_theme)
        page.reload()
        page.wait_for_load_state('networkidle')
        assert page.locator('html').evaluate("element => element.classList.contains('dark')") != old_dark
        assert not errors, f'Browser errors: {errors}'
        print('Browser smoke passed: search, forms, loading, filtering, concurrent messages, theme persistence')
    finally:
        browser.close()
