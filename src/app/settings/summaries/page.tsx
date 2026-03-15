'use client';

import { useState } from 'react';
import { useSummaryStore } from '@/stores';
import { Plus, Trash2, Edit2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export default function SummariesSettingsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState<string | null>(null);
  const [newSummaryText, setNewSummaryText] = useState('');
  const [editingText, setEditingText] = useState('');

  const {
    commonSummaries,
    addCommonSummary,
    updateCommonSummary,
    deleteCommonSummary,
    clearRecentSummaries
  } = useSummaryStore();

  const handleAddSummary = () => {
    if (newSummaryText.trim()) {
      addCommonSummary(newSummaryText);
      setNewSummaryText('');
      setIsDialogOpen(false);
    }
  };

  const handleEditSummary = (id: string, text: string) => {
    setEditingSummary(id);
    setEditingText(text);
  };

  const handleSaveEdit = (id: string) => {
    if (editingText.trim()) {
      updateCommonSummary(id, editingText);
      setEditingSummary(null);
      setEditingText('');
    }
  };

  const handleCancelEdit = () => {
    setEditingSummary(null);
    setEditingText('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">常用摘要库</h1>
        <p className="text-slate-600 mt-1">管理常用摘要，提高凭证录入效率</p>
      </div>

      {/* 操作栏 */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              添加摘要
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加常用摘要</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="summaryText" className="text-sm font-medium text-slate-700">
                  摘要内容
                </label>
                <Input
                  id="summaryText"
                  value={newSummaryText}
                  onChange={(e) => setNewSummaryText(e.target.value)}
                  placeholder="请输入摘要内容，如：报销差旅费"
                  className="w-full"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAddSummary} disabled={!newSummaryText.trim()}>
                  确定
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="outline" onClick={clearRecentSummaries}>
          清除最近使用记录
        </Button>
      </div>

      {/* 摘要列表 */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {commonSummaries.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <p className="text-lg font-medium">暂无常用摘要</p>
                <p className="text-sm mt-2">点击"添加摘要"按钮开始创建</p>
              </div>
            ) : (
              commonSummaries
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((summary) => (
                  <div
                    key={summary.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />

                    {editingSummary === summary.id ? (
                      <div className="flex-1">
                        <Input
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="w-full"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className="flex-1 text-sm font-medium text-slate-700">
                        {summary.text}
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      {editingSummary === summary.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveEdit(summary.id)}
                          >
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                          >
                            取消
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditSummary(summary.id, summary.text)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteCommonSummary(summary.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card className="mt-8">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">使用说明</h3>
          <div className="space-y-2 text-sm text-slate-600">
            <p>• 在凭证录入页面的摘要栏点击时，会显示常用摘要列表</p>
            <p>• 支持使用键盘上下键选择，Enter 键自动填入</p>
            <p>• 用户输入的新摘要会自动添加到"最近使用"列表中</p>
            <p>• 最近使用列表最多保存 5 条记录</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
