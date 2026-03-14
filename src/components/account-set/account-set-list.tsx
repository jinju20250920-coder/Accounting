'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Calendar,
  Users,
  TrendingUp,
  MoreHorizontal,
  Search,
  Plus,
  FileText,
  Database,
  Shield,
  BarChart3
} from 'lucide-react';

interface AccountSet {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'inactive' | 'archived';
  period: string;
  currency: string;
  bookkeeper: string;
  lastBackup: string;
  dataSize: number;
  voucherCount: number;
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
}

export function AccountSetList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'archived'>('all');

  // 模拟账套数据
  const accountSets: AccountSet[] = [
    {
      id: '1',
      name: '上海乐茜信息技术有限公司',
      code: 'SHLQ001',
      startDate: '2024-03-01',
      status: 'active',
      period: '2024-03 至今',
      currency: 'CNY',
      bookkeeper: '张会计',
      lastBackup: '2026-03-10 10:00',
      dataSize: 2.5,
      voucherCount: 156,
      statusColor: 'green'
    },
    {
      id: '2',
      name: '分公司-华东',
      code: 'EAST001',
      startDate: '2025-01-01',
      status: 'active',
      period: '2025-01 至今',
      currency: 'CNY',
      bookkeeper: '李会计',
      lastBackup: '2026-03-09 18:30',
      dataSize: 1.8,
      voucherCount: 89,
      statusColor: 'yellow'
    },
    {
      id: '3',
      name: '分公司-华南',
      code: 'SOUTH001',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'archived',
      period: '2024年度',
      currency: 'CNY',
      bookkeeper: '王会计',
      lastBackup: '2024-12-31 23:59',
      dataSize: 3.2,
      voucherCount: 342,
      statusColor: 'gray'
    }
  ];

  // 过滤账套
  const filteredSets = accountSets.filter(set => {
    const matchesSearch = set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         set.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || set.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: AccountSet['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">使用中</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">停用</Badge>;
      case 'archived':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-800">已归档</Badge>;
    }
  };

  const getStatusColor = (color: AccountSet['statusColor']) => {
    switch (color) {
      case 'green': return 'text-green-600 bg-green-100 border-green-200';
      case 'yellow': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'red': return 'text-red-600 bg-red-100 border-red-200';
      case 'gray': return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总账套数</p>
                <p className="text-2xl font-bold">{accountSets.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">活跃账套</p>
                <p className="text-2xl font-bold text-green-600">
                  {accountSets.filter(s => s.status === 'active').length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总凭证数</p>
                <p className="text-2xl font-bold">
                  {accountSets.reduce((sum, s) => sum + s.voucherCount, 0).toLocaleString()}
                </p>
              </div>
              <FileText className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">存储空间</p>
                <p className="text-2xl font-bold">
                  {accountSets.reduce((sum, s) => sum + s.dataSize, 0).toFixed(1)} GB
                </p>
              </div>
              <Database className="h-8 w-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 搜索和筛选 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="搜索账套名称或编号..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                全部
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('active')}
              >
                使用中
              </Button>
              <Button
                variant={filterStatus === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('inactive')}
              >
                停用
              </Button>
              <Button
                variant={filterStatus === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('archived')}
              >
                已归档
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 账套列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>账套列表</CardTitle>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建账套
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSets.map((set) => (
              <div key={set.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Building2 className="h-5 w-5 text-blue-500" />
                      <div>
                        <h3 className="font-semibold">{set.name}</h3>
                        <p className="text-sm text-muted-foreground">编号: {set.code}</p>
                      </div>
                      {getStatusBadge(set.status)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground">会计期间</p>
                        <p className="text-sm font-medium">{set.period}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">币种</p>
                        <p className="text-sm font-medium">{set.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">会计人员</p>
                        <p className="text-sm font-medium">{set.bookkeeper}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">最后备份</p>
                        <p className="text-sm font-medium">{set.lastBackup}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span>凭证: {set.voucherCount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Database className="h-4 w-4 text-gray-400" />
                        <span>存储: {set.dataSize} GB</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="ghost" size="sm">
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    {set.status !== 'archived' && (
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 状态指示器 */}
                <div className={`mt-3 p-2 rounded ${getStatusColor(set.statusColor)}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${set.statusColor === 'green' ? 'bg-green-600' :
                                                          set.statusColor === 'yellow' ? 'bg-yellow-600' :
                                                          set.statusColor === 'red' ? 'bg-red-600' : 'bg-gray-600'}`}></div>
                    <span className="text-xs font-medium">
                      {set.statusColor === 'green' ? '数据正常' :
                       set.statusColor === 'yellow' ? '需要关注' :
                       set.statusColor === 'red' ? '异常状态' : '已归档'}
                    </span>
                    {set.status === 'active' && (
                      <span className="text-xs">自动备份已开启</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredSets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Building2 className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>暂无账套数据</p>
              <p className="text-xs mt-1">点击上方按钮创建新账套</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 备份提醒 */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">备份提醒</h4>
              <p className="text-sm text-blue-700">
                当前账套已 {accountSets[0]?.lastBackup} 备份。建议每天自动备份，确保数据安全。
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm">
                  立即备份
                </Button>
                <Button variant="ghost" size="sm">
                  备份设置
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}