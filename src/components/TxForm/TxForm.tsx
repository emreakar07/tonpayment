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

      // Text mesajı için özel format:
      // 0x00000000 (32-bit op code) + message
      const message = `ton-payment-id:${paymentId}`;
      const textCell = beginCell()
        .storeUint(0, 32) // text mesajları için op = 0
        .storeStringTail(message)
        .endCell();

      const tx: SendTransactionRequest = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: address,
            amount: amount,
            stateInit: undefined,
            payload: textCell.toBoc().toString('base64')
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
  }, [address, amount, paymentId, tonConnectUi]);

  return (
    <div className="send-tx-form">
      <div className="connect-button">
        <TonConnectButton />
      </div>
      
      <div className="form-content">
        <div className="input-group">
          <label>Address:</label>
          <div className="value-display">{address}</div>
        </div>
        
        <div className="input-group">
          <label>Amount:</label>
          <div className="value-display">
            {(Number(amount) / 1_000_000_000).toFixed(2)} TON
          </div>
        </div>

        <div className="input-group">
          <label>Payment ID:</label>
          <div className="value-display">{paymentId}</div>
          <div className="message-preview">
            Message to be sent: <span className="message-content">ton-payment-id:{paymentId}</span>
          </div>
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

