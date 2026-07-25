import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateStopBackfillDate } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function StopBackfillDate() {
  const nav = useNavigate();
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const [date, setDate] = useState(user?.stopBackfillDate || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const resp = await updateStopBackfillDate(date || null);
      if (resp.code === 0) {
        await refreshUser();
        showToast('设置成功');
        nav(-1);
      } else {
        showToast(resp.message || '设置失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('确定要清除停止补更日期吗？')) return;
    setLoading(true);
    try {
      const resp = await updateStopBackfillDate(null);
      if (resp.code === 0) {
        await refreshUser();
        setDate('');
        showToast('已清除');
      } else {
        showToast(resp.message || '操作失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="nav-header">
        <span className="nav-back" onClick={() => nav(-1)}>
          ‹
        </span>
        <span className="nav-title">停止补更日期</span>
        <span className="nav-right"></span>
      </div>

      <div className="card" style={{ margin: '12px' }}>
        <div className="form-item">
          <label>日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="请选择停止补更的日期"
          />
        </div>
        <div style={{ fontSize: 12, color: '#999', padding: '0 12px 12px' }}>
          设置后，该日期及之前的日期将不再进行库存补更
        </div>
      </div>

      <div style={{ padding: '0 12px' }}>
        <button className="btn" onClick={handleSave} disabled={loading}>
          {loading ? '保存中' : '保存'}
        </button>
        <button
          className="btn secondary"
          style={{ marginTop: 10 }}
          onClick={handleClear}
          disabled={loading || !date}
        >
          清除日期
        </button>
      </div>
    </div>
  );
}
