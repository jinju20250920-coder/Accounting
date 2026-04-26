'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Building2,
  RefreshCw,
  Download,
  Upload,
  Calendar,
  FolderKanban,
  CheckCircle,
  AlertCircle,
  Trash2,
  Plus,
  Edit2,
  FolderOpen,
  HardDrive,
  Settings,
  Clock,
  Play,
  Pause,
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import { PeriodManagement } from '@/components/account-set/period-management';
import { useToast } from '@/components/ui/toast';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import type { AccountSet } from '@/stores/useAccountSetStore';
import { accountSetDbManager } from '@/lib/database/account-set-db-manager';
import { fileHandleManager, FileHandleManager } from '@/lib/database/file-handle-manager';
import type { AccountSetHandleInfo } from '@/lib/database/file-handle-manager';
import { DbStatusIndicator, StorageTypeBadge } from '@/components/database/db-status-indicator';
import { DatabaseLocationDialog } from '@/components/database/database-location-dialog';
import initSqlJs from 'sql.js';

interface AccountSetFormData {
  code: string;
  name: string;
  unifiedSocialCreditCode: string;
  taxNo: string;
  address: string;
  baseCurrency: string;
  startDate: string;
  accountingStandard: 'small-enterprise' | 'enterprise' | 'other';
  enableDate: string;
  lastVoucherNo: number;
  currentPeriod: string;
  status: 'active' | 'closed' | 'archived' | 'trial';
  accounting: {
    partnerTrackingMethod: 'subject' | 'card';
  };
}

