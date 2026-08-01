import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createHospitalVisit, deleteHospitalVisit, getHospitalVisits } from '../api';
import type { HospitalVisit } from '../types';
import { useToast } from '../contexts/ToastContext';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function getWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  return `周${WEEKDAYS[d.getDay()]}`;
}

export default function HospitalVisits() {
  const nav = useNavigate();
  const { showToast } = useToast();
  const [list, setList] = useState<HospitalVisit[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateValue, setDateValue] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const resp = await getHospitalVisits();
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

  const handleAdd = async () => {
    if (!dateValue) {
      showToast('请选择日期');
      return;
    }
    setAdding(true);
    try {
      const resp = await createHospitalVisit(dateValue);
      if (resp.code === 0) {
        showToast('添加成功');
        setDateValue('');
        fetchList();
      } else {
        showToast(resp.message || '添加失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (item: HospitalVisit) => {
    if (!window.confirm(`确定要删除 ${item.visitDate} 的记录吗？`)) return;
    try {
      const resp = await deleteHospitalVisit(item.id);
      if (resp.code === 0) {
        showToast('删除成功');
        setList((prev) => prev.filter((x) => x.id !== item.id));
      } else {
        showToast(resp.message || '删除失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '删除失败');
    }
  };

  return (
    <div className="page">
      <div className="nav-header">
        <span className="nav-back" onClick={() => nav(-1)}>
          ‹
        </span>
        <span className="nav-title">配药时间</span>
        <span className="nav-right"></span>
      </div>

      <div className="card">
        <div className="form-item">
          <label>选择日期</label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            placeholder="请选择配药日期"
          />
        </div>
        <button className="btn" onClick={handleAdd} disabled={adding}>
          {adding ? '添加中' : '添加配药日期'}
        </button>
      </div>

      {loading ? (
        <div className="empty">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty">暂无配药时间记录</div>
      ) : (
        <div style={{ padding: '0 12px 12px' }}>
          {list.map((item) => (
            <div key={item.id} className="hv-card">
              <div className="hv-left">
                <div className="hv-date">{item.visitDate}</div>
                <div className="hv-week">{getWeekday(item.visitDate)}</div>
              </div>
              <div className="hv-del" onClick={() => handleDelete(item)}>
                删除
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
