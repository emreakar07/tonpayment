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
 * @param masterAddress Jetton master kontrat adresi
 * @param ownerAddress Kullanıcının TON cüzdan adresi
 * @returns Jetton cüzdan adresi
 */
export async function getJettonWalletAddress(masterAddress: string, ownerAddress: string): Promise<string> {
  try {
    console.log('Getting jetton wallet address for:', {
      masterAddress,
      ownerAddress
    });

    // Adresleri temizle ve doğrula
    const cleanMasterAddress = masterAddress.replace('0x', '');
    const cleanOwnerAddress = ownerAddress.replace('0x', '');

    // API endpoint'i
    const url = `https://tonapi.io/v2/blockchain/accounts/${cleanMasterAddress}/methods/get_wallet_address`;
    
    // Request body
    const body = {
      address: cleanOwnerAddress
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

    if (!data || !data.address) {
      console.error('Invalid API response:', data);
      throw new Error('Invalid API response: missing address');
    }

    // Adres formatını kontrol et
    const jettonWalletAddress = data.address;
    if (!jettonWalletAddress.startsWith('EQ') && !jettonWalletAddress.startsWith('UQ')) {
      console.error('Invalid jetton wallet address format:', jettonWalletAddress);
      throw new Error('Invalid jetton wallet address format');
    }

    console.log('Successfully retrieved jetton wallet address:', jettonWalletAddress);
    return jettonWalletAddress;
  } catch (error) {
    console.error('Error in getJettonWalletAddress:', error);
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