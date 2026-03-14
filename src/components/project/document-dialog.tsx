'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/stores/useProjectStore';
import { ProjectDocument } from '@/stores/useProjectStore';

interface DocumentDialogProps {
  doc?: ProjectDocument;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DocumentDialog({ doc, open = false, onOpenChange }: DocumentDialogProps) {
  const { addDocument, updateDocument } = useProjectStore();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'requirements' as ProjectDocument['category'],
    version: 'v1.0',
    status: 'draft' as ProjectDocument['status'],
    author: '',
    tags: [] as string[]
  });

  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (doc) {
      setFormData({
        title: doc.title,
        content: doc.content,
        category: doc.category,
        version: doc.version,
        status: doc.status,
        author: doc.author,
        tags: [...doc.tags]
      });
      setTagInput('');
    } else {
      // 重置表单
      setFormData({
        title: '',
        content: '',
        category: 'requirements',
        version: 'v1.0',
        status: 'draft',
        author: '',
        tags: []
      });
      setTagInput('');
    }
  }, [doc, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const docData = {
        ...formData,
        relatedChanges: []
      };

      if (doc) {
        // 更新文档
        updateDocument(doc.id, docData);
      } else {
        // 新建文档
        addDocument(docData);
      }

      // 重置表单并关闭对话框
      setFormData({
        title: '',
        content: '',
        category: 'requirements',
        version: 'v1.0',
        status: 'draft',
        author: '',
        tags: []
      });
      setTagInput('');

      onOpenChange?.(false);
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const getCategoryOptions = () => [
    { value: 'requirements', label: '需求文档', icon: '📋' },
    { value: 'technical', label: '技术文档', icon: '⚙️' },
    { value: 'database', label: '数据库文档', icon: '🗄️' },
    { value: 'progress', label: '进度文档', icon: '📈' },
    { value: 'tests', label: '测试文档', icon: '🧪' },
    { value: 'changes', label: '变更记录', icon: '🔄' }
  ];

  const getStatusOptions = () => [
    { value: 'draft', label: '草稿', color: 'bg-gray-100 text-gray-700' },
    { value: 'review', label: '审核中', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'approved', label: '已批准', color: 'bg-green-100 text-green-700' },
    { value: 'rejected', label: '已拒绝', color: 'bg-red-100 text-red-700' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {doc ? '编辑文档' : '创建新文档'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 基本信息 */}
          <div className="space-y-2">
            <Label htmlFor="title">文档标题 *</Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="输入文档标题"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>文档分类 *</Label>
              <div className="grid grid-cols-3 gap-2">
                {getCategoryOptions().map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.category === option.value ? "default" : "outline"}
                    className="text-xs h-10"
                    onClick={() => setFormData({ ...formData, category: option.value as ProjectDocument['category'] })}
                  >
                    <span className="mr-1">{option.icon}</span>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>文档状态</Label>
              <div className="flex flex-wrap gap-2">
                {getStatusOptions().map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={formData.status === option.value ? "default" : "outline"}
                    className={`text-xs ${formData.status === option.value ? option.color : ''}`}
                    onClick={() => setFormData({ ...formData, status: option.value as ProjectDocument['status'] })}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* 版本和作者 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">版本号</Label>
              <Input
                id="version"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                placeholder="例如：v1.0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">作者 *</Label>
              <Input
                id="author"
                required
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="输入作者姓名"
              />
            </div>
          </div>

          {/* 文档内容 */}
          <div className="space-y-2">
            <Label htmlFor="content">文档内容 *</Label>
            <Textarea
              id="content"
              required
              rows={10}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="输入文档内容（支持 Markdown 格式）"
            />
          </div>

          {/* 标签管理 */}
          <div className="space-y-2">
            <Label>标签</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入标签后按回车添加"
                className="flex-1"
              />
              <Button type="button" onClick={handleAddTag}>
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="cursor-pointer">
                  {tag}
                  <button
                    type="button"
                    className="ml-2 text-xs"
                    onClick={() => handleRemoveTag(tag)}
                  >
                    ✕
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange?.(false)}
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !formData.title || !formData.content || !formData.author}
            >
              {isSubmitting ? '保存中...' : (doc ? '更新文档' : '创建文档')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}