export default function SetsPage() {
  const [mounted, setMounted] = useState(false);
  const { showToast } = useToast();
  const { vouchers } = useVoucherStore();
  const {
    accountSets,
    currentAccountSetId,
    addAccountSet,
    updateAccountSet,
    deleteAccountSet,
    setCurrentAccountSet,
    getCurrentAccountSet
  } = useAccountSetStore();

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDbLocationDialog, setShowDbLocationDialog] = useState(false);

  // 选中的账套
  const [selectedSet, setSelectedSet] = useState<AccountSet | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // 表单数据
  const [formData, setFormData] = useState<AccountSetFormData>({
    code: '',
    name: '',
    unifiedSocialCreditCode: '',
    taxNo: '',
    address: '',
    baseCurrency: '人民币',
    startDate: '',
    accountingStandard: 'small-enterprise',
    enableDate: '',
    lastVoucherNo: 0,
    currentPeriod: '',
    status: 'active',
    accounting: {
      partnerTrackingMethod: 'card' // 默认使用往来卡片方式
    }
  });

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // 账套数据库信息映射
  const [accountSetDbInfos, setAccountSetDbInfos] = useState<Map<string, AccountSetHandleInfo>>(new Map());

  // 加载账套数据库信息
  useEffect(() => {
    const loadAccountSetInfos = async () => {
      try {
        const infos = await fileHandleManager.getAllAccountSets();
        const infoMap = new Map<string, AccountSetHandleInfo>();
        for (const info of infos) {
          infoMap.set(info.accountSetId, info);
        }
        setAccountSetDbInfos(infoMap);
      } catch (error) {
        console.error('Failed to load account set infos:', error);
      }
    };

    loadAccountSetInfos();
  }, [accountSets]);

  // 重置表单数据
  const resetFormData = () => {
    setFormData({
      code: '',
      name: '',
      unifiedSocialCreditCode: '',
      taxNo: '',
      address: '',
      baseCurrency: '人民币',
      startDate: '',
      accountingStandard: 'small-enterprise',
      enableDate: '',
      lastVoucherNo: 0,
      currentPeriod: '',
      status: 'active',
      accounting: {
        partnerTrackingMethod: 'card' // 默认使用往来卡片方式
      }
    });
  };

  // 填充表单数据（用于编辑）
  const fillFormData = (accountSet: AccountSet) => {
    setFormData({
      code: accountSet.code,
      name: accountSet.name,
      unifiedSocialCreditCode: accountSet.unifiedSocialCreditCode,
      taxNo: accountSet.taxNo || accountSet.unifiedSocialCreditCode,
      address: accountSet.address,
      baseCurrency: accountSet.baseCurrency,
      startDate: accountSet.startDate,
      accountingStandard: accountSet.accountingStandard,
      enableDate: accountSet.enableDate,
      lastVoucherNo: accountSet.lastVoucherNo || 0,
      currentPeriod: accountSet.currentPeriod || '',
      status: accountSet.status || 'active',
      accounting: {
        partnerTrackingMethod: accountSet.accounting?.partnerTrackingMethod || 'card'
      }
    });
  };

  // 生成账套编码
  const generateAccountSetCode = () => {
    const count = accountSets.length;
    const code = `SET${String(count + 1).padStart(3, '0')}`;
    setFormData(prev => ({ ...prev, code }));
  };

  // 新建账套 - 打开对话框
  const handleCreate = () => {
    resetFormData();
    generateAccountSetCode();
    setSelectedSet(null);
    setShowCreateDialog(true);
  };

  // 创建账套 - 确认
  const confirmCreate = async () => {
    // 验证表单
    if (!formData.code || !formData.name || !formData.startDate || !formData.enableDate) {
      showToast('error', '请填写必填字段');
      return;
    }

    setIsCreating(true);
    try {
      // 使用 AccountSetDbManager 创建账套数据库
      const SQL = await initSqlJs({
        locateFile: (file: string) => `/sqljs/${file}`,
      });

      // 生成账套 ID
      const accountSetId = `as_${Date.now()}`;

      // 创建数据库文件名
      const dbFileName = `${formData.code}_${accountSetId}.db`;

      // 创建数据库并初始化表结构
      const db = new SQL.Database();

      // 创建基础表结构
      const tables = `
        -- 账套表
        CREATE TABLE IF NOT EXISTS accountSets (
          id TEXT PRIMARY KEY,
          code TEXT UNIQUE,
          name TEXT,
          description TEXT,
          createTime TEXT,
          updateTime TEXT
        );

        -- 凭证表
        CREATE TABLE IF NOT EXISTS vouchers (
          id TEXT PRIMARY KEY,
          voucherNo TEXT,
          date TEXT,
          status TEXT,
          summary TEXT,
          creator TEXT,
          reviewer TEXT,
          poster TEXT,
          reverseVoucherId TEXT,
          referenceNumber TEXT,
          attachmentCount INTEGER DEFAULT 0,
          createTime TEXT,
          updateTime TEXT
        );

        -- 分录表
        CREATE TABLE IF NOT EXISTS entries (
          id TEXT PRIMARY KEY,
          voucherId TEXT,
          subjectCode TEXT,
          subjectName TEXT,
          direction TEXT,
          debit REAL,
          credit REAL,
          summary TEXT,
          customerName TEXT,
          supplierName TEXT,
          auxiliary TEXT,
          recRefNo TEXT,
          departmentCode TEXT,
          departmentName TEXT,
          projectCode TEXT,
          projectName TEXT,
          currencyCode TEXT,
          exchangeRate REAL DEFAULT 1.0,
          originalAmount REAL DEFAULT 0,
          date TEXT,
          createTime TEXT,
          updateTime TEXT,
          FOREIGN KEY (voucherId) REFERENCES vouchers(id)
        );

        -- 科目表
        CREATE TABLE IF NOT EXISTS subjects (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          parentId TEXT,
          level INTEGER DEFAULT 1,
          type TEXT,
          direction TEXT DEFAULT 'debit',
          balance REAL DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          frozen INTEGER DEFAULT 0,
          description TEXT,
          createTime TEXT,
          updateTime TEXT,
          FOREIGN KEY (parentId) REFERENCES subjects(id)
        );

        -- 部门表
        CREATE TABLE IF NOT EXISTS departments (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          parentId TEXT,
          level INTEGER DEFAULT 1,
          enabled INTEGER DEFAULT 1,
          description TEXT,
          createTime TEXT,
          updateTime TEXT,
          FOREIGN KEY (parentId) REFERENCES departments(id)
        );

        -- 项目表
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          description TEXT,
          enabled INTEGER DEFAULT 1,
          createTime TEXT,
          updateTime TEXT
        );

        -- 币别表
        CREATE TABLE IF NOT EXISTS currencies (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          symbol TEXT,
          exchangeRate REAL DEFAULT 1.0,
          enabled INTEGER DEFAULT 1,
          createTime TEXT,
          updateTime TEXT
        );

        -- 往来单位表
        CREATE TABLE IF NOT EXISTS partners (
          id TEXT PRIMARY KEY,
          code TEXT,
          name TEXT,
          type TEXT DEFAULT 'customer',
          contact TEXT,
          phone TEXT,
          email TEXT,
          address TEXT,
          taxNo TEXT,
          bankAccount TEXT,
          enabled INTEGER DEFAULT 1,
          createTime TEXT,
          updateTime TEXT
        );

        -- 凭证模板表
        CREATE TABLE IF NOT EXISTS voucherTemplates (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          entries TEXT,
          validations TEXT,
          variables TEXT,
          isSystem INTEGER DEFAULT 0,
          createTime TEXT,
          updateTime TEXT
        );

        -- 常用摘要表
        CREATE TABLE IF NOT EXISTS commonSummaries (
          id TEXT PRIMARY KEY,
          content TEXT,
          frequency INTEGER DEFAULT 0,
          createTime TEXT,
          updateTime TEXT
        );

        -- 用户偏好表
        CREATE TABLE IF NOT EXISTS userPreferences (
          id TEXT PRIMARY KEY,
          userId TEXT,
          type TEXT,
          key TEXT,
          value TEXT,
          createTime TEXT,
          updateTime TEXT
        );

        -- 审计日志表
        CREATE TABLE IF NOT EXISTS auditLogs (
          id TEXT PRIMARY KEY,
          type TEXT,
          entityType TEXT,
          entityId TEXT,
          details TEXT,
          userId TEXT,
          timestamp TEXT
        );

        -- 核销关系表
        CREATE TABLE IF NOT EXISTS recRelations (
          id TEXT PRIMARY KEY,
          recRefNo TEXT,
          debitEntryId TEXT,
          creditEntryId TEXT,
          amount REAL,
          recDate TEXT,
          partnerName TEXT,
          createTime TEXT,
          updateTime TEXT,
          FOREIGN KEY (debitEntryId) REFERENCES entries(id),
          FOREIGN KEY (creditEntryId) REFERENCES entries(id)
        );
      `;

      db.exec(tables);

      // 创建索引
      const indexes = `
        CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(date);
        CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
        CREATE INDEX IF NOT EXISTS idx_vouchers_voucherNo ON vouchers(voucherNo);
        CREATE INDEX IF NOT EXISTS idx_entries_voucherId ON entries(voucherId);
        CREATE INDEX IF NOT EXISTS idx_entries_subjectCode ON entries(subjectCode);
        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
        CREATE INDEX IF NOT EXISTS idx_entries_recRefNo ON entries(recRefNo);
        CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(code);
        CREATE INDEX IF NOT EXISTS idx_subjects_parentId ON subjects(parentId);
        CREATE INDEX IF NOT EXISTS idx_partners_code ON partners(code);
        CREATE INDEX IF NOT EXISTS idx_recRelations_recRefNo ON recRelations(recRefNo);
      `;

      db.exec(indexes);

      // 保存数据库到 OPFS（优先使用，无需用户交互）
      let finalStorageType: 'fsa' | 'opfs' | 'local' = 'local';
      let handle: FileSystemFileHandle | null = null;

      if (FileHandleManager.isOPFSSupported()) {
        try {
          const opfsRoot = await (navigator.storage as any).getDirectory();
          handle = await opfsRoot.getFileHandle(dbFileName, { create: true });
          const writable = await handle.createWritable();
          await writable.write(db.export());
          await writable.close();
          finalStorageType = 'opfs';

          // 保存句柄到 IndexedDB
          await fileHandleManager.saveHandle(
            accountSetId,
            formData.name,
            dbFileName,
            handle,
            'opfs'
          );
        } catch (opfsError) {
          console.error('OPFS save failed:', opfsError);
        }
      }

      // 创建账套记录
      await addAccountSet({
        ...formData,
        dbFileName,
        dbStorageType: finalStorageType,
        dbFileSize: 0,
        dbLastModified: Date.now()
      });

      const storageTypeName = finalStorageType === 'opfs' ? 'OPFS存储' : '内存模式';
      showToast('success', `账套创建成功 (${storageTypeName})`);
      setShowCreateDialog(false);
      resetFormData();

      // 重新加载账套信息
      const infos = await fileHandleManager.getAllAccountSets();
      const infoMap = new Map<string, AccountSetHandleInfo>();
      for (const info of infos) {
        infoMap.set(info.accountSetId, info);
      }
      setAccountSetDbInfos(infoMap);

    } catch (error) {
      console.error('Create account set failed:', error);
      showToast('error', '创建账套失败: ' + (error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  // 编辑账套 - 打开对话框
  const handleEdit = (accountSet: AccountSet) => {
    setSelectedSet(accountSet);
    fillFormData(accountSet);
    setShowEditDialog(true);
  };

  // 确认编辑
  const confirmEdit = () => {
    if (!selectedSet) return;

    updateAccountSet(selectedSet.id, {
      ...formData
    });

    setShowEditDialog(false);
    setSelectedSet(prev => prev ? {
      ...prev,
      ...formData
    } : null);
    showToast('success', '账套更新成功');
  };

  // 管理数据库位置
  const handleManageDbLocation = (accountSet: AccountSet) => {
    setSelectedSet(accountSet);
    setShowDbLocationDialog(true);
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!selectedSet) return;

    try {
      // 删除数据库文件
      await accountSetDbManager.deleteAccountSetDatabase(selectedSet.id);

      deleteAccountSet(selectedSet.id);
      setSelectedSet(null);
      setShowDeleteDialog(false);
      showToast('success', '账套删除成功');
    } catch (error) {
      console.error('Delete account set failed:', error);
      showToast('error', '删除账套失败');
    }
  };

  // 切换账套
  const handleSwitchAccountSet = async (accountSet: AccountSet) => {
    try {
      setCurrentAccountSet(accountSet.id);
      showToast('success', `已切换到账套: ${accountSet.name}`);
    } catch (error) {
      console.error('Switch account set failed:', error);
      showToast('error', '切换账套失败');
    }
  };

  // 获取账套凭证数量
  const [voucherCounts, setVoucherCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const loadVoucherCounts = async () => {
      try {
        const { sqliteService } = await import('@/lib/database/sqlite-service');
        const counts = new Map<string, number>();

        for (const accountSet of accountSets) {
          try {
            // 临时切换账套ID获取凭证数量
            const origAccountSetId = sqliteService.accountSetId;
            sqliteService.setAccountSetId(accountSet.id);
            const vouchers = await sqliteService.getAllVouchers();
            counts.set(accountSet.id, vouchers.length);
            // 恢复原来的账套ID
            sqliteService.setAccountSetId(origAccountSetId);
          } catch {
            counts.set(accountSet.id, 0);
          }
        }

        setVoucherCounts(counts);
      } catch (error) {
        console.error('加载凭证数量失败:', error);
      }
    };

    if (accountSets.length > 0) {
      loadVoucherCounts();
    }
  }, [accountSets]);

  // 格式化日期
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 页面头部 */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">账套管理</h1>
            <p className="text-slate-600 mt-1">创建和管理多个独立的账套数据库</p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            新建账套
          </Button>
        </div>
      </div>

      {/* 标签页导航 */}
      <Tabs defaultValue="account-sets" className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="account-sets">账套管理</TabsTrigger>
          <TabsTrigger value="period-management">会计期间</TabsTrigger>
        </TabsList>

        <TabsContent value="account-sets">
          {/* 当前账套信息 */}
          {mounted && getCurrentAccountSet() && (
            <Card className="mb-6 bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm text-slate-600">当前账套</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {getCurrentAccountSet()?.name}
                      </p>
                    </div>
                  </div>
                  <DbStatusIndicator
                    accountSetId={getCurrentAccountSet()!.id}
                    showDetails={true}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 账套列表 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mounted && accountSets.map((accountSet) => {
          const dbInfo = accountSetDbInfos.get(accountSet.id);
          const isSelected = currentAccountSetId === accountSet.id;

          return (
            <Card
              key={accountSet.id}
              className={`transition-all hover:shadow-lg ${
                isSelected ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{accountSet.name}</CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                      编码: {accountSet.code}
                    </p>
                  </div>
                  {isSelected && (
                    <Badge className="bg-blue-600">当前</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* 账套信息 */}
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-600">启用日期:</span>
                      <span className="font-medium">{formatDate(accountSet.enableDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">会计准则:</span>
                      <span className="font-medium">
                        {accountSet.accountingStandard === 'small-enterprise' && '小企业会计准则'}
                        {accountSet.accountingStandard === 'enterprise' && '企业会计准则'}
                        {accountSet.accountingStandard === 'other' && '其他'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">凭证数量:</span>
                      <span className="font-medium">{voucherCounts.get(accountSet.id) ?? '-'}</span>
                    </div>
                  </div>

                  {/* 数据库状态 */}
                  {dbInfo && (
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-600">数据库存储:</span>
                        <StorageTypeBadge storageType={dbInfo.storageType} />
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {dbInfo.fileName}
                      </p>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-2">
                    {!isSelected && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSwitchAccountSet(accountSet)}
                        className="flex-1"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        切换
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(accountSet)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleManageDbLocation(accountSet)}
                      title="管理数据库位置"
                    >
                      <HardDrive className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedSet(accountSet);
                        setShowDeleteDialog(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

          {/* 空状态 */}
          {accountSets.length === 0 && (
            <Card>
              <CardContent className="pt-12 pb-12 text-center">
                <FolderKanban className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  还没有账套
                </h3>
                <p className="text-slate-600 mb-6">
                  创建一个账套来开始管理您的财务数据
                </p>
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  创建第一个账套
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 会计期间管理 */}
        <TabsContent value="period-management">
          <PeriodManagement />
        </TabsContent>
      </Tabs>

      {/* 创建账套对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新建账套</DialogTitle>
            <DialogDescription>
              创建一个新的独立账套数据库，每个账套的数据完全隔离
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* 存储说明 */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <HardDrive className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">自动存储</p>
                  <p className="text-xs text-blue-800 mt-1">
                    数据库将自动保存到浏览器存储中（OPFS），文件名为：
                    <code className="bg-blue-100 px-1 py-0.5 rounded">{formData.code || 'SET001'}_timestamp.db</code>
                  </p>
                </div>
              </div>
            </div>

            {/* 表单字段 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>账套编码</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="SET001"
                />
              </div>
              <div className="space-y-2">
                <Label required>账套名称</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="示例公司"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>启用日期</Label>
                <ChineseDatePicker
                  value={formData.startDate}
                  onChange={(v) => setFormData({ ...formData, startDate: v })}
                />
              </div>
              <div className="space-y-2">
                <Label required>启用年月</Label>
                <ChineseMonthPicker
                  value={formData.enableDate}
                  onChange={(v) => setFormData({ ...formData, enableDate: v })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>统一社会信用代码</Label>
                <Input
                  value={formData.unifiedSocialCreditCode}
                  onChange={(e) => setFormData({ ...formData, unifiedSocialCreditCode: e.target.value, taxNo: e.target.value })}
                  placeholder="91110000XXXXXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>纳税人识别号</Label>
                <Input
                  value={formData.taxNo}
                  onChange={(e) => setFormData({ ...formData, taxNo: e.target.value })}
                  placeholder="与统一社会信用代码相同"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>公司地址</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="北京市朝阳区..."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>本位币</Label>
                <select
                  value={formData.baseCurrency}
                  onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="人民币">人民币 (CNY)</option>
                  <option value="美元">美元 (USD)</option>
                  <option value="欧元">欧元 (EUR)</option>
                  <option value="港币">港币 (HKD)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>会计准则</Label>
                <select
                  value={formData.accountingStandard}
                  onChange={(e) => setFormData({ ...formData, accountingStandard: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="small-enterprise">小企业会计准则</option>
                  <option value="enterprise">企业会计准则</option>
                  <option value="other">其他</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label required>往来核算方式</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label
                    className="flex items-center gap-2"
                    onClick={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'card' } })}
                  >
                    <input
                      type="radio"
                      name="partnerTrackingMethod"
                      value="card"
                      checked={formData.accounting.partnerTrackingMethod === 'card'}
                      onChange={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'card' } })}
                      className="h-4 w-4 text-blue-600"
                    />
                    往来卡片方式
                  </Label>
                  <p className="text-xs text-slate-500 ml-6">
                    使用辅助核算功能，每个往来单位作为一张独立的往来卡片，科目结构更简洁（推荐）
                  </p>
                </div>
                <div className="space-y-1">
                  <Label
                    className="flex items-center gap-2"
                    onClick={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'subject' } })}
                  >
                    <input
                      type="radio"
                      name="partnerTrackingMethod"
                      value="subject"
                      checked={formData.accounting.partnerTrackingMethod === 'subject'}
                      onChange={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'subject' } })}
                      className="h-4 w-4 text-blue-600"
                    />
                    科目方式
                  </Label>
                  <p className="text-xs text-slate-500 ml-6">
                    每个往来单位自动创建对应的明细科目，适合传统手工记账习惯
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={isCreating}
            >
              取消
            </Button>
            <Button onClick={confirmCreate} disabled={isCreating}>
              {isCreating ? '创建中...' : '创建账套'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑账套对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑账套</DialogTitle>
            <DialogDescription>
              修改账套的基本信息
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>账套编码</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label required>账套名称</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>统一社会信用代码</Label>
                <Input
                  value={formData.unifiedSocialCreditCode}
                  onChange={(e) => setFormData({ ...formData, unifiedSocialCreditCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>公司地址</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label required>往来核算方式</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label
                    className="flex items-center gap-2"
                    onClick={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'card' } })}
                  >
                    <input
                      type="radio"
                      name="editPartnerTrackingMethod"
                      value="card"
                      checked={formData.accounting.partnerTrackingMethod === 'card'}
                      onChange={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'card' } })}
                      className="h-4 w-4 text-blue-600"
                    />
                    往来卡片方式
                  </Label>
                  <p className="text-xs text-slate-500 ml-6">
                    使用辅助核算功能，每个往来单位作为一张独立的往来卡片，科目结构更简洁（推荐）
                  </p>
                </div>
                <div className="space-y-1">
                  <Label
                    className="flex items-center gap-2"
                    onClick={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'subject' } })}
                  >
                    <input
                      type="radio"
                      name="editPartnerTrackingMethod"
                      value="subject"
                      checked={formData.accounting.partnerTrackingMethod === 'subject'}
                      onChange={() => setFormData({ ...formData, accounting: { ...formData.accounting, partnerTrackingMethod: 'subject' } })}
                      className="h-4 w-4 text-blue-600"
                    />
                    科目方式
                  </Label>
                  <p className="text-xs text-slate-500 ml-6">
                    每个往来单位自动创建对应的明细科目，适合传统手工记账习惯
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
            >
              取消
            </Button>
            <Button onClick={confirmEdit}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除账套</DialogTitle>
            <DialogDescription>
              确定要删除账套 "{selectedSet?.name}" 吗？
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-center text-sm text-slate-600">
              此操作将删除账套及其所有数据，且不可恢复。
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 数据库位置管理对话框 */}
      {selectedSet && (
        <DatabaseLocationDialog
          open={showDbLocationDialog}
          onOpenChange={setShowDbLocationDialog}
          accountSetId={selectedSet.id}
          accountSetName={selectedSet.name}
        />
      )}
    </div>
  );
}
