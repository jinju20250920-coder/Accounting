'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';

export interface AssetVoucherPreviewEntry {
  summary: string;
  subjectCode: string;
  subjectName: string;
  debit: number;
  credit: number;
}

export interface AssetVoucherPreviewData {
  voucherDate: string;
  entries: AssetVoucherPreviewEntry[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

interface AssetVoucherPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vouchers: AssetVoucherPreviewData[];
  onConfirm: (updatedVouchers: AssetVoucherPreviewData[]) => void;
  isProcessing: boolean;
  title?: string;
}

export function AssetVoucherPreviewDialog({
  open,
  onOpenChange,
  vouchers,
  onConfirm,
  isProcessing,
  title = '凭证预览',
}: AssetVoucherPreviewDialogProps) {
  const [editedVouchers, setEditedVouchers] = React.useState<AssetVoucherPreviewData[]>([]);

  React.useEffect(() => {
    if (open && vouchers.length > 0) {
      setEditedVouchers(vouchers.map(v => ({ ...v, entries: v.entries.map(e => ({ ...e })) })));
    }
  }, [open, vouchers]);

  const fmt = (n: number) => n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const updateVoucherDate = (index: number, date: string) => {
    setEditedVouchers(prev => prev.map((v, i) => i === index ? { ...v, voucherDate: date } : v));
  };

  const handleConfirm = () => {
    onConfirm(editedVouchers);
  };

  const allBalanced = editedVouchers.every(v => v.isBalanced);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}（{editedVouchers.length} 张）
          </DialogTitle>
        </DialogHeader>

        {!allBalanced && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-red-800">凭证借贷不平衡，请检查数据</span>
          </div>
        )}

        <div className="space-y-4 max-h-[55vh] overflow-y-auto">
          {editedVouchers.map((voucher, vIdx) => (
            <div key={vIdx} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">凭证 {vIdx + 1}</Badge>
                  {voucher.isBalanced ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      平衡
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      不平衡
                    </Badge>
                  )}
                </div>
                <ChineseDatePicker
                  value={voucher.voucherDate}
                  onChange={(date) => updateVoucherDate(vIdx, date)}
                  className="w-36"
                />
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 border-b">
                    <th className="text-left py-2 font-medium">摘要</th>
                    <th className="text-left py-2 font-medium">科目</th>
                    <th className="text-right py-2 font-medium w-28">借方</th>
                    <th className="text-right py-2 font-medium w-28">贷方</th>
                  </tr>
                </thead>
                <tbody>
                  {voucher.entries.map((entry, eIdx) => (
                    <tr key={eIdx} className="border-b border-dashed">
                      <td className="py-2 text-slate-700">{entry.summary}</td>
                      <td className="py-2">
                        <span className="font-mono text-blue-600">{entry.subjectCode}</span>
                        {' '}
                        <span className="text-slate-600">{entry.subjectName}</span>
                      </td>
                      <td className="text-right py-2 font-mono">
                        {entry.debit > 0 ? fmt(entry.debit) : ''}
                      </td>
                      <td className="text-right py-2 font-mono">
                        {entry.credit > 0 ? fmt(entry.credit) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium bg-slate-50">
                    <td colSpan={2} className="py-2 text-right">合计</td>
                    <td className="text-right py-2 font-mono">{fmt(voucher.totalDebit)}</td>
                    <td className="text-right py-2 font-mono">{fmt(voucher.totalCredit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !allBalanced}>
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            确认生成凭证
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
