import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, storeStateInit, toNano, Address } from "@ton/core";
import { 
  USDT_ADDRESS, 
  USDT_ADDRESS_NON_BOUNCEABLE,
  USDT_DECIMALS,
  createJettonTransferMessage, 
  createCommentPayload, 
  formatAmount,
  createSimplifiedJettonTransferRequest,
  createAlternativeJettonTransferRequest,
  predictJettonWalletAddress
} from '../../utils/jetton-utils';

interface PaymentData {
  amount: string;
  address: string;
  payment_id: string;
  productName: string;
  token_type?: 'TON' | 'USDT'; // Add token type
}

// Adres doğrulama fonksiyonu
const isValidTonAddress = (address: string): boolean => {
  try {
    Address.parse(address);
    return true;
  } catch (error) {
    return false;
  }
};

export function TxForm() {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const wallet = useTonWallet();
  const [tonConnectUi] = useTonConnectUI();
  const [comment, setComment] = useState('');
  const [tokenType, setTokenType] = useState<'TON' | 'USDT'>('TON');
  const [transferMethod, setTransferMethod] = useState<'standard' | 'simplified' | 'alternative'>('simplified');

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
        setAddress(paymentData.address);
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
              .storeUint(0x706c7374, 32)  // "plst" as hex for "payload store"
              .storeBuffer(Buffer.from(JSON.stringify({
                ...paymentData,
                timestamp: Date.now().toString()
              })))
              .endCell()
          )
          .endCell();

        const tx: SendTransactionRequest = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
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
          transferMethod,
          decimals: USDT_DECIMALS
        });

        let tx: SendTransactionRequest;
        
        if (transferMethod === 'standard') {
          // Standard method - using createJettonTransferMessage
          const parsedUserAddress = Address.parse(userAddress);
          const commentPayload = createCommentPayload(`Payment ID: ${paymentId}`);
          
          // Benzersiz bir query ID oluştur - tamamen rastgele
          const uniqueQueryId = Math.floor(Math.random() * 2**32);
          
          const jettonTransferMessage = createJettonTransferMessage({
            amount: amountInNano,
            toAddress: destinationAddress,
            responseAddress: parsedUserAddress,
            forwardAmount: toNano('0.000000001'), // 1 nanoton for notification
            forwardPayload: commentPayload,
            queryId: uniqueQueryId
          });
          
          tx = {
            validUntil: Math.floor(Date.now() / 1000) + 300, // 5 dakika geçerli
            messages: [
              {
                address: USDT_ADDRESS,
                amount: toNano('0.15').toString(), // 0.15 TON for fees
                payload: jettonTransferMessage.toBoc().toString('base64')
              }
            ]
          };
          
          console.log('Using standard method with payload:', jettonTransferMessage.toBoc().toString('base64'));
        } 
        else if (transferMethod === 'simplified') {
          // Simplified method - using createSimplifiedJettonTransferRequest
          tx = createSimplifiedJettonTransferRequest({
            jettonMasterAddress: USDT_ADDRESS,
            toAddress: address,
            amount: amountInNano,
            fromAddress: userAddress,
            comment: `Payment ID: ${paymentId}`,
            attachedAmount: toNano('0.2') // Increase attached TON amount
          });
          
          console.log('Using simplified method with request:', tx);
        }
        else if (transferMethod === 'alternative') {
          // Alternative method - using createAlternativeJettonTransferRequest
          // Calculate the user's Jetton wallet address
          const parsedUserAddress = Address.parse(userAddress);
          const parsedJettonMasterAddress = Address.parse(USDT_ADDRESS);
          
          // Try to predict the user's Jetton wallet address
          try {
            const jettonWalletAddress = predictJettonWalletAddress(
              parsedUserAddress,
              parsedJettonMasterAddress
            );
            
            console.log('Predicted Jetton wallet address:', jettonWalletAddress);
            
            tx = createAlternativeJettonTransferRequest({
              jettonWalletAddress: USDT_ADDRESS_NON_BOUNCEABLE,
              toAddress: address,
              amount: amountInNano,
              fromAddress: userAddress,
              comment: `Payment ID: ${paymentId}`,
              attachedAmount: toNano('0.25') // Even more TON for fees
            });
          } catch (error) {
            console.error('Error predicting Jetton wallet address:', error);
            // Fallback to using the non-bounceable USDT address
            tx = createAlternativeJettonTransferRequest({
              jettonWalletAddress: USDT_ADDRESS_NON_BOUNCEABLE,
              toAddress: address,
              amount: amountInNano,
              fromAddress: userAddress,
              comment: `Payment ID: ${paymentId}`,
              attachedAmount: toNano('0.25') // Even more TON for fees
            });
          }
          
          console.log('Using alternative method with request:', tx);
        }
        else {
          // Default to standard method if transferMethod is not recognized
          console.warn('Unknown transfer method, defaulting to standard');
          
          const parsedUserAddress = Address.parse(userAddress);
          const commentPayload = createCommentPayload(`Payment ID: ${paymentId}`);
          const uniqueQueryId = Math.floor(Math.random() * 2**32);
          
          const jettonTransferMessage = createJettonTransferMessage({
            amount: amountInNano,
            toAddress: destinationAddress,
            responseAddress: parsedUserAddress,
            forwardAmount: toNano('0.000000001'),
            forwardPayload: commentPayload,
            queryId: uniqueQueryId
          });
          
          tx = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [
              {
                address: USDT_ADDRESS,
                amount: toNano('0.15').toString(),
                payload: jettonTransferMessage.toBoc().toString('base64')
              }
            ]
          };
        }

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
        
        // Kullanıcıya daha spesifik hata mesajı göster
        setErrorMessage(error.message);
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
  }, [address, amount, paymentId, comment, tonConnectUi, tokenType, wallet, transferMethod]);

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
    
    const formattedAmount = formatAmount(amount);
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
        
        {tokenType === 'USDT' && (
          <div className="input-group">
            <label>Transfer Method:</label>
            <select 
              value={transferMethod} 
              onChange={(e) => setTransferMethod(e.target.value as 'standard' | 'simplified' | 'alternative')}
              disabled={txStatus === 'pending'}
            >
              <option value="standard">Standard</option>
              <option value="simplified">Simplified</option>
              <option value="alternative">Alternative</option>
            </select>
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
            onClick={handleSend} 
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
