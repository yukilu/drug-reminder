import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMedicines, moveMedicine } from '../api';
import type { Medicine } from '../types';
import { useToast } from '../contexts/ToastContext';

export default function MedicineSort() {
  const nav = useNavigate();
  const { showToast } = useToast();
  const [list, setList] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const resp = await getMedicines();
      if (resp.code === 0 && resp.data) {
        setList(resp.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleMove = async (med: Medicine, direction: 'up' | 'down') => {
    if (moveLoading) return;
    setMoveLoading(true);
    try {
      const resp = await moveMedicine(med.id, direction);
      if (resp.code === 0) {
        fetchList();
      } else {
        showToast(resp.message || '操作失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '操作失败');
    } finally {
      setMoveLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="nav-header">
        <span className="nav-back" onClick={() => nav(-1)}>
          ‹
        </span>
        <span className="nav-title">药品排序</span>
        <span className="nav-right"></span>
      </div>
      {loading ? (
        <div className="empty">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty">暂无药品</div>
      ) : (
        <div className="card" style={{ margin: '10px 12px' }}>
          {list.map((med, index) => (
            <div key={med.id} className="list-item">
              <span className="label">{med.name}</span>
              <span className="value">
                <span
                  className={`unit-sort-btn ${index === 0 ? 'disabled' : ''}`}
                  onClick={() => index > 0 && handleMove(med, 'up')}
                >
                  ↑
                </span>
                <span
                  className={`unit-sort-btn ${index === list.length - 1 ? 'disabled' : ''}`}
                  onClick={() => index < list.length - 1 && handleMove(med, 'down')}
                >
                  ↓
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
