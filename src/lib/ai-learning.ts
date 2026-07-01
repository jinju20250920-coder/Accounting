/**
 * AI学习引擎 - 增强版，支持辅助核算项目+摘要智能推荐
 */

import { getSmartMatch } from './accounting';

// 辅助核算项目类型
enum AuxiliaryType {
  DEPARTMENT = 'dept',
  PROJECT = 'project',
  CUSTOMER = 'customer',
  SUPPLIER = 'supplier'
}

// 学习记录接口
interface LearningRecord {
  id: string;
  timestamp: string;
  pattern: LearningPattern;
  action: LearningAction;
  context: LearningContext;
  result: 'success' | 'failure';
  confidence: number;
}

// 学习模式
interface LearningPattern {
  // 核心匹配字段
  partnerName: string;        // 对方单位名称
  summary: string;            // 摘要文本
  amount?: number;            // 金额区间

  // 辅助核算项目
  department?: string;        // 部门
  project?: string;          // 项目

  // 税率相关
  taxRate?: number;          // 税率
  taxType?: string;          // 税种

  // 时间特征
  timeOfDay?: string;        // 时间段（上午/下午）
  dayOfWeek?: number;        // 星期几
  month?: number;           // 月份
}

// 学习动作
interface LearningAction {
  subject: string;          // 最终选择的科目
  auxiliary?: {             // 辅助核算项目
    department?: string;
    project?: string;
    customer?: string;
    supplier?: string;
  };
  taxDetail?: {             // 税费明细
    taxRate: number;
    taxAccount: string;     // 税费科目
  };
  adjustment?: string;       // 调整说明
}

// 学习上下文
interface LearningContext {
  originalSubject?: string;  // 原始推荐科目
  suggestedSubjects?: string[]; // 系统建议的科目列表
  userBehavior: 'accept' | 'modify' | 'reject'; // 用户行为
  inputMethod: 'manual' | 'auto-complete' | 'template'; // 输入方式
}

// AI学习引擎
export class AILearningEngine {
  private records: LearningRecord[] = [];
  private patterns: Map<string, LearningPattern[]> = new Map();

  /**
   * 记录用户操作
   */
  recordAction(
    pattern: LearningPattern,
    action: LearningAction,
    context: LearningContext,
    result: 'success' | 'failure' = 'success'
  ): void {
    const record: LearningRecord = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      pattern,
      action,
      context,
      result,
      confidence: this.calculateConfidence(pattern, action)
    };

    this.records.push(record);

    // 更新模式库
    this.updatePatternLibrary(pattern, action, result);

