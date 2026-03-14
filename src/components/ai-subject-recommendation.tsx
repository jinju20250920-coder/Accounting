'use client';

import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Lightbulb, TrendingUp, Zap, AlertCircle, CheckCircle, X,
  Brain, Target, Clock, BarChart3
} from 'lucide-react';
import { useUserPreferenceStore } from '@/stores';
import { getSubjects } from '@/lib/accounting';

interface SubjectRecommendation {
  subject: string;
  subjectName: string;
  confidence: number;
  source: 'user-preference' | 'rule' | 'manual';
  reasons: string[];
}

interface AISubjectRecommendationProps {
  summary: string;
  amount?: number;
  currentSubject?: string;
  onSelect: (subject: string, subjectName: string) => void;
  disabled?: boolean;
}

export function AISubjectRecommendation({
  summary,
  amount,
  currentSubject,
  onSelect,
  disabled = false
}: AISubjectRecommendationProps) {
  const { getSmartMatch, getStatistics } = useUserPreferenceStore();
  const [recommendations, setRecommendations] = useState<SubjectRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [aiInsights, setAiInsights] = useState<string[]>([]);

  // 获取推荐
  useEffect(() => {
    if (!summary.trim() || disabled) return;

    const getRecommendations = async () => {
      setIsLoading(true);

      try {
        // 获取智能匹配结果
        const match = getSmartMatch(summary);
        const stats = getStatistics();

        const newRecommendations: SubjectRecommendation[] = [];

        if (match) {
          // AI 推荐优先级最高
          newRecommendations.push({
            subject: match.subject,
            subjectName: match.subjectName || getSubjectName(match.subject),
            confidence: match.confidence || 0.8,
            source: match.source,
            reasons: [`AI ${match.source === 'user-preference' ? '学习' : '规则'}推荐`]
          });

          // 如果当前选择与推荐不同，显示分析
          if (currentSubject && currentSubject !== match.subject) {
            setAiInsights([
              `您的选择：${getSubjectName(currentSubject)}`,
              `AI推荐：${match.subjectName}`,
              confidenceToText(match.confidence)
            ]);
          }
        }

        // 添加相关科目建议（基于金额、摘要分析）
        const relatedSubjects = getRelatedSubjects(summary, amount);
        relatedSubjects.forEach(subject => {
          if (!newRecommendations.find(r => r.subject === subject.code)) {
            newRecommendations.push({
              subject: subject.code,
              subjectName: subject.name,
              confidence: 0.5,
              source: 'rule',
              reasons: ['相关科目建议']
            });
          }
        });

        setRecommendations(newRecommendations.slice(0, 3)); // 最多显示3个
      } catch (error) {
        console.error('Failed to get recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    getRecommendations();
  }, [summary, amount, currentSubject, disabled, getSmartMatch, getStatistics]);

  // 将置信度转换为文本描述
  const confidenceToText = (confidence: number): string => {
    if (confidence >= 0.9) return '高度匹配';
    if (confidence >= 0.7) return '良好匹配';
    if (confidence >= 0.5) return '可能匹配';
    return '建议参考';
  };

  // 获取科目名称
  const getSubjectName = (code: string): string => {
    const subject = getSubjects().find(s => s.code === code);
    return subject?.name || code;
  };

  // 获取相关科目
  const getRelatedSubjects = (summary: string, amount?: number) => {
    const allSubjects = getSubjects();

    // 简单的关键词匹配逻辑
    const keywords = summary.toLowerCase();
    const related = allSubjects.filter(subject => {
      // 检查摘要是否包含科目名称关键词
      const subjectName = subject.name.toLowerCase();
      const subjectCode = subject.code.toLowerCase();

      // 如果金额较大，优先考虑资产/负债类科目
      if (amount && amount > 10000) {
        if (subjectCode.startsWith('1') || subjectCode.startsWith('2')) {
          return true;
        }
      }

      // 摘要与科目名称匹配
      if (keywords.includes(subjectName.split(' ')[0]) ||
          subjectName.includes(keywords)) {
        return true;
      }

      return false;
    });

    return related.slice(0, 2); // 最多返回2个相关科目
  };

  const handleAcceptRecommendation = (rec: SubjectRecommendation) => {
    onSelect(rec.subject, rec.subjectName);
    setShowDetails(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getSourceBadgeVariant = (source: string) => {
    switch (source) {
      case 'user-preference':
        return 'default';
      case 'rule':
        return 'secondary';
      case 'ai-learning':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'user-preference':
        return <TrendingUp className="h-3 w-3" />;
      case 'rule':
        return <Target className="h-3 w-3" />;
      case 'ai-learning':
        return <Brain className="h-3 w-3" />;
      default:
        return <Zap className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-3">
      {/* AI 推荐标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className={`h-4 w-4 ${recommendations.length > 0 ? 'text-yellow-500' : 'text-gray-300'}`} />
          <span className="text-sm font-medium">AI 智能推荐</span>
          {recommendations.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {recommendations.length} 个推荐
            </Badge>
          )}
        </div>

        {recommendations.length > 0 && (
          <Dialog open={showDetails} onOpenChange={setShowDetails}>
            <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>
              查看详情
              </Button>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI 推荐详情
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">{rec.subject} - {rec.subjectName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={getSourceBadgeVariant(rec.source)} className="text-xs">
                            {getSourceIcon(rec.source)}
                            <span className="ml-1">{rec.source === 'user-preference' ? '用户偏好' : rec.source === 'rule' ? '规则匹配' : '智能计算'}</span>
                          </Badge>
                          <span className={`text-xs font-medium ${getConfidenceColor(rec.confidence)}`}>
                            置信度: {Math.round(rec.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRecommendation(rec)}
                      >
                        使用
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      推荐原因: {rec.reasons.join('、')}
                    </div>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* 推荐列表 */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="animate-spin">
            <div className="h-4 w-4 border-2 border-gray-300 border-t-primary rounded-full"></div>
          </div>
          AI 思考中...
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-2">
          {recommendations.map((rec, index) => (
            <Card
              key={index}
              className="p-3 cursor-pointer hover:bg-gray-50 transition-colors border-2 border-transparent hover:border-yellow-200"
              onClick={() => handleAcceptRecommendation(rec)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{rec.subject}</span>
                    <span className="text-sm text-muted-foreground">- {rec.subjectName}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getSourceBadgeVariant(rec.source)} className="text-xs">
                      {getSourceIcon(rec.source)}
                      <span className="ml-1">{rec.source === 'user-preference' ? '已学习' : rec.source === 'rule' ? '规则' : 'AI'}</span>
                    </Badge>
                    <span className={`text-xs ${getConfidenceColor(rec.confidence)}`}>
                      {Math.round(rec.confidence * 100)}% 匹配
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {currentSubject === rec.subject ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Zap className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">暂无推荐</p>
          <p className="text-xs mt-1">输入摘要后，AI 将智能推荐科目</p>
        </div>
      )}

      {/* AI 分析洞察 */}
      {aiInsights.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                {aiInsights.map((insight, index) => (
                  <p key={index} className="text-sm text-blue-800">
                    {insight}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI 学习提示 */}
      {summary && recommendations.length === 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <BarChart3 className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-amber-800">
                  <strong>提示：</strong>AI 还没有学习过这个类型的业务。
                  <br />
                  <span className="text-xs">使用次数越多，推荐越准确</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}