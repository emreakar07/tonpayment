import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { CHAIN, SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { createClient } from '@supabase/supabase-js';

// Telegram WebApp için tip tanımlaması
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        close: () => void;
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
  orderId: string;
  productName: string;
}

interface Order {
  id: string;
  amount: string;
  status: 'pending' | 'completed' | 'failed';
  transaction_hash?: string;
  created_at: string;
  updated_at: string;
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
  const [orderId, setOrderId] = useState('');
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
        setOrderId(paymentData.orderId); // Order ID'yi state'e kaydet
      } catch (error) {
        console.error('Error parsing payment data:', error);
      }
    }
  }, []);

  const updateOrderStatus = async (transactionHash: string) => {
    try {
      // Önce order'ı kontrol et
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('amount_ton')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Amount kontrolü (nanoTON'dan TON'a çevirip karşılaştır)
      const paidAmount = Number(amount) / 1_000_000_000;
      if (paidAmount !== Number(order.amount_ton)) {
        throw new Error('Payment amount mismatch');
      }

      // Order'ı güncelle
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'completed',
          transaction_hash: transactionHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

    } catch (error) {
      console.error('Error updating order status:', error);
      setTxStatus('error');
      throw error;
    }
  };

  const handleSend = useCallback(async () => {
    try {
      setTxStatus('pending');
      const tx: SendTransactionRequest = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: address,
            amount: amount,
          }
        ],
      };
      
      // Transaction'ı gönder
      const result = await tonConnectUi.sendTransaction(tx);
      
      if (result) {
        // Transaction hash'i al
        const transactionHash = result.boc;
        
        // Transaction'ın tamamlanmasını bekle
        let attempts = 0;
        const maxAttempts = 20; // maksimum 20 deneme (toplam 60 saniye)
        
        const checkTransaction = async () => {
          try {
            // Transaction'ı kontrol et
            const { data: txData, error: txError } = await supabase
              .from('orders')
              .select('status')
              .eq('id', orderId)
              .single();

            if (txError) throw txError;

            if (attempts >= maxAttempts) {
              setTxStatus('error');
              throw new Error('Transaction timeout');
            }

            attempts++;

            // Transaction hala pending durumunda, tekrar dene
            if (txData.status === 'pending') {
              setTimeout(checkTransaction, 3000); // 3 saniye sonra tekrar dene
              return;
            }

            // Transaction başarılı olduysa güncelle
            await updateOrderStatus(transactionHash);
            setTxStatus('success');
            
            // Başarılı işlem sonrası yönlendirme
            if (window.Telegram?.WebApp) {
              window.Telegram.WebApp.close();
            }
          } catch (error) {
            console.error('Error checking transaction:', error);
            if (attempts < maxAttempts) {
              setTimeout(checkTransaction, 3000); // Hata durumunda da tekrar dene
            } else {
              setTxStatus('error');
            }
          }
        };

        // İlk kontrolü başlat
        setTimeout(checkTransaction, 3000); // İlk kontrol için 3 saniye bekle

      }
    } catch (err) {
      console.error("Transaction hatası:", err);
      setTxStatus('error');
    }
  }, [address, amount, orderId, tonConnectUi]);

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
          {txStatus === 'pending' && 'İşlem gönderiliyor...'}
          {txStatus === 'success' && 'İşlem başarıyla tamamlandı!'}
          {txStatus === 'error' && 'İşlem başarısız oldu!'}
        </div>
      )}
    </div>
  );
}

