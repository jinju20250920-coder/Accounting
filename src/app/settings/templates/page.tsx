'use client';

import { useState } from 'react';
import { useVoucherTemplateStore } from '@/stores';
import { Plus, Trash2, Download, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export default function TemplatesSettingsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);

  const { templates, deleteTemplate, importTemplates } = useVoucherTemplateStore();

  const handleImportFile = (file: File) => {
    setImportFile(file);
  };

  const handleImport = () => {
    if (!importFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const success = importTemplates(content);

      if (success) {
        setImportFile(null);
        setIsDialogOpen(false);
      } else {
        console.error('Failed to import templates');
      }
    };
    reader.readAsText(importFile);
  };

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

  const exportAllTemplates = () => {
    // TODO: 实现导出功能
    console.log('Exporting all templates');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">凭证模版</h1>
        <p className="text-slate-600 mt-1">管理凭证模版，支持Excel导入导出</p>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Button onClick={exportAllTemplates}>
          <Download className="w-4 h-4 mr-2" />
          导出所有模版
        </Button>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleImport} disabled={!importFile}>
                  导入
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 模版列表 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {templates.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg font-medium">暂无凭证模版</p>
                <p className="text-sm mt-2">可以通过导入Excel文件或在凭证录入页面保存为模版</p>
              </div>
            ) : (
              templates
                .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                .map((template) => (
                  <div
                    key={template.id}
                    className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
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
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          // TODO: 实现导出单个模版
                          console.log('Exporting template:', template.id);
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTemplate(template.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
            <p>• 模版包括完整的凭证信息，包括摘要、科目、借方、贷方等</p>
            <p>• 可快速应用模版创建新凭证</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
