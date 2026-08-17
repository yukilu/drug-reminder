import { useEffect, useState, useCallback, useRef } from 'react';
import {
  getManualStockRecords,
  createManualStockUpdate,
  getMedicines,
  getReplenishPreview,
} from '../api';
import type { StockRecord, Medicine } from '../types';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

const PAGE_SIZE = 20;

interface ReplenishItem {
  medicineId: number;
  medicineName: string;
  pills: number;
  boxes: number;
  unit: string;
  currentStock: number;
  perBox: number;
  cycle: 'daily' | 'weekly';
  dailyDosage: number;
}

interface ReplenishPreview {
  nextDispensingDate: string | null;
  nextNextDate: string | null;
  periodDays: number | null;
  items: ReplenishItem[];
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export default function Stock() {
  const { showToast } = useToast();
  const [list, setList] = useState<StockRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [noMore, setNoMore] = useState(false);

  // 日期筛选
  const [filterDate, setFilterDate] = useState('');

  // 配药补货预览
  const [replenish, setReplenish] = useState<ReplenishPreview | null>(null);

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

  // 补货详情弹窗
  const [showReplenish, setShowReplenish] = useState(false);

  const fetchReplenish = useCallback(async () => {
    try {
      const resp = await getReplenishPreview();
      if (resp.code === 0 && resp.data) {
        setReplenish(resp.data);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getManualStockRecords(1, PAGE_SIZE, filterDate || undefined);
      if (resp.code === 0 && resp.data) {
        setList(resp.data.list || []);
        setTotal(resp.data.total || 0);
        setPage(1);
        setNoMore(
          (resp.data.list?.length || 0) >= (resp.data.total || 0) ||
          (resp.data.list?.length || 0) < PAGE_SIZE
        );
      }
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  const loadMore = useCallback(async () => {
    if (loadingMore || noMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const resp = await getManualStockRecords(nextPage, PAGE_SIZE, filterDate || undefined);
      if (resp.code === 0 && resp.data) {
        const append = resp.data.list || [];
        setList((prev) => [...prev, ...append]);
        setTotal(resp.data.total || 0);
        setPage(nextPage);
        if (list.length + append.length >= (resp.data.total || 0)) setNoMore(true);
        if (append.length < PAGE_SIZE) setNoMore(true);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, noMore, loading, page, list.length, filterDate]);

  useEffect(() => {
    fetchReplenish();
    fetchFirstPage();
  }, [fetchReplenish, fetchFirstPage]);

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
        await Promise.all([fetchReplenish(), fetchFirstPage()]);
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

  const today = todayStr();
  const daysToNext = replenish?.nextDispensingDate
    ? daysBetween(today, replenish.nextDispensingDate)
    : null;

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
        {/* 配药当天卡片 */}
        {replenish && replenish.nextDispensingDate && (
          <div
            className="replenish-card"
            onClick={() => setShowReplenish(true)}
          >
            <div className="replenish-top">
              <div className="replenish-label">下次配药当天</div>
              <div className="replenish-date">{replenish.nextDispensingDate}</div>
            </div>
            <div className="replenish-info">
              {daysToNext !== null && (
                <span className="replenish-tag">
                  {daysToNext === 0 ? '今天配药' : daysToNext > 0 ? `还有 ${daysToNext} 天` : '已过'}
                </span>
              )}
              {replenish.periodDays && (
                <span className="replenish-tag">
                  周期 {replenish.periodDays} 天
                </span>
              )}
              {replenish.items.length > 0 && (
                <span className="replenish-tag highlight">
                  需补 {replenish.items.length} 种药
                </span>
              )}
              {replenish.items.length === 0 && (
                <span className="replenish-tag">库存充足</span>
              )}
            </div>
            <div className="replenish-hint">
              配药次日0点自动补货 · 点击查看详情 ›
            </div>
          </div>
        )}

        {/* 日期筛选 */}
        <div className="card date-filter-card">
          <div className="date-filter-row">
            <label className="date-filter-label">日期筛选</label>
            <input
              type="date"
              className="date-filter-input"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />
            {filterDate && (
              <button
                className="date-filter-clear"
                onClick={() => setFilterDate('')}
              >
                清除
              </button>
            )}
          </div>
        </div>

        {/* 记录列表 */}
        <div style={{ padding: '0 12px 80px' }}>
          <div className="section-title">
            库存更新记录
            {filterDate && <span className="section-filter-tag">筛选：{filterDate}</span>}
          </div>
          {loading && list.length === 0 ? (
            <div className="empty">加载中...</div>
          ) : list.length === 0 ? (
            <div className="empty">
              {filterDate ? '该日期暂无记录' : '暂无记录，点击右下角 + 新增'}
            </div>
          ) : (
            <>
              {list.map((r) => {
                const isAdd = r.changeAmount > 0;
                const isReplenish = r.source === '配药补货';
                const perBox = r.perBox || 0;
                const boxes = perBox > 0 ? Math.abs(r.changeAmount) / perBox : 0;
                const boxesStr =
                  perBox > 0 && Number.isInteger(boxes)
                    ? `${boxes}盒`
                    : perBox > 0
                    ? `${boxes.toFixed(1)}盒`
                    : '';
                return (
                  <div key={r.id} className="record-card">
                    <div className="record-top">
                      <span className="record-name">{r.medicineName}</span>
                      <span className="record-date">
                        {r.recordDate}
                        {isReplenish ? ' · 配药补货' : ' · 手动'}
                      </span>
                    </div>
                    <div className="record-detail">
                      {r.beforeStock} → {r.afterStock}（{isAdd ? '+' : ''}
                      {r.changeAmount}
                      {boxesStr ? ` / ${isAdd ? '+' : '-'}${boxesStr}` : ''}）
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
            </>
          )}
        </div>

        <button className="fab" onClick={openAdd} title="新增">
          +
        </button>
      </div>

      {/* 新增库存调整 */}
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
            placeholder="正数入库，负数出库"
          />
        </div>
        <div className="actions actions-row">
          <button className="btn secondary" onClick={() => setShowAdd(false)}>
            取消
          </button>
          <button className="btn" onClick={handleAddSubmit} disabled={adding}>
            {adding ? '提交中' : '确定'}
          </button>
        </div>
      </Modal>

      {/* 补货详情 */}
      <Modal
        visible={showReplenish}
        title="配药补货预览"
        onClose={() => setShowReplenish(false)}
      >
        {replenish && (
          <div style={{ paddingBottom: 8 }}>
            <div className="replenish-detail-info">
              <div>配药日期：<strong>{replenish.nextDispensingDate}</strong></div>
              {replenish.nextNextDate && (
                <div>下次配药：<strong>{replenish.nextNextDate}</strong></div>
              )}
              {replenish.periodDays && (
                <div>配药周期：<strong>{replenish.periodDays} 天</strong></div>
              )}
              <div style={{ color: '#999', fontSize: 13, marginTop: 6 }}>
                配药次日0点自动按需补货，以下为预估值：
              </div>
            </div>
            {replenish.items.length === 0 ? (
              <div className="empty" style={{ padding: '24px 0' }}>库存充足，无需补货</div>
            ) : (
              <div className="replenish-list">
                {replenish.items.map((item) => (
                  <div key={item.medicineId} className="replenish-item">
                    <div className="replenish-item-name">
                      {item.medicineName}
                      <span className="med-cycle-tag" style={{ marginLeft: 6 }}>
                        {item.cycle === 'weekly' ? '周' : '日'}
                      </span>
                    </div>
                    <div className="replenish-item-detail">
                      <span>当前 {item.currentStock}{item.unit}</span>
                      <span className="replenish-add">+{item.pills}{item.unit}</span>
                      <span className="replenish-boxes">{item.boxes}盒</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="actions">
              <button className="btn secondary" onClick={() => setShowReplenish(false)}>
                关闭
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
