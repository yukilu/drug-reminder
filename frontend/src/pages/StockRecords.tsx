import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStockRecords } from '../api';
import type { StockRecord } from '../types';

export default function StockRecords() {
  const nav = useNavigate();
  const [list, setList] = useState<StockRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getStockRecords(100)
      .then((resp) => {
        if (resp.code === 0 && resp.data?.list) {
          setList(resp.data.list);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="nav-header">
        <span className="nav-back" onClick={() => nav(-1)}>
          ‹
        </span>
        <span className="nav-title">库存更新记录</span>
        <span className="nav-right"></span>
      </div>
      {loading ? (
        <div className="empty">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty">暂无记录</div>
      ) : (
        <div style={{ padding: '10px 12px' }}>
          {list.map((r) => (
            <div key={r.id} className="record-card">
              <div className="record-top">
                <span className="record-name">{r.medicineName}</span>
                <span className="record-date">
                  {r.recordDate} {r.source === '补更' ? '· 补更' : ''}
                </span>
              </div>
              <div className="record-detail">
                {r.beforeStock} → {r.afterStock}（{r.changeAmount > 0 ? '+' : ''}
                {r.changeAmount}）
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
