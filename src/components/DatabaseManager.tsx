'use client';

import React, { useState, useRef } from 'react';
import { useDatabaseSync } from '@/hooks/useDatabaseSync';
import { database } from '@/lib/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectOption } from '@/components/ui/select';
import {
  Download,
  Upload,
  Trash2,
  Database,
  CloudUpload,
  FileDown,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DatabaseStats {
  voucherCount: number;
  subjectCount: number;
  departmentCount: number;
  projectCount: number;
  auditLogCount: number;
  lastSync: string | null;
}

export function DatabaseManager() {
  const { exportData, importData } = useDatabaseSync();
  const [stats, setStats] = useState<DatabaseStats>({
    voucherCount: 0,
    subjectCount: 0,
    departmentCount: 0,
    projectCount: 0,
    auditLogCount: 0,
    lastSync: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const loadStats = async () => {
    try {
      await database.init();

      const vouchers = await database.getAllVouchers();
      const subjects = await database.getAllSubjects();
      const departments = await database.getAllDepartments();
      const projects = await database.getAllProjects();
      const auditLogs = await database.getAuditLogs(1000);

      setStats({
        voucherCount: vouchers.length,
        subjectCount: subjects.length,
        departmentCount: departments.length,
        projectCount: projects.length,
        auditLogCount: auditLogs.length,
        lastSync: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleExport = async () => {
    try {
      setIsLoading(true);
      await exportData();
      await loadStats();
    } catch (error) {
      toast({
        title: "导出失败",
        description: "无法导出数据",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    try {
      setIsLoading(true);
      await importData(file);
      setImportDialogOpen(false);
      await loadStats();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: "导入失败",
        description: "无法导入文件",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      return;
    }

    try {
      setIsLoading(true);
      await database.clearAllData();

      // 重置本地状态
      window.location.reload();

      toast({
        title: "数据已清空",
        description: "所有数据已被成功删除",
        type: "success",
      });
    } catch (error) {
      toast({
        title: "清空失败",
        description: "无法清空数据",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Database className="w-4 h-4 mr-2" />
          数据管理
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>数据库管理</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 数据统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                数据统计
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.voucherCount}</div>
                  <div className="text-sm text-gray-600">凭证数量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.subjectCount}</div>
                  <div className="text-sm text-gray-600">科目数量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.departmentCount}</div>
                  <div className="text-sm text-gray-600">部门数量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{stats.projectCount}</div>
                  <div className="text-sm text-gray-600">项目数量</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{stats.auditLogCount}</div>
                  <div className="text-sm text-gray-600">审计日志</div>
                </div>
                <div className="text-center">
                  {stats.lastSync ? (
                    <>
                      <Badge variant="default" className="text-green-600 bg-green-50">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        已同步
                      </Badge>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(stats.lastSync).toLocaleString()}
                      </div>
                    </>
                  ) : (
                    <Badge variant="secondary" className="text-gray-600">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      未同步
                    </Badge>
                  )}
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={loadStats}
                className="mt-4 w-full"
              >
                刷新统计
              </Button>
            </CardContent>
          </Card>

          {/* 数据导入导出 */}
          <Card>
            <CardHeader>
              <CardTitle>数据导入导出</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>导出数据</Label>
                <p className="text-sm text-gray-600 mb-3">
                  将所有数据导出为 JSON 文件，可用于备份或迁移
                </p>
                <Button
                  onClick={handleExport}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isLoading ? '导出中...' : '导出数据'}
                </Button>
              </div>

              <div>
                <Label>导入数据</Label>
                <p className="text-sm text-gray-600 mb-3">
                  从 JSON 文件导入数据，将覆盖现有数据
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    选择文件
                  </Button>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImport(file);
                    }}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  支持 .json 格式的数据文件
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 危险操作 */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">危险操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">警告</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">
                    清空数据操作不可恢复，请确保已备份重要数据
                  </p>
                </div>

                <Button
                  variant="destructive"
                  onClick={handleClearAllData}
                  disabled={isLoading}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isLoading ? '清空中...' : '清空所有数据'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}