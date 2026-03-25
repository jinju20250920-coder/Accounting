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
import type { Invoice, InvoicePaymentStatus } from '@/types';
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-500">发票号码</Label>
              <p className="font-medium">{invoice.invoiceCode}</p>
            </div>
            <div>
              <Label className="text-slate-500">开票日期</Label>
              <p className="font-medium">{invoice.invoiceDate}</p>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (invoices: Partial<Invoice>[]) => Promise<{ success: number; errors: string[] }>;
}) {
  const { showToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<Partial<Invoice>[]>([]);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // 映射字段（税务局Excel格式）
      const invoices: Partial<Invoice>[] = jsonData.map((row: any) => ({
        invoiceCode: row['发票号码'] || row['发票代码'] || '',
        invoiceDate: row['开票日期'] || row['日期'] || '',
        sellerName: row['销方名称'] || row['销售方名称'] || '',
        sellerTaxNo: row['销方税号'] || row['销售方纳税人识别号'] || '',
        buyerName: row['购方名称'] || row['购买方名称'] || '',
        buyerTaxNo: row['购方税号'] || row['购买方纳税人识别号'] || '',
        goodsName: row['货物或应税劳务名称'] || row['商品名称'] || '',
        specification: row['规格型号'] || '',
        unit: row['单位'] || '',
        quantity: parseFloat(row['数量']) || 0,
        unitPrice: parseFloat(row['单价']) || 0,
        amount: parseFloat(row['金额'] || row['不含税金额']) || 0,
        taxRate: parseFloat(row['税率']) / 100 || 0.13,
        taxAmount: parseFloat(row['税额']) || 0,
        totalAmount: parseFloat(row['价税合计'] || row['合计金额']) || 0,
        partnerName: row['销方名称'] || row['销售方名称'] || '',
      }));

      setPreviewData(invoices);
      setStep('preview');
    } catch (error) {
      showToast('error', '解析Excel文件失败');
      console.error(error);
    }
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
    } catch (error) {
      showToast('error', '导入失败');
    } finally {
      setImporting(false);
    }
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
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="max-w-sm mx-auto"
              />
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="py-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-slate-600">预览数据 ({previewData.length} 条)</span>
              <Button variant="outline" size="sm" onClick={() => setStep('upload')}>
                重新选择
              </Button>
            </div>
            <div className="border rounded-lg overflow-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">发票号码</th>
                    <th className="px-3 py-2 text-left">日期</th>
                    <th className="px-3 py-2 text-left">销售方</th>
                    <th className="px-3 py-2 text-right">金额</th>
                    <th className="px-3 py-2 text-right">税额</th>
                    <th className="px-3 py-2 text-right">合计</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.slice(0, 50).map((inv, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-3 py-2">{inv.invoiceCode}</td>
                      <td className="px-3 py-2">{inv.invoiceDate}</td>
                      <td className="px-3 py-2">{inv.sellerName}</td>
                      <td className="px-3 py-2 text-right">{inv.amount?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{inv.taxAmount?.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{inv.totalAmount?.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewData.length > 50 && (
                <div className="p-2 text-center text-slate-500 text-sm">
                  仅显示前50条，共 {previewData.length} 条
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
  } = useInvoiceStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<string>('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

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
      invoiceType: 'input',
      searchQuery,
      paymentStatus: paymentStatusFilter !== 'all' ? paymentStatusFilter as InvoicePaymentStatus : undefined,
      hasVoucher: voucherStatusFilter !== 'all' ? voucherStatusFilter === 'yes' : undefined,
    });
  }, [searchQuery, paymentStatusFilter, voucherStatusFilter, setFilter]);

  const filteredInvoices = getFilteredInvoices();

  // 处理导入
  const handleImport = async (invoicesData: Partial<Invoice>[]) => {
    return await importInvoicesFromExcel(invoicesData, 'input');
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
    unpaidCount: filteredInvoices.filter(inv => inv.paymentStatus === 'unpaid').length,
    unpaidAmount: filteredInvoices
      .filter(inv => inv.paymentStatus === 'unpaid')
      .reduce((sum, inv) => sum + (inv.totalAmount - inv.paidAmount), 0),
    noVoucherCount: filteredInvoices.filter(inv => !inv.voucherId).length,
  };

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
        <Button onClick={() => setShowImportDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          导入Excel
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-slate-500">待付款</CardTitle>
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
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索发票号、销售方、商品名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
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
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">发票号码</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">日期</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">销售方</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-500">商品/服务</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">金额</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">税额</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-500">价税合计</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">付款状态</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">凭证</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      暂无发票数据，请导入税务局Excel
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{invoice.invoiceCode}</td>
                      <td className="px-4 py-3">{invoice.invoiceDate}</td>
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
