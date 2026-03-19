const { chromium } = require('playwright');

(async () => {
  // 启动浏览器
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // 访问凭证录入页面
    console.log('访问凭证录入页面...');
    await page.goto('http://localhost:3000/voucher-entry-page');
    await page.waitForLoadState('networkidle');
    console.log('页面加载完成');

    // 检查页面是否包含单据编号区域
    const voucherNoElement = await page.waitForSelector('.voucher-no, [id*="voucher-no"]');
    if (voucherNoElement) {
      const voucherNo = await voucherNoElement.textContent();
      console.log('凭证编号:', voucherNo.trim());

      // 验证凭证号格式
      const isValidFormat = /记-\d{6}-\d{3}/.test(voucherNo.trim());
      if (isValidFormat) {
        console.log('✅ 凭证号格式正确');
      } else {
        console.log('❌ 凭证号格式不正确');
      }

      // 检查是否是 NaN
      if (voucherNo.includes('NaN')) {
        console.log('❌ 凭证号包含 NaN');
      } else {
        console.log('✅ 凭证号不包含 NaN');
      }
    } else {
      console.log('❌ 未找到凭证编号元素');
    }

    // 截图验证
    await page.screenshot({ path: 'voucher-entry-page.png' });

    // 检查页面结构
    const html = await page.content();
    if (html.includes('单据编号')) {
      console.log('✅ 页面包含单据编号字段');
    }

  } catch (error) {
    console.error('测试过程中发生错误:', error);
  } finally {
    // 关闭浏览器
    await browser.close();
  }
})();