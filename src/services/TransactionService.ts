import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

const TON_API_KEY = import.meta.env.VITE_TON_API_KEY;
const TON_API_URL = 'https://toncenter.com/api/v2'; // Mainnet için toncenter.com kullanıyoruz

interface TransactionData {
  boc: string;
  payment_id: string;
  amount: string;
  address: string;
}

class TransactionService {
  private static instance: TransactionService;
  private transactions: Map<string, TransactionData> = new Map();

  private constructor() {
    // Singleton
  }

  static getInstance(): TransactionService {
    if (!TransactionService.instance) {
      TransactionService.instance = new TransactionService();
    }
    return TransactionService.instance;
  }

  // Transaction'ı kaydet
  async saveTransaction(data: TransactionData) {
    this.transactions.set(data.boc, data);
    
    try {
      // Pending durumunda kaydet
      const { error } = await supabase
        .from('transactions')
        .insert({
          transaction_hash: data.boc,
          payment_id: data.payment_id,
          amount: data.amount,
          address: data.address,
          status: 'pending',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

    } catch (error) {
      console.error('Transaction kaydedilirken hata:', error);
      throw error;
    }
  }

  // Transaction durumunu kontrol et
  async checkTransactionStatus(boc: string): Promise<'pending' | 'completed' | 'failed'> {
    try {
      const txData = this.transactions.get(boc);
      if (!txData) {
        throw new Error('Transaction verisi bulunamadı');
      }

      // TON API'den transaction bilgilerini al
      const response = await fetch(`${TON_API_URL}/transactions/${boc}`, {
        headers: {
          'X-API-Key': TON_API_KEY
        }
      });
      const data = await response.json();

      if (data.ok && data.result) {
        const tx = data.result;
        
        // Transaction amount kontrolü
        const txAmount = tx.in_msg?.value || '0'; // TON API'den gelen amount
        const expectedAmount = txData.amount;

        // Amount kontrolü (tam eşleşme olmalı)
        if (txAmount !== expectedAmount) {
          console.error('Amount uyuşmazlığı:', {
            expected: expectedAmount,
            received: txAmount
          });
          await this.updateTransactionStatus(boc, 'failed', 'Amount uyuşmazlığı');
          return 'failed';
        }

        // Alıcı adres kontrolü
        const recipient = tx.in_msg?.destination;
        if (recipient !== txData.address) {
          console.error('Adres uyuşmazlığı:', {
            expected: txData.address,
            received: recipient
          });
          await this.updateTransactionStatus(boc, 'failed', 'Adres uyuşmazlığı');
          return 'failed';
        }

        // Tüm kontroller başarılı
        await this.updateTransactionStatus(boc, 'completed');
        return 'completed';
      } else {
        // Transaction bulunamadı veya hatalı
        await this.updateTransactionStatus(boc, 'failed', 'Transaction bulunamadı');
        return 'failed';
      }

    } catch (error) {
      console.error('Transaction durumu kontrol edilirken hata:', error);
      return 'pending'; // Hata durumunda pending döndür, tekrar denenebilir
    }
  }

  // Transaction durumunu güncelle
  private async updateTransactionStatus(boc: string, status: 'completed' | 'failed', failReason?: string) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: status,
          updated_at: new Date().toISOString(),
          fail_reason: failReason // Hata sebebini de kaydedelim
        })
        .eq('transaction_hash', boc);

      if (error) throw error;

      // Eğer completed ise orders tablosunu da güncelle
      if (status === 'completed') {
        const txData = this.transactions.get(boc);
        if (txData) {
          await supabase
            .from('orders')
            .update({
              status: 'completed',
              transaction_hash: boc,
              updated_at: new Date().toISOString()
            })
            .eq('payment_id', txData.payment_id);
        }
      }

    } catch (error) {
      console.error('Transaction durumu güncellenirken hata:', error);
      throw error;
    }
  }
}

export const transactionService = TransactionService.getInstance(); 