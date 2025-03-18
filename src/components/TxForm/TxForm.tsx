import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, storeStateInit, toNano, Address, Cell } from "@ton/core";
import { 
  USDT_ADDRESS, 
  USDT_DECIMALS,
  createJettonTransferMessage, 
  createCommentPayload, 
  formatAmount
} from '../../utils/jetton-utils';

interface PaymentData {
  amount: string;
  address: string;
  payment_id: string;
  productName: string;
  token_type?: 'TON' | 'USDT'; // Add token type
}

// Adres doğrulama fonksiyonu - güçlendirilmiş
const isValidTonAddress = (address: string): boolean => {
  try {
    // Adresin uzunluğunu ve formatını kontrol et
    if (!address || address.length < 48) {
      console.error('Invalid address length');
      return false;
    }
    
    // TON adreslerinin standart formatı EQ veya UQ ile başlar
    if (!address.startsWith('EQ') && !address.startsWith('UQ')) {
      console.warn('Address does not start with EQ or UQ, but still attempting to parse');
    }
    
    // Address.parse fonksiyonu ile TON adresinin geçerliliğini kontrol et
    const parsedAddress = Address.parse(address);
    
    // Başarılı bir şekilde parse edildi mi?
    console.log('Address verified:', parsedAddress.toString());
    return true;
  } catch (error) {
    console.error('Address validation error:', error);
    return false;
  }
};

// Ödenecek adres olarak kullanılacak adres
const DEFAULT_PAYMENT_ADDRESS = 'UQAd8xtxtEo68nYoGjJHomatf35zPmo8pGxwmkj58U_vbIx8';

