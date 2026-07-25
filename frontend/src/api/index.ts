import request from './request';
import type { User, Medicine, StockRecord, Unit } from '../types';

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

export async function createMedicine(data: { name: string; stock: number; perBox: number; dailyDosage: number; unit: string }) {
  return request.post<unknown, ApiResp<Medicine>>('/medicines', data);
}

export async function updateMedicine(
  id: number,
  data: { name: string; stock: number; perBox: number; dailyDosage: number; unit: string }
) {
  return request.put<unknown, ApiResp<Medicine>>(`/medicines/${id}`, data);
}

export async function deleteMedicine(id: number) {
  return request.delete<unknown, ApiResp<void>>(`/medicines/${id}`);
}

export async function moveMedicine(id: number, direction: 'up' | 'down') {
  return request.post<unknown, ApiResp<void>>(`/medicines/${id}/move`, { direction });
}

export async function getStockRecords(limit = 50, offset = 0) {
  return request.get<unknown, ApiResp<{ list: StockRecord[]; total: number }>>(
    `/stock-records?limit=${limit}&offset=${offset}`
  );
}

export async function backfillStock(days = 30) {
  return request.post<unknown, ApiResp<{ backfilledCount: number; days: number }>>('/stock-records/backfill', { days });
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
