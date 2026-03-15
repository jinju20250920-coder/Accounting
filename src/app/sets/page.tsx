'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectOption as SelectOptionType } from '@/components/ui/select';
import {
  Building2,
  RefreshCw,
  Download,
  Upload,
  Calendar,
  FolderKanban,
  Settings,
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2,
  Plus,
  Edit2
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';

// 表单数据类型
interface AccountSetFormData {
  code: string;
  name: string;
  unifiedSocialCreditCode: string;
  address: string;
  baseCurrency: string;
  startDate: string;
  accountingStandard: 'small-enterprise' | 'enterprise' | 'other';
  enableDate: string;
}

export default function SetsPage() {
  const { showToast } = useToast();
  const { vouchers } = useVoucherStore();
  const {
    accountSets,
    currentAccountSetId,
    addAccountSet,
    updateAccountSet,
    deleteAccountSet,
    setCurrentAccountSet
  } = useAccountSetStore();

  const [selectedSet, setSelectedSet] = useState<any>(null);

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showYearEndDialog, setShowYearEndDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<AccountSetFormData>({
    code: '',
    name: '',
    unifiedSocialCreditCode: '',
    address: '',
    baseCurrency: '人民币',
    startDate: '',
    accountingStandard: 'small-enterprise',
    enableDate: ''
  });

  // 重置表单数据
  const resetFormData = () => {
    setFormData({
      code: '',
      name: '',
      unifiedSocialCreditCode: '',
      address: '',
      baseCurrency: '人民币',
      startDate: '',
      accountingStandard: 'small-enterprise',
      enableDate: ''
    });
  };

  // 填充表单数据（用于编辑）
  const fillFormData = (accountSet: any) => {
    setFormData({
      code: accountSet.code,
      name: accountSet.name,
      unifiedSocialCreditCode: accountSet.unifiedSocialCreditCode,
      address: accountSet.address,
      baseCurrency: accountSet.baseCurrency,
      startDate: accountSet.startDate,
      accountingStandard: accountSet.accountingStandard,
      enableDate: accountSet.enableDate
    });
  };

  const handleRefresh = () => {
    showToast('info', '正在刷新账套数据...');
    // 模拟刷新操作
    setTimeout(() => {
      showToast('success', '账套数据刷新成功');
    }, 1000);
  };

  const handleBackup = () => {
    setShowBackupDialog(true);
  };

  const handleCopy = () => {
    if (!selectedSet) {
      showToast('warning', '请先选择要复制的账套');
      return;
    }
    setShowCopyDialog(true);
  };

  const handleExport = () => {
    showToast('info', '导出功能开发中...');
  };

  const handleImport = () => {
    showToast('info', '导入功能开发中...');
  };

  const handleYearEnd = () => {
    if (!selectedSet) {
      showToast('warning', '请先选择要进行年结的账套');
      return;
    }
    setShowYearEndDialog(true);
  };

  const handleDelete = () => {
    if (!selectedSet) {
      showToast('warning', '请先选择要删除的账套');
      return;
    }
    setShowDeleteDialog(true);
  };

  // 新增账套
  const handleCreate = () => {
    resetFormData();
    setSelectedSet(null);
    setShowCreateDialog(true);
  };

  // 编辑账套
  const handleEdit = (e: React.MouseEvent, accountSet: any) => {
    e.stopPropagation();
    fillFormData(accountSet);
    setSelectedSet(accountSet);
    setShowEditDialog(true);
  };

  // 验证表单数据
  const validateFormData = (data: AccountSetFormData): boolean => {
    if (!data.code.trim()) {
      showToast('error', '请输入账套编码');
      return false;
    }
    if (!data.name.trim()) {
      showToast('error', '请输入账套名称');
      return false;
    }
    if (!data.unifiedSocialCreditCode.trim()) {
      showToast('error', '请输入统一社会信用代码');
      return false;
    }
    if (!data.address.trim()) {
      showToast('error', '请输入公司地址');
      return false;
    }
    if (!data.startDate) {
      showToast('error', '请选择账套开始日期');
      return false;
    }
    if (!data.enableDate) {
      showToast('error', '请选择账套启用年月');
      return false;
    }
    return true;
  };

  // 确认新增
  const confirmCreate = () => {
    if (!validateFormData(formData)) return;

    addAccountSet({
      code: formData.code,
      name: formData.name,
      unifiedSocialCreditCode: formData.unifiedSocialCreditCode,
      address: formData.address,
      baseCurrency: formData.baseCurrency,
      currentPeriod: formData.enableDate,
      startDate: formData.startDate,
      accountingStandard: formData.accountingStandard,
      enableDate: formData.enableDate,
      status: 'active'
    });

    setShowCreateDialog(false);
    resetFormData();
    showToast('success', '账套创建成功');
  };

  // 确认编辑
  const confirmEdit = () => {
    if (!validateFormData(formData)) return;
    if (!selectedSet) return;

    updateAccountSet(selectedSet.id, {
      code: formData.code,
      name: formData.name,
      unifiedSocialCreditCode: formData.unifiedSocialCreditCode,
      address: formData.address,
      baseCurrency: formData.baseCurrency,
      startDate: formData.startDate,
      accountingStandard: formData.accountingStandard,
      enableDate: formData.enableDate
    });

    setShowEditDialog(false);
    setSelectedSet(prev => prev ? {
      ...prev,
      code: formData.code,
      name: formData.name,
      unifiedSocialCreditCode: formData.unifiedSocialCreditCode,
      address: formData.address,
      baseCurrency: formData.baseCurrency,
      startDate: formData.startDate,
      accountingStandard: formData.accountingStandard,
      enableDate: formData.enableDate
    } : null);
    showToast('success', '账套更新成功');
  };

  const confirmBackup = () => {
    setShowBackupDialog(false);
    showToast('success', '账套配置备份成功');
  };

  const confirmCopy = () => {
    setShowCopyDialog(false);
    showToast('success', `账套 ${selectedSet?.name} 复制成功`);
  };

  const confirmYearEnd = () => {
    setShowYearEndDialog(false);
    showToast('success', `账套 ${selectedSet?.name} 年结处理完成`);
  };

  const confirmDelete = () => {
    if (!selectedSet) return;
    deleteAccountSet(selectedSet.id);
    setSelectedSet(null);
    setShowDeleteDialog(false);
    showToast('success', `账套 ${selectedSet.name} 删除成功`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return { label: '运行中', color: 'bg-green-100 text-green-800' };
      case 'closed':
        return { label: '已关闭', color: 'bg-gray-100 text-gray-800' };
      case 'archived':
        return { label: '已归档', color: 'bg-blue-100 text-blue-800' };
      default:
        return { label: '未知', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const getAccountingStandardLabel = (standard: string) => {
    switch (standard) {
      case 'small-enterprise':
        return '小企业会计准则';
      case 'enterprise':
        return '企业会计准则';
      case 'other':
        return '其他';
      default:
        return '未知';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">账套管理</h1>
        <p className="text-slate-600 mt-1">管理多个账套，设置期初余额和会计期间</p>
      </div>

      {/* 快速操作 */}
      <Card className="mb-6 border-slate-200">
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            刷新数据
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={handleBackup}>
            <Settings className="h-4 w-4 mr-2" />
            备份配置
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            导出配置
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            导入配置
          </Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => {
            if (selectedSet) {
              handleYearEnd();
            } else {
              showToast('warning', '请先选择账套');
            }
          }}>
            <Calendar className="h-4 w-4 mr-2" />
            年结处理
          </Button>
        </CardContent>
      </Card>

      {/* 账套列表 */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>账套列表</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                新建账套
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accountSets.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FolderKanban className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>暂无账套数据</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={handleCreate}
              >
                创建第一个账套
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {accountSets.map((accountSet) => {
                const statusBadge = getStatusBadge(accountSet.status);
                return (
                  <div
                    key={accountSet.id}
                    onClick={() => {
                      setSelectedSet(accountSet);
                      setCurrentAccountSet(accountSet.id);
                    }}
                    className={`p-5 border rounded-lg cursor-pointer transition-all relative ${
                      currentAccountSetId === accountSet.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    {/* 当前账套标记 */}
                    {currentAccountSetId === accountSet.id && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-green-600 text-white text-xs px-3 py-1 rounded-bl-lg rounded-tr-lg">
                          当前账套
                        </div>
                      </div>
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Building2 className="h-6 w-6 text-slate-500" />
                          <h3 className="font-semibold text-lg">{accountSet.name}</h3>
                          <Badge variant="outline" className="text-xs">{accountSet.code}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          {accountSet.unifiedSocialCreditCode}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEdit(e, accountSet)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {accountSet.isInitialized && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-muted-foreground">公司地址</p>
                        <p className="font-medium text-xs truncate" title={accountSet.address}>
                          {accountSet.address}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">会计准则</p>
                        <Badge variant="outline">
                          {getAccountingStandardLabel(accountSet.accountingStandard)}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-muted-foreground">账套开始日期</p>
                        <p className="font-medium">{accountSet.startDate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">启用年月</p>
                        <p className="font-medium">{accountSet.enableDate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">当前期间</p>
                        <p className="font-medium">{accountSet.currentPeriod}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">凭证数量</p>
                        <p className="font-medium">{vouchers.length}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">创建日期</p>
                        <p className="font-medium">{accountSet.createdDate}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">状态</p>
                        <Badge className={statusBadge.color}>{statusBadge.label}</Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        最后修改：{accountSet.lastModifiedDate}
                      </p>
                      <div className="flex gap-2">
                        {accountSet.status === 'archived' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => showToast('info', '归档账套只能查看，无法操作')}
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            只读
                          </Button>
                        )}
                        {accountSet.status !== 'archived' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCopy}
                              disabled={!selectedSet}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              复制
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleDelete}
                              disabled={!selectedSet || selectedSet.id !== accountSet.id || accountSets.length <= 1}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              删除
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 新建账套对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>新建账套</DialogTitle>
            <DialogDescription>
              创建新的账套，请填写以下信息
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label required>账套编码</Label>
                <Input
                  placeholder="请输入账套编码，如 SET001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label required>账套名称</Label>
                <Input
                  placeholder="请输入公司名称"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label required>统一社会信用代码</Label>
                <Input
                  placeholder="请输入18位统一社会信用代码"
                  value={formData.unifiedSocialCreditCode}
                  onChange={(e) => setFormData({ ...formData, unifiedSocialCreditCode: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label required>公司地址</Label>
                <Input
                  placeholder="请输入公司详细地址"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label required>账套开始日期</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label required>账套启用年月</Label>
                <Input
                  type="month"
                  value={formData.enableDate}
                  onChange={(e) => setFormData({ ...formData, enableDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>本位币</Label>
                <Select
                  value={formData.baseCurrency}
                  onChange={(value) => setFormData({ ...formData, baseCurrency: value })}
                  options={[
                    { value: '人民币', label: '人民币' },
                    { value: '美元', label: '美元' },
                    { value: '欧元', label: '欧元' },
                    { value: '港币', label: '港币' }
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label required>会计准则</Label>
                <Select
                  value={formData.accountingStandard}
                  onChange={(value) => setFormData({ ...formData, accountingStandard: value as any })}
                  options={[
                    { value: 'small-enterprise', label: '小企业会计准则' },
                    { value: 'enterprise', label: '企业会计准则' },
                    { value: 'other', label: '其他' }
                  ]}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              resetFormData();
            }}>
              取消
            </Button>
            <Button onClick={confirmCreate}>
              创建账套
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑账套对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>编辑账套</DialogTitle>
            <DialogDescription>
              修改账套信息
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label required>账套编码</Label>
                <Input
                  placeholder="请输入账套编码，如 SET001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label required>账套名称</Label>
                <Input
                  placeholder="请输入公司名称"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label required>统一社会信用代码</Label>
                <Input
                  placeholder="请输入18位统一社会信用代码"
                  value={formData.unifiedSocialCreditCode}
                  onChange={(e) => setFormData({ ...formData, unifiedSocialCreditCode: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label required>公司地址</Label>
                <Input
                  placeholder="请输入公司详细地址"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label required>账套开始日期</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label required>账套启用年月</Label>
                <Input
                  type="month"
                  value={formData.enableDate}
                  onChange={(e) => setFormData({ ...formData, enableDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>本位币</Label>
                <Select
                  value={formData.baseCurrency}
                  onChange={(value) => setFormData({ ...formData, baseCurrency: value })}
                  options={[
                    { value: '人民币', label: '人民币' },
                    { value: '美元', label: '美元' },
                    { value: '欧元', label: '欧元' },
                    { value: '港币', label: '港币' }
                  ]}
                />
              </div>
              <div className="space-y-2">
                <Label required>会计准则</Label>
                <Select
                  value={formData.accountingStandard}
                  onChange={(value) => setFormData({ ...formData, accountingStandard: value as any })}
                  options={[
                    { value: 'small-enterprise', label: '小企业会计准则' },
                    { value: 'enterprise', label: '企业会计准则' },
                    { value: 'other', label: '其他' }
                  ]}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              resetFormData();
            }}>
              取消
            </Button>
            <Button onClick={confirmEdit}>
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 备份确认对话框 */}
      <Dialog open={showBackupDialog} onOpenChange={setShowBackupDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>备份账套配置</DialogTitle>
            <DialogDescription>
              确定要备份当前账套的所有配置数据吗？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowBackupDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmBackup}>
              确定备份
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 复制账套确认对话框 */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>复制账套</DialogTitle>
            <DialogDescription>
              确定要复制账套 "{selectedSet?.name}" 吗？
              <br />
              复制后将创建一个相同配置的新账套。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
              取消
            </Button>
            <Button onClick={confirmCopy}>
              确定复制
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 年结处理确认对话框 */}
      <Dialog open={showYearEndDialog} onOpenChange={setShowYearEndDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>年结处理</DialogTitle>
            <DialogDescription>
              确定要对账套 "{selectedSet?.name}" 进行年结处理吗？
              <br />
              年结后当前会计年度将被锁定，无法再录入凭证。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowYearEndDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmYearEnd}>
              确定年结
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除账套确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>删除账套</DialogTitle>
            <DialogDescription>
              确定要删除账套 "{selectedSet?.name}" 吗？
              <br />
              <span className="text-red-500">此操作不可逆，请谨慎操作！</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={accountSets.length <= 1}>
              {accountSets.length <= 1 ? '至少保留一个账套' : '确定删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
