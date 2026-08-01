import { useEffect, useState, useCallback, useRef } from 'react';
import { createMedicine, deleteMedicine, getMedicines, updateMedicine, getNextCycleDays } from '../api';
import type { Medicine } from '../types';
import MedicineForm from '../components/MedicineForm';
import { useToast } from '../contexts/ToastContext';

/**
 * 严格按用户规则计算需补药量：
 *  1. 需补多少天 = periodDays（即 next2-next1，或默认30天）
 *  2. 需补的量 = 需补多少天 × (每日/每周用量，按周期换算)
 *  3. 基准库存 = 当前库存(已扣到今天) - 从今天到未来最近一次配药(next1)的消耗
 *  4. 最终需补 = max(0, 需补的量 - 基准库存)
 *
 * 说明：medicines.stock 已由后端定时任务每天扣减，是当前真实剩余库存。
 *       当前时间→next1 是"未来要吃的"，需要额外从库存里预扣掉。
 */
function calcNeedForPeriod(
  med: Medicine,
  daysToNext1: number, // 今天 → next1(未来最近一次配药) 的天数
  periodDays: number,   // next1 → next2 的配药周期天数(标签显示的x天)，默认30
  hasNext: boolean
): { pills: number; boxes: number } {
  if (!hasNext) return { pills: 0, boxes: 0 };
  const isWeekly = med.cycle === 'weekly';
  const dosage = med.dailyDosage;

  // 2. 需补的量（周期部分）
  let requiredForPeriod: number;
  if (isWeekly) {
    requiredForPeriod = Math.max(0, Math.ceil(periodDays / 7)) * dosage;
  } else {
    requiredForPeriod = periodDays * dosage;
  }

  // 3. 基准库存 = stock - 当前(今天)→next1 之间要消耗的
  let consumeBeforeNext: number;
  if (daysToNext1 <= 0) {
    consumeBeforeNext = 0;
  } else if (isWeekly) {
    consumeBeforeNext = Math.max(0, Math.ceil(daysToNext1 / 7)) * dosage;
  } else {
    consumeBeforeNext = daysToNext1 * dosage;
  }
  const baseStock = Math.max(0, med.stock - consumeBeforeNext);

  // 4. 最终需补
  const pills = Math.max(0, requiredForPeriod - baseStock);
  const boxes = med.perBox > 0 ? Math.ceil(pills / med.perBox) : 0;
  return { pills, boxes };
}

const DEFAULT_PERIOD_DAYS = 30;

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a + 'T00:00:00');
  const d2 = new Date(b + 'T00:00:00');
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function Home() {
  const [list, setList] = useState<Medicine[]>([]);
  const [periodDays, setPeriodDays] = useState<number>(DEFAULT_PERIOD_DAYS);
  // hasNextVisit = false 表示"当前时间之后没有下一次配药时间"→需补用量=0（充足）
  const [hasNextVisit, setHasNextVisit] = useState<boolean>(false);
  // 今天到 next1 的天数（阶段 A，扣库存用）
  const [daysToNext, setDaysToNext] = useState<number>(0);
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

  const fetchPeriodDays = useCallback(async () => {
    try {
      const resp = await getNextCycleDays();
      const data = resp.data;
      if (resp.code === 0 && data) {
        if (!data.next1) {
          // 当前时间之后没有下一次配药时间 → 不计算需补
          setHasNextVisit(false);
          setPeriodDays(DEFAULT_PERIOD_DAYS);
          setDaysToNext(0);
          return;
        }
        const today = todayStr();
        const dToNext = Math.max(0, daysBetween(today, data.next1));
        let pDays = DEFAULT_PERIOD_DAYS;
        if (typeof data.days === 'number' && data.days > 0) {
          pDays = data.days;
        }
        setHasNextVisit(true);
        setPeriodDays(pDays);
        setDaysToNext(dToNext);
      } else {
        setHasNextVisit(false);
        setPeriodDays(DEFAULT_PERIOD_DAYS);
        setDaysToNext(0);
      }
    } catch {
      setHasNextVisit(false);
      setPeriodDays(DEFAULT_PERIOD_DAYS);
      setDaysToNext(0);
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getMedicines();
      if (resp.code === 0 && resp.data) {
        const sorted = [...resp.data].sort((a, b) => {
          const needA = calcNeedForPeriod(a, daysToNext, periodDays, hasNextVisit).pills > 0 ? 0 : 1;
          const needB = calcNeedForPeriod(b, daysToNext, periodDays, hasNextVisit).pills > 0 ? 0 : 1;
          if (needA !== needB) return needA - needB;
          return (a.sort ?? 0) - (b.sort ?? 0);
        });
        setList(sorted);
      }
    } finally {
      setLoading(false);
    }
  }, [daysToNext, periodDays, hasNextVisit]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPeriodDays();
      const resp = await getMedicines();
      if (resp.code === 0 && resp.data) {
        const sorted = [...resp.data].sort((a, b) => {
          const needA = calcNeedForPeriod(a, daysToNext, periodDays, hasNextVisit).pills > 0 ? 0 : 1;
          const needB = calcNeedForPeriod(b, daysToNext, periodDays, hasNextVisit).pills > 0 ? 0 : 1;
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
  }, [daysToNext, periodDays, hasNextVisit, fetchPeriodDays, showToast]);

  useEffect(() => {
    fetchPeriodDays();
  }, [fetchPeriodDays]);

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
    cycle: 'daily' | 'weekly';
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
    cycle: 'daily' | 'weekly';
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

  const needLabel = `需补(${periodDays}天)`;

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
              const need = calcNeedForPeriod(med, daysToNext, periodDays, hasNextVisit);
              const u = med.unit || '片';
              const isWeekly = med.cycle === 'weekly';
              return (
                <div key={med.id} className="medicine-card" onClick={() => handleEdit(med)}>
                  <div className="med-name">
                    {med.name}
                    <span className="med-cycle-tag" style={{ marginLeft: 8 }}>
                      {isWeekly ? '周' : '日'}
                    </span>
                  </div>
                  <div className="med-row">
                    <div className="med-item">
                      <span className="med-label">规格</span>
                      <span className="med-value">{med.perBox}{u}/盒</span>
                    </div>
                    <div className="med-item">
                      <span className="med-label">{isWeekly ? '每周用量' : '每日用量'}</span>
                      <span className="med-value">{med.dailyDosage}{u}</span>
                    </div>
                  </div>
                  <div className="med-row">
                    <div className="med-item">
                      <span className="med-label">库存</span>
                      <span className="med-stock">{med.stock}{u}</span>
                    </div>
                    <div className="med-item">
                      <span className="med-label">{needLabel}</span>
                      <span className="med-need">
                        {!hasNextVisit
                          ? '-'
                          : need.pills > 0
                          ? `${need.pills}${u}/${need.boxes}盒`
                          : '充足'}
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
