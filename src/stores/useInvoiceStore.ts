'use client';

import { create } from 'zustand';
import { getCurrentManager } from '@/lib/database';
import { useAccountSetStore } from './useAccountSetStore';
import { usePartnerStore } from './usePartnerStore';
import type {
  Invoice,
  InvoiceReconciliation,
  InvoiceFilter,
  InvoiceSummaryItem,
  InvoiceType,
  InvoicePaymentStatus,
} from '@/types';

interface InvoiceStore {
  // 状态
  invoices: Invoice[];
  reconciliations: InvoiceReconciliation[];
  loading: boolean;
  error: string | null;
  selectedInvoiceId: string | null;
  filter: InvoiceFilter;

  // CRUD - 发票
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createTime' | 'updateTime'>) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  getInvoiceById: (id: string) => Invoice | undefined;
  getInvoiceByCode: (code: string, invoiceType: InvoiceType) => Invoice | undefined;

  // 批量导入
  importInvoicesFromExcel: (invoices: Partial<Invoice>[], invoiceType: InvoiceType) => Promise<{ success: number; errors: string[] }>;

  // 核销
  addReconciliation: (rec: Omit<InvoiceReconciliation, 'id' | 'createTime'>) => Promise<InvoiceReconciliation>;
  deleteReconciliation: (id: string) => Promise<void>;
  getReconciliationsByInvoiceId: (invoiceId: string) => InvoiceReconciliation[];

  // 凭证生成
  generateInvoiceVoucher: (invoiceId: string, voucherDate: string) => Promise<{ voucherId: string; voucherNo: string } | null>;

  // 查询
  getFilteredInvoices: () => Invoice[];
  getInputInvoices: () => Invoice[];
  getOutputInvoices: () => Invoice[];
  getInvoiceSummary: () => InvoiceSummaryItem[];

