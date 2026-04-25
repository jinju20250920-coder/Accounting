// src/components/invoice-rule/utils/rule-conflict-detector.ts

// 关键词规则类型
interface KeywordRule {
  id: string;
  keywords: string;
  businessGroup: string;
  threshold: number;
}

// 业务组类型
interface BusinessGroup {
  id: string;
  name: string;
}

// 冲突检测结果
interface ConflictResult {
  ruleId1: string;
  ruleId2: string;
  businessGroup1: string;
  businessGroup2: string;
  overlappingKeywords: string[];
  severity: 'warning' | 'error';
  message: string;
}

export class RuleConflictDetector {
  // 检测关键词重叠
  static detectKeywordOverlaps(rules: KeywordRule[], groups: BusinessGroup[]): ConflictResult[] {
    const conflicts: ConflictResult[] = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        if (this.hasKeywordOverlap(rule1, rule2)) {
          conflicts.push(this.createConflict(rule1, rule2, groups));
        }
      }
    }

    return conflicts;
  }

  private static hasKeywordOverlap(rule1: KeywordRule, rule2: KeywordRule): boolean {
    const keywords1 = this.parseKeywords(rule1.keywords);
    const keywords2 = this.parseKeywords(rule2.keywords);

    return keywords1.some(keyword =>
      keywords2.some(otherKeyword =>
        this.isSimilarKeyword(keyword, otherKeyword)
      )
    );
  }

  private static parseKeywords(keywordStr: string): string[] {
    return keywordStr
      .split(/[，,;\s]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
  }

  private static isSimilarKeyword(keyword1: string, keyword2: string): boolean {
    const k1 = keyword1.toLowerCase().trim();
    const k2 = keyword2.toLowerCase().trim();

    // 完全匹配
    if (k1 === k2) return true;

    // 包含匹配（如"电脑"包含"笔记本电脑"）
    if (k1.includes(k2) || k2.includes(k1)) return true;

    // 相似度匹配（Levenshtein距离）
    if (this.calculateSimilarity(k1, k2) > 0.6) return true;

    return false;
  }

  private static calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    const longerLength = longer.length;

    if (longerLength === 0) return 1.0;

    return (longerLength - this.levenshteinDistance(longer, shorter)) / longerLength;
  }

  private static levenshteinDistance(s1: string, s2: string): number {
    const matrix = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  private static createConflict(rule1: KeywordRule, rule2: KeywordRule, groups: BusinessGroup[]): ConflictResult {
    const keywords1 = this.parseKeywords(rule1.keywords);
    const keywords2 = this.parseKeywords(rule2.keywords);

    const overlappingKeywords = keywords1.filter(keyword =>
      keywords2.some(otherKeyword =>
        this.isSimilarKeyword(keyword, otherKeyword)
      )
    );

    const group1 = groups.find(g => g.id === rule1.businessGroup)?.name || rule1.businessGroup;
    const group2 = groups.find(g => g.id === rule2.businessGroup)?.name || rule2.businessGroup;

    let severity: 'warning' | 'error' = 'warning';
    let message = `规则 "${group1}" 和 "${group2}" 存在关键词重叠`;

    if (group1 === group2) {
      severity = 'error';
      message = `同一业务组 "${group1}" 存在重复规则`;
    }

    return {
      ruleId1: rule1.id,
      ruleId2: rule2.id,
      businessGroup1: group1,
      businessGroup2: group2,
      overlappingKeywords,
      severity,
      message,
    };
  }

  // 检测优先级冲突
  static detectPriorityConflicts(rules: KeywordRule[], groups: BusinessGroup[]): ConflictResult[] {
    const conflicts: ConflictResult[] = [];
    const groupRuleMap = new Map<string, KeywordRule[]>();

    // 按业务组分组规则
    rules.forEach(rule => {
      if (!groupRuleMap.has(rule.businessGroup)) {
        groupRuleMap.set(rule.businessGroup, []);
      }
      groupRuleMap.get(rule.businessGroup)!.push(rule);
    });

    // 检查同一业务组内的规则
    groupRuleMap.forEach((groupRules, groupId) => {
      if (groupRules.length > 1) {
        for (let i = 0; i < groupRules.length; i++) {
          for (let j = i + 1; j < groupRules.length; j++) {
            const rule1 = groupRules[i];
            const rule2 = groupRules[j];

            if (this.hasKeywordOverlap(rule1, rule2)) {
              conflicts.push({
                ruleId1: rule1.id,
                ruleId2: rule2.id,
                businessGroup1: groups.find(g => g.id === groupId)?.name || groupId,
                businessGroup2: groups.find(g => g.id === groupId)?.name || groupId,
                overlappingKeywords: this.parseKeywords(rule1.keywords).filter(keyword =>
                  this.parseKeywords(rule2.keywords).some(other =>
                    this.isSimilarKeyword(keyword, other)
                  )
                ),
                severity: 'error',
                message: `业务组 "${groups.find(g => g.id === groupId)?.name}" 内存在重复规则`,
              });
            }
          }
        }
      }
    });

    return conflicts;
  }
}