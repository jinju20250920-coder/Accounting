'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calculator,
  CheckCircle2,
  Copy,
  Download,
  BarChart3,
  ChevronDown,
  FileDown,
  FileText,
  Eraser,
  MoreHorizontal,
  ReceiptText,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Settings2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverItem } from '@/components/ui/popover';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { useToast } from '@/components/ui/toast';
import { useAccountSetStore, type AccountSet } from '@/stores/useAccountSetStore';
import { useSubjectStore } from '@/stores/useSubjectStore';
import { useDepartmentStore } from '@/stores/useDepartmentStore';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { usePayrollStore } from '@/stores/usePayrollStore';
import {
  createBlankPayrollInput,
  createBlankPayrollCalculationConfig,
  roundMoney,
  validatePayrollInput,
  type PayrollCalculationConfig,
  type PayrollCalculationResult,
  type PayrollInput,
  type PayrollIncomeType,
  type PayrollAnnualBonusTaxMethod,
  type PayrollItem,
  type SocialInsuranceConfig,
} from '@/lib/payroll';
import {
  exportPayrollResults,
  exportToTaxSystem,
  generatePayrollImportTemplate,
  parsePayrollFileWithTaxSupport,
  type PayrollImportError,
} from '@/lib/payroll-import';
import {
  applyPayrollRegionPreset,
  getDefaultPayrollRegionId,
  PAYROLL_REGION_PRESETS,
  PAYROLL_TAX_SCENARIO_NOTES,
  type PayrollRegionId,
} from '@/lib/payroll-defaults';
import {
  BUILT_IN_PAYROLL_TAX_RULES,
  clonePayrollTaxRuleSet,
  type PayrollTaxRuleType,
} from '@/lib/payroll-tax-rules';
import {
  buildPayrollAccrualVoucherPreview,
  type PayrollVoucherEntryPreview,
} from '@/lib/payroll-voucher';
import type { Department } from '@/lib/database/service';
import type { Partner } from '@/types';
import { SubjectPopover } from '@/components/shared/subject-popover';
import { VoucherStamp } from '@/components/shared/voucher-stamp';
import { sqliteService } from '@/lib/database';
import { isMonetarySubject } from '@/lib/fx-monetary';

interface PayrollVoucherDefaultSubjectDraft {
  payrollSalaryExpenseSubjectCode: string;
  payrollSalaryExpenseSubjectName: string;
  payrollContributionExpenseSubjectCode: string;
  payrollContributionExpenseSubjectName: string;
  payrollSalaryPayableSubjectCode: string;
  payrollSalaryPayableSubjectName: string;
  payrollTaxPayableSubjectCode: string;
  payrollTaxPayableSubjectName: string;
  payrollEmployeeContributionPayableSubjectCode: string;
  payrollEmployeeContributionPayableSubjectName: string;
  payrollEmployerContributionPayableSubjectCode: string;
  payrollEmployerContributionPayableSubjectName: string;
}

const PAYROLL_TAX_RULE_SECTIONS: {
  ruleType: PayrollTaxRuleType;
  label: string;
  description: string;
}[] = [
  { ruleType: 'salary', label: '工资薪金', description: '工资薪金及奖金的累计预扣预缴规则' },
  { ruleType: 'annual_bonus', label: '全年一次性奖金', description: '全年一次性奖金税率表及速算扣除数' },
  { ruleType: 'business_income', label: '经营所得', description: '经营所得参考税率表' },
];

const PAYROLL_VOUCHER_SUBJECT_FIELDS: {
  codeField: keyof PayrollVoucherDefaultSubjectDraft;
  nameField: keyof PayrollVoucherDefaultSubjectDraft;
  label: string;
}[] = [
  {
    codeField: 'payrollSalaryExpenseSubjectCode',
    nameField: 'payrollSalaryExpenseSubjectName',
    label: '工资费用科目',
  },
  {
    codeField: 'payrollContributionExpenseSubjectCode',
    nameField: 'payrollContributionExpenseSubjectName',
    label: '社保公积金费用科目',
  },
  {
    codeField: 'payrollSalaryPayableSubjectCode',
    nameField: 'payrollSalaryPayableSubjectName',
    label: '应付工资科目',
  },
  {
    codeField: 'payrollTaxPayableSubjectCode',
    nameField: 'payrollTaxPayableSubjectName',
    label: '个税应交科目',
  },
  {
    codeField: 'payrollEmployeeContributionPayableSubjectCode',
    nameField: 'payrollEmployeeContributionPayableSubjectName',
    label: '个人社保公积金代扣科目',
  },
  {
    codeField: 'payrollEmployerContributionPayableSubjectCode',
    nameField: 'payrollEmployerContributionPayableSubjectName',
    label: '企业社保公积金代付科目',
  },
];

type InsuranceKey = keyof Pick<SocialInsuranceConfig, 'pension' | 'medical' | 'unemployment' | 'injury' | 'maternity' | 'supplementaryMedical'>;

const INSURANCE_ROWS: { key: InsuranceKey; label: string }[] = [
  { key: 'pension', label: '养老保险' },
  { key: 'medical', label: '医疗保险' },
  { key: 'unemployment', label: '失业保险' },
  { key: 'injury', label: '工伤保险' },
  { key: 'maternity', label: '生育保险' },
  { key: 'supplementaryMedical', label: '补充医疗' },
];

const PAYROLL_AMOUNT_FIELDS: { key: keyof PayrollInput; label: string }[] = [
  { key: 'basicSalary', label: '本期收入' },
  { key: 'taxExemptIncome', label: '本期免税收入' },
  { key: 'childEducation', label: '累计子女教育' },
  { key: 'continuingEducation', label: '累计继续教育' },
  { key: 'housingLoanInterest', label: '累计住房贷款利息' },
  { key: 'housingRent', label: '累计住房租金' },
  { key: 'elderlyCare', label: '累计赡养老人' },
  { key: 'infantCare', label: '累计婴幼儿照护' },
  { key: 'privatePension', label: '累计个人养老金' },
  { key: 'corporateAnnuity', label: '企业(职业)年金' },
  { key: 'commercialHealthInsurance', label: '商业健康保险' },
  { key: 'taxDeferredPension', label: '税延养老保险' },
  { key: 'donation', label: '准予扣除的捐赠额' },
  { key: 'taxReduction', label: '减免税额' },
  { key: 'otherLegalDeduction', label: '其他' },
];

const EMPTY_ENTRY_ROW_COUNT = 10;
const EXCEL_TEXT_INPUT_CLASS = 'h-7 rounded-none border-0 bg-transparent px-1.5 py-0 text-xs shadow-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500';
const EXCEL_NUMBER_INPUT_CLASS = `${EXCEL_TEXT_INPUT_CLASS} text-right tabular-nums`;
const EXCEL_CELL_CLASS = 'border border-slate-300 bg-white px-1 py-0.5 align-middle';
const EXCEL_READONLY_CELL_CLASS = 'border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-right tabular-nums text-slate-700';
const EXCEL_HEADER_CELL_CLASS = 'border border-slate-300 bg-slate-100 px-2 py-1 text-left font-medium text-slate-700';
const EXCEL_SELECT_CLASS = 'h-7 w-full border-0 bg-transparent px-1.5 text-xs outline-none';
const STICKY_EMPLOYEE_CODE_CELL_CLASS = 'sticky left-12 z-[2] border border-slate-300 bg-inherit px-1 py-0.5 font-mono text-xs';
const STICKY_EMPLOYEE_NAME_CELL_CLASS = 'sticky left-36 z-[2] border border-slate-300 bg-inherit px-1 py-0.5';
const OPTIONAL_AMOUNT_FIELD_KEYS = new Set<keyof PayrollInput>([
  'taxExemptIncome',
  'corporateAnnuity',
  'commercialHealthInsurance',
  'taxDeferredPension',
  'donation',
  'taxReduction',
  'otherLegalDeduction',
]);

function createBlankPayrollRows(): PayrollInput[] {
  return Array.from({ length: EMPTY_ENTRY_ROW_COUNT }, () => createBlankPayrollInput());
}

