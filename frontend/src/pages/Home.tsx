import { useEffect, useState, useCallback, useRef } from 'react';
import { createMedicine, deleteMedicine, getMedicines, updateMedicine } from '../api';
import type { Medicine } from '../types';
import MedicineForm from '../components/MedicineForm';
import { useToast } from '../contexts/ToastContext';

function calcNeedForMonth(med: Medicine): { pills: number; boxes: number } {
  const monthly = med.dailyDosage * 30;
  const need = Math.max(0, monthly - med.stock);
  const boxes = med.perBox > 0 ? Math.ceil(need / med.perBox) : 0;
  return { pills: need, boxes };
}

export default function Home() {
  const [list, setList] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [current, setCurrent] = useState<Medicine | null>(null);
  const { showToast } = useToast();

  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getMedicines();
      if (resp.code === 0 && resp.data) {
        const sorted = [...resp.data].sort((a, b) => {
          const needA = calcNeedForMonth(a).pills > 0 ? 0 : 1;
          const needB = calcNeedForMonth(b).pills > 0 ? 0 : 1;
          if (needA !== needB) return needA - needB;
          return (a.sort ?? 0) - (b.sort ?? 0);
        });
        setList(sorted);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const resp = await getMedicines();
      if (resp.code === 0 && resp.data) {
        const sorted = [...resp.data].sort((a, b) => {
          const needA = calcNeedForMonth(a).pills > 0 ? 0 : 1;
          const needB = calcNeedForMonth(b).pills > 0 ? 0 : 1;
          if (needA !== needB) return needA - needB;
          return (a.sort ?? 0) - (b.sort ?? 0);
        });
        setList(sorted);
        showToast('刷新成功');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '刷新失败');
    } finally {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [showToast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const handler = () => {
      setFormMode('add');
      setCurrent(null);
      setFormVisible(true);
    };
    window.addEventListener('open-add-medicine', handler);
    return () => window.removeEventListener('open-add-medicine', handler);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollTop = pageRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current || refreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    if (diff > 0) {
      const distance = Math.min(diff * 0.5, 80);
      setPullDistance(distance);
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = () => {
    if (!pulling.current || refreshing) return;
    pulling.current = false;
    if (pullDistance >= 60) {
      onRefresh();
    } else {
      setPullDistance(0);
    }
  };

  const handleAddSubmit = async (data: {
    name: string;
    stock: number;
    perBox: number;
    dailyDosage: number;
    unit: string;
  }) => {
    const resp = await createMedicine(data);
    if (resp.code === 0) {
      showToast('新增成功');
      fetchList();
    } else {
      showToast(resp.message || '新增失败');
    }
  };

  const handleEdit = (med: Medicine) => {
    setCurrent(med);
    setFormMode('edit');
    setFormVisible(true);
  };

  const handleEditSubmit = async (data: {
    name: string;
    stock: number;
    perBox: number;
    dailyDosage: number;
    unit: string;
  }) => {
    if (!current) return;
    const resp = await updateMedicine(current.id, data);
    if (resp.code === 0) {
      showToast('修改成功');
      fetchList();
    } else {
      showToast(resp.message || '修改失败');
    }
  };

  const handleDelete = async () => {
    if (!current) return;
    if (!window.confirm('确定要删除该药品吗？删除后不可恢复。')) return;
    const resp = await deleteMedicine(current.id);
    if (resp.code === 0) {
      showToast('删除成功');
      setFormVisible(false);
      fetchList();
    } else {
      showToast(resp.message || '删除失败');
    }
  };

  const pullText = refreshing ? '刷新中...' : pullDistance >= 60 ? '释放刷新' : '下拉刷新';

  return (
    <>
      <div
        className="page"
        ref={pageRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="pull-refresh"
          style={{ height: refreshing ? 50 : pullDistance, marginTop: refreshing ? -50 : -pullDistance }}
        >
          <span className="pull-refresh-text">{pullText}</span>
        </div>
        {loading && list.length === 0 ? (
          <div className="empty">加载中...</div>
        ) : list.length === 0 ? (
          <div className="empty">还没有药品，点击下方 + 号添加</div>
        ) : (
          <div style={{ padding: '10px 12px' }}>
            {list.map((med) => {
              const need = calcNeedForMonth(med);
              const u = med.unit || '粒';
              return (
                <div key={med.id} className="medicine-card" onClick={() => handleEdit(med)}>
                  <div className="med-name">{med.name}</div>
                  <div className="med-row">
                    <div className="med-item">
                      <span className="med-label">规格</span>
                      <span className="med-value">{med.perBox}{u}/盒</span>
                    </div>
                    <div className="med-item">
                      <span className="med-label">每日用量</span>
                      <span className="med-value">{med.dailyDosage}{u}</span>
                    </div>
                  </div>
                  <div className="med-row">
                    <div className="med-item">
                      <span className="med-label">库存</span>
                      <span className="med-stock">{med.stock}{u}</span>
                    </div>
                    <div className="med-item">
                      <span className="med-label">需补（月）</span>
                      <span className="med-need">
                        {need.pills > 0 ? `${need.boxes}盒` : '充足'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <MedicineForm
        visible={formVisible}
        mode={formMode}
        medicine={current}
        onClose={() => setFormVisible(false)}
        onSubmit={formMode === 'add' ? handleAddSubmit : handleEditSubmit}
        onDelete={formMode === 'edit' ? handleDelete : undefined}
      />
    </>
  );
}
