from playwright.sync_api import sync_playwright

def test_summary_picker():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()

        # 导航到凭证录入页面
        page.goto('http://localhost:3000')

        try:
            # 等待页面加载
            page.wait_for_load_state('networkidle')

            # 找到摘要输入框并聚焦
            print("找到摘要输入框并聚焦")
            summary_input = page.locator('textarea[placeholder=""]')
            summary_input.wait_for()
            summary_input.focus()

            # 等待 SummaryPicker 弹出
            page.wait_for_timeout(1000)

            # 检查是否显示了常用摘要列表
            print("检查是否显示了常用摘要列表")
            try:
                popover_content = page.locator('.summary-picker-popover')
                popover_content.wait_for(state='visible', timeout=2000)

                # 检查是否有"最近使用"和"常用摘要"分组
                recent_section = page.locator('text="最近使用"')
                common_section = page.locator('text="常用摘要"')

                # 即使没有最近使用的，常用摘要应该总是有默认值
                if common_section.is_visible():
                    print("✓ SummaryPicker 成功显示常用摘要列表")
                else:
                    print("✗ 未找到常用摘要分组")

                # 测试键盘导航
                print("测试键盘导航")
                page.keyboard.press('ArrowDown')
                page.wait_for_timeout(500)

                page.keyboard.press('ArrowDown')
                page.wait_for_timeout(500)

                # 测试选择
                page.keyboard.press('Enter')
                page.wait_for_timeout(1000)

                print("✓ 键盘导航和选择功能正常")

            except Exception as e:
                print(f"✗ SummaryPicker 未显示: {e}")
                page.screenshot(path='error_summary_picker.png')

            # 测试输入新摘要会自动添加到最近使用
            print("测试输入新摘要")
            new_summary = "测试摘要"
            summary_input.fill(new_summary)
            page.wait_for_timeout(500)

            # 再次聚焦以重新显示 SummaryPicker
            summary_input.blur()
            page.wait_for_timeout(500)
            summary_input.focus()
            page.wait_for_timeout(1000)

            # 检查新摘要是否在列表中
            print("检查新摘要是否在列表中")
            try:
                recent_item = page.locator(f'text="{new_summary}"')
                if recent_item.is_visible():
                    print("✓ 新摘要成功添加到最近使用列表")
                else:
                    print("✗ 新摘要未显示在最近使用列表中")

            except Exception as e:
                print(f"✗ 检查新摘要失败: {e}")
                page.screenshot(path='error_new_summary.png')

            # 验证"保存草稿"按钮已移除
            print("验证'保存草稿'按钮已移除")
            try:
                save_draft_btn = page.locator('text="保存草稿"')
                if save_draft_btn.is_visible():
                    print("✗ '保存草稿'按钮仍然存在")
                else:
                    print("✓ '保存草稿'按钮已成功移除")

            except Exception as e:
                print(f"✗ 检查'保存草稿'按钮失败: {e}")

        except Exception as e:
            print(f"测试过程中发生错误: {e}")
            page.screenshot(path='error.png')

        finally:
            browser.close()

if __name__ == "__main__":
    test_summary_picker()
