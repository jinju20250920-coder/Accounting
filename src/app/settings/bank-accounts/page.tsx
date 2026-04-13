'use client';

import React, { useState, useEffect } from 'react';
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
import { Plus, Trash2, Edit2, Building2, Search, X } from 'lucide-react';
import type { BankAccountBinding } from '@/lib/bank-parsers/types';

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
