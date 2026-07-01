'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Search,
  Upload,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  Edit,
  Trash2,
  Eye,
  Clock,
  Save,
  X,
  Lock,
  Unlock,
  Folder
} from 'lucide-react';
import { useFinancialProjectStore } from '@/stores';
import { Project } from '@/types';
import { useToast } from '@/components/ui/toast';
import { exportToExcel, importFromExcel, exportTemplate } from '@/lib/excel-utils';
import { generateCode, CodeRuleManager, useCodeRules } from '@/lib/code-generator';

export default function ProjectsPage() {
  const { showToast } = useToast();
  const {
    projects,
    loading,
    error,
    searchQuery,
    filterType,
    selectedProjectId,
    addProject,
    updateProject,
    deleteProject,
    closeProject,
    reopenProject,
    toggleProjectFrozen,
    setSearchQuery,
    setFilterType,
    setSelectedProjectId,
    clearError
  } = useFinancialProjectStore();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    type: 'income' as Project['type'],
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    frozen: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取编码规则
  const { rules, updateRule } = useCodeRules();
  const codeRule = useMemo(() => {
    return rules.find(rule => rule.id === 'project_rule') || {
      id: 'project_rule',
      name: '项目编码',
      prefix: 'PRJ',
      suffix: '',
      padding: 3,
      separator: '-' as const,
      autoIncrement: true,
      resetPeriod: 'none' as const,
      lastNumber: 0
    };
  }, [rules]);

  const handleCloseProject = useCallback((id: string, endDate?: string) => {
    closeProject(id, endDate || new Date().toISOString().split('T')[0]);
    showToast('success', '项目已关闭');
  }, [closeProject, showToast]);

  const handleReopenProject = useCallback((id: string) => {
    reopenProject(id);
    showToast('success', '项目已重新打开');
  }, [reopenProject, showToast]);

  // 过滤后的项目
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // 类型筛选
    if (filterType !== 'all') {
      filtered = filtered.filter(p => p.type === filterType);
    }

    // 搜索筛选
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.code.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [projects, searchQuery, filterType]);

  // 项目统计
  const stats = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => !p.endDate).length;
    const closed = projects.filter(p => !!p.endDate).length;

    return { total, active, closed };
  }, [projects]);

  // 按类型统计
  const typeStats = useMemo(() => {
    return {
      income: projects.filter(p => p.type === 'income').length,
      cost: projects.filter(p => p.type === 'cost').length,
      other: projects.filter(p => p.type === 'other').length
    };
  }, [projects]);

  const getProjectTypeLabel = (type: Project['type']) => {
    switch (type) {
      case 'income':
        return { label: '收入类', color: 'bg-green-100 text-green-800' };
      case 'cost':
        return { label: '成本类', color: 'bg-orange-100 text-orange-800' };
      case 'other':
        return { label: '其他类', color: 'bg-blue-100 text-blue-800' };
      default:
        return { label: '未知', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getProjectStatus = (project: Project) => {
    if (project.frozen) return { label: '已冻结', color: 'bg-slate-500' };
    if (!project.endDate) return { label: '活跃', color: 'bg-green-500' };
    const isExpired = new Date(project.endDate) < new Date();
    if (isExpired) return { label: '已过期', color: 'bg-red-500' };
    return { label: '已关闭', color: 'bg-gray-500' };
  };

  const handleAddProject = () => {
    if (!formData.name) {
      showToast('error', '请填写必填字段：项目名称');
      return;
    }

    // 清除之前的错误
    clearError();

    let finalCode = formData.code;
    let projectData: Omit<Project, 'id'>;

    if (editingId) {
      // 编辑模式：保留原有代码
      projectData = {
        code: formData.code,
        name: formData.name,
        type: formData.type,
        parentId: null,
        level: 1,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        frozen: formData.frozen
      };
    } else {
      // 新增模式：使用自动编码或手动输入的代码
      if (formData.code) {
        // 手动输入了代码，检查是否重复
        const existingProject = projects.find(p => p.code === formData.code);
        if (existingProject) {
          showToast('error', `项目代码 ${formData.code} 已存在，请使用其他代码`);
          return;
        }
        finalCode = formData.code;
      } else {
        // 使用自动编码
        const existingCodes = projects.map(p => p.code);
        const result = generateCode(codeRule, existingCodes);
        finalCode = result.code;
        showToast('info', `自动生成编码：${finalCode}`);
        // 更新规则状态
        updateRule(codeRule.id, result.updatedRule);
      }

      projectData = {
        code: finalCode,
        name: formData.name,
        type: formData.type,
        parentId: null,
        level: 1,
        startDate: formData.startDate,
        endDate: formData.endDate || undefined,
        frozen: formData.frozen
      };
    }

    if (editingId) {
      updateProject(editingId, projectData);
      showToast('success', '项目更新成功');
    } else {
      addProject(projectData);
      showToast('success', '项目添加成功');
    }
    setShowDialog(false);
    resetFormData();
    setEditingId(null);
  };

  const handleEdit = (project: Project) => {
    setEditingId(project.id);
    setFormData({
      code: project.code,
      name: project.name,
      type: project.type,
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      frozen: project.frozen
    });
    setShowDialog(true);
  };

  const handleDelete = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    if (project.frozen) {
      showToast('warning', '该项目已冻结，无法删除');
      return;
    }
    showToast('info', '删除功能开发中...');
    // TODO: 实现删除确认对话框
    // if (confirm(`确定要删除项目 ${project.code} - ${project.name} 吗？`)) {
    //   deleteProject(id);
    //   showToast('success', '项目删除成功');
    //   if (selectedProjectId === id) setSelectedProjectId(null);
    // }
  };

  const handleImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleExport = () => {
    if (filteredProjects.length === 0) {
      showToast('warning', '没有可导出的项目数据');
      return;
    }

    // 准备导出数据
    const exportData = filteredProjects.map(project => ({
      '项目代码': project.code,
      '项目名称': project.name,
      '项目类型': project.type === 'income' ? '收入类' : project.type === 'cost' ? '成本类' : '其他类',
      '开始日期': project.startDate || '-',
      '结束日期': project.endDate || '-',
      '状态': project.frozen ? '已冻结' : (project.endDate ? '已关闭' : '活跃')
    }));

    exportToExcel(exportData, '项目数据');
  };

  const handleExportTemplate = () => {
    const sampleData = {
      '项目代码': 'PRJ-001',
      '项目名称': '示例项目',
      '项目类型': '收入类',
      '开始日期': '2024-01-01',
      '结束日期': '',
      '状态': '活跃',
      '创建日期': '2024-01-01'
    };
    exportTemplate('项目数据', sampleData, [
      { key: 'code', label: '项目代码', placeholder: '如：PRJ001、1001、PROJ-A' },
      { key: 'name', label: '项目名称', placeholder: '输入项目名称' },
      { key: 'type', label: '项目类型', placeholder: '收入类/成本类/其他类' },
      { key: 'startDate', label: '开始日期', placeholder: 'YYYY-MM-DD' },
      { key: 'endDate', label: '结束日期', placeholder: '留空表示项目仍在进行中' },
      { key: 'frozen', label: '状态', placeholder: '活跃/已冻结/已关闭' },
      { key: 'createdDate', label: '创建日期', placeholder: 'YYYY-MM-DD' }
    ]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      showToast('info', '正在导入数据...');

      // 定义Excel表格头映射
      const headers = [
        { key: 'code', label: '项目代码', required: true },
        { key: 'name', label: '项目名称', required: true },
        { key: 'type', label: '项目类型', required: true },
        { key: 'startDate', label: '开始日期', required: true },
        { key: 'endDate', label: '结束日期', required: false },
        { key: 'frozen', label: '状态', required: false }
      ];

      const importedData = await importFromExcel<Record<string, unknown>>(file, headers) as unknown as Project[];

      // 处理导入数据
      const validProjects = importedData.filter(project => {
        // 检查代码是否已存在
        const exists = projects.some(p => p.code === project.code);
        if (exists) {
          showToast('warning', `项目代码 ${project.code} 已存在，跳过导入`);
          return false;
        }
        return true;
      });

      // 批量添加项目
      validProjects.forEach(project => {
        addProject({
          code: project.code!,
          name: project.name!,
          type: project.type!,
          parentId: null,
          level: 1,
          startDate: project.startDate!,
          endDate: project.endDate,
          frozen: project.frozen || false
        });
      });

      showToast('success', `成功导入 ${validProjects.length} 个项目`);
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
      type: 'income',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      frozen: false
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">项目管理</h1>
          <p className="text-slate-600 mt-1">管理财务项目档案</p>
        </div>
        <div className="flex gap-2">
          {error && (
            <Badge variant="destructive" className="text-sm">
              {error}
            </Badge>
          )}
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">项目总数</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Package className="h-8 w-8 text-slate-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">活跃项目</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">已关闭</p>
                <p className="text-3xl font-bold text-slate-600">{stats.closed}</p>
              </div>
              <Clock className="h-8 w-8 text-slate-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">收入类</span>
                <Badge variant="outline" className="font-semibold">{typeStats.income}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">成本类</span>
                <Badge variant="outline" className="font-semibold">{typeStats.cost}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">其他类</span>
                <Badge variant="outline" className="font-semibold">{typeStats.other}</Badge>
              </div>
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
                  placeholder="搜索项目代码或名称..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    clearError();
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'income' | 'cost' | 'other')}
              className="px-4 py-2 border rounded-md text-sm"
            >
              <option value="all">全部类型</option>
              <option value="income">收入类</option>
              <option value="cost">成本类</option>
              <option value="other">其他类</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              新增项目
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

      {/* 项目列表 */}
      <Card>
        <CardHeader>
          <CardTitle>项目列表</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无项目数据</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowDialog(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                添加第一个项目
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      项目代码
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      项目名称
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      项目类型
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      开始日期
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">
                      结束日期
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
                  {filteredProjects.map((project) => {
                    const status = getProjectStatus(project);
                    const typeInfo = getProjectTypeLabel(project.type);

                    return (
                      <tr key={project.id} className="hover:bg-slate-50 border-b">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">{project.code}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{project.name}</td>
                        <td className="px-4 py-3">
                          <Badge className={typeInfo.color}>
                            {typeInfo.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {project.startDate}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {project.endDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {project.endDate}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={status.color === 'bg-green-500' ? 'default' : 'secondary'}>
                              {status.label}
                            </Badge>
                            {project.frozen && (
                              <Badge variant="destructive" className="text-xs">
                                <Lock className="h-3 w-3 mr-1" />
                                已冻结
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setSelectedProjectId(project.id)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(project)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            {!project.endDate && !project.frozen ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleCloseProject(project.id)}
                              >
                                <Clock className="h-3 w-3" />
                              </Button>
                            ) : null}
                            {!project.endDate && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleProjectFrozen(project.id)}
                                title={project.frozen ? '解冻' : '冻结'}
                              >
                                {project.frozen ? <Unlock className="h-3 w-3 text-green-500" /> : <Lock className="h-3 w-3" />}
                              </Button>
                            )}
                            {project.endDate ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-500"
                                onClick={() => handleReopenProject(project.id)}
                                title="重新打开"
                              >
                                <TrendingUp className="h-3 w-3" />
                              </Button>
                            ) : null}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500"
                              onClick={() => handleDelete(project.id)}
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

      {/* 新增/编辑项目对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑项目' : '新增项目'}</DialogTitle>
          </DialogHeader>
          <div className="bg-slate-50 -mx-6 -mt-2 px-6 py-5 space-y-4">
            <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-5 space-y-4">
              {/* 项目代码 + 类型 同行 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="font-semibold text-xs text-slate-700">项目代码</Label>
                  <Input
                    placeholder={editingId ? '' : '自动生成或手动输入'}
                    value={formData.code}
                    onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  />
                  {!editingId && (
                    <p className="text-[11px] text-slate-400">留空自动生成 {codeRule.prefix}{codeRule.separator}{String(codeRule.lastNumber + 1).padStart(codeRule.padding, '0')}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-xs text-slate-700">项目类型</Label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData(prev => ({ ...prev, type: e.target.value as Project['type'] }))}
                    className="w-full h-8 px-2.5 py-1 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    <option value="income">收入类</option>
                    <option value="cost">成本类</option>
                    <option value="other">其他类</option>
                  </select>
                </div>
              </div>

              {/* 项目名称 */}
              <div className="space-y-1.5">
                <Label required className="font-semibold text-xs text-slate-700">项目名称</Label>
                <div className="relative">
                  <Folder className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="输入项目名称"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* 开始日期 + 结束日期 同行 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label required className="font-semibold text-xs text-slate-700">
                    <Calendar className="h-3 w-3 inline mr-1 -mt-0.5" />
                    开始日期
                  </Label>
                  <ChineseDatePicker
                    value={formData.startDate}
                    onChange={v => setFormData(prev => ({ ...prev, startDate: v }))}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-xs text-slate-700">
                    <Calendar className="h-3 w-3 inline mr-1 -mt-0.5" />
                    结束日期
                  </Label>
                  <ChineseDatePicker
                    value={formData.endDate}
                    onChange={v => setFormData(prev => ({ ...prev, endDate: v }))}
                    className="w-full"
                  />
                  <p className="text-[11px] text-slate-400">留空表示进行中</p>
                </div>
              </div>

              {/* 冻结 */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="frozen"
                  checked={formData.frozen}
                  onChange={e => setFormData(prev => ({ ...prev, frozen: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="frozen" className="font-semibold text-xs text-slate-700 cursor-pointer">冻结项目</Label>
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex justify-end gap-2 pt-3 mt-1 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => { setShowDialog(false); resetFormData(); setEditingId(null); }}>
              取消
            </Button>
            <Button size="sm" onClick={handleAddProject}>
              <Save className="h-4 w-4 mr-1.5" />
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
