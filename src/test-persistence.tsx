'use client';

import { useEffect, useState } from 'react';
import { useVoucherStore, useUserPreferenceStore, useAuditStore } from '@/stores';

export default function TestPersistence() {
  const [testData, setTestData] = useState<any>(null);

  useEffect(() => {
    // 测试凭证数据
    const voucherStore = useVoucherStore.getState();

    // 保存一个测试凭证
    voucherStore.currentEntries.push({
      id: `test_${Date.now()}`,
      voucherId: 'test_voucher',
      date: new Date().toISOString().split('T')[0],
      summary: '测试凭证',
      subjectCode: '1001',
      subjectName: '现金',
      debit: 1000,
      credit: 0
    });

    voucherStore.updateVoucherDate(new Date().toISOString().split('T')[0]);

    // 测试偏好数据
    const prefStore = useUserPreferenceStore.getState();
    prefStore.savePreference('测试摘要', '1001', '现金');

    // 测试审计数据
    const auditStore = useAuditStore.getState();
    auditStore.addRecord({
      userId: 'test_user',
      userName: '测试用户',
      operation: 'CREATE' as any,
      entityType: 'voucher',
      entityId: 'test_voucher',
      details: { test: true },
      timestamp: new Date().toISOString(),
      ipAddress: '127.0.0.1',
      userAgent: 'test',
      result: 'success'
    });

    // 获取所有数据
    const allData = {
      vouchers: voucherStore.vouchers,
      preferences: prefStore.preferences,
      audit: auditStore.records
    };

    setTestData(allData);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">数据持久化测试</h1>
      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify(testData, null, 2)}
      </pre>
    </div>
  );
}