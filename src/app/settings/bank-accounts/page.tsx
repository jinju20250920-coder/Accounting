'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useBankAccountStore } from '@/stores';
import { useSubjectStore } from '@/stores';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';
import { getBankList } from '@/lib/bank-parsers/bank-registry';
import { Plus, Trash2, Edit2, Building2, Search, X, Landmark, CheckCircle2, Upload, Download, FileSpreadsheet } from 'lucide-react';
import type { BankAccountBinding } from '@/lib/bank-parsers/types';

/** Bank brand colors and short identifiers for visual display */
const BANK_BRANDS: Record<string, { color: string; short: string }> = {
  ccb:        { color: '#003DA6', short: '建行' },
  icbc:       { color: '#C50019', short: '工行' },
  abc:        { color: '#008C50', short: '农行' },
  boc:        { color: '#C50019', short: '中行' },
  cmb:        { color: '#CC1931', short: '招行' },
  bocom:      { color: '#003399', short: '交行' },
  citic:      { color: '#E60012', short: '中信' },
  spdb:       { color: '#003399', short: '浦发' },
  cmbc:       { color: '#00A651', short: '民生' },
  industrial: { color: '#003399', short: '兴业' },
  czb:        { color: '#E60012', short: '浙商' },
  pingan:     { color: '#FA6400', short: '平安' },
  huaxia:     { color: '#E60012', short: '华夏' },
  shanghai:   { color: '#003DA6', short: '上海' },
};

interface FormData {
  bankId: string;
  accountNumber: string;
  aliasName: string;
}

const emptyForm: FormData = {
  bankId: '',
  accountNumber: '',
  aliasName: '',
};

