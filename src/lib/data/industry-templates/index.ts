import { commercialTemplate } from './commercial';
import { manufacturingTemplate } from './manufacturing';
import { serviceTemplate } from './service';
import { technologyTemplate } from './technology';
import { restaurantTemplate } from './restaurant';
import { constructionTemplate } from './construction';
import sharedSubjectsData from '../subjects.json';

export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  subjects: Array<{
    code: string;
    name: string;
    parentId: string | null;
    level: number;
    direction: string;
    enableDept: boolean;
    enableProject: boolean;
    disabled: boolean;
    isCustomer: boolean;
    isSupplier: boolean;
    isEmployee: boolean;
    enableCashFlow: boolean;
  }>;
  businessGroups: Array<{
    name: string;
    partnerType: string;
    debitSubject: string;
    debitSubjectName: string;
    taxSubject: string;
    taxSubjectName: string;
    creditSubject: string;
    creditSubjectName: string;
    keywords: string[];
    priority: number;
  }>;
  commonSummaries: string[];
  bankKeywords: Array<{ keyword: string; subject: string; subjectName: string }>;
}

/**
 * 所有行业模板统一使用的科目表（55 项）。子科目名称含父级描述，
 * 如「财务费用-手续费」「应交税费-应交增值税-销项税额」。
 * 数据源与 useSubjectStore 的默认科目 (subjects.json) 一致，保证新账套无论选哪个
 * 行业模板，科目都统一。各模板自带的内联 subjects/businessGroups 在此处被覆盖。
 */
const SHARED_SUBJECTS = sharedSubjectsData as unknown as IndustryTemplate['subjects'];

/**
 * 所有行业模板统一使用的发票业务组，仅引用 SHARED_SUBJECTS 中的科目，
 * 避免 businessGroups 悬空（不再引用原材料 1403 等统一表里没有的科目）。
 */
const SHARED_BUSINESS_GROUPS: IndustryTemplate['businessGroups'] = [
  { name: '采购进货', partnerType: 'supplier', debitSubject: '1401', debitSubjectName: '材料采购', taxSubject: '22210101', taxSubjectName: '应交税费-应交增值税-进项税额', creditSubject: '2202', creditSubjectName: '应付账款', keywords: ['采购', '进货', '材料'], priority: 8 },
  { name: '销售出货', partnerType: 'customer', debitSubject: '1122', debitSubjectName: '应收账款', taxSubject: '22210102', taxSubjectName: '应交税费-应交增值税-销项税额', creditSubject: '6001', creditSubjectName: '主营业务收入', keywords: ['销售', '出货'], priority: 8 },
  { name: '费用报销', partnerType: 'employee', debitSubject: '6602', debitSubjectName: '管理费用', taxSubject: '', taxSubjectName: '', creditSubject: '1002', creditSubjectName: '银行存款', keywords: ['报销', '费用'], priority: 7 },
  { name: '采购付款', partnerType: 'supplier', debitSubject: '2202', debitSubjectName: '应付账款', taxSubject: '', taxSubjectName: '', creditSubject: '1002', creditSubjectName: '银行存款', keywords: ['付款', '货款'], priority: 7 },
  { name: '销售收款', partnerType: 'customer', debitSubject: '1002', debitSubjectName: '银行存款', taxSubject: '', taxSubjectName: '', creditSubject: '1122', creditSubjectName: '应收账款', keywords: ['收款', '货款'], priority: 7 },
];

const _templates: IndustryTemplate[] = [
  commercialTemplate,
  manufacturingTemplate,
  serviceTemplate,
  technologyTemplate,
  restaurantTemplate,
  constructionTemplate,
].map(t => ({ ...t, subjects: SHARED_SUBJECTS, businessGroups: SHARED_BUSINESS_GROUPS }));

export const INDUSTRY_TEMPLATES = _templates;

export function getIndustryTemplate(id: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find(t => t.id === id);
}
