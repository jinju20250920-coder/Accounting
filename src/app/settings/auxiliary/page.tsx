'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  Upload,
  Download,
  Users,
  Building2,
  Edit,
  Trash2,
  Save,
  X,
  Phone,
  Mail,
  MapPin,
  Lock,
  Unlock,
  Link,
  Merge
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { exportToExcel, importFromExcel } from '@/lib/excel-utils';
import { useCodeRules, CodeRuleManager, generateCode } from '@/lib/code-generator';

// 往来单位接口 - 统一模型
interface Partner {
  id: string;
  code: string;
  name: string;
  isCustomer: boolean; // 客户勾选
  isSupplier: boolean; // 供应商勾选
  contact?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string; // 税号
  bankAccount?: string; // 银行账号
  bankName?: string; // 开户银行
  frozen: boolean;
  createdAt: string;
  // 合并相关字段
  mergedFrom?: string[]; // 从哪些ID合并而来
  parentId?: string; // 关联的集团ID（用于合并到集团）
}

// 核算项目接口
interface AuxiliaryItem {
  id: string;
  code: string;
  name: string;
  type: string;
  description?: string;
  frozen: boolean;
  createdAt: string;
}

// 模拟数据
const mockPartners: Partner[] = [
  {
    id: 'p1',
    code: 'ABC001',
    name: '上海科技有限公司',
    isCustomer: true,
    isSupplier: false,
    contact: '张三',
    phone: '021-12345678',
    email: 'zhangsan@example.com',
    address: '上海市浦东新区张江高科技园区',
    taxNumber: '310115XXXXXXXX',
    bankAccount: '622588XXXXXXXXXXX',
    bankName: '中国工商银行',
    frozen: false,
    createdAt: '2024-01-01'
  },
  {
    id: 'p2',
    code: 'XYZ001',
    name: '北京商贸有限公司',
    isCustomer: true,
    isSupplier: true,
    contact: '李四',
    phone: '010-87654321',
    email: 'lisi@example.com',
    address: '北京市朝阳区建国路88号',
    taxNumber: '110115XXXXXXXX',
    bankAccount: '622202XXXXXXXXXXX',
    bankName: '中国建设银行',
    frozen: false,
    createdAt: '2024-02-01'
  },
  {
    id: 'p3',
    code: 'SUP001',
    name: '广州电子科技有限公司',
    isCustomer: false,
    isSupplier: true,
    contact: '王五',
    phone: '020-87654321',
    email: 'wangwu@example.com',
    address: '广州市天河区天河路123号',
    taxNumber: '440115XXXXXXXX',
    bankAccount: '621700XXXXXXXXXXX',
    bankName: '中国农业银行',
    frozen: false,
    createdAt: '2024-01-15'
  }
];

// 用于存储历史重复数据的映射
const historicalDuplicates = new Map([
  // key: 公司名称, value: 关联的ID数组
  ['上海科技有限公司', ['p1', 'p1-customer', 'p1-supplier']]
]);

// 模拟核算项目数据
const mockAuxiliaryItems: AuxiliaryItem[] = [
  {
    id: 'aux1',
    code: 'AUX-001',
    name: '办公费',
    type: '费用类',
    description: '办公相关费用支出',
    frozen: false,
    createdAt: '2024-01-01'
  },
  {
    id: 'aux2',
    code: 'AUX-002',
    name: '差旅费',
    type: '费用类',
    description: '出差相关费用',
    frozen: false,
    createdAt: '2024-01-02'
  },
  {
    id: 'aux3',
    code: 'AUX-003',
    name: '销售部门',
    type: '部门类',
    description: '销售部门核算项目',
    frozen: false,
    createdAt: '2024-01-03'
  }
];

