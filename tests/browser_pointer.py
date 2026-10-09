"""Regression for real canvas header menus, insertion/deletion and sizing."""
import argparse
import re
import time
from playwright.sync_api import sync_playwright, expect
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url',default='http://127.0.0.1:5173')
args=parser.parse_args()
base=args.url.rstrip('/')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1440,'height':960})
    page=context.new_page()
    id=None
    def stored(predicate):
        deadline=time.monotonic()+10
        while time.monotonic()<deadline:
            book=context.request.get(base+'/api/v1/workbooks/'+id).json()
            snapshot=book['snapshot']['sheets'][book['snapshot']['sheetOrder'][0]]
            if predicate(snapshot):
                return snapshot
            time.sleep(.1)
        raise AssertionError('Header operation was not saved: '+str(snapshot)[:400])
    try:
        page.goto(base)
        page.get_by_role('button',name='新建表格',exact=True).click()
        expect(page.get_by_role('button',name='保存',exact=True)).to_be_enabled(timeout=20000)
        id=page.url.rsplit('/',1)[-1]
        canvas=page.locator('canvas[id^=univer-sheet-main-canvas]')
        row={'x':20,'y':62}
        canvas.click(position=row,button='right')
        # The button's accessible name also includes its row-count input.
        page.get_by_role('button',name=re.compile('^在上方插入')).click()
        stored(lambda snapshot:snapshot['rowCount']==1001)
        canvas.click(position=row,button='right')
        page.get_by_role('button',name='删除选中行',exact=True).click()
        stored(lambda snapshot:snapshot['rowCount']==1000)
        canvas.click(position=row,button='right')
        height=page.get_by_role('button',name=re.compile('^行高 ')).get_by_role('textbox')
        height.fill('42')
        page.get_by_role('button',name=re.compile('^行高 ')).click(position={'x':12,'y':12})
        stored(lambda snapshot:snapshot.get('rowData',{}).get('1',{}).get('h')==42)
        canvas.click(position={'x':210,'y':10},button='right')
        page.get_by_role('button',name=re.compile('^在左侧插入')).click()
        stored(lambda snapshot:snapshot['columnCount']==27)
        canvas.click(position={'x':210,'y':10},button='right')
        page.get_by_role('button',name='删除选中列',exact=True).click()
        stored(lambda snapshot:snapshot['columnCount']==26)
        canvas.click(position={'x':210,'y':10},button='right')
        width=page.get_by_role('button',name=re.compile('^列宽 ')).get_by_role('textbox')
        width.fill('160')
        page.get_by_role('button',name=re.compile('^列宽 ')).click(position={'x':12,'y':12})
        stored(lambda snapshot:snapshot.get('columnData',{}).get('1',{}).get('w')==160)
        print('Pointer regression passed: row/column insert, delete, height and width persist',flush=True)
    finally:
        context.close()
        if id:
            cleanup=browser.new_context()
            response=cleanup.request.get(base+'/api/v1/workbooks/'+id)
            if response.ok:
                cleanup.request.delete(base+'/api/v1/workbooks/'+id+'?revision='+str(response.json()['revision']))
            cleanup.close()
        browser.close()
