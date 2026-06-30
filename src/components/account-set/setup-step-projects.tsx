'use client';

import { getErrorMessage } from '@/lib/utils';
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  FolderOpen,
  Plus,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { useFinancialProjectStore } from '@/stores/useFinancialProjectStore';
import { useToast } from '@/components/ui/toast';
import { importFromExcel, exportTemplate } from '@/lib/excel-utils';

interface SetupStepProjectsProps {
  accountSetId: string;
}

interface ProjectRow {
  code: string;
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  contact: string;
  remark: string;
}

const PROJECT_IMPORT_HEADERS = [
  { key: 'code' as const, label: '项目编码', required: true },
  { key: 'name' as const, label: '项目名称', required: true },
  { key: 'type' as const, label: '类型(收入/成本/其他)', required: true },
  { key: 'startDate' as const, label: '开始日期', required: false },
  { key: 'endDate' as const, label: '结束日期', required: false },
  { key: 'contact' as const, label: '负责人', required: false },
  { key: 'remark' as const, label: '备注', required: false },
];

export function SetupStepProjects({ accountSetId }: SetupStepProjectsProps) {
  const { showToast } = useToast();
  const {
    projects,
    initializeProjects,
    addProject,
    deleteProject,
    importProjects,
  } = useFinancialProjectStore();

  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state for inline add
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'income' | 'cost' | 'other'>('income');

  useEffect(() => {
    initializeProjects();
  }, [initializeProjects]);

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim()) {
      showToast('warning', '请填写项目编码和名称');
      return;
    }

    const exists = projects.find(p => p.code === newCode.trim());
    if (exists) {
      showToast('warning', '项目编码已存在');
      return;
    }

    setSaving(true);
    try {
      await addProject({
        code: newCode.trim(),
        name: newName.trim(),
        type: newType,
        parentId: null,
        level: 1,
        startDate: new Date().toISOString().substring(0, 10),
        endDate: '',
        frozen: false,
        accountSetId,
      });
      setNewCode('');
      setNewName('');
      setNewType('income');
    } catch (error: unknown) {
      showToast('error', `添加失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
    } catch (error: unknown) {
      showToast('error', `删除失败：${getErrorMessage(error)}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel<ProjectRow>(file, PROJECT_IMPORT_HEADERS);
      const toImport: any[] = [];
      let skipped = 0;

      for (const row of rawData) {
        if (!row.code || !row.name) { skipped++; continue; }
        const typeStr = String(row.type).trim();
        const type = typeStr.includes('收入') ? 'income' : typeStr.includes('成本') ? 'cost' : 'other';

        if (projects.some(p => p.code === String(row.code).trim())) {
          skipped++;
          continue;
        }

        toImport.push({
          code: String(row.code).trim(),
          name: String(row.name).trim(),
          type,
          parentId: null,
          level: 1,
          startDate: String(row.startDate || '').trim(),
          endDate: String(row.endDate || '').trim(),
          frozen: false,
          accountSetId,
        });
      }

      if (toImport.length > 0) {
        await importProjects(toImport);
      }

      if (skipped > 0) {
        showToast('warning', `导入 ${toImport.length} 条，跳过 ${skipped} 条（重复或数据不完整）`);
      } else if (toImport.length > 0) {
        showToast('success', `成功导入 ${toImport.length} 条项目`);
      } else {
        showToast('warning', '未找到有效数据');
      }
    } catch (error: unknown) {
      showToast('error', `导入失败：${getErrorMessage(error)}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    exportTemplate<ProjectRow>(
      '项目核算导入模板',
      { code: 'PRJ001', name: '示例项目', type: '收入', startDate: '2026-01-01', endDate: '2026-12-31', contact: '张三', remark: '' },
      PROJECT_IMPORT_HEADERS
    );
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'income': return '收入';
      case 'cost': return '成本';
      default: return '其他';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">项目核算管理</h2>
        <p className="text-sm text-slate-500 mt-1">
          维护核算项目，按项目归集收入和费用。也可通过Excel批量导入
        </p>
      </div>

      {/* Inline add */}
      <div className="border rounded-lg p-4 bg-slate-50">
        <Label className="text-sm font-medium mb-3 block">新增项目</Label>
        <div className="flex items-end gap-3">
          <div className="w-24">
            <Label className="text-xs text-slate-500">编码</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="PRJ001" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-48">
            <Label className="text-xs text-slate-500">名称</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="项目名称" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-28">
            <Label className="text-xs text-slate-500">类型</Label>
            <select value={newType} onChange={(e) => setNewType(e.target.value as any)} className="h-8 text-sm border rounded px-2 w-full">
              <option value="income">收入项目</option>
              <option value="cost">成本项目</option>
              <option value="other">其他</option>
            </select>
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving || !newCode || !newName}>
            <Plus className="h-4 w-4 mr-1" /> 添加
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> 导入Excel
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4 mr-1" /> 下载模板
        </Button>
        <span className="ml-auto text-sm text-slate-400">{projects.length} 条记录</span>
      </div>

      {/* Project list */}
      {projects.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">编码</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-20">类型</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-28">开始日期</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-20">备注</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map(p => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">{getTypeBadge(p.type)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{p.startDate || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{'remark' in p ? (p as any).remark || '-' : '-'}</td>
                  <td className="px-3 py-1">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无核算项目</p>
          <p className="text-sm">点击"添加"或"导入Excel"批量录入</p>
        </div>
      )}
    </div>
  );
}
