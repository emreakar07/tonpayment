import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { CHAIN, SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { createClient } from '@supabase/supabase-js';
import eruda from "eruda";

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

// Supabase client oluşturma
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

interface PaymentData {
  amount: string;
  address: string;
  payment_id: string;
  productName: string;
}

interface Order {
  payment_id: string;
  amount_ton: string;
  status: 'pending' | 'completed' ;
  transaction_hash?: string;
}

// In this example, we are using a predefined smart contract state initialization (`stateInit`)
// to interact with an "EchoContract". This contract is designed to send the value back to the sender,
// serving as a testing tool to prevent users from accidentally spending money.
const defaultTx: SendTransactionRequest = {
  // The transaction is valid for 10 minutes from now, in unix epoch seconds.
  validUntil: Math.floor(Date.now() / 1000) + 600,
  messages: [
    {
      // The receiver's address.
      address: 'EQCKWpx7cNMpvmcN5ObM5lLUZHZRFKqYA4xmw9jOry0ZsF9M',
      // Amount to send in nanoTON. For example, 0.005 TON is 5000000 nanoTON.
      amount: '5000000',
      // (optional) State initialization in boc base64 format.
      stateInit: 'te6cckEBBAEAOgACATQCAQAAART/APSkE/S88sgLAwBI0wHQ0wMBcbCRW+D6QDBwgBDIywVYzxYh+gLLagHPFsmAQPsAlxCarA==',
      // (optional) Payload in boc base64 format.
      payload: 'te6ccsEBAQEADAAMABQAAAAASGVsbG8hCaTc/g==',
    },

    // Uncomment the following message to send two messages in one transaction.
    /*
    {
      // Note: Funds sent to this address will not be returned back to the sender.
      address: 'UQAuz15H1ZHrZ_psVrAra7HealMIVeFq0wguqlmFno1f3B-m',
      amount: toNano('0.01').toString(),
    }
    */
  ],
};

export function TxForm() {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [txStatus, setTxStatus] = useState<'init' | 'pending' | 'sending' | 'success' | 'error' | null>('init');
  const [statusMessage, setStatusMessage] = useState<string>('Uygulama başlatılıyor...');
  const wallet = useTonWallet();
  const [tonConnectUi] = useTonConnectUI();

  // İlk yükleme ve Supabase bağlantı kontrolü
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase.from('orders').select('count');
        if (!error) {
          setStatusMessage('Veritabanı bağlantısı başarılı');
          setTxStatus('init');
        }
      } catch (err) {
        setStatusMessage('Veritabanı bağlantısı başarısız');
        setTxStatus('error');
      }
    };
    checkConnection();
  }, []);

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
      } catch (error) {
        setStatusMessage('Ödeme bilgileri yüklenirken hata oluştu');
        setTxStatus('error');
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    try {
      setTxStatus('pending');
      setStatusMessage('İşlem hazırlanıyor...');
      
      const tx: SendTransactionRequest = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: address,
            amount: amount,
          }
        ],
      };

      // Biraz bekleyelim
      await new Promise(resolve => setTimeout(resolve, 1500));

      setTxStatus('sending');
      setStatusMessage('İşlem cüzdana gönderiliyor...');
      
      // Transaction'ı gönder ve sonucunu bekle
      const result = await tonConnectUi.sendTransaction(tx);

      // TonConnect UI transaction sent bildirimini gösterdiğinde
      if (result?.boc) {
        // Biraz daha bekleyelim
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        setStatusMessage('İşlem blockchain\'e gönderildi, veritabanı güncelleniyor...');
        
        try {
          // Supabase'i güncelle
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              status: 'completed',
              transaction_hash: result.boc,
            })
            .eq('status', 'pending');

          if (updateError) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            setStatusMessage('Veritabanı güncellenirken hata oluştu');
            setTxStatus('error');
            return;
          }

          // Son mesaj için biraz bekleyelim
          await new Promise(resolve => setTimeout(resolve, 1500));
          setStatusMessage('İşlem başarıyla tamamlandı! Transaction hash: ' + result.boc.slice(0, 10) + '...');
          setTxStatus('success');
        } catch (dbError) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          setStatusMessage('Veritabanı işlemi başarısız oldu');
          setTxStatus('error');
        }
      }

    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setStatusMessage('İşlem gönderilirken hata oluştu');
      setTxStatus('error');
    }
  }, [address, amount, tonConnectUi]);

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

