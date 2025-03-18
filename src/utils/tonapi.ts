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
 * GitHub örneğindeki gibi, jetton cüzdan adresini almak için fonksiyon
 * GitHub ton-connect-demo-dapp/src/tonapi.ts dosyasına benzer şekilde
 * implementasyon yapılmıştır
 * 
 * @param jettonMasterAddress Jetton master kontrat adresi
 * @param ownerAddress Kullanıcının TON cüzdan adresi
 * @returns Jetton cüzdan adresi
 */
export async function getJettonWalletAddress(jettonMasterAddress: string, ownerAddress: string): Promise<string> {
  try {
    // GitHub örneğindeki gibi execute_get_method kullanarak jetton wallet adresini al
    const response = await fetch(`${API_URL}/blockchain/accounts/${jettonMasterAddress}/methods/get_wallet_address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        args: [
          `0x${ownerAddress}`
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get jetton wallet address: ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.decoded?.jetton_wallet_address) {
      throw new Error('Jetton wallet address not found in response');
    }
    
    return data.decoded.jetton_wallet_address;
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