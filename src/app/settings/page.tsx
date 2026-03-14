'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSubjectStore } from '@/stores';
import { useDepartmentStore } from '@/stores';
import { useFinancialProjectStore } from '@/stores';
import { FolderOpen, Users, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('subjects');

  const { subjects } = useSubjectStore();
  const { departments } = useDepartmentStore();
  const { projects } = useFinancialProjectStore();

  const stats = [
    {
      label: '科目管理',
      value: 'subjects',
      icon: <FolderOpen className="h-5 w-5" />,
      count: subjects.length,
      description: '管理会计科目体系，支持多级科目和辅助核算',
      color: 'bg-blue-500'
    },
    {
      label: '部门管理',
      value: 'departments',
      icon: <Users className="h-5 w-5" />,
      count: departments.length,
      description: '管理组织架构，支持多级部门设置',
      color: 'bg-green-500'
    },
    {
      label: '项目管理',
      value: 'projects',
      icon: <Package className="h-5 w-5" />,
      count: projects.length,
      description: '管理财务项目档案，支持收入、成本、其他类型',
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">基础档案</h1>
        <p className="text-slate-600 mt-1">管理会计科目、部门组织、项目档案</p>
      </div>

      {/* 功能卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {stats.map((item) => (
          <Link
            key={item.value}
            href={`/settings/${item.value}`}
            className="group"
          >
            <Card className="h-full transition-all hover:shadow-lg hover:-translate-y-1">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg text-white ${item.color}`}>
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {item.label}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4">
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {item.count} 项
                      </Badge>
                      <span className="text-sm text-slate-500">管理</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 快速统计 */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">数据概览</h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{subjects.length}</p>
              <p className="text-sm text-slate-600">会计科目</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-green-600">{departments.length}</p>
              <p className="text-sm text-slate-600">部门组织</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{projects.length}</p>
              <p className="text-sm text-slate-600">财务项目</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
