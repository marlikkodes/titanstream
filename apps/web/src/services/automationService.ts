import { api } from './api';

export interface RuleCondition {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'GREATER_THAN' | 'LESS_THAN' | 'CONTAINS';
  value: any;
}

export interface AutomationRuleRecord {
  id: string;
  name: string;
  description: string;
  eventPattern: string;
  conditions: RuleCondition[];
  actions: string[];
  isEnabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationEvaluationLog {
  id: string;
  ruleId: string;
  ruleName: string;
  eventPattern: string;
  inputPayload: any;
  conditionsMet: boolean;
  executedActions: string[];
  evaluatedAt: string;
}

export const DEFAULT_AUTOMATION_RULES: AutomationRuleRecord[] = [
  {
    id: 'rule_1',
    name: 'High Value Deposit Verification',
    description: 'Flags payment orders >= $500 for enhanced ledger review',
    eventPattern: 'PaymentOrderCreated',
    conditions: [{ field: 'amount', operator: 'GREATER_THAN', value: 500 }],
    actions: ['EMIT_NOTIFICATION', 'FLAG_RISK_REVIEW'],
    isEnabled: true,
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rule_2',
    name: 'Rapid Withdrawal Velocity Alert',
    description: 'Alerts treasury when withdrawal count exceeds threshold',
    eventPattern: 'WithdrawalRequested',
    conditions: [{ field: 'velocity', operator: 'GREATER_THAN', value: 3 }],
    actions: ['NOTIFY_TREASURY_OPERATOR'],
    isEnabled: true,
    priority: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const automationService = {
  async getRules(): Promise<AutomationRuleRecord[]> {
    try {
      const res = await api.get('/admin/automation/rules');
      const raw = res?.data?.data ?? res?.data;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.items)) return raw.items;
      return DEFAULT_AUTOMATION_RULES;
    } catch {
      return DEFAULT_AUTOMATION_RULES;
    }
  },

  async createRule(dto: Partial<AutomationRuleRecord>): Promise<AutomationRuleRecord> {
    const res = await api.post('/admin/automation/rules', dto);
    return res?.data?.data ?? res?.data;
  },

  async updateRule(id: string, dto: Partial<AutomationRuleRecord>): Promise<AutomationRuleRecord> {
    const res = await api.put(`/admin/automation/rules/${id}`, dto);
    return res?.data?.data ?? res?.data;
  },

  async toggleRule(id: string): Promise<AutomationRuleRecord> {
    const res = await api.post(`/admin/automation/rules/${id}/toggle`);
    return res?.data?.data ?? res?.data;
  },

  async getEvaluations(): Promise<AutomationEvaluationLog[]> {
    try {
      const res = await api.get('/admin/automation/evaluations');
      const raw = res?.data?.data ?? res?.data;
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.items)) return raw.items;
      return [];
    } catch {
      return [];
    }
  },

  async evaluateDryRun(eventPattern: string, payload: any): Promise<AutomationEvaluationLog[]> {
    try {
      const res = await api.post('/admin/automation/evaluate', { eventPattern, payload });
      const raw = res?.data?.data ?? res?.data;
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  },
};
