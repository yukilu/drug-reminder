import { useState, useEffect } from 'react';
import Modal from './Modal';
import type { Medicine, Unit } from '../types';
import { getUnits } from '../api';

interface Props {
  visible: boolean;
  mode: 'add' | 'edit';
  medicine?: Medicine | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    stock: number;
    perBox: number;
    dailyDosage: number;
    unit: string;
    cycle: 'daily' | 'weekly';
  }) => Promise<void> | void;
  onDelete?: () => void;
}

export default function MedicineForm({ visible, mode, medicine, onClose, onSubmit, onDelete }: Props) {
  const [name, setName] = useState('');
  const [stock, setStock] = useState('0');
  const [perBox, setPerBox] = useState('0');
  const [dailyDosage, setDailyDosage] = useState('0');
  const [unit, setUnit] = useState('片');
  const [cycle, setCycle] = useState<'daily' | 'weekly'>('daily');
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    getUnits().then((resp) => {
      if (resp.code === 0 && resp.data) {
        setUnits(resp.data);
        if (resp.data.length > 0) {
          if (mode === 'edit' && medicine?.unit) {
            const found = resp.data.find((u) => u.name === medicine.unit);
            if (!found) setUnit(resp.data[0].name);
          }
        }
      }
    });
  }, [visible, mode, medicine]);

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && medicine) {
        setName(medicine.name);
        setStock(String(medicine.stock));
        setPerBox(String(medicine.perBox));
        setDailyDosage(String(medicine.dailyDosage));
        setUnit(medicine.unit || '片');
        setCycle(medicine.cycle === 'weekly' ? 'weekly' : 'daily');
      } else {
        setName('');
        setStock('0');
        setPerBox('0');
        setDailyDosage('0');
        setUnit('片');
        setCycle('daily');
      }
    }
  }, [visible, mode, medicine]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('请输入药品名称');
      return;
    }
    const s = Number(stock) || 0;
    const p = Number(perBox) || 0;
    const d = Number(dailyDosage) || 0;
    if (s < 0 || p < 0 || d < 0) {
      alert('数量不能为负数');
      return;
    }
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), stock: s, perBox: p, dailyDosage: d, unit, cycle });
      onClose();
    } catch (e: any) {
      alert(e?.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const dosageLabel = cycle === 'weekly' ? `每周用量(${unit})` : `每日用量(${unit})`;

  return (
    <Modal visible={visible} title={mode === 'add' ? '新增药品' : '编辑药品'} onClose={onClose}>
      <div className="form-item">
        <label>品名</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入药品名称" />
      </div>
      <div className="form-item">
        <label>量词</label>
        <select className="form-select" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {units.map((u) => (
            <option key={u.id} value={u.name}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-item">
        <label>库存({unit})</label>
        <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" />
      </div>
      <div className="form-item">
        <label>规格({unit}/盒)</label>
        <input type="number" value={perBox} onChange={(e) => setPerBox(e.target.value)} placeholder="0" />
      </div>
      <div className="form-item">
        <label>周期</label>
        <select
          className="form-select"
          value={cycle}
          onChange={(e) => setCycle(e.target.value as 'daily' | 'weekly')}
        >
          <option value="daily">每日</option>
          <option value="weekly">每周</option>
        </select>
      </div>
      <div className="form-item">
        <label>{dosageLabel}</label>
        <input type="number" value={dailyDosage} onChange={(e) => setDailyDosage(e.target.value)} placeholder="0" />
      </div>
      <div className="actions">
        {mode === 'edit' && onDelete && (
          <button className="btn danger" style={{ flex: 1 }} onClick={onDelete} disabled={loading}>
            删除
          </button>
        )}
        <button className="btn" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading}>
          确定
        </button>
      </div>
    </Modal>
  );
}
