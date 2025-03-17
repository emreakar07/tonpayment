import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, storeStateInit, toNano, Address } from "@ton/core";
import { USDT_ADDRESS, createJettonTransferMessage, createCommentPayload, formatAmount } from '../../utils/jetton-utils';

interface PaymentData {
  amount: string;
  address: string;
  payment_id: string;
  productName: string;
  token_type?: 'TON' | 'USDT'; // Add token type
}

export function TxForm() {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error' | null>(null);
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
        
        const amountInNano = (parseFloat(paymentData.amount) * 1_000_000_000).toString();
        
        setAmount(amountInNano);
        setAddress(paymentData.address);
        setPaymentId(paymentData.payment_id);
        setComment(`Payment ID: ${paymentData.payment_id}`);
        
        // Set token type if provided, default to TON
        if (paymentData.token_type) {
          setTokenType(paymentData.token_type);
        }
      } catch (error) {
        console.error('Error parsing payment data:', error);
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
        
        const userAddress = Address.parse(wallet.account.address);
        
        // Create comment payload with payment ID
        const commentPayload = createCommentPayload(`Payment ID: ${paymentId}`);
        
        // Create jetton transfer message
        const jettonTransferMessage = createJettonTransferMessage({
          amount: amountInNano,
          toAddress: destinationAddress,
          responseAddress: userAddress,
          forwardAmount: toNano('0.000000001'), // 1 nanoton for notification
          forwardPayload: commentPayload
        });
        
        const tx: SendTransactionRequest = {
          validUntil: Math.floor(Date.now() / 1000) + 60,
          messages: [
            {
              address: USDT_ADDRESS,
              amount: toNano('0.05').toString(), // Attach 0.05 TON for fees
              payload: jettonTransferMessage.toBoc().toString('base64')
            }
          ]
        };

        console.log('Sending USDT transaction:', {
          jettonAddress: USDT_ADDRESS,
          destinationAddress: address,
          amount,
          payload: jettonTransferMessage.toBoc().toString('base64')
        });

        const result = await tonConnectUi.sendTransaction(tx);
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
      setTxStatus('error');
      
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
        return <div className="tx-status error">Transaction failed. Please try again.</div>;
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

