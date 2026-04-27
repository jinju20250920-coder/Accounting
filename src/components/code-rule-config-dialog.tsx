'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Settings, RotateCcw } from 'lucide-react';
import { CodeRuleManager, previewCode, type CodeRule, type ResetPeriod } from '@/lib/code-generator';
import { useAccountSetStore } from '@/stores/useAccountSetStore';

interface CodeRuleConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleType: 'fixed_asset' | 'intangible_asset' | 'prepaid_expense';
  title: string;
  existingCodes: string[];
  onSave: (rule: CodeRule) => void;
}

export function CodeRuleConfigDialog({
  open,
  onOpenChange,
  ruleType,
  title,
  existingCodes,
  onSave,
}: CodeRuleConfigDialogProps) {
  const { showToast } = useToast();
  const accountSetStore = useAccountSetStore.getState();
  const currentAccountSet = accountSetStore.getCurrentAccountSet();

  const [formData, setFormData] = useState<Partial<CodeRule>>({
    prefix: 'FA',
    padding: 4,
    separator: '',
    autoIncrement: true,
    resetPeriod: 'none',
  });

  useEffect(() => {
    if (open) {
      const manager = CodeRuleManager.getInstance();
      const rule = manager.getRuleByType(ruleType);
      setFormData({
        prefix: rule.prefix,
        suffix: rule.suffix,
        padding: rule.padding,
        separator: rule.separator,
        autoIncrement: rule.autoIncrement,
        resetPeriod: rule.resetPeriod,
      });
    }
  }, [open, ruleType]);

  const handleSave = async () => {
    if (!formData.prefix && formData.autoIncrement) {
      showToast('error', '自动编码时前缀不能为空');
      return;
    }

    const manager = CodeRuleManager.getInstance();
    const ruleId = `${ruleType}_rule`;
    const existingRule = manager.getRule(ruleId);

    const updatedRule: CodeRule = {
      id: ruleId,
      name: title,
      prefix: formData.prefix || '',
      suffix: formData.suffix || '',
      padding: formData.padding || 4,
      separator: (formData.separator as '-' | '_' | '') || '',
      autoIncrement: formData.autoIncrement ?? true,
      resetPeriod: (formData.resetPeriod as ResetPeriod) || 'none',
      lastNumber: existingRule?.lastNumber || 0,
      lastResetDate: existingRule?.lastResetDate,
      accountSetId: currentAccountSet?.id,
    };

    manager.setRule(updatedRule);

    // 保存到数据库
    if (currentAccountSet?.id) {
      await manager.saveToDB(currentAccountSet.id);
    }

    onSave(updatedRule);
    showToast('success', '编码规则已保存');
    onOpenChange(false);
  };

  const handleReset = () => {
    const manager = CodeRuleManager.getInstance();
    manager.resetToDefaults();
    const rule = manager.getRuleByType(ruleType);
    setFormData({
      prefix: rule.prefix,
      suffix: rule.suffix,
      padding: rule.padding,
      separator: rule.separator,
      autoIncrement: rule.autoIncrement,
      resetPeriod: rule.resetPeriod,
    });
    showToast('success', '已恢复默认设置');
  };

  const preview = previewCode(formData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {title}编码规则设置
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 编码模式 */}
          <div className="flex items-center justify-between">
            <Label>自动编码</Label>
            <Switch
              checked={formData.autoIncrement ?? true}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoIncrement: checked }))}
            />
          </div>

          {formData.autoIncrement && (
            <>
              {/* 前缀 */}
              <div className="space-y-2">
                <Label required>前缀</Label>
                <Input
                  value={formData.prefix || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                  placeholder="如 FA、IA、PE"
                  maxLength={4}
                />
              </div>

              {/* 数字位数 */}
              <div className="space-y-2">
                <Label>数字位数</Label>
                <Select
                  value={String(formData.padding || 4)}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, padding: parseInt(v) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3位 (001-999)</SelectItem>
                    <SelectItem value="4">4位 (0001-9999)</SelectItem>
                    <SelectItem value="5">5位 (00001-99999)</SelectItem>
                    <SelectItem value="6">6位 (000001-999999)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 分隔符 */}
              <div className="space-y-2">
                <Label>分隔符</Label>
                <Select
                  value={formData.separator || ''}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, separator: v as '-' | '_' | '' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">无分隔符</SelectItem>
                    <SelectItem value="-">横线 (-)</SelectItem>
                    <SelectItem value="_">下划线 (_)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 重置周期 */}
              <div className="space-y-2">
                <Label>编号重置周期</Label>
                <Select
                  value={formData.resetPeriod || 'none'}
                  onValueChange={(v) => setFormData(prev => ({ ...prev, resetPeriod: v as ResetPeriod }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">不重置（连续编号）</SelectItem>
                    <SelectItem value="monthly">按月重置</SelectItem>
                    <SelectItem value="yearly">按年重置</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 预览 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-600 mb-1">编码预览</div>
                <div className="text-lg font-mono font-bold text-blue-700">{preview}</div>
                {formData.resetPeriod !== 'none' && (
                  <div className="text-xs text-blue-500 mt-1">
                    {formData.resetPeriod === 'monthly' ? '每月从001重新开始' : '每年从001重新开始'}
                  </div>
                )}
              </div>
            </>
          )}

          {!formData.autoIncrement && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="text-sm text-slate-600">
                手动编码模式：新增资产时需手动输入编码，系统不自动生成。
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            恢复默认
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}