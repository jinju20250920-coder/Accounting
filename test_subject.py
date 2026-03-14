from playwright.sync_api import sync_playwright
import time
import sys

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    console_logs = []
    page.on('console', lambda msg: console_logs.append(msg.text))

    try:
        print('正在访问页面...')
        page.goto('http://localhost:3000/voucher-entry-page')
        page.wait_for_load_state('networkidle', timeout=30000)
        print('页面加载完成')

        # 检查错误
        js_errors = [log for log in console_logs if 'error' in log.lower()]
        if js_errors:
            print('发现 JavaScript 错误:')
            for error in js_errors:
                print(f'  - {error}')
        else:
            print('✅ 未发现 JavaScript 错误')

        # 点击第一行会计科目字段
        print('正在点击会计科目字段...')
        subject_cell = page.locator('[data-field="subject"]').first
        subject_cell.click()
        time.sleep(0.5)

        # 尝试输入完整的科目编码
        print('正在输入 "1001"...')
        search_input = page.locator('[data-variant="excel"]').first
        search_input.fill('1001')
        time.sleep(0.5)

        # 获取输入框的值
        input_value = search_input.input_value()
        print(f'输入框当前值: "{input_value}"')

        if input_value == '1001' or '1001' in input_value:
            print('✅ 成功输入完整的 1001')
        else:
            print(f'❌ 输入值不正确，期望包含 "1001"，实际是 "{input_value}"')

        # 等待搜索结果
        time.sleep(1)

        # 截图
        screenshot_path = 'D:/AI/ai-finance-assistant/test_input_1001.png'
        page.screenshot(path=screenshot_path, full_page=True)
        print(f'📸 已保存截图: {screenshot_path}')

        # 测试复制功能
        print('正在测试复制功能...')
        search_input.press('Control+A')
        time.sleep(0.2)
        search_input.press('Control+C')
        print('✅ 已执行复制操作 (Ctrl+C)')

        # 测试逐个字符删除
        print('正在测试逐个字符删除...')
        search_input.press('ArrowRight')  # 取消全选
        time.sleep(0.1)
        for i in range(4):
            search_input.press('Backspace')
            time.sleep(0.1)

        input_value_after_delete = search_input.input_value()
        print(f'删除后的输入框值: "{input_value_after_delete}"')

        if input_value_after_delete == '' or len(input_value_after_delete) < len(input_value):
            print('✅ 逐个字符删除功能正常')

        # 最终截图
        final_screenshot = 'D:/AI/ai-finance-assistant/test_final.png'
        page.screenshot(path=final_screenshot, full_page=True)
        print(f'📸 已保存最终截图: {final_screenshot}')

    except Exception as e:
        print(f'❌ 测试失败: {e}')
        import traceback
        traceback.print_exc()
        if console_logs:
            print('控制台日志:')
            for log in console_logs:
                print(f'  - {log}')
        sys.exit(1)
    finally:
        browser.close()
