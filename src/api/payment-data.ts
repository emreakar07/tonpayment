import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS header'larını ekle
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const payments = localStorage.getItem('ton_payments') || '[]';
  res.status(200).json(JSON.parse(payments));
} 