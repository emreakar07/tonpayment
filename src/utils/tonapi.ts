/**
 * TON API ile ilgili yardımcı fonksiyonlar
 * GitHub örneğinden uyarlanmıştır:
 * https://github.com/siandreev/tonconnect-demo-dapp/blob/master/src/tonapi.ts
 */

const API_URL = 'https://tonapi.io/v2';

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
    const tx = await getTx(hash);
    if (tx) {
      return tx;
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye bekle
    i++;
  }
  
  throw new Error('Transaction not found');
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
 * Jetton cüzdan adresini almak için fonksiyon
 * 
 * @param jettonMasterAddress Jetton master kontrat adresi
 * @param ownerAddress Kullanıcının TON cüzdan adresi
 * @returns Jetton cüzdan adresi
 */
export async function getJettonWalletAddress(jettonMasterAddress: string, ownerAddress: string): Promise<string> {
  try {
    const response = await fetch(`${API_URL}/accounts/${ownerAddress}/jettons/${jettonMasterAddress}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Eğer API jetton cüzdan adresi dönmezse, hatayı yönetme
    if (!data.wallet?.address) {
      throw new Error('Jetton wallet address not found');
    }
    
    return data.wallet.address;
  } catch (e) {
    console.error('Error getting jetton wallet address:', e);
    throw e;
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