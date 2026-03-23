'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 报表行配置
export interface ReportRow {
  id: string;
  rowName: string;
  rowType: 'header' | 'data' | 'subtotal' | 'total';
  formula: 'sum' | 'subtract' | 'none';
  linkedSubjectCodes: string[]; // 支持通配符，如 ['1001', '1002', '1122*']
  order: number;
  section: 'assets' | 'liabilities' | 'equity' | 'revenue' | 'cost' | 'expense' | 'profit';
  rowNo?: string; // 行次号（如 "1", "2", ...）
  parentId?: string; // 父行ID（用于小计行）
  indent?: number; // 缩进级别
  expanded?: boolean; // 是否展开（用于预览时显示子科目）
}

// 保存的报表模板
export interface ReportTemplate {
  id: string;
  name: string;
  description?: string;
  reportType: 'assets' | 'profit';
  rows: ReportRow[];
  isSystem?: boolean; // 是否为系统预设模板
  createTime?: string;
  updateTime?: string;
}

interface ReportConfigStore {
  // 资产负债表配置
  assetsReportRows: ReportRow[];
  // 利润表配置
  profitReportRows: ReportRow[];
  // 保存的模板
  templates: ReportTemplate[];
  // 编辑状态
  editingRow: { reportType: 'assets' | 'profit'; rowId: string } | null;

  // Actions
  setAssetsReportRows: (rows: ReportRow[]) => void;
  setProfitReportRows: (rows: ReportRow[]) => void;
  updateRow: (reportType: 'assets' | 'profit', rowId: string, updates: Partial<ReportRow>) => void;
  addRow: (reportType: 'assets' | 'profit', row: Omit<ReportRow, 'id'>) => void;
  deleteRow: (reportType: 'assets' | 'profit', rowId: string) => void;
  setEditingRow: (editing: { reportType: 'assets' | 'profit'; rowId: string } | null) => void;

  // 模板管理
  saveTemplate: (template: ReportTemplate) => void;
  loadTemplate: (reportType: 'assets' | 'profit', templateId: string) => void;
  deleteTemplate: (templateId: string) => void;
  resetToDefault: (reportType: 'assets' | 'profit') => void;

  // 科目解析工具方法
  resolveSubjectCodes: (
    linkedCodes: string[],
    allSubjects: Array<{ code: string; name: string }>
  ) => Array<{ code: string; name: string }>;
}

// 工具函数：解析科目代码（支持通配符和区间）
const resolveSubjectCodes = (
  linkedCodes: string[],
  allSubjects: Array<{ code: string; name: string }>
): Array<{ code: string; name: string }> => {
  const result: Set<string> = new Set();

  linkedCodes.forEach(pattern => {
    // 处理区间语法，如 "1001..1009"
    if (pattern.includes('..')) {
      const [start, end] = pattern.split('..');
      allSubjects.forEach(subject => {
        if (subject.code >= start && subject.code <= end) {
          result.add(subject.code);
        }
      });
      return;
    }

    // 处理通配符语法，如 "1002*" 或 "1002.*"
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\./g, '\\.');
      const regex = new RegExp(`^${regexPattern}$`);

      allSubjects.forEach(subject => {
        if (regex.test(subject.code)) {
          result.add(subject.code);
        }
      });
      return;
    }

    // 精确匹配
    result.add(pattern);
  });

  return Array.from(result).map(code => {
    const subject = allSubjects.find(s => s.code === code);
    return { code, name: subject?.name || code };
  });
};

