import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, storeStateInit, toNano, Address, Cell } from "@ton/core";
import { 
  USDT_ADDRESS, 
  USDT_DECIMALS,
  createCommentPayload, 
  formatAmount
} from '../../utils/jetton-utils';
import { getJettonWalletAddress, waitForTx } from '../../utils/tonapi';
import {
  GAS_AMOUNTS,
  ERROR_MESSAGES,
  DEFAULT_QUERY_ID,
  DEFAULT_PAYMENT_ADDRESS,
  TRANSACTION_TIMEOUT,
  USDT,
  USDT_ALTERNATIVE
} from '../../utils/constants';

interface PaymentData {
  amount: string;
  address: string;
  payment_id: string;
  productName: string;
  token_type?: 'TON' | 'USDT'; // Add token type
}

// TonConnect UI'nin sendTransaction için beklediği seçenekler
type ActionModalType = 'before' | 'success' | 'error';
type ActionNotificationType = 'before' | 'success' | 'error';
interface ActionConfiguration {
  modals?: 'all' | ActionModalType[];
  notifications?: 'all' | ActionNotificationType[];
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

  // GitHub repo örneğinden alınan transfer methodu
  const handleTransfer = useCallback(async () => {
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
      
      const userAddress = wallet.account.address;
      const destinationAddress = Address.parse(address);
      const amountInNano = BigInt(amount);
      
      if (tokenType === 'USDT') {
        // GitHub örneğindeki gibi, kullanıcının USDT jetton cüzdan adresini alıyoruz
        console.log('Getting user jetton wallet address for:', userAddress);
        
        // Önce bizim adresimizi deneyelim, eğer hata alırsak GitHub örneğindeki adresi kullanalım
        let jettonMasterAddress = USDT.toString();
        let jettonWalletAddress;
        
        try {
          jettonWalletAddress = await getJettonWalletAddress(jettonMasterAddress, userAddress);
          console.log('Found jetton wallet address using our USDT address:', jettonWalletAddress);
        } catch (e) {
          console.warn('Error getting jetton wallet address with our USDT address, trying alternative:', e);
          // Alternatif USDT adresini deneyelim (GitHub örneğindeki)
          jettonMasterAddress = USDT_ALTERNATIVE.toString();
          try {
            jettonWalletAddress = await getJettonWalletAddress(jettonMasterAddress, userAddress);
            console.log('Found jetton wallet address using alternative USDT address:', jettonWalletAddress);
          } catch (e) {
            console.error('Failed to get jetton wallet address with both USDT addresses:', e);
            throw new Error('Unable to get your USDT wallet address. Make sure you have USDT tokens in your wallet.');
          }
        }
        
        // GitHub örneği gibi basit bir transfer işlemi oluşturuyoruz
        const payload = beginCell()
          .storeUint(0x0f8a7ea5, 32) // Jetton transfer op code
          .storeUint(DEFAULT_QUERY_ID, 64) // query_id
          .storeCoins(amountInNano) // amount to transfer
          .storeAddress(destinationAddress) // destination address
          .storeAddress(Address.parse(userAddress)) // response address (your wallet)
          .storeMaybeRef() // custom_payload - null
          .storeCoins(toNano(GAS_AMOUNTS.FORWARD_TON_AMOUNT)) // forward_ton_amount
          .storeBit(true) // forward_payload is a cell reference
          .storeRef(
            beginCell()
              .storeUint(0, 32) // comment prefix
              .storeBuffer(Buffer.from(`Payment ID: ${paymentId}`))
              .endCell()
          )
          .endCell().toBoc().toString('base64');
        
        // GitHub örneğinden: tx oluştur
        const tx: SendTransactionRequest = {
          validUntil: Math.round(Date.now() / 1000) + TRANSACTION_TIMEOUT,
          messages: [
            {
              address: jettonWalletAddress, // Kullanıcının jetton cüzdan adresi
              amount: toNano(GAS_AMOUNTS.JETTON_TRANSFER_WITH_COMMENT).toString(),
              payload
            }
          ]
        };
        
        console.log('Sending USDT transfer with GitHub example method:', {
          from: userAddress,
          to: address,
          jettonWalletAddress,
          amount: amountInNano.toString(),
          gas: tx.messages[0].amount,
          forwardAmount: GAS_AMOUNTS.FORWARD_TON_AMOUNT
        });
        
        // GitHub örneğindeki gibi sendTransaction options
        const sendOptions: ActionConfiguration = {
          modals: 'all',
          notifications: ['error', 'success']
        };
        
        // İşlemi gönder
        const result = await tonConnectUi.sendTransaction(tx, sendOptions);
        console.log('Transaction result:', result);
        
        // GitHub örneğindeki gibi transaction hash çıkar ve işlemi izle
        try {
          const imMsgCell = Cell.fromBase64(result.boc);
          const inMsgHash = imMsgCell.hash().toString('hex');
          console.log('Transaction hash:', inMsgHash);
          
          // İşlemi izle
          try {
            console.log('Waiting for transaction to complete...');
            const txInfo = await waitForTx(inMsgHash);
            console.log('Transaction completed:', txInfo);
          } catch (e) {
            console.error('Error waiting for transaction:', e);
          }
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
      } else if (tokenType === 'TON') {
        // Native TON transfer
        // Create payment data to include in the message
        const paymentData = {
          payment_id: paymentId,
          timestamp: Date.now(),
          type: 'payment'
        };

        // Body olarak gönderme
        const message = beginCell()
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

        const tx: SendTransactionRequest = {
          validUntil: Math.floor(Date.now() / 1000) + TRANSACTION_TIMEOUT, // Sabit değer
          messages: [
            {
              address: address,
              amount: amount,
              payload: message.toBoc().toString('base64')
            }
          ]
        };

        console.log('Sending TON transaction:', {
          address,
          amount,
          payload: message.toBoc().toString('base64')
        });

        // TonConnect UI'ın transaction davranışını ayarlayan seçenekler
        const sendOptions: ActionConfiguration = {
          modals: 'all',
          notifications: ['error', 'success']
        };

        const result = await tonConnectUi.sendTransaction(tx, sendOptions);
        
        // Transaction hash oluştur (USDT transferindeki gibi)
        try {
          const imMsgCell = Cell.fromBase64(result.boc);
          const inMsgHash = imMsgCell.hash().toString('hex');
          console.log('TON transaction hash:', inMsgHash);
          
          // İşlemi izle - GitHub örneğindeki waitForTx fonksiyonunu kullan
          try {
            console.log('Waiting for TON transaction to complete...');
            const txInfo = await waitForTx(inMsgHash);
            console.log('TON transaction completed:', txInfo);
          } catch (e) {
            console.error('Error waiting for TON transaction:', e);
          }
        } catch (e) {
          console.error('Error extracting TON transaction hash:', e);
        }
        
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
      }
    } catch (error) {
      console.error('Transaction error:', error);
      
      if (error instanceof Error) {
        let errorMsg = error.message;
        
        if (errorMsg.includes('unable to verify transaction')) {
          errorMsg = ERROR_MESSAGES.UNABLE_TO_VERIFY;
          console.error('Transaction verification error details:', error);
        } else if (errorMsg.includes('invalid address')) {
          errorMsg = ERROR_MESSAGES.INVALID_ADDRESS + ' ' + address;
        } else if (errorMsg.includes('rejected')) {
          errorMsg = ERROR_MESSAGES.REJECTED;
        } else if (errorMsg.includes('timeout')) {
          errorMsg = ERROR_MESSAGES.TIMEOUT;
        } else if (errorMsg.includes('error code 709')) {
          errorMsg = ERROR_MESSAGES.ERROR_709;
        }
        
        setErrorMessage(errorMsg);
        setTxStatus('error');
      } else {
        setErrorMessage('Unknown error occurred during transfer');
        setTxStatus('error');
      }
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.setText('Payment Failed!');
        window.Telegram.WebApp.MainButton.show();
      }
    }
  }, [address, amount, paymentId, comment, tonConnectUi, tokenType, wallet]);

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
            onClick={handleTransfer} 
            className="send-button"
            disabled={txStatus === 'pending' || !address || !amount}
          >
            {txStatus === 'pending' ? 'Sending...' : `Send ${tokenType}`}
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
