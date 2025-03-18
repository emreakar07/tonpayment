import React, { useCallback, useState, useEffect } from 'react';
import './style.scss';
import { SendTransactionRequest, TonConnectButton, useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { beginCell, storeStateInit, toNano, Address } from "@ton/core";
import { 
  USDT_ADDRESS, 
  USDT_ADDRESS_NON_BOUNCEABLE,
  USDT_DECIMALS,
  CENTRAL_WALLET_ADDRESS,
  GasAmounts,
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
  const [transferMethod, setTransferMethod] = useState<'standard' | 'simplified' | 'alternative'>('standard');

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
          // Use central wallet address for response
          const responseAddress = Address.parse(CENTRAL_WALLET_ADDRESS);
          const commentPayload = createCommentPayload(`Payment ID: ${paymentId}`);
          
          // Benzersiz bir query ID oluştur - tamamen rastgele
          const uniqueQueryId = Math.floor(Math.random() * 2**32);
          
          const jettonTransferMessage = createJettonTransferMessage({
            amount: amountInNano,
            toAddress: destinationAddress,
            responseAddress: responseAddress, // Using central wallet address
            forwardAmount: toNano('0.000000001'), // Exactly 1 nanoton for notification
            forwardPayload: commentPayload,
            queryId: uniqueQueryId
          });
          
          tx = {
            validUntil: Math.floor(Date.now() / 1000) + 300, // 5 dakika geçerli
            messages: [
              {
                address: USDT_ADDRESS,
                amount: GasAmounts.JETTON_TRANSFER_STANDARD.toString(), // Daha yüksek gas
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
            attachedAmount: toNano('0.35') // Increase attached TON amount
          });
          
          console.log('Using simplified method with request:', tx);
        }
        else if (transferMethod === 'alternative') {
          // Alternative method - using createAlternativeJettonTransferRequest
          // Use central wallet address for transfers
          console.log('Using central wallet address for transfer:', CENTRAL_WALLET_ADDRESS);
          
          tx = createAlternativeJettonTransferRequest({
            jettonWalletAddress: CENTRAL_WALLET_ADDRESS,
            toAddress: address,
            amount: amountInNano,
            fromAddress: userAddress,
            comment: `Payment ID: ${paymentId}`,
            attachedAmount: toNano('0.4') // Increase to 0.4 TON for fees
          });
          
          console.log('Using alternative method with request:', tx);
        }
        else {
          // Default to standard method if transferMethod is not recognized
          console.warn('Unknown transfer method, defaulting to standard');
          
          const parsedUserAddress = Address.parse(userAddress);
          // Use central wallet address for response
          const responseAddress = Address.parse(CENTRAL_WALLET_ADDRESS);
          const commentPayload = createCommentPayload(`Payment ID: ${paymentId}`);
          const uniqueQueryId = Math.floor(Math.random() * 2**32);
          
          const jettonTransferMessage = createJettonTransferMessage({
            amount: amountInNano,
            toAddress: destinationAddress,
            responseAddress: responseAddress, // Using central wallet address
            forwardAmount: toNano('0.000000001'),
            forwardPayload: commentPayload,
            queryId: uniqueQueryId
          });
          
          tx = {
            validUntil: Math.floor(Date.now() / 1000) + 300,
            messages: [
              {
                address: USDT_ADDRESS,
                amount: GasAmounts.JETTON_TRANSFER_STANDARD.toString(),
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
        let errorMsg = error.message;
        
        // Yaygın hata mesajlarını daha anlaşılır hale getir
        if (errorMsg.includes('unable to verify transaction')) {
          errorMsg = 'Unable to verify transaction. This could be due to insufficient TON balance or an issue with the transaction structure.';
          
          // Daha fazla debug bilgisi ekle
          console.error('Debug info for "unable to verify transaction" error:');
          console.error('- Token type:', tokenType);
          console.error('- Transfer method:', transferMethod);
          console.error('- Amount:', amount);
          console.error('- Destination address:', address);
          console.error('- USDT address being used:', USDT_ADDRESS);
          console.error('- Central wallet address:', CENTRAL_WALLET_ADDRESS);
          console.error('- Gas amount used:', 
            transferMethod === 'standard' ? GasAmounts.JETTON_TRANSFER_STANDARD.toString() :
            transferMethod === 'simplified' ? GasAmounts.JETTON_TRANSFER_SIMPLIFIED.toString() :
            GasAmounts.JETTON_TRANSFER_ALTERNATIVE.toString()
          );
          
          // Kullanıcıya öneriler sun
          errorMsg += ' Try the following solutions:\n';
          errorMsg += '1. Make sure you have enough TON to cover transaction fees\n';
          errorMsg += '2. Try a different transfer method (simplified or alternative)\n';
          errorMsg += '3. Check that the recipient address is correct\n';
          errorMsg += '4. Wait a few minutes and try again';
        } else if (errorMsg.includes('insufficient funds')) {
          errorMsg = 'Insufficient funds. Please make sure you have enough TON to cover the transaction fees.';
        } else if (errorMsg.includes('invalid address')) {
          errorMsg = 'Invalid address. Please check the recipient address format.';
        } else if (errorMsg.includes('rejected')) {
          errorMsg = 'Transaction rejected by wallet. Please try again or use a different transfer method.';
        }
        
        setErrorMessage(errorMsg);
        setTxStatus('error');
      } else {
        console.error('Unknown error type:', typeof error);
        setErrorMessage('Unknown error occurred. Please check the console for more details.');
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
    
    const formattedAmount = formatAmount(amount, tokenType);
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
