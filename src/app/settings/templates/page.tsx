'use client';

import { useState } from 'react';
import {
  useVoucherTemplateStore,
  useSubjectStore,
  useDepartmentStore,
  useFinancialProjectStore,
  useCurrencyStore
} from '@/stores';
import {
  Trash2,
  Download,
  Upload,
  FileText,
  AlertCircle,
  Edit2,
  Search,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { exportToExcel, importFromExcel } from '@/lib/excel-utils';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function TemplatesSettingsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const {
    templates,
    deleteTemplate,
    importTemplatesFromExcel,
    exportTemplatesToExcel,
    updateTemplate
  } = useVoucherTemplateStore();

  const { subjects } = useSubjectStore();
  const { departments } = useDepartmentStore();
  const { projects } = useFinancialProjectStore();
  const { currencies } = useCurrencyStore();

  // 导出所有模板
  const handleExportAll = () => {
    const data = exportTemplatesToExcel();
    if (data.length === 0) {
      return;
    }
    exportToExcel(
      data,
      '凭证模板库',
      [
        { key: '模版名称', label: '模版名称' },
        { key: '模版描述', label: '模版描述' },
        { key: '凭证类型', label: '凭证类型' },
        { key: '摘要', label: '摘要' },
        { key: '科目代码', label: '科目代码' },
        { key: '科目名称', label: '科目名称' },
        { key: '借方', label: '借方' },
        { key: '贷方', label: '贷方' },
        { key: '部门代码', label: '部门代码' },
        { key: '部门名称', label: '部门名称' },
        { key: '项目代码', label: '项目代码' },
        { key: '项目名称', label: '项目名称' },
        { key: '币别代码', label: '币别代码' },
        { key: '币别名称', label: '币别名称' },
        { key: '现金流量项目', label: '现金流量项目' },
        { key: '客户名称', label: '客户名称' },
        { key: '供应商名称', label: '供应商名称' }
      ]
    );
  };

  // 下载导入模板
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        模版名称: '报销差旅费',
        模版描述: '用于报销差旅费用的凭证模板',
        凭证类型: 'payment',
        摘要: '报销差旅费',
        科目代码: '6602',
        科目名称: '管理费用',
        借方: 1000,
        贷方: 0,
        部门代码: 'DEPT001',
        部门名称: '销售部',
        项目代码: '',
        项目名称: '',
        币别代码: 'CNY',
        币别名称: '人民币',
        现金流量项目: '',
        客户名称: '',
        供应商名称: ''
      },
      {
        模版名称: '报销差旅费',
        科目代码: '1002',
        科目名称: '银行存款',
        借方: 0,
        贷方: 1000
      }
    ];
    exportToExcel(templateData, '凭证模板导入模板');
  };

  const handleImportFile = (file: File) => {
    setImportFile(file);
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const headers = [
        { key: '模版名称', label: '模版名称', required: true },
        { key: '模版描述', label: '模版描述' },
        { key: '凭证类型', label: '凭证类型' },
        { key: '摘要', label: '摘要' },
        { key: '科目代码', label: '科目代码' },
        { key: '科目名称', label: '科目名称' },
        { key: '借方', label: '借方' },
        { key: '贷方', label: '贷方' },
        { key: '部门代码', label: '部门代码' },
        { key: '部门名称', label: '部门名称' },
        { key: '项目代码', label: '项目代码' },
        { key: '项目名称', label: '项目名称' },
        { key: '币别代码', label: '币别代码' },
        { key: '币别名称', label: '币别名称' },
        { key: '现金流量项目', label: '现金流量项目' },
        { key: '客户名称', label: '客户名称' },
        { key: '供应商名称', label: '供应商名称' }
      ];

      const data = await importFromExcel<any>(importFile, headers);
      const result = await importTemplatesFromExcel(data, {
        subjects: subjects || [],
        departments: departments || [],
        projects: projects || [],
        currencies: currencies || []
      });
      setImportResult(result);
    } catch (error) {
      setImportResult({
        success: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : '导入失败，请检查文件格式']
      });
    } finally {
      setIsImporting(false);
    }
  };

  // 搜索过滤模板
  const filteredTemplates = templates.filter((template) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      template.name.toLowerCase().includes(query) ||
      (template.description && template.description.toLowerCase().includes(query))
    );
  });

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      general: '通用凭证',
      receipt: '收款凭证',
      payment: '付款凭证',
      transfer: '转账凭证',
      closing: '结转凭证'
    };
    return typeMap[type] || type;
  };

  const startEditingTemplate = (template: any) => {
    setEditingTemplate(template.id);
    setEditForm(JSON.parse(JSON.stringify(template)));
  };

  const updateEntryField = (index: number, field: string, value: any) => {
    setEditForm((prev) => {
      const newEntries = [...prev.entries];
      newEntries[index] = {
        ...newEntries[index],
        [field]: value
      };
      return {
        ...prev,
        entries: newEntries
      };
    });
  };

  const saveEditingTemplate = async () => {
    if (editingTemplate) {
      await updateTemplate(editingTemplate, editForm);
      setEditingTemplate(null);
      setEditForm({});
    }
  };

  const cancelEditingTemplate = () => {
    setEditingTemplate(null);
    setEditForm({});
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">凭证模版</h1>
        <p className="text-slate-600 mt-1">管理凭证模版，支持Excel导入导出</p>
        <p className="text-sm text-slate-500 mt-1">当前模版数: {templates.length}</p>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* 搜索框 */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="搜索模板名称或描述..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700">
              <Upload className="w-4 h-4 mr-2" />
              导入模版
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>导入凭证模版</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="templateFile" className="text-sm font-medium text-slate-700">
                  选择Excel文件
                </label>
                <Input
                  id="templateFile"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
                  className="w-full"
                />
                {importFile && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <FileText className="w-4 h-4" />
                    {importFile.name}
                  </div>
                )}
              </div>

              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Download className="w-4 h-4 mr-2" />
                下载导入模板
              </Button>

              {importResult && (
                <div
                  className={`p-4 rounded-lg border ${
                    importResult.failed === 0
                      ? 'bg-green-50 border-green-200'
                      : importResult.success > 0
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    {importResult.failed === 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : importResult.success > 0 ? (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span
                      className={`font-semibold text-lg ${
                        importResult.failed === 0
                          ? 'text-green-800'
                          : importResult.success > 0
                          ? 'text-yellow-800'
                          : 'text-red-800'
                      }`}
                    >
                      导入完成
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="text-xs text-slate-500">成功导入</p>
                        <p className="text-xl font-bold text-green-700">
                          {importResult.success}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-white rounded-lg border">
                      <XCircle className="w-5 h-5 text-red-600" />
                      <div>
                        <p className="text-xs text-slate-500">导入失败</p>
                        <p className="text-xl font-bold text-red-700">
                          {importResult.failed}
                        </p>
                      </div>
                    </div>
                  </div>

                  {importResult.errors.length > 0 && (
                    <div>
                      <p className="font-medium text-sm mb-2 flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        错误详情：
                      </p>
                      <div className="bg-white rounded-lg border max-h-48 overflow-y-auto">
                        <ul className="divide-y divide-slate-100">
                          {importResult.errors.map((error, i) => (
                            <li
                              key={i}
                              className="px-3 py-2 text-xs text-slate-700 flex items-start gap-2"
                            >
                              <span className="text-red-500 mt-0.5">•</span>
                              {error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setImportFile(null);
                    setImportResult(null);
                  }}
                >
                  关闭
                </Button>
                <Button onClick={handleImport} disabled={!importFile || isImporting}>
                  {isImporting ? '导入中...' : '导入'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button onClick={handleExportAll} disabled={filteredTemplates.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          导出所有模版
        </Button>
      </div>

      {/* 模版列表 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg font-medium">暂无凭证模版</p>
                <p className="text-sm mt-2">
                  可以通过导入Excel文件或在凭证录入页面保存为模版
                </p>
              </div>
            ) : (
              filteredTemplates
                .sort(
                  (a, b) =>
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                )
                .map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-slate-900 truncate">
                              {template.name}
                            </h3>
                            <Badge variant="outline" className="text-xs">
                              {getTypeLabel(template.voucherType)}
                            </Badge>
                          </div>
                          {template.description && (
                            <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <div className="text-xs text-slate-500">
                            <p>分录数：{template.entries.length}</p>
                            <p>创建时间：{new Date(template.createdAt).toLocaleString()}</p>
                            <p>更新时间：{new Date(template.updatedAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditingTemplate(template)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          编辑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => await deleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* 模版详情 - 全部展开 */}
                    <div className="p-4 bg-white border-t">
                      {editingTemplate === template.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>模版名称</Label>
                              <Input
                                value={editForm.name || ''}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, name: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>凭证类型</Label>
                              <select
                                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={editForm.voucherType || 'general'}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, voucherType: e.target.value })
                                }
                              >
                                <option value="general">通用凭证</option>
                                <option value="receipt">收款凭证</option>
                                <option value="payment">付款凭证</option>
                                <option value="transfer">转账凭证</option>
                                <option value="closing">结转凭证</option>
                              </select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>模版描述</Label>
                            <Textarea
                              value={editForm.description || ''}
                              onChange={(e) =>
                                setEditForm({ ...editForm, description: e.target.value })
                              }
                              rows={3}
                            />
                          </div>

                          <div className="space-y-4">
                            <h4 className="font-semibold text-sm text-slate-900">
                              凭证分录
                            </h4>
                            <div className="space-y-3">
                              {editForm.entries?.map((entry: any, index: number) => (
                                <div
                                  key={entry.id}
                                  className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 border rounded"
                                >
                                  <div className="space-y-1">
                                    <Label className="text-xs">摘要</Label>
                                    <Input
                                      value={entry.summary || ''}
                                      onChange={(e) =>
                                        updateEntryField(index, 'summary', e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">科目代码</Label>
                                    <Input
                                      value={entry.subjectCode || ''}
                                      onChange={(e) =>
                                        updateEntryField(index, 'subjectCode', e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">科目名称</Label>
                                    <Input
                                      value={entry.subjectName || ''}
                                      onChange={(e) =>
                                        updateEntryField(index, 'subjectName', e.target.value)
                                      }
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">币别</Label>
                                    <Input
                                      value={entry.currencyName || entry.currencyCode || ''}
                                      onChange={(e) =>
                                        updateEntryField(index, 'currencyName', e.target.value)
                                      }
                                      placeholder="如：人民币"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">现金流量</Label>
                                    <Input
                                      value={entry.cashFlowItem || ''}
                                      onChange={(e) =>
                                        updateEntryField(index, 'cashFlowItem', e.target.value)
                                      }
                                      placeholder="如：支付的其他与经营活动有关的现金"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">借方</Label>
                                      <Input
                                        type="number"
                                        value={entry.debit || 0}
                                        onChange={(e) =>
                                          updateEntryField(
                                            index,
                                            'debit',
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">贷方</Label>
                                      <Input
                                        type="number"
                                        value={entry.credit || 0}
                                        onChange={(e) =>
                                          updateEntryField(
                                            index,
                                            'credit',
                                            parseFloat(e.target.value) || 0
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={cancelEditingTemplate}>
                              取消
                            </Button>
                            <Button onClick={saveEditingTemplate}>保存</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2 px-3">摘要</th>
                                  <th className="text-left py-2 px-3">科目代码</th>
                                  <th className="text-left py-2 px-3">科目名称</th>
                                  <th className="text-left py-2 px-3">币别</th>
                                  <th className="text-left py-2 px-3">现金流量项目</th>
                                  <th className="text-right py-2 px-3">借方</th>
                                  <th className="text-right py-2 px-3">贷方</th>
                                </tr>
                              </thead>
                              <tbody>
                                {template.entries.map((entry: any) => (
                                  <tr
                                    key={entry.id}
                                    className="border-b hover:bg-slate-50"
                                  >
                                    <td className="py-2 px-3">{entry.summary}</td>
                                    <td className="py-2 px-3">{entry.subjectCode}</td>
                                    <td className="py-2 px-3">{entry.subjectName}</td>
                                    <td className="py-2 px-3">
                                      {entry.currencyName || entry.currencyCode || '-'}
                                    </td>
                                    <td className="py-2 px-3">
                                      {entry.cashFlowItem || '-'}
                                    </td>
                                    <td className="text-right py-2 px-3">
                                      {entry.debit.toFixed(2)}
                                    </td>
                                    <td className="text-right py-2 px-3">
                                      {entry.credit.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="flex justify-end gap-2 pt-4 border-t">
                            <div className="text-sm font-medium text-slate-700">
                              借方合计：
                              {template.entries
                                .reduce((sum: number, entry: any) => sum + entry.debit, 0)
                                .toFixed(2)}
                            </div>
                            <div className="text-sm font-medium text-slate-700 ml-4">
                              贷方合计：
                              {template.entries
                                .reduce((sum: number, entry: any) => sum + entry.credit, 0)
                                .toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">使用说明</h3>
          <div className="space-y-2 text-sm text-slate-600">
            <p>• 在凭证录入页面点击"保存为模版"按钮，可将当前凭证保存为模版</p>
            <p>• 支持Excel格式的模版导入导出</p>
            <p>• 导入时会自动校验科目、部门、项目、币别代码是否存在</p>
            <p>• 模版包括完整的凭证信息，包括摘要、科目、借方、贷方等</p>
            <p>• 可快速应用模版创建新凭证</p>
            <p>• 点击编辑按钮可修改模版信息</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
