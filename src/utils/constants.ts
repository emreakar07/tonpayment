/**
 * Uygulama sabit değerlerini içeren dosya
 * GitHub örneğinden uyarlanmıştır:
 * https://github.com/siandreev/tonconnect-demo-dapp/blob/master/src/constants.ts
 */
import { Address } from '@ton/core';

// USDT adresleri
export const USDT = 'EQBynBO23ywHy_CgarY1fT-ou1Ez9vQ-FyS2VFoU_T-8g1nt'; // USDT mainnet
export const USDT_ALTERNATIVE = 'EQBynBO23ywHy_CgarY1fT-ou1Ez9vQ-FyS2VFoU_T-8g1nt'; // Alternatif USDT adresi

// Gas miktarları
export const GAS_AMOUNTS = {
  JETTON_TRANSFER_WITH_COMMENT: '0.05', // Jetton transfer için gas
  FORWARD_TON_AMOUNT: '0.01', // Forward TON miktarı
  DEFAULT_GAS: '0.05' // Varsayılan gas miktarı
};

// Hata mesajları
export const ERROR_MESSAGES = {
  UNABLE_TO_VERIFY: 'Unable to verify transaction',
  INVALID_ADDRESS: 'Invalid address',
  REJECTED: 'Transaction rejected',
  TIMEOUT: 'Transaction timeout',
  ERROR_709: 'Error code 709',
  JETTON_WALLET_NOT_FOUND: 'USDT wallet not found',
  TRANSACTION_FAILED: 'Transaction failed',
  API_ERROR: 'API error occurred'
};

// Varsayılan değerler
export const DEFAULT_QUERY_ID = 0;
export const DEFAULT_PAYMENT_ADDRESS = 'EQBynBO23ywHy_CgarY1fT-ou1Ez9vQ-FyS2VFoU_T-8g1nt';
export const TRANSACTION_TIMEOUT = 360; // 6 dakika

// USDT decimals
export const USDT_DECIMALS = 6;

// TON API URLs
export const API_URL = 'https://tonapi.io/v2';
export const API_TIMEOUT = 30000; // 30 seconds

// Transaction timeouts and retries
export const TX_WAIT_RETRIES = 10;

// Transaction Status
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  ERROR: 'error'
}; 