export default function AuxiliaryDataPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'partners' | 'auxiliary'>('partners');
  const [partners, setPartners] = useState<Partner[]>(mockPartners);
  const [auxiliaryItems, setAuxiliaryItems] = useState<AuxiliaryItem[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);

  // Excel导入相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { rules, updateRule } = useCodeRules();

  // 获取核算项目编码规则
  const getAuxiliaryRule = () => {
    return rules.find(rule => rule.id === 'auxiliary_rule_1') || {
      id: 'auxiliary_rule_1',
      name: '核算项目编码',
      prefix: 'AUX',
      suffix: '',
      padding: 3,
      separator: '-',
      autoIncrement: true,
      lastNumber: 0
    };
  };

  const [searchQuery, setSearchQuery] = useState('');

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
    isCustomer: false,
    isSupplier: false,
    type: '费用类', // 添加类型字段
    description: '', // 添加描述字段
    contact: '',
    phone: '',
    email: '',
    address: '',
    taxNumber: '',
    bankAccount: '',
    bankName: '',
    frozen: false
  });

  // 过滤后的数据
  const filteredPartners = partners.filter(partner => {
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return partner.code.toLowerCase().includes(query) ||
           partner.name.toLowerCase().includes(query);
  });

  // 过滤后的核算项目数据
  const filteredAuxiliaryItems = auxiliaryItems.filter(item => {
    if (!searchQuery.trim()) {
      return true;
    }
    const query = searchQuery.toLowerCase();
    return item.code.toLowerCase().includes(query) ||
           item.name.toLowerCase().includes(query) ||
           item.type.toLowerCase().includes(query);
  });

  // 根据活动标签过滤
  const getFilteredByTab = () => {
    if (activeTab === 'partners') return filteredPartners;
    return filteredAuxiliaryItems;
  };

  const getPartnerTypes = (partner: Partner) => {
    const types = [];
    if (partner.isCustomer) types.push('客户');
    if (partner.isSupplier) types.push('供应商');
    return types;
  };

  const handleAddPartner = () => {
    if (!formData.code || !formData.name) {
      showToast('error', '请填写必填字段：往来单位代码、名称');
      return;
    }

    // 检查代码是否重复
    const existingPartner = partners.find(p => p.code === formData.code);
    if (existingPartner && (!editingId || existingPartner.id !== editingId)) {
      showToast('error', `往来单位代码 ${formData.code} 已存在，请使用其他代码`);
      return;
    }

    // 检查必须至少选择一种身份
    if (!formData.isCustomer && !formData.isSupplier) {
      showToast('error', '请至少勾选一种身份：客户或供应商');
      return;
    }

    const newPartner: Partner = {
      ...formData,
      id: editingId || `partner_${Date.now()}`,
      isCustomer: formData.isCustomer,
      isSupplier: formData.isSupplier,
      frozen: formData.frozen,
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (editingId) {
      setPartners(partners.map(p => p.id === editingId ? { ...newPartner, id: editingId } : p));
      showToast('success', '往来单位更新成功');
    } else {
      setPartners([...partners, newPartner]);
      showToast('success', '往来单位添加成功');
    }
    setShowDialog(false);
    resetFormData();
    setEditingId(null);
  };

  // 处理核算项目添加
  const handleAddAuxiliaryItem = () => {
    if (!formData.code || !formData.name) {
      showToast('error', '请填写必填字段：核算项目代码、名称');
      return;
    }

    // 检查代码是否重复
    const existingItem = auxiliaryItems.find(item => item.code === formData.code);
    if (existingItem && (!editingId || existingItem.id !== editingId)) {
      showToast('error', `核算项目代码 ${formData.code} 已存在，请使用其他代码`);
      return;
    }

    const newAuxiliaryItem: AuxiliaryItem = {
      ...formData,
      id: editingId || `aux_${Date.now()}`,
      type: formData.type || '费用类',
      frozen: formData.frozen,
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (editingId) {
      setAuxiliaryItems(auxiliaryItems.map(item => item.id === editingId ? { ...newAuxiliaryItem, id: editingId } : item));
      showToast('success', '核算项目更新成功');
    } else {
      setAuxiliaryItems([...auxiliaryItems, newAuxiliaryItem]);
      showToast('success', '核算项目添加成功');
    }
    setShowDialog(false);
    resetFormData();
    setEditingId(null);
  };

  const handleEdit = (partner: Partner) => {
    setEditingId(partner.id);
    setFormData({
      code: partner.code,
      name: partner.name,
      isCustomer: partner.isCustomer,
      isSupplier: partner.isSupplier,
      type: '',
      description: '',
      contact: partner.contact || '',
      phone: partner.phone || '',
      email: partner.email || '',
      address: partner.address || '',
      taxNumber: partner.taxNumber || '',
      bankAccount: partner.bankAccount || '',
      bankName: partner.bankName || '',
      frozen: partner.frozen
    });
    setShowDialog(true);
  };

  const handleEditAuxiliary = (item: AuxiliaryItem) => {
    setEditingId(item.id);
    setFormData({
      code: item.code,
      name: item.name,
      isCustomer: false,
      isSupplier: false,
      type: item.type || '费用类',
      description: item.description || '',
      contact: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      bankAccount: '',
      bankName: '',
      frozen: item.frozen
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
      onConfirm: () => {
        setPartners(partners.filter(p => p.id !== id));
        showToast('success', '往来单位删除成功');
      }
    });
  };

  const handleToggleFrozen = (id: string) => {
    setPartners(partners.map(p =>
      p.id === id ? { ...p, frozen: !p.frozen } : p
    ));
    showToast('success', '冻结状态已更新');
  };

  const handleImport = async () => {
    if (fileInputRef.current && fileInputRef.current.files?.length > 0) {
      try {
        const file = fileInputRef.current.files[0];

        if (activeTab === 'partners') {
          // 导入往来单位数据
          const headers = [
            { key: 'code' as keyof Partner, label: '单位代码', required: true },
            { key: 'name' as keyof Partner, label: '单位名称', required: true },
            { key: 'isCustomer' as keyof Partner, label: '是否客户' },
            { key: 'isSupplier' as keyof Partner, label: '是否供应商' },
            { key: 'contact' as keyof Partner, label: '联系人' },
            { key: 'phone' as keyof Partner, label: '联系电话' },
            { key: 'email' as keyof Partner, label: '电子邮箱' },
            { key: 'address' as keyof Partner, label: '地址' },
            { key: 'taxNumber' as keyof Partner, label: '税号' },
            { key: 'bankAccount' as keyof Partner, label: '银行账号' },
            { key: 'bankName' as keyof Partner, label: '开户银行' }
          ];

          const importedData = await importFromExcel<Partner>(file, headers);

          // 生成代码（如果为空）
          const rule = getAuxiliaryRule();
          const newItems = importedData.map(item => ({
            ...item,
            id: `partner_${Date.now()}_${Math.random()}`,
            code: item.code || generateCode(rule, partners.map(p => p.code)),
            frozen: item.frozen || false,
            createdAt: new Date().toISOString().split('T')[0]
          }));

          setPartners([...partners, ...newItems]);
          showToast('success', `成功导入 ${newItems.length} 条往来单位数据`);
        } else {
          // 导入核算项目数据
          const headers = [
            { key: 'code' as keyof AuxiliaryItem, label: '核算项目代码', required: true },
            { key: 'name' as keyof AuxiliaryItem, label: '核算项目名称', required: true },
            { key: 'type' as keyof AuxiliaryItem, label: '项目类型' },
            { key: 'description' as keyof AuxiliaryItem, label: '描述说明' }
          ];

          const importedData = await importFromExcel<AuxiliaryItem>(file, headers);

          // 生成代码（如果为空）
          const rule = getAuxiliaryRule();
          const newItems = importedData.map(item => ({
            ...item,
            id: `aux_${Date.now()}_${Math.random()}`,
            code: item.code || generateCode(rule, auxiliaryItems.map(a => a.code)),
            frozen: item.frozen || false,
            createdAt: new Date().toISOString().split('T')[0]
          }));

          setAuxiliaryItems([...auxiliaryItems, ...newItems]);
          showToast('success', `成功导入 ${newItems.length} 条核算项目数据`);
        }

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
    const dataToExport = getFilteredByTab();
    if (dataToExport.length === 0) {
      showToast('warning', '没有可导出的数据');
      return;
    }

    if (activeTab === 'partners') {
      // 导出往来单位数据
      const exportData = dataToExport.map(partner => ({
        '单位代码': partner.code,
        '单位名称': partner.name,
        '是否客户': partner.isCustomer ? '是' : '否',
        '是否供应商': partner.isSupplier ? '是' : '否',
        '联系人': partner.contact || '',
        '联系电话': partner.phone || '',
        '电子邮箱': partner.email || '',
        '地址': partner.address || '',
        '税号': partner.taxNumber || '',
        '银行账号': partner.bankAccount || '',
        '开户银行': partner.bankName || '',
        '冻结状态': partner.frozen ? '是' : '否',
        '创建时间': partner.createdAt
      }));

      exportToExcel(exportData, '往来单位数据');
      showToast('success', '往来单位数据导出成功');
    } else {
      // 导出核算项目数据
      const exportData = dataToExport.map(item => ({
        '核算项目代码': item.code,
        '核算项目名称': item.name,
        '项目类型': item.type,
        '描述说明': item.description || '',
        '冻结状态': item.frozen ? '是' : '否',
        '创建时间': item.createdAt
      }));

      exportToExcel(exportData, '核算项目数据');
      showToast('success', '核算项目数据导出成功');
    }
  };

  // 导出模板
  const handleExportTemplate = () => {
    if (activeTab === 'partners') {
      const sampleData = {
        '单位代码': 'AUX001',
        '单位名称': '示例往来单位',
        '是否客户': '是',
        '是否供应商': '否',
        '联系人': '张三',
        '联系电话': '021-12345678',
        '电子邮箱': 'example@email.com',
        '地址': '上海市浦东新区',
        '税号': '310115XXXXXXXX',
        '银行账号': '622588XXXXXXXXXXX',
        '开户银行': '中国工商银行'
      };

      const headers = [
        { key: 'code' as any, label: '单位代码' },
        { key: 'name' as any, label: '单位名称' },
        { key: 'isCustomer' as any, label: '是否客户', placeholder: '是/否' },
        { key: 'isSupplier' as any, label: '是否供应商', placeholder: '是/否' },
        { key: 'contact' as any, label: '联系人' },
        { key: 'phone' as any, label: '联系电话' },
        { key: 'email' as any, label: '电子邮箱' },
        { key: 'address' as any, label: '地址' },
        { key: 'taxNumber' as any, label: '税号' },
        { key: 'bankAccount' as any, label: '银行账号' },
        { key: 'bankName' as any, label: '开户银行' }
      ];

      // @ts-ignore
      exportTemplate('往来单位', sampleData, headers);
      showToast('success', '往来单位模板导出成功');
    } else {
      const sampleData = {
        '核算项目代码': 'AUX-001',
        '核算项目名称': '示例核算项目',
        '项目类型': '费用类',
        '描述说明': '示例描述'
      };

      const headers = [
        { key: 'code' as any, label: '核算项目代码' },
        { key: 'name' as any, label: '核算项目名称' },
        { key: 'type' as any, label: '项目类型' },
        { key: 'description' as any, label: '描述说明' }
      ];

      // @ts-ignore
      exportTemplate('核算项目', sampleData, headers);
      showToast('success', '核算项目模板导出成功');
    }
  };

  const showMergeDialogFor = (companyName: string) => {
    setShowMergeDialog(true);
    // 这里可以设置要合并的公司名称
    console.log('准备合并公司:', companyName);
  };

  const resetFormData = () => {
    setFormData({
      code: '',
      name: '',
      isCustomer: false,
      isSupplier: false,
      type: '费用类',
      description: '',
      contact: '',
      phone: '',
      email: '',
      address: '',
      taxNumber: '',
      bankAccount: '',
      bankName: '',
      frozen: false
    });
  };


  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">辅助核算基础数据</h1>
          <p className="text-slate-600 mt-1">管理往来单位、核算项目档案</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {activeTab === 'partners' ? (
          <>
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
                    <p className="text-3xl font-bold text-green-600">{partners.filter(p => p.isCustomer).length}</p>
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
                    <p className="text-3xl font-bold text-orange-600">{partners.filter(p => p.isSupplier).length}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">双重身份</p>
                    <p className="text-3xl font-bold text-blue-600">{partners.filter(p => p.isCustomer && p.isSupplier).length}</p>
                  </div>
                  <Link className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">核算项目总数</p>
                    <p className="text-3xl font-bold text-slate-900">{auxiliaryItems.length}</p>
                  </div>
                  <Users className="h-8 w-8 text-slate-300" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">费用类项目</p>
                    <p className="text-3xl font-bold text-orange-600">{auxiliaryItems.filter(i => i.type === '费用类').length}</p>
                  </div>
                  <Users className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">部门类项目</p>
                    <p className="text-3xl font-bold text-blue-600">{auxiliaryItems.filter(i => i.type === '部门类').length}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">项目类</p>
                    <p className="text-3xl font-bold text-green-600">{auxiliaryItems.filter(i => i.type === '项目类').length}</p>
                  </div>
                  <Link className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* 选项卡 */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'partners' | 'auxiliary')} className="mb-6">
        <TabsList>
          <TabsTrigger value="partners">
            <Users className="h-4 w-4 mr-2" />
            往来单位
          </TabsTrigger>
          <TabsTrigger value="auxiliary">
            <Building2 className="h-4 w-4 mr-2" />
            核算项目
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* 操作栏 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={activeTab === 'partners' ? '搜索单位代码或名称...' : '搜索核算项目代码或名称...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {activeTab === 'partners' ? (
              <>
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
              </>
            ) : (
              <>
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
                  新增核算项目
                </Button>
              </>
            )}
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
            {activeTab === 'auxiliary' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                导出模板
              </Button>
            )}
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
          <CardTitle>
            {activeTab === 'partners' ? '往来单位列表' : '核算项目列表'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getFilteredByTab().length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>
                {activeTab === 'partners' ? '暂无往来单位数据' : '暂无核算项目数据'}
              </p>
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
                添加第一个{activeTab === 'partners' ? '往来单位' : '核算项目'}
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
                  {getFilteredByTab().map((partner) => {
                    const types = getPartnerTypes(partner);
                    return (
                      <tr key={partner.id} className="hover:bg-slate-50 border-b">
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm">{partner.code}</span>
                        </td>
                        <td className="px-4 py-3 font-medium">{partner.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {types.map(type => (
                              <Badge key={type} variant={type === '客户' ? 'default' : 'secondary'}>
                                {type}
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
                          <div className="flex items-center gap-1">
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
                              onClick={() => showMergeDialogFor(partner.name)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? (activeTab === 'partners' ? '编辑往来单位' : '编辑核算项目')
                : (activeTab === 'partners' ? '新增往来单位' : '新增核算项目')
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              {activeTab === 'partners' ? (
                <>
                  <div className="space-y-2">
                    <Label required>单位代码</Label>
                    <Input
                      placeholder="如：CUS001、SUP001"
                      value={formData.code}
                      onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    />
                    <p className="text-xs text-slate-500">输入唯一的单位代码</p>
                  </div>
                  <div className="space-y-2">
                    <Label required>单位名称</Label>
                    <Input
                      placeholder="输入单位名称"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  {/* 身份选择 */}
                  <div className="space-y-3 col-span-2 pt-2 border-t">
                    <p className="text-sm font-medium text-slate-700">选择身份（至少勾选一项）</p>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isCustomer}
                          onChange={e => setFormData(prev => ({ ...prev, isCustomer: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">客户</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isSupplier}
                          onChange={e => setFormData(prev => ({ ...prev, isSupplier: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">供应商</span>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label required>核算项目代码</Label>
                    <Input
                      placeholder="如：AUX-001"
                      value={formData.code}
                      onChange={e => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    />
                    <p className="text-xs text-slate-500">
                      {editingId ? '当前代码：' + formData.code : '自动生成代码'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label required>核算项目名称</Label>
                    <Input
                      placeholder="输入核算项目名称"
                      value={formData.name}
                      onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>项目类型</Label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="费用类">费用类</option>
                      <option value="部门类">部门类</option>
                      <option value="项目类">项目类</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {activeTab === 'partners' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>联系人</Label>
                    <Input
                      placeholder="输入联系人姓名"
                      value={formData.contact}
                      onChange={e => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>联系电话</Label>
                    <Input
                      placeholder="输入联系电话"
                      value={formData.phone}
                      onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>电子邮箱</Label>
                    <Input
                      type="email"
                      placeholder="输入电子邮箱"
                      value={formData.email}
                      onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>税号</Label>
                    <Input
                      placeholder="输入纳税人识别号"
                      value={formData.taxNumber}
                      onChange={e => setFormData(prev => ({ ...prev, taxNumber: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>地址</Label>
                    <Input
                      placeholder="输入单位地址"
                      value={formData.address}
                      onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>开户银行</Label>
                    <Input
                      placeholder="输入开户银行"
                      value={formData.bankName}
                      onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>银行账号</Label>
                    <Input
                      placeholder="输入银行账号"
                      value={formData.bankAccount}
                      onChange={e => setFormData(prev => ({ ...prev, bankAccount: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <input
                    type="checkbox"
                    id="frozen"
                    checked={formData.frozen}
                    onChange={e => setFormData(prev => ({ ...prev, frozen: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="frozen" className="cursor-pointer">冻结往来单位</Label>
                  <p className="text-xs text-slate-500 ml-2">冻结后无法删除，建议在需要停止业务往来时使用</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2 pt-2 border-t">
                  <Label>描述说明</Label>
                  <textarea
                    placeholder="输入核算项目的详细描述"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                  />
                </div>
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="frozen"
                    checked={formData.frozen}
                    onChange={e => setFormData(prev => ({ ...prev, frozen: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="frozen" className="cursor-pointer">冻结核算项目</Label>
                  <p className="text-xs text-slate-500 ml-2">冻结后无法删除</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); resetFormData(); setEditingId(null); }}>
                取消
              </Button>
              <Button onClick={activeTab === 'partners' ? handleAddPartner : handleAddAuxiliaryItem}>
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合并/关联确认对话框 */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>合并/关联往来单位</DialogTitle>
            <DialogDescription>
              选择要合并的关联单位，将数据合并到当前单位
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {/* 这里可以显示可选择的合并列表 */}
            <p className="text-sm text-slate-600">合并功能开发中...</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMergeDialog(false)} className="shadow-sm">
              取消
            </Button>
            <Button variant="default" onClick={() => {
              setShowMergeDialog(false);
              showToast('success', '合并成功');
            }} className="shadow-sm">
              确认合并
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