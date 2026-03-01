// Charges configuration for Indian stock market
// All percentage values are expressed as decimals (e.g., 0.001 = 0.1%)

export const CHARGES = {
  // Brokerage — flat per executed order
  brokerage: {
    equity: {
      mis: 20,    // ₹20 per executed order or 0.03% whichever is lower
      cnf: 20,    // ₹20 per executed order or 0.1% whichever is lower
    },
    fno: 20,      // ₹20 per executed order
    cd: 20,
    mcx: 20,
  },

  // STT (Securities Transaction Tax) — percentage of trade value
  stt: {
    equity: {
      buy: 0,           // No STT on intraday buy
      sell: 0.00025,    // 0.025% on sell side
      cnfBuy: 0.001,    // 0.1% on CNC/delivery buy
      cnfSell: 0.001,   // 0.1% on CNC/delivery sell
    },
    fnoFutures: {
      buy: 0,
      sell: 0.000125,   // 0.0125% on sell
    },
    fnoOptions: {
      buy: 0,
      sell: 0.000625,   // 0.0625% on sell (on premium)
    },
  },

  // GST — 18% on (brokerage + exchange fees + SEBI charges)
  gst: 0.18,

  // Exchange transaction charges — percentage of trade value
  exchangeFees: {
    nse: 0.0000297,
    bse: 0.0000297,
    nfo: 0.0000495,
    cds: 0.0000011,
    mcx: 0.0000260,
  },

  // SEBI turnover charge — percentage of trade value
  sebi: 0.000001,

  // Stamp duty — percentage of trade value (buy side only)
  stampDuty: {
    equity: 0.00015,
    fnoFutures: 0.00002,
    fnoOptions: 0.00003,
    cd: 0.00001,
    mcx: 0.00002,
  },
} as const;

/**
 * Calculate total charges for a trade.
 * Returns the total charges amount in INR.
 */
export function calculateCharges(params: {
  segment: string;
  instrumentType: string;
  side: string;
  product: string;
  quantity: number;
  price: number;
  exchange: string;
}): number {
  const { segment, instrumentType, side, product, quantity, price, exchange } = params;
  const value = quantity * price;

  let brokerage = 0;
  let stt = 0;
  let exchangeFee = 0;
  let stampDuty = 0;

  // Brokerage
  if (segment === "equity") {
    const maxBrokerage = product === "cnf" ? value * 0.001 : value * 0.0003;
    brokerage = Math.min(CHARGES.brokerage.equity[product === "cnf" ? "cnf" : "mis"], maxBrokerage);
  } else {
    brokerage = CHARGES.brokerage[segment as keyof typeof CHARGES.brokerage] as number || 20;
  }

  // STT
  if (segment === "equity") {
    if (product === "cnf") {
      stt = side === "buy" ? value * CHARGES.stt.equity.cnfBuy : value * CHARGES.stt.equity.cnfSell;
    } else {
      stt = side === "sell" ? value * CHARGES.stt.equity.sell : 0;
    }
  } else if (segment === "fno") {
    if (instrumentType === "FUT") {
      stt = side === "sell" ? value * CHARGES.stt.fnoFutures.sell : 0;
    } else {
      stt = side === "sell" ? value * CHARGES.stt.fnoOptions.sell : 0;
    }
  }

  // Exchange fees
  const exchangeKey = exchange.toLowerCase() as keyof typeof CHARGES.exchangeFees;
  const feeRate = CHARGES.exchangeFees[exchangeKey] || CHARGES.exchangeFees.nse;
  exchangeFee = value * feeRate;

  // SEBI
  const sebiCharge = value * CHARGES.sebi;

  // Stamp duty (buy side only)
  if (side === "buy") {
    if (segment === "equity") {
      stampDuty = value * CHARGES.stampDuty.equity;
    } else if (segment === "fno") {
      stampDuty = instrumentType === "FUT"
        ? value * CHARGES.stampDuty.fnoFutures
        : value * CHARGES.stampDuty.fnoOptions;
    } else if (segment === "mcx") {
      stampDuty = value * CHARGES.stampDuty.mcx;
    } else if (segment === "cd") {
      stampDuty = value * CHARGES.stampDuty.cd;
    }
  }

  // GST on (brokerage + exchange fees + SEBI)
  const gst = (brokerage + exchangeFee + sebiCharge) * CHARGES.gst;

  const total = brokerage + stt + exchangeFee + sebiCharge + stampDuty + gst;
  return Math.round(total * 10000) / 10000; // Round to 4 decimal places
}
