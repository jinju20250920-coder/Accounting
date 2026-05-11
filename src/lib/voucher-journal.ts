import type { Voucher, VoucherEntry } from '../types';

type VoucherEntryWithOriginalAmount = VoucherEntry & {
  originalAmount?: number;
};

export interface VoucherJournalFilters {
  startMonth?: string;
  endMonth?: string;
  searchQuery?: string;
}

export interface VoucherJournalRow {
  lineNo: number;
  voucherId: string;
  entryId: string;
  voucherNo: string;
  date: string;
  voucherType: Voucher['voucherType'];
  status: Voucher['status'];
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
  currencyCode: string;
  originalAmount: number;
  partner: string;
  department: string;
  project: string;
  cashFlowItem: string;
  docNo: string;
  recRefNo: string;
  createdBy: string;
  sourceVoucher: Voucher;
}

export const VOUCHER_TYPE_LABELS: Record<Voucher['voucherType'], string> = {
  general: '记账凭证',
  receipt: '收款凭证',
  payment: '付款凭证',
  transfer: '转账凭证',
  closing: '结转凭证',
};

export const VOUCHER_STATUS_LABELS: Record<Voucher['status'], string> = {
  draft: '草稿',
  review: '审核中',
  posted: '已记账',
  reversed: '已冲销',
};

function hasJournalEntryContent(entry: VoucherEntry): boolean {
  return Boolean(entry.subjectCode || entry.debit > 0 || entry.credit > 0);
}

function normalizeText(value: string | undefined): string {
  return (value || '').trim().toLowerCase();
}

function matchesSearch(voucher: Voucher, entry: VoucherEntry, searchQuery?: string): boolean {
  const query = normalizeText(searchQuery);
  if (!query) return true;

  const partner = entry.auxiliary?.customer || entry.auxiliary?.supplier || entry.customerName || entry.supplierName || '';
  const fields = [
    voucher.voucherNo,
    voucher.summary,
    entry.summary,
    entry.subjectCode,
    entry.subjectName,
    partner,
    entry.docNo,
    entry.recRefNo,
  ];

  return fields.some((field) => normalizeText(field).includes(query));
}

function matchesMonthRange(voucher: Voucher, filters: VoucherJournalFilters): boolean {
  const voucherMonth = voucher.date.slice(0, 7);
  if (filters.startMonth && voucherMonth < filters.startMonth) return false;
  if (filters.endMonth && voucherMonth > filters.endMonth) return false;
  return true;
}

export function buildVoucherJournalRows(
  vouchers: Voucher[],
  filters: VoucherJournalFilters = {},
): VoucherJournalRow[] {
  let lineNo = 1;

  return vouchers
    .filter((voucher) => voucher.status === 'posted' || voucher.status === 'reversed')
    .filter((voucher) => matchesMonthRange(voucher, filters))
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.voucherNo.localeCompare(b.voucherNo);
    })
    .flatMap((voucher) =>
      voucher.entries
        .filter(hasJournalEntryContent)
        .filter((entry) => matchesSearch(voucher, entry, filters.searchQuery))
        .map((entry) => {
          const entryWithOriginalAmount = entry as VoucherEntryWithOriginalAmount;
          const row: VoucherJournalRow = {
            lineNo,
            voucherId: voucher.id,
            entryId: entry.id,
            voucherNo: voucher.voucherNo,
            date: voucher.date,
            voucherType: voucher.voucherType,
            status: voucher.status,
            summary: entry.summary || voucher.summary || '',
            subjectCode: entry.subjectCode || '',
            subjectName: entry.subjectName || '',
            debit: entry.debit || 0,
            credit: entry.credit || 0,
            currencyCode: entry.currencyCode || '',
            originalAmount: entryWithOriginalAmount.originalAmount || 0,
            partner: entry.auxiliary?.customer || entry.auxiliary?.supplier || entry.customerName || entry.supplierName || '',
            department: entry.auxiliary?.department || entry.deptCode || '',
            project: entry.auxiliary?.project || entry.projectCode || '',
            cashFlowItem: entry.cashFlowItem || '',
            docNo: entry.docNo || '',
            recRefNo: entry.recRefNo || '',
            createdBy: voucher.createdBy || '',
            sourceVoucher: voucher,
          };
          lineNo += 1;
          return row;
        }),
    );
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildVoucherJournalCsv(rows: VoucherJournalRow[]): string {
  const headers = [
    '序号',
    '凭证号',
    '日期',
    '凭证类型',
    '状态',
    '摘要',
    '科目代码',
    '科目名称',
    '借方金额',
    '贷方金额',
    '币别',
    '原币金额',
    '往来单位',
    '部门',
    '项目',
    '现金流量',
    '业务单据号',
    '核销单号',
    '创建人',
  ];

  const body = rows.map((row) => [
    row.lineNo,
    row.voucherNo,
    row.date,
    VOUCHER_TYPE_LABELS[row.voucherType],
    VOUCHER_STATUS_LABELS[row.status],
    row.summary,
    row.subjectCode,
    row.subjectName,
    row.debit > 0 ? row.debit.toFixed(2) : '',
    row.credit > 0 ? row.credit.toFixed(2) : '',
    row.currencyCode,
    row.originalAmount > 0 ? row.originalAmount.toFixed(2) : '',
    row.partner,
    row.department,
    row.project,
    row.cashFlowItem,
    row.docNo,
    row.recRefNo,
    row.createdBy,
  ]);

  return [headers, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
}
