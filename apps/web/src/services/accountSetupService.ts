import { api } from './api';

export type TransactionMethod = 'MOBILE_MONEY' | 'CRYPTO';

export interface AccountSetupState {
  firstName: string | null;
  lastName: string | null;
  withdrawalPhoneNumber: string | null;
  preferredTransactionMethod: TransactionMethod | null;
  completed: boolean;
}

export interface UpdateAccountSetupPayload {
  firstName: string;
  lastName: string;
  preferredTransactionMethod: TransactionMethod;
  withdrawalPhoneNumber?: string;
}

export async function getAccountSetup(): Promise<AccountSetupState> {
  const { data } = await api.get<AccountSetupState>('/users/me/account-setup');
  return data;
}

export async function updateAccountSetup(payload: UpdateAccountSetupPayload): Promise<AccountSetupState> {
  const { data } = await api.patch<AccountSetupState>('/users/me/account-setup', payload);
  return data;
}

const ERROR_COPY: Record<string, string> = {
  INVALID_FIRST_NAME: 'Please enter a valid first name (letters only, up to 60 characters).',
  INVALID_LAST_NAME: 'Please enter a valid last name (letters only, up to 60 characters).',
  INVALID_TRANSACTION_METHOD: 'Please choose how you want to transact: Mobile Money or Crypto.',
  INVALID_WITHDRAWAL_NUMBER:
    'Please enter a valid mobile-money withdrawal number (digits, optional leading +, 8–15 characters).',
};

export function getAccountSetupErrorMessage(err: unknown): string {
  const code =
    (err as any)?.response?.data?.message ??
    (err as any)?.message ??
    '';
  const key = Array.isArray(code) ? code[0] : String(code);
  if (ERROR_COPY[key]) return ERROR_COPY[key];
  const status = (err as any)?.response?.status;
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.';
  if (!status) return 'Network unavailable. Please check your connection and try again.';
  return 'Could not save your account details. Please try again.';
}
