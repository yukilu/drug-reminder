export interface User {
  id: number;
  username: string;
  createdAt?: string;
  stopBackfillDate?: string | null;
}

export interface Medicine {
  id: number;
  name: string;
  stock: number;
  perBox: number;
  dailyDosage: number;
  unit: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockRecord {
  id: number;
  medicineId: number;
  medicineName: string;
  beforeStock: number;
  afterStock: number;
  changeAmount: number;
  recordDate: string;
  source: string;
  createdAt: string;
}

export interface Unit {
  id: number;
  name: string;
  sort: number;
  createdAt: string;
}
