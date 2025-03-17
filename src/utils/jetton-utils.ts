import { Address, beginCell, Cell, toNano } from "@ton/core";

// USDT Jetton address on TON
export const USDT_ADDRESS = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

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
  queryId = 0
}: {
  amount: bigint;
  toAddress: Address;
  responseAddress: Address;
  forwardAmount?: bigint;
  forwardPayload?: Cell | null;
  queryId?: number;
}): Cell {
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