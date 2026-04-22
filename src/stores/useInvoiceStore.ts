'use client';

import { create } from 'zustand';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useAccountSetStore } from './useAccountSetStore';
import { usePartnerStore } from './usePartnerStore';
import { matchRule, executeActions, detectExpenseCategory, getSlotMap } from '@/lib/invoice-rule-engine';
import type {
  Invoice,
  InvoiceReconciliation,
  InvoiceFilter,
  InvoiceSummaryItem,
  InvoiceType,
  InvoicePaymentStatus,
  EngineContext,
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

  // 批量操作
  deleteInvoices: (ids: string[]) => Promise<{ success: number; errors: string[] }>;
  generateInvoiceVouchers: (ids: string[], voucherDate: string) => Promise<{ success: number; errors: string[] }>;

  // 批量导入
  importInvoicesFromExcel: (invoices: Partial<Invoice>[], invoiceType: InvoiceType, options?: { autoGenerateVoucher?: boolean }) => Promise<{ success: number; errors: string[]; voucherCount?: number }>;

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

// 获取当前账套的数据库实例（统一使用 sqliteService）
async function getDb() {
  const accountSetId = useAccountSetStore.getState().currentAccountSetId;
  if (!accountSetId) throw new Error('请先选择账套');
  sqliteService.setAccountSetId(accountSetId);
  const db = await sqliteService.getDatabase();
  if (!db) throw new Error('数据库未初始化');
  return db;
}

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
    const db = await getDb();
    const accountSetId = useAccountSetStore.getState().currentAccountSetId!;

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
    const db = await getDb();

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
    const db = await getDb();

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
  importInvoicesFromExcel: async (invoicesData, invoiceType, options) => {
    const errors: string[] = [];
    let success = 0;
    let voucherCount = 0;
    const addedInvoices: Invoice[] = [];

    try {
      const accountSetId = useAccountSetStore.getState().currentAccountSetId;
      if (!accountSetId) {
        errors.push('请先选择账套');
        return { success, errors };
      }

      // 使用 sqliteService 确保数据库表结构已迁移
      const db = await getDb();

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
            holdStatus: 'normal', // 新增：设置默认状态为正常
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

      // 自动生成凭证
      if (options?.autoGenerateVoucher && addedInvoices.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        for (const invoice of addedInvoices) {
          try {
            const result = await get().generateInvoiceVoucher(invoice.id, invoice.invoiceDate || today);
            if (result) {
              voucherCount++;
            }
          } catch (error) {
            const invoiceKey = invoice.digitalInvoiceNo
              ? `${invoice.invoiceCode}/${invoice.digitalInvoiceNo}`
              : invoice.invoiceCode;
            errors.push(`发票 ${invoiceKey} 自动生成凭证失败: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`初始化失败: ${errorMsg}`);
      console.error('Invoice import initialization error:', error);
    }

    return { success, errors, voucherCount };
  },

  // 添加核销记录
  addReconciliation: async (recData) => {
    const db = await getDb();

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
    const db = await getDb();

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

  // 生成发票凭证（智能规则引擎 + 模板引擎 + 科目自动创建）
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
      const db = await getDb();

      // 1. 从 SQLite 读取智能规则引擎所需的全部上下文数据
      sqliteService.setAccountSetId(accountSetId);
      const [
        rules,
        supplierMappings,
        expenseReimbursements,
        auxiliaryStrategy,
        expenseKeywords,
        assetMappings,
      ] = await Promise.all([
        sqliteService.getSmartRules(),
        sqliteService.getSupplierMappings(),
        sqliteService.getExpenseReimbursements(),
        sqliteService.getAuxiliaryStrategy(),
        sqliteService.getExpenseKeywordCategories(),
        sqliteService.getAssetCategoryMappings(),
      ]);

      // 2. 匹配规则（最高优先级的启用规则，条件全部 AND 满足）
      const matchedRule = matchRule(invoice, rules, supplierMappings);

      // 3. 检测费用类别（报销/差旅/招待等）
      const expenseCategory = detectExpenseCategory(invoice, expenseKeywords);

      // 4. 构建 EngineContext 并执行动作，得到 ActionResult
      const engineContext: EngineContext = {
        invoice,
        matchedRule,
        supplierMappings,
        expenseReimbursements,
        auxiliaryStrategy,
        expenseKeywords,
        assetMappings,
        allRules: rules,
      };
      const result = executeActions(engineContext);

      // 5. 将抽象插槽（debit/tax/credit）映射为模板 entry ID（entry_1/entry_2/entry_3）
      const isInput = invoice.invoiceType === 'input';
      const slotMap = getSlotMap(invoice.invoiceType as 'input' | 'output');
      const mappedOverrides: Record<string, { code: string; name: string }> = {};
      for (const [slot, val] of Object.entries(result.subjectOverrides)) {
        const entryId = slotMap[slot];
        if (entryId) mappedOverrides[entryId] = val;
      }

      // 6. 科目自动创建（不存在的科目自动添加到 subjects 表）
      const { useSubjectStore } = await import('./useSubjectStore');
      const subjects = useSubjectStore.getState().subjects;
      const existingCodes = new Set(subjects.map(s => s.code));

      for (const [, val] of Object.entries(mappedOverrides)) {
        if (!val.code || existingCodes.has(val.code)) continue;
        // 根据代码首位判断方向
        const firstDigit = val.code.charAt(0);
        const direction = ('245').includes(firstDigit) ? 'credit' : 'debit';
        // 查找父科目
        let parentId: string | null = null;
        if (val.code.length > 1) {
          for (let len = val.code.length - 1; len >= 1; len--) {
            const parentCode = val.code.substring(0, len);
            const parent = subjects.find(s => s.code === parentCode);
            if (parent) {
              parentId = parent.id;
              break;
            }
          }
        }
        await useSubjectStore.getState().addSubject({
          code: val.code,
          name: val.name || val.code,
          parentId,
          level: val.code.length <= 3 ? 1 : val.code.length <= 4 ? 2 : 3,
          direction,
          enableDept: false,
          enableProject: false,
          enableForeign: false,
          isCustomer: false,
          isSupplier: false,
          isEmployee: false,
          enableCashFlow: false,
          disabled: false,
          block: false,
        } as any);
        existingCodes.add(val.code);
      }

      // 7. 调用模板引擎
      const { templateEngine } = await import('@/lib/template-engine');
      const templateId = isInput ? 'tpl_purchase_invoice' : 'tpl_sale_invoice';
      const inputData = {
        total_amount: invoice.totalAmount,
        tax_amount: invoice.taxAmount || 0,
        base_amount: invoice.amount,
        partner_name: isInput ? invoice.sellerName : invoice.buyerName,
        invoice_date: invoice.invoiceDate,
        invoice_no: invoice.invoiceCode,
      };

      const tplResult = templateEngine.generateVoucherWithOverrides(templateId, inputData, mappedOverrides);

      if (!tplResult.success || !tplResult.voucher) {
        set({ error: tplResult.errors?.join('; ') || '模板引擎生成失败' });
        return null;
      }

      // 8. 生成凭证号
      const yearMonth = voucherDate.substring(0, 7).replace('-', '');
      let nextSeq = 1;
      const seqResult = db.exec(
        `SELECT voucherNo FROM vouchers WHERE accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1`,
        [accountSetId, `记-${yearMonth}-%`]
      );
      if (seqResult.length > 0 && seqResult[0].values.length > 0) {
        const lastNo = seqResult[0].values[0][0] as string;
        const match = lastNo.match(/(\d+)$/);
        if (match) nextSeq = parseInt(match[1], 10) + 1;
      }

      const voucherNo = `记-${yearMonth}-${nextSeq.toString().padStart(4, '0')}`;
      const voucherId = generateId();
      const now = new Date().toISOString();
      const partnerName = isInput ? invoice.sellerName : invoice.buyerName;

      // 9. INSERT 凭证 — docNo 始终设为发票号码
      const docNo = invoice.invoiceCode;
      let stmt = db.prepare(
        `INSERT INTO vouchers (id, voucherNo, date, summary, status, creator, referenceNumber, accountSetId, createTime, updateTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([voucherId, voucherNo, voucherDate, '', 'draft', '系统', docNo, accountSetId, now, now]);
      stmt.free();

      // 10. INSERT 分录（从模板引擎输出转换）
      const tplEntries = tplResult.voucher.entries;
      for (let i = 0; i < tplEntries.length; i++) {
        const entry = tplEntries[i];
        const entryId = `${voucherId}-${i + 1}`;
        const direction = entry.debit > 0 ? 'debit' : 'credit';
        const customerName = isInput ? '' : partnerName;
        const supplierName = isInput ? partnerName : '';

        // 跳过金额为 0 的分录
        if (entry.debit === 0 && entry.credit === 0) continue;

        stmt = db.prepare(
          `INSERT INTO entries (id, voucherId, subjectCode, subjectName, direction, debit, credit, summary, customerName, supplierName, date, accountSetId, createTime, updateTime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([entryId, voucherId, entry.subjectCode, entry.subjectName, direction,
          entry.debit, entry.credit, entry.summary,
          customerName, supplierName, voucherDate, accountSetId, now, now]);
        stmt.free();
      }

      // 11. 处理固定资产卡片（如果引擎返回了 fixedAssetCard）
      if (result.fixedAssetCard) {
        try {
          const { useFixedAssetStore } = await import('./useFixedAssetStore');
          await useFixedAssetStore.getState().createFromInvoice(result.fixedAssetCard);
        } catch (faError) {
          console.warn('固定资产卡片创建失败（不影响凭证）:', faError);
        }
      }

      // 12. 处理费用类别标记
      if (result.markCategory) {
        try {
          await sqliteService.updateInvoiceCategory(invoice.id, result.markCategory);
        } catch (catError) {
          console.warn('发票类别标记失败（不影响凭证）:', catError);
        }
      }

      // 13. 更新发票的凭证信息
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

  // 批量删除发票
  deleteInvoices: async (ids: string[]): Promise<{ success: number; errors: string[] }> => {
    const db = await getDb();

    let success = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const stmt = db.prepare('DELETE FROM invoices WHERE id = ?');
        stmt.run([id]);
        stmt.free();
        success++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`删除发票 ${id} 失败: ${errorMsg}`);
        console.error('Invoice delete error:', error);
      }
    }

    // 更新状态
    set((state) => ({
      invoices: state.invoices.filter((inv) => !ids.includes(inv.id)),
    }));

    return { success, errors };
  },

  // 批量生成凭证
  generateInvoiceVouchers: async (ids: string[], voucherDate: string): Promise<{ success: number; errors: string[] }> => {
    let success = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const result = await get().generateInvoiceVoucher(id, voucherDate);
        if (result) {
          success++;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`生成发票 ${id} 凭证失败: ${errorMsg}`);
        console.error('Invoice voucher generation error:', error);
      }
    }

    return { success, errors };
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
      const accountSetId = useAccountSetStore.getState().currentAccountSetId;
      if (!accountSetId) {
        set({ loading: false, invoices: [], reconciliations: [] });
        return;
      }

      const db = await getDb();

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
