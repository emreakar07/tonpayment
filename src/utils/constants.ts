/**
 * Uygulama sabit değerlerini içeren dosya
 * GitHub örneğinden uyarlanmıştır:
 * https://github.com/siandreev/tonconnect-demo-dapp/blob/master/src/constants.ts
 */
import { Address } from '@ton/core';

// USDT Jetton constants
// Telegram Wallet'ta kullanılan resmi TON USDT adresi 
// GitHub örneğinde kullanılan adres: EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA
// Bizim mevcut adresimiz: EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs 
export const USDT = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');
export const USDT_DECIMALS = 6;

// Alternative USDT address from GitHub example (in case our address doesn't work)
export const USDT_ALTERNATIVE = Address.parse('EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA');

// Gas constants for different operations
export const GAS_AMOUNTS = {
  TON_TRANSFER: '0.01',          // Basit TON transferi için gas
  JETTON_TRANSFER: '0.05',       // Jetton transferi için minimum gas
  JETTON_TRANSFER_WITH_COMMENT: '0.6',  // Yorumlu Jetton transferi için önerilen gas (artırıldı)
  FORWARD_TON_AMOUNT: '0.2',     // Jetton transferinde forward_ton_amount için önerilen değer (artırıldı)
  JETTON_TRANSFER_FALLBACK: '0.8' // Jetton transferi başarısız olduğunda kullanılacak gas (artırıldı)
};

// Errors messages
export const ERROR_MESSAGES = {
  UNABLE_TO_VERIFY: 'Unable to verify transaction. Lütfen cüzdan uygulamanızda işlemi onaylayın ve daha fazla TON bakiyesi olduğundan emin olun.',
  INVALID_ADDRESS: 'Invalid TON address format:',
  REJECTED: 'Transaction rejected by wallet.',
  TIMEOUT: 'Transaction timed out. Please try again.',
  ERROR_709: 'Error 709: Gas fees for transaction not sufficient. Try increasing the fee.',
  JETTON_WALLET_NOT_FOUND: 'USDT cüzdan adresi bulunamadı. Bu, USDT token\'larına sahip olmadığınız anlamına gelebilir. Direkt transfer yöntemi deneniyor.',
  UNKNOWN: 'Unknown error occurred during transfer'
};

// TON API URLs
export const API_URL = 'https://tonapi.io/v2';

// Transaction timeouts and retries
export const TRANSACTION_TIMEOUT = 300; // 5 dakika (saniye cinsinden)
export const TX_WAIT_RETRIES = 10;

// Default values
export const DEFAULT_QUERY_ID = 0;
export const DEFAULT_PAYMENT_ADDRESS = 'UQAd8xtxtEo68nYoGjJHomatf35zPmo8pGxwmkj58U_vbIx8'; 