import { Address, beginCell, Cell, toNano } from "@ton/core";

// USDT Jetton address on TON (bounceable format)
export const USDT_ADDRESS = 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA';

// USDT Jetton address on TON (non-bounceable format)
export const USDT_ADDRESS_NON_BOUNCEABLE = 'UQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwivg';

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
  forwardAmount = toNano('0.000000001'), // Exactly 1 nanoton for notification as per TON standards
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
  
  // Ensure forwardAmount is exactly 1 nanoton as per TON standards
  const standardForwardAmount = toNano('0.000000001');
  
  let transferMessage = beginCell()
    .storeUint(JettonOps.TRANSFER, 32) // op::transfer
    .storeUint(queryId, 64) // query_id
    .storeCoins(amount) // amount
    .storeAddress(toAddress) // destination
    .storeAddress(responseAddress) // response_destination
    .storeUint(0, 1) // no custom payload
    .storeCoins(standardForwardAmount); // forward_ton_amount - exactly 1 nanoton
  
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

  // Ensure forward amount is exactly 1 nanoton as per TON standards
  const standardForwardAmount = toNano('0.000000001');
  
  // Generate a unique query ID for this transaction
  const uniqueQueryId = Math.floor(Math.random() * 2**32);
  console.log(`Creating simplified Jetton transfer with queryId: ${uniqueQueryId}`);

  return {
    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    messages: [
      {
        address: jettonMasterAddress,
        amount: attachedAmount.toString(),
        stateInit: undefined,
        payload: beginCell()
          .storeUint(JettonOps.TRANSFER, 32) // op::transfer
          .storeUint(uniqueQueryId, 64) // random query_id
          .storeCoins(amount) // amount
          .storeAddress(Address.parse(toAddress)) // destination
          .storeAddress(Address.parse(fromAddress)) // response_destination
          .storeUint(0, 1) // no custom payload
          .storeCoins(standardForwardAmount) // forward_ton_amount - exactly 1 nanoton
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

  // Generate a unique query ID for this transaction
  const uniqueQueryId = Math.floor(Math.random() * 2**32);
  console.log(`Creating alternative Jetton transfer with queryId: ${uniqueQueryId}`);

  // According to TON standards, we should use the JettonOps.TRANSFER opcode
  // and follow the standard Jetton transfer message structure
  return {
    validUntil: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    messages: [
      {
        address: jettonWalletAddress,
        amount: attachedAmount.toString(),
        payload: beginCell()
          .storeUint(JettonOps.TRANSFER, 32) // op::transfer
          .storeUint(uniqueQueryId, 64) // query_id
          .storeCoins(amount) // amount
          .storeAddress(Address.parse(toAddress)) // destination
          .storeAddress(Address.parse(fromAddress)) // response_destination
          .storeUint(0, 1) // no custom payload
          .storeCoins(toNano('0.000000001')) // forward_ton_amount - exactly 1 nanoton
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
 * Calculates the standard Jetton wallet address for a given owner and Jetton master
 * This implementation follows the standard Jetton wallet address calculation
 * 
 * @param ownerAddress Owner wallet address
 * @param jettonMasterAddress Jetton master contract address
 * @returns Predicted Jetton wallet address
 */
export function predictJettonWalletAddress(
  ownerAddress: Address,
  jettonMasterAddress: Address
): Address {
  // According to TON documentation, the Jetton wallet address is calculated
  // by creating a StateInit with the owner and master addresses
  
  // Create data cell with owner and master addresses
  const data = beginCell()
    .storeCoins(0) // balance (not important for address calculation)
    .storeAddress(ownerAddress) // owner_address
    .storeAddress(jettonMasterAddress) // jetton_master_address
    .storeUint(0, 1) // lock
    .endCell();
  
  // In a real implementation, we would need to get the Jetton wallet code
  // from the Jetton master contract. For now, we'll use a placeholder.
  // This is a simplified version and might not work for all Jetton implementations.
  
  // Standard Jetton wallet code hash for USDT on TON
  // This is a placeholder and should be replaced with the actual code hash
  const codeHash = Buffer.from('84dafa449f98a6987789ba232358072bc0f76dc4524002a5d0918b9a75d2d599', 'hex');
  
  // Create a state init cell with the code hash and data
  const stateInit = beginCell()
    .storeUint(0, 2) // split_depth:0 special:0
    .storeBit(1) // code present
    .storeRef(beginCell().storeBuffer(codeHash).endCell()) // code reference
    .storeBit(1) // data present
    .storeRef(data) // data reference
    .storeBit(0) // no libraries
    .endCell();
  
  // Calculate the hash of the state init
  const stateInitHash = stateInit.hash();
  
  // Create address from state init hash (workchain 0 for mainnet)
  return new Address(0, stateInitHash);
}

/**
 * Formats an amount from nanotons to a human-readable format
 * 
 * @param amount Amount in nanotons
 * @param decimals Number of decimals (9 for TON, 6 for USDT)
 * @returns Formatted amount string
 */
export function formatAmount(amount: string | number | bigint, tokenType: 'TON' | 'USDT' = 'TON'): string {
  const decimals = tokenType === 'USDT' ? USDT_DECIMALS : 9;
  
  const amountNum = typeof amount === 'bigint' 
    ? Number(amount) / Math.pow(10, decimals)
    : Number(amount) / Math.pow(10, decimals);
  
  return amountNum.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  });
} 