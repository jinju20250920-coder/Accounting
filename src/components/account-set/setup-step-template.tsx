'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Store,
  Factory,
  Briefcase,
  Cpu,
  UtensilsCrossed,
  HardHat,
  CheckCircle2,
  Loader2,
  Upload,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INDUSTRY_TEMPLATES, getIndustryTemplate, type IndustryTemplate } from '@/lib/data/industry-templates';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useToast } from '@/components/ui/toast';

interface SetupStepTemplateProps {
  selectedTemplate: string | null;
  onSelect: (templateId: string | null) => void;
  accountingStandard: 'small-enterprise' | 'enterprise' | 'other';
  accountSetId: string;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  commercial: <Store className="h-6 w-6" />,
  manufacturing: <Factory className="h-6 w-6" />,
  service: <Briefcase className="h-6 w-6" />,
  technology: <Cpu className="h-6 w-6" />,
  restaurant: <UtensilsCrossed className="h-6 w-6" />,
  construction: <HardHat className="h-6 w-6" />,
};

const TEMPLATE_COLORS: Record<string, string> = {
  commercial: 'bg-blue-50 border-blue-200 text-blue-700',
  manufacturing: 'bg-amber-50 border-amber-200 text-amber-700',
  service: 'bg-green-50 border-green-200 text-green-700',
  technology: 'bg-purple-50 border-purple-200 text-purple-700',
  restaurant: 'bg-red-50 border-red-200 text-red-700',
  construction: 'bg-orange-50 border-orange-200 text-orange-700',
};

const TEMPLATE_HOVER: Record<string, string> = {
  commercial: 'hover:border-blue-400 hover:shadow-blue-100',
  manufacturing: 'hover:border-amber-400 hover:shadow-amber-100',
  service: 'hover:border-green-400 hover:shadow-green-100',
  technology: 'hover:border-purple-400 hover:shadow-purple-100',
  restaurant: 'hover:border-red-400 hover:shadow-red-100',
  construction: 'hover:border-orange-400 hover:shadow-orange-100',
};

