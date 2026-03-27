'use client';

import { useState, useEffect } from 'react';
import { useInvoiceStore } from '@/stores/useInvoiceStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Download,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Invoice, InvoicePaymentStatus } from '@/types';
import * as XLSX from 'xlsx';

// 收款状态Badge
function PaymentStatusBadge({ status }: { status: InvoicePaymentStatus }) {
  const config = {
    unpaid: { label: '未收款', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
    partial: { label: '部分收款', className: 'bg-blue-100 text-blue-800', icon: AlertCircle },
    paid: { label: '已收款', className: 'bg-green-100 text-green-800', icon: CheckCircle },
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
            销项发票详情
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-500">发票号码</Label>
              <p className="font-medium">{invoice.invoiceCode}</p>
            </div>
            <div>
              <Label className="text-slate-500">数电发票号码</Label>
              <p className="font-medium">{invoice.digitalInvoiceNo || '-'}</p>
            </div>
            <div>
              <Label className="text-slate-500">开票日期</Label>
              <p className="font-medium">{invoice.invoiceDate}</p>
            </div>
          </div>

          {/* 购买方信息 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-slate-700">购买方信息</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500">名称</Label>
                <p className="font-medium">{invoice.buyerName}</p>
              </div>
              <div>
                <Label className="text-slate-500">税号</Label>
                <p className="font-medium">{invoice.buyerTaxNo || '-'}</p>
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

          {/* 收款状态 */}
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2 text-slate-700">收款状态</h4>
            <div className="flex items-center gap-4">
              <PaymentStatusBadge status={invoice.paymentStatus} />
              <span className="text-slate-500">
                已收: ¥{invoice.paidAmount.toFixed(2)} / 剩余: ¥{(invoice.totalAmount - invoice.paidAmount).toFixed(2)}
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (invoices: Partial<Invoice>[]) => Promise<{ success: number; errors: string[] }>;
}) {
  const { showToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<Partial<Invoice>[]>([]);
  const [step, setStep] = useState<'upload' | 'selectSheet' | 'preview'>('upload');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetDataMap, setSheetDataMap] = useState<Map<string, Partial<Invoice>[]>>(new Map());
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());

  // 对话框打开/关闭时重置状态
  useEffect(() => {
    if (!open) {
      setPreviewData([]);
      setStep('upload');
      setImporting(false);
      setWorkbook(null);
      setSelectedSheet('');
      setSheetDataMap(new Map());
      setPreviewSelectedIds(new Set());
    }
  }, [open]);

  // 解析单个sheet的数据
  const parseSheetData = (worksheet: XLSX.WorkSheet): Partial<Invoice>[] => {
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData.map((row: any) => {
      // 发票字段读取 - 确保转为字符串并去除空格
      const rawInvoiceCode = String(row['发票代码'] || '').trim();
      const rawInvoiceNumber = String(row['发票号码'] || '').trim();
      const rawDigitalNo = String(row['数电发票号码'] || row['全电发票号码'] || row['电子发票号码'] || '').trim();

      // 判断是否为有效的数电发票号码（20位数字）
      const isValidDigitalNo = /^\d{20}$/.test(rawDigitalNo);

      let invoiceCode = '';
      let digitalInvoiceNo = '';

      if (isValidDigitalNo) {
        // 数电发票：数电发票号码是20位数字
        invoiceCode = rawInvoiceNumber || rawInvoiceCode || '';
        digitalInvoiceNo = rawDigitalNo;
      } else {
        // 传统发票：数电发票号码为空、"--"或其他非20位数字
        invoiceCode = rawInvoiceNumber || rawInvoiceCode || '';
        digitalInvoiceNo = ''; // 不保存无效的数电发票号码
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
        sellerTaxNo: String(row['销方税号'] || row['销售方纳税人识别号'] || '').trim(),
        buyerName: String(row['购方名称'] || row['购买方名称'] || '').trim(),
        buyerTaxNo: String(row['购方税号'] || row['购买方纳税人识别号'] || '').trim(),
        goodsName: String(row['货物或应税劳务名称'] || row['商品名称'] || '').trim(),
        specification: String(row['规格型号'] || '').trim(),
        unit: String(row['单位'] || '').trim(),
        quantity: parseAmount(row['数量']),
        unitPrice: parseAmount(row['单价']),
        amount: parseAmount(row['金额'] || row['不含税金额']),
        taxRate: parseAmount(row['税率']) / 100 || 0.13,
        taxAmount: parseAmount(row['税额']),
        totalAmount: parseAmount(row['价税合计'] || row['合计金额']),
        partnerName: String(row['购方名称'] || row['购买方名称'] || '').trim(),
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 立即重置input的值，允许再次选择同一个文件
    e.target.value = '';

    const processFile = async () => {
      try {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data);
        setWorkbook(wb);

        // 解析所有sheet的数据
        const dataMap = new Map<string, Partial<Invoice>[]>();
        wb.SheetNames.forEach(name => {
          const worksheet = wb.Sheets[name];
          const sheetData = parseSheetData(worksheet);
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
          setPreviewData(dataMap.get(sheetName) || []);
          setStep('preview');
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

    processFile();
  };

  // 按发票号码+数电发票号码分组汇总数据
  // 按发票号码+数电发票号码分组汇总数据
  const groupInvoices = (invoices: Partial<Invoice>[]): { grouped: Map<string, Partial<Invoice>>, originalCount: number } => {
    const grouped = new Map<string, Partial<Invoice>>();
    const countMap = new Map<string, { amount: number; taxAmount: number; totalAmount: number; quantity: number; goodsNames: string[] }>();

    for (const inv of invoices) {
      // 按"发票号码 + 数电发票号码"组合作为唯一键
      const key = `${inv.invoiceCode || ''}|||${inv.digitalInvoiceNo || ''}`;

      if (grouped.has(key)) {
        const counts = countMap.get(key)!;
        counts.amount += inv.amount || 0;
        counts.taxAmount += inv.taxAmount || 0;
        counts.totalAmount += inv.totalAmount || 0;
        counts.quantity += inv.quantity || 0;
        if (inv.goodsName && !counts.goodsNames.includes(inv.goodsName)) {
          counts.goodsNames.push(inv.goodsName);
        }
      } else {
        grouped.set(key, inv);
        countMap.set(key, {
          amount: inv.amount || 0,
          taxAmount: inv.taxAmount || 0,
          totalAmount: inv.totalAmount || 0,
          quantity: inv.quantity || 0,
          goodsNames: inv.goodsName ? [inv.goodsName] : [],
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
    }

    return { grouped, originalCount: invoices.length };
  };

  // 选择sheet后处理
  const handleSelectSheet = (sheetName: string) => {
    setSelectedSheet(sheetName);
    setPreviewData(sheetDataMap.get(sheetName) || []);
    setStep('preview');
  };

  const handleImport = async () => {
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
    setWorkbook(null);
    setSelectedSheet('');
    setSheetDataMap(new Map());
    setPreviewSelectedIds(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>导入销项发票</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="py-8">
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 mb-4">选择税务局导出的Excel文件</p>
              <div className="flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('output-invoice-file-input')?.click()}
                >
                  选择文件
                </Button>
                <span className="text-sm text-slate-500">
                  支持 .xlsx, .xls 格式
                </span>
              </div>
              <Input
                id="output-invoice-file-input"
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
                {Array.from(sheetDataMap.entries()).map(([sheetName, data]) => (
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
                ))}
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
                      <th className="px-3 py-2 text-left">数电发票号码</th>
                      <th className="px-3 py-2 text-left">日期</th>
                      <th className="px-3 py-2 text-left">购买方</th>
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
                        <td className="px-3 py-2">{inv.invoiceCode}</td>
                        <td className="px-3 py-2 text-slate-500">{inv.digitalInvoiceNo || '-'}</td>
                        <td className="px-3 py-2">{inv.invoiceDate}</td>
                        <td className="px-3 py-2">{inv.buyerName}</td>
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

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          {step === 'preview' && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? '导入中...' : '确认导入'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function OutputInvoicePage() {
  const { showToast } = useToast();
  const {
    invoices,
    loading,
    initialize,
    setFilter,
    getFilteredInvoices,
    importInvoicesFromExcel,
    generateInvoiceVoucher,
  } = useInvoiceStore();

  // 获取当月日期范围
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
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => getCurrentMonthRange());
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredInvoices.map(inv => inv.id)));
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

  // 初始化
  useEffect(() => {
    if (currentAccountSetId) {
      initialize();
    }
  }, [currentAccountSetId, initialize]);

  // 设置筛选条件
  useEffect(() => {
    setFilter({
      invoiceType: 'output',
      searchQuery,
      startDate: dateRange.start,
      endDate: dateRange.end,
      paymentStatus: paymentStatusFilter !== 'all' ? paymentStatusFilter as InvoicePaymentStatus : undefined,
      hasVoucher: voucherStatusFilter !== 'all' ? voucherStatusFilter === 'yes' : undefined,
    });
  }, [searchQuery, dateRange, paymentStatusFilter, voucherStatusFilter, setFilter]);

  const filteredInvoices = getFilteredInvoices();

  // 处理导入
  const handleImport = async (invoicesData: Partial<Invoice>[]) => {
    return await importInvoicesFromExcel(invoicesData, 'output');
  };

  // 生成凭证
  const handleGenerateVoucher = async (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const result = await generateInvoiceVoucher(invoiceId, invoice.invoiceDate);
    if (result) {
      showToast('success', `凭证 ${result.voucherNo} 已生成`);
    }
  };

  // 统计数据
  const stats = {
    total: filteredInvoices.length,
    totalAmount: filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    amount: filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0),
    taxAmount: filteredInvoices.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0),
    unpaidCount: filteredInvoices.filter(inv => inv.paymentStatus === 'unpaid').length,
    unpaidAmount: filteredInvoices
      .filter(inv => inv.paymentStatus === 'unpaid')
      .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
    noVoucherCount: filteredInvoices.filter(inv => !inv.voucherId).length,
  };

  // 选中行的统计
  const selectedInvoices = filteredInvoices.filter(inv => selectedIds.has(inv.id));
  const selectedStats = {
    count: selectedInvoices.length,
    amount: selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0),
    taxAmount: selectedInvoices.reduce((sum, inv) => sum + (inv.taxAmount || 0), 0),
    totalAmount: selectedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            销项发票
          </h1>
          <p className="text-slate-500 mt-1">管理销售发票，生成销项税凭证</p>
        </div>
        <Button onClick={() => setShowImportDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          导入Excel
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">发票数量</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">发票总额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{stats.totalAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">金额合计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-700">¥{stats.amount.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">税额合计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">¥{stats.taxAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">待收款</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.unpaidCount}</div>
            <div className="text-sm text-slate-500">¥{stats.unpaidAmount.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">待生成凭证</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.noVoucherCount}</div>
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
                placeholder="搜索发票号、购买方、商品名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">日期</span>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-36"
              />
              <span className="text-slate-400">~</span>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
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
                <SelectValue placeholder="收款状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="unpaid">未收款</SelectItem>
                <SelectItem value="partial">部分收款</SelectItem>
                <SelectItem value="paid">已收款</SelectItem>
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
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500 w-12">
                    <Checkbox
                      checked={filteredInvoices.length > 0 && selectedIds.size === filteredInvoices.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">发票号码</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">数电发票号码</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">日期</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">购买方</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">商品/服务</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">金额</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">税额</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">含税金额</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">收款状态</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">凭证</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                      暂无发票数据，请导入税务局Excel
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className={`border-t hover:bg-slate-50 ${selectedIds.has(invoice.id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <Checkbox
                          checked={selectedIds.has(invoice.id)}
                          onCheckedChange={(checked) => handleSelectOne(invoice.id, checked)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{invoice.invoiceCode}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{invoice.digitalInvoiceNo || '-'}</td>
                      <td className="px-4 py-3">{invoice.invoiceDate}</td>
                      <td className="px-4 py-3">{invoice.buyerName}</td>
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
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
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
                          {!invoice.voucherId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleGenerateVoucher(invoice.id)}
                            >
                              生成凭证
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredInvoices.length > 0 && (
                <tfoot className="bg-slate-100 font-medium">
                  <tr className="border-t-2 border-slate-300">
                    <td className="px-4 py-3 text-center">
                      {selectedInvoices.length > 0 ? `${selectedInvoices.length}/${filteredInvoices.length}` : filteredInvoices.length}
                    </td>
                    <td className="px-4 py-3" colSpan={5}>
                      {selectedInvoices.length > 0 ? '已选合计' : '全部合计'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ¥{(selectedInvoices.length > 0 ? selectedStats.amount : stats.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ¥{(selectedInvoices.length > 0 ? selectedStats.taxAmount : stats.taxAmount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      ¥{(selectedInvoices.length > 0 ? selectedStats.totalAmount : stats.totalAmount).toFixed(2)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
            )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 导入对话框 */}
      <ImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImport={handleImport}
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
