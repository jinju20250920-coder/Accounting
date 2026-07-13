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
  OverrideSubjectAction,
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
        id, tenantId, invoiceType, invoiceCode, invoiceDate, sellerName, sellerTaxNo,
        buyerName, buyerTaxNo, goodsName, specification, unit, quantity, unitPrice,
        amount, taxRate, taxAmount, totalAmount, paymentStatus, paidAmount,
        voucherId, voucherNo, partnerId, partnerName, notes, accountSetId, createTime, updateTime, groupName
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      invoice.id, sqliteService.tenantId, invoice.invoiceType, invoice.invoiceCode,
      invoice.invoiceDate, invoice.sellerName, invoice.sellerTaxNo, invoice.buyerName,
      invoice.buyerTaxNo, invoice.goodsName, invoice.specification, invoice.unit,
      invoice.quantity, invoice.unitPrice, invoice.amount, invoice.taxRate,
      invoice.taxAmount, invoice.totalAmount, invoice.paymentStatus, invoice.paidAmount,
      invoice.voucherId, invoice.voucherNo, invoice.partnerId, invoice.partnerName,
      invoice.notes, invoice.accountSetId, invoice.createTime, invoice.updateTime,
      invoice.groupName || null
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
      `UPDATE invoices SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ? AND tenantId = ? AND accountSetId = ?`
    );
    stmt.run([...values, id, sqliteService.tenantId, useAccountSetStore.getState().currentAccountSetId ?? '']);
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

    // 检查是否已生成凭证
    const invoice = get().invoices.find(inv => inv.id === id);
    if (invoice?.voucherId) {
      set({ error: '该发票已生成凭证，不能删除。如需删除请先冲销关联凭证。' });
      return;
    }

    // 先删除相关的核销记录
    let stmt = db.prepare('DELETE FROM invoiceReconciliations WHERE invoiceId = ? AND tenantId = ? AND accountSetId = ?');
    stmt.run([id, sqliteService.tenantId, useAccountSetStore.getState().currentAccountSetId ?? '']);
    stmt.free();

    stmt = db.prepare('DELETE FROM invoices WHERE id = ? AND tenantId = ? AND accountSetId = ?');
    stmt.run([id, sqliteService.tenantId, useAccountSetStore.getState().currentAccountSetId ?? '']);
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
        const key = digitalInvoiceNo ? `${invoiceCode}|||${digitalInvoiceNo}` : invoiceCode;

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

      // 加载供应商映射和业务组配置，用于导入时匹配 groupName
      const supplierMappings = await sqliteService.getSupplierMappings();
      const ruleConfig = await sqliteService.getPurchaseInvoiceRuleConfig();

      // 导入汇总后的发票
      for (const [key, group] of groupedData) {
        try {
          const { invoiceCode, digitalInvoiceNo } = group;
          const data = group.firstRow;

          // 检查发票号是否已存在
          const checkStmt = db.prepare(
            'SELECT id FROM invoices WHERE invoiceCode = ? AND digitalInvoiceNo = ? AND invoiceType = ? AND tenantId = ? AND accountSetId = ?'
          );
          checkStmt.bind([invoiceCode, digitalInvoiceNo || null, invoiceType, sqliteService.tenantId, accountSetId]);
          const exists = checkStmt.step();
          checkStmt.free();

          if (exists) {
            const invoiceKey = digitalInvoiceNo ? `${invoiceCode}/${digitalInvoiceNo}` : invoiceCode;
            errors.push(`发票 ${invoiceKey} 已存在，已跳过`);
            continue;
          }

          const now = new Date().toISOString();
          const invoice: Invoice = {
            id: generateId(),
            invoiceType,
            invoiceCode: invoiceCode,
            digitalInvoiceNo: digitalInvoiceNo || undefined,
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

          // 匹配业务组名称：优先供应商白名单 → 业务组关键词 → 关键词规则
          let matchedGroupName: string | null = null;
          const sellerName = invoice.sellerName?.trim();
          if (sellerName) {
            const supplierMatch = supplierMappings.find(m =>
              m.sellerName?.trim() === sellerName
            );
            if (supplierMatch) {
              matchedGroupName = supplierMatch.groupName;
            }
          }
          if (!matchedGroupName) {
            // 逐个商品名匹配（而非拼接后的字符串）
            const goodsNames = group.goodsNames.length > 0 ? group.goodsNames : (invoice.goodsName ? [invoice.goodsName] : []);
            const sortedGroups = [...ruleConfig.businessGroups].sort((a, b) => (b.priority || 0) - (a.priority || 0));
            for (const goodsItem of goodsNames) {
              if (!goodsItem) continue;
              const goodsLower = goodsItem.trim().toLowerCase();
              // 优先匹配业务组自带的 keywords（按优先级排序）
              for (const group of sortedGroups) {
                if (group.keywords && group.keywords.some(kw => {
                  // 关键词按空格/逗号拆分为独立词，任一词匹配即可
                  const kwWords = kw.trim().toLowerCase().split(/[\s,，、]+/).filter(Boolean);
                  return kwWords.some(word => goodsLower.includes(word) || word.includes(goodsLower));
                })) {
                  matchedGroupName = group.name;
                  break;
                }
              }
              if (matchedGroupName) break;
              // 回退到 keywordRules
              for (const rule of ruleConfig.keywordRules) {
                const keywords = rule.keywords.split(/[,，]/).map(k => k.trim().toLowerCase()).filter(Boolean);
                if (keywords.some(kw => goodsLower.includes(kw) || kw.includes(goodsLower))) {
                  const group = ruleConfig.businessGroups.find(g => g.id === rule.businessGroup);
                  if (group) {
                    matchedGroupName = group.name;
                    break;
                  }
                }
              }
              if (matchedGroupName) break;
            }
          }
          invoice.groupName = matchedGroupName;

          // Auto-create partner card if business group requires it
          if (matchedGroupName && sellerName) {
            try {
              const matchedGroup = ruleConfig.businessGroups.find(g => g.name === matchedGroupName);
              if (matchedGroup?.requirePartnerCard !== false) {
                const existingPartner = await sqliteService.getPartnerByName(sellerName);
                if (!existingPartner) {
                  const partnerId = `partner_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 6)}`;
                  await sqliteService.addPartner({
                    id: partnerId,
                    name: sellerName,
                    code: `P${Date.now().toString(36)}`,
                    type: 'supplier',
                    isSupplier: true,
                    isCustomer: false,
                    remark: '发票导入自动创建',
                    createTime: new Date().toISOString(),
                    updateTime: new Date().toISOString(),
                  });
                }
              }
            } catch (e) {
              console.warn('Auto-create partner failed:', e);
            }
          }

          const stmt = db.prepare(
            `INSERT INTO invoices (
              id, tenantId, invoiceType, invoiceCode, digitalInvoiceNo, invoiceDate, sellerName, sellerTaxNo,
              buyerName, buyerTaxNo, goodsName, specification, unit, quantity, unitPrice,
              amount, taxRate, taxAmount, totalAmount, paymentStatus, paidAmount,
              voucherId, voucherNo, partnerId, partnerName, notes, accountSetId, createTime, updateTime, groupName
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          stmt.run([
            invoice.id, sqliteService.tenantId, invoice.invoiceType, invoice.invoiceCode, invoice.digitalInvoiceNo || null,
            invoice.invoiceDate, invoice.sellerName, invoice.sellerTaxNo, invoice.buyerName,
            invoice.buyerTaxNo, invoice.goodsName, invoice.specification, invoice.unit,
            invoice.quantity, invoice.unitPrice, invoice.amount, invoice.taxRate,
            invoice.taxAmount, invoice.totalAmount, invoice.paymentStatus, invoice.paidAmount,
            invoice.voucherId || null, invoice.voucherNo || null, invoice.partnerId || null, invoice.partnerName || null,
            invoice.notes || null, invoice.accountSetId, invoice.createTime, invoice.updateTime,
            invoice.groupName || null
          ]);
          stmt.free();

          success++;
          addedInvoices.push(invoice);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`导入发票 ${key} 失败: ${errorMsg}`);
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
    const db = await getDb();

    const rec: InvoiceReconciliation = {
      ...recData,
      id: generateId(),
      createTime: new Date().toISOString(),
    };

    const stmt = db.prepare(
      `INSERT INTO invoiceReconciliations (
        id, tenantId, invoiceId, voucherId, entryId, amount, reconcileDate, notes, accountSetId, createTime
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run([
      rec.id, sqliteService.tenantId, rec.invoiceId, rec.voucherId, rec.entryId, rec.amount,
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

    const stmt = db.prepare('DELETE FROM invoiceReconciliations WHERE id = ? AND tenantId = ? AND accountSetId = ?');
    stmt.run([id, sqliteService.tenantId, useAccountSetStore.getState().currentAccountSetId ?? '']);
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
    console.log('开始生成凭证，invoiceId:', invoiceId);
    const invoice = get().getInvoiceById(invoiceId);
    console.log('获取到的发票信息:', invoice);
    if (!invoice) {
      set({ error: '发票不存在' });
      return null;
    }

    if (invoice.voucherId) {
      set({ error: '该发票已生成凭证' });
      return null;
    }

    if (invoice.holdStatus === 'on_hold') {
      set({ error: '该发票已标记为暂不入账，无法生成凭证' });
      return null;
    }

    const accountSetId = useAccountSetStore.getState().currentAccountSetId;
    console.log('当前账套ID:', accountSetId);
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

      // 2.5 从匹配规则中提取税金基础科目（用于自动税率匹配）
      let baseTaxSubject: string | undefined;
      if (matchedRule) {
        const taxAction = matchedRule.actions.find(
          (a): a is OverrideSubjectAction => a.type === 'overrideSubject' && a.slot === 'tax'
        );
        if (taxAction?.subjectCode) {
          baseTaxSubject = taxAction.subjectCode;
        }
      }

      // 3. 检测费用类别（报销/差旅/招待等）
      const expenseCategory = detectExpenseCategory(invoice, expenseKeywords);

      // 4. 构建 EngineContext 并执行动作，得到 ActionResult
      const currentAccountSetForTax = useAccountSetStore.getState().getCurrentAccountSet();
      const taxpayerType = currentAccountSetForTax?.accounting?.taxpayerType;
      const enabledTaxRates = currentAccountSetForTax?.accounting?.enabledTaxRates;
      const engineContext: EngineContext = {
        invoice,
        matchedRule,
        supplierMappings,
        expenseReimbursements,
        auxiliaryStrategy,
        expenseKeywords,
        assetMappings,
        allRules: rules,
        baseTaxSubject,
        taxpayerType,
        enabledTaxRates,
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

      // 5.5 业务组配置：业务组科目覆盖 + 税金科目跳过
      let businessGroupName: string | null = null;
      if (invoice.groupName) {
        try {
          const ruleConfig = await sqliteService.getPurchaseInvoiceRuleConfig();
          const matchedGroup = ruleConfig.businessGroups.find(g => g.name === invoice.groupName);
          if (matchedGroup) {
            businessGroupName = matchedGroup.name;
            // 业务组科目覆盖（优先于规则引擎结果）
            if (matchedGroup.debitSubject) {
              const debitEntryId = slotMap['debit'];
              if (debitEntryId) {
                const code = matchedGroup.debitSubject.split(' ')[0];
                const name = matchedGroup.debitSubject.split(' ').slice(1).join(' ') || code;
                mappedOverrides[debitEntryId] = { code, name };
              }
            }
            if (matchedGroup.creditSubject) {
              const creditEntryId = slotMap['credit'];
              if (creditEntryId) {
                const code = matchedGroup.creditSubject.split(' ')[0];
                const name = matchedGroup.creditSubject.split(' ').slice(1).join(' ') || code;
                mappedOverrides[creditEntryId] = { code, name };
              }
            }
            if (matchedGroup.taxSubject) {
              const taxEntryId = slotMap['tax'];
              if (taxEntryId) {
                const code = matchedGroup.taxSubject.split(' ')[0];
                const name = matchedGroup.taxSubject.split(' ').slice(1).join(' ') || code;
                mappedOverrides[taxEntryId] = { code, name };
              }
            } else {
              // 业务组明确不设税金科目，移除税金分录
              const taxEntryId = slotMap['tax'];
              if (taxEntryId) {
                mappedOverrides[taxEntryId] = { code: '', name: '' };
              }
            }
          }
        } catch (e) {
          console.warn('读取业务组配置失败:', e);
        }
      }

      // 5.6 小规模纳税人强制压制税金分录（即使业务组配了税金科目也不生成）
      // 模板引擎会自动把税额并入借方（费用/资产）以满足借贷平衡
      if (taxpayerType === 'small') {
        const taxEntryId = slotMap['tax'];
        if (taxEntryId) {
          mappedOverrides[taxEntryId] = { code: '', name: '' };
        }
      }

      // 6. 科目校验 — 不存在的科目自动创建（税金科目等）
      const { useSubjectStore } = await import('./useSubjectStore');
      const subjectStore = useSubjectStore.getState();
      let subjects = subjectStore.subjects;
      const existingCodes = new Set(subjects.map(s => s.code));

      const missingSubjects: { code: string; name: string }[] = [];
      for (const [, val] of Object.entries(mappedOverrides)) {
        if (val.code && !existingCodes.has(val.code)) {
          missingSubjects.push({ code: val.code, name: val.name || val.code });
        }
      }

      if (missingSubjects.length > 0) {
        // 自动创建缺失的科目
        for (const s of missingSubjects) {
          const level = Math.floor((s.code.length - 2) / 2);
          // 查找父科目：取科目代码的前缀（去掉最后2位），用 code 查找实际 id
          const parentCode = s.code.length > 4 ? s.code.substring(0, s.code.length - 2) : null;
          const parentSubject = parentCode ? subjects.find(ps => ps.code === parentCode) : null;

          await subjectStore.addSubject({
            code: s.code,
            name: s.name,
            level,
            direction: parentSubject?.direction || 'credit',
            parentId: parentSubject?.id || null,
            isCustomer: false,
            isSupplier: false,
            isEmployee: false,
            enableDept: false,
            enableProject: false,
            enableForeign: false,
            enableCashFlow: false,
            disabled: false,
            block: false,
          });
        }
        // 重新获取科目列表（addSubject 会更新 store）
        subjects = useSubjectStore.getState().subjects;
      }

      console.log('准备调用模板引擎，mappedOverrides:', mappedOverrides);
      // 7. 调用模板引擎
      const { templateEngine } = await import('@/lib/template-engine');
      const defaultTemplateId = isInput ? 'tpl_purchase_invoice' : 'tpl_sale_invoice';
      const templateId = defaultTemplateId;
      const inputData = {
        total_amount: invoice.totalAmount,
        tax_amount: invoice.taxAmount || 0,
        base_amount: invoice.amount,
        partner_name: isInput ? invoice.sellerName : invoice.buyerName,
        invoice_date: invoice.invoiceDate,
        invoice_no: invoice.invoiceCode,
      };
      console.log('模板输入数据:', inputData);

      const tplResult = templateEngine.generateVoucherWithOverrides(templateId, inputData, mappedOverrides);
      console.log('模板引擎返回结果:', tplResult);

      if (!tplResult.success || !tplResult.voucher) {
        set({ error: tplResult.errors?.join('; ') || '模板引擎生成失败' });
        return null;
      }

      // 8. 生成凭证号
      const yearMonth = voucherDate.substring(0, 7).replace('-', '');
      let nextSeq = 1;
      const seqResult = db.exec(
        `SELECT voucherNo FROM vouchers WHERE tenantId = ? AND accountSetId = ? AND voucherNo LIKE ? ORDER BY voucherNo DESC LIMIT 1`,
        [sqliteService.tenantId, accountSetId, `记-${yearMonth}-%`]
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

      // 获取当前账套的往来核算方式
      const currentAccountSet = useAccountSetStore.getState().getCurrentAccountSet();
      const partnerTrackingMethod = currentAccountSet?.accounting?.partnerTrackingMethod || 'card';

      // 9. 构建单据号（发票号码+数电发票号码）并校验重复
      const docNo = invoice.digitalInvoiceNo
        ? `${invoice.invoiceCode}/${invoice.digitalInvoiceNo}`
        : invoice.invoiceCode;

      // 校验该单据号是否已在总账凭证中存在
      const existingVoucher = db.exec(
        `SELECT id, voucherNo FROM vouchers WHERE referenceNumber = ? AND tenantId = ? AND accountSetId = ?`,
        [docNo, sqliteService.tenantId, accountSetId]
      );
      if (existingVoucher.length > 0 && existingVoucher[0].values.length > 0) {
        const existingNo = existingVoucher[0].values[0][1] as string;
        const msg = `单据号 ${docNo} 已在凭证 ${existingNo} 中入账，不允许重复入账`;
        set({ error: msg });
        return null;
      }

      let stmt = db.prepare(
        `INSERT INTO vouchers (id, tenantId, voucherNo, date, summary, status, creator, referenceNumber, accountSetId, createTime, updateTime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      stmt.run([voucherId, sqliteService.tenantId, voucherNo, voucherDate, '', 'posted', '系统', docNo, accountSetId, now, now]);
      stmt.free();

      // 10. INSERT 分录（从模板引擎输出转换）
      const tplEntries = tplResult.voucher.entries;
      for (let i = 0; i < tplEntries.length; i++) {
        const entry = tplEntries[i];
        const entryId = `${voucherId}-${i + 1}`;
        const direction = entry.debit > 0 ? 'debit' : 'credit';
        let customerName = isInput ? '' : partnerName;
        let supplierName = isInput ? partnerName : '';
        let subjectCode = entry.subjectCode;
        let subjectName = entry.subjectName;

        // 业务组名称作为摘要（替代模板默认的科目名称摘要）
        if (businessGroupName && entry.summary) {
          entry.summary = businessGroupName;
        }

        // 根据往来核算方式调整科目和往来信息
        if (partnerTrackingMethod === 'subject') {
          // 科目方式：创建往来单位明细科目
          const partnerSubjectPrefix = isInput ? '2202' : '1122'; // 应付账款/应收账款
          if (subjectCode.startsWith('2202') || subjectCode.startsWith('1122')) {
            // 查找已有的往来科目，确定下一个可用的序号
            const existingPartnerSubjects = subjects.filter(s =>
              s.code.startsWith(partnerSubjectPrefix) &&
              s.code.length === partnerSubjectPrefix.length + 2 // 确保是2位序号的明细科目
            );
            let nextSeq = 1;
            const existingSeqs = existingPartnerSubjects.map(s => {
              const seq = parseInt(s.code.substring(partnerSubjectPrefix.length), 10);
              return isNaN(seq) ? 0 : seq;
            }).filter(s => s > 0).sort((a, b) => b - a);
            if (existingSeqs.length > 0) {
              nextSeq = existingSeqs[0] + 1;
            }

            // 生成纯数字的科目代码
            subjectCode = `${partnerSubjectPrefix}${nextSeq.toString().padStart(2, '0')}`;
            subjectName = partnerName;

            // 检查科目是否已存在，不存在则创建
            const existingSubject = subjects.find(s => s.code === subjectCode);
            if (!existingSubject) {
              await useSubjectStore.getState().addSubject({
                code: subjectCode,
                name: subjectName,
                parentId: subjects.find(s => s.code === partnerSubjectPrefix)?.id || null,
                level: 2, // 往来明细科目为2级
                direction: subjectCode.startsWith('1') ? 'debit' : 'credit', // 资产借方，负债贷方
                enableDept: false,
                enableProject: false,
                enableForeign: false,
                isCustomer: !isInput,
                isSupplier: isInput,
                isEmployee: false,
                enableCashFlow: false,
                disabled: false,
                block: false,
              });
            }

            // 科目方式下，清空往来卡片信息
            customerName = '';
            supplierName = '';
          }
        } else {
          // 往来卡片方式：保持原科目，记录往来单位信息并写入辅助核算
          // 已经在上面设置好了 customerName 和 supplierName
        }

        // 构建辅助核算 JSON
        let auxiliaryJson = '{}';
        let resolvedPartnerId: string | undefined = invoice.partnerId || undefined;
        if (partnerTrackingMethod === 'card' && (subjectCode.startsWith('2202') || subjectCode.startsWith('1122'))) {
          // 往来卡片方式下，对往来科目写入辅助核算
          const { usePartnerStore } = await import('./usePartnerStore');
          const partners = usePartnerStore.getState().partners;
          const partnerNameToMatch = isInput ? invoice.sellerName : invoice.buyerName;
          let matchedPartner = partners.find(p => p.name === partnerNameToMatch);

          // 如果往来单位不存在，自动创建供应商/客户卡片
          if (!matchedPartner && partnerNameToMatch) {
            try {
              matchedPartner = await usePartnerStore.getState().addPartner({
                code: `P${Date.now()}`,
                name: partnerNameToMatch,
                isSupplier: isInput,
                isCustomer: !isInput,
                isEmployee: false,
                taxNumber: isInput ? invoice.sellerTaxNo || undefined : invoice.buyerTaxNo || undefined,
                frozen: false,
              });
            } catch (createErr) {
              console.warn('自动创建往来单位失败:', createErr);
            }
          }

          if (matchedPartner) {
            auxiliaryJson = JSON.stringify({
              supplier: isInput ? matchedPartner.name : undefined,
              customer: !isInput ? matchedPartner.name : undefined,
            });
            resolvedPartnerId = matchedPartner.id;
          }
        }

        // 跳过金额为 0 的分录
        if (entry.debit === 0 && entry.credit === 0) continue;

        stmt = db.prepare(
          `INSERT INTO entries (id, tenantId, voucherId, subjectCode, subjectName, direction, debit, credit, summary, customerName, supplierName, partnerId, auxiliary, date, accountSetId, createTime, updateTime)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );
        stmt.run([entryId, sqliteService.tenantId, voucherId, subjectCode, subjectName, direction,
          entry.debit, entry.credit, entry.summary,
          customerName, supplierName, resolvedPartnerId || '', auxiliaryJson, voucherDate, accountSetId, now, now]);
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

      // 13. 更新发票的凭证信息和业务组名称
      const groupName = invoice.groupName || matchedRule?.name || null;
      await get().updateInvoice(invoiceId, {
        voucherId,
        voucherNo,
        groupName,
      });

      // 14. 刷新凭证 store，确保凭证列表页能看到新凭证
      try {
        const { useVoucherStore } = await import('./useVoucherStore');
        await useVoucherStore.getState().initialize();
      } catch (e) {
        console.warn('刷新凭证 store 失败:', e);
      }

      return { voucherId, voucherNo };
    } catch (error) {
      console.error('生成凭证过程中出错:', error);
      console.error('错误堆栈:', error instanceof Error ? error.stack : '无堆栈信息');
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
        const stmt = db.prepare('DELETE FROM invoices WHERE id = ? AND tenantId = ? AND accountSetId = ?');
        stmt.run([id, sqliteService.tenantId, useAccountSetStore.getState().currentAccountSetId ?? '']);
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
    console.log('开始批量生成凭证，ids:', ids, 'voucherDate:', voucherDate);
    let success = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        console.log('正在处理发票:', id);
        const result = await get().generateInvoiceVoucher(id, voucherDate);
        if (result) {
          console.log('发票', id, '凭证生成成功:', result);
          success++;
        } else {
          const error = get().error;
          console.log('发票', id, '凭证生成失败，错误:', error);
          errors.push(`生成发票 ${id} 凭证失败: ${error}`);
        }
      } catch (error) {
        console.error('处理发票', id, '时发生异常:', error);
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`生成发票 ${id} 凭证失败: ${errorMsg}`);
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
        `SELECT * FROM invoices WHERE tenantId = ? AND accountSetId = ? ORDER BY invoiceDate DESC, createTime DESC`,
        [sqliteService.tenantId, accountSetId]
      );

      const invoices: Invoice[] = [];
      if (invoiceResult.length > 0 && invoiceResult[0].values) {
        const columns = invoiceResult[0].columns;
        for (const row of invoiceResult[0].values) {
          const invoice: Record<string, unknown> = {};
          columns.forEach((col: string, idx: number) => {
            invoice[col] = row[idx];
          });
          invoices.push(invoice as unknown as Invoice);
        }
      }

      // 加载核销记录
      const recResult = db.exec(
        `SELECT * FROM invoiceReconciliations WHERE tenantId = ? AND accountSetId = ? ORDER BY reconcileDate DESC`,
        [sqliteService.tenantId, accountSetId]
      );

      const reconciliations: InvoiceReconciliation[] = [];
      if (recResult.length > 0 && recResult[0].values) {
        const columns = recResult[0].columns;
        for (const row of recResult[0].values) {
          const rec: Record<string, unknown> = {};
          columns.forEach((col: string, idx: number) => {
            rec[col] = row[idx];
          });
          reconciliations.push(rec as unknown as InvoiceReconciliation);
        }
      }

      set({ invoices, reconciliations, loading: false });
    } catch (error) {
      console.error('初始化发票数据失败:', error);
      set({ loading: false, error: '初始化发票数据失败' });
    }
  },
}));
