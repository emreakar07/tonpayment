/**
 * TON API ile ilgili yardımcı fonksiyonlar
 * GitHub örneğinden uyarlanmıştır:
 * https://github.com/siandreev/tonconnect-demo-dapp/blob/master/src/tonapi.ts
 */

import { Address } from '@ton/core';
import { AssetsSDK } from '@ton-community/assets-sdk';
import { TonClient } from '@ton/ton';

// Public TON API endpoints
const API_URLS = {
  MAINNET: 'https://toncenter.com/api/v2',
  TESTNET: 'https://testnet.toncenter.com/api/v2'
};

// API endpoint'i seç (mainnet için)
const API_URL = API_URLS.MAINNET;

// TonClient instance oluştur
const client = new TonClient({
  endpoint: API_URL
});

// SDK instance oluştur
const sdk = AssetsSDK.create({ 
  api: client
});

/**
 * İşlem hash'i ile işlem bekleyip sonucu almak için fonksiyon
 * 
 * @param hash İşlem hash'i
 * @param limit Maksimum deneme sayısı
 * @returns İşlem bilgisi
 */
export async function waitForTx(hash: string, limit: number = 10): Promise<any> {
  let i = 0;
  
  while (i < limit) {
    try {
      console.log(`Attempt ${i + 1}/${limit} to get transaction:`, hash);
      
      // API endpoint'i
      const url = `${API_URL}/blockchain/transactions/${hash}`;
      console.log('Making API request to:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Transaction data:', data);

      if (!data || !data.transaction) {
        console.error('Invalid API response:', data);
        throw new Error('Invalid API response: missing transaction data');
      }

      // İşlem durumunu kontrol et
      const status = data.transaction.status;
      console.log('Transaction status:', status);

      if (status === 'completed') {
        console.log('Transaction completed successfully');
        return data;
      } else if (status === 'failed') {
        console.error('Transaction failed');
        throw new Error('Transaction failed');
      }
      
      // İşlem hala bekliyorsa, 2 saniye bekle ve tekrar dene
      console.log('Transaction still pending, waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      i++;
    } catch (error) {
      console.error(`Error in attempt ${i + 1}:`, error);
      if (i === limit - 1) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      i++;
    }
  }
  
  throw new Error('Transaction not found after maximum attempts');
}

/**
 * İşlem hash'i ile işlem bilgisi almak için fonksiyon
 * 
 * @param hash İşlem hash'i
 * @returns İşlem bilgisi veya null
 */
export async function getTx(hash: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/blockchain/transactions/${hash}`);
    if (response.status === 404) {
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (e) {
    console.error('Error getting transaction:', e);
    return null;
  }
}

/**
 * Kullanıcının Jetton cüzdan adresini almak için fonksiyon
 * @param masterAddress Jetton master contract adresi
 * @param userAddress Kullanıcının TON adresi
 * @returns Jetton cüzdan adresi
 */
export async function getJettonWalletAddress(masterAddress: string, userAddress: string): Promise<string> {
  try {
    console.log('Getting Jetton wallet address:', {
      masterAddress,
      userAddress
    });

    // Adresleri temizle
    const cleanMasterAddress = masterAddress.replace('0x', '');
    const cleanUserAddress = userAddress.replace('0x', '');

    // API endpoint'i
    const url = `${API_URL}/blockchain/accounts/${cleanMasterAddress}/methods/get_wallet_address`;
    
    // Request body
    const body = {
      args: [cleanUserAddress]
    };

    console.log('Making API request to:', url);
    console.log('Request body:', body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      });
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    if (!data || !data.decoded || !data.decoded.jetton_wallet_address) {
      console.error('Invalid API response format:', data);
      throw new Error('Invalid API response: missing jetton wallet address');
    }

    const jettonWalletAddress = data.decoded.jetton_wallet_address;
    console.log('Found Jetton wallet address:', jettonWalletAddress);
    return jettonWalletAddress;
  } catch (error) {
    console.error('Error getting Jetton wallet address:', error);
    throw error;
  }
}

/**
 * Jetton bilgilerini almak için fonksiyon
 * 
 * @param jettonMasterAddress Jetton master kontrat adresi
 * @returns Jetton bilgileri
 */
export async function getJettonInfo(jettonMasterAddress: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/jettons/${jettonMasterAddress}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (e) {
    console.error('Error getting jetton info:', e);
    throw e;
  }
}