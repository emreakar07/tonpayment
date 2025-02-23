import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell } from '@ton/core';

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
      } catch (error) {
        console.error('Error parsing payment data:', error);
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    try {
      setTxStatus('pending');
      
      // Text mesajı hazırla
      const text = `Payment ID: ${paymentId}`; // İstediğiniz mesaj
      
      const message = beginCell()
        .storeUint(0, 32)        // op = 0 (text mesajı)
        .storeUint(0, 64)        // query id = 0
        .storeBuffer(            // mesaj içeriği
          Buffer.from(text, 'utf-8')
        )
        .endCell();

      const tx: SendTransactionRequest = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: address,
            amount: amount,
            payload: message.toBoc().toString('base64')
          }
        ],
      };

      const result = await tonConnectUi.sendTransaction(tx);
      
      if (result) {
        const txHash = result.boc;
        console.log('Transaction hash:', txHash);
        
        setTxStatus('success');

        // Eğer Telegram Web App içindeyse, başarılı işlemi Telegram'a bildir
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.MainButton.setText('Payment Successful!');
          window.Telegram.WebApp.MainButton.show();
          // İsteğe bağlı: Başarılı ödemeyi bot'a bildir
          window.Telegram.WebApp.sendData(JSON.stringify({
            status: 'success',
            payment_id: paymentId,
            tx_hash: txHash
          }));
        }
      }
    } catch (error) {
      console.error('Transaction error:', error);
      setTxStatus('error');
      
      // Telegram Web App içindeyse hatayı göster
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.MainButton.setText('Payment Failed!');
        window.Telegram.WebApp.MainButton.show();
      }
    }
  }, [address, amount, paymentId, tonConnectUi]);

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
            value={address} 
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter TON address"
            readOnly
          />
        </div>
        
        <div className="input-group">
          <label>Amount (in nanoTON):</label>
          <input 
            type="text" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount in nanoTON"
            readOnly
          />
        </div>

        <div className="input-group">
          <label>Payment ID:</label>
          <input 
            type="text" 
            value={paymentId} 
            readOnly
          />
        </div>

        {renderStatus()}  {/* Transaction durumunu göster */}

        {wallet ? (
          <button 
            onClick={handleSend} 
            className="send-button"
            disabled={txStatus === 'pending'}
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

