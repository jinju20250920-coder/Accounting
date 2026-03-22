from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)  # 设置为 False 可以看到浏览器
    page = browser.new_page()

    # 导航到应收账龄分析页面
    print("正在导航到应收账龄分析页面...")
    page.goto('http://localhost:3000/aging/ar')

    # 等待页面加载
    page.wait_for_load_state('networkidle')
    print("页面已加载")

    # 截图以便查看
    page.screenshot(path='ar_aging_screenshot.png', full_page=True)
    print("截图已保存为 ar_aging_screenshot.png")

    # 检查页面是否包含"账龄分析汇总"标题
    summary_title = page.locator('text=账龄分析汇总')
    if summary_title.count() > 0:
        print("✓ 找到了账龄分析汇总标题")
    else:
        print("✗ 未找到账龄分析汇总标题")

    # 检查是否有表格
    table = page.locator('table')
    if table.count() > 0:
        print(f"✓ 找到了 {table.count()} 个表格")

        # 检查表格内容
        first_table = table.first
        rows = first_table.locator('tr')
        if rows.count() > 0:
            print(f"✓ 表格有 {rows.count()} 行")

            # 检查表头是否有"往来单位"
            header = first_table.locator('thead')
            if header.count() > 0:
                partner_header = header.locator('text=往来单位')
                if partner_header.count() > 0:
                    print("✓ 找到了往来单位表头")
                else:
                    print("✗ 未找到往来单位表头")
    else:
        print("✗ 未找到表格")

    # 检查页面内容
    page_content = page.content()
    if '往来单位' in page_content:
        print("✓ 页面包含往来单位文本")
    if '0-30天' in page_content:
        print("✓ 页面包含账龄区间文本")

    browser.close()
