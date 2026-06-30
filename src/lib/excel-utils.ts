import * as XLSX from 'xlsx';
import type { FixedAsset } from '@/types';

// 导出Excel文件
export const exportToExcel = <T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  headers: { key: string; label: string }[] = []
) => {
  if (data.length === 0) {
    throw new Error('没有可导出的数据');
  }

  // 如果没有提供headers，使用数据的第一个对象的键
  const finalHeaders = headers.length > 0
    ? headers
    : Object.keys(data[0]).map(key => ({ key, label: String(key) }));

  // 创建工作簿
  const ws = XLSX.utils.json_to_sheet(data.map(item => {
    const row: Record<string, unknown> = {};
    finalHeaders.forEach(({ key, label }) => {
      row[label] = item[key as keyof T];
    });
    return row;
  }));

  // 设置列宽
  const colWidths = finalHeaders.map(() => ({ wch: 15 }));
  ws['!cols'] = colWidths;

  // 创建工作簿并添加工作表
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '数据');

  // 导出文件
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// 导入Excel文件
export const importFromExcel = <T extends Record<string, unknown>>(
  file: File,
  headers: { key: string; label: string; required?: boolean }[]
): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // 获取第一个工作表
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 转换为JSON数据
        const jsonData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet);

        // 验证和处理数据
        const processedData = jsonData.map((row, index) => {
          const result: Record<string, unknown> = {};

          headers.forEach(({ key, label, required }) => {
            const value = row[label];

            // 检查必填字段
            if (required && (value === undefined || value === null || value === '')) {
              throw new Error(`第${index + 2}行：${label} 是必填字段`);
            }

            // 处理空值
            result[key] = value || null;
          });

          return result as T;
        });

        resolve(processedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsArrayBuffer(file);
  });
};

// 导出Excel模板
export const exportTemplate = <T>(
  filename: string,
  sampleData: T,
  headers: { key: string; label: string; placeholder?: string }[]
) => {
  // 使用 headers 的 label 作为列标题
  const rowWithLabels: Record<string, unknown> = {};
  headers.forEach(({ key, label }) => {
    rowWithLabels[label] = (sampleData as Record<string, unknown>)[key];
  });

  const ws = XLSX.utils.json_to_sheet([rowWithLabels]);

  // 设置列宽
  const colWidths = headers.map(() => ({ wch: 20 }));
  ws['!cols'] = colWidths;

  // 创建工作簿
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '模板');

  // 导出文件
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// 固定资产相关导出函数
export const parseFixedAssetsExcel = async (file: File) => {
  const headers = [
    { key: 'assetCode', label: '资产编码', required: false },
    { key: 'assetName', label: '资产名称', required: true },
    { key: 'categoryName', label: '资产分类', required: false },
    { key: 'originalValue', label: '原值', required: true },
    { key: 'salvageValue', label: '残值', required: false },
    { key: 'depreciationMethod', label: '折旧方法', required: false },
    { key: 'usefulLifeYears', label: '使用年限', required: false },
    { key: 'acquisitionDate', label: '购置日期', required: true },
    { key: 'departmentCode', label: '部门编码', required: false },
    { key: 'notes', label: '备注', required: false },
  ];

  try {
    const data = await importFromExcel<Record<string, unknown>>(file, headers);
    return { data, errors: [] };
  } catch (error: unknown) {
    return { data: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
};

export const exportFixedAssetsToExcel = (assets: FixedAsset[]) => {
  const headers = [
    { key: 'assetCode', label: '资产编码' },
    { key: 'assetName', label: '资产名称' },
    { key: 'categoryName', label: '资产分类' },
    { key: 'originalValue', label: '原值' },
    { key: 'salvageValue', label: '残值' },
    { key: 'accumulatedDepreciation', label: '累计折旧' },
    { key: 'netValue', label: '净值' },
    { key: 'depreciationMethod', label: '折旧方法' },
    { key: 'usefulLifeYears', label: '使用年限' },
    { key: 'acquisitionDate', label: '购置日期' },
    { key: 'depreciationStartDate', label: '折旧开始日期' },
    { key: 'depreciationEndDate', label: '折旧结束日期' },
    { key: 'departmentCode', label: '部门编号' },
    { key: 'status', label: '状态' },
    { key: 'location', label: '存放地点' },
    { key: 'notes', label: '备注' },
  ];

  const data = assets.map(asset => ({
    ...asset,
    depreciationMethod: getDepreciationMethodName(asset.depreciationMethod),
    status: asset.status === 'active' ? '在用' : asset.status === 'disposed' ? '已处置' : '已提足',
  }));

  exportToExcel(data, '固定资产', headers);
};

export const generateAssetImportTemplate = (type: 'fixed' | 'intangible' | 'prepaid') => {
  const templates = {
    fixed: {
      sampleData: {
        assetCode: 'FA-2024-001',
        assetName: '办公电脑',
        categoryName: '电子设备',
        originalValue: 5000,
        salvageValue: 500,
        depreciationMethod: '直线法',
        usefulLifeYears: 3,
        acquisitionDate: '2024-01-01',
        departmentCode: '',
        notes: '',
      },
      headers: [
        { key: 'assetCode', label: '资产编码' },
        { key: 'assetName', label: '资产名称' },
        { key: 'categoryName', label: '资产分类' },
        { key: 'originalValue', label: '原值' },
        { key: 'salvageValue', label: '残值' },
        { key: 'depreciationMethod', label: '折旧方法' },
        { key: 'usefulLifeYears', label: '使用年限' },
        { key: 'acquisitionDate', label: '购置日期' },
        { key: 'departmentCode', label: '部门编码' },
        { key: 'notes', label: '备注' },
      ],
    },
    intangible: {
      sampleData: {
        assetCode: 'IA-2024-001',
        assetName: '软件著作权',
        categoryName: '软件',
        originalValue: 10000,
        amortizationMethod: '直线法',
        usefulLifeYears: 5,
        acquisitionDate: '2024-01-01',
        notes: '',
      },
      headers: [
        { key: 'assetCode', label: '资产编码' },
        { key: 'assetName', label: '资产名称' },
        { key: 'categoryName', label: '资产分类' },
        { key: 'originalValue', label: '原值' },
        { key: 'amortizationMethod', label: '摊销方法' },
        { key: 'usefulLifeYears', label: '摊销年限' },
        { key: 'acquisitionDate', label: '取得日期' },
        { key: 'notes', label: '备注' },
      ],
    },
    prepaid: {
      sampleData: {
        assetCode: 'PE-2024-001',
        assetName: '预付租金',
        originalValue: 12000,
        usefulLifeMonths: 12,
        acquisitionDate: '2024-01-01',
        expenseSubjectCode: '6602',
        notes: '',
      },
      headers: [
        { key: 'assetCode', label: '编码' },
        { key: 'assetName', label: '名称' },
        { key: 'originalValue', label: '原值' },
        { key: 'usefulLifeMonths', label: '摊销月数' },
        { key: 'acquisitionDate', label: '发生日期' },
        { key: 'expenseSubjectCode', label: '费用科目' },
        { key: 'notes', label: '备注' },
      ],
    },
  };

  const { sampleData, headers } = templates[type];
  exportTemplate(type === 'fixed' ? '固定资产导入' : type === 'intangible' ? '无形资产导入' : '待摊费用导入', sampleData, headers);
};

// 折旧方法名称转换
const getDepreciationMethodName = (method: string) => {
  const names: Record<string, string> = {
    straight_line: '直线法',
    double_declining: '双倍余额递减法',
    sum_of_years: '年数总和法',
    units_of_production: '工作量法',
  };
  return names[method] || method;
};