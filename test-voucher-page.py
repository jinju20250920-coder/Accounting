from playwright.sync_api import sync_playwright
import os

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    page.goto('http://localhost:3000/voucher-entry-page')
    page.wait_for_load_state('networkidle')

    # 截图保存
    screenshot_path = os.path.join(os.path.dirname(__file__), 'voucher-entry-screenshot.png')
    page.screenshot(path=screenshot_path, full_page=True)
    print(f'Screenshot saved to: {screenshot_path}')

    # 获取页面内容
    content = page.content()
    print(f'\nPage loaded successfully. Title: {page.title()}')

    # 查找输入框
    inputs = page.locator('input').all()
    print(f'\nFound {len(inputs)} input elements')

    browser.close()
