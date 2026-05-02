'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Upload,
  Download,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Edit,
  Trash2,
  Ban,
  Save,
  X,
  Lock,
  Unlock,
  RefreshCw
} from 'lucide-react';
import { useSubjectStore } from '@/stores';
import { useCurrencyStore } from '@/stores';
import { Subject } from '@/types';
import { useToast } from '@/components/ui/toast';
import { exportToExcel, importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { generateCode, CodeRuleManager } from '@/lib/code-generator';

export default function SubjectsPage() {
  const { showToast } = useToast();
  const { subjects, searchQuery, filterDisabled, selectedSubjectId, addSubject, updateSubject, deleteSubject, toggleSubjectDisabled, toggleSubjectBlocked, setSearchQuery, setFilterDisabled, setSelectedSubjectId, clearError, initializeSubjects, resetToDefault, error } = useSubjectStore();

  // 初始化默认科目数据
  useEffect(() => {
    if (subjects.length === 0) {
      initializeSubjects();
    }
  }, []);

  // 默认展开有子科目的科目
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // 监听科目数据变化，更新默认展开状态
  useEffect(() => {
    const newExpanded = new Set<string>();
    const parentsWithChildren = new Set<string>();
    subjects.forEach(s => {
      if (s.parentId) {
        parentsWithChildren.add(s.parentId);
      }
    });
    parentsWithChildren.forEach(id => newExpanded.add(id));
    setExpandedSubjects(newExpanded);
  }, [subjects.length]);

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取编码规则
  const codeRuleManager = CodeRuleManager.getInstance();
  const codeRule = codeRuleManager.getRuleByType('subject');

  const subjectTree = buildSubjectTree();
  const selectedSubject = selectedSubjectId ? subjects.find(s => s.id === selectedSubjectId) : null;

  function buildSubjectTree(parentId: string | null = null, level: number = 1): any[] {
    // 如果有搜索查询，先计算所有需要显示的科目
    const visibleSubjectIds = new Set<string>();

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      // 1. 找到直接匹配的科目
      subjects.forEach(s => {
        if (s.code.toLowerCase().includes(lowerQuery) ||
            s.name.toLowerCase().includes(lowerQuery)) {
          visibleSubjectIds.add(s.id);

          // 2. 找到所有祖先科目
          let current = s.parentId;
          while (current) {
            const parent = subjects.find(sub => sub.id === current);
            if (parent) {
              visibleSubjectIds.add(parent.id);
              current = parent.parentId;
            } else {
              current = null;
            }
          }

          // 3. 找到所有后代科目
          const findDescendants = (subjectId: string) => {
            const children = subjects.filter(s => s.parentId === subjectId);
            children.forEach(child => {
              visibleSubjectIds.add(child.id);
              findDescendants(child.id);
            });
          };
          findDescendants(s.id);
        }
      });
    }

    // 获取符合条件的科目
    // 处理 parentId 为空字符串的情况（一级科目）
    let filtered = subjects
      .filter(s => {
        // 处理空字符串和 null 的统一
        const sParentId = s.parentId || null;
        const targetParentId = parentId || null;
        return sParentId === targetParentId;
      })
      .filter(s => !filterDisabled || !s.disabled);

    // 如果有搜索查询，只保留可见的科目
    if (searchQuery) {
      filtered = filtered.filter(s => visibleSubjectIds.has(s.id));
    }

    return filtered.map(s => {
      const children = buildSubjectTree(s.id, level + 1);
      return { ...s, children, level, expanded: expandedSubjects.has(s.id) || (searchQuery && children.length > 0) };
    });
  }

  const handleToggleExpand = (id: string) => {
    const newExpanded = new Set(expandedSubjects);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSubjects(newExpanded);
  };

  const handleAddSubject = () => {
    const formData = getFormData();
    console.log('保存科目数据:', formData);
    if (!formData.code || !formData.name || !formData.direction || !formData.subjectType) {
      showToast('error', '请填写必填字段：科目代码、科目名称、借贷方向、科目类型');
      return;
    }

    if (editingId) {
      // 编辑模式
      console.log('更新科目:', editingId, formData);
      updateSubject(editingId, formData as Partial<Subject>);
      showToast('success', '科目更新成功');
    } else {
      // 新增模式
      console.log('新增科目:', formData);
      addSubject(formData as any);
      showToast('success', '科目添加成功');
    }

    // 等待数据更新后检查
    setTimeout(() => {
      console.log('当前科目列表:', subjects);
    }, 100);

    setShowDialog(false);
    resetFormData();
    setEditingId(null);
    clearError();
  };

  const handleDeleteSubject = (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;
    const hasChildren = subjects.some(s => s.parentId === id);
    if (hasChildren) {
      showToast('warning', '该科目有下级科目，请先删除或移动下级科目');
      return;
    }
    // 显示确认对话框
    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: `确定要删除科目 ${subject.code} - ${subject.name} 吗？`,
      onConfirm: () => {
        deleteSubject(id);
        if (selectedSubjectId === id) setSelectedSubjectId(null);
        showToast('success', '科目删除成功');
      }
    });
  };

  const handleToggleDisabled = (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;
    const hasChildren = subjects.some(s => s.parentId === id);
    if (hasChildren) {
      showToast('warning', '该科目有下级科目，请先禁用或删除下级科目');
      return;
    }
    const newStatus = !subject.disabled;
    const action = newStatus ? '禁用' : '启用';
    // 显示确认对话框
    setConfirmDialog({
      open: true,
      title: `确认${action}`,
      description: `确定要${action}科目 ${subject.code} - ${subject.name} 吗？`,
      onConfirm: () => {
        toggleSubjectDisabled(id);
        showToast('success', `科目${action}成功`);
      }
    });
  };

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    parentId: '',
    direction: 'debit',
    enableDept: false,
    enableProject: false,
    enableForeign: false,
    foreignCurrency: '',
    isCustomer: false,
    isSupplier: false,
    isEmployee: false,
    enableCashFlow: false,
    block: false,
    subjectType: ''
  });

  const getFormData = () => formData;

  const resetFormData = () => {
    setFormData({
      code: '',
      name: '',
      parentId: '',
      direction: 'debit',
      enableDept: false,
      enableProject: false,
      enableForeign: false,
      foreignCurrency: '',
      isCustomer: false,
      isSupplier: false,
      isEmployee: false,
      enableCashFlow: false,
      block: false,
      subjectType: ''
    });
  };

  // 使用计算后的parentId，确保与formData同步
  const getComputedParentId = () => {
    // 如果正在编辑，使用编辑的科目ID，否则使用表单的parentId
    if (editingId) {
      const editingSubject = subjects.find(s => s.id === editingId);
      return editingSubject?.parentId || '';
    }
    return formData.parentId;
  };

  const handleEdit = (subject: Subject) => {
    setEditingId(subject.id);
    const computedParentId = subject.parentId || '';
    setFormData({
      code: subject.code,
      name: subject.name,
      parentId: computedParentId,
      direction: subject.direction,
      enableDept: subject.enableDept,
      enableProject: subject.enableProject,
      enableForeign: subject.enableForeign,
      foreignCurrency: subject.foreignCurrency || '',
      isCustomer: (subject as any).isCustomer || false,
      isSupplier: (subject as any).isSupplier || false,
      isEmployee: (subject as any).isEmployee || false,
      enableCashFlow: (subject as any).enableCashFlow || false,
      block: subject.block,
      subjectType: subject.subjectType || ''
    });
    setShowDialog(true);
  };

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleExport = () => {
    if (subjects.length === 0) {
      showToast('warning', '没有可导出的科目数据');
      return;
    }

    // 准备导出数据
    const exportData = subjects.map(subject => ({
      '科目代码': subject.code,
      '科目名称': subject.name,
      '上级科目': subject.parentId ? subjects.find(s => s.id === subject.parentId)?.name || '' : '',
      '借贷方向': subject.direction === 'debit' ? '借方' : '贷方',
      '部门核算': subject.enableDept ? '是' : '否',
      '项目核算': subject.enableProject ? '是' : '否',
      '外币核算': subject.enableForeign ? '是' : '否',
      '外币': subject.foreignCurrency || '',
      '客户': (subject as any).isCustomer ? '是' : '否',
      '供应商': (subject as any).isSupplier ? '是' : '否',
      '雇员': (subject as any).isEmployee ? '是' : '否',
      '现金流量': (subject as any).enableCashFlow ? '是' : '否',
      '状态': subject.block ? '停用' : (subject.disabled ? '禁用' : '正常')
    }));

    exportToExcel(exportData, '科目数据');
  };

  const handleExportTemplate = () => {
    const sampleData = {
      '科目代码': '1001',
      '科目名称': '库存现金',
      '上级科目': '',
      '借贷方向': '借方',
      '是否末级': '是',
      '部门核算': '否',
      '项目核算': '否',
      '外币核算': '否',
      '外币': '',
      '客户': '否',
      '供应商': '否',
      '雇员': '否',
      '现金流量': '否',
      '状态': '正常'
    };
    exportTemplate('科目数据', sampleData, [
      { key: 'code' as any, label: '科目代码', placeholder: '如：1001、100101' },
      { key: 'name' as any, label: '科目名称', placeholder: '输入科目名称' },
      { key: 'parentId' as any, label: '上级科目', placeholder: '留空表示顶级科目' },
      { key: 'direction' as any, label: '借贷方向', placeholder: '借方/贷方' },
      { key: 'isLeaf' as any, label: '是否末级', placeholder: '是/否' },
      { key: 'enableDept' as any, label: '部门核算', placeholder: '是/否' },
      { key: 'enableProject' as any, label: '项目核算', placeholder: '是/否' },
      { key: 'enableForeign' as any, label: '外币核算', placeholder: '是/否' },
      { key: 'foreignCurrency' as any, label: '外币', placeholder: '如：USD、CNY' },
      { key: 'isCustomer' as any, label: '客户', placeholder: '是/否' },
      { key: 'isSupplier' as any, label: '供应商', placeholder: '是/否' },
      { key: 'isEmployee' as any, label: '雇员', placeholder: '是/否' },
      { key: 'enableCashFlow' as any, label: '现金流量', placeholder: '是/否' },
      { key: 'disabled' as any, label: '状态', placeholder: '正常/禁用/停用' }
    ]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showToast('info', '正在导入数据...');

      // 定义Excel表格头映射
      const headers = [
        { key: 'code' as any, label: '科目代码', required: true },
        { key: 'name' as any, label: '科目名称', required: true },
        { key: 'parentId' as any, label: '上级科目', required: false },
        { key: 'direction' as any, label: '借贷方向', required: true },
        { key: 'isLeaf' as any, label: '是否末级', required: false },
        { key: 'enableDept' as any, label: '部门核算', required: false },
        { key: 'enableProject' as any, label: '项目核算', required: false },
        { key: 'enableForeign' as any, label: '外币核算', required: false },
        { key: 'foreignCurrency' as any, label: '外币', required: false },
        { key: 'isCustomer' as any, label: '客户', required: false },
        { key: 'isSupplier' as any, label: '供应商', required: false },
        { key: 'isEmployee' as any, label: '雇员', required: false },
        { key: 'enableCashFlow' as any, label: '现金流量', required: false },
        { key: 'disabled' as any, label: '状态', required: false }
      ];

      const importedData = await importFromExcel<Subject>(file, headers);

      // 处理导入数据
      const validSubjects = importedData.filter(subject => {
        // 检查代码是否已存在
        const exists = subjects.some(s => s.code === subject.code);
        if (exists) {
          showToast('warning', `科目代码 ${subject.code} 已存在，跳过导入`);
          return false;
        }
        return true;
      });

      // 批量添加科目
      validSubjects.forEach(subject => {
        addSubject({
          code: subject.code!,
          name: subject.name!,
          parentId: subject.parentId || null,
          level: 1, // store 内部会重新计算
          direction: subject.direction!,
          enableDept: subject.enableDept || false,
          enableProject: subject.enableProject || false,
          enableForeign: subject.enableForeign || false,
          foreignCurrency: subject.foreignCurrency || '',
          isCustomer: subject.isCustomer || false,
          isSupplier: subject.isSupplier || false,
          isEmployee: subject.isEmployee || false,
          enableCashFlow: subject.enableCashFlow || false,
          disabled: subject.disabled || false,
          block: false
        });
      });

      showToast('success', `成功导入 ${validSubjects.length} 个科目`);
      setShowDialog(false);
    } catch (error) {
      showToast('error', `导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">科目管理</h1>
        <p className="text-slate-600 mt-1">管理会计科目体系</p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="font-semibold">错误:</span>
            <span>{error}</span>
            <button onClick={clearError} className="ml-auto hover:bg-red-100 px-2 py-1 rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="搜索科目代码或名称..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); clearError(); }} className="pl-10" />
              </div>
            </div>
            <Button variant={filterDisabled ? "default" : "outline"} size="sm" onClick={() => setFilterDisabled(!filterDisabled)}>
              {filterDisabled ? '显示全部' : '仅显示启用'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新增科目
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportTemplate}>
              <Download className="h-4 w-4 mr-2" />
              导出模板
            </Button>
            <Button variant="outline" size="sm" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              导入Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              导出Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              setConfirmDialog({
                open: true,
                title: '确认重置数据',
                description: '确定要重置为默认科目数据吗？这将删除所有自定义科目！',
                onConfirm: () => {
                  resetToDefault();
                }
              });
            }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              重置数据
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>科目体系</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {subjectTree.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>暂无科目数据</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加第一个科目
                </Button>
              </div>
            ) : (
              subjectTree.map((subject) => (
                <SubjectTreeNode key={subject.id} subject={subject} onToggleExpand={handleToggleExpand} onEdit={() => handleEdit(subject)} onDelete={() => handleDeleteSubject(subject.id)} onToggleDisabled={() => handleToggleDisabled(subject.id)} onToggleBlocked={() => toggleSubjectBlocked(subject.id)} />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑科目' : '新增科目'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>科目代码</Label>
                <Input placeholder={editingId ? '' : '4位或6位数字，如1001，留空自动生成'} value={formData.code} onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))} />
                {!editingId && (
                  <p className="text-xs text-slate-500">留空则自动生成编码：{String(codeRule.lastNumber + 1).padStart(codeRule.padding, '0')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label required>科目名称</Label>
                <Input placeholder="输入科目名称" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label required>科目类型</Label>
                <select value={formData.subjectType} onChange={e => setFormData(prev => ({ ...prev, subjectType: e.target.value }))} className="w-full px-3 py-2 border rounded-md">
                  <option value="">请选择科目类型</option>
                  <option value="Asset">资产 (Asset)</option>
                  <option value="Liability">负债 (Liability)</option>
                  <option value="Equity">权益 (Equity)</option>
                  <option value="Cost">成本 (Cost)</option>
                  <option value="Profit/Loss">损益 (Profit/Loss)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>上级科目</Label>
                <select value={getComputedParentId()} onChange={e => setFormData(prev => ({ ...prev, parentId: e.target.value || null }))} className="w-full px-3 py-2 border rounded-md">
                  <option value="">无（顶级科目）</option>
                  {subjects.filter(s => !s.parentId).map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label required>借贷方向</Label>
                <select value={formData.direction} onChange={e => setFormData(prev => ({ ...prev, direction: e.target.value }))} className="w-full px-3 py-2 border rounded-md">
                  <option value="debit">借方</option>
                  <option value="credit">贷方</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>辅助核算</Label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.enableDept} onChange={e => setFormData(prev => ({ ...prev, enableDept: e.target.checked }))} className="h-4 w-4" />
                  <span>部门核算</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.enableProject} onChange={e => setFormData(prev => ({ ...prev, enableProject: e.target.checked }))} className="h-4 w-4" />
                  <span>项目核算</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.enableForeign} onChange={e => setFormData(prev => ({ ...prev, enableForeign: e.target.checked }))} className="h-4 w-4" />
                  <span>外币核算</span>
                </label>
              </div>
            </div>
            {formData.enableForeign && (
              <div className="space-y-2">
                <Label>外币币种</Label>
                <CurrencySelector
                  value={formData.foreignCurrency}
                  onChange={(value) => setFormData(prev => ({ ...prev, foreignCurrency: value }))}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>往来科目</Label>
              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isCustomer} onChange={e => setFormData(prev => ({ ...prev, isCustomer: e.target.checked }))} className="h-4 w-4" />
                  <span>客户</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isSupplier} onChange={e => setFormData(prev => ({ ...prev, isSupplier: e.target.checked }))} className="h-4 w-4" />
                  <span>供应商</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isEmployee} onChange={e => setFormData(prev => ({ ...prev, isEmployee: e.target.checked }))} className="h-4 w-4" />
                  <span>雇员</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>现金流量</Label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.enableCashFlow} onChange={e => setFormData(prev => ({ ...prev, enableCashFlow: e.target.checked }))} className="h-4 w-4" />
                  <span>启用现金流量核算</span>
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>科目状态</Label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.block} onChange={e => setFormData(prev => ({ ...prev, block: e.target.checked }))} className="h-4 w-4" />
                  <span>冻结科目</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                console.log('取消按钮被点击');
                setShowDialog(false);
                resetFormData();
                setEditingId(null);
              }}>
                取消
              </Button>
              <Button onClick={handleAddSubject}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
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

      {selectedSubject && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>科目详情</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedSubjectId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="text-sm font-medium text-slate-700">科目代码</label>
                <p className="mt-1 text-lg font-semibold">{selectedSubject.code}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">科目名称</label>
                <p className="mt-1 text-lg font-semibold">{selectedSubject.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">科目层级</label>
                <p className="mt-1 text-lg">{selectedSubject.level}级</p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">借贷方向</label>
                <Badge variant={selectedSubject.direction === 'debit' ? 'default' : 'secondary'}>{selectedSubject.direction === 'debit' ? '借方' : '贷方'}</Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">状态</label>
                <div className="flex gap-2">
                  <Badge variant={selectedSubject.disabled ? 'destructive' : 'default'}>{selectedSubject.disabled ? '已禁用' : '启用'}</Badge>
                  <Badge variant={selectedSubject.block ? 'destructive' : 'secondary'}>{selectedSubject.block ? '已冻结' : '正常'}</Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">科目类型</label>
                <Badge variant="outline" className="mt-1">
                  {selectedSubject.subjectType || '未分类'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">辅助核算</label>
                <Badge variant={selectedSubject.enableDept ? 'default' : 'outline'}>部门</Badge>
                <Badge variant={selectedSubject.enableProject ? 'default' : 'outline'}>项目</Badge>
                <Badge variant={selectedSubject.enableForeign ? 'default' : 'outline'}>外币</Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">往来科目</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge variant={(selectedSubject as any).isCustomer ? 'default' : 'outline'}>客户</Badge>
                  <Badge variant={(selectedSubject as any).isSupplier ? 'default' : 'outline'}>供应商</Badge>
                  <Badge variant={(selectedSubject as any).isEmployee ? 'default' : 'outline'}>雇员</Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">现金流量</label>
                <div className="flex gap-2 mt-1">
                  <Badge variant={(selectedSubject as any).enableCashFlow ? 'default' : 'outline'}>
                    {(selectedSubject as any).enableCashFlow ? '已启用' : '未启用'}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">外币币种</label>
                <p className="mt-1">{selectedSubject.foreignCurrency || '无'}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Edit className="h-4 w-4 mr-2" />
                  编辑
                </Button>
                <Button variant={selectedSubject.disabled ? "default" : "outline"} size="sm" className="flex-1" onClick={() => handleToggleDisabled(selectedSubject.id!)}>
                  {selectedSubject.disabled ? <FolderOpen className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                  {selectedSubject.disabled ? '启用' : '禁用'}
                </Button>
                <Button variant={selectedSubject.block ? "default" : "outline"} size="sm" className="flex-1" onClick={() => toggleSubjectBlocked(selectedSubject.id!)}>
                  {selectedSubject.block ? <Unlock className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  {selectedSubject.block ? '解冻' : '冻结'}
                </Button>
                <Button variant="destructive" size="sm" className="flex-1" onClick={() => handleDeleteSubject(selectedSubject.id!)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 币别选择组件
function CurrencySelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { currencies } = useCurrencyStore();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border rounded-md"
    >
      <option value="">请选择币种</option>
      {currencies.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {currency.code} - {currency.name} ({currency.symbol})
        </option>
      ))}
    </select>
  );
}

function SubjectTreeNode({ subject, onToggleExpand, onEdit, onDelete, onToggleDisabled, onToggleBlocked }: any) {
  const hasChildren = subject.children && subject.children.length > 0;
  const indentLevel = subject.level - 1; // 缩进级别：一级0，二级1，三级2...

  return (
    <div style={{ paddingLeft: `${indentLevel * 24}px` }} className="border-l border-slate-200 ml-2">
      <div className="flex items-center py-2 hover:bg-slate-50 rounded px-2">
        <button onClick={() => onToggleExpand(subject.id)} className="flex items-center gap-2 flex-1 text-left">
          {hasChildren && (subject.expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />)}
          <span className={'text-sm ' + (subject.disabled ? 'text-slate-400 line-through' : 'text-slate-700') + (subject.block ? ' font-bold text-orange-600' : '')}>
            {subject.code} - {subject.name}
          </span>
          {subject.block && <Badge variant="destructive" className="text-xs">冻结</Badge>}
        </button>
        <div className="flex gap-1 ml-2">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
            <Edit className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleDisabled}>
            {subject.disabled ? <FolderOpen className="h-3 w-3 text-green-500" /> : <Ban className="h-3 w-3 text-red-500" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleBlocked(subject.id)}>
            {subject.block ? <Unlock className="h-3 w-3 text-blue-500" /> : <Lock className="h-3 w-3 text-orange-500" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {subject.expanded && hasChildren && (
        <div>
          {subject.children.map((child: any) => (
            <SubjectTreeNode key={child.id} subject={child} onToggleExpand={onToggleExpand} onEdit={onEdit} onDelete={onDelete} onToggleDisabled={onToggleDisabled} />
          ))}
        </div>
      )}
    </div>
  );
}