function hasDraftInput(row: PayrollInput): boolean {
  return Boolean(
    row.employeeCode.trim()
    || row.employeeName.trim()
    || row.idNumber?.trim()
    || PAYROLL_AMOUNT_FIELDS.some(({ key }) => Number(row[key] || 0) !== 0),
  );
}

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChineseDate(value: string): string {
  if (!value) return '--';
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${year}年${String(Number(month))}月${String(Number(day))}日`;
}

function formatChineseDateInput(value: string): string {
  if (!value) return '';
  return formatChineseDate(value);
}

function parseChineseDateInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const chineseMatch = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (chineseMatch) {
    const [, year, month, day] = chineseMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return value;
}

function formatContributionRatePercent(rate: number): number {
  return Number((rate * 100).toFixed(6));
}

function getIncomeTypeLabel(input: PayrollInput): string {
  if (input.incomeType === 'annual_bonus') return '全年一次性奖金';
  if (input.incomeType === 'salary') return '工资薪金';
  return '';
}

function getAnnualBonusTaxMethodLabel(input: PayrollInput): string {
  if (input.incomeType !== 'annual_bonus' || !input.annualBonusTaxMethod) return '--';
  return input.annualBonusTaxMethod === 'consolidated' ? '并入综合所得' : '单独计税';
}

function resolveEmployeeDepartmentName(
  employee: Partner,
  departments: Department[],
  fallback = '',
): string {
  const employeeRecord = employee as Partner & {
    departmentCode?: string;
    departmentName?: string;
    department?: string;
    payrollDepartmentName?: string;
  };
  const directName = employeeRecord.departmentName?.trim()
    || employeeRecord.department?.trim()
    || employeeRecord.payrollDepartmentName?.trim();
  if (directName) return directName;

  const code = employeeRecord.departmentCode?.trim();
  if (!code) return fallback;
  return departments.find((item) => item.code === code)?.name || fallback;
}

function createPayrollVoucherDefaultSubjectDraft(
  accountSet: AccountSet | null,
): PayrollVoucherDefaultSubjectDraft {
  const defaults: PayrollVoucherDefaultSubjectDraft = {
    payrollSalaryExpenseSubjectCode: accountSet?.payrollSalaryExpenseSubjectCode || '',
    payrollSalaryExpenseSubjectName: accountSet?.payrollSalaryExpenseSubjectName || '',
    payrollContributionExpenseSubjectCode: accountSet?.payrollContributionExpenseSubjectCode || '',
    payrollContributionExpenseSubjectName: accountSet?.payrollContributionExpenseSubjectName || '',
    payrollSalaryPayableSubjectCode: accountSet?.payrollSalaryPayableSubjectCode || '',
    payrollSalaryPayableSubjectName: accountSet?.payrollSalaryPayableSubjectName || '',
    payrollTaxPayableSubjectCode: accountSet?.payrollTaxPayableSubjectCode || '',
    payrollTaxPayableSubjectName: accountSet?.payrollTaxPayableSubjectName || '',
    payrollEmployeeContributionPayableSubjectCode: accountSet?.payrollEmployeeContributionPayableSubjectCode || '',
    payrollEmployeeContributionPayableSubjectName: accountSet?.payrollEmployeeContributionPayableSubjectName || '',
    payrollEmployerContributionPayableSubjectCode: accountSet?.payrollEmployerContributionPayableSubjectCode || '',
    payrollEmployerContributionPayableSubjectName: accountSet?.payrollEmployerContributionPayableSubjectName || '',
  };
  return defaults;
}

function autoFillPayrollSubjectDefaults(
  draft: PayrollVoucherDefaultSubjectDraft,
  subjects: Array<{ code: string; name: string; direction?: string }>,
): PayrollVoucherDefaultSubjectDraft {
  if (draft.payrollSalaryExpenseSubjectCode) return draft;
  const result = { ...draft };

  const find = (keywords: string[], startsWith?: string, direction?: string) =>
    subjects.find(s => {
      if (startsWith && !s.code.startsWith(startsWith)) return false;
      if (direction && s.direction !== direction) return false;
      return keywords.some(kw => s.name.includes(kw));
    });

  if (!result.payrollSalaryExpenseSubjectCode) {
    const s = find(['工资'], '6602', 'debit') || find(['管理费用'], '6602', 'debit');
    if (s) { result.payrollSalaryExpenseSubjectCode = s.code; result.payrollSalaryExpenseSubjectName = s.name; }
  }
  if (!result.payrollContributionExpenseSubjectCode) {
    const s = find(['社保'], '6602', 'debit') || find(['管理费用'], '6602', 'debit');
    if (s && s.code !== result.payrollSalaryExpenseSubjectCode) { result.payrollContributionExpenseSubjectCode = s.code; result.payrollContributionExpenseSubjectName = s.name; }
  }
  if (!result.payrollSalaryPayableSubjectCode) {
    const s = find(['应付职工薪酬'], undefined, 'credit');
    if (s) { result.payrollSalaryPayableSubjectCode = s.code; result.payrollSalaryPayableSubjectName = s.name; }
  }
  if (!result.payrollTaxPayableSubjectCode) {
    const s = find(['个人所得税'], '2221', 'credit') || find(['应交税费'], '2221', 'credit');
    if (s) { result.payrollTaxPayableSubjectCode = s.code; result.payrollTaxPayableSubjectName = s.name; }
  }
  if (!result.payrollEmployeeContributionPayableSubjectCode) {
    const s = find(['其他应付款'], undefined, 'credit');
    if (s) { result.payrollEmployeeContributionPayableSubjectCode = s.code; result.payrollEmployeeContributionPayableSubjectName = s.name; }
  }
  if (!result.payrollEmployerContributionPayableSubjectCode) {
    const s = find(['其他应付款'], undefined, 'credit');
    if (s && s.code !== result.payrollEmployeeContributionPayableSubjectCode) {
      result.payrollEmployerContributionPayableSubjectCode = s.code; result.payrollEmployerContributionPayableSubjectName = s.name;
    } else if (s) {
      result.payrollEmployerContributionPayableSubjectCode = s.code; result.payrollEmployerContributionPayableSubjectName = s.name;
    }
  }

  return result;
}

function completeEmployeeFields(
  input: PayrollInput,
  field: 'employeeCode' | 'employeeName',
  value: string,
  employees: Partner[],
  departments: Department[],
): PayrollInput {
  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) {
    return field === 'employeeCode'
      ? { ...input, employeeCode: '', employeeName: '', departmentName: '' }
      : { ...input, [field]: value };
  }

  const employeeField = field === 'employeeCode' ? 'code' : 'name';
  const employee = employees.find((item) => (item[employeeField] || '').trim().toLowerCase() === normalizedValue);
  if (!employee) return { ...input, [field]: value };

  const employeeDepartmentName = resolveEmployeeDepartmentName(employee, departments, input.departmentName || '');
  return {
    ...input,
    employeeCode: employee.code,
    employeeName: employee.name,
    departmentName: employeeDepartmentName,
    idType: employee.idType || input.idType,
    idNumber: employee.idNumber || input.idNumber,
  };
}

function statusBadge(status?: string) {
  if (status === 'confirmed') return <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">已确认</Badge>;
  if (status === 'calculated') return <Badge className="border-blue-200 bg-blue-50 text-blue-700">已计算</Badge>;
  return <Badge className="border-slate-200 bg-slate-50 text-slate-600">草稿</Badge>;
}

interface VoucherDetail {
  id: string;
  voucherNo: string;
  date: string;
  summary: string;
  status: string;
  entries: {
    subjectCode: string;
    subjectName: string;
    debit: number;
    credit: number;
    summary: string;
    department?: string;
    partner?: string;
    project?: string;
    currencyCode?: string;
    originalAmount?: number;
    exchangeRate?: number;
  }[];
}

function VoucherDetailDialog({
  open,
  onOpenChange,
  voucherNo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucherNo: string | null;
}) {
  const [detail, setDetail] = useState<VoucherDetail | null>(null);
  const subjects = useSubjectStore((s) => s.subjects);

  useEffect(() => {
    if (open && voucherNo) {
      void loadVoucher(voucherNo);
    } else {
      setDetail(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, voucherNo]);

  const loadVoucher = async (vNo: string) => {
    try {
      const vouchers = await sqliteService.getAllVouchers();
      const voucher = vouchers.find((v) => v.voucherNo === vNo);
      if (!voucher) { setDetail(null); return; }
      const subjectMap = new Map(subjects.map((s) => [s.code, s.name]));
      setDetail({
        id: voucher.id,
        voucherNo: voucher.voucherNo,
        date: voucher.date,
        summary: voucher.summary || '',
        status: voucher.status || 'draft',
        entries: (voucher.entries || []).map((e) => ({
          subjectCode: e.subjectCode || '',
          subjectName: subjectMap.get(e.subjectCode) || e.subjectName || '',
          debit: e.debit || 0,
          credit: e.credit || 0,
          summary: e.summary || '',
          department: e.auxiliary?.department || e.deptCode || '',
          partner: e.auxiliary?.customer || e.auxiliary?.supplier || e.customerName || e.supplierName || '',
          project: e.auxiliary?.project || e.projectCode || '',
          currencyCode: e.currencyCode || '',
          originalAmount: e.originalAmount || 0,
          exchangeRate: e.exchangeRate || 0,
        })),
      });
    } catch {
      setDetail(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-600" />
            {detail?.voucherNo || voucherNo}
          </DialogTitle>
        </DialogHeader>
        {detail ? (
          <div className="relative space-y-3">
            <VoucherStamp status={detail.status} />
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <span>日期: {detail.date}</span>
              {detail.summary && <span>摘要: {detail.summary}</span>}
            </div>
            {(() => {
              const showDepartment = detail.entries.some((e) => e.department);
              const showPartner = detail.entries.some((e) => e.partner);
              const showProject = detail.entries.some((e) => e.project);
              const showFxColumns = detail.entries.some((e) => e.currencyCode && e.currencyCode !== 'CNY');
              const leadingColCount = 1
                + (showDepartment ? 1 : 0)
                + (showPartner ? 1 : 0)
                + (showProject ? 1 : 0);
              const fxCellStyle = (e: { subjectCode: string; currencyCode?: string }) => {
                const isMonetary = isMonetarySubject(e.subjectCode);
                const hasFx = !!e.currencyCode && e.currencyCode !== 'CNY';
                return isMonetary && hasFx ? 'text-slate-600' : 'text-slate-300';
              };
              const fmtOriginal = (e: { subjectCode: string; currencyCode?: string; originalAmount?: number }) => {
                if (!isMonetarySubject(e.subjectCode)) return '-';
                if (!e.currencyCode || e.currencyCode === 'CNY') return '-';
                return e.originalAmount && e.originalAmount > 0 ? formatMoney(e.originalAmount) : '-';
              };
              const fmtRate = (e: { subjectCode: string; currencyCode?: string; exchangeRate?: number }) => {
                if (!isMonetarySubject(e.subjectCode)) return '-';
                if (!e.currencyCode || e.currencyCode === 'CNY') return '-';
                return e.exchangeRate && e.exchangeRate > 0 ? e.exchangeRate.toFixed(4) : '-';
              };
              return (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-1.5 text-left font-medium">科目</th>
                      {showDepartment && <th className="py-1.5 text-left font-medium">部门</th>}
                      {showPartner && <th className="py-1.5 text-left font-medium">往来</th>}
                      {showProject && <th className="py-1.5 text-left font-medium">项目</th>}
                      <th className="py-1.5 text-right font-medium">借方</th>
                      <th className="py-1.5 text-right font-medium">贷方</th>
                      {showFxColumns && <th className="py-1.5 text-right font-medium">币别</th>}
                      {showFxColumns && <th className="py-1.5 text-right font-medium">原币金额</th>}
                      {showFxColumns && <th className="py-1.5 text-right font-medium">汇率</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.entries.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1.5">
                          <span className="font-mono text-slate-600">{e.subjectCode}</span>
                          <span className="ml-1">{e.subjectName}</span>
                        </td>
                        {showDepartment && <td className="py-1.5 text-slate-600">{e.department || '-'}</td>}
                        {showPartner && <td className="py-1.5 text-slate-600">{e.partner || '-'}</td>}
                        {showProject && <td className="py-1.5 text-slate-600">{e.project || '-'}</td>}
                        <td className="py-1.5 text-right text-red-600">{e.debit ? formatMoney(e.debit) : '-'}</td>
                        <td className="py-1.5 text-right text-green-600">{e.credit ? formatMoney(e.credit) : '-'}</td>
                        {showFxColumns && (
                          <td className={`py-1.5 text-right ${fxCellStyle(e)}`}>
                            {isMonetarySubject(e.subjectCode) && e.currencyCode && e.currencyCode !== 'CNY'
                              ? e.currencyCode : '-'}
                          </td>
                        )}
                        {showFxColumns && (
                          <td className={`py-1.5 text-right ${fxCellStyle(e)}`}>{fmtOriginal(e)}</td>
                        )}
                        {showFxColumns && (
                          <td className={`py-1.5 text-right ${fxCellStyle(e)}`}>{fmtRate(e)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 font-medium">
                      <td className="py-1.5" colSpan={leadingColCount}>合计</td>
                      <td className="py-1.5 text-right">{formatMoney(detail.entries.reduce((s, e) => s + e.debit, 0))}</td>
                      <td className="py-1.5 text-right">{formatMoney(detail.entries.reduce((s, e) => s + e.credit, 0))}</td>
                      {showFxColumns && <td colSpan={3} />}
                    </tr>
                  </tfoot>
                </table>
              );
            })()}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-slate-400">加载中...</div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmployeeSelectCell({
  value,
  displayValue,
  employees,
  placeholder,
  onSelect,
  searchField,
}: {
  value: string;
  displayValue: string;
  employees: Array<{ code: string; name: string }>;
  placeholder: string;
  onSelect: (value: string) => void;
  searchField: 'code' | 'name';
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const cellRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return employees.slice(0, 20);
    return employees.filter(e =>
      e.code.toLowerCase().includes(q) || e.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [employees, search]);

  const updatePos = () => {
    if (cellRef.current) {
      const rect = cellRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 2, left: rect.left });
    }
  };

  return (
    <div ref={cellRef}>
      <input
        className="w-full bg-transparent px-1 py-0.5 text-xs outline-none focus:bg-blue-50 font-mono"
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => { updatePos(); setOpen(true); }}
        onChange={(e) => {
          const v = e.target.value;
          setSearch(v);
          onSelect(v);
          updatePos();
          if (!open) setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && createPortal(
        <div
          className="fixed z-[9999] w-48 rounded-md border border-slate-200 bg-white shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-3 text-xs text-slate-400 text-center">
                {employees.length === 0 ? '暂无雇员数据，请先在往来单位中添加雇员' : '无匹配'}
              </div>
            ) : filtered.map((emp) => (
              <button
                key={emp.code}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-xs hover:bg-blue-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(searchField === 'code' ? emp.code : emp.name);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className="font-mono text-slate-500">{emp.code}</span>
                <span>{emp.name}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default function PayrollPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taxSystemFileInputRef = useRef<HTMLInputElement>(null);
  const { departments, initializeDepartments } = useDepartmentStore();
  const initializePartners = usePartnerStore((state) => state.initializePartners);
  const partners = usePartnerStore((state) => state.partners);
  const updateAccountSet = useAccountSetStore((state) => state.updateAccountSet);
  const currentAccountSet = useAccountSetStore((state) =>
    state.accountSets.find((item) => item.id === state.currentAccountSetId) || null,
  );
  const defaultPeriod = currentAccountSet?.currentPeriod || new Date().toISOString().slice(0, 7);
  const [period, setPeriod] = useState(defaultPeriod);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<PayrollCalculationConfig>(createBlankPayrollCalculationConfig());
  const [accountSetSubjectDraft, setAccountSetSubjectDraft] = useState<PayrollVoucherDefaultSubjectDraft>(() => {
    const draft = createPayrollVoucherDefaultSubjectDraft(currentAccountSet);
    const subjects = useSubjectStore.getState().subjects;
    return autoFillPayrollSubjectDefaults(draft, subjects);
  });
  const [previewRows, setPreviewRows] = useState<PayrollInput[]>([]);
  const [previewErrors, setPreviewErrors] = useState<PayrollImportError[]>([]);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewImportSource, setPreviewImportSource] = useState<'payroll' | 'tax-system'>('payroll');
  const [showDraftRows, setShowDraftRows] = useState(true);
  const [draftRows, setDraftRows] = useState<PayrollInput[]>(createBlankPayrollRows);
  const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingInput, setEditingInput] = useState<PayrollInput>(createBlankPayrollInput());
  const [editingErrors, setEditingErrors] = useState<string[]>([]);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [taxSettingsOpen, setTaxSettingsOpen] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [voucherPreviewEntries, setVoucherPreviewEntries] = useState<PayrollVoucherEntryPreview[]>([]);
  const [voucherDetailNo, setVoucherDetailNo] = useState<string | null>(null);
  const [payrollSearchQuery, setPayrollSearchQuery] = useState('');
  const [payrollDepartmentFilter, setPayrollDepartmentFilter] = useState('');
  const [settingsRegionId, setSettingsRegionId] = useState<PayrollRegionId>(
    (currentAccountSet?.payrollRegionId as PayrollRegionId) || 'generic',
  );
  const {
    batches,
    selectedBatch,
    items,
    config,
    loading,
    error,
    loadPeriod,
    loadBatch,
    saveConfig,
    importDraft,
    recalculateBatch,
    confirmBatch,
    revertBatchToDraft,
    deleteDraftBatch,
    addManualItems,
    updateItem,
    deleteItem,
    copyPreviousPeriod,
    createAccrualVoucher,
  } = usePayrollStore();

  useEffect(() => {
    setPeriod(defaultPeriod);
  }, [defaultPeriod]);

  useEffect(() => {
    const periodParam = searchParams.get('period');
    if (periodParam && /^\d{4}-\d{2}$/.test(periodParam) && periodParam !== period) {
      setPeriod(periodParam);
    }
  }, [searchParams, period]);

  useEffect(() => {
    void loadPeriod(period);
  }, [loadPeriod, period]);

  useEffect(() => {
    if (!currentAccountSet) return;
    void Promise.all([initializeDepartments(), initializePartners()]);
  }, [currentAccountSet, initializeDepartments, initializePartners]);

  useEffect(() => {
    const regionId = getDefaultPayrollRegionId(currentAccountSet);
    setSettingsRegionId(regionId);
    const baseConfig = config?.config || applyPayrollRegionPreset(createBlankPayrollCalculationConfig(), regionId);
    const mergedTaxRules = clonePayrollTaxRuleSet(currentAccountSet?.payrollTaxRules || baseConfig.taxRules);
    setSettingsDraft({
      ...baseConfig,
      taxRules: mergedTaxRules,
      individualTax: {
        ...baseConfig.individualTax,
        brackets: mergedTaxRules.salary.map((rule) => ({
          upperLimit: rule.upperLimit,
          rate: rule.rate,
          quickDeduction: rule.quickDeduction,
        })),
      },
    });
    setAccountSetSubjectDraft(autoFillPayrollSubjectDefaults(
      createPayrollVoucherDefaultSubjectDraft(currentAccountSet),
      useSubjectStore.getState().subjects,
    ));
  }, [config, currentAccountSet]);

  useEffect(() => {
    setShowDraftRows(true);
    setDraftRows(createBlankPayrollRows());
    setDraftErrors([]);
    setEditingItemId(null);
  }, [period]);

  const calculatedItems = useMemo(() => items.map((item) => item.calculationResult), [items]);
  const departmentOptions = useMemo(() => departments.filter((item) => !item.frozen), [departments]);
  const employeeOptions = useMemo(
    () => partners.filter((item) => item.isEmployee && !item.frozen && item.code && item.name),
    [partners],
  );
  const visibleAmountFields = useMemo(
    () => showOptionalFields
      ? PAYROLL_AMOUNT_FIELDS
      : PAYROLL_AMOUNT_FIELDS.filter((field) => !OPTIONAL_AMOUNT_FIELD_KEYS.has(field.key)),
    [showOptionalFields],
  );
  const hasAccrualVoucher = Boolean(selectedBatch?.accrualVoucherId || selectedBatch?.accrualVoucherNo);
  const displayConfig = selectedBatch?.calculationConfigSnapshot || settingsDraft;
  const employeeContributionColumns = useMemo(() => [
    {
      id: 'pension',
      label: `养老(${formatContributionRatePercent(displayConfig.socialInsurance.pension.employeeRate)}%)`,
      value: (calculation: PayrollCalculationResult) => displayConfig.socialInsurance.pension.enabled
        ? roundMoney(calculation.socialInsuranceBase * displayConfig.socialInsurance.pension.employeeRate)
        : 0,
    },
    {
      id: 'medical',
      label: `医疗(${formatContributionRatePercent(displayConfig.socialInsurance.medical.employeeRate)}%)`,
      value: (calculation: PayrollCalculationResult) => displayConfig.socialInsurance.medical.enabled
        ? roundMoney(calculation.socialInsuranceBase * displayConfig.socialInsurance.medical.employeeRate)
        : 0,
    },
    {
      id: 'unemployment',
      label: `失业(${formatContributionRatePercent(displayConfig.socialInsurance.unemployment.employeeRate)}%)`,
      value: (calculation: PayrollCalculationResult) => displayConfig.socialInsurance.unemployment.enabled
        ? roundMoney(calculation.socialInsuranceBase * displayConfig.socialInsurance.unemployment.employeeRate)
        : 0,
    },
    {
      id: 'employeeHousingFund',
      label: `公积金(${formatContributionRatePercent(displayConfig.housingFund.employeeRate)}%)`,
      value: (calculation: PayrollCalculationResult) => calculation.employeeHousingFund,
    },
  ], [displayConfig]);
  const resultColumns = useMemo(() => [
    {
      id: 'grossSalary',
      label: '应发工资',
      value: (calculation: PayrollCalculationResult) => calculation.grossSalary,
    },
    ...employeeContributionColumns,
    {
      id: 'individualIncomeTax',
      label: '个税',
      value: (calculation: PayrollCalculationResult) => calculation.individualIncomeTax,
    },
    {
      id: 'netSalary',
      label: '实发工资',
      value: (calculation: PayrollCalculationResult) => calculation.netSalary,
    },
    {
      id: 'employerTotalCost',
      label: '企业成本',
      value: (calculation: PayrollCalculationResult) => calculation.employerTotalCost,
    },
  ], [employeeContributionColumns]);
  const payrollDepartmentFilterOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.departmentName || item.inputData.departmentName || '').filter(Boolean))).sort(),
    [items],
  );
  const filteredPayrollItems = useMemo(() => {
    const keyword = payrollSearchQuery.trim().toLowerCase();
    return items.filter((item) => {
      const matchesKeyword = !keyword
        || item.employeeCode.toLowerCase().includes(keyword)
        || item.employeeName.toLowerCase().includes(keyword)
        || (item.inputData.idNumber || '').toLowerCase().includes(keyword);
      const departmentName = item.departmentName || item.inputData.departmentName || '';
      const matchesDepartment = !payrollDepartmentFilter || departmentName === payrollDepartmentFilter;
      return matchesKeyword && matchesDepartment;
    });
  }, [items, payrollDepartmentFilter, payrollSearchQuery]);
  const editable = selectedBatch?.status !== 'confirmed';

  useEffect(() => {
    if (employeeOptions.length === 0) return;
    setDraftRows((rows) => rows.map((row) => row.employeeCode
      ? completeEmployeeFields(row, 'employeeCode', row.employeeCode, employeeOptions, departmentOptions)
      : row));
    setEditingInput((input) => editingItemId && input.employeeCode
      ? completeEmployeeFields(input, 'employeeCode', input.employeeCode, employeeOptions, departmentOptions)
      : input);
  }, [departmentOptions, editingItemId, employeeOptions]);

  async function parseImportFile(event: React.ChangeEvent<HTMLInputElement>, source: 'payroll' | 'tax-system') {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await parsePayrollFileWithTaxSupport(file);
      setPreviewRows(result.validRows);
      setPreviewErrors(result.errors);
      setPreviewFileName(file.name);
      setPreviewImportSource(source);
      showToast(
        result.errors.length ? 'warning' : 'success',
        `解析完成：有效 ${result.validRows.length} 行，错误 ${result.errors.length} 行`,
      );
    } catch {
      showToast('error', '工资表解析失败，请使用模板重新导入');
    } finally {
      event.target.value = '';
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    await parseImportFile(event, 'payroll');
  }

  async function handleTaxSystemFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    await parseImportFile(event, 'tax-system');
  }

  async function persistSettings(options?: { closeDialog?: boolean; showToast?: boolean }) {
    const { closeDialog = false, showToast: shouldShowToast = true } = options || {};
    try {
      const taxRules = clonePayrollTaxRuleSet(settingsDraft.taxRules);
      const nextConfig: PayrollCalculationConfig = {
        ...settingsDraft,
        taxRules,
        individualTax: {
          ...settingsDraft.individualTax,
          brackets: taxRules.salary.map((rule) => ({
            upperLimit: rule.upperLimit,
            rate: rule.rate,
            quickDeduction: rule.quickDeduction,
          })),
        },
      };
      await saveConfig(period, nextConfig);
      if (selectedBatch) {
        await recalculateBatch(selectedBatch.id);
      }
      if (currentAccountSet) {
        updateAccountSet(currentAccountSet.id, {
          payrollRegionId: settingsRegionId,
          payrollTaxRules: taxRules,
          ...accountSetSubjectDraft,
        } as Partial<AccountSet>);
      }
      if (closeDialog) setSettingsOpen(false);
      if (shouldShowToast) showToast('success', '计算设置已保存');
      return nextConfig;
    } catch (saveError) {
      showToast('error', saveError instanceof Error ? saveError.message : '保存设置失败');
      throw saveError;
    }
  }

  async function saveSettings() {
    await persistSettings({ closeDialog: true, showToast: true });
  }

  async function confirmImport() {
    const source = previewImportSource;
    try {
      const batch = await importDraft(period, previewFileName, previewRows);
      setPreviewRows([]);
      setPreviewErrors([]);
      setPreviewFileName('');
      setPreviewImportSource('payroll');

      if (source === 'tax-system') {
        try {
          const importedItems = usePayrollStore.getState().items;
          const entries = buildPayrollAccrualVoucherPreview(
            importedItems,
            batch.payrollPeriod,
            partners.filter((partner) => partner.isEmployee),
            accountSetSubjectDraft,
          );
          const voucher = await createAccrualVoucher(batch.id, entries);
          showToast('success', `个税系统工资表已导入并生成计提凭证：${voucher.voucherNo}`);
        } catch (voucherError) {
          showToast('error', voucherError instanceof Error
            ? `工资明细已生成，计提凭证生成失败：${voucherError.message}`
            : '工资明细已生成，计提凭证生成失败');
        }
        return;
      }

      showToast('success', '工资批次已导入并完成计算');
    } catch (importError) {
      showToast('error', importError instanceof Error ? importError.message : '工资导入失败');
    }
  }

  async function runAction(action: () => Promise<void>, message: string) {
    try {
      await action();
      showToast('success', message);
    } catch (actionError) {
      showToast('error', actionError instanceof Error ? actionError.message : '操作失败');
    }
  }

  function startAddRows() {
    setShowDraftRows(true);
    setDraftErrors([]);
  }

  function startEditRow(itemId: string) {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    setEditingItemId(itemId);
    setEditingInput(item.inputData);
    setEditingErrors([]);
  }

  function cancelEditingRow() {
    setEditingItemId(null);
    setEditingInput(createBlankPayrollInput());
    setEditingErrors([]);
  }

  function clearEditingRow() {
    setEditingInput(createBlankPayrollInput());
    setEditingErrors([]);
  }

  function updateEditingText(
    field: 'employeeCode' | 'employeeName' | 'idType' | 'idNumber' | 'departmentName' | 'incomeType' | 'annualBonusTaxMethod',
    value: string,
  ) {
    setEditingInput((input) => {
      if (field === 'idType') return { ...input, idType: value || undefined };
      if (field === 'idNumber') return { ...input, idNumber: value || undefined };
      if (field === 'departmentName') return { ...input, departmentName: value };
      if (field === 'incomeType') return { ...input, incomeType: (value || undefined) as PayrollIncomeType | undefined };
      if (field === 'annualBonusTaxMethod') return { ...input, annualBonusTaxMethod: (value || undefined) as PayrollAnnualBonusTaxMethod | undefined };
      return completeEmployeeFields(input, field, value, employeeOptions, departmentOptions);
    });
  }

  function updateEditingAmount(field: keyof PayrollInput, value: string) {
    setEditingInput((input) => ({
      ...input,
      [field]: value === '' && (field === 'socialInsuranceBase' || field === 'housingFundBase')
        ? undefined
        : Number(value || 0),
    }));
  }

  async function saveEditingRow() {
    setEditingErrors([]);
    try {
      if (!editingItemId) return;
      await updateItem(editingItemId, editingInput);
      showToast('success', '工资明细已更新并重新计算');
      cancelEditingRow();
    } catch (saveError) {
      setEditingErrors([saveError instanceof Error ? saveError.message : '保存工资明细失败']);
    }
  }

  function updateDraftText(
    index: number,
    field: 'employeeCode' | 'employeeName' | 'idType' | 'idNumber' | 'departmentName' | 'incomeType' | 'annualBonusTaxMethod',
    value: string,
  ) {
    setDraftRows((rows) => rows.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (field === 'idType') return { ...row, idType: value || undefined };
      if (field === 'idNumber') return { ...row, idNumber: value || undefined };
      if (field === 'departmentName') return { ...row, departmentName: value };
      if (field === 'incomeType') return { ...row, incomeType: (value || undefined) as PayrollIncomeType | undefined };
      if (field === 'annualBonusTaxMethod') return { ...row, annualBonusTaxMethod: (value || undefined) as PayrollAnnualBonusTaxMethod | undefined };
      return completeEmployeeFields(row, field, value, employeeOptions, departmentOptions);
    }));
  }

  function updateDraftAmount(index: number, field: keyof PayrollInput, value: string) {
    setDraftRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? {
      ...row,
      [field]: value === '' && (field === 'socialInsuranceBase' || field === 'housingFundBase')
        ? undefined
        : Number(value || 0),
    } : row));
  }

  function clearDraftRow(index: number) {
    setDraftRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? createBlankPayrollInput() : row));
    setDraftErrors([]);
  }

  function addDraftRow() {
    setShowDraftRows(true);
    setDraftRows((rows) => [...rows, createBlankPayrollInput()]);
  }

  function handleDraftGridKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addDraftRow();
  }

  async function saveDraftRows() {
    const populatedRows = draftRows.filter(hasDraftInput);
    if (populatedRows.length === 0) {
      setDraftErrors(['请至少填写一行工资明细']);
      return;
    }

    const employeeCodes = items.map((item) => item.employeeCode);
    const validationErrors: string[] = [];
    populatedRows.forEach((row, index) => {
      const rowErrors = validatePayrollInput(row, employeeCodes);
      if (rowErrors.length > 0) validationErrors.push(`第 ${index + 1} 行：${rowErrors.join('，')}`);
      employeeCodes.push(row.employeeCode);
    });
    if (validationErrors.length > 0) {
      setDraftErrors(validationErrors);
      return;
    }
    if (!config) {
      await persistSettings({ closeDialog: false, showToast: false });
    }

    try {
      await addManualItems(period, populatedRows);
      setDraftRows(createBlankPayrollRows());
      setShowDraftRows(false);
      setDraftErrors([]);
      showToast('success', `已新增 ${populatedRows.length} 行工资明细并完成计算`);
    } catch (saveError) {
      setDraftErrors([saveError instanceof Error ? saveError.message : '保存工资明细失败']);
    }
  }

  function renderEditableCells(
    input: PayrollInput,
    rowLabel: string,
    onTextChange: (field: 'employeeCode' | 'employeeName' | 'idType' | 'idNumber' | 'departmentName' | 'incomeType' | 'annualBonusTaxMethod', value: string) => void,
    onAmountChange: (field: keyof PayrollInput, value: string) => void,
    onKeyDown?: React.KeyboardEventHandler<HTMLElement>,
  ) {
    const quietSelectClass = (value?: string) => value
      ? EXCEL_SELECT_CLASS
      : `${EXCEL_SELECT_CLASS} appearance-none text-transparent hover:text-slate-400 focus:text-slate-700 focus:appearance-auto`;

    return (
      <>
        <td className={STICKY_EMPLOYEE_CODE_CELL_CLASS}>
          <EmployeeSelectCell
            value={input.employeeCode}
            displayValue={input.employeeCode}
            employees={employeeOptions}
            placeholder="工号"
            onSelect={(code) => {
              const emp = employeeOptions.find(e => e.code === code);
              if (emp) {
                onTextChange('employeeCode', emp.code);
              } else {
                onTextChange('employeeCode', code);
              }
            }}
            searchField="code"
          />
        </td>
        <td className={STICKY_EMPLOYEE_NAME_CELL_CLASS}>
          <EmployeeSelectCell
            value={input.employeeName}
            displayValue={input.employeeName}
            employees={employeeOptions}
            placeholder="姓名"
            onSelect={(name) => {
              const emp = employeeOptions.find(e => e.name === name);
              if (emp) {
                onTextChange('employeeCode', emp.code);
              } else {
                onTextChange('employeeName', name);
              }
            }}
            searchField="name"
          />
        </td>
        <td className={EXCEL_CELL_CLASS}>
          <select
            aria-label={`${rowLabel}证件类型`}
            className={quietSelectClass(input.idType)}
            value={input.idType || ''}
            onChange={(event) => onTextChange('idType', event.target.value)}
            onKeyDown={onKeyDown}
          >
            <option value="">--</option>
            <option value="居民身份证">居民身份证</option>
            <option value="护照">护照</option>
            <option value="港澳居民来往内地通行证">港澳居民来往内地通行证</option>
            <option value="台湾居民来往大陆通行证">台湾居民来往大陆通行证</option>
            <option value="外国人永久居留身份证">外国人永久居留身份证</option>
          </select>
        </td>
        <td className={EXCEL_CELL_CLASS}>
          <Input variant="excel" aria-label={`${rowLabel}证件号码`} className={`${EXCEL_TEXT_INPUT_CLASS} font-mono`} value={input.idNumber || ''} onChange={(event) => onTextChange('idNumber', event.target.value)} onKeyDown={onKeyDown} />
        </td>
        <td className={EXCEL_CELL_CLASS}>
          <Input variant="excel" list="department-options" aria-label={`${rowLabel}部门`} className={EXCEL_TEXT_INPUT_CLASS} value={input.departmentName || ''} onChange={(event) => onTextChange('departmentName', event.target.value)} onKeyDown={onKeyDown} />
        </td>
        <td className={EXCEL_CELL_CLASS}>
          <select
            aria-label={`${rowLabel}收入类型`}
            className={quietSelectClass(input.incomeType)}
            value={input.incomeType || ''}
            onChange={(event) => onTextChange('incomeType', event.target.value)}
            onKeyDown={onKeyDown}
          >
            <option value="">--</option>
            <option value="salary">工资薪金</option>
            <option value="annual_bonus">全年一次性奖金</option>
          </select>
        </td>
        <td className={EXCEL_CELL_CLASS}>
          <select
            aria-label={`${rowLabel}年终奖计税方式`}
            className={quietSelectClass(input.annualBonusTaxMethod)}
            value={input.annualBonusTaxMethod || ''}
            onChange={(event) => onTextChange('annualBonusTaxMethod', event.target.value)}
            onKeyDown={onKeyDown}
          >
            <option value="">--</option>
            <option value="separate">单独计税</option>
            <option value="consolidated">并入综合所得</option>
          </select>
        </td>
        {visibleAmountFields.map((field) => (
          <td key={String(field.key)} className={EXCEL_CELL_CLASS}>
            <Input
              variant="excel"
              aria-label={`${rowLabel}${field.label}`}
              className={EXCEL_NUMBER_INPUT_CLASS}
              type="number"
              min={0}
              value={input[field.key] ?? ''}
              onChange={(event) => onAmountChange(field.key, event.target.value)}
              onKeyDown={onKeyDown}
            />
          </td>
        ))}
      </>
    );
  }

  function renderCalculatedCells(calculation?: PayrollCalculationResult) {
    return resultColumns.map((field) => (
      <td key={field.id} className={EXCEL_READONLY_CELL_CLASS}>
        {calculation ? formatMoney(field.value(calculation)) : '--'}
      </td>
    ));
  }

  function renderSavedRow(item: PayrollItem) {
    const isEditing = editingItemId === item.id;
    return (
      <tr key={item.id} className={isEditing ? 'bg-blue-50/40' : 'bg-white'}>
        <td className="sticky left-0 z-[3] border border-slate-300 bg-inherit px-1 py-0.5 text-center text-slate-400">-</td>
        {isEditing ? renderEditableCells(editingInput, '编辑行', updateEditingText, updateEditingAmount) : (
          <>
            <td className={STICKY_EMPLOYEE_CODE_CELL_CLASS}>{item.employeeCode}</td>
            <td className={STICKY_EMPLOYEE_NAME_CELL_CLASS}>{item.employeeName}</td>
            <td className="border border-slate-300 bg-white px-1 py-0.5 text-slate-500">{item.inputData.idType || '居民身份证'}</td>
            <td className="border border-slate-300 bg-white px-1 py-0.5 text-slate-500">{item.inputData.idNumber || ''}</td>
            <td className="border border-slate-300 bg-white px-1 py-0.5 text-slate-500">{item.departmentName || ''}</td>
            <td className="border border-slate-300 bg-white px-1 py-0.5 text-slate-500">{getIncomeTypeLabel(item.inputData)}</td>
            <td className="border border-slate-300 bg-white px-1 py-0.5 text-slate-500">{getAnnualBonusTaxMethodLabel(item.inputData)}</td>
            {visibleAmountFields.map((field) => (
              <td key={String(field.key)} className="border border-slate-300 bg-white px-1 py-0.5 text-right tabular-nums">
                {formatMoney(Number(item.inputData[field.key] || 0))}
              </td>
            ))}
          </>
        )}
        {renderCalculatedCells(item.calculationResult)}
        <td className="border border-slate-300 bg-white px-1 py-0.5">
          {hasAccrualVoucher ? (
            <div className="flex flex-col gap-0.5">
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">已入账</Badge>
              {selectedBatch?.accrualVoucherNo && (
                <button
                  type="button"
                  className="text-left font-mono text-[10px] text-blue-600 underline-offset-2 hover:underline"
                  title="点击查看凭证明细"
                  onClick={() => setVoucherDetailNo(selectedBatch.accrualVoucherNo!)}
                >
                  {selectedBatch.accrualVoucherNo}
                </button>
              )}
            </div>
          ) : (
            statusBadge(selectedBatch?.status)
          )}
        </td>
        <td className="border border-slate-300 bg-white px-1 py-0.5">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="保存" onClick={() => void saveEditingRow()}><Save /></Button>
              <Button variant="ghost" size="icon" title="清空本行" onClick={clearEditingRow}><Eraser /></Button>
              <Button variant="ghost" size="icon" title="取消" onClick={cancelEditingRow}><X /></Button>
            </div>
          ) : editable && editingItemId === null ? (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" title="缂栬緫" onClick={() => startEditRow(item.id)}><Pencil /></Button>
              <Button
                variant="ghost"
                size="icon"
                title="删除"
                onClick={() => {
                  if (window.confirm('确认删除该工资明细？')) {
                    void runAction(() => deleteItem(item.id), '工资明细已删除并重新计算');
                  }
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ) : null}
        </td>
      </tr>
    );
  }

  function updateSocialRate(key: InsuranceKey, field: 'employeeRate' | 'employerRate', value: string) {
    setSettingsDraft((draft) => ({
      ...draft,
      socialInsurance: {
        ...draft.socialInsurance,
        [key]: {
          ...draft.socialInsurance[key],
          [field]: (Number(value) || 0) / 100,
        },
      },
    }));
  }

  function updateSocialBase(field: 'minimumBase' | 'maximumBase', value: string) {
    setSettingsDraft((draft) => ({
      ...draft,
      socialInsurance: { ...draft.socialInsurance, [field]: Number(value) || 0 },
    }));
  }

  function updateHousing(field: 'employeeRate' | 'employerRate' | 'minimumBase' | 'maximumBase', value: string) {
    setSettingsDraft((draft) => ({
      ...draft,
      housingFund: {
        ...draft.housingFund,
        [field]: field.includes('Rate') ? (Number(value) || 0) / 100 : Number(value) || 0,
      },
    }));
  }

  function updateStandardDeduction(value: string) {
    setSettingsDraft((draft) => ({
      ...draft,
      individualTax: {
        ...draft.individualTax,
        standardDeductionPerMonth: Number(value) || 0,
      },
    }));
  }

  function updateTaxRule(
    ruleType: PayrollTaxRuleType,
    index: number,
    field: 'effectiveDate' | 'lowerLimit' | 'upperLimit' | 'rate' | 'quickDeduction',
    value: string,
  ) {
    setSettingsDraft((draft) => {
      const nextRules = clonePayrollTaxRuleSet(draft.taxRules);
      const currentRule = nextRules[ruleType][index];
      if (!currentRule) return draft;
      nextRules[ruleType][index] = {
        ...currentRule,
        [field]: field === 'effectiveDate'
          ? parseChineseDateInput(value)
          : field === 'upperLimit'
            ? (value === '' ? null : Number(value))
            : field === 'rate'
              ? (Number(value) || 0) / 100
              : Number(value) || 0,
      };
      return {
        ...draft,
        taxRules: nextRules,
        individualTax: {
          ...draft.individualTax,
          brackets: nextRules.salary.map((rule) => ({
            upperLimit: rule.upperLimit,
            rate: rule.rate,
            quickDeduction: rule.quickDeduction,
          })),
        },
      };
    });
  }

  function restoreTaxRules(ruleType: PayrollTaxRuleType) {
    setSettingsDraft((draft) => {
      const defaultRules = clonePayrollTaxRuleSet();
      const nextRules = clonePayrollTaxRuleSet(draft.taxRules);
      nextRules[ruleType] = defaultRules[ruleType];
      return {
        ...draft,
        taxRules: nextRules,
        individualTax: {
          ...draft.individualTax,
          brackets: nextRules.salary.map((rule) => ({
            upperLimit: rule.upperLimit,
            rate: rule.rate,
            quickDeduction: rule.quickDeduction,
          })),
        },
      };
    });
  }

  function updateAccountSetSubjectDraft(
    field: keyof PayrollVoucherDefaultSubjectDraft,
    value: string,
  ) {
    setAccountSetSubjectDraft((draft) => ({ ...draft, [field]: value }));
  }

  function applyRegionPreset(regionId: PayrollRegionId) {
    setSettingsRegionId(regionId);
    setSettingsDraft((draft) => applyPayrollRegionPreset(draft, regionId));
  }

  async function copyPreviousPayroll(mode: 'replace' | 'append') {
    setCopyDialogOpen(false);
    await runAction(() => copyPreviousPeriod(period, mode), mode === 'replace' ? '已复制上月工资并覆盖本月草稿' : '已追加上月工资');
  }

  function openCopyPreviousPayroll() {
    if (items.length > 0) {
      setCopyDialogOpen(true);
      return;
    }
    void copyPreviousPayroll('replace');
  }

  function openVoucherPreview() {
    if (!selectedBatch) return;
    if (selectedBatch.accrualVoucherId || selectedBatch.accrualVoucherNo) {
      showToast('warning', '该批次已生成工资计提凭证，如需查看请到凭证列表。');
      return;
    }
    setVoucherPreviewEntries(buildPayrollAccrualVoucherPreview(
      items,
      selectedBatch.payrollPeriod,
      partners.filter((partner) => partner.isEmployee),
      accountSetSubjectDraft,
    ));
    setVoucherDialogOpen(true);
  }

  function renderActionMenuItem(
    children: React.ReactNode,
    onClick: () => void,
    disabled = false,
  ) {
    return (
      <PopoverItem disabled={disabled} onClick={onClick} className="flex items-center gap-2 text-slate-700">
        {children}
      </PopoverItem>
    );
  }

  function renderStatusBadge() {
    if (!selectedBatch) return <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">暂无批次</Badge>;
    if (selectedBatch.status === 'confirmed') {
      return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">已确认</Badge>;
    }
    if (selectedBatch.status === 'calculated') {
      return <Badge className="border border-emerald-200 bg-emerald-50 text-emerald-700">已计算</Badge>;
    }
    return <Badge className="border border-amber-200 bg-amber-50 text-amber-700">草稿</Badge>;
  }

  async function savePayrollVoucher() {
    if (!selectedBatch) return;
    try {
      const voucher = await createAccrualVoucher(selectedBatch.id, voucherPreviewEntries);
      setVoucherDialogOpen(false);
      showToast('success', `工资计提凭证已生成：${voucher.voucherNo}`);
    } catch (voucherError) {
      const message = voucherError instanceof Error ? voucherError.message : '生成工资计提凭证失败';
      if (typeof window !== 'undefined' && /关账|锁定|关闭/.test(message)) {
        window.alert(message);
        return;
      }
      showToast('error', message);
    }
  }

  if (!currentAccountSet) {
    return <div className="p-8 text-sm text-slate-500">请先选择账套后使用工资管理。</div>;
  }

  return (
    <div className="min-h-full bg-slate-50/70">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">工资管理</h1>
              <p className="mt-1 text-xs text-slate-500">{currentAccountSet.name} / 工资计算与月结依据</p>
            </div>
            <ChineseMonthPicker value={period} onChange={setPeriod} className="w-36" />
            {renderStatusBadge()}
            {hasAccrualVoucher && (
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">
                已入账：{selectedBatch?.accrualVoucherNo}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 />计算设置
            </Button>
            <Popover
              align="end"
              content={(
                <PopoverContent className="w-56">
                  {renderActionMenuItem(<><Upload className="h-4 w-4" />导入工资表</>, () => fileInputRef.current?.click())}
                  {renderActionMenuItem(<><Download className="h-4 w-4" />下载工资导入模板</>, generatePayrollImportTemplate)}
                  {renderActionMenuItem(<><Upload className="h-4 w-4" />导入个税系统工资表</>, () => taxSystemFileInputRef.current?.click())}
                </PopoverContent>
              )}
            >
              <Button variant="outline" size="sm">
                导入/下载模板 <ChevronDown className="h-4 w-4" />
              </Button>
            </Popover>
            <Popover
              align="end"
              content={(
                <PopoverContent className="w-52">
                  {renderActionMenuItem(<><FileDown className="h-4 w-4" />导出结果</>, () => exportPayrollResults(calculatedItems, period), calculatedItems.length === 0)}
                  {renderActionMenuItem(<><FileDown className="h-4 w-4" />导出到个税系统</>, () => exportToTaxSystem(items.map(it => ({
                    ...it.inputData,
                    grossSalary: it.calculationResult.grossSalary,
                    individualIncomeTax: it.calculationResult.individualIncomeTax,
                    pensionInsurance: displayConfig.socialInsurance.pension.enabled
                      ? Math.round(it.calculationResult.socialInsuranceBase * displayConfig.socialInsurance.pension.employeeRate * 100) / 100
                      : 0,
                    medicalInsurance: displayConfig.socialInsurance.medical.enabled
                      ? Math.round(it.calculationResult.socialInsuranceBase * displayConfig.socialInsurance.medical.employeeRate * 100) / 100
                      : 0,
                    unemploymentInsurance: displayConfig.socialInsurance.unemployment.enabled
                      ? Math.round(it.calculationResult.socialInsuranceBase * displayConfig.socialInsurance.unemployment.employeeRate * 100) / 100
                      : 0,
                    housingFund: it.calculationResult.employeeHousingFund,
                  })), period), items.length === 0)}
                </PopoverContent>
              )}
            >
              <Button variant="outline" size="sm">
                导出报表 <ChevronDown className="h-4 w-4" />
              </Button>
            </Popover>
            <Popover
              align="end"
              content={(
                <PopoverContent className="w-52">
                  {renderActionMenuItem(<><Copy className="h-4 w-4" />复制上月</>, openCopyPreviousPayroll)}
                  {renderActionMenuItem(<><BarChart3 className="h-4 w-4" />工资报表</>, () => router.push('/payroll/report'))}
                  {renderActionMenuItem(<><ReceiptText className="h-4 w-4" />生成计提凭证</>, openVoucherPreview, !selectedBatch || items.length === 0 || hasAccrualVoucher)}
                  {selectedBatch && selectedBatch.status !== 'confirmed'
                    ? renderActionMenuItem(<><Trash2 className="h-4 w-4" />删除草稿</>, () => runAction(() => deleteDraftBatch(selectedBatch.id), '草稿批次已删除'))
                    : null}
                </PopoverContent>
              )}
            >
              <Button variant="outline" size="sm" aria-label="更多操作">
                更多操作 <MoreHorizontal className="h-4 w-4" />
              </Button>
            </Popover>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={taxSystemFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleTaxSystemFileChange}
            />
          </div>
          <p className="w-full text-xs text-slate-500">
            工资导入模板与“导入工资表”完全一致，用于系统内计算，填写收入拆分、社保/公积金基数和前期累计数；
            个税系统模板用于导入个税系统工资表，填写本期收入及个人当月基本养老、医疗、失业、公积金金额，导入后会生成工资明细并尝试生成计提凭证。两种模板差异在于：工资导入模板按基数和配置比例计算五险一金，个税系统模板直接填写申报口径金额。
          </p>
        </div>
      </header>

      <main className="space-y-5 p-6">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {hasAccrualVoucher && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div>
              <p className="font-medium">本批次已入账</p>
              <p className="text-xs text-emerald-700">工资计提凭证号：{selectedBatch?.accrualVoucherNo || '未回写'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                onClick={() => router.push('/voucher-list?status=posted_reversed')}
              >
                去凭证列表
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                onClick={() => router.push('/payroll/report')}
              >
                查看工资报表
              </Button>
            </div>
          </section>
        )}

        <section className="grid gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: '员工人数', value: selectedBatch?.employeeCount || 0, className: 'bg-white', valueClassName: 'text-lg text-slate-900' },
            { label: '应发合计', value: formatMoney(selectedBatch?.grossTotal || 0), className: 'bg-white', valueClassName: 'text-lg text-slate-900' },
            { label: '企业成本', value: formatMoney(selectedBatch?.employerCostTotal || 0), className: 'bg-slate-50', valueClassName: 'text-xl text-slate-950' },
            { label: '个税合计', value: formatMoney(selectedBatch?.taxTotal || 0), className: 'bg-white', valueClassName: 'text-lg text-slate-900' },
            { label: '实发合计', value: formatMoney(selectedBatch?.netTotal || 0), className: 'bg-blue-50', valueClassName: 'text-2xl text-blue-700' },
          ].map((item) => (
            <div key={item.label} className={`${item.className} px-4 py-3`}>
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className={`mt-1 font-semibold tabular-nums ${item.valueClassName}`}>{item.value}</p>
            </div>
          ))}
        </section>

        {previewRows.length > 0 || previewErrors.length > 0 ? (
          <section className="rounded-md border border-blue-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
              <h2 className="text-sm font-medium text-slate-900">导入预览</h2>
                <p className="text-xs text-slate-500">{previewFileName} / 有效 {previewRows.length} 行 / 错误 {previewErrors.length} 行</p>
              </div>
                <Button size="sm" disabled={previewRows.length === 0 || previewErrors.length > 0} onClick={confirmImport}>
                <Calculator />计算并保存批次
                  {previewImportSource === 'tax-system' ? '并生成凭证' : ''}
                </Button>
            </div>
            {previewErrors.length > 0 && (
              <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                {previewErrors.map((item) => <p key={item.rowNumber}>第 {item.rowNumber} 行：{item.message}</p>)}
              </div>
            )}
            <div className="max-h-48 overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {['工号', '姓名', '证件号码', '本期收入', '养老保险', '住房公积金', '专项附加扣除'].map((title) => (
                      <th key={title} className="px-4 py-2 text-left font-medium">{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.employeeCode || row.employeeName} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-mono text-xs">{row.employeeCode || '-'}</td>
                      <td className="px-4 py-2">{row.employeeName}</td>
                      <td className="px-4 py-2 font-mono text-xs">{row.idNumber || '-'}</td>
                      <td className="px-4 py-2 tabular-nums">{formatMoney(row.basicSalary)}</td>
                      <td className="px-4 py-2 tabular-nums">{formatMoney(row.pensionInsurance || 0)}</td>
                      <td className="px-4 py-2 tabular-nums">{formatMoney(row.housingFund || 0)}</td>
                      <td className="px-4 py-2 tabular-nums">{formatMoney(row.childEducation + (row.continuingEducation || 0) + (row.housingLoanInterest || 0) + (row.housingRent || 0) + (row.elderlyCare || 0) + (row.infantCare || 0) + (row.privatePension || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="text-sm font-medium text-slate-900">工资计算明细</h2>
              <p className="text-xs text-slate-500">计算完成不等同于工资已发放或社保、个税已缴纳。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 w-52"
                placeholder="搜索员工..."
                value={payrollSearchQuery}
                onChange={(event) => setPayrollSearchQuery(event.target.value)}
                autoComplete="off"
              />
              <select
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600"
                value={payrollDepartmentFilter}
                onChange={(event) => setPayrollDepartmentFilter(event.target.value)}
              >
                <option value="">全部部门</option>
                {payrollDepartmentFilterOptions.map((departmentName) => (
                  <option key={departmentName} value={departmentName}>{departmentName}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => setShowOptionalFields((value) => !value)}>
                {showOptionalFields ? '隐藏扩展字段' : '显示扩展字段'}
              </Button>
              {selectedBatch?.status === 'confirmed' && (
                <span className="text-xs text-slate-500">退回草稿后可修改明细</span>
              )}
            </div>
          </div>
          {batches.length > 1 && (
            <div className="flex gap-1.5 border-b border-slate-100 px-4 py-2">
              {batches.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  className={`rounded px-2.5 py-1 text-xs ${selectedBatch?.id === batch.id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
                  onClick={() => void loadBatch(batch.id)}
                >
                  {batch.batchName}
                </button>
              ))}
            </div>
          )}
          <datalist id="employee-code-options">
            {employeeOptions.map((employee) => <option key={employee.id} value={employee.code}>{employee.name}</option>)}
          </datalist>
          <datalist id="employee-name-options">
            {employeeOptions.map((employee) => <option key={employee.id} value={employee.name}>{employee.code}</option>)}
          </datalist>
          <datalist id="department-options">
            {departmentOptions.map((department) => <option key={department.id} value={department.name}>{department.code}</option>)}
          </datalist>
          <div className="overflow-x-auto border-t border-slate-300 bg-white">
            <table className="min-w-[3200px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 w-12 border border-slate-300 bg-slate-100 px-2 py-1 text-center font-medium text-slate-700">序号</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} sticky left-12 z-20 w-24 bg-slate-100`}>工号</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} sticky left-36 z-20 w-24 bg-slate-100`}>姓名</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} w-28`}>证件类型</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} w-36`}>证件号码</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} w-24`}>部门</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} w-28`}>收入类型</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} w-28`}>年终奖计税方式</th>
                  {visibleAmountFields.map((field) => (
                    <th key={String(field.key)} className={`${EXCEL_HEADER_CELL_CLASS} w-36 whitespace-nowrap text-right`}>{field.label}</th>
                  ))}
                  {resultColumns.map((field) => (
                    <th key={field.id} className="w-32 whitespace-nowrap border border-slate-300 bg-slate-200 px-2 py-1 text-right font-medium text-slate-700">{field.label}</th>
                  ))}
                  <th className={`${EXCEL_HEADER_CELL_CLASS} w-20`}>状态</th>
                  <th className={`${EXCEL_HEADER_CELL_CLASS} w-20`}>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={visibleAmountFields.length + resultColumns.length + 10} className="border border-slate-300 px-4 py-14 text-center text-sm text-slate-400">加载中...</td></tr>
                ) : (
                  <>
                    {filteredPayrollItems.map(renderSavedRow)}
                    {editable && showDraftRows && draftRows.map((row, index) => (
                      <tr key={`draft-${index}`} className="bg-slate-50/70">
                        <td className="sticky left-0 z-[3] border border-slate-300 bg-inherit px-1 py-0.5 text-center text-slate-400">{index + 1}</td>
                        {renderEditableCells(
                          row,
                          `第 ${index + 1} 行`,
                          (field, value) => updateDraftText(index, field, value),
                          (field, value) => updateDraftAmount(index, field, value),
                          handleDraftGridKeyDown,
                        )}
                        {renderCalculatedCells()}
                        <td className="border border-slate-300 bg-slate-50/70 px-1 py-0.5 text-slate-400">待保存</td>
                        <td className="border border-slate-300 bg-slate-50/70 px-1 py-0.5">
                          {hasDraftInput(row) && (
                            <Button variant="ghost" size="icon" title="清空本行" aria-label={`清空第 ${index + 1} 行`} onClick={() => clearDraftRow(index)}>
                              <Eraser />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredPayrollItems.length === 0 && items.length > 0 && (
                      <tr><td colSpan={visibleAmountFields.length + resultColumns.length + 10} className="border border-slate-300 px-4 py-8 text-center text-sm text-slate-400">没有匹配的工资明细。</td></tr>
                    )}
                    {items.length === 0 && (!editable || !showDraftRows) && (
                      <tr><td colSpan={visibleAmountFields.length + resultColumns.length + 10} className="border border-slate-300 px-4 py-8 text-center text-sm text-slate-400">暂无工资明细。</td></tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          {editingErrors.length > 0 && (
            <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
              {editingErrors.map((message) => <p key={message}>{message}</p>)}
            </div>
          )}
          {!loading && (
            <div className="sticky bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_20px_rgba(15,23,42,0.06)] backdrop-blur">
              {draftErrors.length > 0 && (
                <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {draftErrors.map((message) => <p key={message}>{message}</p>)}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {editable ? (
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!showDraftRows) startAddRows();
                    else addDraftRow();
                  }}>
                    <Plus />新增一行
                  </Button>
                ) : (
                  <span className="text-xs text-slate-500">已确认批次需要退回草稿后修改</span>
                )}
                <div className="flex items-center gap-2">
                  {editable && <span className="hidden text-xs text-slate-400 md:inline">在录入单元格按 Enter 可快速新增一行</span>}
                  {editable && items.length > 0 && showDraftRows && (
                    <Button variant="outline" size="sm" onClick={() => {
                      setDraftRows(createBlankPayrollRows());
                      setDraftErrors([]);
                      setShowDraftRows(false);
                    }}>
                      <X />取消
                    </Button>
                  )}
                  {editable && showDraftRows && (
                  <Button size="sm" onClick={() => void saveDraftRows()}>
                    <Save />保存并计算
                  </Button>
                  )}
                  {selectedBatch?.status === 'confirmed' ? (
                    <Button variant="outline" size="sm" onClick={() => runAction(() => revertBatchToDraft(selectedBatch.id), '批次已退回草稿')}>
                      <RotateCcw />退回草稿
                    </Button>
                  ) : selectedBatch ? (
                    <Button size="sm" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => runAction(() => confirmBatch(selectedBatch.id), '本月工资批次已确认')}>
                      <CheckCircle2 />确认提交本月工资
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>复制上月工资</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-600">
            <p>本月已有工资明细，请选择复制方式。</p>
            <p className="text-xs text-slate-500">覆盖会替换本月草稿明细；追加会跳过已存在工号，只补充本月没有的员工。</p>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>取消</Button>
            <Button variant="outline" onClick={() => void copyPreviousPayroll('append')}>追加</Button>
            <Button onClick={() => void copyPreviousPayroll('replace')}>覆盖</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voucherDialogOpen} onOpenChange={setVoucherDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>工资计提凭证预览</DialogTitle>
          </DialogHeader>
          <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">摘要</th>
                  <th className="px-3 py-2 text-left font-medium">科目</th>
                  <th className="px-3 py-2 text-left font-medium">部门</th>
                  <th className="px-3 py-2 text-right font-medium">借方</th>
                  <th className="px-3 py-2 text-right font-medium">贷方</th>
                </tr>
              </thead>
              <tbody>
                {voucherPreviewEntries.map((entry, index) => (
                  <tr key={`${entry.subjectCode}-${index}`} className="border-t border-slate-100">
                    <td className="px-3 py-2">{entry.summary}</td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.subjectCode} {entry.subjectName}</td>
                    <td className="px-3 py-2 text-slate-500">{entry.departmentName || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.debit ? formatMoney(entry.debit) : '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{entry.credit ? formatMoney(entry.credit) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setVoucherDialogOpen(false)}>取消</Button>
            <Button disabled={voucherPreviewEntries.length === 0} onClick={() => void savePayrollVoucher()}>
              <Save />确认生成凭证
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>计算设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              社保和公积金比例按本账套适用地区及政策填写。个税依据：{settingsDraft.individualTax.policyLabel}，生效日期：{formatChineseDate(settingsDraft.individualTax.policyEffectiveDate)}。
            </div>
            <div className="rounded-md border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">个税默认设置</h3>
                    <p className="mt-1 text-xs text-slate-500">默认采用累计预扣预缴法，保存后用于本月工资重新计算。</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setTaxSettingsOpen(true)} title="税率设置">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 px-4 py-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">计算方式</p>
                  <p className="mt-1 font-medium text-slate-900">累计预扣预缴</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">每月基本减除费用</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={settingsDraft.individualTax.standardDeductionPerMonth}
                    onChange={(event) => updateStandardDeduction(event.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-500">税率档数</p>
                  <p className="mt-1 font-medium tabular-nums text-slate-900">{settingsDraft.individualTax.brackets.length} 档</p>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="mb-2 text-xs font-medium text-slate-600">特殊收入规则提示</p>
                <div className="grid gap-2 md:grid-cols-3">
                  {PAYROLL_TAX_SCENARIO_NOTES.map((note) => (
                    <div key={note.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-medium text-slate-900">{note.name}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{note.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56">
                  <Label>社保公积金地区默认</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                    value={settingsRegionId}
                    onChange={(event) => applyRegionPreset(event.target.value as PayrollRegionId)}
                  >
                    {PAYROLL_REGION_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>{preset.name}</option>
                    ))}
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={() => applyRegionPreset(settingsRegionId)}>
                  应用地区默认
                </Button>
                <p className="pb-2 text-xs text-slate-500">选择地区后会自动填充默认比例和基数，所有字段仍可手动调整。</p>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {PAYROLL_REGION_PRESETS.find((preset) => preset.id === settingsRegionId)?.description}
                {currentAccountSet?.address && (
                  <span className="ml-2 text-blue-500">（根据公司地址"{currentAccountSet.address}"自动匹配）</span>
                )}
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-medium text-slate-900">社保配置</h3>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <div className="grid grid-cols-[160px_80px_1fr_1fr] bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <span>险种</span><span>启用</span><span>个人比例 (%)</span><span>企业比例 (%)</span>
                </div>
                {INSURANCE_ROWS.map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-[160px_80px_1fr_1fr] items-center gap-3 border-t border-slate-100 px-3 py-2">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={settingsDraft.socialInsurance[key].enabled}
                      onCheckedChange={(enabled) => setSettingsDraft((draft) => ({
                        ...draft,
                        socialInsurance: { ...draft.socialInsurance, [key]: { ...draft.socialInsurance[key], enabled } },
                      }))}
                    />
                    <Input aria-label={`social-${key}-employee-rate-percent`} value={formatContributionRatePercent(settingsDraft.socialInsurance[key].employeeRate)} onChange={(event) => updateSocialRate(key, 'employeeRate', event.target.value)} />
                    <Input aria-label={`social-${key}-employer-rate-percent`} value={formatContributionRatePercent(settingsDraft.socialInsurance[key].employerRate)} onChange={(event) => updateSocialRate(key, 'employerRate', event.target.value)} />
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div><Label>社保基数下限</Label><Input value={settingsDraft.socialInsurance.minimumBase} onChange={(event) => updateSocialBase('minimumBase', event.target.value)} /></div>
                <div><Label>社保基数上限</Label><Input value={settingsDraft.socialInsurance.maximumBase} onChange={(event) => updateSocialBase('maximumBase', event.target.value)} /></div>
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="text-sm font-medium text-slate-900">公积金配置</h3>
                <Switch
                  checked={settingsDraft.housingFund.enabled}
                  onCheckedChange={(enabled) => setSettingsDraft((draft) => ({
                    ...draft,
                    housingFund: { ...draft.housingFund, enabled },
                  }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div><Label>个人比例 (%)</Label><Input aria-label="housing-employee-rate-percent" value={formatContributionRatePercent(settingsDraft.housingFund.employeeRate)} onChange={(event) => updateHousing('employeeRate', event.target.value)} /></div>
                <div><Label>企业比例 (%)</Label><Input aria-label="housing-employer-rate-percent" value={formatContributionRatePercent(settingsDraft.housingFund.employerRate)} onChange={(event) => updateHousing('employerRate', event.target.value)} /></div>
                <div><Label>基数下限</Label><Input value={settingsDraft.housingFund.minimumBase} onChange={(event) => updateHousing('minimumBase', event.target.value)} /></div>
                <div><Label>基数上限</Label><Input value={settingsDraft.housingFund.maximumBase} onChange={(event) => updateHousing('maximumBase', event.target.value)} /></div>
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-4 py-3">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-slate-900">计提凭证默认科目</h3>
                <p className="mt-1 text-xs text-slate-500">员工卡片未配置工资科目时，将按这里的账套默认科目生成工资计提凭证。</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                                {PAYROLL_VOUCHER_SUBJECT_FIELDS.map((field) => (
                  <div key={String(field.codeField)} className="rounded-md border border-slate-200 p-3">
                    <Label className="text-sm font-medium text-slate-700">{field.label}</Label>
                    <div className="mt-2">
                      <SubjectPopover
                        value={accountSetSubjectDraft[field.codeField]}
                        onSelect={(code, name) => {
                          updateAccountSetSubjectDraft(field.codeField, code);
                          updateAccountSetSubjectDraft(field.nameField, name);
                        }}
                        placeholder={`选择${field.label}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>取消</Button>
            <Button onClick={saveSettings}>保存设置</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taxSettingsOpen} onOpenChange={setTaxSettingsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>税率设置</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              这里调整当前工资批次使用的税率草稿。修改会保留在“计算设置”草稿中，最终以“保存设置”为准。
            </div>
            <div className="space-y-4">
              {PAYROLL_TAX_RULE_SECTIONS.map((section) => (
                <div key={section.ruleType} className="rounded-md border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{section.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{section.description}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => restoreTaxRules(section.ruleType)}>
                      <RotateCcw className="h-4 w-4" />恢复默认
                    </Button>
                  </div>
                  <div className="mt-3 overflow-auto rounded-md border border-slate-200">
                    <table className="w-full min-w-[860px] border-collapse text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="border border-slate-200 px-2 py-2 text-left font-medium">档次</th>
                          <th className="border border-slate-200 px-2 py-2 text-left font-medium">生效日期</th>
                          <th className="border border-slate-200 px-2 py-2 text-right font-medium">起点</th>
                          <th className="border border-slate-200 px-2 py-2 text-right font-medium">终点</th>
                          <th className="border border-slate-200 px-2 py-2 text-right font-medium">税率(%)</th>
                          <th className="border border-slate-200 px-2 py-2 text-right font-medium">速算扣除数</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settingsDraft.taxRules[section.ruleType].map((rule, index) => (
                          <tr key={rule.id} className="border-t border-slate-100">
                            <td className="border border-slate-200 px-2 py-2 text-slate-600">{index + 1}</td>
                            <td className="border border-slate-200 px-2 py-1">
                              <Input
                                type="text"
                                className="h-8 border-0 px-1 text-xs shadow-none focus-visible:ring-1"
                                value={formatChineseDateInput(rule.effectiveDate)}
                                placeholder="2019年1月1日"
                                onChange={(event) => updateTaxRule(section.ruleType, index, 'effectiveDate', event.target.value)}
                              />
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              <Input
                                type="number"
                                className="h-8 border-0 px-1 text-right text-xs shadow-none focus-visible:ring-1"
                                value={rule.lowerLimit}
                                onChange={(event) => updateTaxRule(section.ruleType, index, 'lowerLimit', event.target.value)}
                              />
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              <Input
                                type="number"
                                className="h-8 border-0 px-1 text-right text-xs shadow-none focus-visible:ring-1"
                                value={rule.upperLimit ?? ''}
                                placeholder="以上"
                                onChange={(event) => updateTaxRule(section.ruleType, index, 'upperLimit', event.target.value)}
                              />
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              <Input
                                type="number"
                                className="h-8 border-0 px-1 text-right text-xs shadow-none focus-visible:ring-1"
                                value={formatContributionRatePercent(rule.rate)}
                                onChange={(event) => updateTaxRule(section.ruleType, index, 'rate', event.target.value)}
                              />
                            </td>
                            <td className="border border-slate-200 px-2 py-1">
                              <Input
                                type="number"
                                className="h-8 border-0 px-1 text-right text-xs shadow-none focus-visible:ring-1"
                                value={rule.quickDeduction}
                                onChange={(event) => updateTaxRule(section.ruleType, index, 'quickDeduction', event.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
            <div className="max-h-[36vh] overflow-auto rounded-md border border-slate-200">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="border border-slate-200 px-2 py-2 text-left font-medium">规则</th>
                    <th className="border border-slate-200 px-2 py-2 text-left font-medium">生效日期</th>
                    <th className="border border-slate-200 px-2 py-2 text-right font-medium">起点</th>
                    <th className="border border-slate-200 px-2 py-2 text-right font-medium">终点</th>
                    <th className="border border-slate-200 px-2 py-2 text-right font-medium">税率(%)</th>
                    <th className="border border-slate-200 px-2 py-2 text-right font-medium">速算扣除数</th>
                  </tr>
                </thead>
                <tbody>
                  {BUILT_IN_PAYROLL_TAX_RULES.map((rule) => (
                    <tr key={rule.id} className="border-t border-slate-100">
                      <td className="border border-slate-200 px-2 py-2">
                        {rule.ruleType === 'salary' ? '工资薪金' : rule.ruleType === 'annual_bonus' ? '全年一次性奖金' : '经营所得'}
                      </td>
                      <td className="border border-slate-200 px-2 py-2">{formatChineseDate(rule.effectiveDate)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">{rule.lowerLimit}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">{rule.upperLimit ?? '以上'}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">{formatContributionRatePercent(rule.rate)}</td>
                      <td className="border border-slate-200 px-2 py-2 text-right tabular-nums">{rule.quickDeduction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTaxSettingsOpen(false)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VoucherDetailDialog
        open={!!voucherDetailNo}
        onOpenChange={(open) => { if (!open) setVoucherDetailNo(null); }}
        voucherNo={voucherDetailNo}
      />
    </div>
  );
}

