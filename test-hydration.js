const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 监听控制台日志
  const logs = [];
  page.on('console', msg => {
    console.log('Console:', msg.text());
    logs.push(msg.text());
  });

  try {
    console.log('正在访问页面...');
    await page.goto('http://localhost:3000/voucher-entry-page');
    await page.waitForLoadState('networkidle');
    console.log('页面加载完成');

    // 检查是否有 hydration 错误
    const hydrationErrors = logs.filter(log =>
      log.toLowerCase().includes('hydration') || log.toLowerCase().includes('mismatch')
    );

    if (hydrationErrors.length > 0) {
      console.error('发现 Hydration 错误:');
      hydrationErrors.forEach(error => console.error(`  - ${error}`));
    } else {
      console.log('✅ 未发现 Hydration 错误');
    }

    // 保存截图
    await page.screenshot({ path: 'voucher-entry-page.png', fullPage: true });
    console.log('📸 已保存截图');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await browser.close();
  }
})();