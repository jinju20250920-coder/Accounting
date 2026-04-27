'use client';

import { useState, useEffect } from 'react';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import {
  Search,
  Upload,
  FileText,
  Calculator,
  CheckCircle,
  Clock,
  AlertCircle,
  Trash2,
  Settings2,
  PauseCircle,
  PlayCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { InvoiceSmartRuleDialog } from '@/components/invoice-smart-rule-dialog';
import { ExpenseListImportDialog } from '@/components/expense-list-import-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { sqliteService } from '@/lib/database/sqlite-service';
import type { Invoice, InvoicePaymentStatus, ExpenseReimbursement } from '@/types';
import * as XLSX from 'xlsx';

// 生成唯一ID
const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;

// 支付状态Badge
function PaymentStatusBadge({ status }: { status: InvoicePaymentStatus }) {
  const config = {
    unpaid: { label: '未付款', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    partial: { label: '部分付款', className: 'bg-blue-100 text-blue-800', icon: AlertCircle },
    paid: { label: '已付款', className: 'bg-green-100 text-green-800', icon: CheckCircle },
  };
  const { label, className, icon: Icon } = config[status];
  return (
    <Badge variant="outline" className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

// 发票详情对话框
function InvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
  onGenerateVoucher,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onGenerateVoucher: (invoiceId: string) => void;
}) {
  const { showToast } = useToast();

  if (!invoice) return null;

  const handleGenerateVoucher = async () => {
    await onGenerateVoucher(invoice.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            进项发票详情
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-500">发票号码</Label>
              <p className="font-medium font-mono text-sm">{invoice.invoiceCode}</p>
              {invoice.digitalInvoiceNo && (
                <p className="font-mono text-xs text-slate-400 mt-0.5">{invoice.digitalInvoiceNo}</p>
              )}
            </div>
            <div>
              <Label className="text-slate-500">开票日期</Label>
              <p className="font-medium">{invoice.invoiceDate ? invoice.invoiceDate.substring(0, 10) : ''}</p>
            </div>
          </div>

          {/* 销售方信息 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-slate-700">销售方信息</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500">名称</Label>
                <p className="font-medium">{invoice.sellerName}</p>
              </div>
              <div>
                <Label className="text-slate-500">税号</Label>
                <p className="font-medium">{invoice.sellerTaxNo || '-'}</p>
              </div>
            </div>
          </div>

          {/* 商品信息 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-slate-700">商品/服务信息</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-slate-500">名称</Label>
                <p className="font-medium">{invoice.goodsName || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-500">数量</Label>
                <p className="font-medium">{invoice.quantity || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-500">单价</Label>
                <p className="font-medium">{invoice.unitPrice?.toFixed(2) || '-'}</p>
              </div>
            </div>
          </div>

          {/* 金额信息 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-slate-700">金额信息</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label className="text-slate-500">金额(不含税)</Label>
                <p className="font-medium text-lg">¥{invoice.amount.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-slate-500">税率</Label>
                <p className="font-medium">{invoice.taxRate ? `${(invoice.taxRate * 100).toFixed(0)}%` : '-'}</p>
              </div>
              <div>
                <Label className="text-slate-500">税额</Label>
                <p className="font-medium">¥{invoice.taxAmount?.toFixed(2) || '-'}</p>
              </div>
              <div>
                <Label className="text-slate-500">价税合计</Label>
                <p className="font-medium text-lg text-blue-600">¥{invoice.totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* 付款状态 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-slate-700">付款状态</h4>
            <div className="flex items-center gap-4">
              <PaymentStatusBadge status={invoice.paymentStatus} />
              <span className="text-slate-500">
                已付: ¥{invoice.paidAmount.toFixed(2)} / 剩余: ¥{(invoice.totalAmount - invoice.paidAmount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* 凭证信息 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-slate-700">凭证信息</h4>
            {invoice.voucherNo ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  已生成凭证: {invoice.voucherNo}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertCircle className="h-4 w-4" />
                <span>尚未生成凭证</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {!invoice.voucherId && (
            <Button onClick={handleGenerateVoucher}>
              <Calculator className="h-4 w-4 mr-2" />
              生成凭证
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 导入对话框
function ImportDialog({
  open,
  onOpenChange,
  onImport,
  accountSetTaxNo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (invoices: Partial<Invoice>[]) => Promise<{ success: number; errors: string[] }>;
  accountSetTaxNo?: string; // 当前账套的税号
}) {
  const { showToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<Partial<Invoice>[]>([]);
  const [step, setStep] = useState<'upload' | 'selectSheet' | 'preview' | 'warning'>('upload');
  const [taxNoMismatch, setTaxNoMismatch] = useState(false);
  const [mismatchDetails, setMismatchDetails] = useState<string[]>([]);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetDataMap, setSheetDataMap] = useState<Map<string, Partial<Invoice>[]>>(new Map());
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());

  // 按发票号码+数电发票号码分组汇总数据
  const groupInvoices = (invoices: Partial<Invoice>[]): { grouped: Map<string, Partial<Invoice>>, originalCount: number } => {
    const grouped = new Map<string, Partial<Invoice>>();
    const countMap = new Map<string, { amount: number; taxAmount: number; totalAmount: number; quantity: number; goodsNames: string[]; rowCount: number }>();

    console.log('=== groupInvoices 调试 ===');
    console.log('原始数据行数:', invoices.length);

    for (const inv of invoices) {
      // 按"发票号码 + 数电发票号码"组合作为唯一键
      const key = inv.digitalInvoiceNo
        ? `${inv.invoiceCode}|||${inv.digitalInvoiceNo}`
        : (inv.invoiceCode || '');

      console.log('处理行: invoiceCode=[' + inv.invoiceCode + '], digitalInvoiceNo=[' + inv.digitalInvoiceNo + '], totalAmount=' + inv.totalAmount + ', key=[' + key + ']');

      if (grouped.has(key)) {
        const counts = countMap.get(key)!;
        counts.amount += inv.amount || 0;
        counts.taxAmount += inv.taxAmount || 0;
        counts.totalAmount += inv.totalAmount || 0;
        counts.quantity += inv.quantity || 0;
        counts.rowCount++;
        if (inv.goodsName && !counts.goodsNames.includes(inv.goodsName)) {
          counts.goodsNames.push(inv.goodsName);
        }
      } else {
        // 重要！创建原始对象的副本，防止修改原始数据
        const invCopy = JSON.parse(JSON.stringify(inv));
        grouped.set(key, invCopy);
        countMap.set(key, {
          amount: inv.amount || 0,
          taxAmount: inv.taxAmount || 0,
          totalAmount: inv.totalAmount || 0,
          quantity: inv.quantity || 0,
          goodsNames: inv.goodsName ? [inv.goodsName] : [],
          rowCount: 1,
        });
      }
    }

    // 更新汇总后的值
    for (const [key, counts] of countMap) {
      const inv = grouped.get(key)!;
      inv.amount = counts.amount;
      inv.taxAmount = counts.taxAmount;
      inv.totalAmount = counts.totalAmount;
      inv.quantity = counts.quantity;
      inv.goodsName = counts.goodsNames.join('、');
      console.log('分组结果: key=[' + key + '], rowCount=' + counts.rowCount + ', totalAmount=' + counts.totalAmount);
    }

    return { grouped, originalCount: invoices.length };
  };

  // 对话框打开/关闭时重置状态
  useEffect(() => {
    if (!open) {
      setPreviewData([]);
      setStep('upload');
      setTaxNoMismatch(false);
      setMismatchDetails([]);
      setImporting(false);
      setWorkbook(null);
      setSelectedSheet('');
      setSheetDataMap(new Map());
      setPreviewSelectedIds(new Set());
    }
  }, [open]);

  // 解析单个sheet的数据
  const parseSheetData = (worksheet: XLSX.WorkSheet, sheetName: string): Partial<Invoice>[] => {
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData
      .filter((row: any) => {
        // 过滤掉合计行
        const serialNumber = String(row['序号'] || '').trim();
        if (serialNumber.includes('合计')) {
          return false;
        }
        // 过滤掉没有发票号码和数电发票号码的行
        const invoiceCode = String(row['发票代码'] || '').trim();
        const invoiceNumber = String(row['发票号码'] || '').trim();
        const digitalNo = String(row['数电发票号码'] || '').trim();
        if (!invoiceCode && !invoiceNumber && !digitalNo) {
          return false;
        }
        return true;
      })
      .map((row: any) => {
      // 发票字段读取 - 确保转为字符串并去除空格
      const rawInvoiceCode = String(row['发票代码'] || '').trim();
      const rawInvoiceNumber = String(row['发票号码'] || '').trim();
      const rawDigitalNo = String(row['数电发票号码'] || row['全电发票号码'] || row['电子发票号码'] || '').trim();

      // 判断是否为有效的数电发票号码（20位数字）
      const isValidDigitalNo = /^\d{20}$/.test(rawDigitalNo);

      let invoiceCode = '';
      let digitalInvoiceNo = '';
      if (isValidDigitalNo && rawDigitalNo) {
        // 数电发票：发票号码和数电发票号码分开存储
        invoiceCode = rawInvoiceNumber || rawInvoiceCode || '';
        digitalInvoiceNo = rawDigitalNo;
      } else {
        // 传统发票
        invoiceCode = rawInvoiceNumber || rawInvoiceCode || '';
      }

      // 金额字段解析 - 确保转为数字
      const parseAmount = (value: any): number => {
        if (value === null || value === undefined || value === '') return 0;
        const num = parseFloat(String(value).replace(/,/g, '')); // 去除千分位逗号
        return isNaN(num) ? 0 : num;
      };

      return {
        invoiceCode,
        digitalInvoiceNo,
        invoiceDate: String(row['开票日期'] || row['日期'] || '').trim(),
        sellerName: String(row['销方名称'] || row['销售方名称'] || '').trim(),
        sellerTaxNo: String(row['销方识别号'] || row['销方税号'] || row['销售方纳税人识别号'] || '').trim(),
        buyerName: String(row['购方名称'] || row['购买方名称'] || '').trim(),
        buyerTaxNo: String(row['购方识别号'] || row['购方税号'] || row['购买方纳税人识别号'] || '').trim(),
        goodsName: String(row['货物或应税劳务名称'] || row['商品名称'] || '').trim(),
        specification: String(row['规格型号'] || '').trim(),
        unit: String(row['单位'] || '').trim(),
        quantity: parseAmount(row['数量']),
        unitPrice: parseAmount(row['单价']),
        amount: parseAmount(row['金额'] || row['不含税金额']),
        taxRate: parseAmount(row['税率']) / 100 || 0.13,
        taxAmount: parseAmount(row['税额']),
        totalAmount: parseAmount(row['价税合计'] || row['合计金额']),
        partnerName: String(row['销方名称'] || row['销售方名称'] || '').trim(),
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 立即重置input的值，允许再次选择同一个文件
    e.target.value = '';

    // 使用Promise包装来避免message channel问题
    const processFile = async () => {
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);

        // 解析所有sheet的数据
        const dataMap = new Map<string, Partial<Invoice>[]>();
        wb.SheetNames.forEach(name => {
          const worksheet = wb.Sheets[name];
          const sheetData = parseSheetData(worksheet, name);
          if (sheetData.length > 0) {
            dataMap.set(name, sheetData);
          }
        });
        setSheetDataMap(dataMap);

        // 如果只有一个有数据的sheet，直接进入预览
        const sheetsWithData = Array.from(dataMap.keys());
        if (sheetsWithData.length === 1) {
          const sheetName = sheetsWithData[0];
          setSelectedSheet(sheetName);
          const invoices = dataMap.get(sheetName) || [];
          checkAndSetPreviewData(invoices);
        } else if (sheetsWithData.length > 1) {
          // 多个sheet，让用户选择
          setStep('selectSheet');
        } else {
          showToast('error', 'Excel文件中没有有效数据');
        }
      } catch (error) {
        showToast('error', '解析Excel文件失败');
        console.error(error);
      }
    };

    // 异步处理，但不直接在事件处理器中返回Promise
    processFile();
  };

  // 检查税号并设置预览数据
  const checkAndSetPreviewData = (invoices: Partial<Invoice>[]) => {
    // 检查购方识别号是否与账套税号一致
    if (accountSetTaxNo) {
      const mismatches: string[] = [];
      invoices.forEach((inv, idx) => {
        if (inv.buyerTaxNo && inv.buyerTaxNo !== accountSetTaxNo) {
          mismatches.push(`第${idx + 1}行: 购方识别号 ${inv.buyerTaxNo} 与账套税号 ${accountSetTaxNo} 不一致`);
        }
      });

      if (mismatches.length > 0) {
        setMismatchDetails(mismatches);
        setTaxNoMismatch(true);
        setPreviewData(invoices);
        setStep('warning');
        return;
      }
    }

    setPreviewData(invoices);
    setTaxNoMismatch(false);
    setStep('preview');
  };

  // 选择sheet后处理
  const handleSelectSheet = (sheetName: string) => {
    setSelectedSheet(sheetName);
    const invoices = sheetDataMap.get(sheetName) || [];
    checkAndSetPreviewData(invoices);
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const result = await onImport(previewData);
      if (result.success > 0) {
        showToast('success', `成功导入 ${result.success} 条发票`);
      }
      if (result.errors.length > 0) {
        result.errors.forEach(err => showToast('warning', err));
      }
      onOpenChange(false);
      setPreviewData([]);
      setStep('upload');
      setTaxNoMismatch(false);
      setMismatchDetails([]);
      setWorkbook(null);
      setSelectedSheet('');
      setSheetDataMap(new Map());
      setPreviewSelectedIds(new Set());
    } catch (error) {
      showToast('error', '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setPreviewData([]);
    setStep('upload');
    setTaxNoMismatch(false);
    setMismatchDetails([]);
    setWorkbook(null);
    setSelectedSheet('');
    setSheetDataMap(new Map());
    setPreviewSelectedIds(new Set());
  };

  const handleContinueAnyway = () => {
    // 用户确认继续导入（即使税号不匹配）
    setStep('preview');
    setTaxNoMismatch(false);
  };

  const handleBackToSelectSheet = () => {
    setStep('selectSheet');
    setPreviewData([]);
    setTaxNoMismatch(false);
    setMismatchDetails([]);
    setPreviewSelectedIds(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入进项发票</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">选择税务局导出的Excel文件</p>
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('invoice-file-input')?.click()}
                >
                  选择文件
                </Button>
                <span className="text-sm text-slate-500">
                  支持 .xlsx, .xls 格式
                </span>
              </div>
              <Input
                id="invoice-file-input"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        )}

        {step === 'selectSheet' && (
          <div className="py-4">
            <div className="mb-4">
              <p className="text-slate-600 mb-4">检测到多个工作表，请选择要导入的工作表：</p>
              <div className="space-y-2">
                {Array.from(sheetDataMap.entries()).map(([sheetName, data]) => {
                  return (
                    <div
                      key={sheetName}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedSheet === sheetName
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedSheet(sheetName)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-slate-400" />
                          <div>
                            <p className="font-medium">{sheetName}</p>
                            <p className="text-sm text-slate-500">{data.length} 条数据</p>
                          </div>
                        </div>
                        {selectedSheet === sheetName && (
                          <CheckCircle className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                取消
              </Button>
              <Button
                onClick={() => handleSelectSheet(selectedSheet)}
                disabled={!selectedSheet}
              >
                下一步
              </Button>
            </div>
          </div>
        )}

        {step === 'warning' && (
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
                <AlertCircle className="h-5 w-5" />
                购方识别号与账套税号不一致
              </div>
              <p className="text-yellow-700 text-sm mb-2">
                以下发票的购方识别号与当前账套的税号不一致，请确认文件是否正确：
              </p>
              <div className="max-h-48 overflow-y-auto text-sm text-yellow-700 bg-yellow-100 rounded p-2">
                {mismatchDetails.map((detail, idx) => (
                  <div key={idx}>{detail}</div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                取消导入
              </Button>
              <Button onClick={handleContinueAnyway}>
                确认继续导入
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && (() => {
          const { grouped, originalCount } = groupInvoices(previewData);
          const groupedArray = Array.from(grouped.values());
          // 计算合计
          const totalAmount = groupedArray.reduce((sum, inv) => sum + (inv.amount || 0), 0);
          const totalTaxAmount = groupedArray.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0);
          const totalWithTax = groupedArray.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
          return (
            <div className="py-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">
                    汇总后 <span className="font-semibold text-blue-600">{groupedArray.length}</span> 条发票
                  </span>
                  {originalCount !== groupedArray.length && (
                    <span className="text-sm text-slate-400">
                      （原始 {originalCount} 行）
                    </span>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep(sheetDataMap.size > 1 ? 'selectSheet' : 'upload')}>
                  {sheetDataMap.size > 1 ? '重新选择工作表' : '重新选择'}
                </Button>
              </div>
              <div className="border rounded-lg overflow-auto max-h-96">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">
                        <Checkbox
                          checked={previewSelectedIds.size === groupedArray.length && groupedArray.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setPreviewSelectedIds(new Set(groupedArray.map((_, idx) => String(idx))));
                            } else {
                              setPreviewSelectedIds(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">发票号码</th>
                      <th className="px-3 py-2 text-left">日期</th>
                      <th className="px-3 py-2 text-left">销售方</th>
                      <th className="px-3 py-2 text-right">金额</th>
                      <th className="px-3 py-2 text-right">税额</th>
                      <th className="px-3 py-2 text-right">含税金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedArray.slice(0, 50).map((inv, idx) => (
                      <tr key={idx} className={`border-t ${previewSelectedIds.has(String(idx)) ? 'bg-blue-50' : ''}`}>
                        <td className="px-3 py-2 text-center">
                          <Checkbox
                            checked={previewSelectedIds.has(String(idx))}
                            onCheckedChange={(checked) => {
                              const newSet = new Set(previewSelectedIds);
                              if (checked) {
                                newSet.add(String(idx));
                              } else {
                                newSet.delete(String(idx));
                              }
                              setPreviewSelectedIds(newSet);
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                            <div className="font-mono text-xs">{inv.invoiceCode}</div>
                            {inv.digitalInvoiceNo && <div className="font-mono text-xs text-slate-400 mt-0.5">{inv.digitalInvoiceNo}</div>}
                          </td>
                        <td className="px-3 py-2">{inv.invoiceDate}</td>
                        <td className="px-3 py-2">{inv.sellerName}</td>
                        <td className="px-3 py-2 text-right">{inv.amount?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{inv.taxAmount?.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right">{inv.totalAmount?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-medium">
                    <tr className="border-t-2 border-slate-300">
                      <td className="px-3 py-2 text-center">
                        {previewSelectedIds.size > 0 ? `${previewSelectedIds.size}/${groupedArray.length}` : groupedArray.length}
                      </td>
                      <td className="px-3 py-2" colSpan={4}>
                        {previewSelectedIds.size > 0 ? '已选合计' : '全部合计'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        ¥{(previewSelectedIds.size > 0
                          ? groupedArray.filter((_, idx) => previewSelectedIds.has(String(idx))).reduce((sum, inv) => sum + (inv.amount || 0), 0)
                          : totalAmount
                        ).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        ¥{(previewSelectedIds.size > 0
                          ? groupedArray.filter((_, idx) => previewSelectedIds.has(String(idx))).reduce((sum, inv) => sum + (inv.taxAmount || 0), 0)
                          : totalTaxAmount
                        ).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold">
                        ¥{(previewSelectedIds.size > 0
                          ? groupedArray.filter((_, idx) => previewSelectedIds.has(String(idx))).reduce((sum, inv) => sum + (inv.totalAmount || 0), 0)
                          : totalWithTax
                        ).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {groupedArray.length > 50 && (
                  <div className="p-2 text-center text-slate-500 text-sm">
                    仅显示前50条，共 {groupedArray.length} 条
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <DialogFooter className="flex items-center gap-4">
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          {step === 'preview' && (
            <Button onClick={handleConfirmImport} disabled={importing}>
              {importing ? '导入中...' : '确认导入'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// 费用清单Tab组件
function ExpenseListTab() {
  const { showToast } = useToast();
  const accountSetId = useAccountSetStore((state) => state.currentAccountSetId);

  const [records, setRecords] = useState<ExpenseReimbursement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    if (accountSetId) loadRecords();
  }, [accountSetId]);

  const loadRecords = async () => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      const data = await sqliteService.getExpenseReimbursements();
      setRecords(data);
    } catch (e) {
      console.error('加载费用清单失败:', e);
    }
  };

  const filteredRecords = records.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.invoiceCode?.toLowerCase().includes(q) || r.reimburserName?.toLowerCase().includes(q);
  });

  const handleDelete = async (id: string) => {
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.deleteExpenseReimbursement(id);
      await loadRecords();
      showToast('success', '记录已删除');
    } catch (e) {
      showToast('error', '删除失败');
    }
  };

  const handleClearAll = async () => {
    if (records.length === 0) return;
    try {
      sqliteService.setAccountSetId(accountSetId!);
      await sqliteService.clearExpenseReimbursements();
      await loadRecords();
      showToast('success', '所有记录已清除');
    } catch (e) {
      showToast('error', '清除失败');
    }
  };

  const handleImportComplete = () => {
    loadRecords();
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-3.5 w-3.5 mr-1" /> 导入清单
          </Button>
          {records.length > 0 && (
            <Button variant="outline" size="sm" className="text-red-500 hover:text-red-700" onClick={handleClearAll}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> 清空全部
            </Button>
          )}
        </div>
        <span className="text-xs text-slate-400">共 {records.length} 条记录</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="搜索发票号码或报销人..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">发票号码</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">报销人</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">备注</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">导入时间</th>
              <th className="px-3 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-slate-400 text-xs">
                  {records.length === 0 ? '暂无记录，请导入费用清单' : '无匹配记录'}
                </td>
              </tr>
            ) : (
              filteredRecords.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-sm font-mono">{r.invoiceCode || '-'}</td>
                  <td className="px-3 py-2 text-sm">{r.reimburserName || '-'}</td>
                  <td className="px-3 py-2 text-xs text-slate-500 truncate max-w-[200px]">{r.notes || '-'}</td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {r.createTime ? new Date(r.createTime).toLocaleString('zh-CN') : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Import dialog */}
      <ExpenseListImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}

export default function InputInvoicePage() {
  const { showToast } = useToast();
  const {
    invoices,
    loading,
    initialize,
    setFilter,
    getFilteredInvoices,
    importInvoicesFromExcel,
    generateInvoiceVoucher,
    updateInvoice,
    deleteInvoices,
    generateInvoiceVouchers,
  } = useInvoiceStore();

  // 获取当年日期范围（默认显示全年，避免过滤掉非当月发票）
  const getCurrentYearRange = () => {
    const year = new Date().getFullYear();
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  };
  const getCurrentMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // 当月最后一天
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSubjectConfig, setShowSubjectConfig] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [businessGroupNames, setBusinessGroupNames] = useState<string[]>([]);

  useEffect(() => {
    sqliteService.getPurchaseInvoiceRuleConfig().then(config => {
      const names = (config?.businessGroups || []).map(g => g.name);
      setBusinessGroupNames(names);
    }).catch(() => {});
  }, []);

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(tabFilteredInvoices.map(inv => inv.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 单选
  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const currentAccountSetId = useAccountSetStore((state) => state.currentAccountSetId);
  const { getCurrentAccountSet } = useAccountSetStore();
  const currentAccountSet = getCurrentAccountSet();
  const accountSetTaxNo = currentAccountSet?.taxNo;

  // 初始化
  useEffect(() => {
    if (currentAccountSetId) {
      initialize();
    }
  }, [currentAccountSetId, initialize]);

  // 设置筛选条件
  useEffect(() => {
    setFilter({
      invoiceType: 'input',
      searchQuery,
      startDate: dateRange.start,
      endDate: dateRange.end,
      paymentStatus: paymentStatusFilter !== 'all' ? paymentStatusFilter as InvoicePaymentStatus : undefined,
      hasVoucher: voucherStatusFilter !== 'all' ? voucherStatusFilter === 'yes' : undefined,
    });
  }, [searchQuery, dateRange, paymentStatusFilter, voucherStatusFilter, setFilter]);

  const filteredInvoices = getFilteredInvoices();

  // 根据tab过滤发票
  const tabFilteredInvoices = (() => {
    switch (activeTab) {
      case 'pending':
        return filteredInvoices.filter(inv => inv.holdStatus !== 'on_hold' && !inv.voucherId);
      case 'vouchered':
        return filteredInvoices.filter(inv => !!inv.voucherId);
      case 'onhold':
        return filteredInvoices.filter(inv => inv.holdStatus === 'on_hold');
      case 'expenses':
        // 费用清单tab不显示发票，返回空数组
        return [];
      default:
        return filteredInvoices;
    }
  })();

  // 选中行的统计（基于当前tab可见的发票）
  const selectedInvoices = tabFilteredInvoices.filter(inv => selectedIds.has(inv.id));
  const selectedStats = {
    count: selectedInvoices.length,
    amount: selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0),
    taxAmount: selectedInvoices.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0),
    totalAmount: selectedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
  };

  // 处理导入
  const handleImport = async (invoicesData: Partial<Invoice>[]) => {
    return await importInvoicesFromExcel(invoicesData, 'input');
  };

  // 单个删除
  const handleDelete = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice?.voucherId) {
      showToast('warning', '该发票已生成凭证，不能删除。如需删除请先冲销关联凭证。');
      return;
    }
    const confirmed = window.confirm('确定要删除这条发票吗？');
    if (!confirmed) return;

    try {
      const result = await deleteInvoices([invoiceId]);
      showToast('success', '发票已删除');
    } catch (error) {
      console.error('删除失败:', error);
      showToast('error', '删除失败');
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedInvoices.length === 0) return;

    // 过滤掉已生成凭证的发票
    const voucheredIds = selectedInvoices.filter(inv => inv.voucherId).map(inv => inv.id);
    const deletableIds = Array.from(selectedIds).filter(id => !voucheredIds.includes(id));

    if (deletableIds.length === 0) {
      showToast('warning', '选中的发票均已生成凭证，不能删除。');
      return;
    }

    if (voucheredIds.length > 0) {
      showToast('info', `${voucheredIds.length} 条已生成凭证的发票已自动跳过`);
    }

    const confirmed = window.confirm(`确定要删除选中的 ${deletableIds.length} 条发票吗？`);
    if (!confirmed) return;

    try {
      const result = await deleteInvoices(deletableIds);
      showToast('success', `成功删除 ${result.success} 条发票`);
      if (result.errors.length > 0) {
        showToast('error', `删除失败 ${result.errors.length} 条发票`);
        console.error('删除失败:', result.errors);
      }
      setSelectedIds(new Set());
    } catch (error) {
      console.error('批量删除失败:', error);
      showToast('error', '批量删除失败');
    }
  };

  // 批量生成凭证
  const handleBatchGenerateVoucher = async () => {
    if (selectedInvoices.length === 0) return;

    // 过滤掉暂不入账和已生成凭证的发票
    const validIds = Array.from(selectedIds).filter(id => {
      const inv = invoices.find(i => i.id === id);
      return inv && inv.holdStatus !== 'on_hold' && !inv.voucherId;
    });

    if (validIds.length === 0) {
      showToast('warning', '选中的发票均已暂不入账或已生成凭证，无法批量生成');
      return;
    }

    const onHoldCount = selectedInvoices.length - validIds.length;
    const message = onHoldCount > 0
      ? `确定要为 ${validIds.length} 条发票生成凭证吗？（${onHoldCount} 条暂不入账的发票已排除）`
      : `确定要为选中的 ${validIds.length} 条发票生成凭证吗？`;

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    try {
      const voucherDate = new Date().toISOString().split('T')[0];
      const result = await generateInvoiceVouchers(validIds, voucherDate);
      showToast('success', `成功生成 ${result.success} 条凭证`);
      if (result.errors.length > 0) {
        showToast('error', `生成失败 ${result.errors.length} 条凭证`);
        console.error('生成失败:', result.errors);
      }
    } catch (error) {
      console.error('批量生成凭证失败:', error);
      showToast('error', '批量生成凭证失败');
    }
  };

  // 生成凭证
  const handleGenerateVoucher = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const result = await generateInvoiceVoucher(invoiceId, invoice.invoiceDate);
    if (result) {
      showToast('success', `凭证 ${result.voucherNo} 已生成`);
    } else {
      const error = useInvoiceStore.getState().error;
      showToast('error', error || '生成凭证失败');
    }
  };

  // 暂不入账
  const handleHoldInvoice = async (invoiceId: string) => {
    try {
      await sqliteService.updateInvoiceHoldStatus(invoiceId, 'on_hold');
      await initialize();
      showToast('info', '已标记为暂不入账');
    } catch (error) {
      console.error('操作失败:', error);
      showToast('error', '操作失败');
    }
  };

  // 恢复到待选
  const handleRestoreInvoice = async (invoiceId: string) => {
    try {
      await sqliteService.updateInvoiceHoldStatus(invoiceId, 'normal');
      await initialize();
      showToast('info', '已恢复到待选');
    } catch (error) {
      console.error('操作失败:', error);
      showToast('error', '操作失败');
    }
  };
  // 详细统计数据
  const getInvoiceStats = (invoiceList: Invoice[]) => {
    const count = invoiceList.length;
    const amount = invoiceList.reduce((sum, inv) => sum + inv.amount, 0);
    const taxAmount = invoiceList.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0);
    const totalAmount = invoiceList.reduce((sum, inv) => sum + inv.totalAmount, 0);
    return { count, amount, taxAmount, totalAmount };
  };

  // 已入账统计
  const voucheredInvoices = filteredInvoices.filter(inv => !!inv.voucherId);
  const voucheredStats = getInvoiceStats(voucheredInvoices);

  // 待生成凭证统计
  const pendingInvoices = filteredInvoices.filter(inv => inv.holdStatus !== 'on_hold' && !inv.voucherId);
  const pendingStats = getInvoiceStats(pendingInvoices);

  // 暂不入账统计
  const onHoldInvoices = filteredInvoices.filter(inv => inv.holdStatus === 'on_hold');
  const onHoldStats = getInvoiceStats(onHoldInvoices);

  // 本月合计统计（基于全部发票）
  const thisMonthInvoices = invoices.filter(inv => {
    if (!inv.invoiceDate) return false;
    const now = new Date();
    const invDate = new Date(inv.invoiceDate);
    return invDate.getFullYear() === now.getFullYear() && invDate.getMonth() === now.getMonth();
  });
  const thisMonthStats = getInvoiceStats(thisMonthInvoices);

  // 全部分类统计
  const filteredStats = getInvoiceStats(filteredInvoices);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            进项发票
          </h1>
          <p className="text-slate-500 mt-1">管理采购发票，生成进项税凭证</p>
        </div>
        <div className="flex gap-2">
          {selectedInvoices.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleBatchDelete()}
                disabled={selectedInvoices.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                批量删除
              </Button>
              <Button
                variant="outline"
                onClick={() => handleBatchGenerateVoucher()}
                disabled={selectedInvoices.length === 0}
              >
                <Calculator className="h-4 w-4 mr-2" />
                批量生成凭证
              </Button>
            </>
          )}
          <Button onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            导入Excel
          </Button>
          <Button variant="outline" onClick={() => setShowSubjectConfig(true)}>
            <Settings2 className="h-4 w-4 mr-2" />
            智能规则
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">已入账</p>
                <p className="text-xl font-bold text-green-600">{voucheredStats.count} 条</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div>
                    <p className="text-slate-400">不含税</p>
                    <p className="text-slate-700 font-medium">¥{voucheredStats.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">税额</p>
                    <p className="text-slate-700 font-medium">¥{voucheredStats.taxAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">含税</p>
                    <p className="text-slate-700 font-medium">¥{voucheredStats.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">待生成凭证</p>
                <p className="text-xl font-bold text-blue-600">{pendingStats.count} 条</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div>
                    <p className="text-slate-400">不含税</p>
                    <p className="text-slate-700 font-medium">¥{pendingStats.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">税额</p>
                    <p className="text-slate-700 font-medium">¥{pendingStats.taxAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">含税</p>
                    <p className="text-slate-700 font-medium">¥{pendingStats.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <PauseCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">暂不入账</p>
                <p className="text-xl font-bold text-orange-600">{onHoldStats.count} 条</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div>
                    <p className="text-slate-400">不含税</p>
                    <p className="text-slate-700 font-medium">¥{onHoldStats.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">税额</p>
                    <p className="text-slate-700 font-medium">¥{onHoldStats.taxAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">含税</p>
                    <p className="text-slate-700 font-medium">¥{onHoldStats.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">本月合计</p>
                <p className="text-xl font-bold text-slate-700">{thisMonthStats.count} 条</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                  <div>
                    <p className="text-slate-400">不含税</p>
                    <p className="text-slate-700 font-medium">¥{thisMonthStats.amount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">税额</p>
                    <p className="text-slate-700 font-medium">¥{thisMonthStats.taxAmount.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">含税</p>
                    <p className="text-slate-700 font-medium">¥{thisMonthStats.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">共 {filteredStats.count} 条筛选结果</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选栏 */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索发票号、销售方、商品名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">日期</span>
              <ChineseDatePicker
                value={dateRange.start}
                onChange={(v) => setDateRange(prev => ({ ...prev, start: v }))}
                className="w-36"
              />
              <span className="text-slate-400">~</span>
              <ChineseDatePicker
                value={dateRange.end}
                onChange={(v) => setDateRange(prev => ({ ...prev, end: v }))}
                className="w-36"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange(getCurrentMonthRange())}
                className="text-blue-600"
              >
                本月
              </Button>
            </div>
            <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="付款状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="unpaid">未付款</SelectItem>
                <SelectItem value="partial">部分付款</SelectItem>
                <SelectItem value="paid">已付款</SelectItem>
              </SelectContent>
            </Select>
            <Select value={voucherStatusFilter} onValueChange={setVoucherStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="凭证状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="no">未生成凭证</SelectItem>
                <SelectItem value="yes">已生成凭证</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 发票列表 */}
      <Tabs value={activeTab} onValueChange={(v) => {
        // 只有在切换到发票相关的tab时才清除选中状态，费用清单tab不影响
        if (['all', 'pending', 'vouchered', 'onhold'].includes(v) && ['expenses'].includes(activeTab)) {
          setActiveTab(v);
          setSelectedIds(new Set());
        } else if (['expenses'].includes(v) && ['all', 'pending', 'vouchered', 'onhold'].includes(activeTab)) {
          setActiveTab(v);
          // 保留选中状态，以便切换回发票tab时仍能看到选中的内容
        } else {
          setActiveTab(v);
          setSelectedIds(new Set());
        }
      }} className="flex flex-col">
        <TabsList>
          <TabsTrigger value="all" className="flex-1">全部({filteredStats.count})</TabsTrigger>
          <TabsTrigger value="pending" className="flex-1">待生成({pendingStats.count})</TabsTrigger>
          <TabsTrigger value="vouchered" className="flex-1">已入账({voucheredStats.count})</TabsTrigger>
          <TabsTrigger value="onhold" className="flex-1">暂不入账({onHoldStats.count})</TabsTrigger>
          <TabsTrigger value="expenses" className="flex-1">费用清单</TabsTrigger>
        </TabsList>

        {/* 发票列表内容 */}
        {['all', 'pending', 'vouchered', 'onhold'].includes(activeTab) && (
          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-center text-sm font-medium text-slate-500 w-12">
                          <Checkbox
                            checked={tabFilteredInvoices.length > 0 && selectedIds.size === tabFilteredInvoices.length}
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">发票号码</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">日期</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">销售方</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">商品/服务</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">金额</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">税额</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">含税金额</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">付款状态</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">凭证</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">业务组</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                            加载中...
                          </td>
                        </tr>
                      ) : tabFilteredInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="px-4 py-8 text-center text-slate-500">
                            {activeTab === 'onhold' ? '暂无暂不入账的发票' : activeTab === 'vouchered' ? '暂无已入账的发票' : activeTab === 'pending' ? '暂无待生成凭证的发票' : '暂无发票数据，请导入税务局Excel'}
                          </td>
                        </tr>
                      ) : (
                        tabFilteredInvoices.map((invoice) => (
                          <tr key={invoice.id} className={`border-t hover:bg-slate-50 ${selectedIds.has(invoice.id) ? 'bg-blue-50' : ''} ${invoice.holdStatus === 'on_hold' ? 'bg-orange-50/50' : ''}`}>
                            <td className="px-4 py-3 text-center">
                              <Checkbox
                                checked={selectedIds.has(invoice.id)}
                                onCheckedChange={(checked) => handleSelectOne(invoice.id, checked)}
                              />
                            </td>
                            <td className="px-4 py-3 font-medium font-mono text-sm">
                            <div>{invoice.invoiceCode}</div>
                            {invoice.digitalInvoiceNo && <div className="text-slate-400 text-xs mt-0.5">{invoice.digitalInvoiceNo}</div>}
                          </td>
                            <td className="px-4 py-3">{invoice.invoiceDate ? invoice.invoiceDate.substring(0, 10) : ''}</td>
                            <td className="px-4 py-3">{invoice.sellerName}</td>
                            <td className="px-4 py-3">{invoice.goodsName || '-'}</td>
                            <td className="px-4 py-3 text-right">¥{invoice.amount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-right">¥{invoice.taxAmount?.toFixed(2) || '-'}</td>
                            <td className="px-4 py-3 text-right font-medium">¥{invoice.totalAmount.toFixed(2)}</td>
                            <td className="px-4 py-3 text-center">
                              <PaymentStatusBadge status={invoice.paymentStatus} />
                            </td>
                            <td className="px-4 py-3 text-center">
                              {invoice.voucherNo ? (
                                <Badge variant="outline" className="bg-green-100 text-green-800">
                                  {invoice.voucherNo}
                                </Badge>
                              ) : invoice.holdStatus === 'on_hold' ? (
                                <Badge variant="outline" className="bg-orange-100 text-orange-600">
                                  暂不入账
                                </Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Select
                                value={invoice.groupName || '__default__'}
                                onValueChange={async (v) => {
                                  const newName = v === '__default__' ? '' : v;
                                  updateInvoice(invoice.id, { groupName: newName });
                                  // Auto-learn: save sellerName → groupName mapping
                                  if (newName && invoice.sellerName) {
                                    try {
                                      const existing = await sqliteService.getSupplierMappingBySellerName(invoice.sellerName);
                                      if (!existing || existing.groupName !== newName) {
                                        await sqliteService.saveSupplierMapping({
                                          id: existing?.id || generateId(),
                                          accountSetId: sqliteService.accountSetId,
                                          groupName: newName,
                                          sellerName: invoice.sellerName,
                                          createTime: existing?.createTime || new Date().toISOString(),
                                          updateTime: new Date().toISOString(),
                                        });
                                      }
                                      // Check if business group requires partner card
                                      const config = await sqliteService.getPurchaseInvoiceRuleConfig();
                                      const group = config?.businessGroups?.find((g: any) => g.name === newName);
                                      const requireCard = group?.requirePartnerCard !== false;
                                      if (requireCard) {
                                        const existingPartner = await sqliteService.getPartnerByName(invoice.sellerName);
                                        if (!existingPartner) {
                                          await sqliteService.addPartner({
                                            id: generateId(),
                                            name: invoice.sellerName,
                                            code: `P${Date.now().toString(36)}`,
                                            type: 'supplier',
                                            isSupplier: true,
                                            isCustomer: false,
                                            phone: '',
                                            email: '',
                                            address: '',
                                            bankAccount: '',
                                            taxNo: '',
                                            remark: '发票自动学习创建',
                                            createTime: new Date().toISOString(),
                                            updateTime: new Date().toISOString(),
                                          });
                                          showToast('info', `已自动学习：${invoice.sellerName} → ${newName}，并创建往来卡片`);
                                        } else {
                                          showToast('info', `已自动学习：${invoice.sellerName} → ${newName}`);
                                        }
                                      } else {
                                        showToast('info', `已自动学习：${invoice.sellerName} → ${newName}`);
                                      }
                                    } catch {}
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 w-24 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__default__">默认</SelectItem>
                                  {businessGroupNames.map(name => (
                                    <SelectItem key={name} value={name}>{name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedInvoice(invoice);
                                    setShowDetailDialog(true);
                                  }}
                                >
                                  查看
                                </Button>
                                {!invoice.voucherId && invoice.holdStatus !== 'on_hold' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleGenerateVoucher(invoice.id)}
                                  >
                                    生成凭证
                                  </Button>
                                )}
                                {!invoice.voucherId && invoice.holdStatus !== 'on_hold' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-orange-600 hover:text-orange-700"
                                    onClick={() => handleHoldInvoice(invoice.id)}
                                  >
                                    <PauseCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                {invoice.holdStatus === 'on_hold' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:text-blue-700"
                                    onClick={() => handleRestoreInvoice(invoice.id)}
                                  >
                                    <PlayCircle className="h-4 w-4 mr-1" />
                                    恢复
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={!!invoice.voucherId}
                                  className={invoice.voucherId ? 'opacity-40' : ''}
                                  onClick={() => handleDelete(invoice.id)}
                                >
                                  <Trash2 className={`h-4 w-4 ${invoice.voucherId ? 'text-slate-400' : 'text-red-500'}`} />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {tabFilteredInvoices.length > 0 && (
                      <tfoot className="bg-slate-100 font-medium">
                        <tr className="border-t-2 border-slate-300">
                          <td className="px-4 py-3 text-center">
                            {selectedInvoices.length > 0 ? `${selectedInvoices.length}/${tabFilteredInvoices.length}` : tabFilteredInvoices.length}
                          </td>
                          <td className="px-4 py-3" colSpan={5}>
                            {selectedInvoices.length > 0 ? '已选合计' : '全部合计'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            ¥{(selectedInvoices.length > 0 ? selectedStats.amount : filteredStats.amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            ¥{(selectedInvoices.length > 0 ? selectedStats.taxAmount : filteredStats.taxAmount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            ¥{(selectedInvoices.length > 0 ? selectedStats.totalAmount : filteredStats.totalAmount).toFixed(2)}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                  )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* 费用清单内容 */}
        <TabsContent value="expenses" className="mt-4">
          <ExpenseListTab />
        </TabsContent>
      </Tabs>

      {/* 导入对话框 */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
        accountSetTaxNo={accountSetTaxNo}
      />

      {/* 智能规则配置 */}
      <InvoiceSmartRuleDialog
        open={showSubjectConfig}
        onOpenChange={setShowSubjectConfig}
        invoiceType="input"
      />


      {/* 详情对话框 */}
      <InvoiceDetailDialog
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        invoice={selectedInvoice}
        onGenerateVoucher={handleGenerateVoucher}
      />
    </div>
  );
}
