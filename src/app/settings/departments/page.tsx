'use client';

import { useState, useRef } from 'react';
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
  Users,
  Save,
  X,
  Lock,
  Unlock
} from 'lucide-react';
import { useDepartmentStore } from '@/stores';
import { Department } from '@/types';
import { useToast } from '@/components/ui/toast';
import { exportToExcel, importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { generateCode, CodeRuleManager } from '@/lib/code-generator';

export default function DepartmentsPage() {
  const { showToast } = useToast();
  const {
    departments,
    loading,
    error,
    searchQuery,
    selectedDepartmentId,
    addDepartment,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentFrozen,
    setSearchQuery,
    setSelectedDepartmentId,
    addDefaultDepartments,
    clearError,
    buildDepartmentTree
  } = useDepartmentStore();

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    parentId: '',
    frozen: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取编码规则
  const codeRuleManager = CodeRuleManager.getInstance();
  const codeRule = codeRuleManager.getRuleByType('department');

  // 构建部门树
  const departmentTree = buildDepartmentTree();

  // 获取过滤后的部门
  const getFilteredDepartments = () => {
    if (!searchQuery.trim()) return departments;
    const query = searchQuery.toLowerCase();
    return departments.filter(d =>
      d.code.toLowerCase().includes(query) ||
      d.name.toLowerCase().includes(query)
    );
  };

  const filteredDepts = getFilteredDepartments();

  // 递归渲染部门树
  const renderDepartmentTree = (nodes: any[], level: number = 0) => {
    return nodes.map((node) => {
      const hasChildren = node.children && node.children.length > 0;
      const isExpanded = expandedDepts.has(node.id);

      return (
        <div key={node.id}>
          <DepartmentTreeNode
            dept={node}
            level={level}
            hasChildren={hasChildren}
            isExpanded={isExpanded}
            onToggleExpand={() => {
              const newExpanded = new Set(expandedDepts);
              if (newExpanded.has(node.id)) {
                newExpanded.delete(node.id);
              } else {
                newExpanded.add(node.id);
              }
              setExpandedDepts(newExpanded);
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleFrozen={toggleDepartmentFrozen}
          />
          {hasChildren && isExpanded && (
            <div className="ml-6">
              {renderDepartmentTree(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const handleAddDepartment = () => {
    if (!formData.name) {
      showToast('error', '请填写必填字段：部门名称');
      return;
    }

    // 清除之前的错误
    clearError();

    let finalCode = formData.code;
    let deptData: Omit<Department, 'id'>;

    if (editingId) {
      // 编辑模式：保留原有代码
      deptData = {
        code: formData.code,
        name: formData.name,
        parentId: formData.parentId || null,
        level: 1, // Default level, should be calculated based on hierarchy
        frozen: formData.frozen
      };
    } else {
      // 新增模式：使用自动编码或手动输入的代码
      if (formData.code) {
        // 手动输入了代码，检查是否重复
        const existingDept = departments.find(d => d.code === formData.code);
        if (existingDept) {
          showToast('error', `部门代码 ${formData.code} 已存在，请使用其他代码`);
          return;
        }
        finalCode = formData.code;
      } else {
        // 使用自动编码
        const existingCodes = departments.map(d => d.code);
        finalCode = generateCode(codeRule, existingCodes);
        showToast('info', `自动生成编码：${finalCode}`);
      }

      deptData = {
        code: finalCode,
        name: formData.name,
        parentId: formData.parentId || null,
        level: 1, // Default level, should be calculated based on hierarchy
        frozen: formData.frozen
      };

      // 更新规则的最后编号
      codeRuleManager.updateRule(codeRule.id, { lastNumber: parseInt(finalCode.replace(/\D/g, '')) || 0 });
    }

    if (editingId) {
      updateDepartment(editingId, deptData);
      showToast('success', '部门更新成功');
    } else {
      addDepartment(deptData);
      showToast('success', '部门添加成功');
    }
    setShowDialog(false);
    resetFormData();
    setEditingId(null);
  };

  const handleEdit = (dept: Department) => {
    setEditingId(dept.id);
    setFormData({
      code: dept.code,
      name: dept.name,
      parentId: dept.parentId || '',
      frozen: dept.frozen
    });
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    const dept = departments.find(d => d.id === id);
    if (!dept) return;
    if (dept.frozen) {
      showToast('warning', '该部门已冻结，无法删除');
      return;
    }
    const hasChildren = departments.some(d => d.parentId === id);
    if (hasChildren) {
      showToast('warning', '该部门有下级部门，请先删除或移动下级部门');
      return;
    }
    // 显示确认对话框
    setConfirmDialog({
      open: true,
      title: '确认删除',
      description: `确定要删除部门 ${dept.code} - ${dept.name} 吗？`,
      onConfirm: () => {
        deleteDepartment(id);
        showToast('success', '部门删除成功');
        if (selectedDepartmentId === id) setSelectedDepartmentId(null);
      }
    });
  };

  const handleAddDefaultDepartments = () => {
    // 显示确认对话框
    setConfirmDialog({
      open: true,
      title: '确认添加默认部门',
      description: '确定要添加默认部门数据吗？',
      onConfirm: () => {
        addDefaultDepartments();
        showToast('success', '默认部门添加成功');
      }
    });
  };

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleExport = () => {
    if (departments.length === 0) {
      showToast('warning', '没有可导出的部门数据');
      return;
    }

    // 准备导出数据
    const exportData = departments.map(dept => ({
      '部门代码': dept.code,
      '部门名称': dept.name,
      '上级部门': dept.parentId ? departments.find(d => d.id === dept.parentId)?.name || '' : '',
      '状态': dept.frozen ? '已冻结' : '正常'
    }));

    exportToExcel(exportData, '部门数据', [
      { key: 'code' as any, label: '部门代码' },
      { key: 'name' as any, label: '部门名称' },
      { key: 'parentId' as any, label: '上级部门' },
      { key: 'frozen' as any, label: '状态' },
      { key: 'createdDate' as any, label: '创建日期' },
      { key: 'lastModifiedDate' as any, label: '最后修改' }
    ]);
  };

  const handleExportTemplate = () => {
    const sampleData = {
      '部门代码': 'DEPT-001',
      '部门名称': '示例部门',
      '上级部门': '（顶级部门）',
      '状态': '正常'
    };
    exportTemplate('部门数据', sampleData, [
      { key: 'code' as any, label: '部门代码', placeholder: '如：DEPT001、SA、TECH' },
      { key: 'name' as any, label: '部门名称', placeholder: '输入部门名称' },
      { key: 'parentId' as any, label: '上级部门', placeholder: '（顶级部门）' },
      { key: 'frozen' as any, label: '状态', placeholder: '正常/已冻结' }
    ]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showToast('info', '正在导入数据...');

      // 定义Excel表格头映射
      const headers = [
        { key: 'code' as any, label: '部门代码', required: true },
        { key: 'name' as any, label: '部门名称', required: true },
        { key: 'parentId' as any, label: '上级部门', required: false },
        { key: 'frozen' as any, label: '状态', required: false }
      ];

      const importedData = await importFromExcel<Department>(file, headers);

      // 处理导入数据
      const validDepts = importedData.filter(dept => {
        // 检查代码是否已存在
        const exists = departments.some(d => d.code === dept.code);
        if (exists) {
          showToast('warning', `部门代码 ${dept.code} 已存在，跳过导入`);
          return false;
        }
        return true;
      });

      // 批量添加部门
      validDepts.forEach(dept => {
        addDepartment({
          code: dept.code!,
          name: dept.name!,
          parentId: dept.parentId || null,
          level: 1, // Default level
          frozen: dept.frozen || false
        });
      });

      showToast('success', `成功导入 ${validDepts.length} 个部门`);
      setShowDialog(false);
    } catch (error) {
      showToast('error', `导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const resetFormData = () => {
    setFormData({
      code: '',
      name: '',
      parentId: '',
      frozen: false
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">部门管理</h1>
          <p className="text-slate-600 mt-1">管理组织架构</p>
        </div>
        <div className="flex gap-2">
          {error && (
            <Badge variant="destructive" className="text-sm">
              {error}
            </Badge>
          )}
          <Badge variant="outline">
            部门总数: {departments.length}
          </Badge>
        </div>
      </div>

      {/* 操作栏 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索部门代码或名称..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    clearError();
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新增部门
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddDefaultDepartments}
            >
              <Users className="h-4 w-4 mr-2" />
              添加默认
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTemplate}
            >
              <Download className="h-4 w-4 mr-2" />
              导出模板
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
            >
              <Upload className="h-4 w-4 mr-2" />
              导入Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download className="h-4 w-4 mr-2" />
              导出Excel
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

      {/* 部门树 */}
      <Card>
        <CardHeader>
          <CardTitle>组织架构</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filteredDepts.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>暂无部门数据</p>
                <Button variant="outline" className="mt-4" onClick={() => setShowDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  添加第一个部门
                </Button>
              </div>
            ) : (
              // 如果有搜索条件，显示扁平列表；否则显示树形结构
              searchQuery.trim() ? (
                filteredDepts.map((dept) => (
                  <DepartmentTreeNode
                    key={dept.id}
                    dept={dept}
                    level={0}
                    hasChildren={false}
                    isExpanded={false}
                    onToggleExpand={() => {}}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onToggleFrozen={toggleDepartmentFrozen}
                  />
                ))
              ) : (
                renderDepartmentTree(departmentTree)
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* 选中部门详情 */}
      {selectedDepartmentId && (
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>部门详情</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedDepartmentId(null)}
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              const dept = departments.find(d => d.id === selectedDepartmentId);
              if (!dept) return null;
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">部门代码</label>
                    <p className="mt-1 text-lg font-semibold">{dept.code}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">部门名称</label>
                    <p className="mt-1 text-lg font-semibold">{dept.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">上级部门</label>
                    <p className="mt-1">{dept.parentId ? departments.find(d => d.id === dept.parentId)?.name : '无'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">状态</label>
                    <p className="mt-1">
                      {dept.frozen ? (
                        <Badge variant="destructive">
                          <Lock className="h-3 w-3 mr-1" />
                          已冻结
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Unlock className="h-3 w-3 mr-1" />
                          正常
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(dept)}>
                        <Edit className="h-4 w-4 mr-2" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => toggleDepartmentFrozen(dept.id)}
                      >
                        {dept.frozen ? (
                          <>
                            <Unlock className="h-4 w-4 mr-2" />
                            解冻
                          </>
                        ) : (
                          <>
                            <Lock className="h-4 w-4 mr-2" />
                            冻结
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDelete(dept.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* 新增/编辑部门对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑部门' : '新增部门'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>部门代码</Label>
              <Input
                placeholder={editingId ? '' : '自动生成或手动输入'}
                value={formData.code}
                onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
              />
              {!editingId && (
                <p className="text-xs text-slate-500">留空则自动生成编码：{codeRule.prefix}{codeRule.separator}{String(codeRule.lastNumber + 1).padStart(codeRule.padding, '0')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label required>部门名称</Label>
              <Input
                placeholder="输入部门名称"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>上级部门</Label>
              <select
                value={formData.parentId}
                onChange={e => setFormData(prev => ({ ...prev, parentId: e.target.value || null }))}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">无（顶级部门）</option>
                {departments.filter(d => !d.parentId).map(d => (
                  <option key={d.id} value={d.id}>{d.code} - {d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="frozen"
                checked={formData.frozen}
                onChange={e => setFormData(prev => ({ ...prev, frozen: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="frozen" className="cursor-pointer">冻结部门</Label>
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetFormData(); setEditingId(null); }}>
                取消
              </Button>
              <Button onClick={handleAddDepartment}>
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
    </div>
  );
}

// 部门树节点组件
interface DepartmentTreeNodeProps {
  dept: Department;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (dept: Department) => void;
  onDelete: (id: string) => void;
  onToggleFrozen: (id: string) => void;
}

function DepartmentTreeNode({
  dept,
  level,
  hasChildren,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleFrozen
}: DepartmentTreeNodeProps) {
  const indentLevel = level * 24;

  return (
    <div
      className="flex items-center py-2 hover:bg-slate-50 rounded px-2 border-l border-slate-200"
      style={{ paddingLeft: `${8 + indentLevel}px` }}
    >
      {hasChildren && (
        <button
          onClick={onToggleExpand}
          className="mr-2 text-slate-400 hover:text-slate-600"
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}
      <div className="flex-1 flex items-center gap-2">
        <span className="text-sm text-slate-700">
          {dept.code} - {dept.name}
        </span>
        {dept.frozen && (
          <Badge variant="destructive" className="text-xs">
            <Lock className="h-3 w-3 mr-1" />
            已冻结
          </Badge>
        )}
      </div>
      <div className="flex gap-1 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onEdit(dept)}
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => onToggleFrozen(dept.id)}
          title={dept.frozen ? '解冻' : '冻结'}
        >
          {dept.frozen ? <Unlock className="h-3 w-3 text-green-500" /> : <Lock className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-red-500"
          onClick={() => onDelete(dept.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
