'use client';

import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Plus,
  Trash2,
  Upload,
  Download,
} from 'lucide-react';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useToast } from '@/components/ui/toast';
import { importFromExcel, exportTemplate } from '@/lib/excel-utils';
import type { Partner } from '@/types';

interface SetupStepPartnersProps {
  accountSetId: string;
}

interface PartnerRow {
  code: string;
  name: string;
  type: string;
  openingBalance: number;
  contact: string;
  phone: string;
  taxNumber: string;
}

type PartnerSetupType = 'customer' | 'supplier' | 'both';
type PartnerImportInput = Omit<Partner, 'id' | 'createTime' | 'updateTime'>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const PARTNER_IMPORT_HEADERS = [
  { key: 'code' as const, label: '编码', required: true },
  { key: 'name' as const, label: '名称', required: true },
  { key: 'type' as const, label: '类型(客户/供应商/两者)', required: true },
  { key: 'openingBalance' as const, label: '期初余额', required: false },
  { key: 'contact' as const, label: '联系人', required: false },
  { key: 'phone' as const, label: '电话', required: false },
  { key: 'taxNumber' as const, label: '税号', required: false },
];

export function SetupStepPartners({ accountSetId }: SetupStepPartnersProps) {
  void accountSetId;
  const { showToast } = useToast();
  const {
    partners,
    initializePartners,
    addPartner,
    deletePartner,
    importPartners,
  } = usePartnerStore();

  const [saving, setSaving] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state for inline add
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PartnerSetupType>('customer');
  const [newOpeningBalance, setNewOpeningBalance] = useState<number>(0);

  useEffect(() => {
    initializePartners();
  }, [initializePartners]);

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim()) {
      showToast('warning', '请填写编码和名称');
      return;
    }

    const exists = partners.find(p => p.code === newCode.trim() || p.name === newName.trim());
    if (exists) {
      showToast('warning', `编码或名称已存在`);
      return;
    }

    setSaving(true);
    try {
      await addPartner({
        code: newCode.trim(),
        name: newName.trim(),
        isCustomer: newType === 'customer' || newType === 'both',
        isSupplier: newType === 'supplier' || newType === 'both',
        isEmployee: false,
        openingBalance: Math.round(newOpeningBalance * 100) / 100,
        frozen: false,
      });
      setNewCode('');
      setNewName('');
      setNewType('customer');
      setNewOpeningBalance(0);
    } catch (error: unknown) {
      showToast('error', `添加失败：${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePartner(id);
    } catch (error: unknown) {
      showToast('error', `删除失败：${getErrorMessage(error)}`);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await importFromExcel<PartnerRow>(file, PARTNER_IMPORT_HEADERS);
      const toImport: PartnerImportInput[] = [];
      let skipped = 0;

      for (const row of rawData) {
        if (!row.code || !row.name) { skipped++; continue; }
        const typeStr = String(row.type).trim();
        const isCustomer = typeStr.includes('客户') || typeStr === 'both';
        const isSupplier = typeStr.includes('供应商') || typeStr === 'both';

        // Skip duplicates
        if (partners.some(p => p.code === String(row.code).trim())) {
          skipped++;
          continue;
        }

        toImport.push({
          code: String(row.code).trim(),
          name: String(row.name).trim(),
          isCustomer: isCustomer || !isSupplier,
          isSupplier,
          isEmployee: false,
          openingBalance: Math.round((Number(row.openingBalance) || 0) * 100) / 100,
          contact: String(row.contact || '').trim(),
          phone: String(row.phone || '').trim(),
          taxNumber: String(row.taxNumber || '').trim(),
          frozen: false,
        });
      }

      if (toImport.length > 0) {
        await importPartners(toImport);
      }

      if (skipped > 0) {
        showToast('warning', `导入 ${toImport.length} 条，跳过 ${skipped} 条（重复或数据不完整）`);
      } else if (toImport.length > 0) {
        showToast('success', `成功导入 ${toImport.length} 条往来单位`);
      } else {
        showToast('warning', '未找到有效数据');
      }
    } catch (error: unknown) {
      showToast('error', `导入失败：${getErrorMessage(error)}`);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadTemplate = () => {
    exportTemplate<PartnerRow>(
      '往来单位导入模板',
      { code: 'C001', name: '示例客户', type: '客户', openingBalance: 5000, contact: '张三', phone: '13800138000', taxNumber: '' },
      PARTNER_IMPORT_HEADERS
    );
  };

  const getTypeBadge = (p: Partner) => {
    const types: string[] = [];
    if (p.isCustomer) types.push('客户');
    if (p.isSupplier) types.push('供应商');
    if (p.isEmployee) types.push('雇员');
    return types.join('/');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">往来单位管理</h2>
        <p className="text-sm text-slate-500 mt-1">
          维护客户、供应商等往来单位主数据。也可通过Excel批量导入
        </p>
      </div>

      {/* Inline add */}
      <div className="border rounded-lg p-4 bg-slate-50">
        <Label className="text-sm font-medium mb-3 block">新增往来单位</Label>
        <div className="flex items-end gap-3">
          <div className="w-24">
            <Label className="text-xs text-slate-500">编码</Label>
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="C001" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-40">
            <Label className="text-xs text-slate-500">名称</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="单位名称" className="h-8 text-sm" autoComplete="off" />
          </div>
          <div className="w-32">
            <Label className="text-xs text-slate-500">类型</Label>
            <select value={newType} onChange={(e) => setNewType(e.target.value as PartnerSetupType)} className="h-8 text-sm border rounded px-2 w-full">
              <option value="customer">客户</option>
              <option value="supplier">供应商</option>
              <option value="both">两者</option>
            </select>
          </div>
          <div className="w-32">
            <Label className="text-xs text-slate-500">期初余额</Label>
            <Input type="number" value={newOpeningBalance || ''} onChange={(e) => setNewOpeningBalance(parseFloat(e.target.value) || 0)} placeholder="0.00" className="h-8 text-sm text-right" autoComplete="off" />
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
        <span className="ml-auto text-sm text-slate-400">{partners.length} 条记录</span>
      </div>

      {/* Partner list */}
      {partners.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">编码</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">类型</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">期初余额</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">联系人</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">电话</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-36">税号</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {partners.map(p => (
                <tr key={p.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="text-xs">{getTypeBadge(p)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-600">{(p.openingBalance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-slate-600">{p.contact || '-'}</td>
                  <td className="px-3 py-2 text-slate-600">{p.phone || '-'}</td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-xs">{p.taxNumber || '-'}</td>
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
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>暂无往来单位</p>
          <p className="text-sm">点击添加或导入 Excel 批量录入</p>
        </div>
      )}
    </div>
  );
}
