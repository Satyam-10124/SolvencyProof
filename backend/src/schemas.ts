export type LiabilitiesRow = {
  user_id: string;
  balance: string;
};

export type ReservesFile = string[];

export type EpochFile = {
  epoch_id: string;
  timestamp: number;
};
