'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Upload,
  Download,
  Users,
  Building2,
  User,
  Edit,
  Trash2,
  Save,
  Phone,
  Lock,
  Unlock,
  Merge,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { exportToExcel, importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { usePartnerStore } from '@/stores/usePartnerStore';
import type { PartnerMergePreview } from '@/lib/database/services/partner-sqlite-service';
import { useCurrencyStore } from '@/stores/useCurrencyStore';
import { useSubjectStore } from '@/stores';
import { DepartmentPopover } from '@/components/shared/subject-popover';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import {
  generatePartnerCode,
  pickPartnerTypePriority,
  type PartnerCodeType,
} from '@/lib/partner-code-generator';
import type { Partner } from '@/types';

type PartnerTemplateSample = {
  code: string;
  name: string;
  departmentCode: string;
  departmentName: string;
  isCustomer: string;
  isSupplier: string;
  isEmployee: string;
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
};

type PartnerTemplateHeader = {
  key: keyof PartnerTemplateSample;
  label: string;
  placeholder?: string;
};

/** Popover 风格科目选择器：点击展开，选中后只显示 Tag */
function SubjectSearchPopover({ onSelect, placeholder }: {
  onSelect: (code: string, name: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const { subjects } = useSubjectStore();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 搜索过滤（只显示叶子科目，即没有子科目的）
  const filtered = subjects.filter(s => {
    const hasChildren = subjects.some(c => c.parentId === s.id);
    if (hasChildren) return false;
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm text-left text-slate-400 hover:border-slate-400 transition-colors"
      >
        {placeholder || '点击选择科目...'}
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="搜索科目代码或名称..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">无匹配科目</div>
            ) : (
              filtered.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 flex items-center gap-2 transition-colors"
                  onClick={() => { onSelect(s.code, s.name); setOpen(false); setSearchText(''); }}
                >
                  <span className="font-mono text-slate-600">{s.code}</span>
                  <span>{s.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuxiliaryDataPage() {
  const { showToast } = useToast();
  const partnerStore = usePartnerStore();
  const currencyStore = useCurrencyStore();
  const hasInitializedPartnersRef = useRef(false);

  const [partners, setPartners] = useState<Partner[]>(partnerStore.partners);
  // 渲染期同步 store → 本地 state（避免 effect 级联渲染）
  const [prevStorePartners, setPrevStorePartners] = useState(partnerStore.partners);
  if (partnerStore.partners !== prevStorePartners) {
    setPrevStorePartners(partnerStore.partners);
    setPartners(partnerStore.partners);
  }
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [mergeSource, setMergeSource] = useState<Partner | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergePreview, setMergePreview] = useState<PartnerMergePreview | null>(null);
  const [mergeInProgress, setMergeInProgress] = useState(false);

  // Excel导入相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (hasInitializedPartnersRef.current) return;
    hasInitializedPartnersRef.current = true;
    void partnerStore.initializePartners();
    void currencyStore.initializeCurrencies();
  }, [partnerStore, currencyStore]);

  const [formData, setFormData] = useState({
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
    defaultSubjectCode: '',
    defaultSubjectName: '',
    defaultCurrency: '',
    openingForeignBalance: undefined,
    openingExchangeRate: undefined,
    departmentCode: '',
    departmentName: '',
    payrollSalaryExpenseSubjectCode: '',
    payrollSalaryExpenseSubjectName: '',
    idType: '',
    idNumber: '',
    employmentStartDate: '',
    employmentEndDate: '',
    paymentTermDays: 30,
    frozen: false
  });

  // 过滤后的数据
  const filteredPartners = partners.filter(partner => {
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return partner.code.toLowerCase().includes(query) ||
           partner.name.toLowerCase().includes(query) ||
           (partner.departmentCode || '').toLowerCase().includes(query) ||
           (partner.departmentName || '').toLowerCase().includes(query);
  });

  const getPartnerTypes = (partner: Partner) => {
    const types: Array<{ label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = [];
    if (partner.isCustomer) types.push({ label: '客户', variant: 'default' });
    if (partner.isSupplier) types.push({ label: '供应商', variant: 'secondary' });
    if (partner.isEmployee) types.push({ label: '雇员', variant: 'outline' });
    return types;
  };

  const getTypeBadgeClass = (label: string) => {
    switch (label) {
      case '客户':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case '供应商':
        return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
      case '雇员':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      default:
        return '';
    }
  };

  const handleAddPartner = async () => {
    if (!formData.name) {
      showToast('error', '请填写必填字段：单位名称');
      return;
    }

    // 检查必须至少选择一种身份
    if (!formData.isCustomer && !formData.isSupplier && !formData.isEmployee) {
      showToast('error', '请至少勾选一种身份：客户、供应商或雇员');
      return;
    }

    // 代码为空时按类型前缀自动编号
    let normalizedCode = formData.code.toUpperCase();
    if (!normalizedCode) {
      const type = pickPartnerTypePriority(formData.isCustomer, formData.isSupplier, formData.isEmployee);
      normalizedCode = generatePartnerCode(
        partners.map(p => p.code),
        type as PartnerCodeType,
      );
    }

    // 检查代码是否重复
    const existingPartner = partners.find(p => p.code === normalizedCode);
    if (existingPartner && (!editingId || existingPartner.id !== editingId)) {
      showToast('error', `往来单位代码 ${normalizedCode} 已存在，请使用其他代码`);
      return;
    }

    const dataToSave = { ...formData, code: normalizedCode };
    try {
      if (editingId) {
        // 更新
        await partnerStore.updatePartner(editingId, dataToSave);
        showToast('success', '往来单位更新成功');
      } else {
        // 添加
        await partnerStore.addPartner(dataToSave);
        showToast('success', '往来单位添加成功');
      }

      setShowDialog(false);
      resetFormData();
      setEditingId(null);
      setPartners(usePartnerStore.getState().partners);
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleEdit = (partner: Partner) => {
    setEditingId(partner.id);
    setFormData({
      code: partner.code,
      name: partner.name,
      isCustomer: partner.isCustomer,
      isSupplier: partner.isSupplier,
      isEmployee: partner.isEmployee,
      contact: partner.contact || '',
      phone: partner.phone || '',
      email: partner.email || '',
      address: partner.address || '',
      taxNumber: partner.taxNumber || '',
      bankAccount: partner.bankAccount || '',
      bankName: partner.bankName || '',
      defaultSubjectCode: partner.defaultSubjectCode || '',
      defaultSubjectName: partner.defaultSubjectName || '',
      defaultCurrency: partner.defaultCurrency || '',
      openingForeignBalance: partner.openingForeignBalance,
      openingExchangeRate: partner.openingExchangeRate,
      departmentCode: partner.departmentCode || '',
      departmentName: partner.departmentName || '',
      payrollSalaryExpenseSubjectCode: partner.payrollSalaryExpenseSubjectCode || '',
      payrollSalaryExpenseSubjectName: partner.payrollSalaryExpenseSubjectName || '',
      idType: partner.idType || '',
      idNumber: partner.idNumber || '',
      employmentStartDate: partner.employmentStartDate || '',
      employmentEndDate: partner.employmentEndDate || '',
      paymentTermDays: partner.paymentTermDays ?? 30,
      frozen: partner.frozen
    });
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    const partner = partners.find(p => p.id === id);
    if (!partner) return;
    if (partner.frozen) {
      showToast('warning', '该往来单位已冻结，无法删除');
      return;
    }

    // 显示确认对话框
    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: `确定要删除往来单位 ${partner.code} - ${partner.name} 吗？`,
      onConfirm: async () => {
        await partnerStore.deletePartner(id);
        setPartners(usePartnerStore.getState().partners);
        showToast('success', '往来单位删除成功');
        setConfirmDialog(null);
      }
    });
  };

  const handleToggleFrozen = async (id: string) => {
    try {
      await partnerStore.toggleFrozen(id);
      setPartners(usePartnerStore.getState().partners);
      showToast('success', '冻结状态已更新');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleImport = async () => {
    if (fileInputRef.current && fileInputRef.current.files?.length > 0) {
      try {
        const file = fileInputRef.current.files[0];

        // 导入往来单位数据
    const headers = [
      { key: 'code' as keyof Partner, label: '单位代码', required: true },
      { key: 'name' as keyof Partner, label: '单位名称', required: true },
      { key: 'departmentCode' as keyof Partner, label: '部门代码' },
      { key: 'departmentName' as keyof Partner, label: '部门名称' },
      { key: 'isCustomer' as keyof Partner, label: '是否客户' },
      { key: 'isSupplier' as keyof Partner, label: '是否供应商' },
      { key: 'isEmployee' as keyof Partner, label: '是否雇员' },
          { key: 'contact' as keyof Partner, label: '联系人' },
          { key: 'phone' as keyof Partner, label: '联系电话' },
          { key: 'email' as keyof Partner, label: '电子邮箱' },
          { key: 'address' as keyof Partner, label: '地址' },
          { key: 'taxNumber' as keyof Partner, label: '税号' },
          { key: 'bankAccount' as keyof Partner, label: '银行账号' },
          { key: 'bankName' as keyof Partner, label: '开户银行' },
          { key: 'idType' as keyof Partner, label: '证件类型' },
          { key: 'idNumber' as keyof Partner, label: '证件号码' },
          { key: 'employmentStartDate' as keyof Partner, label: '雇佣开始日期' },
          { key: 'employmentEndDate' as keyof Partner, label: '雇佣结束日期' }
        ];

        const importedData = await importFromExcel<Partner>(file, headers);

        const existingCodes = usePartnerStore.getState().partners.map(p => p.code);
        const usedCodesInBatch = new Set<string>();

        const newItems = importedData.map(item => {
          let code = (item.code || '').trim().toUpperCase();
          if (!code) {
            const type = pickPartnerTypePriority(
              Boolean(item.isCustomer),
              Boolean(item.isSupplier),
              Boolean(item.isEmployee),
            );
            if (type) {
              const pool = [...existingCodes, ...Array.from(usedCodesInBatch)];
              code = generatePartnerCode(pool, type);
              usedCodesInBatch.add(code);
            }
          }
          return {
            ...item,
            id: `partner_${Date.now()}_${Math.random()}`,
            code,
            frozen: item.frozen || false,
            isCustomer: item.isCustomer || false,
            isSupplier: item.isSupplier || false,
            isEmployee: item.isEmployee || false,
            createdAt: new Date().toISOString().split('T')[0]
          };
        });

        await partnerStore.importPartners(newItems);
        setPartners(usePartnerStore.getState().partners);
        showToast('success', `成功导入 ${newItems.length} 条往来单位数据`);

        fileInputRef.current.value = '';
      } catch (error) {
        showToast('error', `导入失败：${error instanceof Error ? error.message : '未知错误'}`);
      }
    } else {
      // 触发文件选择
      fileInputRef.current?.click();
    }
  };

  const handleExport = () => {
    const dataToExport = filteredPartners;
    if (dataToExport.length === 0) {
      showToast('warning', '没有可导出的数据');
      return;
    }

    // 导出往来单位数据
    const exportData = dataToExport.map(partner => ({
      '单位代码': partner.code,
      '单位名称': partner.name,
      '部门代码': partner.departmentCode || '',
      '部门名称': partner.departmentName || '',
      '是否客户': partner.isCustomer ? '是' : '否',
      '是否供应商': partner.isSupplier ? '是' : '否',
      '是否雇员': partner.isEmployee ? '是' : '否',
      '联系人': partner.contact || '',
      '联系电话': partner.phone || '',
      '电子邮箱': partner.email || '',
      '地址': partner.address || '',
      '税号': partner.taxNumber || '',
      '银行账号': partner.bankAccount || '',
      '开户银行': partner.bankName || '',
      '证件类型': partner.idType || '',
      '证件号码': partner.idNumber || '',
      '雇佣开始日期': partner.employmentStartDate || '',
      '雇佣结束日期': partner.employmentEndDate || '',
      '冻结状态': partner.frozen ? '是' : '否',
      '创建时间': partner.createTime
    }));

    exportToExcel(exportData, '往来单位数据');
    showToast('success', '往来单位数据导出成功');
  };

  // 导出模板
  const handleExportTemplate = () => {
    const sampleData: PartnerTemplateSample = {
      code: 'AUX001',
      name: '示例往来单位',
      departmentCode: 'DEPT001',
      departmentName: '销售部',
      isCustomer: '是',
      isSupplier: '否',
      isEmployee: '否',
      contact: '张三',
      phone: '021-12345678',
      email: 'example@email.com',
      address: '上海市浦东新区',
      taxNumber: '310115XXXXXXXX',
      bankAccount: '622588XXXXXXXXXXX',
      bankName: '中国工商银行',
      idType: '',
      idNumber: '',
      employmentStartDate: '',
      employmentEndDate: ''
    };

    const headers: PartnerTemplateHeader[] = [
      { key: 'code', label: '单位代码' },
      { key: 'name', label: '单位名称' },
      { key: 'departmentCode', label: '部门代码' },
      { key: 'departmentName', label: '部门名称' },
      { key: 'isCustomer', label: '是否客户', placeholder: '是/否' },
      { key: 'isSupplier', label: '是否供应商', placeholder: '是/否' },
      { key: 'isEmployee', label: '是否雇员', placeholder: '是/否' },
      { key: 'contact', label: '联系人' },
      { key: 'phone', label: '联系电话' },
      { key: 'email', label: '电子邮箱' },
      { key: 'address', label: '地址' },
      { key: 'taxNumber', label: '税号' },
      { key: 'bankAccount', label: '银行账号' },
      { key: 'bankName', label: '开户银行' },
      { key: 'idType', label: '证件类型', placeholder: '居民身份证/护照等' },
      { key: 'idNumber', label: '证件号码' },
      { key: 'employmentStartDate', label: '雇佣开始日期', placeholder: 'YYYY-MM-DD' },
      { key: 'employmentEndDate', label: '雇佣结束日期', placeholder: 'YYYY-MM-DD' }
    ];

    exportTemplate('往来单位', sampleData, headers);
    showToast('success', '往来单位模板导出成功');
  };

  const showMergeDialogFor = async (partner: Partner) => {
    setMergeSource(partner);
    setMergeTargetId(null);
    setMergePreview(null);
    setShowMergeDialog(true);
    try {
      const preview = await partnerStore.previewPartnerMerge(partner.name);
      setMergePreview(preview);
    } catch (err) {
      console.error('Failed to load merge preview:', err);
    }
  };

  const closeMergeDialog = () => {
    setShowMergeDialog(false);
    setMergeSource(null);
    setMergeTargetId(null);
    setMergePreview(null);
  };

  const confirmMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    const target = partnerStore.partners.find(p => p.id === mergeTargetId);
    if (!target) {
      showToast('error', '目标往来单位不存在');
      return;
    }
    setMergeInProgress(true);
    try {
      const result = await partnerStore.mergePartners(mergeSource.id, mergeTargetId);
      showToast(
        'success',
        `已转移 ${result.vouchersUpdated} 条分录、${result.invoicesUpdated} 张发票、${result.mappingsUpdated} 条供应商映射，源卡已删除`,
      );
      closeMergeDialog();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '合并失败');
    } finally {
      setMergeInProgress(false);
    }
  };

  const resetFormData = () => {
    setFormData({
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
      defaultSubjectCode: '',
      defaultSubjectName: '',
      defaultCurrency: '',
      openingForeignBalance: undefined,
      openingExchangeRate: undefined,
      departmentCode: '',
      departmentName: '',
      payrollSalaryExpenseSubjectCode: '',
      payrollSalaryExpenseSubjectName: '',
      idType: '',
      idNumber: '',
      employmentStartDate: '',
      employmentEndDate: '',
      paymentTermDays: 30,
      frozen: false
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">往来单位管理</h1>
          <p className="text-slate-600 mt-1">管理客户、供应商、雇员档案</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">往来单位总数</p>
                <p className="text-3xl font-bold text-slate-900">{partners.length}</p>
              </div>
              <Users className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">客户数量</p>
                <p className="text-3xl font-bold text-green-600">{partnerStore.getPartnersByType('customer').length}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">供应商数量</p>
                <p className="text-3xl font-bold text-orange-600">{partnerStore.getPartnersByType('supplier').length}</p>
              </div>
              <Building2 className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">雇员数量</p>
                <p className="text-3xl font-bold text-purple-600">{partnerStore.getPartnersByType('employee').length}</p>
              </div>
              <User className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 操作栏 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索单位代码或名称..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingId(null);
                resetFormData();
                setShowDialog(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              新增往来单位
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
            >
              <Upload className="h-4 w-4 mr-2" />
              导入
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              导出
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              导出模板
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 隐藏的文件输入 */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      {/* 往来单位列表 */}
      <Card>
        <CardHeader>
          <CardTitle>往来单位列表</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPartners.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无往来单位数据</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setEditingId(null);
                  resetFormData();
                  setShowDialog(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加第一个往来单位
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      单位代码
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      单位名称
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      部门
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      身份
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      联系人
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      联系电话
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      状态
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-700">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.map((partner) => {
                    const types = getPartnerTypes(partner);
                    return (
                      <tr key={partner.id} className="hover:bg-slate-50 border-b">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">{partner.code}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{partner.name}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {partner.departmentName || partner.departmentCode || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {types.map((type) => (
                              <Badge key={type.label} className={getTypeBadgeClass(type.label)}>
                                {type.label}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {partner.contact || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {partner.phone ? (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {partner.phone}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {partner.frozen && (
                              <Badge variant="destructive" className="text-xs">
                                <Lock className="h-3 w-3 mr-1" />
                                已冻结
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(partner)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleToggleFrozen(partner.id)}
                              title={partner.frozen ? '解冻' : '冻结'}
                            >
                              {partner.frozen ? <Unlock className="h-3 w-3 text-green-500" /> : <Lock className="h-3 w-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-orange-500"
                              onClick={() => showMergeDialogFor(partner)}
                              title="合并/关联"
                            >
                              <Merge className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleDelete(partner.id)}
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
          )}
        </CardContent>
      </Card>

      {/* 新增/编辑往来单位对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <form autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? '编辑往来单位' : '新增往来单位'}
              </DialogTitle>
            </DialogHeader>

          {/* 左右双栏布局：左侧灰底基本信息 + 右侧白底账务设置 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-2">
            {/* ========== 左侧栏：基本信息（浅灰底） ========== */}
            <div className="bg-slate-50 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 pb-2">基本信息</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">单位代码</Label>
                  <Input placeholder="留空自动编号" value={formData.code} onChange={e => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                  <p className="text-[11px] text-slate-400 leading-tight">
                    留空时按 客户(CUS)/供应商(SUP)/雇员(EMP) 自动编号
                    {(() => {
                      const type = pickPartnerTypePriority(formData.isCustomer, formData.isSupplier, formData.isEmployee);
                      if (formData.code || !type) return null;
                      const preview = generatePartnerCode(partners.map(p => p.code), type);
                      return (
                        <span className="block text-slate-500 mt-0.5">
                          预览：<span className="font-mono">{preview}</span>
                        </span>
                      );
                    })()}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label required className="font-semibold text-sm">单位名称</Label>
                  <Input placeholder="输入单位名称" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                </div>
              </div>

              {/* 身份选择 */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">身份（至少勾选一项）</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={formData.isCustomer} onChange={e => setFormData(prev => ({ ...prev, isCustomer: e.target.checked }))} className="rounded" autoComplete="off" />
                    <span className="text-sm">客户</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={formData.isSupplier} onChange={e => setFormData(prev => ({ ...prev, isSupplier: e.target.checked }))} className="rounded" autoComplete="off" />
                    <span className="text-sm">供应商</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={formData.isEmployee} onChange={e => setFormData(prev => ({ ...prev, isEmployee: e.target.checked }))} className="rounded" autoComplete="off" />
                    <span className="text-sm">雇员</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">联系人</Label>
                  <Input placeholder="联系人姓名" value={formData.contact} onChange={e => setFormData(prev => ({ ...prev, contact: e.target.value }))} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">联系电话</Label>
                  <Input placeholder="联系电话" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">地址</Label>
                <Input placeholder="单位地址" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} autoComplete="off" autoCapitalize="none" spellCheck={false} />
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">部门</Label>
                <DepartmentPopover
                  value={formData.departmentCode}
                  onSelect={(code, name) => setFormData(prev => ({ ...prev, departmentCode: code, departmentName: name }))}
                  placeholder="选择部门"
                />
              </div>
            </div>

            {/* ========== 右侧栏：账务设置（白底） ========== */}
            <div className="bg-white rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 pb-2">账务设置</h3>

              {/* 横向布局：邮箱 */}
              <div className="flex items-center gap-3">
                <Label className="font-semibold text-sm w-20 shrink-0 text-right">电子邮箱</Label>
                <Input placeholder="电子邮箱" name="partner-contact-channel" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} className="flex-1" autoComplete="new-password" autoCapitalize="none" spellCheck={false} />
              </div>

              {/* 横向布局：税号（仅客户/供应商显示） */}
              {(formData.isCustomer || formData.isSupplier) && (
              <div className="flex items-center gap-3">
                <Label className="font-semibold text-sm w-20 shrink-0 text-right">税号</Label>
                <Input placeholder="纳税人识别号" value={formData.taxNumber} onChange={e => setFormData(prev => ({ ...prev, taxNumber: e.target.value }))} className="flex-1" autoComplete="off" autoCapitalize="none" spellCheck={false} />
              </div>
              )}

              {/* 横向布局：开户银行 */}
              <div className="flex items-center gap-3">
                <Label className="font-semibold text-sm w-20 shrink-0 text-right">开户银行</Label>
                <Input placeholder="开户银行" value={formData.bankName} onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))} className="flex-1" autoComplete="off" autoCapitalize="none" spellCheck={false} />
              </div>

              {/* 横向布局：银行账号 */}
              <div className="flex items-center gap-3">
                <Label className="font-semibold text-sm w-20 shrink-0 text-right">银行账号</Label>
                <Input placeholder="银行账号" value={formData.bankAccount} onChange={e => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))} className="flex-1" autoComplete="off" autoCapitalize="none" spellCheck={false} />
              </div>

              {/* 默认科目 - Popover 风格 */}
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">默认对方科目</Label>
                <p className="text-xs text-slate-400">
                  流水匹配时自动使用。供应商建议 &quot;应付账款&quot;，客户建议 &quot;应收账款&quot;
                </p>
                {formData.defaultSubjectCode ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
                      {formData.defaultSubjectCode} {formData.defaultSubjectName}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, defaultSubjectCode: '', defaultSubjectName: '' }))}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      清除
                    </button>
                  </div>
                ) : (
                  <SubjectSearchPopover
                    onSelect={(code, name) => setFormData(prev => ({ ...prev, defaultSubjectCode: code, defaultSubjectName: name }))}
                    placeholder="点击选择科目..."
                  />
                )}
              </div>

              {/* 默认币别 */}
              <div className="flex items-center gap-3">
                <Label className="font-semibold text-sm w-20 shrink-0 text-right">默认币别</Label>
                <select
                  className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm bg-white"
                  value={formData.defaultCurrency}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    defaultCurrency: e.target.value,
                    // 切回 CNY 时清空外币字段，避免残留
                    ...(e.target.value ? {} : { openingForeignBalance: undefined, openingExchangeRate: undefined }),
                  }))}
                  autoComplete="off"
                >
                  <option value="">人民币 (CNY)</option>
                  {currencyStore.getEnabledCurrencies()
                    .filter(c => c.code !== 'CNY' && c.code !== 'RMB')
                    .map(c => (
                      <option key={c.id} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </div>

              {/* 外币期初信息：仅当默认币别非 CNY 时显示 */}
              {formData.defaultCurrency && (
                <div className="grid grid-cols-2 gap-3 rounded-md border border-amber-200 bg-amber-50/40 p-3">
                  <div className="space-y-1">
                    <Label className="text-sm">期初原币余额 ({formData.defaultCurrency})</Label>
                    <input
                      type="number"
                      step="0.01"
                      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm bg-white"
                      value={formData.openingForeignBalance ?? ''}
                      onChange={e => {
                        const foreign = e.target.value === '' ? undefined : parseFloat(e.target.value);
                        setFormData(prev => ({ ...prev, openingForeignBalance: foreign }));
                      }}
                      placeholder="0.00"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">期初汇率</Label>
                    <input
                      type="number"
                      step="0.0001"
                      className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm bg-white"
                      value={formData.openingExchangeRate ?? ''}
                      onChange={e => {
                        const rate = e.target.value === '' ? undefined : parseFloat(e.target.value);
                        setFormData(prev => ({ ...prev, openingExchangeRate: rate }));
                      }}
                      placeholder="如 7.2"
                      autoComplete="off"
                    />
                  </div>
                  <div className="col-span-2 text-xs text-slate-500">
                    本币期初 = 原币 × 汇率 ＝ <span className="font-medium text-slate-700">
                      {(formData.openingForeignBalance && formData.openingExchangeRate)
                        ? (formData.openingForeignBalance * formData.openingExchangeRate).toFixed(2)
                        : '—'}
                    </span>
                  </div>
                </div>
              )}

              {formData.isEmployee && (
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  <h3 className="text-sm font-semibold text-slate-700">工资核算设置</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">证件类型</Label>
                      <select
                        className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                        value={formData.idType}
                        onChange={e => setFormData(prev => ({ ...prev, idType: e.target.value }))}
                        autoComplete="off"
                      >
                        <option value="">--</option>
                        <option value="居民身份证">居民身份证</option>
                        <option value="护照">护照</option>
                        <option value="港澳居民来往内地通行证">港澳居民来往内地通行证</option>
                        <option value="台湾居民来往大陆通行证">台湾居民来往大陆通行证</option>
                        <option value="外国人永久居留身份证">外国人永久居留身份证</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">证件号码</Label>
                      <input
                        type="text"
                        className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
                        value={formData.idNumber}
                        onChange={e => setFormData(prev => ({ ...prev, idNumber: e.target.value }))}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">雇佣开始日期</Label>
                      <ChineseDatePicker
                        value={formData.employmentStartDate || ''}
                        onChange={(v) => setFormData(prev => ({ ...prev, employmentStartDate: v }))}
                        placeholder="选择开始日期"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">雇佣结束日期</Label>
                      <ChineseDatePicker
                        value={formData.employmentEndDate || ''}
                        onChange={(v) => setFormData(prev => ({ ...prev, employmentEndDate: v }))}
                        placeholder="选择结束日期"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-semibold text-sm">工资费用科目</Label>
                    {formData.payrollSalaryExpenseSubjectCode ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
                          {formData.payrollSalaryExpenseSubjectCode} {formData.payrollSalaryExpenseSubjectName}
                        </Badge>
                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, payrollSalaryExpenseSubjectCode: '', payrollSalaryExpenseSubjectName: '' }))} className="text-xs text-slate-400 hover:text-red-500 transition-colors">清除</button>
                      </div>
                    ) : (
                      <SubjectSearchPopover onSelect={(code, name) => setFormData(prev => ({ ...prev, payrollSalaryExpenseSubjectCode: code, payrollSalaryExpenseSubjectName: name }))} placeholder="选择工资费用科目" />
                    )}
                  </div>
                </div>
              )}

              {/* 账期天数 */}
              {!formData.isEmployee && (
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-slate-600">账期天数</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={formData.paymentTermDays ?? ''}
                      onChange={e => setFormData(prev => ({ ...prev, paymentTermDays: parseInt(e.target.value) || 0 }))}
                      className="w-20 px-2 py-1 border border-slate-200 rounded text-sm"
                      placeholder="30"
                      autoComplete="off"
                    />
                    <span className="text-xs text-slate-400">天（入账日期 + 账期 = 到期日）</span>
                  </div>
                </div>
              )}

              {/* 冻结 */}
              <div className="pt-3 space-y-1">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="frozen" checked={formData.frozen} onChange={e => setFormData(prev => ({ ...prev, frozen: e.target.checked }))} className="rounded" autoComplete="off" />
                  <Label htmlFor="frozen" className="font-semibold text-sm cursor-pointer">冻结往来单位</Label>
                </div>
                <p className="text-xs text-slate-400 pl-5">冻结后无法删除</p>
              </div>
            </div>
          </div>

            <DialogFooter className="pt-2">
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowDialog(false); resetFormData(); setEditingId(null); }}>
                  取消
                </Button>
                <Button type="button" onClick={handleAddPartner}>
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 合并/关联对话框 */}
      <Dialog open={showMergeDialog} onOpenChange={(open) => { if (!open) closeMergeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>合并往来单位</DialogTitle>
            <DialogDescription>
              把源卡的所有引用（凭证分录、发票、供应商映射）转移到目标卡，并删除源卡。操作不可撤销。
            </DialogDescription>
          </DialogHeader>

          {mergeSource && (
            <div className="space-y-3 py-2">
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm">
                <div className="text-xs text-orange-700 mb-1">源卡（将被删除）</div>
                <div className="font-medium text-slate-900">{mergeSource.name}</div>
                <div className="text-xs text-slate-600 mt-0.5">
                  编码 {mergeSource.code || '—'} · 类型
                  {' '}
                  {[
                    mergeSource.isCustomer && '客户',
                    mergeSource.isSupplier && '供应商',
                    mergeSource.isEmployee && '雇员',
                  ].filter(Boolean).join('/') || '其他'}
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-600">合并到目标卡</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={mergeTargetId ?? ''}
                    onChange={(e) => setMergeTargetId(e.target.value || null)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="">请选择目标卡...</option>
                    {partnerStore.partners
                      .filter(p => p.id !== mergeSource.id)
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}（{p.code || '无编码'}）
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {mergeTargetId && (() => {
                const target = partnerStore.partners.find(p => p.id === mergeTargetId);
                if (!target) return null;
                const attrMismatch =
                  target.code !== mergeSource.code ||
                  target.isCustomer !== mergeSource.isCustomer ||
                  target.isSupplier !== mergeSource.isSupplier ||
                  target.isEmployee !== mergeSource.isEmployee;
                return (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-2">
                    <div>
                      <div className="text-xs text-slate-600 mb-0.5">目标卡（保留）</div>
                      <div className="font-medium text-slate-900">{target.name}</div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        编码 {target.code || '—'} · 类型
                        {' '}
                        {[
                          target.isCustomer && '客户',
                          target.isSupplier && '供应商',
                          target.isEmployee && '雇员',
                        ].filter(Boolean).join('/') || '其他'}
                      </div>
                    </div>
                    {attrMismatch && (
                      <div className="flex items-start gap-2 text-xs text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>目标卡的编码/类型与源卡不同，合并后将统一为目标卡的属性。</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {mergePreview && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
                  <div className="font-medium mb-1">将影响：</div>
                  <div>· <strong>{mergePreview.vouchers}</strong> 条凭证分录</div>
                  <div>· <strong>{mergePreview.invoices}</strong> 张发票</div>
                  <div>· <strong>{mergePreview.mappings}</strong> 条供应商业务组映射</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeMergeDialog} disabled={mergeInProgress} className="shadow-sm">
              取消
            </Button>
            <Button
              variant="default"
              onClick={confirmMerge}
              disabled={!mergeTargetId || mergeInProgress || (mergeTargetId === mergeSource?.id)}
              className="shadow-sm"
            >
              {mergeInProgress ? '合并中...' : '确认合并'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => setConfirmDialog(prev => prev ? { ...prev, open } : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title || '确认操作'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600 text-center">{confirmDialog?.description || '确定要执行此操作吗？'}</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmDialog(null)} className="shadow-sm">
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDialog?.onConfirm} className="shadow-sm">
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
