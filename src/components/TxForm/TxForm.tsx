import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { CHAIN, SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell } from '@ton/core';
import { Buffer } from 'buffer';

// Telegram WebApp için tip tanımlaması
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        close: () => void;
        showPopup: (options: { title: string; message: string; buttons: { type: string }[] }) => void;
      };
    };
  }
}

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
  const [txStatus, setTxStatus] = useState<'init' | 'pending' | 'sending' | 'success' | 'error' | null>('init');
  const [statusMessage, setStatusMessage] = useState<string>('Uygulama başlatılıyor...');
  const wallet = useTonWallet();
  const [tonConnectUi] = useTonConnectUI();
  const [message, setMessage] = useState('');

  const savePaymentData = (paymentData: PaymentData, transactionBoc?: string) => {
    const storedPayments = localStorage.getItem('ton_payments') || '[]';
    const payments = JSON.parse(storedPayments);
    
    payments.push({
      payment_data: paymentData,
      transaction_data: transactionBoc ? {
        boc: transactionBoc,
        timestamp: Date.now()
      } : undefined
    });

    localStorage.setItem('ton_payments', JSON.stringify(payments));
  };

  // Payment data yükleme
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
        setStatusMessage('Ödeme bilgileri yüklendi');
        setTxStatus('init');

        // Payment data'yı kaydet
        savePaymentData(paymentData);
      } catch (error) {
        setStatusMessage('Ödeme bilgileri yüklenirken hata oluştu');
        setTxStatus('error');
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    try {
      setTxStatus('pending');
      setStatusMessage('İşlem başlatılıyor...');

      const tx: SendTransactionRequest = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: address,
            amount: amount,
            payload: message ? 
              beginCell()
                .storeUint(0, 32) // op code 0 for text messages
                .storeBuffer(Buffer.from(message, 'utf-8')) // string'i buffer olarak store et
                .endCell()
                .toBoc()
                .toString('base64')
              : undefined
          }
        ],
        network: CHAIN.MAINNET
      };

      setStatusMessage('Cüzdan onayı bekleniyor...');
      
      try {
        const result = await tonConnectUi.sendTransaction(tx);
        
        if (result?.boc) {
          setStatusMessage('Transaction gönderildi!');
          setTxStatus('success');

          // Transaction boc'u kaydet
          const paymentData = {
            amount: amount,
            address: address,
            payment_id: paymentId,
            productName: ''
          };
          savePaymentData(paymentData, result.boc);

          // Kullanıcıyı bilgilendir
          window.Telegram?.WebApp.showPopup({
            title: 'İşlem Başarılı',
            message: 'Ödemeniz başarıyla gönderildi! Bot üzerinden takip edebilirsiniz.',
            buttons: [{ type: 'ok' }]
          });

          // 3 saniye sonra kapat
          setTimeout(() => {
            window.Telegram?.WebApp.close();
          }, 3000);
        }
      } catch (txError: any) {
        if (txError.message?.includes('User rejected')) {
          setStatusMessage('❌ İşlem kullanıcı tarafından reddedildi');
        } else {
          setStatusMessage('❌ ' + txError.message);
        }
        setTxStatus('error');
      }

    } catch (err: any) {
      setStatusMessage('❌ ' + (err.message || 'Beklenmeyen bir hata oluştu'));
      setTxStatus('error');
    }
  }, [address, amount, message, paymentId, tonConnectUi]);

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
          <label>Message (optional):</label>
          <input 
            type="text" 
            value={message} 
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter message (optional)"
          />
        </div>

        {wallet ? (
          <button onClick={handleSend} className="send-button">
            Send Transaction
          </button>
        ) : (
          <div className="connect-message">
            Connect wallet to send transaction
          </div>
        )}
      </div>

      {txStatus && (
        <div className={`transaction-status ${txStatus}`}>
          {statusMessage}
        </div>
      )}
    </div>
  );
}

