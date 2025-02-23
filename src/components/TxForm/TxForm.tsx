import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell } from '@ton/core';
import { Address, TonClient } from '@ton/ton';

interface PaymentData {
  amount: string;
  address: string;
  payment_id: string;
  productName: string;
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

const checkTransaction = async (txHash: string, address: string) => {
  try {
    // TonClient oluştur
    const client = new TonClient({
      endpoint: 'https://toncenter.com/api/v2/jsonRPC',
      apiKey: 'YOUR_API_KEY' // Opsiyonel
    });

    // Son 20 transaction'ı getir
    const transactions = await client.getTransactions(Address.parse(address), {
      limit: 20,
    });

    // Transaction'ı bul
    const tx = transactions.find(tx => {
      const currentHash = tx.hash().toString('base64');
      return currentHash === txHash;
    });
    
    if (tx) {
      // Transaction başarılı mı kontrol et
      const description = tx.description;
      if (description.type === 'generic') {
        return description.computePhase.type === 'vm' && 
               description.computePhase.exitCode === 0;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking transaction:', error);
    return false;
  }
};

// Pending transaction'ları saklamak için
interface PendingTx {
  hash: string;
  address: string;
  payment_id: string;
  timestamp: number;
}

export function TxForm() {
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [txStatus, setTxStatus] = useState<'pending' | 'success' | 'error' | null>(null);
  const wallet = useTonWallet();
  const [tonConnectUi] = useTonConnectUI();
  const [isChecking, setIsChecking] = useState(false);

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

  // Component mount olduğunda pending transaction'ları kontrol et
  useEffect(() => {
    const pendingTxs = localStorage.getItem('pendingTransactions');
    if (pendingTxs) {
      const transactions: PendingTx[] = JSON.parse(pendingTxs);
      
      // Son 2 saat içindeki transaction'ları kontrol et
      const recentTxs = transactions.filter(tx => 
        Date.now() - tx.timestamp < 2 * 60 * 60 * 1000
      );

      // Her transaction için kontrol başlat
      recentTxs.forEach(tx => {
        checkAndUpdateStatus(tx);
      });

      // Eski transaction'ları temizle
      localStorage.setItem('pendingTransactions', JSON.stringify(recentTxs));
    }
  }, []);

  const checkAndUpdateStatus = async (tx: PendingTx) => {
    const isSuccess = await checkTransaction(tx.hash, tx.address);
    if (isSuccess) {
      // Transaction başarılı - localStorage'dan kaldır
      const pendingTxs = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
      const updatedTxs = pendingTxs.filter((t: PendingTx) => t.hash !== tx.hash);
      localStorage.setItem('pendingTransactions', JSON.stringify(updatedTxs));

      // Telegram'a bildir
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify({
          status: 'success',
          payment_id: tx.payment_id,
          tx_hash: tx.hash
        }));
      }
    }
  };

  const handleSend = useCallback(async () => {
    try {
      setTxStatus('pending');
      
      const message = beginCell()
        .storeUint(0, 32)
        .storeBuffer(Buffer.from(paymentId, 'utf-8'))
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
        
        // Pending transaction'ı localStorage'a kaydet
        const pendingTx: PendingTx = {
          hash: txHash,
          address: address,
          payment_id: paymentId,
          timestamp: Date.now()
        };

        const pendingTxs = JSON.parse(localStorage.getItem('pendingTransactions') || '[]');
        pendingTxs.push(pendingTx);
        localStorage.setItem('pendingTransactions', JSON.stringify(pendingTxs));

        // Kontrol işlemini başlat
        checkAndUpdateStatus(pendingTx);
      }
    } catch (error) {
      console.error('Transaction error:', error);
      setTxStatus('error');
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

