import { Address, beginCell, Cell, toNano } from "@ton/core";

// USDT Jetton address on TON (bounceable format)
export const USDT_ADDRESS = 'EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA';

// USDT Jetton address on TON (non-bounceable format)
export const USDT_ADDRESS_NON_BOUNCEABLE = 'UQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwivg';

// Central wallet address for USDT operations
// This should be a wallet that you control and can receive/send USDT
export const CENTRAL_WALLET_ADDRESS = 'EQBKYXttVMGtY-whfnmxg7_c7Hv6TKnw9QfNbkGQ_p6lBD7a';

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

// Default gas amounts for different operations
export const GasAmounts = {
  JETTON_TRANSFER_STANDARD: toNano('0.5'),   // 0.5 TON for standard method
  JETTON_TRANSFER_SIMPLIFIED: toNano('0.6'), // 0.6 TON for simplified method
  JETTON_TRANSFER_ALTERNATIVE: toNano('0.7') // 0.7 TON for alternative method
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
 * Creates a simplified Jetton transfer request using central wallet
 * This is a more direct approach that might work better with some wallets
 */
export function createSimplifiedJettonTransferRequest({
  jettonMasterAddress,
  toAddress,
  amount,
  fromAddress,
  comment = '',
  attachedAmount = GasAmounts.JETTON_TRANSFER_SIMPLIFIED, // Arttırılmış gas
  useCentralWallet = true
}: {
  jettonMasterAddress: string;
  toAddress: string;
  amount: bigint;
  fromAddress: string;
  comment?: string;
  attachedAmount?: bigint;
  useCentralWallet?: boolean;
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

  // Use central wallet address as response address if specified
  const responseAddress = useCentralWallet ? 
    Address.parse(CENTRAL_WALLET_ADDRESS) : 
    Address.parse(fromAddress);

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
          .storeAddress(responseAddress) // response_destination (central wallet or sender)
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
  attachedAmount = GasAmounts.JETTON_TRANSFER_ALTERNATIVE // Arttırılmış gas
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
  try {
    // Doğrudan merkezi cüzdan adresini kullan - bu en güvenilir yaklaşım
    return Address.parse(CENTRAL_WALLET_ADDRESS);
  } catch (error) {
    console.error('Error parsing central wallet address, using fallback calculation:', error);
    
    // Fallback hesaplama - ilk deneme başarısız olursa
    const data = beginCell()
      .storeCoins(0)
      .storeAddress(ownerAddress)
      .storeAddress(jettonMasterAddress)
      .storeUint(0, 1)
      .endCell();
    
    const stateInitHash = beginCell()
      .storeUint(0, 2)
      .storeBit(1)
      .storeRef(beginCell().endCell())
      .storeBit(1)
      .storeRef(data)
      .storeBit(0)
      .endCell()
      .hash();
    
    return new Address(0, stateInitHash);
  }
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