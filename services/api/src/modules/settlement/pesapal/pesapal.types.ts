export type PesapalEnvironment = 'sandbox' | 'production';

export type PesapalNormalizedStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';

export interface PesapalAuthRequest {
  consumer_key: string;
  consumer_secret: string;
}

export interface PesapalAuthResponse {
  token?: string;
  expiryDate?: string;
  error?: {
    code?: string;
    message?: string;
  } | null;
  status?: string | number;
  message?: string;
}

export interface PesapalBillingAddress {
  email_address?: string;
  phone_number?: string;
  country_code?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  line_1?: string;
  line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  zip_code?: string;
}

export interface PesapalOrderRequestPayload {
  id: string;
  currency: string;
  amount: number;
  description: string;
  callback_url: string;
  notification_id: string;
  billing_address: PesapalBillingAddress;
  branch?: string;
}

export interface PesapalOrderResponse {
  order_tracking_id?: string;
  merchant_reference?: string;
  redirect_url?: string;
  error?: {
    code?: string;
    message?: string;
  } | null;
  status?: string | number;
  message?: string;
}

export interface PesapalTransactionStatusResponse {
  payment_method?: string;
  amount?: number;
  created_date?: string;
  confirmation_code?: string;
  order_tracking_id?: string;
  payment_status_description?: 'Completed' | 'Failed' | 'Pending' | 'Reversal' | string;
  description?: string;
  payment_account?: string;
  call_back_url?: string;
  payment_core_status?: string;
  status_code?: number; // 1 = COMPLETED, 2 = FAILED, 0 = PENDING, 3 = REVERSED
  merchant_reference?: string;
  currency?: string;
  error?: {
    code?: string;
    message?: string;
  } | null;
  status?: string | number;
  message?: string;
}

/**
 * Canonical Pesapal v3 Status Normalizer
 * SINGLE SOURCE OF TRUTH for interpreting raw Pesapal v3 transaction responses.
 *
 * Pesapal v3 GetTransactionStatus response fields:
 * - status_code: 1 (COMPLETED), 2 (FAILED), 0 (PENDING/INVALID), 3 (REVERSED)
 * - payment_status_description: 'Completed', 'Failed', 'Pending', 'Reversal', etc.
 */
export function normalizePesapalStatus(response: PesapalTransactionStatusResponse | null | undefined): PesapalNormalizedStatus {
  if (!response) return 'UNKNOWN';

  const code = response.status_code;
  const desc = (response.payment_status_description || '').trim().toLowerCase();

  // 1. Success check: numeric 1 or textual 'completed'
  if (code === 1 || desc === 'completed') {
    return 'COMPLETED';
  }

  // 2. Failure check: numeric 2 or textual 'failed' or 'reversal'/'reversed'
  if (code === 2 || code === 3 || desc === 'failed' || desc === 'reversal' || desc === 'reversed') {
    return 'FAILED';
  }

  // 3. Pending check: numeric 0 or textual 'pending' / 'invalid' (pesapal returns 0/invalid before payment)
  if (code === 0 || desc === 'pending' || desc === 'invalid') {
    return 'PENDING';
  }

  // 4. Anything else is an UNKNOWN state (requires verification/reconciliation, never auto-settled)
  return 'UNKNOWN';
}

export function isProviderSuccess(response: PesapalTransactionStatusResponse | null | undefined): boolean {
  return normalizePesapalStatus(response) === 'COMPLETED';
}

export function isProviderPending(response: PesapalTransactionStatusResponse | null | undefined): boolean {
  return normalizePesapalStatus(response) === 'PENDING';
}

export function isProviderFailure(response: PesapalTransactionStatusResponse | null | undefined): boolean {
  return normalizePesapalStatus(response) === 'FAILED';
}

export function isProviderUnknown(response: PesapalTransactionStatusResponse | null | undefined): boolean {
  return normalizePesapalStatus(response) === 'UNKNOWN';
}


export interface PesapalIpnRegisterPayload {
  url: string;
  ipn_notification_type: 'GET' | 'POST';
}

export interface PesapalIpnRegisterResponse {
  ipn_id?: string;
  url?: string;
  created_date?: string;
  status?: string | number;
  error?: {
    code?: string;
    message?: string;
  } | null;
}

export interface PesapalIpnNotificationPayload {
  OrderTrackingId: string;
  OrderNotificationType: string;
  OrderMerchantReference: string;
}
