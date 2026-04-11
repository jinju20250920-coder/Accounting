'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChineseMonthPicker } from '@/components/ui/chinese-month-picker';
import { ChineseDatePicker } from '@/components/ui/chinese-date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  FolderOpen,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { fileHandleManager, FileHandleManager } from '@/lib/database/file-handle-manager';
import { useAccountSetStore } from '@/stores/useAccountSetStore';

interface FirstTimeWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

type WizardStep = 'welcome' | 'account-info' | 'database-location' | 'completed';

export function FirstTimeWizard({ open, onOpenChange, onComplete }: FirstTimeWizardProps) {
  const { addAccountSet, setCurrentAccountSet } = useAccountSetStore();

  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    code: 'SET001',
    name: '',
    unifiedSocialCreditCode: '',
    taxNo: '',
    address: '',
    baseCurrency: '人民币',
    startDate: new Date().toISOString().split('T')[0],
    accountingStandard: 'small-enterprise' as const,
    enableDate: new Date().toISOString().slice(0, 7)
  });

  // 数据库文件信息
  const [dbInfo, setDbInfo] = useState<{
    storageType: 'fsa' | 'opfs' | 'local';
    fileName: string;
  }>({
    storageType: FileHandleManager.getRecommendedStorageType(),
    fileName: ''
  });

  const steps: WizardStep[] = ['welcome', 'account-info', 'database-location', 'completed'];
  const currentStepIndex = steps.indexOf(currentStep);

  // 检查浏览器支持
  const fsaSupported = FileHandleManager.isFileSystemAccessAPISupported();
  const opfsSupported = FileHandleManager.isOPFSSupported();

  const handleNext = async () => {
    setError(null);

    if (currentStep === 'welcome') {
      setCurrentStep('account-info');
    } else if (currentStep === 'account-info') {
      // 验证表单
      if (!formData.code.trim()) {
        setError('请输入账套编码');
        return;
      }
      if (!formData.name.trim()) {
        setError('请输入账套名称');
        return;
      }
      if (!formData.unifiedSocialCreditCode.trim()) {
        setError('请输入统一社会信用代码');
        return;
      }
      if (!formData.address.trim()) {
        setError('请输入公司地址');
        return;
      }

      // 生成默认文件名
      const defaultFileName = `${formData.name}_${new Date().toISOString().slice(0, 10)}.db`;
      setDbInfo({ ...dbInfo, fileName: defaultFileName });
      setCurrentStep('database-location');
    } else if (currentStep === 'database-location') {
      await handleCreateAccountSet();
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === 'completed') {
      setCurrentStep('database-location');
    } else if (currentStep === 'database-location') {
      setCurrentStep('account-info');
    } else if (currentStep === 'account-info') {
      setCurrentStep('welcome');
    }
  };

  const handleCreateAccountSet = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      // 生成唯一 ID
      const accountSetId = `set_${Date.now()}`;

      // 创建账套
      const newAccountSet = await addAccountSet({
        ...formData,
        currentPeriod: formData.enableDate,
        status: 'active'
      });

      if (!newAccountSet) {
        throw new Error('创建账套失败');
      }

      // 如果使用 FSA，需要选择文件
      if (dbInfo.storageType === 'fsa') {
        // 这里需要在下一步让用户选择文件
        // 暂时使用默认文件名
        setCurrentStep('completed');
      } else {
        setCurrentStep('completed');
      }

      // 设置为当前账套
      setCurrentAccountSet(accountSetId);

    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
  };

  const getStorageTypeBadge = (type: 'fsa' | 'opfs' | 'local') => {
    switch (type) {
      case 'fsa':
        return <Badge className="bg-green-100 text-green-800">推荐</Badge>;
      case 'opfs':
        return <Badge variant="secondary">备选</Badge>;
      case 'local':
        return <Badge variant="outline">后备</Badge>;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center py-8">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              欢迎使用 金桔财务系统
            </h2>
            <p className="text-slate-600 mb-8">
              让我们快速设置您的第一个账套
            </p>

            <div className="bg-blue-50 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-semibold text-slate-900 mb-4">您将可以：</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>管理会计凭证和账目</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>生成多种财务报表</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>管理多个账套</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>数据存储在本地，安全可控</span>
                </li>
              </ul>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        );

      case 'account-info':
        return (
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-4">账套基本信息</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label required>账套编码</Label>
                <Input
                  placeholder="如：SET001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label required>账套名称（公司名称）</Label>
                <Input
                  placeholder="如：上海某某科技有限公司"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label required>统一社会信用代码</Label>
                <Input
                  placeholder="18位统一社会信用代码"
                  value={formData.unifiedSocialCreditCode}
                  onChange={(e) => setFormData({ ...formData, unifiedSocialCreditCode: e.target.value, taxNo: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>纳税人识别号</Label>
                <Input
                  placeholder="与统一社会信用代码相同"
                  value={formData.taxNo}
                  onChange={(e) => setFormData({ ...formData, taxNo: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label required>公司地址</Label>
                <Input
                  placeholder="公司详细地址"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>账套开始日期</Label>
                <ChineseDatePicker
                  value={formData.startDate}
                  onChange={(v) => setFormData({ ...formData, startDate: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>启用年月</Label>
                <ChineseMonthPicker
                  value={formData.enableDate}
                  onChange={(v) => setFormData({ ...formData, enableDate: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>本位币</Label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.baseCurrency}
                  onChange={(e) => setFormData({ ...formData, baseCurrency: e.target.value })}
                >
                  <option>人民币</option>
                  <option>美元</option>
                  <option>欧元</option>
                  <option>港币</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>会计准则</Label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.accountingStandard}
                  onChange={(e) => setFormData({ ...formData, accountingStandard: e.target.value as any })}
                >
                  <option value="small-enterprise">小企业会计准则</option>
                  <option value="enterprise">企业会计准则</option>
                  <option value="other">其他</option>
                </select>
              </div>
            </div>

            {error && (
              <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        );

      case 'database-location':
        return (
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-4">选择数据库存储方式</h3>

            <div className="space-y-4 mb-6">
              {/* File System Access API */}
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  dbInfo.storageType === 'fsa'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                } ${!fsaSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => fsaSupported && setDbInfo({ ...dbInfo, storageType: 'fsa' })}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">磁盘文件存储</h4>
                      {getStorageTypeBadge('fsa')}
                    </div>
                    <p className="text-sm text-slate-600 mb-2">
                      数据存储在您选择的磁盘位置，可以像普通文件一样管理和备份
                    </p>
                    {!fsaSupported && (
                      <p className="text-xs text-orange-600">
                        您的浏览器不支持此功能，请使用 Chrome、Edge 或 Opera 浏览器
                      </p>
                    )}
                  </div>
                  {dbInfo.storageType === 'fsa' && (
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              </div>

              {/* OPFS */}
              <div
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  dbInfo.storageType === 'opfs'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-blue-300'
                } ${!opfsSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => opfsSupported && setDbInfo({ ...dbInfo, storageType: 'opfs' })}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-slate-900">浏览器私有存储</h4>
                      {getStorageTypeBadge('opfs')}
                    </div>
                    <p className="text-sm text-slate-600">
                      数据存储在浏览器的私有文件系统中，重启服务器不会丢失
                    </p>
                  </div>
                  {dbInfo.storageType === 'opfs' && (
                    <CheckCircle className="w-5 h-5 text-blue-500" />
                  )}
                </div>
              </div>
            </div>

            {dbInfo.storageType === 'fsa' && (
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">数据库文件名</span>
                </div>
                <p className="text-sm text-slate-600 font-mono">
                  {dbInfo.fileName || `${formData.name}_${new Date().toISOString().slice(0, 10)}.db`}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  下一步将打开文件选择对话框，您可以选择保存位置和修改文件名
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        );

      case 'completed':
        return (
          <div className="text-center py-8">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              设置完成！
            </h2>
            <p className="text-slate-600 mb-8">
              您的第一个账套 "{formData.name}" 已创建成功
            </p>

            <div className="bg-green-50 rounded-lg p-6 text-left mb-8 max-w-md mx-auto">
              <h3 className="font-semibold text-slate-900 mb-4">接下来您可以：</h3>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>录入会计凭证</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>设置会计科目</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>生成财务报表</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">•</span>
                  <span>创建更多账套</span>
                </li>
              </ul>
            </div>

            <div className="text-xs text-slate-500">
              数据库存储方式：{FileHandleManager.getStorageTypeName(dbInfo.storageType)}
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'welcome' && '欢迎使用'}
            {currentStep === 'account-info' && '创建账套'}
            {currentStep === 'database-location' && '选择存储方式'}
            {currentStep === 'completed' && '设置完成'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'welcome' && '快速设置您的第一个账套'}
            {currentStep === 'account-info' && '填写账套的基本信息'}
            {currentStep === 'database-location' && '选择数据库的存储方式'}
            {currentStep === 'completed' && '开始使用 金桔财务系统'}
          </DialogDescription>
        </DialogHeader>

        {/* 进度指示器 */}
        {currentStep !== 'completed' && (
          <div className="flex items-center justify-center gap-2 py-4">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStepIndex
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {index < currentStepIndex ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 ${
                      index < currentStepIndex ? 'bg-blue-500' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* 步骤内容 */}
        <div className="flex-1 overflow-y-auto">
          {renderStep()}
        </div>

        {/* 底部按钮 */}
        <DialogFooter className="gap-2 pt-4 border-t">
          {currentStep !== 'welcome' && currentStep !== 'completed' && (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isProcessing}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一步
            </Button>
          )}

          {currentStep !== 'completed' ? (
            <Button
              onClick={handleNext}
              disabled={isProcessing}
            >
              {isProcessing ? '处理中...' : '下一步'}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleComplete}>
              开始使用
              <CheckCircle className="w-4 h-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
