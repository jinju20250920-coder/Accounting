'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { exportTemplate } from '@/lib/excel-utils';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Download,
  X,
} from 'lucide-react';
import type { ExpenseReimbursement } from '@/types';

interface ExpenseListImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete?: () => void;
}

interface ParsedRow {
  invoiceCode: string;
  reimburserName: string;
  notes: string;
  matched: boolean;
}

const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

export function ExpenseListImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: ExpenseListImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const matchedCount = parsedRows.filter((r) => r.matched).length;
  const totalCount = parsedRows.length;

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setParsedRows([]);
        setFileName('');
        setImporting(false);
        setDragOver(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  // Parse the uploaded Excel file
  const parseFile = useCallback(
    async (file: File) => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!firstSheet) {
          toast({ type: 'error', description: 'Excel 文件中没有工作表' });
          return;
        }

        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(
          firstSheet,
          { defval: '' }
        );

        if (jsonData.length === 0) {
          toast({ type: 'error', description: 'Excel 文件中没有数据行' });
          return;
        }

        // Get existing invoice codes from the store for match checking
        const { invoices } = useInvoiceStore.getState();
        const existingCodes = new Set(invoices.map((inv) => inv.invoiceCode));

        const rows: ParsedRow[] = jsonData
          .map((row) => {
            const invoiceCode = String(
              row['发票号码'] ?? row['invoiceCode'] ?? ''
            ).trim();
            const reimburserName = String(
              row['报销人'] ?? row['reimburserName'] ?? ''
            ).trim();
            const notes = String(
              row['备注'] ?? row['notes'] ?? ''
            ).trim();

            if (!invoiceCode) return null;
            return {
              invoiceCode,
              reimburserName,
              notes,
              matched: existingCodes.has(invoiceCode),
            };
          })
          .filter(Boolean) as ParsedRow[];

        if (rows.length === 0) {
          toast({ type: 'error', description: '未找到有效数据行，请确认列标题包含"发票号码"和"报销人"' });
          return;
        }

        setParsedRows(rows);
        setFileName(file.name);
        toast({
          type: 'info',
          description: `已解析 ${rows.length} 条记录，${rows.filter((r) => r.matched).length} 条匹配到已有发票`,
        });
      } catch (err) {
        console.error('Failed to parse Excel file:', err);
        toast({ type: 'error', description: '文件解析失败，请确认文件格式正确' });
      }
    },
    [toast]
  );

  // Handle file selection
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        parseFile(file);
      }
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [parseFile]
  );

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        const ext = file.name.toLowerCase();
        if (!ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
          toast({ type: 'error', description: '请上传 .xlsx 或 .xls 格式的文件' });
          return;
        }
        parseFile(file);
      }
    },
    [parseFile, toast]
  );

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    exportTemplate(
      '费用清单导入模板',
      { 发票号码: 'FP202601001', 报销人: '张三', 备注: '差旅报销' },
      [
        { key: '发票号码', label: '发票号码', placeholder: '发票上的发票号码' },
        { key: '报销人', label: '报销人', placeholder: '报销人姓名' },
        { key: '备注', label: '备注', placeholder: '选填' },
      ]
    );
  }, []);

  // Confirm import
  const handleConfirmImport = useCallback(async () => {
    if (parsedRows.length === 0) return;

    setImporting(true);
    try {
      const accountSetId = sqliteService.accountSetId;
      const batchId = generateId();

      // Get existing expense reimbursements for dedup
      const existingRecords = await sqliteService.getExpenseReimbursements();
      const existingByCode = new Map(
        existingRecords.map((r) => [r.invoiceCode, r])
      );

      let savedCount = 0;
      for (const row of parsedRows) {
        // Dedup: if a record with same invoiceCode exists, delete it first
        const existing = existingByCode.get(row.invoiceCode);
        if (existing) {
          await sqliteService.deleteExpenseReimbursement(existing.id);
        }

        const record: ExpenseReimbursement = {
          id: generateId(),
          accountSetId,
          invoiceCode: row.invoiceCode,
          reimburserName: row.reimburserName,
          notes: row.notes || undefined,
          importBatchId: batchId,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString(),
        };
        await sqliteService.saveExpenseReimbursement(record);
        savedCount++;
      }

      toast({ type: 'success', description: `成功导入 ${savedCount} 条费用清单记录` });
      onImportComplete?.();
      handleOpenChange(false);
    } catch (err) {
      console.error('Failed to import expense list:', err);
      toast({ type: 'error', description: '导入失败，请重试' });
    } finally {
      setImporting(false);
    }
  }, [parsedRows, onImportComplete, handleOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            导入费用清单
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File upload area */}
          {parsedRows.length === 0 ? (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-300 hover:border-blue-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click();
                }
              }}
            >
              <Upload className="mx-auto h-10 w-10 text-slate-400 mb-3" />
              <p className="text-sm text-slate-600 mb-1">
                点击或拖拽 Excel 文件到此处
              </p>
              <p className="text-xs text-slate-400">
                支持 .xlsx、.xls 格式，列标题需包含"发票号码"和"报销人"
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <>
              {/* File info + clear */}
              <div className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2">
                <span className="text-sm text-slate-600 truncate">
                  {fileName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setParsedRows([]);
                    setFileName('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Summary */}
              <p className="text-sm text-slate-600">
                共{' '}
                <span className="font-medium text-slate-800">
                  {totalCount}
                </span>{' '}
                条记录，已匹配{' '}
                <span className="font-medium text-green-600">
                  {matchedCount}
                </span>{' '}
                条
                {totalCount - matchedCount > 0 && (
                  <span className="text-amber-600 ml-1">
                    （{totalCount - matchedCount} 条未匹配到发票）
                  </span>
                )}
              </p>

              {/* Preview table */}
              <div className="max-h-72 overflow-y-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">
                        发票号码
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">
                        报销人
                      </th>
                      <th className="text-left px-3 py-2 font-medium text-slate-600">
                        备注
                      </th>
                      <th className="text-center px-3 py-2 font-medium text-slate-600">
                        匹配状态
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-t hover:bg-slate-50"
                      >
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {row.invoiceCode}
                        </td>
                        <td className="px-3 py-1.5">{row.reimburserName}</td>
                        <td className="px-3 py-1.5 text-slate-400">
                          {row.notes || '-'}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {row.matched ? (
                            <span className="inline-flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-xs">已匹配</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-500">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-xs">未匹配</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={importing}
          >
            <Download className="h-4 w-4 mr-1" />
            下载模板
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={importing}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirmImport}
            disabled={parsedRows.length === 0 || importing}
          >
            {importing ? '导入中...' : '确认导入'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
