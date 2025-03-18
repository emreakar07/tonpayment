import { Address, beginCell, Cell, toNano } from "@ton/core";

// USDT Jetton address on TON (bounceable format)
export const USDT_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

// USDT Jetton address on TON (non-bounceable format)
export const USDT_ADDRESS_NON_BOUNCEABLE = 'UQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDY';

// USDT has 6 decimals, unlike most Jettons which have 9
export const USDT_DECIMALS = 6;

// Jetton operation codes
export const JettonOps = {
  TRANSFER: 0xf8a7ea5,
  TRANSFER_NOTIFICATION: 0x7362d09c,
  INTERNAL_TRANSFER: 0x178d4519,
  EXCESSES: 0xd53276db,
  BURN: 0x595f07bc,
  BURN_NOTIFICATION: 0x7bdd97de
};

/**
 * Creates a simple TON transfer message
 * 
 * @param params Transfer parameters
 * @returns Cell with the transfer message
 */
export function createTonTransferMessage({
  toAddress,
  amount,
  comment = ''
}: {
  toAddress: Address;
  amount: bigint;
  comment?: string;
}): Cell {
  const message = beginCell()
    .storeUint(0x18, 6) // external message info
    .storeAddress(toAddress)
    .storeCoins(amount)
    .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1);
  
  if (comment) {
    message.storeRef(
      beginCell()
        .storeUint(0, 32) // comment prefix
        .storeBuffer(Buffer.from(comment))
        .endCell()
    );
  }
  
  return message.endCell();
}

/**
 * Creates a Jetton transfer message
 * 
 * @param params Transfer parameters
 * @returns Cell with the transfer message
 */
export function createJettonTransferMessage({
  amount,
  toAddress,
  responseAddress,
  forwardAmount = toNano('0.000000001'), // 1 nanoton for notification
  forwardPayload = null,
  queryId = Math.floor(Math.random() * 2**64) // Completely random queryId
}: {
  amount: bigint;
  toAddress: Address;
  responseAddress: Address;
  forwardAmount?: bigint;
  forwardPayload?: Cell | null;
  queryId?: number | bigint;
}): Cell {
  console.log(`Creating Jetton transfer with queryId: ${queryId}`);
  
  let transferMessage = beginCell()
    .storeUint(JettonOps.TRANSFER, 32) // op::transfer
    .storeUint(queryId, 64) // query_id
    .storeCoins(amount) // amount
    .storeAddress(toAddress) // destination
    .storeAddress(responseAddress) // response_destination
    .storeUint(0, 1) // no custom payload
    .storeCoins(forwardAmount); // forward_ton_amount
  
  if (forwardPayload) {
    transferMessage.storeUint(1, 1); // has forward payload
    transferMessage.storeRef(forwardPayload);
  } else {
    transferMessage.storeUint(0, 1); // no forward payload
  }
  
  return transferMessage.endCell();
}

/**
 * Creates a comment payload for Jetton transfers
 * 
 * @param comment Text comment
 * @returns Cell with the comment
 */
export function createCommentPayload(comment: string): Cell {
  return beginCell()
    .storeUint(0, 32) // prefix for comment
    .storeBuffer(Buffer.from(comment))
    .endCell();
}

/**
 * Creates a simplified Jetton transfer request
 * This is a more direct approach that might work better with some wallets
 */
export function createSimplifiedJettonTransferRequest({
  jettonMasterAddress,
  toAddress,
  amount,
  fromAddress,
  comment = '',
  attachedAmount = toNano('0.15')
}: {
  jettonMasterAddress: string;
  toAddress: string;
  amount: bigint;
  fromAddress: string;
  comment?: string;
  attachedAmount?: bigint;
}) {
  // Create a simple transfer request
  const commentCell = comment ? 
    beginCell()
      .storeUint(0, 32) // comment prefix
      .storeBuffer(Buffer.from(comment))
      .endCell() 
    : beginCell().endCell();

  return {
    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    messages: [
      {
        address: jettonMasterAddress,
        amount: attachedAmount.toString(),
        stateInit: undefined,
        payload: beginCell()
          .storeUint(JettonOps.TRANSFER, 32) // op::transfer
          .storeUint(Math.floor(Math.random() * 2**32), 64) // random query_id
          .storeCoins(amount) // amount
          .storeAddress(Address.parse(toAddress)) // destination
          .storeAddress(Address.parse(fromAddress)) // response_destination
          .storeUint(0, 1) // no custom payload
          .storeCoins(toNano('0.000000001')) // forward_ton_amount (1 nanoton)
          .storeUint(comment ? 1 : 0, 1) // has forward payload?
          .storeRef(commentCell)
          .endCell()
          .toBoc()
          .toString('base64')
      }
    ]
  };
}

/**
 * Alternative approach to create a Jetton transfer
 * This uses a different message structure that might work better with some wallets
 */
export function createAlternativeJettonTransferRequest({
  jettonWalletAddress,
  toAddress,
  amount,
  fromAddress,
  comment = '',
  attachedAmount = toNano('0.15')
}: {
  jettonWalletAddress: string;
  toAddress: string;
  amount: bigint;
  fromAddress: string;
  comment?: string;
  attachedAmount?: bigint;
}) {
  // Create a transfer request directly to the jetton wallet
  const commentCell = comment ? 
    beginCell()
      .storeUint(0, 32) // comment prefix
      .storeBuffer(Buffer.from(comment))
      .endCell() 
    : beginCell().endCell();

  return {
    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    messages: [
      {
        address: jettonWalletAddress,
        amount: attachedAmount.toString(),
        payload: beginCell()
          .storeUint(0x18, 6) // external message info
          .storeAddress(Address.parse(toAddress))
          .storeCoins(amount)
          .storeUint(0, 1 + 4 + 4 + 64 + 32 + 1 + 1)
          .storeRef(commentCell)
          .endCell()
          .toBoc()
          .toString('base64')
      }
    ]
  };
}

/**
 * Calculates the standard Jetton wallet address for a given owner and Jetton master
 * Note: This is a simplified version and might not work for all Jetton implementations
 * 
 * @param ownerAddress Owner wallet address
 * @param jettonMasterAddress Jetton master contract address
 * @returns Predicted Jetton wallet address
 */
export function predictJettonWalletAddress(
  ownerAddress: Address,
  jettonMasterAddress: Address
): string {
  // This is a simplified implementation
  // In a production app, you should query the Jetton master contract
  // or use an indexer to get the actual Jetton wallet address
  
  // For demonstration purposes only
  return `Predicted Jetton wallet for ${ownerAddress.toString()} and ${jettonMasterAddress.toString()}`;
}

/**
 * Formats an amount from nanotons to a human-readable format
 * 
 * @param amount Amount in nanotons
 * @param decimals Number of decimals (9 for TON and most Jettons)
 * @returns Formatted amount string
 */
export function formatAmount(amount: string | number | bigint, decimals: number = 9): string {
  const amountNum = typeof amount === 'bigint' 
    ? Number(amount) / Math.pow(10, decimals)
    : Number(amount) / Math.pow(10, decimals);
  
  return amountNum.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
} 