/**
 * Uygulama sabit değerlerini içeren dosya
 * GitHub örneğinden uyarlanmıştır:
 * https://github.com/siandreev/tonconnect-demo-dapp/blob/master/src/constants.ts
 */
import { Address } from '@ton/core';

// USDT Constants
export const USDT = {
  toString: () => 'EQBynBO23ywHy_CgarY9NK9FTz0zDsG82PtcbSTQgGoXwiuA',
  decimals: 6,
  symbol: 'USDT'
};

// Alternative USDT address for fallback
export const USDT_ALTERNATIVE = {
  toString: () => 'EQBynBO23ywHy_CgarY9NK9FTz0zDsG82PtcbSTQgGoXwiuA',
  decimals: 6,
  symbol: 'USDT'
};

// Gas constants for different operations
export const GAS_AMOUNTS = {
  JETTON_TRANSFER_WITH_COMMENT: '0.05', // Jetton transfer with comment
  FORWARD_TON_AMOUNT: '0.01', // Forward TON amount for notifications
  MIN_TON_FOR_STORAGE: '0.05', // Minimum TON for storage
  DEFAULT_GAS: '0.05' // Default gas amount
};

// Errors messages
export const ERROR_MESSAGES = {
  UNABLE_TO_VERIFY: 'Unable to verify transaction. Please try again or contact support.',
  INVALID_ADDRESS: 'Invalid TON address:',
  REJECTED: 'Transaction was rejected by the user.',
  TIMEOUT: 'Transaction timed out. Please try again.',
  ERROR_709: 'Insufficient funds for gas. Please ensure you have enough TON for gas fees.',
  JETTON_WALLET_NOT_FOUND: 'Unable to find your USDT wallet. Please make sure you have USDT tokens in your wallet.',
  API_ERROR: 'Error communicating with TON API. Please try again later.',
  TRANSACTION_FAILED: 'Transaction failed. Please check your balance and try again.',
  INVALID_AMOUNT: 'Invalid amount. Please enter a valid number.',
  WALLET_NOT_CONNECTED: 'Please connect your wallet first.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.'
};

// TON API URLs
export const API_URL = 'https://tonapi.io/v2';
export const API_TIMEOUT = 30000; // 30 seconds

// Transaction timeouts and retries
export const TRANSACTION_TIMEOUT = 60; // 60 seconds
export const TX_WAIT_RETRIES = 10;

// Default values
export const DEFAULT_QUERY_ID = 0;
export const DEFAULT_PAYMENT_ADDRESS = 'UQC-F0MOGA0zpzp-p6xfNDEYWotFD8_Pe5Dnj0Zgeik5239l';

// Transaction Status
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  ERROR: 'error'
}; 