// 默认资产负债表配置（标准格式）
const defaultAssetsReportRows: ReportRow[] = [
  // 流动资产
  { id: 'ca_header', rowName: '流动资产：', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 1, section: 'assets', rowNo: '', indent: 0 },
  { id: 'cash_funds', rowName: '货币资金', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1001', '1002', '1012'], order: 2, section: 'assets', rowNo: '1', indent: 1 },
  { id: 'short_invest', rowName: '短期投资', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1101'], order: 3, section: 'assets', rowNo: '2', indent: 1 },
  { id: 'ar_notes', rowName: '应收票据', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1121'], order: 4, section: 'assets', rowNo: '3', indent: 1 },
  { id: 'ar', rowName: '应收账款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1122'], order: 5, section: 'assets', rowNo: '4', indent: 1 },
  { id: 'prepay', rowName: '预付账款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1123'], order: 6, section: 'assets', rowNo: '5', indent: 1 },
  { id: 'div_receivable', rowName: '应收股利', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1131'], order: 7, section: 'assets', rowNo: '6', indent: 1 },
  { id: 'interest_receivable', rowName: '应收利息', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1132'], order: 8, section: 'assets', rowNo: '7', indent: 1 },
  { id: 'other_receivable', rowName: '其他应收款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1221'], order: 9, section: 'assets', rowNo: '8', indent: 1 },
  { id: 'inventory', rowName: '存货', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1403', '1405', '5001'], order: 10, section: 'assets', rowNo: '9', indent: 1 },
  { id: 'raw_materials', rowName: '其中：原材料', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1403'], order: 11, section: 'assets', rowNo: '10', indent: 2 },
  { id: 'wip', rowName: '在产品', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['5001'], order: 12, section: 'assets', rowNo: '11', indent: 2 },
  { id: 'finished_goods', rowName: '库存商品', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1405'], order: 13, section: 'assets', rowNo: '12', indent: 2 },
  { id: 'turnover_materials', rowName: '周转材料', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1411'], order: 14, section: 'assets', rowNo: '13', indent: 2 },
  { id: 'other_ca', rowName: '其他流动资产', rowType: 'data', formula: 'sum', linkedSubjectCodes: [], order: 15, section: 'assets', rowNo: '14', indent: 1 },
  { id: 'ca_total', rowName: '流动资产合计', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 16, section: 'assets', rowNo: '15', indent: 0 },
  // 非流动资产
  { id: 'nca_header', rowName: '非流动资产：', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 17, section: 'assets', rowNo: '', indent: 0 },
  { id: 'long_bond_invest', rowName: '长期债券投资', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1503'], order: 18, section: 'assets', rowNo: '16', indent: 1 },
  { id: 'long_equity_invest', rowName: '长期股权投资', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1511'], order: 19, section: 'assets', rowNo: '17', indent: 1 },
  { id: 'fixed_assets_orig', rowName: '固定资产原价', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1601'], order: 20, section: 'assets', rowNo: '18', indent: 1 },
  { id: 'accum_depreciation', rowName: '减：累计折旧', rowType: 'data', formula: 'subtract', linkedSubjectCodes: ['1602'], order: 21, section: 'assets', rowNo: '19', indent: 1, parentId: 'fixed_assets_net' },
  { id: 'fixed_assets_net', rowName: '固定资产账面价值', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 22, section: 'assets', rowNo: '20', indent: 1 },
  { id: 'construction', rowName: '在建工程', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1604'], order: 23, section: 'assets', rowNo: '21', indent: 1 },
  { id: 'engineering_materials', rowName: '工程物资', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1605'], order: 24, section: 'assets', rowNo: '22', indent: 1 },
  { id: 'fixed_assets_cleanup', rowName: '固定资产清理', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1606'], order: 25, section: 'assets', rowNo: '23', indent: 1 },
  { id: 'biological_assets', rowName: '生产性生物资产', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1621'], order: 26, section: 'assets', rowNo: '24', indent: 1 },
  { id: 'intangible_assets', rowName: '无形资产', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1701'], order: 27, section: 'assets', rowNo: '25', indent: 1 },
  { id: 'dev_expense', rowName: '开发支出', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1704'], order: 28, section: 'assets', rowNo: '26', indent: 1 },
  { id: 'long_prepaid', rowName: '长期待摊费用', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['1801'], order: 29, section: 'assets', rowNo: '27', indent: 1 },
  { id: 'other_nca', rowName: '其他非流动资产', rowType: 'data', formula: 'sum', linkedSubjectCodes: [], order: 30, section: 'assets', rowNo: '28', indent: 1 },
  { id: 'nca_total', rowName: '非流动资产合计', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 31, section: 'assets', rowNo: '29', indent: 0 },
  { id: 'assets_total', rowName: '资产总计', rowType: 'total', formula: 'sum', linkedSubjectCodes: [], order: 32, section: 'assets', rowNo: '30', indent: 0 },

  // 流动负债
  { id: 'cl_header', rowName: '流动负债：', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 33, section: 'liabilities', rowNo: '', indent: 0 },
  { id: 'short_borrowing', rowName: '短期借款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2001'], order: 34, section: 'liabilities', rowNo: '31', indent: 1 },
  { id: 'ap_notes', rowName: '应付票据', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2201'], order: 35, section: 'liabilities', rowNo: '32', indent: 1 },
  { id: 'ap', rowName: '应付账款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2202'], order: 36, section: 'liabilities', rowNo: '33', indent: 1 },
  { id: 'advance_receipts', rowName: '预收账款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2203'], order: 37, section: 'liabilities', rowNo: '34', indent: 1 },
  { id: 'employee_pay', rowName: '应付职工薪酬', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2211'], order: 38, section: 'liabilities', rowNo: '35', indent: 1 },
  { id: 'taxes_payable', rowName: '应交税费', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2221'], order: 39, section: 'liabilities', rowNo: '36', indent: 1 },
  { id: 'interest_payable', rowName: '应付利息', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2231'], order: 40, section: 'liabilities', rowNo: '37', indent: 1 },
  { id: 'div_payable', rowName: '应付利润', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2232'], order: 41, section: 'liabilities', rowNo: '38', indent: 1 },
  { id: 'other_payable', rowName: '其他应付款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2241'], order: 42, section: 'liabilities', rowNo: '39', indent: 1 },
  { id: 'other_cl', rowName: '其他流动负债', rowType: 'data', formula: 'sum', linkedSubjectCodes: [], order: 43, section: 'liabilities', rowNo: '40', indent: 1 },
  { id: 'cl_total', rowName: '流动负债合计', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 44, section: 'liabilities', rowNo: '41', indent: 0 },
  // 非流动负债
  { id: 'ncl_header', rowName: '非流动负债：', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 45, section: 'liabilities', rowNo: '', indent: 0 },
  { id: 'long_borrowing', rowName: '长期借款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2501'], order: 46, section: 'liabilities', rowNo: '42', indent: 1 },
  { id: 'long_payable', rowName: '长期应付款', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2701'], order: 47, section: 'liabilities', rowNo: '43', indent: 1 },
  { id: 'deferred_income', rowName: '递延收益', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['2401'], order: 48, section: 'liabilities', rowNo: '44', indent: 1 },
  { id: 'other_ncl', rowName: '其他非流动负债', rowType: 'data', formula: 'sum', linkedSubjectCodes: [], order: 49, section: 'liabilities', rowNo: '45', indent: 1 },
  { id: 'ncl_total', rowName: '非流动负债合计', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 50, section: 'liabilities', rowNo: '46', indent: 0 },
  { id: 'liabilities_total', rowName: '负债合计', rowType: 'total', formula: 'sum', linkedSubjectCodes: [], order: 51, section: 'liabilities', rowNo: '47', indent: 0 },

  // 所有者权益
  { id: 'equity_header', rowName: '所有者权益（或股东权益）：', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 52, section: 'equity', rowNo: '', indent: 0 },
  { id: 'paid_in_capital', rowName: '实收资本（或股本）', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['4001'], order: 53, section: 'equity', rowNo: '48', indent: 1 },
  { id: 'capital_reserve', rowName: '资本公积', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['4002'], order: 54, section: 'equity', rowNo: '49', indent: 1 },
  { id: 'surplus_reserve', rowName: '盈余公积', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['4101'], order: 55, section: 'equity', rowNo: '50', indent: 1 },
  { id: 'retained_earnings', rowName: '未分配利润', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['4103'], order: 56, section: 'equity', rowNo: '51', indent: 1 },
  { id: 'equity_total', rowName: '所有者权益（或股东权益）合计', rowType: 'total', formula: 'sum', linkedSubjectCodes: [], order: 57, section: 'equity', rowNo: '52', indent: 0 },
  { id: 'le_total', rowName: '负债和所有者权益（或股东权益）总计', rowType: 'total', formula: 'sum', linkedSubjectCodes: [], order: 58, section: 'equity', rowNo: '53', indent: 0 },
];

// 默认利润表配置
const defaultProfitReportRows: ReportRow[] = [
  { id: 'revenue_header', rowName: '一、营业收入', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 1, section: 'revenue', indent: 0 },
  { id: 'main_revenue', rowName: '主营业务收入', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6001', '6051'], order: 2, section: 'revenue', indent: 1 },
  { id: 'other_revenue', rowName: '其他业务收入', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6051'], order: 3, section: 'revenue', indent: 1 },
  { id: 'investment_income', rowName: '加：投资收益', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6111'], order: 4, section: 'revenue', indent: 1 },

  { id: 'cost_header', rowName: '减：营业成本', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 5, section: 'cost', indent: 0 },
  { id: 'main_cost', rowName: '主营业务成本', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6401'], order: 6, section: 'cost', indent: 1 },

  { id: 'tax_header', rowName: '减：税金及附加', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 7, section: 'expense', indent: 0 },
  { id: 'tax_surcharges', rowName: '税金及附加', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6402'], order: 8, section: 'expense', indent: 1 },

  { id: 'expense_header', rowName: '减：期间费用', rowType: 'header', formula: 'none', linkedSubjectCodes: [], order: 9, section: 'expense', indent: 0 },
  { id: 'sales_expense', rowName: '销售费用', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6601'], order: 10, section: 'expense', indent: 1 },
  { id: 'admin_expense', rowName: '管理费用', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6602'], order: 11, section: 'expense', indent: 1 },
  { id: 'finance_expense', rowName: '财务费用', rowType: 'data', formula: 'sum', linkedSubjectCodes: ['6603'], order: 12, section: 'expense', indent: 1 },

  { id: 'operating_profit', rowName: '二、营业利润', rowType: 'subtotal', formula: 'sum', linkedSubjectCodes: [], order: 13, section: 'profit', indent: 0 },
  { id: 'total_profit', rowName: '三、利润总额', rowType: 'total', formula: 'sum', linkedSubjectCodes: [], order: 14, section: 'profit', indent: 0 },
];

export const useReportConfigStore = create<ReportConfigStore>()(
  persist(
    (set, get) => ({
      assetsReportRows: defaultAssetsReportRows,
      profitReportRows: defaultProfitReportRows,
      templates: [],
      editingRow: null,

      setAssetsReportRows: (rows) => set({ assetsReportRows: rows }),
      setProfitReportRows: (rows) => set({ profitReportRows: rows }),

      updateRow: (reportType, rowId, updates) => {
        const key = reportType === 'assets' ? 'assetsReportRows' : 'profitReportRows';
        set((state) => ({
          [key]: state[key].map(row =>
            row.id === rowId ? { ...row, ...updates } : row
          )
        }));
      },

      addRow: (reportType, row) => {
        const key = reportType === 'assets' ? 'assetsReportRows' : 'profitReportRows';
        const newRow: ReportRow = { ...row, id: `row_${Date.now()}` };
        set((state) => ({
          [key]: [...state[key], newRow]
        }));
      },

      deleteRow: (reportType, rowId) => {
        const key = reportType === 'assets' ? 'assetsReportRows' : 'profitReportRows';
        set((state) => ({
          [key]: state[key].filter(row => row.id !== rowId)
        }));
      },

      setEditingRow: (editing) => set({ editingRow: editing }),

      saveTemplate: (template) => {
        set((state) => ({
          templates: [...state.templates.filter(t => t.id !== template.id), template]
        }));
      },

      loadTemplate: (reportType, templateId) => {
        const template = get().templates.find(t => t.id === templateId);
        if (template) {
          const key = reportType === 'assets' ? 'assetsReportRows' : 'profitReportRows';
          set({ [key]: template.rows });
        }
      },

      deleteTemplate: (templateId) => {
        set((state) => ({
          templates: state.templates.filter(t => t.id !== templateId)
        }));
      },

      resetToDefault: (reportType) => {
        if (reportType === 'assets') {
          set({ assetsReportRows: defaultAssetsReportRows });
        } else {
          set({ profitReportRows: defaultProfitReportRows });
        }
      },

      resolveSubjectCodes,
    }),
    {
      name: 'finance-report-config',
      partialize: (state) => ({
        assetsReportRows: state.assetsReportRows,
        profitReportRows: state.profitReportRows,
        templates: state.templates
      })
    }
  )
);
