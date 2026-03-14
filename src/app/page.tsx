'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Plus, Save, FileText, Upload, Search, Download, Printer,
  Calculator, TrendingUp, Users, Building2, RefreshCw, Settings,
  Plus as PlusIcon,
  Minus as MinusIcon,
  CheckCircle,
  Lightbulb,
  Database
} from 'lucide-react';
import { SubjectSearch } from '@/components/voucher/subject-search';
import { VoucherEntryGrid } from '@/components/voucher/voucher-entry-grid';
import { useUserPreferenceStore } from '@/stores';
import { useVoucherStore } from '@/stores/useVoucherStore';
import { aiLearningEngine } from '@/lib/ai-learning';
import { generateVoucherNo, getSubjects } from '@/lib/accounting';

// 获取科目数据
function getSubjectsData() {
  return getSubjects();
}

export default function VoucherPage() {
  const { getLedgerEntries, ledgerEntries } = useVoucherStore();
  const [showLedgerDialog, setShowLedgerDialog] = useState(false);
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherNo, setVoucherNo] = useState('记-001');
  const [summary, setSummary] = useState('');
  const [entries, setEntries] = useState([
    {
      id: '1',
      subjectCode: '',
      subjectName: '',
      debit: 0,
      credit: 0,
      aiRecommendation: null as null | {
        subject: string;
        subjectName: string;
        confidence: number;
        source: string;
      }
    },
    {
      id: '2',
      subjectCode: '',
      subjectName: '',
      debit: 0,
      credit: 0,
      aiRecommendation: null
    },
  ]);

  // AI学习相关
  const [isLearningEnabled, setIsLearningEnabled] = useState(true);
  const store = useUserPreferenceStore();
  const preferences = store.preferences;
  const subjects = getSubjectsData();

  // 当摘要改变时，自动填充后续行的摘要
  useEffect(() => {
    if (summary && entries.length > 0) {
      setEntries(prev => prev.map((entry, index) => {
        if (index === 0) return entry; // 第一行保持用户输入
        return { ...entry, summary };
      }));
    }
  }, [summary]);

  const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const addEntry = () => {
    setEntries([...entries, {
      id: Date.now().toString(),
      subjectCode: '',
      subjectName: '',
      debit: 0,
      credit: 0,
      aiRecommendation: null,
    }]);
  };

  const removeEntry = (id: string) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: string, field: string, value: any) => {
    setEntries(entries.map(e => {
      const updatedEntry = { ...e, [field]: value };

      // 如果更新了科目代码，检查是否需要记录AI学习
      if (field === 'subjectCode' && isLearningEnabled) {
        const entryIndex = entries.findIndex(entry => entry.id === id);
        if (entryIndex === 0) { // 只记录第一行的选择
          // 获取AI推荐
          const aiRecommendation = aiLearningEngine.getSmartRecommendation({
            partnerName: '',
            summary: summary || '摘要',
            amount: updatedEntry.debit || updatedEntry.credit || 0
          });

          // 如果用户选择了不同的科目，记录学习
          if (aiRecommendation && updatedEntry.subjectCode !== aiRecommendation.subject) {
            aiLearningEngine.recordAction(
              {
                partnerName: '',
                summary: summary || '摘要',
                amount: updatedEntry.debit || updatedEntry.credit || 0
              },
              {
                subject: updatedEntry.subjectCode
              },
              {
                userBehavior: 'modify',
                inputMethod: 'manual',
                originalSubject: aiRecommendation.subject
              }
            );
          }
        }
      }

      return updatedEntry;
    }));
  };

  const autoBalanceCredit = () => {
    const diff = totalDebit - totalCredit;
    setEntries(entries.map((e, index) => {
      if (index === entries.length - 1) {
        return { ...e, credit: diff > 0 ? diff : 0 };
      }
      return e;
    }));
  };

  // AI设置对话框
  const AILearningSettings = () => (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          AI设置
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI学习设置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">启用科目学习</p>
              <p className="text-sm text-slate-500">记录您的科目选择习惯</p>
            </div>
            <Button
              variant={isLearningEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsLearningEnabled(!isLearningEnabled)}
            >
              {isLearningEnabled ? '已启用' : '已禁用'}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">学习统计</h4>
            <div className="text-sm text-slate-600 space-y-1">
              <p>已记录偏好: {preferences.length} 条</p>
              <p>推荐准确率: {Math.round((preferences.filter(p => p.matchedCount > 0).length / Math.max(1, preferences.length)) * 100)}%</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">最近学习记录</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {preferences.slice(0, 5).map((pref, index) => (
                <div key={index} className="text-xs p-2 bg-slate-50 rounded">
                  <span className="font-medium">{pref.subject}</span> - {pref.summary}
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* AI状态栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            AI学习 {isLearningEnabled ? '✓' : '✗'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            已学习: {preferences.length} 条
          </Badge>
        </div>
        <AILearningSettings />
      </div>
      {/* 标题栏 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">记账凭证</h1>
          <p className="text-slate-600 mt-1">录入会计凭证</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline">2026年3月</Badge>
          <Badge variant={isBalanced ? 'default' : 'destructive'}>
            {isBalanced ? '平衡 ✓' : '不平衡 ⚠️'}
          </Badge>
        </div>
      </div>

      {/* 凭证信息 */}
      <Card className="mb-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>凭证信息</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-1" />
                保存模板
              </Button>
              <Button size="sm">
                <Save className="h-4 w-4 mr-1" />
                保存凭证
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-4">
              <label className="text-sm font-medium text-slate-700">凭证日期</label>
              <Input
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-4">
              <label className="text-sm font-medium text-slate-700">凭证字号</label>
              <Input
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="col-span-4">
              <label className="text-sm font-medium text-slate-700">摘要</label>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="输入凭证摘要"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 凭证分录网格 */}
      <Card>
        <CardHeader>
          <CardTitle>凭证分录</CardTitle>
          <CardDescription>录入凭证分录，Tab键快速导航</CardDescription>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              共 {entries.length} 行分录
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addEntry}>
                <PlusIcon className="h-4 w-4 mr-1" />
                新增行
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border-b">
                    摘要
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border-b">
                    科目代码
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border-b">
                    科目名称
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border-b">
                    借方金额
                  </th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-slate-700 border-b">
                    贷方金额
                  </th>
                  <th className="px-4 py-2 text-center text-sm font-medium text-slate-700 border-b">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 border-b">
                      <Input
                        value={summary || ''}
                        onChange={(e) => {}}
                        placeholder="摘要"
                        className="w-full text-xs"
                      />
                    </td>
                    <td className="px-4 py-2 border-b">
                      <div className="relative">
                        <div className="h-8 text-xs">
                          <SubjectSearch
                            value={entry.subjectCode}
                            onSelect={(code, name) => {
                              updateEntry(entry.id, 'subjectCode', code);
                              updateEntry(entry.id, 'subjectName', name);
                            }}
                            placeholder="输入科目代码或名称"
                          />
                        </div>
                        {entry.aiRecommendation && (
                          <div className="absolute top-full left-0 right-0 mt-1 p-1 bg-green-50 rounded border border-green-200 text-xs">
                            <div className="flex items-center gap-1 text-green-700">
                              <Lightbulb className="h-3 w-3" />
                              <span>AI推荐: {entry.aiRecommendation.subjectName}</span>
                              <Badge variant="outline" className="text-xs">
                                {Math.round(entry.aiRecommendation.confidence * 100)}%
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 border-b">
                      <span className="text-xs text-slate-600">
                        {entry.subjectName || '请输入科目代码'}
                      </span>
                    </td>
                    <td className="px-4 py-2 border-b">
                      <Input
                        type="number"
                        value={entry.debit}
                        onChange={(e) => updateEntry(entry.id, 'debit', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full text-xs text-right"
                      />
                    </td>
                    <td className="px-4 py-2 border-b">
                      <Input
                        type="number"
                        value={entry.credit}
                        onChange={(e) => updateEntry(entry.id, 'credit', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full text-xs text-right"
                      />
                    </td>
                    <td className="px-4 py-2 border-b text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                        onClick={() => removeEntry(entry.id)}
                      >
                        <MinusIcon className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100">
                  <td colSpan={3} className="px-4 py-2 text-sm font-medium text-slate-700">
                    合计
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-slate-700 text-right">
                    {totalDebit.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-slate-700 text-right">
                    {totalCredit.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {Math.abs(totalDebit - totalCredit).toLocaleString('zh-CN', {
                      style: 'currency',
                      currency: 'CNY',
                      minimumFractionDigits: 2
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 快捷操作 */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-2">
              {isBalanced ? null : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={autoBalanceCredit}
                >
                  <Search className="h-4 w-4 mr-1" />
                  自动平衡
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-1" />
                导入流水
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-1" />
                凭证模板
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" />
                导出Excel
              </Button>
              <Dialog open={showLedgerDialog} onOpenChange={setShowLedgerDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Database className="h-4 w-4 mr-1" />
                    查看记账表
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle>已入账记录</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-auto">
                    {ledgerEntries.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        暂无已入账记录
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 border-b">凭证号</th>
                            <th className="text-left p-2 border-b">入账日期</th>
                            <th className="text-left p-2 border-b">摘要</th>
                            <th className="text-left p-2 border-b">科目代码</th>
                            <th className="text-left p-2 border-b">科目名称</th>
                            <th className="text-right p-2 border-b">借方金额</th>
                            <th className="text-right p-2 border-b">贷方金额</th>
                            <th className="text-left p-2 border-b">部门</th>
                            <th className="text-left p-2 border-b">项目</th>
                            <th className="text-left p-2 border-b">入账时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledgerEntries.map((entry) => (
                            <tr key={entry.id} className="hover:bg-slate-50">
                              <td className="p-2 border-b">{entry.voucherNo}</td>
                              <td className="p-2 border-b">{entry.entryDate}</td>
                              <td className="p-2 border-b">{entry.summary}</td>
                              <td className="p-2 border-b font-mono">{entry.subjectCode}</td>
                              <td className="p-2 border-b">{entry.subjectName}</td>
                              <td className="p-2 border-b text-right">
                                {entry.debit > 0 ? entry.debit.toFixed(2) : ''}
                              </td>
                              <td className="p-2 border-b text-right">
                                {entry.credit > 0 ? entry.credit.toFixed(2) : ''}
                              </td>
                              <td className="p-2 border-b">{entry.deptCode || ''}</td>
                              <td className="p-2 border-b">{entry.projectCode || ''}</td>
                              <td className="p-2 border-b text-slate-500 text-xs">
                                {new Date(entry.entryTime).toLocaleString('zh-CN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
