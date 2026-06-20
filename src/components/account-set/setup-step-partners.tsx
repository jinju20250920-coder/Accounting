'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Users,
  Plus,
  Trash2,
  Upload,
  Download,
  Edit,
  Save,
} from 'lucide-react';
import { usePartnerStore } from '@/stores/usePartnerStore';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { loadOpeningBalanceLockKeys } from '@/lib/opening-balance-rules';
import { sqliteService } from '@/lib/database/sqlite-service';
import { useToast } from '@/components/ui/toast';
import { importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { DepartmentPopover } from '@/components/shared/subject-popover';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import type { Partner } from '@/types';

interface SetupStepPartnersProps {
  accountSetId: string;
}

type PartnerImportInput = Omit<Partner, 'id' | 'createTime' | 'updateTime'>;

interface PartnerFormState {
  code: string;
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isEmployee: boolean;
  contact: string;
  phone: string;
  email: string;
  address: string;
  taxNumber: string;
  bankAccount: string;
  bankName: string;
  idType: string;
  idNumber: string;
  employmentStartDate: string;
  employmentEndDate: string;
  departmentCode: string;
  departmentName: string;
  defaultSubjectCode: string;
  defaultSubjectName: string;
  defaultCurrency: string;
  payrollSalaryExpenseSubjectCode: string;
  payrollSalaryExpenseSubjectName: string;
  openingBalance: number;
  openingForeignBalance: number;
  openingExchangeRate: number;
  paymentTermDays: number;
}

type PartnerImportRow = Record<string, string | number>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const ID_TYPE_OPTIONS = ['', '居民身份证', '护照', '港澳居民来往内地通行证', '台湾居民来往大陆通行证', '外国人永久居留身份证'];

const PARTNER_IMPORT_HEADERS = [
  { key: 'code' as const, label: '单位代码', required: true },
  { key: 'name' as const, label: '单位名称', required: true },
  { key: 'departmentCode' as const, label: '部门代码', required: false },
  { key: 'departmentName' as const, label: '部门名称', required: false },
  { key: 'isCustomer' as const, label: '是否客户', required: false },
  { key: 'isSupplier' as const, label: '是否供应商', required: false },
  { key: 'isEmployee' as const, label: '是否雇员', required: false },
  { key: 'openingBalance' as const, label: '期初余额', required: false },
  { key: 'contact' as const, label: '联系人', required: false },
  { key: 'phone' as const, label: '联系电话', required: false },
  { key: 'email' as const, label: '电子邮箱', required: false },
  { key: 'address' as const, label: '地址', required: false },
  { key: 'taxNumber' as const, label: '税号', required: false },
  { key: 'bankAccount' as const, label: '银行账号', required: false },
  { key: 'bankName' as const, label: '开户银行', required: false },
  { key: 'idType' as const, label: '证件类型', required: false },
  { key: 'idNumber' as const, label: '证件号码', required: false },
  { key: 'employmentStartDate' as const, label: '雇佣开始日期', required: false },
  { key: 'employmentEndDate' as const, label: '雇佣结束日期', required: false },
];

const emptyForm = (): PartnerFormState => ({
  code: '',
  name: '',
  isCustomer: false,
  isSupplier: false,
  isEmployee: false,
  contact: '',
  phone: '',
  email: '',
  address: '',
  taxNumber: '',
  bankAccount: '',
  bankName: '',
  idType: '',
  idNumber: '',
  employmentStartDate: '',
  employmentEndDate: '',
  departmentCode: '',
  departmentName: '',
  defaultSubjectCode: '',
  defaultSubjectName: '',
  defaultCurrency: '',
  payrollSalaryExpenseSubjectCode: '',
  payrollSalaryExpenseSubjectName: '',
  openingBalance: 0,
  openingForeignBalance: 0,
  openingExchangeRate: 0,
  paymentTermDays: 30,
});

function partnerToForm(p: Partner): PartnerFormState {
  return {
    code: p.code,
    name: p.name,
    isCustomer: !!p.isCustomer,
    isSupplier: !!p.isSupplier,
    isEmployee: !!p.isEmployee,
    contact: p.contact || '',
    phone: p.phone || '',
    email: p.email || '',
    address: p.address || '',
    taxNumber: p.taxNumber || '',
    bankAccount: p.bankAccount || '',
    bankName: p.bankName || '',
    idType: p.idType || '',
    idNumber: p.idNumber || '',
    employmentStartDate: p.employmentStartDate || '',
    employmentEndDate: p.employmentEndDate || '',
    departmentCode: p.departmentCode || '',
    departmentName: p.departmentName || '',
    defaultSubjectCode: p.defaultSubjectCode || '',
    defaultSubjectName: p.defaultSubjectName || '',
    defaultCurrency: p.defaultCurrency || '',
    payrollSalaryExpenseSubjectCode: p.payrollSalaryExpenseSubjectCode || '',
    payrollSalaryExpenseSubjectName: p.payrollSalaryExpenseSubjectName || '',
    openingBalance: p.openingBalance || 0,
    openingForeignBalance: p.openingForeignBalance || 0,
    openingExchangeRate: p.openingExchangeRate || 0,
    paymentTermDays: p.paymentTermDays ?? 30,
  };
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value || '').trim();
  return s === '是' || s === 'Y' || s === 'true' || s === '1';
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function SetupStepPartners({ accountSetId }: SetupStepPartnersProps) {
  const { showToast } = useToast();
  const {
    partners,
    initializePartners,
    addPartner,
    updatePartner,
    deletePartner,
    importPartners,
  } = usePartnerStore();
  const currencyStore = useCurrencyStore();
  const enabledCurrencies = currencyStore.getEnabledCurrencies();

  const [form, setForm] = useState<PartnerFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PartnerFormState>(emptyForm);
  const [lockedPartnerKeys, setLockedPartnerKeys] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initializePartners();
    void currencyStore.initializeCurrencies();
  }, [initializePartners, currencyStore]);

  useEffect(() => {
    loadOpeningBalanceLockKeys(accountSetId, { sqliteService }).then(keys => setLockedPartnerKeys(keys.partnerKeys));
  }, [accountSetId]);

  const updateForm = <K extends keyof PartnerFormState>(field: K, value: PartnerFormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateEditForm = <K extends keyof PartnerFormState>(field: K, value: PartnerFormState[K]) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const submitAdd = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showToast('warning', '请填写单位代码和名称');
      return;
    }
    if (!form.isCustomer && !form.isSupplier && !form.isEmployee) {
      showToast('warning', '请至少勾选一种身份（客户/供应商/雇员）');
      return;
    }
    try {
      await addPartner({
        ...form,
        code: form.code.toUpperCase(),
        frozen: false,
      } as PartnerImportInput);
      showToast('success', '已添加往来单位');
      setForm(emptyForm());
    } catch (error: unknown) {
      showToast('error', `添加失败：${getErrorMessage(error)}`);
    }
  };

  const startEdit = (p: Partner) => {
    setEditingId(p.id);
    setEditForm(partnerToForm(p));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm());
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.code.trim() || !editForm.name.trim()) {
      showToast('warning', '请填写单位代码和名称');
      return;
    }
    if (!editForm.isCustomer && !editForm.isSupplier && !editForm.isEmployee) {
      showToast('warning', '请至少勾选一种身份');
      return;
    }
    try {
      await updatePartner(editingId, {
        ...editForm,
        code: editForm.code.toUpperCase(),
      });
      showToast('success', '已更新往来单位');
      setEditingId(null);
      setEditForm(emptyForm());
    } catch (error: unknown) {
      showToast('error', `更新失败：${getErrorMessage(error)}`);
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
      const rawData = await importFromExcel<PartnerImportRow>(file, PARTNER_IMPORT_HEADERS);
      const toImport: PartnerImportInput[] = [];
      let skipped = 0;

      for (const row of rawData) {
        const code = String(row.code || '').trim();
        const name = String(row.name || '').trim();
        if (!code || !name) { skipped++; continue; }

        if (partners.some(p => p.code === code)) {
          skipped++;
          continue;
        }

        const isCustomer = parseBool(row.isCustomer);
        const isSupplier = parseBool(row.isSupplier);
        const isEmployee = parseBool(row.isEmployee);
        if (!isCustomer && !isSupplier && !isEmployee) {
          // Default to customer if none specified
        }

        toImport.push({
          code,
          name,
          isCustomer,
          isSupplier,
          isEmployee,
          contact: String(row.contact || '').trim(),
          phone: String(row.phone || '').trim(),
          email: String(row.email || '').trim(),
          address: String(row.address || '').trim(),
          taxNumber: String(row.taxNumber || '').trim(),
          bankAccount: String(row.bankAccount || '').trim(),
          bankName: String(row.bankName || '').trim(),
          idType: String(row.idType || '').trim(),
          idNumber: String(row.idNumber || '').trim(),
          employmentStartDate: String(row.employmentStartDate || '').trim(),
          employmentEndDate: String(row.employmentEndDate || '').trim(),
          departmentCode: String(row.departmentCode || '').trim(),
          departmentName: String(row.departmentName || '').trim(),
          openingBalance: Math.round((Number(row.openingBalance) || 0) * 100) / 100,
          paymentTermDays: Number(row.paymentTermDays) || 30,
          frozen: false,
        } as PartnerImportInput);
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
    exportTemplate<PartnerImportRow>(
      '往来单位导入模板',
      {
        '单位代码': 'AUX001',
        '单位名称': '示例往来单位',
        '部门代码': 'DEPT001',
        '部门名称': '销售部',
        '是否客户': '是',
        '是否供应商': '否',
        '是否雇员': '否',
        '期初余额': 5000,
        '联系人': '张三',
        '联系电话': '13800138000',
        '电子邮箱': 'example@email.com',
        '地址': '上海市浦东新区',
        '税号': '310115XXXXXXXX',
        '银行账号': '622588XXXXXXXXXXX',
        '开户银行': '中国工商银行',
        '证件类型': '',
        '证件号码': '',
        '雇佣开始日期': '',
        '雇佣结束日期': '',
      } as PartnerImportRow,
      PARTNER_IMPORT_HEADERS.map(h => ({ key: h.key as keyof PartnerImportRow, label: h.label })),
    );
  };

  const getTypeDisplay = (p: Partner) => {
    const types: string[] = [];
    if (p.isCustomer) types.push('客户');
    if (p.isSupplier) types.push('供应商');
    if (p.isEmployee) types.push('雇员');
    return types.join('/') || '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">往来单位管理</h2>
        <p className="text-sm text-slate-500 mt-1">
          维护客户、供应商、雇员等往来单位主数据。字段与往来卡片一致
        </p>
      </div>

      {/* Add form — matches auxiliary page partner card */}
      <div className="border rounded-lg p-4 bg-slate-50">
        <Label className="text-sm font-medium mb-3 block">新增往来单位</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-slate-500">单位代码 *</Label>
            <Input value={form.code} onChange={(e) => updateForm('code', e.target.value.toUpperCase())} placeholder="CUS001" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">单位名称 *</Label>
            <Input value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="单位名称" className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">身份（至少一项）</Label>
            <div className="flex gap-3 h-9 items-center text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.isCustomer} onChange={(e) => updateForm('isCustomer', e.target.checked)} />客户</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.isSupplier} onChange={(e) => updateForm('isSupplier', e.target.checked)} />供应商</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.isEmployee} onChange={(e) => updateForm('isEmployee', e.target.checked)} />雇员</label>
            </div>
          </div>
          <div>
            <Label className="text-xs text-slate-500">联系人</Label>
            <Input value={form.contact} onChange={(e) => updateForm('contact', e.target.value)} className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">联系电话</Label>
            <Input value={form.phone} onChange={(e) => updateForm('phone', e.target.value)} className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">电子邮箱</Label>
            <Input value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">地址</Label>
            <Input value={form.address} onChange={(e) => updateForm('address', e.target.value)} className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">税号</Label>
            <Input value={form.taxNumber} onChange={(e) => updateForm('taxNumber', e.target.value)} className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">开户银行</Label>
            <Input value={form.bankName} onChange={(e) => updateForm('bankName', e.target.value)} className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">银行账号</Label>
            <Input value={form.bankAccount} onChange={(e) => updateForm('bankAccount', e.target.value)} className="h-9 text-sm" autoComplete="off" />
          </div>
          <div>
            <Label className="text-xs text-slate-500">部门</Label>
            <DepartmentPopover
              value={form.departmentCode}
              onSelect={(code, name) => {
                updateForm('departmentCode', code);
                updateForm('departmentName', name);
              }}
              placeholder="选择部门"
            />
          </div>
          <div>
            <Label className="text-xs text-slate-500">默认币别</Label>
            <select
              value={form.defaultCurrency}
              onChange={(e) => {
                const currency = e.target.value;
                if (!currency) {
                  // 切回 CNY 时清空原币/汇率，本币保留
                  updateForm('openingForeignBalance', 0);
                  updateForm('openingExchangeRate', 0);
                }
                updateForm('defaultCurrency', currency);
              }}
              className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm bg-white"
            >
              <option value="">人民币 (CNY)</option>
              {enabledCurrencies
                .filter(c => c.code !== 'CNY' && c.code !== 'RMB')
                .map(c => (
                  <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
                ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-slate-500">账期天数</Label>
            <Input type="number" value={form.paymentTermDays || ''} onChange={(e) => updateForm('paymentTermDays', parseInt(e.target.value, 10) || 30)} className="h-9 text-sm" autoComplete="off" />
          </div>
          {(() => {
            const isForeign = !!form.defaultCurrency && form.defaultCurrency !== 'CNY' && form.defaultCurrency !== 'RMB';
            if (!isForeign) {
              return (
                <div>
                  <Label className="text-xs text-slate-500">期初余额（本币）</Label>
                  <Input type="number" value={form.openingBalance || ''} onChange={(e) => updateForm('openingBalance', parseFloat(e.target.value) || 0)} className="h-9 text-sm" autoComplete="off" />
                </div>
              );
            }
            return (
              <>
                <div>
                  <Label className="text-xs text-slate-500">期初原币余额</Label>
                  <Input
                    type="number"
                    value={form.openingForeignBalance || ''}
                    onChange={(e) => {
                      const foreign = parseFloat(e.target.value) || 0;
                      const base = round2(foreign * (form.openingExchangeRate || 0));
                      setForm(prev => ({ ...prev, openingForeignBalance: foreign, openingBalance: base }));
                    }}
                    className="h-9 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">期初汇率</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={form.openingExchangeRate || ''}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value) || 0;
                      const base = round2((form.openingForeignBalance || 0) * rate);
                      setForm(prev => ({ ...prev, openingExchangeRate: rate, openingBalance: base }));
                    }}
                    className="h-9 text-sm"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500">期初本币余额</Label>
                  <Input
                    type="number"
                    value={form.openingBalance || ''}
                    onChange={(e) => updateForm('openingBalance', parseFloat(e.target.value) || 0)}
                    className="h-9 text-sm bg-slate-50"
                    autoComplete="off"
                  />
                </div>
              </>
            );
          })()}
          {form.isEmployee && (
            <>
              <div>
                <Label className="text-xs text-slate-500">证件类型</Label>
                <select value={form.idType} onChange={(e) => updateForm('idType', e.target.value)} className="h-9 w-full rounded-md border px-2 text-sm">
                  {ID_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t || '--'}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">证件号码</Label>
                <Input value={form.idNumber} onChange={(e) => updateForm('idNumber', e.target.value)} className="h-9 text-sm" autoComplete="off" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">雇佣开始日期</Label>
                <ChineseDatePicker value={form.employmentStartDate} onChange={(v) => updateForm('employmentStartDate', v)} className="w-full" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">雇佣结束日期</Label>
                <ChineseDatePicker value={form.employmentEndDate} onChange={(v) => updateForm('employmentEndDate', v)} className="w-full" />
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={submitAdd} disabled={!form.code || !form.name}>
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

      {/* Partner list with edit button per row */}
      {partners.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">代码</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600">名称</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">身份</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-16">币别</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">期初原币</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-24">汇率</th>
                <th className="px-3 py-2 text-right font-medium text-slate-600 w-28">期初本币</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-24">联系人</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">电话</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">税号</th>
                <th className="px-3 py-2 text-left font-medium text-slate-600 w-32">开户银行/账号</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {partners.map(p => {
                const isEditing = editingId === p.id;
                const isPosted = lockedPartnerKeys.has(p.name);
                if (isEditing) {
                  return (
                    <tr key={p.id} className="border-t bg-blue-50/40">
                      <td className="px-2 py-1">
                        <Input value={editForm.code} onChange={(e) => updateEditForm('code', e.target.value.toUpperCase())} className="h-8 text-xs font-mono" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={editForm.name} onChange={(e) => updateEditForm('name', e.target.value)} className="h-8 text-sm" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1 text-xs">
                          <label className="flex items-center gap-0.5"><input type="checkbox" checked={editForm.isCustomer} onChange={(e) => updateEditForm('isCustomer', e.target.checked)} />客</label>
                          <label className="flex items-center gap-0.5"><input type="checkbox" checked={editForm.isSupplier} onChange={(e) => updateEditForm('isSupplier', e.target.checked)} />供</label>
                          <label className="flex items-center gap-0.5"><input type="checkbox" checked={editForm.isEmployee} onChange={(e) => updateEditForm('isEmployee', e.target.checked)} />员</label>
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={editForm.defaultCurrency}
                          onChange={(e) => {
                            const currency = e.target.value;
                            if (!currency) {
                              setEditForm(prev => ({ ...prev, openingForeignBalance: 0, openingExchangeRate: 0 }));
                            }
                            updateEditForm('defaultCurrency', currency);
                          }}
                          disabled={isPosted}
                          className="h-8 w-full rounded-md border border-slate-200 px-1 text-xs bg-white disabled:bg-slate-100"
                        >
                          <option value="">CNY</option>
                          {enabledCurrencies
                            .filter(c => c.code !== 'CNY' && c.code !== 'RMB')
                            .map(c => (
                              <option key={c.id} value={c.code}>{c.code}</option>
                            ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">
                        {(() => {
                          const isForeign = !!editForm.defaultCurrency && editForm.defaultCurrency !== 'CNY' && editForm.defaultCurrency !== 'RMB';
                          if (!isForeign) {
                            return <span className="text-slate-300 text-xs">—</span>;
                          }
                          return (
                            <Input
                              type="number"
                              value={editForm.openingForeignBalance || ''}
                              onChange={(e) => {
                                const foreign = parseFloat(e.target.value) || 0;
                                const base = round2(foreign * (editForm.openingExchangeRate || 0));
                                setEditForm(prev => ({ ...prev, openingForeignBalance: foreign, openingBalance: base }));
                              }}
                              disabled={isPosted}
                              className="h-8 text-xs text-right disabled:bg-slate-100"
                              autoComplete="off"
                            />
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1">
                        {(() => {
                          const isForeign = !!editForm.defaultCurrency && editForm.defaultCurrency !== 'CNY' && editForm.defaultCurrency !== 'RMB';
                          if (!isForeign) {
                            return <span className="text-slate-300 text-xs">—</span>;
                          }
                          return (
                            <Input
                              type="number"
                              step="0.0001"
                              value={editForm.openingExchangeRate || ''}
                              onChange={(e) => {
                                const rate = parseFloat(e.target.value) || 0;
                                const base = round2((editForm.openingForeignBalance || 0) * rate);
                                setEditForm(prev => ({ ...prev, openingExchangeRate: rate, openingBalance: base }));
                              }}
                              disabled={isPosted}
                              className="h-8 text-xs text-right disabled:bg-slate-100"
                              autoComplete="off"
                            />
                          );
                        })()}
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          value={editForm.openingBalance || ''}
                          onChange={(e) => updateEditForm('openingBalance', parseFloat(e.target.value) || 0)}
                          disabled={isPosted}
                          className="h-8 text-xs text-right disabled:bg-slate-100"
                          autoComplete="off"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={editForm.contact} onChange={(e) => updateEditForm('contact', e.target.value)} className="h-8 text-xs" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={editForm.phone} onChange={(e) => updateEditForm('phone', e.target.value)} className="h-8 text-xs" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <Input value={editForm.taxNumber} onChange={(e) => updateEditForm('taxNumber', e.target.value)} className="h-8 text-xs font-mono" autoComplete="off" />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex gap-1">
                          <Input value={editForm.bankName} onChange={(e) => updateEditForm('bankName', e.target.value)} placeholder="银行" className="h-8 text-xs" autoComplete="off" />
                          <Input value={editForm.bankAccount} onChange={(e) => updateEditForm('bankAccount', e.target.value)} placeholder="账号" className="h-8 text-xs font-mono" autoComplete="off" />
                        </div>
                      </td>
                      <td className="px-3 py-1">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={saveEdit} className="h-7 w-7 p-0 text-green-600 hover:text-green-700">
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 w-7 p-0 text-slate-500">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={p.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-xs">{p.code}</td>
                    <td className="px-3 py-2 font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-xs">{getTypeDisplay(p)}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">{p.defaultCurrency && p.defaultCurrency !== 'CNY' && p.defaultCurrency !== 'RMB' ? p.defaultCurrency : 'CNY'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {p.defaultCurrency && p.defaultCurrency !== 'CNY' && p.defaultCurrency !== 'RMB' && p.openingForeignBalance
                        ? p.openingForeignBalance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {p.defaultCurrency && p.defaultCurrency !== 'CNY' && p.defaultCurrency !== 'RMB' && p.openingExchangeRate
                        ? p.openingExchangeRate
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{(p.openingBalance || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-slate-600">{p.contact || '-'}</td>
                    <td className="px-3 py-2 text-slate-600">{p.phone || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 font-mono text-xs">{p.taxNumber || '-'}</td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {p.bankName || p.bankAccount ? `${p.bankName || ''} ${p.bankAccount || ''}` : '-'}
                    </td>
                    <td className="px-3 py-1">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(p)} className="h-7 w-7 p-0">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => !isPosted && handleDelete(p.id)}
                          disabled={isPosted}
                          title={isPosted ? '已入账期初凭证，无法删除。如需调整请先冲销期初凭证' : '删除'}
                          className={`h-7 w-7 p-0 ${isPosted ? 'text-slate-300 cursor-not-allowed' : 'text-red-500 hover:text-red-700'}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
