"""Browser regression against a real Go server, with isolated test-created files."""
import argparse
import csv
import io
import json
import re
import time
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:5173')
args = parser.parse_args()
base = args.url.rstrip('/')
artifacts = Path(__file__).parent / 'artifacts'
artifacts.mkdir(exist_ok=True)


def ready(page):
    page.wait_for_load_state('networkidle')
    expect(page.get_by_role('button', name='保存', exact=True)).to_be_enabled(timeout=20000)
    expect(page.locator('[data-u-comp=workbench-skeleton-content]')).not_to_be_visible()


def book_id(page):
    return page.url.rsplit('/', 1)[-1]


def select(page, address):
    field = page.locator('[data-u-comp=defined-name] input')
    field.fill(address)
    field.press('Enter')


def enter(page, address, text):
    select(page, address)
    if text.isascii():
        page.keyboard.type(text, delay=20)
    else:
        page.evaluate('(text)=>navigator.clipboard.writeText(text)', text)
        page.keyboard.press('Control+v')
    page.keyboard.press('Enter')


def sheet(book, name=None):
    snapshot = book['snapshot']
    return next((value for value in snapshot['sheets'].values() if value['name'] == name), {}) if name else snapshot['sheets'][snapshot['sheetOrder'][0]]


def value(book, row, column, name=None):
    return sheet(book, name).get('cellData', {}).get(str(row), {}).get(str(column), {}).get('v')


def wait_book(context, id, predicate, timeout=15):
    deadline = time.monotonic() + timeout
    latest = None
    while time.monotonic() < deadline:
        response = context.request.get(f'{base}/api/v1/workbooks/{id}')
        assert response.ok, response.text()
        latest = response.json()
        if predicate(latest):
            return latest
        time.sleep(.1)
    raise AssertionError(f'Workbook condition did not become true: {json.dumps(latest, ensure_ascii=False)[:1600]}')


