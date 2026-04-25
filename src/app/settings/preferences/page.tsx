'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Settings,
  Info,
  FileText,
  Users
} from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAccountSetStore } from '@/stores/useAccountSetStore';
import { useToast } from '@/components/ui/toast';

export default function PreferencesPage() {
  const { showToast } = useToast();
  const { settings, updateSettings } = useSettingsStore();
  const { getCurrentAccountSet, updateAccountSet } = useAccountSetStore();

  const [partnerTrackingMethod, setPartnerTrackingMethod] = useState<'subject' | 'card'>('card');

  // 初始化设置值 - 从当前账套读取
  useEffect(() => {
    const currentAccountSet = getCurrentAccountSet();
    if (currentAccountSet?.accounting?.partnerTrackingMethod) {
      setPartnerTrackingMethod(currentAccountSet.accounting.partnerTrackingMethod);
    } else if (settings.accounting?.partnerTrackingMethod) {
      // 向后兼容：如果账套没有设置，使用全局设置
      setPartnerTrackingMethod(settings.accounting.partnerTrackingMethod);
    }
  }, [settings.accounting, getCurrentAccountSet]);

  // 保存设置 - 保存到当前账套
  const handleSaveSettings = async () => {
    try {
      const currentAccountSet = getCurrentAccountSet();
      if (currentAccountSet) {
        updateAccountSet(currentAccountSet.id, {
          accounting: {
            partnerTrackingMethod
          }
        });
        showToast('success', '系统设置已保存');
      } else {
        // 如果没有当前账套，保存到全局设置作为备用
        updateSettings({
          accounting: {
            partnerTrackingMethod
          }
        });
        showToast('success', '系统设置已保存');
      }
    } catch (error) {
      console.error('保存设置失败:', error);
      showToast('error', '保存设置失败');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">系统设置</h1>
        <p className="text-slate-600 mt-1">配置会计核算方式和系统偏好</p>
      </div>

      {/* 往来核算设置卡片 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            往来核算方式
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">往来明细记录方式</Label>
              <Select
                value={partnerTrackingMethod}
                onValueChange={(value: 'subject' | 'card') => setPartnerTrackingMethod(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>科目方式</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="card">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>往来卡片方式</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 科目方式说明 */}
            {partnerTrackingMethod === 'subject' && (
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900">科目方式说明</AlertTitle>
                <AlertDescription className="text-blue-800 text-sm">
                  <p className="mb-2">使用科目方式记录往来明细时：</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>每个往来单位会自动创建对应的明细科目</li>
                    <li>例如：应收账款下的明细科目对应每个客户</li>
                    <li>在发票和银行流水生成凭证时，自动创建缺失的科目</li>
                    <li>适合传统手工记账习惯，以科目为主线</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* 往来卡片方式说明 */}
            {partnerTrackingMethod === 'card' && (
              <Alert className="bg-green-50 border-green-200">
                <Info className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900">往来卡片方式说明</AlertTitle>
                <AlertDescription className="text-green-800 text-sm">
                  <p className="mb-2">使用往来卡片方式记录往来明细时：</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>每个往来单位作为一张独立的往来卡片</li>
                    <li>通过辅助核算功能记录往来信息</li>
                    <li>在发票和银行流水生成凭证时，自动创建缺失的往来卡片</li>
                    <li>适合电算化，辅助核算为主，科目结构更简洁</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveSettings}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              保存设置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
