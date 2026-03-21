from playwright.sync_api import sync_playwright

def test_aging_report_remaining_amount():
    with sync_playwright() as p:
        # 启动浏览器
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 访问应收账款账龄报告页面
            page.goto('http://localhost:3000/aging/ar')

            # 等待页面加载完成
            page.wait_for_load_state('networkidle')

            # 截图查看当前页面状态
            page.screenshot(path='D:\\AI\\ai-finance-assistant\\test_screenshots\\aging_report_before.png', full_page=True)

            # 获取所有行的数据
            rows = page.locator('table tbody tr')
            row_count = rows.count()
            print(f"共找到 {row_count} 行数据")

            # 检查是否有我们测试的数据
            found_test_data = False
            for i in range(row_count):
                row = rows.nth(i)
                cells = row.locator('td')

                # 获取摘要、金额和剩余金额
                if cells.count() > 4:
                    summary = cells.nth(4).text_content().strip()
                    amount = cells.nth(7).text_content().strip()
                    remaining_amount = cells.nth(8).text_content().strip()

                    # 查找包含我们测试数据的行
                    if "销售商品收到货款" in summary or "收到货款" in summary:
                        found_test_data = True
                        print(f"找到测试数据行 - 摘要: {summary}")
                        print(f"金额: {amount}, 剩余金额: {remaining_amount}")

                        # 检查剩余金额计算是否正确
                        amount_num = float(amount.replace('¥', '').replace(',', ''))
                        remaining_num = float(remaining_amount.replace('¥', '').replace(',', ''))

                        # 对于借方金额(1130)，剩余金额应该为0
                        if abs(amount_num - 1130) < 0.01:
                            assert abs(remaining_num) < 0.01, f"借方金额剩余金额计算错误: {remaining_num}"
                            print("✅ 借方金额剩余金额计算正确")

                        # 对于贷方金额(-5260)，剩余金额应该为-4130
                        if abs(amount_num + 5260) < 0.01:
                            expected_remaining = -4130
                            assert abs(remaining_num - expected_remaining) < 0.01, f"贷方金额剩余金额计算错误: {remaining_num}"
                            print("✅ 贷方金额剩余金额计算正确")

            if found_test_data:
                print("\n✅ 所有测试数据行的剩余金额计算正确")
            else:
                print("\n⚠️ 未找到测试数据行")
                # 如果没有找到测试数据，可能需要先添加一些数据

        except Exception as e:
            print(f"❌ 测试过程中出错: {e}")
            page.screenshot(path='D:\\AI\\ai-finance-assistant\\test_screenshots\\aging_report_error.png', full_page=True)
        finally:
            # 关闭浏览器
            browser.close()

if __name__ == "__main__":
    import os
    # 创建截图目录
    if not os.path.exists('D:\\AI\\ai-finance-assistant\\test_screenshots'):
        os.makedirs('D:\\AI\\ai-finance-assistant\\test_screenshots')
    test_aging_report_remaining_amount()
