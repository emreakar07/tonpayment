import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, storeStateInit, toNano, Address } from "@ton/core";

interface PaymentData {
  amount: string;
  address: string;
  payment_id: string;
  productName: string;
}

export function TxForm() {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const wallet = useTonWallet();
  const [tonConnectUi] = useTonConnectUI();
  const [comment, setComment] = useState('');

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
      
      // 1. Body olarak gönderme
      const bodyMessage = beginCell()
        .storeUint(0x18, 4)
        .storeAddress(destinationAddress)
        .storeCoins(amountInNano)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(
          beginCell()
            .storeBuffer(
              Buffer.from(
                JSON.stringify({
                  payment_id: paymentId,
                  timestamp: Date.now(),
                  type: 'payment'
                })
              )
            )
            .endCell()
        )
        .endCell();

      // 2. Data olarak gönderme
      const dataMessage = beginCell()
        .storeUint(0x18, 4)
        .storeAddress(destinationAddress)
        .storeCoins(amountInNano)
        .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
        .storeRef(
          beginCell()
            .storeUint(0x706c7374, 32)  // "plst" as hex for "payload store"
            .storeBuffer(
              Buffer.from(
                JSON.stringify({
                  payment_id: paymentId,
                  timestamp: Date.now().toString(),
                  type: 'payment'
                })
              )
            )
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

      console.log('Sending transaction:', {
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
          payment_id: paymentId,
          tx_hash: result.boc
        }));
      }

    } catch (error) {
      console.error('Transaction error:', error);
      setTxStatus('error');
      
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.setText('Payment Failed!');
        window.Telegram.WebApp.MainButton.show();
      }
    }
  }, [address, amount, paymentId, comment, tonConnectUi]);

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
            value={paymentId || ''}
            placeholder="No address available"
            readOnly
          />
        </div>
        
        <div className="input-group">
          <label>Amount:</label>
          <input 
            type="text" 
            value={amount ? `${Number(amount) / 1_000_000_000} TON` : '0 TON'}
            readOnly
          />
        </div>

        <div className="input-group">
          <label>Payment ID:</label>
          <input 
            type="text" 
            value={paymentId || ''}
            placeholder="No payment ID"
            readOnly
          />
        </div>

        <div className="input-group">
          <label>Transaction Data:</label>
          <textarea 
            value={`Payment ID: ${paymentId || 'Not available'}
Amount: ${amount ? `${Number(amount) / 1_000_000_000} TON` : '0 TON'}
Address: ${address || 'Not available'}
Timestamp: ${new Date().toLocaleString()}`}
            readOnly
            className="data-preview"
            rows={4}
          />
        </div>

        {renderStatus()}

        {wallet ? (
          <button 
            onClick={handleSend} 
            className="send-button"
            disabled={txStatus === 'pending' || !address || !amount}
          >
            {txStatus === 'pending' ? 'Sending...' : 'Send Transaction'}
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

