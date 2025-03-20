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
  JETTON_TRANSFER: '0.05',       // Basit Jetton transferi için minimum gas
  JETTON_TRANSFER_WITH_COMMENT: '1.0',  // Yorumlu Jetton transferi için önerilen gas
  FORWARD_TON_AMOUNT: '0.5'      // Jetton transferinde forward_ton_amount için önerilen değer
};

// Errors messages
export const ERROR_MESSAGES = {
  UNABLE_TO_VERIFY: 'İşlem doğrulanamadı. Lütfen şunları kontrol edin:\n1. Cüzdanınızda yeterli TON bakiyesi var mı?\n2. Cüzdan uygulamanızda işlemi onayladınız mı?\n3. İnternet bağlantınız stabil mi?',
  INVALID_ADDRESS: 'Geçersiz TON adresi formatı:',
  REJECTED: 'İşlem cüzdan tarafından reddedildi.',
  TIMEOUT: 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.',
  ERROR_709: 'Hata 709: İşlem için gas ücreti yetersiz. Lütfen gas ücretini artırın.',
  JETTON_WALLET_NOT_FOUND: 'USDT cüzdan adresi bulunamadı. Lütfen cüzdanınızda USDT token\'ları olduğundan emin olun.',
  UNKNOWN: 'Transfer sırasında bilinmeyen bir hata oluştu'
};

// TON API URLs
export const API_URL = 'https://tonapi.io/v2';

// Transaction timeouts and retries
export const TRANSACTION_TIMEOUT = 300; // 5 dakika (saniye cinsinden)
export const TX_WAIT_RETRIES = 10;

// Default values
export const DEFAULT_QUERY_ID = 0;
export const DEFAULT_PAYMENT_ADDRESS = 'UQAd8xtxtEo68nYoGjJHomatf35zPmo8pGxwmkj58U_vbIx8'; 