export default function BankAccountsPage() {
  const { showToast } = useToast();
  const { bindings, loading, loadBindings, addBinding, updateBinding, deleteBinding } = useBankAccountStore();
  const { subjects, addSubject, deleteSubject } = useSubjectStore();
  const bankList = getBankList();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [searchQuery, setSearchQuery] = useState('');

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  // Import state
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importRows, setImportRows] = useState<Array<{ bankId: string; bankName: string; accountNumber: string; aliasName: string; _status: 'ok' | 'dup' | 'error' }>>([]);

  /** Bank name fuzzy match → bankId */
  const matchBankName = (raw: string): { id: string; name: string } | null => {
    const s = raw.trim();
    if (!s) return null;
    // Exact match first
    const exact = bankList.find(b => b.name === s || b.id === s);
    if (exact) return exact;
    // Fuzzy: "建设银行" contains "建设" etc.
    const fuzzy = bankList.find(b => s.includes(b.name) || b.name.includes(s)
      || s.includes(BANK_BRANDS[b.id]?.short || ''));
    return fuzzy || null;
  };

  // Load bindings on mount
  useEffect(() => {
    loadBindings();
  }, [loadBindings]);

  // Filter bindings by search query
  const filteredBindings = bindings.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.bankName.toLowerCase().includes(q) ||
      b.accountNumber.includes(q) ||
      b.subSubjectCode.includes(q) ||
      (b.aliasName && b.aliasName.toLowerCase().includes(q))
    );
  });

  /**
   * Generate the next available 1002 sub-subject code.
   * Scans existing subjects whose code starts with '1002' and has length > 4,
   * finds the max numeric suffix, and increments it.
   */
  const generateNextSubjectCode = (): string => {
    const bankSubjects = subjects.filter(
      (s) => s.code.startsWith('1002') && s.code.length > 4
    );
    if (bankSubjects.length === 0) {
      return '100201';
    }
    let maxSuffix = 0;
    for (const s of bankSubjects) {
      const suffix = parseInt(s.code.slice(4), 10);
      if (suffix > maxSuffix) {
        maxSuffix = suffix;
      }
    }
    const nextSuffix = maxSuffix + 1;
    return '1002' + String(nextSuffix).padStart(2, '0');
  };

  const handleAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const handleEdit = (binding: BankAccountBinding) => {
    setEditingId(binding.id);
    setFormData({
      bankId: binding.bankId,
      accountNumber: binding.accountNumber,
      aliasName: binding.aliasName || '',
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.bankId) {
      showToast('error', '请选择银行');
      return;
    }
    if (!formData.accountNumber.trim()) {
      showToast('error', '请输入银行账号');
      return;
    }

    const bank = bankList.find((b) => b.id === formData.bankId);
    if (!bank) {
      showToast('error', '未找到所选银行');
      return;
    }

    const last4Digits = formData.accountNumber.slice(-4);
    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();

    if (editingId) {
      // Update existing binding
      const existing = bindings.find((b) => b.id === editingId);
      if (!existing) return;

      const subjectName = `银行存款 - ${bank.name} (${last4Digits})`;

      await updateBinding(editingId, {
        bankId: formData.bankId,
        bankName: bank.name,
        accountNumber: formData.accountNumber.trim(),
        aliasName: formData.aliasName.trim() || undefined,
        subSubjectName: subjectName,
      });

      // Also update the subject name if it was auto-generated
      if (existing.subSubjectCode) {
        const subject = subjects.find((s) => s.code === existing.subSubjectCode);
        if (subject) {
          const { useSubjectStore: getSubjectStore } = await import('@/stores');
          getSubjectStore.getState().updateSubject(subject.id, { name: subjectName });
        }
      }

      showToast('success', '银行账户更新成功');
    } else {
      // Create new binding
      const subjectCode = generateNextSubjectCode();
      const subjectName = `银行存款 - ${bank.name} (${last4Digits})`;

      // Check for duplicate account number
      const existingBinding = bindings.find(
        (b) => b.accountNumber === formData.accountNumber.trim()
      );
      if (existingBinding) {
        showToast('error', '该银行账号已存在');
        return;
      }

      // Find the 1002 parent subject for parentId
      const parent1002 = subjects.find((s) => s.code === '1002');

      // Create the subject first
      try {
        await addSubject({
          code: subjectCode,
          name: subjectName,
          parentId: parent1002?.id || null,
          direction: 'debit',
          enableDept: false,
          enableProject: false,
          enableForeign: false,
          isCustomer: false,
          isSupplier: false,
          isEmployee: false,
          enableCashFlow: false,
          subjectType: 'Asset',
          accountSetId: currentAccountSet?.id,
          bankAccountNumber: formData.accountNumber.trim(),
        } as any);
      } catch (err) {
        showToast('error', '创建科目失败，请检查科目代码是否重复');
        return;
      }

      // Create the binding
      await addBinding({
        accountSetId: currentAccountSet?.id || '',
        accountNumber: formData.accountNumber.trim(),
        bankId: formData.bankId,
        bankName: bank.name,
        aliasName: formData.aliasName.trim() || undefined,
        subSubjectCode: subjectCode,
        subSubjectName: subjectName,
        currency: 'CNY',
        isDefault: bindings.length === 0,
      });

      showToast('success', '银行账户添加成功');
    }

    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleDelete = (binding: BankAccountBinding) => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: `确定要删除银行账户 ${binding.bankName} (${binding.accountNumber}) 吗？关联的科目 ${binding.subSubjectCode} 也将被删除。`,
      onConfirm: async () => {
        // Delete the auto-generated subject
        const subject = subjects.find((s) => s.code === binding.subSubjectCode);
        if (subject) {
          await deleteSubject(subject.id);
        }

        // Delete the binding
        await deleteBinding(binding.id);
        showToast('success', '银行账户已删除');
        setConfirmDialog(null);
      },
    });
  };

  /** Download Excel template for import */
  const handleDownloadTemplate = () => {
    const header = ['银行名称', '银行账号', '别名（可选）'];
    const example1 = ['建设银行', '6227001234567890123', '基本户'];
    const example2 = ['工商银行', '6222021234567890456', '一般户'];
    const example3 = ['招商银行', '6214831234567890', ''];

    const rows = [header, example1, example2, example3];
    const csvContent = '\uFEFF' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '银行账户导入模板.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('success', '模板已下载，请填写后导入');
  };

  /** Parse uploaded Excel/CSV and show preview */
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (data.length < 2) {
        showToast('error', '文件为空或只有表头，请检查');
        setImporting(false);
        return;
      }

      // Parse rows, skip header
      const parsed = data.slice(1)
        .filter(row => row.some((c: any) => String(c || '').trim()))
        .map((row): { bankId: string; bankName: string; accountNumber: string; aliasName: string; _status: 'ok' | 'dup' | 'error' } => {
          const rawBankName = String(row[0] || '').trim();
          const accountNumber = String(row[1] || '').trim();
          const aliasName = String(row[2] || '').trim();

          const bank = matchBankName(rawBankName);
          if (!bank) {
            return { bankId: '', bankName: rawBankName, accountNumber, aliasName, _status: 'error' };
          }
          if (!accountNumber) {
            return { bankId: bank.id, bankName: bank.name, accountNumber: '', aliasName, _status: 'error' };
          }
          const isDup = bindings.some(b => b.accountNumber === accountNumber);
          return { bankId: bank.id, bankName: bank.name, accountNumber, aliasName, _status: isDup ? 'dup' : 'ok' };
        });

      if (parsed.length === 0) {
        showToast('error', '未识别到有效的银行账户数据');
        setImporting(false);
        return;
      }

      setImportRows(parsed);
      setShowImportPreview(true);
    } catch (e) {
      showToast('error', `读取文件失败: ${(e as Error).message}`);
    } finally {
      setImporting(false);
      // Reset file input
      if (importFileRef.current) importFileRef.current.value = '';
    }
  };

  /** Confirm and execute batch import */
  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => r._status === 'ok');
    if (validRows.length === 0) {
      showToast('warning', '没有可导入的有效数据');
      return;
    }

    const accountSetStore = useAccountSetStore.getState();
    const currentAccountSet = accountSetStore.getCurrentAccountSet();
    const parent1002 = subjects.find((s) => s.code === '1002');

    let successCount = 0;
    let errorCount = 0;

    for (const row of validRows) {
      try {
        const subjectCode = generateNextSubjectCode();
        const last4 = row.accountNumber.slice(-4);
        const subjectName = `银行存款 - ${row.bankName} (${last4})`;

        // Create 1002 sub-subject
        await addSubject({
          code: subjectCode,
          name: subjectName,
          parentId: parent1002?.id || null,
          direction: 'debit',
          enableDept: false,
          enableProject: false,
          enableForeign: false,
          isCustomer: false,
          isSupplier: false,
          isEmployee: false,
          enableCashFlow: false,
          subjectType: 'Asset',
          accountSetId: currentAccountSet?.id,
          bankAccountNumber: row.accountNumber,
        } as any);

        // Create binding
        await addBinding({
          accountSetId: currentAccountSet?.id || '',
          accountNumber: row.accountNumber,
          bankId: row.bankId,
          bankName: row.bankName,
          aliasName: row.aliasName || undefined,
          subSubjectCode: subjectCode,
          subSubjectName: subjectName,
          currency: 'CNY',
          isDefault: bindings.length + successCount === 0,
        });

        successCount++;
      } catch {
        errorCount++;
      }
    }

    setShowImportPreview(false);
    setImportRows([]);
    showToast('success', `导入完成：成功 ${successCount} 条${errorCount > 0 ? `，失败 ${errorCount} 条` : ''}`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">银行账户管理</h1>
        <p className="text-slate-500 mt-1 text-sm">管理银行账户与会计科目的绑定关系</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">已绑定账户</p>
                <p className="text-2xl font-bold text-slate-900">{bindings.length}</p>
              </div>
              <Building2 className="h-7 w-7 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">支持银行</p>
                <p className="text-2xl font-bold text-blue-600">{bankList.length}</p>
              </div>
              <Building2 className="h-7 w-7 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">默认账户</p>
                <p className="text-2xl font-bold text-green-600">
                  {bindings.filter((b) => b.isDefault).length}
                </p>
              </div>
              <Building2 className="h-7 w-7 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Supported Banks Grid */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4 text-blue-500" />
              支持的银行格式（{bankList.length} 家）
            </CardTitle>
            <p className="text-xs text-slate-400">点击银行可快速添加该银行的账户</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {bankList.map((bank) => {
              const brand = BANK_BRANDS[bank.id];
              const bound = bindings.some((b) => b.bankId === bank.id);
              return (
                <button
                  key={bank.id}
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ ...emptyForm, bankId: bank.id });
                    setShowForm(true);
                  }}
                  className={`relative flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-colors ${
                    bound
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                >
                  {bound && (
                    <CheckCircle2 className="absolute top-1.5 right-1.5 h-3.5 w-3.5 text-green-500" />
                  )}
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ backgroundColor: brand?.color || '#64748b' }}
                  >
                    {brand?.short || bank.name.slice(0, 2)}
                  </div>
                  <span className="text-xs text-slate-700 font-medium leading-tight text-center">
                    {bank.name}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <Card className="mb-6">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索银行名称、账号或别名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              新增银行账户
            </Button>
            <Button variant="outline" onClick={() => importFileRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? '读取中...' : 'Excel导入'}
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              下载模板
            </Button>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
        </CardContent>
      </Card>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <Card className="mb-6 border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editingId ? '编辑银行账户' : '新增银行账户'}
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancel}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  银行名称 <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.bankId}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, bankId: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择银行" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankList.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  银行账号 <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="输入银行账号"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">别名</Label>
                <Input
                  placeholder="可选，如：基本户"
                  value={formData.aliasName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, aliasName: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-blue-100">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                取消
              </Button>
              <Button size="sm" onClick={handleSave}>
                {editingId ? '保存修改' : '确认添加'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bindings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">银行账户列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-400">
              <Building2 className="h-10 w-10 mx-auto mb-3 animate-pulse" />
              <p className="text-sm">加载中...</p>
            </div>
          ) : filteredBindings.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Building2 className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">
                {searchQuery ? '没有找到匹配的银行账户' : '暂无银行账户'}
              </p>
              {!searchQuery && (
                <Button variant="outline" className="mt-3" size="sm" onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加第一个银行账户
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      银行名称
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      账号
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      科目代码
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      别名
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBindings.map((binding) => (
                    <tr key={binding.id} className="hover:bg-slate-50 border-b">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-sm">{binding.bankName}</span>
                          {binding.isDefault && (
                            <Badge className="bg-green-50 text-green-700 text-xs">
                              默认
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-slate-700">
                          {binding.accountNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-mono">
                          {binding.subSubjectCode} {binding.subSubjectName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {binding.aliasName || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(binding)}
                            title="编辑"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500"
                            onClick={() => handleDelete(binding)}
                            title="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Preview Dialog */}
      {showImportPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-green-500" />
                  导入预览
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowImportPreview(false); setImportRows([]); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                共 {importRows.length} 条，
                <span className="text-green-600">有效 {importRows.filter(r => r._status === 'ok').length}</span>
                {importRows.some(r => r._status === 'dup') && (
                  <span className="text-yellow-600 ml-2">重复 {importRows.filter(r => r._status === 'dup').length}</span>
                )}
                {importRows.some(r => r._status === 'error') && (
                  <span className="text-red-600 ml-2">异常 {importRows.filter(r => r._status === 'error').length}</span>
                )}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">银行名称</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">账号</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">别名</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {importRows.map((row, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2">
                        {row.bankId ? (
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                              style={{ backgroundColor: BANK_BRANDS[row.bankId]?.color || '#64748b' }}
                            >
                              {BANK_BRANDS[row.bankId]?.short?.slice(0, 1) || '?'}
                            </div>
                            <span>{row.bankName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">{row.bankName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{row.accountNumber || '-'}</td>
                      <td className="px-3 py-2 text-slate-500">{row.aliasName || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        {row._status === 'ok' && (
                          <Badge className="bg-green-50 text-green-700 text-xs">待导入</Badge>
                        )}
                        {row._status === 'dup' && (
                          <Badge className="bg-yellow-50 text-yellow-700 text-xs">已存在</Badge>
                        )}
                        {row._status === 'error' && (
                          <Badge className="bg-red-50 text-red-700 text-xs">
                            {!row.bankId && !row.accountNumber ? '信息缺失' : !row.bankId ? '银行未识别' : '账号为空'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6 pt-3 border-t">
              <Button variant="outline" size="sm" onClick={() => { setShowImportPreview(false); setImportRows([]); }}>
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={importRows.filter(r => r._status === 'ok').length === 0}
              >
                <Upload className="h-4 w-4 mr-1" />
                确认导入（{importRows.filter(r => r._status === 'ok').length} 条）
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {confirmDialog.title}
              </h3>
              <p className="text-sm text-slate-600">{confirmDialog.description}</p>
            </div>
            <div className="flex justify-end gap-2 px-6 pb-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog(null)}
              >
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={confirmDialog.onConfirm}
              >
                确定删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
