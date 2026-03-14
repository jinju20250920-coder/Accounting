'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Building2,
  RefreshCw,
  Download,
  Upload,
  Calendar,
  Users,
  FolderKanban,
  Settings,
  CheckCircle,
  AlertCircle,
  Copy,
  Trash2
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

// 模拟账套数据类型
interface AccountSet {
  id: string;
  code: string;
  name: string;
  baseCurrency: string;
  currentPeriod: string;
  status: 'active' | 'closed' | 'archived';
  createdDate: string;
  lastModifiedDate: string;
  voucherCount: number;
  isInitialized: boolean;
}

export default function SetsPage() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [selectedSet, setSelectedSet] = useState<AccountSet | null>(null);

  // 模拟数据
  const [accountSets, setAccountSets] = useState<AccountSet[]>([
    {
      id: 'set_001',
      code: 'SET001',
      name: '主账套',
      baseCurrency: '人民币',
      currentPeriod: '2026-03',
      status: 'active',
      createdDate: '2024-01-01',
      lastModifiedDate: '2026-03-10',
      voucherCount: 156,
      isInitialized: true
    },
    {
      id: 'set_002',
      code: 'SET002',
      name: '测试账套',
      baseCurrency: '人民币',
      currentPeriod: '2026-02',
      status: 'active',
      createdDate: '2024-02-01',
      lastModifiedDate: '2026-03-01',
      voucherCount: 45,
      isInitialized: true
    },
    {
      id: 'set_003',
      code: 'SET003',
      name: '历史账套-2023',
      baseCurrency: '人民币',
      currentPeriod: '2023-12',
      status: 'archived',
      createdDate: '2023-01-01',
      lastModifiedDate: '2023-12-31',
      voucherCount: 389,
      isInitialized: true
    }
  ]);

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBackupDialog, setShowBackupDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showYearEndDialog, setShowYearEndDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
    const updatedSets = accountSets.filter(s => s.id !== selectedSet.id);
    setAccountSets(updatedSets);
    setSelectedSet(null);
    setShowDeleteDialog(false);
    showToast('success', `账套 ${selectedSet.name} 删除成功`);
  };

  const getStatusBadge = (status: AccountSet['status']) => {
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 标题栏 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">账套管理</h1>
        <p className="text-slate-600 mt-1">管理多个账套，设置期初余额和会计期间</p>
      </div>

      {/* 快速操作 */}
      <Card className="mb-6">
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>账套列表</CardTitle>
            <Button size="sm" variant="default" onClick={() => {
              setActiveTab('create');
              setSelectedSet(null);
            }}>
              <FolderKanban className="h-4 w-4 mr-2" />
              创建新账套
            </Button>
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
                onClick={() => {
                  setActiveTab('create');
                  setSelectedSet(null);
                }}
              >
                创建第一个账套
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {accountSets.map((accountSet) => {
                const statusBadge = getStatusBadge(accountSet.status);
                return (
                  <div
                    key={accountSet.id}
                    onClick={() => setSelectedSet(accountSet)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedSet?.id === accountSet.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{accountSet.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-4 w-4" />
                            {accountSet.code}
                          </span>
                          <Badge variant="outline">{accountSet.baseCurrency}</Badge>
                        </div>
                      </div>
                    </div>
                    {accountSet.isInitialized && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}

                    <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-muted-foreground">当前期间</p>
                        <p className="font-medium">{accountSet.currentPeriod}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">凭证数量</p>
                        <p className="font-medium">{accountSet.voucherCount}</p>
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
                              disabled={!selectedSet || selectedSet.id !== accountSet.id}
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
            <Button variant="outline" onClick={() => setShowBackupDialog(false)} className="shadow-sm">
              取消
            </Button>
            <Button onClick={confirmBackup} className="shadow-sm">
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
            <Button variant="outline" onClick={() => setShowCopyDialog(false)} className="shadow-sm">
              取消
            </Button>
            <Button onClick={confirmCopy} className="shadow-sm">
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
            <Button variant="outline" onClick={() => setShowYearEndDialog(false)} className="shadow-sm">
              取消
            </Button>
            <Button variant="destructive" onClick={confirmYearEnd} className="shadow-sm">
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
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="shadow-sm">
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="shadow-sm">
              确定删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
