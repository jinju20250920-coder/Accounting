'use client';

import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { parseWithConfig } from '@/lib/bank-parsers/engine';
import type { BankParserConfig } from '@/lib/bank-parsers/types';
import type { BankStatementParseResult } from '@/types';
import { Upload, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface BankFormatTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: BankParserConfig;
}

export function BankFormatTestDialog({ open, onOpenChange, config }: BankFormatTestDialogProps) {
  const [testFile, setTestFile] = useState<File | null>(null);
  const [testResult, setTestResult] = useState<BankStatementParseResult | null>(null);
  const [testing, setTesting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleTest = async () => {
    if (!testFile) return;
    setTesting(true);
    try {
      const result = await parseWithConfig(testFile, config);
      setTestResult(result);
    } catch (e) {
      showToast('error', `解析失败: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setTestFile(null);
    setTestResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>测试解析 — {config.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload */}
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setTestFile(f);
                  setTestResult(null);
                }
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              选择测试文件
            </Button>
            {testFile && (
              <span className="text-sm text-slate-600">{testFile.name}</span>
            )}
            <Button onClick={handleTest} disabled={!testFile || testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              开始测试
            </Button>
          </div>

          {/* Config summary */}
          <div className="bg-slate-50 rounded-lg p-3 text-xs">
            <div className="flex flex-wrap gap-3 text-slate-600">
              <span>表头行: {config.headerRows}</span>
              <span>日期格式: {config.dateFormat}</span>
              <span>映射字段: {Object.keys(config.columnMapping || {}).length}</span>
            </div>
          </div>

          {/* Results */}
          {testResult && (
            <div className="space-y-3">
              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>{testResult.transactions.length} 条交易</span>
                </div>
                {testResult.errors && testResult.errors.length > 0 && (
                  <div className="flex items-center gap-1">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span>{testResult.errors.length} 个错误</span>
                  </div>
                )}
                {testResult.bankInfo && (
                  <Badge variant="secondary" className="text-xs">
                    {testResult.bankInfo.accountName} {testResult.bankInfo.accountNumber}
                  </Badge>
                )}
              </div>

              {/* Preview table */}
              {testResult.transactions.length > 0 ? (
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-2 py-1">日期</th>
                        <th className="px-2 py-1">借方</th>
                        <th className="px-2 py-1">贷方</th>
                        <th className="px-2 py-1">余额</th>
                        <th className="px-2 py-1">对方户名</th>
                        <th className="px-2 py-1">摘要</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testResult.transactions.slice(0, 10).map((tx, i) => (
                        <tr key={i} className="border-t hover:bg-slate-50">
                          <td className="px-2 py-1">{tx.date}</td>
                          <td className="px-2 py-1">{tx.debit ?? '-'}</td>
                          <td className="px-2 py-1">{tx.credit ?? '-'}</td>
                          <td className="px-2 py-1">{tx.balance ?? '-'}</td>
                          <td className="px-2 py-1 truncate max-w-[120px]">{tx.counterpartyName || '-'}</td>
                          <td className="px-2 py-1 truncate max-w-[120px]">{tx.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {testResult.transactions.length > 10 && (
                    <p className="text-xs text-slate-400 p-2 text-center">
                      仅显示前 10 条，共 {testResult.transactions.length} 条
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm text-red-500 p-3 bg-red-50 rounded">
                  解析失败或无数据
                  {testResult.errors?.[0]?.message && (
                    <p className="mt-1">{testResult.errors[0].message}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
