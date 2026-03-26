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

    db.run(
      `INSERT INTO invoices (
        id, invoiceType, invoiceCode, digitalInvoiceNo, invoiceDate, sellerName, sellerTaxNo,
        buyerName, buyerTaxNo, goodsName, specification, unit, quantity, unitPrice,
        amount, taxRate, taxAmount, totalAmount, paymentStatus, paidAmount,
        voucherId, voucherNo, partnerId, partnerName, notes, accountSetId, createTime, updateTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoice.id, invoice.invoiceType, invoice.invoiceCode, invoice.digitalInvoiceNo,
        invoice.invoiceDate, invoice.sellerName, invoice.sellerTaxNo, invoice.buyerName,
        invoice.buyerTaxNo, invoice.goodsName, invoice.specification, invoice.unit,
        invoice.quantity, invoice.unitPrice, invoice.amount, invoice.taxRate,
        invoice.taxAmount, invoice.totalAmount, invoice.paymentStatus, invoice.paidAmount,
        invoice.voucherId, invoice.voucherNo, invoice.partnerId, invoice.partnerName,
        invoice.notes, invoice.accountSetId, invoice.createTime, invoice.updateTime
      ]
    );

    set((state) => ({ invoices: [...state.invoices, invoice] }));
    return invoice;
  },

  // 更新发票
  updateInvoice: async (id, updates) => {
    const manager = await getCurrentManager();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    const now = new Date().toISOString();
    const updateFields = { ...updates, updateTime: now };
    const fields = Object.keys(updateFields);
    const values = Object.values(updateFields);

    db.run(
      `UPDATE invoices SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      [...values, id]
    );

    set((state) => ({
      invoices: state.invoices.map((inv) =>
        inv.id === id ? { ...inv, ...updateFields } : inv
      ),
    }));
  },

  // 删除发票
  deleteInvoice: async (id) => {
    const manager = await getCurrentManager();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    // 先删除相关的核销记录
    db.run('DELETE FROM invoiceReconciliations WHERE invoiceId = ?', [id]);
    db.run('DELETE FROM invoices WHERE id = ?', [id]);

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
    const manager = await getCurrentManager();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    const accountSetId = useAccountSetStore.getState().currentAccountSetId;
    if (!accountSetId) throw new Error('请先选择账套');

    const errors: string[] = [];
    let success = 0;
    const addedInvoices: Invoice[] = [];

    for (const data of invoicesData) {
      try {
        // 检查发票号是否已存在
        const existing = db.exec(
          'SELECT id FROM invoices WHERE invoiceCode = ? AND invoiceType = ? AND accountSetId = ?',
          [data.invoiceCode || '', invoiceType, accountSetId]
        );
        if (existing.length > 0 && existing[0].values.length > 0) {
          errors.push(`发票号 ${data.invoiceCode} 已存在，已跳过`);
          continue;
        }

        const now = new Date().toISOString();
        const invoice: Invoice = {
          id: generateId(),
          invoiceType,
          invoiceCode: data.invoiceCode || '',
          digitalInvoiceNo: data.digitalInvoiceNo, // 数电发票号码
          invoiceDate: data.invoiceDate || '',
          sellerName: data.sellerName || '',
          sellerTaxNo: data.sellerTaxNo, // 销方识别号
          buyerName: data.buyerName || '',
          buyerTaxNo: data.buyerTaxNo, // 购方识别号
          goodsName: data.goodsName,
          specification: data.specification,
          unit: data.unit,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          amount: data.amount || 0,
          taxRate: data.taxRate,
          taxAmount: data.taxAmount,
          totalAmount: data.totalAmount || 0,
          paymentStatus: 'unpaid',
          paidAmount: 0,
          partnerId: data.partnerId,
          partnerName: data.partnerName,
          accountSetId,
          createTime: now,
          updateTime: now,
        };

        db.run(
          `INSERT INTO invoices (
            id, invoiceType, invoiceCode, digitalInvoiceNo, invoiceDate, sellerName, sellerTaxNo,
            buyerName, buyerTaxNo, goodsName, specification, unit, quantity, unitPrice,
            amount, taxRate, taxAmount, totalAmount, paymentStatus, paidAmount,
            voucherId, voucherNo, partnerId, partnerName, notes, accountSetId, createTime, updateTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoice.id, invoice.invoiceType, invoice.invoiceCode, invoice.digitalInvoiceNo,
            invoice.invoiceDate, invoice.sellerName, invoice.sellerTaxNo, invoice.buyerName,
            invoice.buyerTaxNo, invoice.goodsName, invoice.specification, invoice.unit,
            invoice.quantity, invoice.unitPrice, invoice.amount, invoice.taxRate,
            invoice.taxAmount, invoice.totalAmount, invoice.paymentStatus, invoice.paidAmount,
            invoice.voucherId, invoice.voucherNo, invoice.partnerId, invoice.partnerName,
            invoice.notes, invoice.accountSetId, invoice.createTime, invoice.updateTime
          ]
        );

        success++;
        addedInvoices.push(invoice);
      } catch (error) {
        errors.push(`导入发票 ${data.invoiceCode || '未知'} 失败: ${error}`);
      }
    }

    // 直接将新增的发票添加到状态中，而不是重新初始化
    if (addedInvoices.length > 0) {
      set((state) => ({
        invoices: [...addedInvoices, ...state.invoices],
      }));
    }

    return { success, errors };
  },

  // 添加核销记录
  addReconciliation: async (recData) => {
    const manager = await getCurrentManager();
    const db = manager.getDatabase();
    if (!db) throw new Error('数据库未初始化');

    const rec: InvoiceReconciliation = {
      ...recData,
      id: generateId(),
      createTime: new Date().toISOString(),
    };

    db.run(
      `INSERT INTO invoiceReconciliations (
        id, invoiceId, voucherId, entryId, amount, reconcileDate, notes, accountSetId, createTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rec.id, rec.invoiceId, rec.voucherId, rec.entryId, rec.amount,
        rec.reconcileDate, rec.notes, rec.accountSetId, rec.createTime
      ]
    );

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

    db.run('DELETE FROM invoiceReconciliations WHERE id = ?', [id]);

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
      const manager = getCurrentManager();
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
      db.run(
        `INSERT INTO vouchers (id, voucherNo, date, summary, status, voucherType, createdBy, createTime, accountSetId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [voucherId, voucherNo, voucherDate, '', 'draft', 'general', '系统', now, accountSetId]
      );

      // 插入分录
      for (let i = 0; i < entryData.length; i++) {
        const entry = entryData[i];
        const entryId = `${voucherId}-${i + 1}`;
        const entryNo = `${voucherNo}-${i + 1}`;

        db.run(
          `INSERT INTO entries (id, entryNo, voucherNo, voucherId, entryDate, summary, subjectCode, subjectName, debit, credit, partnerName, docNo, entryTime, writeOffFlag, correction, accountSetId)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [entryId, entryNo, voucherNo, voucherId, voucherDate, entry.summary, entry.subjectCode, entry.subjectName, entry.debit, entry.credit, partnerName, docNo, now, false, false, accountSetId]
        );
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
      const manager = await getCurrentManager();
      const db = manager.getDatabase();
      if (!db) {
        set({ loading: false, invoices: [], reconciliations: [] });
        return;
      }

      const accountSetId = useAccountSetStore.getState().currentAccountSetId;
      if (!accountSetId) {
        set({ loading: false, invoices: [], reconciliations: [] });
        return;
      }

      // 加载发票
      const invoiceResult = db.exec(
        'SELECT * FROM invoices WHERE accountSetId = ? ORDER BY invoiceDate DESC, createTime DESC',
        [accountSetId]
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
        'SELECT * FROM invoiceReconciliations WHERE accountSetId = ? ORDER BY reconcileDate DESC',
        [accountSetId]
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
