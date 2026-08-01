import request from './request';
import type { User, Medicine, StockRecord, Unit, HospitalVisit } from '../types';

interface ApiResp<T = unknown> {
  code: number;
  message?: string;
  data?: T;
}

export async function login(username: string, password: string) {
  return request.post<unknown, ApiResp<{ token: string; user: User }>>('/auth/login', { username, password });
}

export async function register(username: string, password: string) {
  return request.post<unknown, ApiResp<{ token: string; user: User }>>('/auth/register', { username, password });
}

export async function getMe() {
  return request.get<unknown, ApiResp<User>>('/auth/me');
}

export async function changePassword(oldPassword: string, newPassword: string) {
  return request.post<unknown, ApiResp<void>>('/auth/change-password', { oldPassword, newPassword });
}

export async function updateStopBackfillDate(date: string | null) {
  return request.put<unknown, ApiResp<{ stopBackfillDate: string | null }>>('/auth/stop-backfill-date', { date });
}

export async function getMedicines() {
  return request.get<unknown, ApiResp<Medicine[]>>('/medicines');
}

export async function createMedicine(data: {
  name: string;
  stock: number;
  perBox: number;
  dailyDosage: number;
  unit: string;
  cycle: 'daily' | 'weekly';
}) {
  return request.post<unknown, ApiResp<Medicine>>('/medicines', data);
}

export async function updateMedicine(
  id: number,
  data: {
    name: string;
    stock: number;
    perBox: number;
    dailyDosage: number;
    unit: string;
    cycle: 'daily' | 'weekly';
  }
) {
  return request.put<unknown, ApiResp<Medicine>>(`/medicines/${id}`, data);
}

export async function deleteMedicine(id: number) {
  return request.delete<unknown, ApiResp<void>>(`/medicines/${id}`);
}

export async function moveMedicine(id: number, direction: 'up' | 'down') {
  return request.post<unknown, ApiResp<void>>(`/medicines/${id}/move`, { direction });
}

export async function getStockRecords(page = 1, size = 20) {
  return request.get<unknown, ApiResp<{ list: StockRecord[]; total: number; page: number; size: number }>>(
    `/stock-records?page=${page}&size=${size}`
  );
}

export async function getManualStockRecords(page = 1, size = 20) {
  return request.get<unknown, ApiResp<{ list: StockRecord[]; total: number; page: number; size: number }>>(
    `/stock-records/manual?page=${page}&size=${size}`
  );
}

export async function createManualStockUpdate(medicineId: number, quantityBoxes: number) {
  return request.post<unknown, ApiResp<{
    id: number; beforeStock: number; afterStock: number; changeAmount: number; changeBoxes: number;
  }>>('/stock-records/manual', { medicineId, quantityBoxes });
}

export async function backfillStock(days = 30) {
  return request.post<unknown, ApiResp<{ backfilledCount: number; days: number; weeks?: number }>>('/stock-records/backfill', { days });
}

export async function getUnits() {
  return request.get<unknown, ApiResp<Unit[]>>('/units');
}

export async function createUnit(name: string) {
  return request.post<unknown, ApiResp<Unit>>('/units', { name });
}

export async function updateUnit(id: number, name: string) {
  return request.put<unknown, ApiResp<Unit>>(`/units/${id}`, { name });
}

export async function deleteUnit(id: number) {
  return request.delete<unknown, ApiResp<void>>(`/units/${id}`);
}

export async function moveUnit(id: number, direction: 'up' | 'down') {
  return request.post<unknown, ApiResp<void>>(`/units/${id}/move`, { direction });
}

export async function getHospitalVisits() {
  return request.get<unknown, ApiResp<HospitalVisit[]>>('/hospital-visits');
}

export async function getNextCycleDays() {
  return request.get<unknown, ApiResp<{ days: number | null; next1: string | null; next2: string | null }>>(
    '/hospital-visits/next-cycle-days'
  );
}

export async function createHospitalVisit(visitDate: string) {
  return request.post<unknown, ApiResp<HospitalVisit>>('/hospital-visits', { visitDate });
}

export async function deleteHospitalVisit(id: number) {
  return request.delete<unknown, ApiResp<void>>(`/hospital-visits/${id}`);
}

