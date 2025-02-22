import React, { useEffect, useState } from 'react';
import './style.scss';

interface PaymentRecord {
  payment_data: {
    amount: string;
    address: string;
    payment_id: string;
    productName: string;
  };
  transaction_data?: {
    boc: string;
    timestamp: number;
  };
}

export function PaymentDataPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    // Local storage'dan ödemeleri yükle
    const storedPayments = localStorage.getItem('ton_payments');
    if (storedPayments) {
      setPayments(JSON.parse(storedPayments));
    }
  }, []);

  // JSON formatında veriyi döndür
  useEffect(() => {
    // Content-Type'ı application/json yap
    document.querySelector('head')?.insertAdjacentHTML(
      'beforeend',
      '<meta http-equiv="Content-Type" content="application/json; charset=utf-8">'
    );

    // Sayfayı JSON olarak render et
    document.body.textContent = JSON.stringify(payments, null, 2);
  }, [payments]);

  // Artık UI render etmemize gerek yok
  return null;
} 