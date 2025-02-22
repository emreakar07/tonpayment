import React from 'react';

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

// Örnek veri
const SAMPLE_DATA: PaymentRecord[] = [
  {
    payment_data: {
      amount: "0",
      address: "EQBvW8Z5huBkMJYdnfAEM5JqTNkuWX3diqYENkWsIL0XggGG",
      payment_id: "test123",
      productName: "Test Product"
    }
  }
];

export function PaymentDataPage() {
  // Direkt JSON olarak render et
  return (
    <pre style={{ margin: 0, padding: 20 }}>
      {JSON.stringify(SAMPLE_DATA, null, 2)}
    </pre>
  );
} 