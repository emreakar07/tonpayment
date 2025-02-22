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

  return (
    <div className="payment-data-page">
      <h1>Payment Records</h1>
      <div className="records-container">
        {payments.map((record, index) => (
          <div key={index} className="payment-record">
            <pre>{JSON.stringify(record, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
} 