def download(page, name):
    page.locator('.export-menu').click()
    with page.expect_download() as pending:
        # antd Dropdown renders its entries as menu items, not buttons.
        page.get_by_role('menuitem', name=name).click()
    result = pending.value
    path = artifacts / result.suggested_filename
    result.save_as(path)
    return path


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440, 'height':960}, permissions=['clipboard-read', 'clipboard-write'])
    created_ids = set()
    errors = []
    console_errors = []

    def record_response(response):
        if response.request.method == 'POST' and response.url.endswith('/api/v1/workbooks') and response.status == 201:
            created_ids.add(response.json()['id'])

    def observe(page):
        page.on('response', record_response)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)

    page = context.new_page()
    observe(page)
    try:
        page.goto(base)
        page.wait_for_load_state('networkidle')
        expect(page.get_by_role('heading', name='我的表格', exact=True)).to_be_visible()
        page.screenshot(path=str(artifacts/'library.png'), full_page=True)
        page.get_by_role('button', name='项目预算示例').click()
        ready(page)
        id = book_id(page)
        assert id in created_ids
        initial = context.request.get(f'{base}/api/v1/workbooks/{id}').json()
        assert initial['revision'] == 1, 'Opening the editor unexpectedly saved a revision'

        name = f'E2E 预算 {time.time_ns()}'
        page.get_by_role('textbox', name='表格名称', exact=True).fill(name)
        page.get_by_role('textbox', name='表格名称', exact=True).press('Enter')
        wait_book(context, id, lambda book: book['name'] == name)
        enter(page, 'C2', '15')
        calculated = wait_book(context, id, lambda book: value(book,1,2)==15 and value(book,1,4)==9000 and value(book,7,4)==43400)
        enter(page, 'F12', '=SUM(C2:C6)')
        wait_book(context, id, lambda book: value(book,11,5)==63)
        select(page, 'C2')
        page.get_by_role('button', name='粗体', exact=True).click()
        styled = wait_book(context, id, lambda book: (book['snapshot']['styles'].get(sheet(book)['cellData']['1']['2'].get('s'), {}) if isinstance(sheet(book)['cellData']['1']['2'].get('s'), str) else sheet(book)['cellData']['1']['2'].get('s', {})).get('bl')==1)
        print('Passed: create, rename, direct cell editing, multiplication, SUM, bold format', flush=True)

        select(page, 'A2')
        page.keyboard.press('Control+c')
        select(page, 'A12')
        page.keyboard.press('Control+v')
        wait_book(context, id, lambda book: value(book,11,0)=='设计与原型')
        enter(page, 'B12', '撤销检查')
        page.get_by_role('button', name='撤销', exact=True).click()
        wait_book(context, id, lambda book: value(book,11,1) is None)
        page.get_by_role('button', name='重做', exact=True).click()
        wait_book(context, id, lambda book: value(book,11,1)=='撤销检查')
        select(page, 'H2:I2')
        page.get_by_role('button', name='合并单元格', exact=True).click()
        page.get_by_text('全部合并', exact=True).click()
        wait_book(context, id, lambda book: any(item['startRow']==1 and item['startColumn']==7 and item['endColumn']==8 for item in sheet(book)['mergeData']))
        print('Passed: copy/paste, undo/redo, merged cells', flush=True)

        page.get_by_role('button', name='查找与替换', exact=True).click()
        dialog = page.get_by_role('dialog')
        expect(dialog).to_be_visible()
        dialog.get_by_placeholder('输入查找内容').fill('撤销检查')
        dialog.get_by_placeholder('输入替换内容').fill('替换完成')
        dialog.get_by_role('button', name='查找', exact=True).click()
        dialog.get_by_role('button', name='替换', exact=True).click()
        wait_book(context, id, lambda book: value(book,11,1)=='替换完成')
        dialog.get_by_role('button', name='Close', exact=True).click()

        page.locator('[data-u-comp=sheet-bar-append-button]').first.click()
        expect(page.get_by_role('tab')).to_have_count(2)
        page.get_by_role('tab').last.click(button='right')
        page.get_by_role('button', name='重命名', exact=True).click()
        rename = page.locator('[contenteditable=true]:visible')
        rename.wait_for(state='visible')
        rename.fill('数据处理')
        rename.press('Enter')
        expect(page.get_by_role('tab', name='数据处理', exact=True)).to_be_visible()
        select(page, 'A1')
        page.evaluate('(text)=>navigator.clipboard.writeText(text)', '编号\t名称\n3\t丙\n1\t甲\n2\t乙')
        page.keyboard.press('Control+v')
        wait_book(context, id, lambda book: value(book,1,0,'数据处理')==3 and value(book,3,1,'数据处理')=='乙')
        select(page, 'A2:B4')
        page.locator('.data-tools').get_by_role('button', name='数据').click()
        page.get_by_role('menuitem', name='按选区首列升序').click()
        wait_book(context, id, lambda book: value(book,1,0,'数据处理')==1 and value(book,3,0,'数据处理')==3)
        select(page, 'A1:B4')
        page.locator('.data-tools').get_by_role('button', name='数据').click()
        page.get_by_role('menuitem', name='开启 / 关闭筛选').click()
        filtered = wait_book(context, id, lambda book: any(resource['name']=='SHEET_FILTER_PLUGIN' and any(item.get('ref', {}).get('endRow')==3 for item in json.loads(resource['data'] or '{}').values()) for resource in book['snapshot'].get('resources',[])))
        page.get_by_role('tab', name='数据处理', exact=True).click(button='right')
        page.get_by_role('button', name='复制', exact=True).click()
        expect(page.get_by_role('tab')).to_have_count(3)
        page.get_by_role('tab').last.click(button='right')
        page.get_by_role('button', name='删除', exact=True).click()
        page.get_by_role('dialog').get_by_role('button', name='确定', exact=True).click()
        expect(page.get_by_role('tab')).to_have_count(2)
        saved = wait_book(context, id, lambda book: len(book['snapshot']['sheetOrder'])==2)
        page.get_by_role('tab', name='预算明细', exact=True).click()
        assert sheet(saved)['freeze']['ySplit']==1
        page.reload()
        ready(page)
        expect(page.get_by_role('tab')).to_have_count(2)
        reopened = context.request.get(f'{base}/api/v1/workbooks/{id}').json()
        assert reopened['revision']==saved['revision'], 'Reloading created an unnecessary revision'
        assert value(reopened,1,2)==15 and value(reopened,11,1)=='替换完成'
        print('Passed: find/replace, multiple sheets, rename/copy/delete sheet, sort/filter, frozen header and refresh persistence', flush=True)
        page.screenshot(path=str(artifacts/'editor.png'), full_page=True)

        csv_path = download(page, '当前工作表 · CSV')
        rows = list(csv.reader(io.StringIO(csv_path.read_text(encoding='utf-8-sig'))))
        assert rows[1][2]=='15' and rows[1][4]=='9000' and rows[11][1]=='替换完成'
        backup_path = download(page, '完整表格 · JSON 备份')
        backup = json.loads(backup_path.read_text(encoding='utf-8'))
        assert len(backup['snapshot']['sheetOrder'])==2
        assert sheet({'snapshot':backup['snapshot']})['cellData']['11']['5']['f']=='=SUM(C2:C6)'

        held = []
        pattern = f'**/api/v1/workbooks/{id}'
        def hold_first(route):
            if route.request.method=='PUT' and not held:
                held.append(route)
            else:
                route.continue_()
        page.route(pattern, hold_first)
        page.get_by_role('textbox', name='表格名称', exact=True).fill(name+' first')
        expect(page.locator('.save-status')).to_contain_text('正在保存', timeout=10000)
        assert held
        page.get_by_role('textbox', name='表格名称', exact=True).fill(name+' last')
        held[0].continue_()
        wait_book(context, id, lambda book: book['name']==name+' last')
        page.unroute(pattern, hold_first)
        expect(page.locator('.save-status')).to_contain_text('已保存')
        print('Passed: CSV/JSON export and edits during an in-flight save', flush=True)

        def fail_save(route):
            if route.request.method=='PUT':
                route.fulfill(status=503, content_type='application/json', body=json.dumps({'code':'test_outage','message':'测试连接中断，请重试保存。'}, ensure_ascii=False))
            else:
                route.continue_()
        page.route(pattern, fail_save)
        enter(page, 'A15', '断网草稿')
        expect(page.locator('.save-status')).to_contain_text('保存失败', timeout=10000)
        page.get_by_role('button', name='返回我的表格', exact=True).click()
        # The unsaved-changes guard is an antd Modal now, not a native confirm.
        page.get_by_role('dialog').get_by_role('button', name='留在本页', exact=True).click()
        expect(page).to_have_url(re.compile(f'#/workbooks/{id}$'))
        expect(page.get_by_role('textbox', name='表格名称', exact=True)).to_be_visible()
        page.unroute(pattern, fail_save)
        page.locator('.editor-actions').get_by_role('button', name='重试保存', exact=True).click()
        wait_book(context, id, lambda book: value(book,14,0)=='断网草稿')
        print('Passed: save failure, unsaved navigation protection and real retry', flush=True)

        second = context.new_page()
        observe(second)
        second.goto(page.url)
        ready(second)
        enter(page, 'A16', '第一个页面')
        wait_book(context, id, lambda book: value(book,15,0)=='第一个页面')
        enter(second, 'A17', '第二个页面')
        expect(second.locator('.save-status')).to_contain_text('版本冲突', timeout=10000)
        expect(second.get_by_role('alert')).to_contain_text('其他页面已更新')
        current = context.request.get(f'{base}/api/v1/workbooks/{id}').json()
        assert value(current,15,0)=='第一个页面' and value(current,16,0) is None
        second.get_by_role('alert').get_by_role('button', name='另存副本', exact=True).click()
        ready(second)
        copy_id = book_id(second)
        assert copy_id != id
        wait_book(context, copy_id, lambda book: value(book,16,0)=='第二个页面')
        second.close()
        print('Passed: two-page conflict prevents overwrite and preserves changes in a copy', flush=True)

        page.get_by_role('button', name='返回我的表格', exact=True).click()
        expect(page.get_by_role('heading', name='我的表格', exact=True)).to_be_visible()
        page.get_by_role('textbox', name='搜索表格', exact=True).fill(name+' last')
        expect(page.locator('.file-row')).to_have_count(2)
        page.get_by_role('textbox', name='搜索表格', exact=True).fill('no-match-for-this-search')
        expect(page.get_by_role('heading', name='没有匹配的表格')).to_be_visible()
        page.get_by_role('textbox', name='搜索表格', exact=True).fill('')
        page.get_by_label('导入 CSV 或 JSON 备份').set_input_files(backup_path)
        ready(page)
        restored_id = book_id(page)
        restored = context.request.get(f'{base}/api/v1/workbooks/{restored_id}').json()
        assert len(restored['snapshot']['sheetOrder'])==2 and value(restored,1,2)==15
        assert sheet(restored)['cellData']['11']['5']['f']=='=SUM(C2:C6)'
        page.get_by_role('button', name='返回我的表格', exact=True).click()
        expect(page.get_by_role('heading', name='我的表格', exact=True)).to_be_visible()
        csv_import = artifacts/'CSV 导入检查.csv'
        csv_import.write_text('编号,文本,数量\n00123,=SUM(A1:A5),10\n9007199254740993,"带逗号,的文字",-5', encoding='utf-8-sig')
        page.get_by_label('导入 CSV 或 JSON 备份').set_input_files(csv_import)
        ready(page)
        imported_id = book_id(page)
        imported = context.request.get(f'{base}/api/v1/workbooks/{imported_id}').json()
        assert value(imported,1,0)=='00123' and value(imported,1,1)=='=SUM(A1:A5)' and value(imported,1,2)==10
        assert value(imported,2,0)=='9007199254740993'
        page.set_viewport_size({'width':390,'height':844})
        expect(page.get_by_role('textbox', name='表格名称', exact=True)).to_be_visible()
        page.screenshot(path=str(artifacts/'editor-mobile.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
        page.get_by_role('button', name='返回我的表格', exact=True).click()
        expect(page.get_by_role('heading', name='我的表格', exact=True)).to_be_visible()
        page.screenshot(path=str(artifacts/'library-mobile.png'), full_page=True)
        assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
        page.get_by_role('textbox', name='搜索表格', exact=True).fill('CSV 导入检查')
        page.get_by_role('button', name='删除 CSV 导入检查', exact=True).click()
        page.get_by_role('dialog').get_by_role('button', name='删除表格', exact=True).click()
        expect(page.get_by_role('heading', name='没有匹配的表格')).to_be_visible()
        created_ids.discard(imported_id)
        print('Passed: library search, full backup restore, safe CSV import, responsive layouts and file deletion', flush=True)
        assert not errors, f'JavaScript errors: {errors}'
        unexpected = [message for message in console_errors if '503' not in message and '409' not in message]
        assert not unexpected, f'Unexpected console errors: {unexpected}'
        print('Browser smoke passed', flush=True)
    except Exception:
        page.screenshot(path=str(artifacts/'failure.png'), full_page=True)
        print('Failure URL:', page.url, flush=True)
        print('Browser errors:', errors, flush=True)
        raise
    finally:
        context.close()
        # Delete only IDs recorded from this test's own POST responses.
        cleanup = browser.new_context()
        for id in created_ids:
            response = cleanup.request.get(f'{base}/api/v1/workbooks/{id}')
            if response.ok:
                cleanup.request.delete(f"{base}/api/v1/workbooks/{id}?revision={response.json()['revision']}")
        cleanup.close()
        browser.close()
