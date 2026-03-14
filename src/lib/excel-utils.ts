import * as XLSX from 'xlsx';

// 导出Excel文件
export const exportToExcel = <T extends Record<string, any>>(
  data: T[],
  filename: string,
  headers: { key: keyof T; label: string }[] = []
) => {
  if (data.length === 0) {
    throw new Error('没有可导出的数据');
  }

  // 如果没有提供headers，使用数据的第一个对象的键
  const finalHeaders = headers.length > 0
    ? headers
    : Object.keys(data[0]).map(key => ({ key: key as keyof T, label: String(key) }));

  // 创建工作簿
  const ws = XLSX.utils.json_to_sheet(data.map(item => {
    const row: any = {};
    finalHeaders.forEach(({ key, label }) => {
      row[label] = item[key];
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
export const importFromExcel = <T extends Record<string, any>>(
  file: File,
  headers: { key: keyof T; label: string; required?: boolean }[]
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
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

        // 验证和处理数据
        const processedData = jsonData.map((row, index) => {
          const result: any = {};

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
  headers: { key: keyof T; label: string; placeholder?: string }[]
) => {
  const ws = XLSX.utils.json_to_sheet([sampleData]);

  // 设置列宽
  const colWidths = headers.map(() => ({ wch: 20 }));
  ws['!cols'] = colWidths;

  // 创建工作簿
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '模板');

  // 导出文件
  XLSX.writeFile(wb, `${filename}_模板.xlsx`);
};