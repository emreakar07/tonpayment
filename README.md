# TON Payment Application

A simple application for processing payments on the TON blockchain, supporting both native TON and USDT transfers.

## Features

- Connect to TON wallets using TonConnect
- Process native TON payments
- Process USDT token payments
- Integration with Telegram Mini Apps

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Yarn or npm

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/ton-payment.git
cd ton-payment
```

2. Install dependencies
```bash
yarn install
# or
npm install
```

3. Start the development server
```bash
yarn dev
# or
npm run dev
```

## Usage

### Payment URL Format

The application accepts payment data in the URL as a base64-encoded JSON string:

```
https://your-app-url/?payment_data=BASE64_ENCODED_JSON
```

The JSON should have the following format:

```json
{
  "amount": "10.5",
  "address": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  "payment_id": "12345",
  "productName": "Product Name",
  "token_type": "TON"
}
```

Parameters:
- `amount`: Payment amount (in TON or USDT)
- `address`: Recipient wallet address
- `payment_id`: Unique payment identifier
- `productName`: Name of the product or service
- `token_type`: Type of token to use for payment ("TON" or "USDT")

### Making a TON Payment

1. Open the application with the payment data in the URL
2. Connect your TON wallet using the TonConnect button
3. Select "TON" as the token type
4. Click "Send TON" to initiate the transaction
5. Confirm the transaction in your wallet

### Making a USDT Payment

1. Open the application with the payment data in the URL
2. Connect your TON wallet using the TonConnect button
3. Select "USDT" as the token type
4. Click "Send USDT" to initiate the transaction
5. Confirm the transaction in your wallet

## Telegram Mini App Integration

The application is designed to work as a Telegram Mini App. When used within Telegram:

1. The application will automatically send the transaction result back to the bot
2. The Telegram MainButton will show the transaction status

## Technical Details

### USDT on TON

USDT on TON is implemented as a Jetton (TON's equivalent of tokens like ERC-20 on Ethereum). The official USDT contract address on TON is:

```
EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs
```

### Jetton Transfers

Jetton transfers on TON require:

1. Creating a transfer message with the correct operation code (0xf8a7ea5)
2. Sending the message to the Jetton master contract
3. Including sufficient TON for fees (typically 0.05 TON)
4. Setting a small forward amount (1 nanoton) for notification messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.
