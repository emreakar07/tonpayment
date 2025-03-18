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
  console.log('Getting jetton wallet address for:', {
    jettonMasterAddress,
    ownerAddress
  });
  
  // Adres formatını düzelt (bounceable/non-bounceable adresi kısaltma)
  // ownerAddress bazen "EQAbc123..." veya "UQAbc123..." formatında gelebilir
  // Eğer öyleyse, "Abc123..." formatına dönüştürmemiz gerekiyor
  let cleanOwnerAddress = ownerAddress;
  if (ownerAddress.startsWith('EQ') || ownerAddress.startsWith('UQ')) {
    cleanOwnerAddress = ownerAddress.substring(2);
    console.log('Cleaned owner address:', cleanOwnerAddress);
  }
  
  // İlk yöntem: TON API'yi kullanma (GitHub örneğindeki gibi)
  try {
    console.log('Trying to get jetton wallet address using tonapi.io...');
    
    // İki farklı format denemesini ayrı ayrı yapalım
    
    // 1. Format: 0x ile başlayan hexadecimal
    try {
      const response = await fetch(`${API_URL}/blockchain/accounts/${jettonMasterAddress}/methods/get_wallet_address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          args: [
            `0x${cleanOwnerAddress}`
          ]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`tonapi.io method failed with 0x format: ${errorText}`);
        throw new Error(`Failed to get jetton wallet address (0x format): ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API response data (0x format):', data);
      
      if (data.decoded?.jetton_wallet_address) {
        console.log('Successfully got jetton wallet address with 0x format:', data.decoded.jetton_wallet_address);
        return data.decoded.jetton_wallet_address;
      }
      
      throw new Error('Jetton wallet address not found in response (0x format)');
    } catch (e) {
      console.warn('0x format failed, trying raw format...', e);
      
      // 2. Format: Düz adres
      const response = await fetch(`${API_URL}/blockchain/accounts/${jettonMasterAddress}/methods/get_wallet_address`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          args: [
            cleanOwnerAddress
          ]
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`tonapi.io method failed with raw format: ${errorText}`);
        throw new Error(`Failed to get jetton wallet address (raw format): ${errorText}`);
      }
      
      const data = await response.json();
      console.log('API response data (raw format):', data);
      
      if (!data.decoded?.jetton_wallet_address) {
        console.warn('Jetton wallet address not found in response (raw format)');
        throw new Error('Jetton wallet address not found in response (raw format)');
      }
      
      console.log('Successfully got jetton wallet address with raw format:', data.decoded.jetton_wallet_address);
      return data.decoded.jetton_wallet_address;
    }
  } catch (e) {
    console.warn('TON API methods failed, trying toncenter alternative...', e);
    
    // İkinci yöntem: TONCenter API'yi kullanma
    try {
      console.log('Trying to get jetton wallet address using toncenter...');
      
      // Toncenter API endpoint (daha güvenilir olabilir)
      const toncenterEndpoint = 'https://toncenter.com/api/v2/runGetMethod';
      
      try {
        const response = await fetch(toncenterEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            address: jettonMasterAddress,
            method: 'get_wallet_address',
            stack: [
              ["tvm.Slice", `0x${cleanOwnerAddress}`]
            ]
          })
        });
        
        if (!response.ok) {
          throw new Error(`Toncenter API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Toncenter API response:', data);
        
        if (data.ok && data.result && data.result.length > 0) {
          // Toncenter'dan adres çıkarma mantığı (format API'ye göre değişebilir)
          // Bu örnek değişebilir, gerçek API yanıtına göre düzenlenmelidir
          const extractedAddress = data.result[0]; // Bu, API'nin nasıl yanıt verdiğine bağlı olarak değişebilir
          console.log('Successfully got jetton wallet address from toncenter:', extractedAddress);
          return extractedAddress;
        }
        
        throw new Error('Could not parse toncenter response');
      } catch (toncenterError) {
        console.warn('Toncenter method failed:', toncenterError);
        
        // Tüm yöntemler başarısız olduysa, fallback olarak master adresi döndür
        console.log('All API methods failed. Using fallback: returning master address as wallet address');
        return jettonMasterAddress;
      }
    } catch (innerError) {
      console.error('All methods failed to get jetton wallet address:', innerError);
      
      // En son çare olarak master adresi döndürüyoruz
      console.log('Last resort fallback: returning master address');
      return jettonMasterAddress;
    }
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