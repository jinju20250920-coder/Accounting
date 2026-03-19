import { useVoucherStore } from './src/stores/useVoucherStore';
import { useAccountSetStore } from './src/stores/useAccountSetStore';
import { STORAGE_KEYS } from './src/stores/persistence-config';
import { database } from './src/lib/database';

async function testAccountSetIsolation() {
  console.log('=== 测试账套数据隔离 ===\n');

  // 获取 store 实例
  const voucherStore = useVoucherStore.getState();
  const accountSetStore = useAccountSetStore.getState();

  console.log('1. 初始化状态');
  console.log('当前账套:', accountSetStore.currentAccountSetId);
  console.log('当前凭证列表长度:', voucherStore.vouchers.length);

  // 检查是否有苏州洋洋和上海乐乐账套
  const suzhouAccount = accountSetStore.accountSets.find(s => s.name.includes('苏州'));
  const shanghaiAccount = accountSetStore.accountSets.find(s => s.name.includes('上海'));

  console.log('\n2. 账套信息');
  console.log('苏州洋洋账套:', suzhouAccount);
  console.log('上海乐乐账套:', shanghaiAccount);

  // 检查数据库中的 keyValues 表
  console.log('\n3. 检查 IndexedDB 中的 keyValues 表');
  await database.init();

  // 获取所有与凭证相关的 keyValues
  try {
    const transaction = await (window as any).indexedDB.open('finance-assistant-db');
    transaction.onsuccess = async (event: any) => {
      const db = event.target.result;
      const objectStore = db.transaction('keyValues').objectStore('keyValues');
      const request = objectStore.getAll();

      request.onsuccess = (e: any) => {
        const keyValues = e.target.result;
        console.log('keyValues 表内容:');
        console.log(JSON.stringify(keyValues, null, 2));

        // 筛选凭证相关的键
        const voucherKeys = keyValues.filter((kv: any) =>
          kv.key && (kv.key.startsWith(STORAGE_KEYS.VOUCHERS) || kv.key.includes('voucher'))
        );
        console.log('\n凭证相关的键:');
        console.log(JSON.stringify(voucherKeys, null, 2));
      };
    };
  } catch (error) {
    console.error('读取 keyValues 表失败:', error);
  }

  console.log('\n4. 手动验证不同账套的存储键');
  const suzhouKey = `${STORAGE_KEYS.VOUCHERS}:${suzhouAccount?.id}`;
  const shanghaiKey = `${STORAGE_KEYS.VOUCHERS}:${shanghaiAccount?.id}`;
  console.log('苏州洋洋凭证存储键:', suzhouKey);
  console.log('上海乐乐凭证存储键:', shanghaiKey);

  // 尝试直接从数据库读取数据
  const suzhouVouchers = await database.get(suzhouKey);
  const shanghaiVouchers = await database.get(shanghaiKey);

  console.log('\n5. 读取各账套的凭证数据');
  console.log('苏州洋洋账套的凭证:', suzhouVouchers);
  console.log('上海乐乐账套的凭证:', shanghaiVouchers);

  // 检查是否有重复的凭证编号
  console.log('\n6. 检查重复的凭证编号');
  if (suzhouVouchers && Array.isArray(suzhouVouchers)) {
    const suzhouVoucherNos = suzhouVouchers.map((v: any) => v.voucherNo);
    console.log('苏州洋洋账套的凭证号:', suzhouVoucherNos);
  }

  if (shanghaiVouchers && Array.isArray(shanghaiVouchers)) {
    const shanghaiVoucherNos = shanghaiVouchers.map((v: any) => v.voucherNo);
    console.log('上海乐乐账套的凭证号:', shanghaiVoucherNos);
  }
}

// 运行测试
testAccountSetIsolation().catch(console.error);