export function SetupStepTemplate({
  selectedTemplate,
  onSelect,
  accountingStandard,
  accountSetId,
}: SetupStepTemplateProps) {
  const { showToast } = useToast();
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [mode, setMode] = useState<'template' | 'custom'>('template');
  const [importedSubjects, setImportedSubjects] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const preview = previewTemplate ? getIndustryTemplate(previewTemplate) : null;

  const handleSelect = (templateId: string) => {
    if (templateId === selectedTemplate) return;
    onSelect(templateId);
    setApplied(false);
  };

  const handleModeChange = (newMode: 'template' | 'custom') => {
    setMode(newMode);
    if (newMode === 'custom') {
      onSelect(null);
      setApplied(false);
    } else {
      setImportedSubjects([]);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    const template = getIndustryTemplate(selectedTemplate);
    if (!template) return;

    setApplying(true);
    try {
      // Sync accountSetId
      if (sqliteService.accountSetId !== accountSetId) {
        sqliteService.setAccountSetId(accountSetId);
      }

      // Check existing subjects
      const existingSubjects = await sqliteService.getAllSubjects();
      const existingCodes = new Set(existingSubjects.map(s => s.code));

      // Filter out already-existing subjects
      const newSubjects = template.subjects
        .filter(s => !existingCodes.has(s.code))
        .map(s => ({
          ...s,
          id: s.code,
          block: false,
          enableForeign: false,
          foreignCurrency: '',
          direction: s.direction as 'debit' | 'credit',
          subjectType: getSubjectType(s.code) as 'Asset' | 'Liability' | 'Equity' | 'Cost' | 'Profit/Loss',
          accountSetId,
        }));

      if (newSubjects.length > 0) {
        await sqliteService.saveSubjects(newSubjects);
      }

      // Save common summaries
      const summaries = template.commonSummaries.map((text, i) => ({
        id: `summary_preset_${Date.now()}_${i}`,
        text,
        sortOrder: i,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        accountSetId,
      }));
      if (summaries.length > 0) {
        await sqliteService.saveCommonSummaries(summaries);
      }

      setApplied(true);
      showToast('success', `已应用「${template.name}」模板，初始化 ${newSubjects.length} 个科目`);
    } catch (error) {
      console.error('Apply template failed:', error);
      showToast('error', '应用模板失败');
    } finally {
      setApplying(false);
    }
  };

  const SUBJECT_IMPORT_HEADERS = [
    { key: 'code' as const, label: '科目代码', required: true },
    { key: 'name' as const, label: '科目名称', required: true },
    { key: 'direction' as const, label: '借贷方向(借/贷)', required: false },
    { key: 'level' as const, label: '层级', required: false },
    { key: 'parentCode' as const, label: '上级科目代码', required: false },
  ];

  const handleSubjectImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const rawData = await importFromExcel<any>(file, SUBJECT_IMPORT_HEADERS);
      const subjects: any[] = [];
      let skipped = 0;

      for (const row of rawData) {
        if (!row.code || !row.name) { skipped++; continue; }
        const code = String(row.code).trim();
        const name = String(row.name).trim();
        const dirStr = String(row.direction || '借').trim();
        const direction = dirStr.includes('贷') ? 'credit' : 'debit';
        const level = Number(row.level) || Math.max(1, Math.floor((code.length - 1) / 2));
        const parentCode = row.parentCode ? String(row.parentCode).trim() : (code.length > 4 ? code.substring(0, code.length - 2) : null);

        subjects.push({
          code, name, direction, level, parentCode,
        });
      }

      setImportedSubjects(subjects);
      if (subjects.length > 0) {
        onSelect('__custom__');
        showToast('success', `已解析 ${subjects.length} 条科目${skipped > 0 ? `，跳过 ${skipped} 条` : ''}`);
      } else {
        showToast('warning', '未找到有效科目数据');
      }
    } catch (error: any) {
      showToast('error', `导入失败：${error.message}`);
    } finally {
      setImporting(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleApplyCustomSubjects = async () => {
    if (importedSubjects.length === 0) return;
    setApplying(true);
    try {
      if (sqliteService.accountSetId !== accountSetId) {
        sqliteService.setAccountSetId(accountSetId);
      }

      const existingSubjects = await sqliteService.getAllSubjects();
      const existingCodes = new Set(existingSubjects.map(s => s.code));

      const newSubjects = importedSubjects
        .filter(s => !existingCodes.has(s.code))
        .map(s => ({
          id: s.code,
          code: s.code,
          name: s.name,
          direction: s.direction as 'debit' | 'credit',
          level: s.level,
          parentId: s.parentCode || null,
          subjectType: getSubjectType(s.code) as 'Asset' | 'Liability' | 'Equity' | 'Cost' | 'Profit/Loss',
          isCustomer: false,
          isSupplier: false,
          isEmployee: false,
          enableDept: false,
          enableProject: false,
          enableForeign: false,
          enableCashFlow: false,
          disabled: false,
          block: false,
          accountSetId,
        }));

      if (newSubjects.length > 0) {
        await sqliteService.saveSubjects(newSubjects);
      }

      setApplied(true);
      showToast('success', `已导入 ${newSubjects.length} 个科目`);
    } catch (error) {
      console.error('Import subjects failed:', error);
      showToast('error', '导入科目失败');
    } finally {
      setApplying(false);
    }
  };

  const handleDownloadSubjectTemplate = () => {
    exportTemplate<any>(
      '科目导入模板',
      { code: '1001', name: '库存现金', direction: '借', level: 1, parentCode: '' },
      SUBJECT_IMPORT_HEADERS
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">科目初始化</h2>
        <p className="text-sm text-slate-500 mt-1">
          选择行业模板自动生成科目，或自行导入科目列表
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => handleModeChange('template')}
          className={`px-4 py-2 text-sm rounded-md transition-all ${mode === 'template' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
        >
          行业模板
        </button>
        <button
          onClick={() => handleModeChange('custom')}
          className={`px-4 py-2 text-sm rounded-md transition-all ${mode === 'custom' ? 'bg-white shadow text-blue-700 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
        >
          自行导入
        </button>
      </div>

      {mode === 'template' && (
        <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {INDUSTRY_TEMPLATES.map((template) => {
          const isSelected = selectedTemplate === template.id;
          return (
            <button
              key={template.id}
              onClick={() => handleSelect(template.id)}
              className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                isSelected
                  ? `${TEMPLATE_COLORS[template.id]} border-current shadow-md`
                  : `border-slate-200 ${TEMPLATE_HOVER[template.id]} hover:shadow-md`
              }`}
            >
              {isSelected && (
                <CheckCircle2 className="absolute top-2 right-2 h-5 w-5 text-blue-600" />
              )}
              <div className={`${isSelected ? '' : 'text-slate-600'} mb-2`}>
                {TEMPLATE_ICONS[template.id]}
              </div>
              <h3 className={`font-semibold ${isSelected ? '' : 'text-slate-900'}`}>
                {template.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{template.description}</p>
              <div className="flex items-center gap-1 mt-2">
                <Badge variant="outline" className="text-xs">
                  {template.subjects.length} 个科目
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {template.businessGroups.length} 个业务组
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {/* Preview & Apply */}
      {selectedTemplate && (
        <div className="border rounded-lg p-4 bg-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">
                {INDUSTRY_TEMPLATES.find(t => t.id === selectedTemplate)?.name}模板预览
              </h3>
              {applied && (
                <Badge className="bg-green-100 text-green-700">已应用</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreviewTemplate(previewTemplate === selectedTemplate ? null : selectedTemplate)}
              >
                {previewTemplate === selectedTemplate ? '收起' : '查看科目'}
              </Button>
              {!applied && (
                <Button
                  size="sm"
                  onClick={handleApplyTemplate}
                  disabled={applying}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {applying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      应用中...
                    </>
                  ) : (
                    '应用模板'
                  )}
                </Button>
              )}
            </div>
          </div>

          {preview && previewTemplate === selectedTemplate && (
            <div className="max-h-64 overflow-y-auto border rounded bg-white p-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                {preview.subjects.map((s) => (
                  <div key={s.code} className="flex items-center gap-1 py-0.5">
                    <span className="font-mono text-slate-500 text-xs">{s.code}</span>
                    <span className="text-slate-700">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!applied && !previewTemplate && (
            <p className="text-sm text-slate-500">
              点击「应用模板」将初始化 {INDUSTRY_TEMPLATES.find(t => t.id === selectedTemplate)?.subjects.length ?? 0} 个会计科目、
              {INDUSTRY_TEMPLATES.find(t => t.id === selectedTemplate)?.businessGroups.length ?? 0} 个发票业务组和常用摘要
            </p>
          )}
        </div>
      )}
        </>
      )}

      {/* Custom Import Mode */}
      {mode === 'custom' && (
        <div className="space-y-4">
          <div className="border rounded-lg p-6 bg-slate-50">
            <div className="flex items-center gap-3 mb-4">
              <FileSpreadsheet className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-slate-900">导入科目列表</p>
                <p className="text-xs text-slate-500">上传 Excel 文件，包含科目代码、科目名称、借贷方向等列</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleSubjectImport} className="hidden" />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                选择文件
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownloadSubjectTemplate}>
                <Download className="h-4 w-4 mr-1" /> 下载模板
              </Button>
            </div>

            {importedSubjects.length > 0 ? (
              <>
                <p className="text-sm text-slate-600 mb-2">
                  已解析 <span className="font-semibold">{importedSubjects.length}</span> 个科目
                </p>
                <div className="max-h-48 overflow-y-auto border rounded bg-white p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-sm">
                    {importedSubjects.slice(0, 100).map((s) => (
                      <div key={s.code} className="flex items-center gap-1 py-0.5">
                        <span className="font-mono text-slate-500 text-xs">{s.code}</span>
                        <span className="text-slate-700">{s.name}</span>
                      </div>
                    ))}
                    {importedSubjects.length > 100 && (
                      <div className="text-xs text-slate-400 py-0.5">... 还有 {importedSubjects.length - 100} 个科目</div>
                    )}
                  </div>
                </div>

                {!applied && (
                  <div className="flex justify-end mt-3">
                    <Button
                      size="sm"
                      onClick={handleApplyCustomSubjects}
                      disabled={applying}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                      导入 {importedSubjects.length} 个科目
                    </Button>
                  </div>
                )}
                {applied && (
                  <Badge className="bg-green-100 text-green-700 mt-2">已导入</Badge>
                )}
              </>
            ) : (
              <div className="text-center py-6 text-slate-400">
                <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>请上传科目 Excel 文件</p>
                <p className="text-xs">支持 .xlsx / .xls 格式</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getSubjectType(code: string): string {
  const first = code[0];
  switch (first) {
    case '1': return 'asset';
    case '2': return 'liability';
    case '3': return 'equity';
    case '4': return 'cost';
    case '5': return 'profit';
    case '6': return 'revenue';
    default: return 'asset';
  }
}
