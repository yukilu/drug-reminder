import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStockRecords } from '../api';
import type { StockRecord } from '../types';
import { useToast } from '../contexts/ToastContext';

const PAGE_SIZE = 20;

export default function StockRecords() {
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

  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getStockRecords(1, PAGE_SIZE);
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
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || noMore || loading) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const resp = await getStockRecords(nextPage, PAGE_SIZE);
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
  }, [loadingMore, noMore, loading, page, list.length]);

  useEffect(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

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

  const pullText = refreshing
    ? '刷新中...'
    : pullDistance >= 60
    ? '释放刷新'
    : '下拉刷新';

  return (
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
        <span className="nav-title">库存自动更新记录</span>
        <span className="nav-right"></span>
      </div>
      {loading && list.length === 0 ? (
        <div className="empty">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty">暂无记录</div>
      ) : (
        <div style={{ padding: '10px 12px 30px' }}>
          {list.map((r) => (
            <div key={r.id} className="record-card">
              <div className="record-top">
                <span className="record-name">{r.medicineName}</span>
                <span className="record-date">
                  {r.recordDate} {r.source === '补更' ? '· 补更' : ''}
                  {r.cycle === 'weekly' ? ' · 周' : ' · 日'}
                </span>
              </div>
              <div className="record-detail">
                {r.beforeStock} → {r.afterStock}（{r.changeAmount > 0 ? '+' : ''}
                {r.changeAmount}）
              </div>
            </div>
          ))}
          {loadingMore ? (
            <div className="empty" style={{ padding: '14px 0' }}>加载中...</div>
          ) : noMore && total > 0 ? (
            <div className="empty" style={{ padding: '14px 0', color: '#999' }}>
              已加载全部 {total} 条
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
