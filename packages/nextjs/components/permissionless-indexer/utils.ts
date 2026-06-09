import { formatUnits, parseUnits } from "viem";

export const USDC_DECIMALS = 6;
export const INDEXER_ADDRESS = "0x927247a3CD0a880475a617Bf01AE7F615151087c";
export const MIN_BASE_STAKE_USDC = 5;

export const formatUsdc = (value?: bigint | number): string => {
  if (value === undefined || value === null) return "0";
  return formatUnits(BigInt(value), USDC_DECIMALS);
};

export const parseUsdc = (value: string): bigint => {
  if (!value || isNaN(Number(value))) return 0n;
  return parseUnits(value, USDC_DECIMALS);
};

export const truncateHex = (value?: string, lead = 6, trail = 4): string => {
  if (!value) return "";
  if (value.length <= lead + trail) return value;
  return `${value.slice(0, lead)}…${value.slice(-trail)}`;
};

export const isHex32 = (value: string): boolean => /^0x[0-9a-fA-F]{64}$/.test(value.trim());

export const DISPUTE_STATUS_LABELS: Record<number, string> = {
  0: "open",
  1: "indexerWon",
  2: "disputerWon",
  3: "defaulted",
};
