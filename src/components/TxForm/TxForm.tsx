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
      // İşlem başlangıcı
      setTxStatus('pending');
      setStatusMessage('İşlem başlatılıyor...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      const tx: SendTransactionRequest = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
          {
            address: address,
            amount: amount,
          }
        ],
      };

      // Cüzdana gönderme
      setStatusMessage('Cüzdan onayı bekleniyor...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const result = await tonConnectUi.sendTransaction(tx);
        
        // Transaction başarılı olduysa
        if (result?.boc) {
          setStatusMessage('Transaction başarıyla gönderildi!');
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          setStatusMessage('Veritabanı güncelleniyor...');
          try {
            const { error: updateError } = await supabase
              .from('orders')
              .update({
                status: 'completed',
                transaction_hash: result.boc,
              })
              .eq('status', 'pending');

            if (updateError) {
              throw new Error('Veritabanı güncellenemedi');
            }

            setStatusMessage('✅ İşlem tamamlandı! Hash: ' + result.boc.slice(0, 8) + '...');
            setTxStatus('success');
            
            // İşlem başarılı olduktan 3 saniye sonra WebApp'i kapatabiliriz
            setTimeout(() => {
              window.Telegram?.WebApp.close();
            }, 3000);

          } catch (dbError) {
            throw new Error('Veritabanı güncellenirken hata oluştu');
          }
        } else {
          throw new Error('Transaction hash alınamadı');
        }
      } catch (txError: any) {
        // Kullanıcı işlemi reddettiyse
        if (txError.message?.includes('User rejected')) {
          setStatusMessage('❌ İşlem kullanıcı tarafından reddedildi');
        } else {
          setStatusMessage('❌ Transaction gönderilemedi: ' + txError.message);
        }
        setTxStatus('error');
      }

    } catch (err: any) {
      setStatusMessage('❌ ' + (err.message || 'Beklenmeyen bir hata oluştu'));
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