export function TxForm() {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState(DEFAULT_PAYMENT_ADDRESS); // Varsayılan adres ayarlandı
  const [paymentId, setPaymentId] = useState('');
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wallet = useTonWallet();
  const [tonConnectUi] = useTonConnectUI();
  const [comment, setComment] = useState('');
  const [tokenType, setTokenType] = useState<'TON' | 'USDT'>('TON');
  
  // Ödeme yöntemini seçmek için state
  const [paymentMethod, setPaymentMethod] = useState<'standard' | 'direct'>('standard');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentDataBase64 = urlParams.get('payment_data');

    if (paymentDataBase64) {
      try {
        const decodedData = atob(paymentDataBase64);
        const paymentData: PaymentData = JSON.parse(decodedData);
        
        // Set token type if provided, default to TON
        if (paymentData.token_type) {
          setTokenType(paymentData.token_type);
        }
        
        // Convert amount to nano units based on token type
        const decimals = paymentData.token_type === 'USDT' ? USDT_DECIMALS : 9;
        const amountInNano = (parseFloat(paymentData.amount) * Math.pow(10, decimals)).toString();
        
        setAmount(amountInNano);
        
        // URL'den gelen adresi kullan, eğer yoksa varsayılanı koru
        if (paymentData.address && paymentData.address.trim() !== '') {
          setAddress(paymentData.address);
        }
        
        setPaymentId(paymentData.payment_id);
        setComment(`Payment ID: ${paymentData.payment_id}`);
      } catch (error) {
        console.error('Error parsing payment data:', error);
        setErrorMessage('Error parsing payment data');
      }
    }
  }, []);

  // Transaction durumunu dinle
  useEffect(() => {
    const unsubscribe = tonConnectUi.onStatusChange((wallet) => {
      if (!wallet) return; // Cüzdan bağlı değil
      
      console.log('Wallet Info:', {
        address: wallet.account.address,
        network: wallet.account.chain,
        platform: wallet.device.platform,
        appName: wallet.device.appName,
      });
    });

    // Component unmount olduğunda listener'ı kaldır
    return () => unsubscribe();
  }, [tonConnectUi]);

  const handleSend = useCallback(async () => {
    try {
      setTxStatus('pending');
      setErrorMessage(null);
      
      // Adres doğrulama
      if (!isValidTonAddress(address)) {
        throw new Error('Invalid TON address');
      }
      
      // Tip dönüşümleri
      const destinationAddress = Address.parse(address);
      const amountInNano = BigInt(amount);
      
      if (tokenType === 'TON') {
        // Native TON transfer
        // Create payment data to include in the message
        const paymentData = {
          payment_id: paymentId,
          timestamp: Date.now(),
          type: 'payment'
        };

        // 1. Body olarak gönderme
        const bodyMessage = beginCell()
          .storeUint(0x18, 6)
          .storeAddress(destinationAddress)
          .storeCoins(amountInNano)
          .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
          .storeRef(
            beginCell()
              .storeUint(0, 32) // Yorum için prefix - düzeltildi
              .storeBuffer(Buffer.from(JSON.stringify(paymentData)))
              .endCell()
          )
          .endCell();

        // 2. Data olarak gönderme
        const dataMessage = beginCell()
          .storeUint(0x18, 6)
          .storeAddress(destinationAddress)
          .storeCoins(amountInNano)
          .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
          .storeRef(
            beginCell()
              .storeUint(0, 32) // 0x706c7374 yerine 0 kullanıldı (yorum prefix)
              .storeBuffer(Buffer.from(JSON.stringify({
                ...paymentData,
                timestamp: Date.now().toString()
              })))
              .endCell()
          )
          .endCell();

        const tx: SendTransactionRequest = {
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 dakikaya çıkarıldı
          messages: [
            {
              address: address,
              amount: amount,
              payload: bodyMessage.toBoc().toString('base64')
            },
            {
              address: address,
              amount: '0',  // İkinci mesaj için 0 TON gönder
              payload: dataMessage.toBoc().toString('base64')
            }
          ]
        };

        console.log('Sending TON transaction:', {
          address,
          amount,
          bodyPayload: bodyMessage.toBoc().toString('base64'),
          dataPayload: dataMessage.toBoc().toString('base64')
        });

        const result = await tonConnectUi.sendTransaction(tx);
        setTxStatus('success');
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.MainButton.setText('Payment Successful!');
          window.Telegram.WebApp.MainButton.show();
          window.Telegram.WebApp.sendData(JSON.stringify({
            status: 'success',
            token: 'TON',
            payment_id: paymentId,
            tx_hash: result.boc
          }));
        }
      } else if (tokenType === 'USDT') {
        // USDT Jetton transfer
        // Get the user's wallet address
        if (!wallet) {
          throw new Error('Wallet not connected');
        }
        
        const userAddress = wallet.account.address;
        
        console.log('Starting USDT transfer with parameters:', {
          from: userAddress,
          to: address,
          amount: amountInNano.toString(),
          tokenType: tokenType,
          usdt_address: USDT_ADDRESS,
          decimals: USDT_DECIMALS
        });

        // Standard method - using createJettonTransferMessage
        const parsedUserAddress = Address.parse(userAddress);
        const commentPayload = createCommentPayload(`Payment ID: ${paymentId}`);
        
        // Benzersiz bir query ID oluştur - tamamen rastgele
        const uniqueQueryId = Math.floor(Math.random() * 2**32); // 32 bit daha güvenli
        
        const jettonTransferMessage = createJettonTransferMessage({
          amount: amountInNano,
          toAddress: destinationAddress,
          responseAddress: parsedUserAddress,
          forwardAmount: toNano('0.000000001'), // 1 nanoton for notification
          forwardPayload: commentPayload,
          queryId: uniqueQueryId
        });
        
        const tx: SendTransactionRequest = {
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 dakikaya çıkarıldı
          messages: [
            {
              address: USDT_ADDRESS,
              amount: toNano('0.15').toString(), // 0.15 TON for fees - artırıldı
              payload: jettonTransferMessage.toBoc().toString('base64')
            }
          ]
        };
        
        console.log('Using standard method with payload:', jettonTransferMessage.toBoc().toString('base64'));

        console.log('Transaction sent, waiting for result...');
        const result = await tonConnectUi.sendTransaction(tx);
        console.log('Transaction result:', result);
        setTxStatus('success');
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.MainButton.setText('Payment Successful!');
          window.Telegram.WebApp.MainButton.show();
          window.Telegram.WebApp.sendData(JSON.stringify({
            status: 'success',
            token: 'USDT',
            payment_id: paymentId,
            tx_hash: result.boc
          }));
        }
      }

    } catch (error) {
      console.error('Transaction error:', error);
      
      // Hata detaylarını konsola yazdır
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Hata mesajını daha anlaşılır hale getir
        let errorMsg = error.message;
        
        if (errorMsg.includes('unable to verify transaction')) {
          errorMsg = 'Unable to verify transaction. Please check your wallet and try again. You might need to try the direct method.';
        } else if (errorMsg.includes('invalid address')) {
          errorMsg = 'Invalid TON address: ' + address;
        } else if (errorMsg.includes('rejected')) {
          errorMsg = 'Transaction rejected by wallet.';
        }
        
        setErrorMessage(errorMsg);
        setTxStatus('error');
      } else {
        console.error('Unknown error type:', typeof error);
        setErrorMessage('Unknown error occurred');
        setTxStatus('error');
      }
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.setText('Payment Failed!');
        window.Telegram.WebApp.MainButton.show();
      }
    }
  }, [address, amount, paymentId, comment, tonConnectUi, tokenType, wallet]);

  // GitHub repo örneğinden alınan direct transfer methodu
  const handleDirectTransfer = useCallback(async () => {
    try {
      setTxStatus('pending');
      setErrorMessage(null);
      
      if (!wallet) {
        throw new Error('Wallet not connected');
      }
      
      // Adres doğrulama
      if (!isValidTonAddress(address)) {
        throw new Error('Invalid TON address');
      }
      
      // USDT transferi için GitHub örneğindeki direct method
      if (tokenType === 'USDT') {
        const userAddress = wallet.account.address;
        const destinationAddress = Address.parse(address);
        const amountInNano = BigInt(amount);
        
        // GitHub reposundaki örnek transferi uygula
        /*
        transfer#0x0f8a7ea5
        query_id:uint64
        amount:VarUInteger 16
        destination:MsgAddress
        response_destination:MsgAddress
        custom_payload:Maybe ^Cell
        forward_ton_amount:VarUInteger 16
        forward_payload:Either Cell ^Cell = InternalMsgBody
        */
        const payload = beginCell()
          .storeUint(0x0f8a7ea5, 32) // op code for Jetton transfer
          .storeUint(0, 64) // query_id
          .storeCoins(amountInNano) // amount to transfer
          .storeAddress(destinationAddress) // destination address
          .storeAddress(Address.parse(userAddress)) // response address (your wallet)
          .storeMaybeRef() // custom_payload - null
          .storeCoins(toNano('0.05')) // forward_ton_amount - 0.05 TON 
          .storeBit(true) // forward_payload is a cell reference
          .storeRef(
            beginCell()
              .storeUint(0, 32) // comment prefix
              .storeBuffer(Buffer.from(`Payment ID: ${paymentId}`))
              .endCell()
          )
          .endCell().toBoc().toString('base64');
        
        // GitHub örneğinde olduğu gibi tx oluştur
        const tx: SendTransactionRequest = {
          validUntil: Math.round(Date.now() / 1000) + 60 * 5, // 5 minutes
          messages: [
            {
              address: USDT_ADDRESS, // Jetton master contract
              amount: toNano('0.2').toString(), // 0.3 TON for gas
              payload
            }
          ]
        };
        
        console.log('Direct USDT transfer with method from GitHub example:', {
          to: address,
          amount: amountInNano.toString(),
          payload
        });
        
        // Ek seçeneklerle sendTransaction (GitHub örneğinde olduğu gibi)
        const result = await tonConnectUi.sendTransaction(tx, {
          modals: 'all',
          notifications: ['error']
        });
        
        // Cevabı işle
        console.log('Transaction result:', result);
        
        // Transaction hash oluştur (GitHub örneğindeki gibi)
        try {
          const imMsgCell = Cell.fromBase64(result.boc);
          const inMsgHash = imMsgCell.hash().toString('hex');
          console.log('Transaction hash:', inMsgHash);
        } catch (e) {
          console.error('Error extracting transaction hash:', e);
        }
        
        setTxStatus('success');
        
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.MainButton.setText('Payment Successful!');
          window.Telegram.WebApp.MainButton.show();
          window.Telegram.WebApp.sendData(JSON.stringify({
            status: 'success',
            token: 'USDT',
            payment_id: paymentId,
            tx_hash: result.boc
          }));
        }
      } else {
        // TON transferleri için standard methodu kullan
        await handleSend();
      }
    } catch (error) {
      console.error('Direct transfer error:', error);
      
      if (error instanceof Error) {
        let errorMsg = error.message;
        
        if (errorMsg.includes('unable to verify transaction')) {
          errorMsg = 'Unable to verify direct transaction. Try increasing the fee amount.';
        } else if (errorMsg.includes('invalid address')) {
          errorMsg = 'Invalid address format: ' + address;
        }
        
        setErrorMessage(errorMsg);
        setTxStatus('error');
      } else {
        setErrorMessage('Unknown error occurred during direct transfer');
        setTxStatus('error');
      }
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.setText('Payment Failed!');
        window.Telegram.WebApp.MainButton.show();
      }
    }
  }, [address, amount, paymentId, tonConnectUi, tokenType, wallet, handleSend]);

  // Transaction durumuna göre UI göster
  const renderStatus = () => {
    switch(txStatus) {
      case 'pending':
        return <div className="tx-status pending">Transaction pending...</div>;
      case 'success':
        return <div className="tx-status success">Transaction successful!</div>;
      case 'error':
        return (
          <div className="tx-status error">
            Transaction failed. {errorMessage && <span>Error: {errorMessage}</span>}
          </div>
        );
      default:
        return null;
    }
  };

  // Format amount for display based on token type
  const getFormattedAmount = () => {
    if (!amount) return '0';
    
    // Token türüne göre decimals değerini doğru biçimde kullan
    const decimals = tokenType === 'USDT' ? USDT_DECIMALS : 9;
    const formattedAmount = formatAmount(amount, decimals);
    
    return tokenType === 'TON' 
      ? `${formattedAmount} TON` 
      : `${formattedAmount} USDT`;
  };

  return (
    <div className="send-tx-form">
      <div className="connect-button">
        <TonConnectButton />
      </div>
      
      <div className="form-content">
        <div className="input-group">
          <label>Address:</label>
          <input 
            type="text" 
            value={address || ''} 
            placeholder="No address available"
            readOnly
          />
        </div>
        
        <div className="input-group">
          <label>Token:</label>
          <select 
            value={tokenType} 
            onChange={(e) => setTokenType(e.target.value as 'TON' | 'USDT')}
            disabled={txStatus === 'pending'}
          >
            <option value="TON">TON</option>
            <option value="USDT">USDT</option>
          </select>
        </div>
        
        {/* GitHub örneğine göre eklenen ödeme yöntemi seçimi */}
        {tokenType === 'USDT' && (
          <div className="input-group">
            <label>Payment Method:</label>
            <select 
              value={paymentMethod} 
              onChange={(e) => setPaymentMethod(e.target.value as 'standard' | 'direct')}
              disabled={txStatus === 'pending'}
            >
              <option value="standard">Standard</option>
              <option value="direct">Direct (GitHub Example)</option>
            </select>
            <div className="helper-text">
              Direct method uses the GitHub example code for Jetton transfers.
            </div>
          </div>
        )}
        
        <div className="input-group">
          <label>Amount:</label>
          <input 
            type="text" 
            value={getFormattedAmount()}
            readOnly
          />
        </div>

        {renderStatus()}

        {wallet ? (
          <button 
            onClick={paymentMethod === 'direct' && tokenType === 'USDT' ? handleDirectTransfer : handleSend} 
            className="send-button"
            disabled={txStatus === 'pending' || !address || !amount}
          >
            {txStatus === 'pending' ? 'Sending...' : `Send ${tokenType}${paymentMethod === 'direct' && tokenType === 'USDT' ? ' (Direct)' : ''}`}
          </button>
        ) : (
          <div className="connect-message">
            Connect wallet to send transaction
          </div>
        )}
      </div>
    </div>
  );
}