    // 只保留最近1000条记录
    if (this.records.length > 1000) {
      this.records = this.records.slice(-1000);
    }
  }

  /**
   * 智能推荐
   */
  getSmartRecommendation(
    input: {
      partnerName: string;
      summary: string;
      amount?: number;
      taxAmount?: number;
      taxRate?: number;
      departmentOptions?: string[];
      projectOptions?: string[];
    }
  ): {
    subject: string;
    subjectName: string;
    auxiliary?: {
      department?: string;
      project?: string;
      customer?: string;
      supplier?: string;
    };
    taxDetail?: {
      taxRate: number;
      taxAccount: string;
    };
    confidence: number;
    source: 'user-preference' | 'rule' | 'calculated';
    reasons: string[];
  } {
    const reasons: string[] = [];

    // 1. 尝试基于辅助核算项目+摘要的精确匹配
    const exactMatch = this.findExactMatch(input);
    if (exactMatch) {
      reasons.push(`基于完整模式匹配：${input.partnerName} - ${input.summary}`);
      return {
        subject: exactMatch.subject,
        subjectName: exactMatch.subjectName,
        auxiliary: exactMatch.auxiliary,
        taxDetail: exactMatch.taxDetail,
        confidence: exactMatch.confidence,
        source: 'user-preference' as const,
        reasons: reasons
      };
    }

    // 2. 尝试基于对方单位+摘要的模式匹配
    const partnerSummaryMatch = this.findPartnerSummaryMatch(input);
    if (partnerSummaryMatch) {
      reasons.push(`基于对方单位匹配：${input.partnerName}`);
      return {
        subject: partnerSummaryMatch.subject,
        subjectName: partnerSummaryMatch.subjectName,
        auxiliary: partnerSummaryMatch.auxiliary,
        taxDetail: partnerSummaryMatch.taxDetail,
        confidence: partnerSummaryMatch.confidence,
        source: 'user-preference' as const,
        reasons: reasons
      };
    }

    // 3. 尝试基于税率推荐税金科目
    if (input.taxRate && input.taxAmount) {
      const taxRecommendation = this.recommendTaxAccount(input.taxRate);
      if (taxRecommendation) {
        reasons.push(`基于税率 ${input.taxRate * 100}% 推荐`);
        return {
          ...taxRecommendation,
          auxiliary: this.recommendAuxiliary(input),
          confidence: 0.8,
          source: 'calculated',
          reasons
        };
      }
    }

    // 4. 基础AI匹配
    const baseMatch = getSmartMatch(input.summary, this.getUserPreferences(), []);
    if (baseMatch) {
      reasons.push('基础AI匹配');
      return {
        subject: baseMatch.subject,
        subjectName: baseMatch.subjectName || '',
        auxiliary: this.recommendAuxiliary(input),
        confidence: baseMatch.confidence || 0.6,
        source: baseMatch.source === 'manual' ? 'calculated' : baseMatch.source,
        reasons
      };
    }

    // 5. 默认推荐
    reasons.push('使用默认科目');
    return {
      subject: '6603',
      subjectName: '管理费用',
      auxiliary: this.recommendAuxiliary(input),
      confidence: 0.3,
      source: 'calculated',
      reasons
    };
  }

  /**
   * 查找精确匹配
   */
  private findExactMatch(input: { partnerName: string; summary: string }) {
    // 查找完全匹配的模式
    const candidates = this.records.filter(r =>
      r.pattern.partnerName === input.partnerName &&
      r.pattern.summary === input.summary &&
      r.result === 'success'
    );

    if (candidates.length > 0) {
      // 选择置信度最高的记录
      const best = candidates.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      return {
        subject: best.action.subject,
        subjectName: this.getSubjectName(best.action.subject),
        auxiliary: best.action.auxiliary,
        taxDetail: best.action.taxDetail,
        confidence: best.confidence,
        source: 'user-preference',
        reasons: [`历史成功记录：${candidates.length}次`]
      };
    }

    return null;
  }

  /**
   * 查找对方单位+摘要匹配
   */
  private findPartnerSummaryMatch(input: { partnerName: string; summary: string }) {
    const candidates = this.records.filter(r =>
      r.pattern.partnerName === input.partnerName &&
      r.result === 'success' &&
      this.isSimilarSummary(r.pattern.summary, input.summary)
    );

    if (candidates.length >= 2) {
      // 统计最常用的科目
      const subjectCounts = new Map<string, number>();
      candidates.forEach(r => {
        subjectCounts.set(r.action.subject, (subjectCounts.get(r.action.subject) || 0) + 1);
      });

      const mostUsed = Array.from(subjectCounts.entries())
        .sort((a, b) => b[1] - a[1])[0];

      return {
        subject: mostUsed[0],
        subjectName: this.getSubjectName(mostUsed[0]),
        auxiliary: this.recommendAuxiliary(input),
        taxDetail: undefined,
        confidence: Math.min(candidates.length * 0.1, 0.9),
        source: 'user-preference',
        reasons: [`基于 ${candidates.length} 条相似记录`]
      };
    }

    return null;
  }

  /**
   * 推荐辅助核算项目
   */
  private recommendAuxiliary(input: { partnerName: string; summary: string; amount?: number; departmentOptions?: string[]; projectOptions?: string[] }) {
    const auxiliary: {
      department?: string;
      project?: string;
      customer?: string;
      supplier?: string;
    } = {};

    // 基于历史记录推荐部门
    const deptMatches = this.records.filter(r =>
      r.pattern.partnerName === input.partnerName &&
      r.result === 'success' &&
      r.action.auxiliary?.department
    );

    if (deptMatches.length > 0) {
      const depts = deptMatches.map(r => r.action.auxiliary!.department);
      const mostCommon = depts.reduce((a, b) =>
        depts.filter(v => v === a).length >= depts.filter(v => v === b).length ? a : b
      );
      auxiliary.department = mostCommon;
    }

    // 基于金额大小推荐项目
    if (input.amount && input.amount > 10000) {
      auxiliary.project = '重要项目'; // 可以配置项目规则
    }

    return auxiliary;
  }

  /**
   * 推荐税金科目
   */
  private recommendTaxAccount(taxRate: number) {
    const taxRules = [
      { rate: 0.03, account: '22210103', name: '增值税-3%' },
      { rate: 0.06, account: '22210106', name: '增值税-6%' },
      { rate: 0.09, account: '22210109', name: '增值税-9%' },
      { rate: 0.13, account: '22210113', name: '增值税-13%' },
      { rate: 0.17, account: '22210117', name: '增值税-17%' }
    ];

    const rule = taxRules.find(r => Math.abs(r.rate - taxRate) < 0.001);
    if (rule) {
      return {
        subject: rule.account,
        subjectName: rule.name
      };
    }

    return null;
  }

  /**
   * 获取用户偏好列表
   */
  private getUserPreferences(): Array<{ summary: string; subject: string; timestamp: number }> {
    return this.records
      .filter(r => r.result === 'success')
      .map(r => ({
        summary: r.pattern.partnerName,
        subject: r.action.subject,
        timestamp: new Date(r.timestamp).getTime()
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 判断摘要是否相似
   */
  private isSimilarSummary(summary1: string, summary2: string): boolean {
    // 简单的相似度计算
    const words1 = summary1.toLowerCase().split(/\s+/);
    const words2 = summary2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter(word =>
      words2.some(w => word.includes(w) || w.includes(word))
    );

    return commonWords.length >= Math.min(words1.length, words2.length) * 0.5;
  }

  /**
   * 获取科目名称
   */
  private getSubjectName(code: string): string {
    // 这里应该从科目库获取，简化实现
    const subjectMap: { [key: string]: string } = {
      '1122': '应收账款',
      '2202': '应付账款',
      '6001': '主营业务收入',
      '6603': '管理费用',
      '222101': '应交税费-增值税',
      '660201': '销售费用'
    };

    return subjectMap[code] || code;
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(pattern: LearningPattern, action: LearningAction): number {
    let confidence = 0.5;

    // 基于匹配精确度
    if (pattern.partnerName && pattern.summary) {
      confidence += 0.3;
    }

    // 基于历史成功率
    const successRate = this.records.filter(r =>
      r.pattern.partnerName === pattern.partnerName &&
      r.result === 'success'
    ).length / Math.max(1, this.records.filter(r =>
      r.pattern.partnerName === pattern.partnerName
    ).length);

    confidence += successRate * 0.2;

    return Math.min(confidence, 1.0);
  }

  /**
   * 更新模式库
   */
  private updatePatternLibrary(pattern: LearningPattern, action: LearningAction, result: string): void {
    const key = pattern.partnerName;
    if (!this.patterns.has(key)) {
      this.patterns.set(key, []);
    }

    const patterns = this.patterns.get(key)!;

    // 移除旧的相同模式
    const existingIndex = patterns.findIndex(p =>
      p.summary === pattern.summary &&
      p.amount === pattern.amount
    );

    if (existingIndex >= 0) {
      patterns.splice(existingIndex, 1);
    }

    // 添加新模式
    patterns.unshift({
      ...pattern
    });

    // 只保留最近10个模式
    if (patterns.length > 10) {
      patterns.splice(10);
    }
  }

  /**
   * 获取学习统计
   */
  getStatistics() {
    const totalRecords = this.records.length;
    const successRecords = this.records.filter(r => r.result === 'success').length;
    const successRate = totalRecords > 0 ? successRecords / totalRecords : 0;

    // 最常学习的科目
    const subjectStats = new Map<string, number>();
    this.records.forEach(r => {
      if (r.result === 'success') {
        subjectStats.set(r.action.subject, (subjectStats.get(r.action.subject) || 0) + 1);
      }
    });

    const topSubjects = Array.from(subjectStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // 学习热点
    const partnerStats = new Map<string, number>();
    this.records.forEach(r => {
      if (r.result === 'success') {
        partnerStats.set(r.pattern.partnerName, (partnerStats.get(r.pattern.partnerName) || 0) + 1);
      }
    });

    const topPartners = Array.from(partnerStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      totalRecords,
      successRate,
      topSubjects,
      topPartners
    };
  }
}

// 全局实例
export const aiLearningEngine = new AILearningEngine();

// 生成ID的辅助函数
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}