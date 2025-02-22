import React, { useEffect } from 'react';

export function PaymentDataEndpoint() {
  useEffect(() => {
    // Content type'ı ayarla
    document.querySelector('head')?.insertAdjacentHTML(
      'beforeend',
      '<meta http-equiv="Content-Type" content="application/json; charset=utf-8">'
    );

    // Sayfayı JSON olarak render et
    const payments = localStorage.getItem('ton_payments') || '[]';
    document.body.textContent = payments;
  }, []);

  return null;
} 