  // 状态管理
  setSelectedInvoiceId: (id: string | null) => void;
  setFilter: (filter: Partial<InvoiceFilter>) => void;
  clearError: () => void;
  initialize: () => Promise<void>;
}

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  // 初始状态
  invoices: [],
  reconciliations: [],
  loading: false,
  error: null,
  selectedInvoiceId: null,
  filter: {},

  // 添加发票
  addInvoice: async (invoiceData) => {
    const manager = await getCurrentManager();
    await manager.init();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    const accountSetId = useAccountSetStore.getState().currentAccountSetId;
    if (!accountSetId) throw new Error('请先选择账套');

    const now = new Date().toISOString();
    const invoice: Invoice = {
      ...invoiceData,
      id: generateId(),
      accountSetId,
      createTime: now,
      updateTime: now,
    };

    const stmt = db.prepare(
      `INSERT INTO invoices (
        id, invoiceType, invoiceCode, digitalInvoiceNo, invoiceDate, sellerName, sellerTaxNo,
        buyerName, buyerTaxNo, goodsName, specification, unit, quantity, unitPrice,
        amount, taxRate, taxAmount, totalAmount, paymentStatus, paidAmount,
        voucherId, voucherNo, partnerId, partnerName, notes, accountSetId, createTime, updateTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      invoice.id, invoice.invoiceType, invoice.invoiceCode, invoice.digitalInvoiceNo,
      invoice.invoiceDate, invoice.sellerName, invoice.sellerTaxNo, invoice.buyerName,
      invoice.buyerTaxNo, invoice.goodsName, invoice.specification, invoice.unit,
      invoice.quantity, invoice.unitPrice, invoice.amount, invoice.taxRate,
      invoice.taxAmount, invoice.totalAmount, invoice.paymentStatus, invoice.paidAmount,
      invoice.voucherId, invoice.voucherNo, invoice.partnerId, invoice.partnerName,
      invoice.notes, invoice.accountSetId, invoice.createTime, invoice.updateTime
    ]);
    stmt.free();

    set((state) => ({ invoices: [...state.invoices, invoice] }));
    return invoice;
  },

  // 更新发票
  updateInvoice: async (id, updates) => {
    const manager = await getCurrentManager();
    await manager.init();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    const now = new Date().toISOString();
    const updateFields = { ...updates, updateTime: now };
    const fields = Object.keys(updateFields);
    const values = Object.values(updateFields);

    const stmt = db.prepare(
      `UPDATE invoices SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`
    );
    stmt.run([...values, id]);
    stmt.free();

    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...updateFields } : inv
      ),
    }));
  },

  // 删除发票
  deleteInvoice: async (id) => {
    const manager = await getCurrentManager();
    await manager.init();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    // 先删除相关的核销记录
    let stmt = db.prepare('DELETE FROM invoiceReconciliations WHERE invoiceId = ?');
    stmt.run([id]);
    stmt.free();

    stmt = db.prepare('DELETE FROM invoices WHERE id = ?');
    stmt.run([id]);
    stmt.free();

    set((state) => ({
      invoices: state.invoices.filter((inv) => inv.id !== id),
      reconciliations: state.reconciliations.filter((rec) => rec.invoiceId !== id),
    }));
  },

  // 根据ID获取发票
  getInvoiceById: (id) => {
    return get().invoices.find((inv) => inv.id === id);
  },

  // 根据发票号码获取发票
  getInvoiceByCode: (code, invoiceType) => {
    return get().invoices.find(
      (inv) => inv.invoiceCode === code && inv.invoiceType === invoiceType
    );
  },

  // 批量导入发票
  importInvoicesFromExcel: async (invoicesData, invoiceType) => {
    const errors: string[] = [];
    let success = 0;
    const addedInvoices: Invoice[] = [];

    try {
      const accountSetId = useAccountSetStore.getState().currentAccountSetId;
      if (!accountSetId) {
        errors.push('请先选择账套');
        return { success, errors };
      }

      // 使用 sqliteService 确保数据库表结构已迁移
      const { sqliteService } = await import('@/lib/database/sqlite-service');

      // 先设置账套ID，再获取数据库（这样迁移会使用正确的账套上下文）
      sqliteService.setAccountSetId(accountSetId);

      const db = await sqliteService.getDatabase();
      if (!db) {
        errors.push('数据库未初始化');
        return { success, errors };
      }

      console.log('Invoice import: Database initialized, accountSetId:', accountSetId);

      // 按"发票号码 + 数电发票号码"分组汇总
      const groupedData = new Map<string, {
        key: string;
        invoiceCode: string;
        digitalInvoiceNo: string;
        firstRow: Partial<Invoice>;
        totalAmount: number;
        totalTaxAmount: number;
        totalTotalAmount: number;
        totalQuantity: number;
        goodsNames: string[];
        rowCount: number;
      }>();

      for (const data of invoicesData) {
        const invoiceCode = data.invoiceCode || '';
        const digitalInvoiceNo = data.digitalInvoiceNo || '';
        // 按"发票号码 + 数电发票号码"组合作为唯一键
        const key = `${invoiceCode}|||${digitalInvoiceNo}`;

        if (groupedData.has(key)) {
          const group = groupedData.get(key)!;
          group.totalAmount += data.amount || 0;
          group.totalTaxAmount += data.taxAmount || 0;
          group.totalTotalAmount += data.totalAmount || 0;
          group.totalQuantity += data.quantity || 0;
          if (data.goodsName && !group.goodsNames.includes(data.goodsName)) {
            group.goodsNames.push(data.goodsName);
          }
          group.rowCount++;
        } else {
          groupedData.set(key, {
            key,
            invoiceCode,
            digitalInvoiceNo,
            firstRow: data,
            totalAmount: data.amount || 0,
            totalTaxAmount: data.taxAmount || 0,
            totalTotalAmount: data.totalAmount || 0,
            totalQuantity: data.quantity || 0,
            goodsNames: data.goodsName ? [data.goodsName] : [],
            rowCount: 1,
          });
        }
      }

      console.log(`Invoice import: Grouped ${invoicesData.length} rows into ${groupedData.size} invoices`);

      // 导入汇总后的发票
      for (const [key, group] of groupedData) {
        try {
          const { invoiceCode, digitalInvoiceNo } = group;
          const data = group.firstRow;

          // 检查发票号是否已存在 - 发票号码 + 数电发票号码 组合唯一
          const checkStmt = db.prepare(
            'SELECT id FROM invoices WHERE invoiceCode = ? AND digitalInvoiceNo = ? AND invoiceType = ? AND accountSetId = ?'
          );
          checkStmt.bind([invoiceCode, digitalInvoiceNo, invoiceType, accountSetId]);
          const exists = checkStmt.step();
          checkStmt.free();

          if (exists) {
            const invoiceKey = digitalInvoiceNo
              ? `${invoiceCode}/${digitalInvoiceNo}`
              : invoiceCode;
            errors.push(`发票 ${invoiceKey} 已存在，已跳过`);
            continue;
          }

          const now = new Date().toISOString();
          const invoice: Invoice = {
            id: generateId(),
            invoiceType,
            invoiceCode: invoiceCode,
            digitalInvoiceNo: digitalInvoiceNo || null,
            invoiceDate: data.invoiceDate || '',
            sellerName: data.sellerName || '',
            sellerTaxNo: data.sellerTaxNo || null,
            buyerName: data.buyerName || '',
            buyerTaxNo: data.buyerTaxNo || null,
            goodsName: group.goodsNames.length > 0 ? group.goodsNames.join('、') : null,
            specification: data.specification || null,
            unit: data.unit || null,
            quantity: group.totalQuantity,
            unitPrice: data.unitPrice || null,
            amount: group.totalAmount,
            taxRate: data.taxRate || null,
            taxAmount: group.totalTaxAmount,
            totalAmount: group.totalTotalAmount,
            paymentStatus: 'unpaid',
            paidAmount: 0,
            partnerId: data.partnerId || null,
            partnerName: data.partnerName || null,
            accountSetId,
            createTime: now,
            updateTime: now,
          };

          const stmt = db.prepare(
            `INSERT INTO invoices (
              id, invoiceType, invoiceCode, digitalInvoiceNo, invoiceDate, sellerName, sellerTaxNo,
              buyerName, buyerTaxNo, goodsName, specification, unit, quantity, unitPrice,
              amount, taxRate, taxAmount, totalAmount, paymentStatus, paidAmount,
              voucherId, voucherNo, partnerId, partnerName, notes, accountSetId, createTime, updateTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          stmt.run([
            invoice.id, invoice.invoiceType, invoice.invoiceCode, invoice.digitalInvoiceNo,
            invoice.invoiceDate, invoice.sellerName, invoice.sellerTaxNo, invoice.buyerName,
            invoice.buyerTaxNo, invoice.goodsName, invoice.specification, invoice.unit,
            invoice.quantity, invoice.unitPrice, invoice.amount, invoice.taxRate,
            invoice.taxAmount, invoice.totalAmount, invoice.paymentStatus, invoice.paidAmount,
            invoice.voucherId || null, invoice.voucherNo || null, invoice.partnerId || null, invoice.partnerName || null,
            invoice.notes || null, invoice.accountSetId, invoice.createTime, invoice.updateTime
          ]);
          stmt.free();

          success++;
          addedInvoices.push(invoice);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          const [invoiceCode, digitalInvoiceNo] = key.split('|||');
          const invoiceKey = digitalInvoiceNo ? `${invoiceCode}/${digitalInvoiceNo}` : invoiceCode;
          errors.push(`导入发票 ${invoiceKey} 失败: ${errorMsg}`);
          console.error('Invoice import error:', error);
        }
      }

      // 直接将新增的发票添加到状态中，而不是重新初始化
      if (addedInvoices.length > 0) {
        set((state) => ({
          invoices: [...addedInvoices, ...state.invoices],
        }));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`初始化失败: ${errorMsg}`);
      console.error('Invoice import initialization error:', error);
    }

    return { success, errors };
  },

  // 添加核销记录
  addReconciliation: async (recData) => {
    const manager = await getCurrentManager();
    await manager.init();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    const rec: InvoiceReconciliation = {
      ...recData,
      id: generateId(),
      createTime: new Date().toISOString(),
    };

    const stmt = db.prepare(
      `INSERT INTO invoiceReconciliations (
        id, invoiceId, voucherId, entryId, amount, reconcileDate, notes, accountSetId, createTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      rec.id, rec.invoiceId, rec.voucherId, rec.entryId, rec.amount,
      rec.reconcileDate, rec.notes, rec.accountSetId, rec.createTime
    ]);
    stmt.free();

    // 更新发票的已付款金额和状态
    const invoice = get().getInvoiceById(rec.invoiceId);
    if (invoice) {
      const newPaidAmount = invoice.paidAmount + rec.amount;
      const paymentStatus: InvoicePaymentStatus =
        newPaidAmount >= invoice.totalAmount ? 'paid' :
        newPaidAmount > 0 ? 'partial' : 'unpaid';

      await get().updateInvoice(rec.invoiceId, {
        paidAmount: newPaidAmount,
        paymentStatus,
      });
    }

    set((state) => ({ reconciliations: [...state.reconciliations, rec] }));
    return rec;
  },

  // 删除核销记录
  deleteReconciliation: async (id) => {
    const manager = await getCurrentManager();
    await manager.init();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    const rec = get().reconciliations.find((r) => r.id === id);
    if (rec) {
      // 更新发票的已付款金额
      const invoice = get().getInvoiceById(rec.invoiceId);
      if (invoice) {
        const newPaidAmount = Math.max(0, invoice.paidAmount - rec.amount);
        const paymentStatus: InvoicePaymentStatus =
          newPaidAmount >= invoice.totalAmount ? 'paid' :
          newPaidAmount > 0 ? 'partial' : 'unpaid';

        await get().updateInvoice(rec.invoiceId, {
          paidAmount: newPaidAmount,
          paymentStatus,
        });
      }
    }

    const stmt = db.prepare('DELETE FROM invoiceReconciliations WHERE id = ?');
    stmt.run([id]);
    stmt.free();

    set((state) => ({
      reconciliations: state.reconciliations.filter((r) => r.id !== id),
    }));
  },

  // 获取发票的核销记录
  getReconciliationsByInvoiceId: (invoiceId) => {
    return get().reconciliations.filter((rec) => rec.invoiceId === invoiceId);
  },

  // 生成发票凭证
  generateInvoiceVoucher: async (invoiceId, voucherDate) => {
    const invoice = get().getInvoiceById(invoiceId);
    if (!invoice) {
      set({ error: '发票不存在' });
      return null;
    }

    if (invoice.voucherId) {
      set({ error: '该发票已生成凭证' });
      return null;
    }

    const accountSetId = useAccountSetStore.getState().currentAccountSetId;
    if (!accountSetId) {
      set({ error: '请先选择账套' });
      return null;
    }

    try {
      const manager = await getCurrentManager();
      await manager.init();
      const db = manager.getDatabase();
      if (!db) {
        set({ error: '数据库未初始化' });
        return null;
      }

      // 生成凭证号
      const yearMonth = voucherDate.substring(0, 7).replace('-', '');

      // 查询当月已有凭证号
      let nextSeq = 1;
      const result = db.exec(
        `SELECT voucherNo FROM vouchers WHERE accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1`,
        [accountSetId, `记-${yearMonth}-%`]
      );
      if (result.length > 0 && result[0].values.length > 0) {
        const lastNo = result[0].values[0][0] as string;
        const match = lastNo.match(/(\d+)$/);
        if (match) {
          nextSeq = parseInt(match[1], 10) + 1;
        }
      }

      const voucherNo = `记-${yearMonth}-${nextSeq.toString().padStart(4, '0')}`;
      const voucherId = generateId();
      const now = new Date().toISOString();

      // 根据发票类型生成凭证分录
      const docNo = invoice.invoiceCode; // 使用发票号码作为单据号
      const partnerName = invoice.invoiceType === 'input' ? invoice.sellerName : invoice.buyerName;

      // 准备分录数据
      const entryData: Array<{
        subjectCode: string;
        subjectName: string;
        debit: number;
        credit: number;
        summary: string;
      }> = [];

      if (invoice.invoiceType === 'input') {
        // 进项发票凭证模板
        entryData.push({
          subjectCode: '1401',
          subjectName: '材料采购',
          debit: invoice.amount,
          credit: 0,
          summary: `采购${invoice.goodsName || '商品'} - ${invoice.sellerName}`,
        });

        if (invoice.taxAmount && invoice.taxAmount > 0) {
          entryData.push({
            subjectCode: '222101',
            subjectName: '应交税费-进项税额',
            debit: invoice.taxAmount,
            credit: 0,
            summary: `进项税额 - ${invoice.invoiceCode}`,
          });
        }

        entryData.push({
          subjectCode: '2202',
          subjectName: '应付账款',
          debit: 0,
          credit: invoice.totalAmount,
          summary: `应付${invoice.sellerName} - ${invoice.invoiceCode}`,
        });
      } else {
        // 销项发票凭证模板
        entryData.push({
          subjectCode: '1122',
          subjectName: '应收账款',
          debit: invoice.totalAmount,
          credit: 0,
          summary: `应收${invoice.buyerName} - ${invoice.invoiceCode}`,
        });

        entryData.push({
          subjectCode: '6001',
          subjectName: '主营业务收入',
          debit: 0,
          credit: invoice.amount,
          summary: `销售${invoice.goodsName || '商品'} - ${invoice.invoiceCode}`,
        });

        if (invoice.taxAmount && invoice.taxAmount > 0) {
          entryData.push({
            subjectCode: '222102',
            subjectName: '应交税费-销项税额',
            debit: 0,
            credit: invoice.taxAmount,
            summary: `销项税额 - ${invoice.invoiceCode}`,
          });
        }
      }

      // 插入凭证
      let stmt = db.prepare(
        `INSERT INTO vouchers (id, voucherNo, date, summary, status, voucherType, createdBy, createTime, accountSetId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([voucherId, voucherNo, voucherDate, '', 'draft', 'general', '系统', now, accountSetId]);
      stmt.free();

      // 插入分录
      for (let i = 0; i < entryData.length; i++) {
        const entry = entryData[i];
        const entryId = `${voucherId}-${i + 1}`;
        const entryNo = `${voucherNo}-${i + 1}`;

        stmt = db.prepare(
          `INSERT INTO entries (id, entryNo, voucherNo, voucherId, entryDate, summary, subjectCode, subjectName, debit, credit, partnerName, docNo, entryTime, writeOffFlag, correction, accountSetId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([entryId, entryNo, voucherNo, voucherId, voucherDate, entry.summary, entry.subjectCode, entry.subjectName, entry.debit, entry.credit, partnerName, docNo, now, false, false, accountSetId]);
        stmt.free();
      }

      // 更新发票的凭证信息
      await get().updateInvoice(invoiceId, {
        voucherId,
        voucherNo,
      });

      return { voucherId, voucherNo };
    } catch (error) {
      set({ error: `生成凭证失败: ${error}` });
      return null;
    }
  },

  // 获取筛选后的发票
  getFilteredInvoices: () => {
    const { invoices, filter } = get();
    return invoices.filter((inv) => {
      if (filter.invoiceType && inv.invoiceType !== filter.invoiceType) return false;
      if (filter.startDate && inv.invoiceDate < filter.startDate) return false;
      if (filter.endDate && inv.invoiceDate > filter.endDate) return false;
      if (filter.partnerId && inv.partnerId !== filter.partnerId) return false;
      if (filter.paymentStatus && inv.paymentStatus !== filter.paymentStatus) return false;
      if (filter.hasVoucher !== undefined) {
        if (filter.hasVoucher && !inv.voucherId) return false;
        if (!filter.hasVoucher && inv.voucherId) return false;
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        if (
          !inv.invoiceCode.toLowerCase().includes(query) &&
          !inv.sellerName.toLowerCase().includes(query) &&
          !inv.buyerName.toLowerCase().includes(query) &&
          !inv.goodsName?.toLowerCase().includes(query) &&
          !inv.partnerName?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  },

  // 获取进项发票
  getInputInvoices: () => {
    return get().invoices.filter((inv) => inv.invoiceType === 'input');
  },

  // 获取销项发票
  getOutputInvoices: () => {
    return get().invoices.filter((inv) => inv.invoiceType === 'output');
  },

  // 获取发票资金一览表数据
  getInvoiceSummary: () => {
    const { invoices } = get();
    const summaryMap = new Map<string, InvoiceSummaryItem>();

    for (const inv of invoices) {
      const key = inv.partnerId || inv.partnerName || '未知单位';
      let item = summaryMap.get(key);

      if (!item) {
        item = {
          partnerId: inv.partnerId,
          partnerName: inv.partnerName || '未知单位',
          totalInputAmount: 0,
          totalOutputAmount: 0,
          paidInputAmount: 0,
          receivedOutputAmount: 0,
          unpaidInputAmount: 0,
          unreceivedOutputAmount: 0,
          inputInvoiceCount: 0,
          outputInvoiceCount: 0,
          hasVoucherInputCount: 0,
          hasVoucherOutputCount: 0,
        };
        summaryMap.set(key, item);
      }

      if (inv.invoiceType === 'input') {
        item.totalInputAmount += inv.totalAmount;
        item.paidInputAmount += inv.paidAmount;
        item.unpaidInputAmount += inv.totalAmount - inv.paidAmount;
        item.inputInvoiceCount++;
        if (inv.voucherId) item.hasVoucherInputCount++;
      } else {
        item.totalOutputAmount += inv.totalAmount;
        item.receivedOutputAmount += inv.paidAmount;
        item.unreceivedOutputAmount += inv.totalAmount - inv.paidAmount;
        item.outputInvoiceCount++;
        if (inv.voucherId) item.hasVoucherOutputCount++;
      }
    }

    return Array.from(summaryMap.values());
  },

  // 设置选中的发票ID
  setSelectedInvoiceId: (id) => {
    set({ selectedInvoiceId: id });
  },

  // 设置筛选条件
  setFilter: (filter) => {
    set((state) => ({ filter: { ...state.filter, ...filter } }));
  },

  // 清除错误
  clearError: () => {
    set({ error: null });
  },

  // 初始化 - 从数据库加载发票数据
  initialize: async () => {
    set({ loading: true, error: null });

    try {
      // 使用 sqliteService 确保数据库表结构已迁移
      const { sqliteService } = await import('@/lib/database/sqlite-service');
      const db = await sqliteService.getDatabase();
      if (!db) {
        set({ loading: false, invoices: [], reconciliations: [] });
        return;
      }

      const accountSetId = useAccountSetStore.getState().currentAccountSetId;
      if (!accountSetId) {
        set({ loading: false, invoices: [], reconciliations: [] });
        return;
      }

      // 设置账套ID
      sqliteService.setAccountSetId(accountSetId);

      // 加载发票
      const invoiceResult = db.exec(
        `SELECT * FROM invoices WHERE accountSetId = '${accountSetId}' ORDER BY invoiceDate DESC, createTime DESC`
      );

      const invoices: Invoice[] = [];
      if (invoiceResult.length > 0 && invoiceResult[0].values) {
        const columns = invoiceResult[0].columns;
        for (const row of invoiceResult[0].values) {
          const invoice: any = {};
          columns.forEach((col: string, idx: number) => {
            invoice[col] = row[idx];
          });
          invoices.push(invoice as Invoice);
        }
      }

      // 加载核销记录
      const recResult = db.exec(
        `SELECT * FROM invoiceReconciliations WHERE accountSetId = '${accountSetId}' ORDER BY reconcileDate DESC`
      );

      const reconciliations: InvoiceReconciliation[] = [];
      if (recResult.length > 0 && recResult[0].values) {
        const columns = recResult[0].columns;
        for (const row of recResult[0].values) {
          const rec: any = {};
          columns.forEach((col: string, idx: number) => {
            rec[col] = row[idx];
          });
          reconciliations.push(rec as InvoiceReconciliation);
        }
      }

      set({ invoices, reconciliations, loading: false });
    } catch (error) {
      console.error('初始化发票数据失败:', error);
      set({ loading: false, error: '初始化发票数据失败' });
    }
  },
}));
