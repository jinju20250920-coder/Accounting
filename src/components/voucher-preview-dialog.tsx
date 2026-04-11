'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, UserPlus } from 'lucide-react';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';

/** 格式化日期为中文：2026-04-10 → 2026年04月10日 */
const fmtDate = (d: string) => {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3) return d;
  return `${parts[0]}年${parts[1]}月${parts[2]}日`;
};

export interface PreviewEntry {
  transactionId: string;
  date: string;
  postingDate: string;        // 过账日期（可编辑）
  summary: string;            // 过账摘要（可编辑）
  originalSummary: string;    // 原始流水摘要（只读参考）
  counterpartyName?: string;
  counterpartyAccount?: string;
  counterpartSubjectCode: string;
  counterpartSubjectName: string;
  bankSubjectCode: string;
  bankSubjectName: string;
  amount: number;
  isDebit: boolean;           // true=银行流水借方(付款/流出), false=银行流水贷方(收款/流入)
  willCreatePartner?: boolean;
}

interface VoucherPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: PreviewEntry[];
  onConfirm: (updatedEntries: PreviewEntry[]) => void;
  isProcessing: boolean;
}

/** 生成智能默认摘要 */
export function generateDefaultSummary(entry: {
  isDebit: boolean;
  counterpartyName?: string;
  counterpartSubjectName: string;
  amount: number;
}): string {
  const name = entry.counterpartyName?.trim();
  if (entry.isDebit) {
    // 付款
    if (name) return `支付${name}${entry.counterpartSubjectName}`;
    return `支付${entry.counterpartSubjectName}`;
  } else {
    // 收款
    if (name) return `收到${name}${entry.counterpartSubjectName}`;
    return `收到${entry.counterpartSubjectName}`;
  }
}

export function VoucherPreviewDialog({
  open,
  onOpenChange,
  entries,
  onConfirm,
  isProcessing,
}: VoucherPreviewDialogProps) {
  // 用 useState 维护可编辑的 entries 副本
  const [editedEntries, setEditedEntries] = useState<PreviewEntry[]>([]);

  // 当 entries 变化（弹窗打开）时初始化编辑状态
  React.useEffect(() => {
    if (open && entries.length > 0) {
      setEditedEntries(entries.map(e => ({ ...e })));
    }
  }, [open, entries]);

  const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2 });
  const totalPayment = editedEntries.filter(e => e.isDebit).reduce((s, e) => s + e.amount, 0);
  const totalReceipt = editedEntries.filter(e => !e.isDebit).reduce((s, e) => s + e.amount, 0);
  const totalAmount = editedEntries.reduce((s, e) => s + e.amount, 0);
  const newPartnerCount = editedEntries.filter(e => e.willCreatePartner).length;

  const updateEntry = (index: number, updates: Partial<PreviewEntry>) => {
    setEditedEntries(prev => prev.map((e, i) => i === index ? { ...e, ...updates } : e));
  };

  const handleConfirm = () => {
    onConfirm(editedEntries);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            凭证预览（{editedEntries.length} 张）
          </DialogTitle>
        </DialogHeader>

        {newPartnerCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <UserPlus className="h-4 w-4 text-green-600" />
            <span className="text-green-800">
              将自动创建 <strong>{newPartnerCount}</strong> 个往来单位卡片（供应商/客户）并关联默认科目
            </span>
          </div>
        )}

        {/* 凭证列表 */}
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {editedEntries.map((entry, idx) => (
            <div key={entry.transactionId} className="border rounded-lg p-3">
              {/* 头部：序号 + 状态 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">#{idx + 1}</Badge>
                  <Badge variant={entry.isDebit ? 'outline' : 'default'}>
                    {entry.isDebit ? '付款' : '收款'}
                  </Badge>
                  {entry.counterpartyName && (
                    <Badge variant="secondary" className="text-xs">
                      {entry.counterpartyName}
                      {entry.willCreatePartner && <span className="ml-1 text-green-600">+新建</span>}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  原始摘要: {entry.originalSummary}
                </span>
              </div>

              {/* 可编辑字段：过账日期 + 摘要 */}
              <div className="grid grid-cols-[140px_1fr] gap-2 mb-2">
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">过账日期</label>
                  <ChineseDatePicker
                    value={entry.postingDate}
                    onChange={v => updateEntry(idx, { postingDate: v })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-0.5">过账摘要</label>
                  <input
                    type="text"
                    value={entry.summary}
                    onChange={e => updateEntry(idx, { summary: e.target.value })}
                    className="w-full text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* 分录表格 */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-left py-1 font-medium">科目</th>
                    <th className="text-right py-1 font-medium w-28">借方</th>
                    <th className="text-right py-1 font-medium w-28">贷方</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-dashed">
                    <td className="py-1.5">
                      <span className="font-mono text-blue-600">{entry.counterpartSubjectCode}</span>
                      {' '}
                      <span>{entry.counterpartSubjectName}</span>
                    </td>
                    <td className="text-right py-1.5">
                      {entry.isDebit ? fmt(entry.amount) : ''}
                    </td>
                    <td className="text-right py-1.5">
                      {entry.isDebit ? '' : fmt(entry.amount)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5">
                      <span className="font-mono text-blue-600">{entry.bankSubjectCode}</span>
                      {' '}
                      <span>{entry.bankSubjectName}</span>
                    </td>
                    <td className="text-right py-1.5">
                      {entry.isDebit ? '' : fmt(entry.amount)}
                    </td>
                    <td className="text-right py-1.5">
                      {entry.isDebit ? fmt(entry.amount) : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* 汇总 */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
          <div className="flex items-center gap-4">
            <span>共 <strong>{editedEntries.length}</strong> 张凭证</span>
            <span>付款: <strong className="text-red-600">¥{fmt(totalPayment)}</strong></span>
            <span>收款: <strong className="text-green-600">¥{fmt(totalReceipt)}</strong></span>
          </div>
          <span className="text-slate-500">合计: ¥{fmt(totalAmount)}</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>取消</Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            确认生成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
