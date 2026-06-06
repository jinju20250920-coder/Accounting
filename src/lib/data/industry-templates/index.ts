import { commercialTemplate } from './commercial';
import { manufacturingTemplate } from './manufacturing';
import { serviceTemplate } from './service';
import { technologyTemplate } from './technology';
import { restaurantTemplate } from './restaurant';
import { constructionTemplate } from './construction';

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

const _templates: IndustryTemplate[] = [
  commercialTemplate,
  manufacturingTemplate,
  serviceTemplate,
  technologyTemplate,
  restaurantTemplate,
  constructionTemplate,
];

export const INDUSTRY_TEMPLATES = _templates;

export function getIndustryTemplate(id: string): IndustryTemplate | undefined {
  return INDUSTRY_TEMPLATES.find(t => t.id === id);
}
