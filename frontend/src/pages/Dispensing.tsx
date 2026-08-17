import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  createHospitalVisit,
  deleteHospitalVisit,
  getHospitalVisits,
} from '../api';
import type { HospitalVisit } from '../types';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月',
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dateToStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function getWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `周${WEEKDAYS[d.getDay()]}`;
}

export default function Dispensing() {
  const { showToast } = useToast();
  const [list, setList] = useState<HospitalVisit[]>([]);
  const [loading, setLoading] = useState(false);

  // 日历视图当前年月
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // 弹窗
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'add' | 'delete' | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getHospitalVisits();
      if (resp.code === 0 && resp.data) {
        setList(resp.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 按日期建立映射
  const visitMap = useMemo(() => {
    const m = new Map<string, HospitalVisit>();
    for (const v of list) {
      m.set(v.visitDate, v);
    }
    return m;
  }, [list]);

  // 生成日历格子（只渲染实际日期，用 grid-column-start 定位第一天的位置）
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstDay.getDay(); // 0=周日
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number; dateStr: string; colStart: number }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        dateStr: dateToStr(viewYear, viewMonth, d),
        colStart: ((d - 1 + startWeekday) % 7) + 1,
      });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const todayStr = dateToStr(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleDateClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setConfirmAction(null);
  };

  const handleAddClick = () => {
    setConfirmAction('add');
  };

  const handleDeleteClick = (id: number) => {
    setPendingDeleteId(id);
    setConfirmAction('delete');
  };

  const confirmAdd = async () => {
    if (!selectedDate) return;
    setActionLoading(true);
    try {
      const resp = await createHospitalVisit(selectedDate);
      if (resp.code === 0) {
        showToast('添加成功');
        setConfirmAction(null);
        await fetchList();
      } else {
        showToast(resp.message || '添加失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '添加失败');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (pendingDeleteId === null) return;
    setActionLoading(true);
    try {
      const resp = await deleteHospitalVisit(pendingDeleteId);
      if (resp.code === 0) {
        showToast('删除成功');
        setConfirmAction(null);
        setPendingDeleteId(null);
        await fetchList();
      } else {
        showToast(resp.message || '删除失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '删除失败');
    } finally {
      setActionLoading(false);
    }
  };

  const selectedVisit = selectedDate ? visitMap.get(selectedDate) : undefined;

  return (
    <div className="page">
      {/* 日历 */}
      <div className="calendar-card">
        <div className="calendar-header">
          <span className="cal-nav" onClick={prevMonth}>‹</span>
          <span className="cal-title">{viewYear}年 {MONTH_NAMES[viewMonth]}</span>
          <span className="cal-nav" onClick={nextMonth}>›</span>
        </div>
        <div className="calendar-weekdays">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">{w}</div>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarCells.map((cell) => {
            const visit = visitMap.get(cell.dateStr);
            const isToday = cell.dateStr === todayStr;
            const isPast = cell.dateStr < todayStr;
            return (
              <div
                key={cell.dateStr}
                className={`cal-cell ${visit ? 'has-visit' : ''} ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}
                style={{ gridColumnStart: cell.colStart }}
                onClick={() => handleDateClick(cell.dateStr)}
              >
                <span className="cal-day">{cell.day}</span>
                {visit && <span className="cal-dot" />}
              </div>
            );
          })}
        </div>
        <div className="calendar-legend">
          <span className="legend-item"><span className="legend-dot has-visit" />配药日</span>
          <span className="legend-item"><span className="legend-dot today" />今天</span>
        </div>
      </div>

      {/* 近期配药列表 */}
      {loading && list.length === 0 ? (
        <div className="empty">加载中...</div>
      ) : (
        <div style={{ padding: '0 12px 12px' }}>
          <div className="section-title">近期配药时间</div>
          {list.length === 0 ? (
            <div className="empty" style={{ padding: '30px 0' }}>暂无配药时间，点击日历日期添加</div>
          ) : (
            list.slice(0, 10).map((item) => (
              <div key={item.id} className="hv-card" onClick={() => handleDateClick(item.visitDate)}>
                <div className="hv-left">
                  <div className="hv-date">{item.visitDate}</div>
                  <div className="hv-week">{getWeekday(item.visitDate)}</div>
                </div>
                <div className="hv-del" onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id); }}>
                  删除
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 日期弹窗 */}
      <Modal
        visible={!!selectedDate && confirmAction === null}
        title={selectedDate ? `${selectedDate} ${getWeekday(selectedDate)}` : ''}
        onClose={() => setSelectedDate(null)}
      >
        <div style={{ padding: '8px 0 16px', fontSize: 14, color: '#333', lineHeight: 1.6 }}>
          {selectedVisit ? (
            <p>该日期已设置配药时间，是否要删除？</p>
          ) : (
            <p>该日期未设置配药时间，是否要添加？</p>
          )}
        </div>
        <div className="actions actions-row">
          {selectedVisit ? (
            <button
              className="btn danger"
              onClick={() => handleDeleteClick(selectedVisit.id)}
            >
              删除配药时间
            </button>
          ) : (
            <button
              className="btn"
              onClick={handleAddClick}
            >
              添加配药时间
            </button>
          )}
          <button className="btn secondary" onClick={() => setSelectedDate(null)}>
            取消
          </button>
        </div>
      </Modal>

      {/* 添加确认 */}
      <Modal
        visible={confirmAction === 'add'}
        title="确认添加"
        onClose={() => setConfirmAction(null)}
      >
        <div style={{ padding: '8px 0 20px', fontSize: 14, color: '#333', lineHeight: 1.6 }}>
          确定要添加 <strong>{selectedDate}</strong>（{selectedDate ? getWeekday(selectedDate) : ''}）为配药时间吗？
          <br />
          <span style={{ color: '#999', fontSize: 13 }}>
            添加后，配药次日0点将自动按需补货。
          </span>
        </div>
        <div className="actions actions-row">
          <button className="btn secondary" onClick={() => setConfirmAction(null)}>
            取消
          </button>
          <button className="btn" onClick={confirmAdd} disabled={actionLoading}>
            {actionLoading ? '添加中' : '确定添加'}
          </button>
        </div>
      </Modal>

      {/* 删除确认 */}
      <Modal
        visible={confirmAction === 'delete'}
        title="确认删除"
        onClose={() => { setConfirmAction(null); setPendingDeleteId(null); }}
      >
        <div style={{ padding: '8px 0 20px', fontSize: 14, color: '#333', lineHeight: 1.6 }}>
          确定要删除 <strong>{selectedDate}</strong>（{selectedDate ? getWeekday(selectedDate) : ''}）的配药时间吗？
          <br />
          <span style={{ color: '#ff5b5b', fontSize: 13 }}>
            删除后该日期将不再触发自动补货。
          </span>
        </div>
        <div className="actions actions-row">
          <button className="btn secondary" onClick={() => { setConfirmAction(null); setPendingDeleteId(null); }}>
            取消
          </button>
          <button className="btn danger" onClick={confirmDelete} disabled={actionLoading}>
            {actionLoading ? '删除中' : '确定删除'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
