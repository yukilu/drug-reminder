import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getManualStockRecords,
  createManualStockUpdate,
  getMedicines,
} from '../api';
import type { StockRecord, Medicine } from '../types';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

const PAGE_SIZE = 20;

export default function ManualStockUpdates() {
  const nav = useNavigate();
  const { showToast } = useToast();
  const [list, setList] = useState<StockRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);

  // 下拉刷新
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);

  // 新增弹窗
  const [showAdd, setShowAdd] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [selectedMedicineId, setSelectedMedicineId] = useState<number | ''>('');
  const [quantityBoxes, setQuantityBoxes] = useState<string>('');
  const [adding, setAdding] = useState(false);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getManualStockRecords(1, PAGE_SIZE);
      if (resp.code === 0 && resp.data) {
        setList(resp.data.list || []);
        setTotal(resp.data.total || 0);
        setPage(1);
        setNoMore((resp.data.list?.length || 0) >= (resp.data.total || 0));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || noMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const resp = await getManualStockRecords(nextPage, PAGE_SIZE);
      if (resp.code === 0 && resp.data) {
        const append = resp.data.list || [];
        setList((prev) => [...prev, ...append]);
        setTotal(resp.data.total || 0);
        setPage(nextPage);
        if (list.length + append.length >= (resp.data.total || 0)) {
          setNoMore(true);
        }
        if (append.length < PAGE_SIZE) setNoMore(true);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, noMore, loading, page, list.length]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  // 滚动到底加载更多
  useEffect(() => {
    const handler = () => {
      const el = document.documentElement;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
        loadMore();
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, [loadMore]);

  // 下拉刷新
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY <= 0) {
      setPullDistance(Math.min(100, dy * 0.5));
    }
  };
  const handleTouchEnd = async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= 60 && !refreshing) {
      setRefreshing(true);
      try {
        await fetchFirstPage();
        showToast('刷新成功');
      } catch {
        showToast('刷新失败');
      } finally {
        setRefreshing(false);
      }
    }
    setPullDistance(0);
  };

  const openAdd = async () => {
    try {
      const resp = await getMedicines();
      if (resp.code === 0 && resp.data) {
        setMedicines(resp.data);
        if (resp.data.length > 0) {
          setSelectedMedicineId(resp.data[0].id);
        } else {
          setSelectedMedicineId('');
        }
        setQuantityBoxes('');
        setShowAdd(true);
      } else {
        showToast(resp.message || '加载药品失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '加载药品失败');
    }
  };

  const handleAddSubmit = async () => {
    if (!selectedMedicineId) {
      showToast('请选择药品');
      return;
    }
    const qty = Number(quantityBoxes);
    if (!Number.isFinite(qty) || qty === 0) {
      showToast('请输入数量(盒)，不能为0');
      return;
    }
    setAdding(true);
    try {
      const resp = await createManualStockUpdate(Number(selectedMedicineId), qty);
      if (resp.code === 0) {
        showToast('更新成功');
        setShowAdd(false);
        await fetchFirstPage();
      } else {
        showToast(resp.message || '更新失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '更新失败');
    } finally {
      setAdding(false);
    }
  };

  const pullText = refreshing
    ? '刷新中...'
    : pullDistance >= 60
    ? '释放刷新'
    : '下拉刷新';

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
          style={{
            height: refreshing ? 50 : pullDistance,
            marginTop: refreshing ? -50 : -pullDistance,
          }}
        >
          <span className="pull-refresh-text">{pullText}</span>
        </div>
        <div className="nav-header">
          <span className="nav-back" onClick={() => nav(-1)}>
            ‹
          </span>
          <span className="nav-title">库存手动更新</span>
          <span className="nav-right"></span>
        </div>
        {loading && list.length === 0 ? (
          <div className="empty">加载中...</div>
        ) : list.length === 0 ? (
          <div className="empty">暂无记录，点击右下角 + 新增</div>
        ) : (
          <div style={{ padding: '10px 12px 80px' }}>
            {list.map((r) => {
              const isAdd = r.changeAmount > 0;
              return (
                <div key={r.id} className="record-card">
                  <div className="record-top">
                    <span className="record-name">{r.medicineName}</span>
                    <span className="record-date">{r.recordDate} · 手动</span>
                  </div>
                  <div className="record-detail">
                    {r.beforeStock} → {r.afterStock}（{isAdd ? '+' : ''}
                    {r.changeAmount}）
                  </div>
                </div>
              );
            })}
            {loadingMore ? (
              <div className="empty" style={{ padding: '14px 0' }}>加载中...</div>
            ) : noMore && total > 0 ? (
              <div className="empty" style={{ padding: '14px 0', color: '#999' }}>
                已加载全部 {total} 条
              </div>
            ) : null}
          </div>
        )}

        {/* 右下角新增按钮 */}
        <button className="fab" onClick={openAdd} title="新增">
          +
        </button>
      </div>

      <Modal visible={showAdd} title="新增库存调整" onClose={() => setShowAdd(false)}>
        <div className="form-item">
          <label>药品</label>
          <select
            className="form-select"
            value={selectedMedicineId}
            onChange={(e) =>
              setSelectedMedicineId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">请选择药品</option>
            {medicines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="form-item">
          <label>数量(盒)</label>
          <input
            type="number"
            step="1"
            value={quantityBoxes}
            onChange={(e) => setQuantityBoxes(e.target.value)}
          />
        </div>
        <div className="actions">
          <button className="btn secondary" onClick={() => setShowAdd(false)}>
            取消
          </button>
          <button className="btn" onClick={handleAddSubmit} disabled={adding}>
            {adding ? '提交中' : '确定'}
          </button>
        </div>
      </Modal>
    </>
  );
}
