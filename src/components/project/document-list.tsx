'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProjectStore } from '@/stores/useProjectStore';
import { ProjectDocument } from '@/stores/useProjectStore';
import { Search, FileText, Edit, Trash2, Eye, Plus } from 'lucide-react';
import { DocumentDialog } from './document-dialog';

export function DocumentList() {
  const {
    documents,
    selectedCategory,
    setSearchQuery,
    setSelectedCategory,
    deleteDocument
  } = useProjectStore();

  const [selectedDoc, setSelectedDoc] = useState<ProjectDocument | null>(null);

  // 按分类过滤文档
  const filteredDocuments = documents.filter(doc => {
    if (selectedCategory !== 'all' && doc.category !== selectedCategory) {
      return false;
    }
    // 简单的搜索过滤
    const searchQuery = '';
    if (searchQuery) {
      const queryLower = (searchQuery as string).toLowerCase();
      if (!(
        doc.title.toLowerCase().includes(queryLower) ||
        doc.content.toLowerCase().includes(queryLower) ||
        doc.tags.some(tag => tag.toLowerCase().includes(queryLower))
      )) {
        return false;
      }
    }
    return true;
  });

  // 按分类分组
  const documentsByCategory = {
    requirements: documents.filter(d => d.category === 'requirements'),
    technical: documents.filter(d => d.category === 'technical'),
    database: documents.filter(d => d.category === 'database'),
    progress: documents.filter(d => d.category === 'progress'),
    tests: documents.filter(d => d.category === 'tests'),
    changes: documents.filter(d => d.category === 'changes')
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      review: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getCategoryLabel = (category: string) => {
    const labels = {
      requirements: '需求文档',
      technical: '技术文档',
      database: '数据库文档',
      progress: '进度文档',
      tests: '测试文档',
      changes: '变更记录'
    };
    return labels[category as keyof typeof labels] || category;
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个文档吗？')) {
      deleteDocument(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">文档管理</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="搜索文档..."
              className="flex h-10 w-64 rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={selectedCategory === 'all' ? '' : ''}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DocumentDialog />
        </div>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList>
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="requirements">需求</TabsTrigger>
          <TabsTrigger value="technical">技术</TabsTrigger>
          <TabsTrigger value="database">数据库</TabsTrigger>
          <TabsTrigger value="progress">进度</TabsTrigger>
          <TabsTrigger value="tests">测试</TabsTrigger>
          <TabsTrigger value="changes">变更</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {selectedCategory === 'all' ? '所有文档' : getCategoryLabel(selectedCategory)}
                </span>
                <Badge variant="secondary">
                  {filteredDocuments.length} 个文档
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDocuments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-2" />
                  <p>暂无文档</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDocuments.map((doc) => (
                    <Card key={doc.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-sm font-medium line-clamp-2">
                              {doc.title}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              {getCategoryLabel(doc.category)}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${getStatusColor(doc.status)}`}
                          >
                            {doc.status === 'draft' && '草稿'}
                            {doc.status === 'review' && '审核中'}
                            {doc.status === 'approved' && '已批准'}
                            {doc.status === 'rejected' && '已拒绝'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {doc.content.substring(0, 150)}...
                        </p>

                        {/* 标签 */}
                        {doc.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {doc.tags.slice(0, 3).map((tag, index) => (
                              <Badge
                                key={index}
                                variant="outline"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                            {doc.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{doc.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* 作者和时间 */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>作者：{doc.author}</span>
                          <span>
                            {new Date(doc.updateTime).toLocaleDateString('zh-CN')}
                          </span>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center justify-between pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            onClick={() => setSelectedDoc(doc)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            查看
                          </Button>
                          <div className="flex gap-1">
                            <DocumentDialog doc={doc} />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleDelete(doc.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 文档详情弹窗 */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{selectedDoc.title}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDoc(null)}
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>分类：{getCategoryLabel(selectedDoc.category)}</span>
                  <span>版本：{selectedDoc.version}</span>
                  <span>状态：{selectedDoc.status}</span>
                </div>

                <div className="border-t pt-4">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap font-sans">
                      {selectedDoc.content}
                    </pre>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    创建时间：{new Date(selectedDoc.createTime).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    更新时间：{new Date(selectedDoc.updateTime).toLocaleString('zh-CN')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    作者：{selectedDoc.author}
                  </p>
                </div>

                {selectedDoc.tags.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="text-sm font-medium mb-2">标签</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedDoc.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}