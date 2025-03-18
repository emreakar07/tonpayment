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