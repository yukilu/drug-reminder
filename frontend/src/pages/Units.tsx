import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUnits, createUnit, updateUnit, deleteUnit, moveUnit } from '../api';
import type { Unit } from '../types';
import Modal from '../components/Modal';
import { useToast } from '../contexts/ToastContext';

export default function Units() {
  const nav = useNavigate();
  const { showToast } = useToast();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [current, setCurrent] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [moveLoading, setMoveLoading] = useState(false);

  const fetchUnits = async () => {
    setLoading(true);
    try {
      const resp = await getUnits();
      if (resp.code === 0 && resp.data) {
        setUnits(resp.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const openAdd = () => {
    setFormMode('add');
    setCurrent(null);
    setName('');
    setFormVisible(true);
  };

  const openEdit = (u: Unit) => {
    setFormMode('edit');
    setCurrent(u);
    setName(u.name);
    setFormVisible(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('请输入量词名称');
      return;
    }
    setSubmitLoading(true);
    try {
      if (formMode === 'add') {
        const resp = await createUnit(name.trim());
        if (resp.code === 0) {
          showToast('添加成功');
          setFormVisible(false);
          fetchUnits();
        } else {
          showToast(resp.message || '添加失败');
        }
      } else if (current) {
        const resp = await updateUnit(current.id, name.trim());
        if (resp.code === 0) {
          showToast('修改成功');
          setFormVisible(false);
          fetchUnits();
        } else {
          showToast(resp.message || '修改失败');
        }
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '操作失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (u: Unit) => {
    if (!window.confirm(`确定要删除量词"${u.name}"吗？`)) return;
    try {
      const resp = await deleteUnit(u.id);
      if (resp.code === 0) {
        showToast('删除成功');
        fetchUnits();
      } else {
        showToast(resp.message || '删除失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '删除失败');
    }
  };

  const handleMove = async (u: Unit, direction: 'up' | 'down') => {
    if (moveLoading) return;
    setMoveLoading(true);
    try {
      const resp = await moveUnit(u.id, direction);
      if (resp.code === 0) {
        fetchUnits();
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
        <span className="nav-title">量词维护</span>
        <span className="nav-right" style={{ color: '#4f8cff', width: 'auto' }} onClick={openAdd}>
          新增
        </span>
      </div>
      {loading ? (
        <div className="empty">加载中...</div>
      ) : units.length === 0 ? (
        <div className="empty">暂无量词</div>
      ) : (
        <div className="card" style={{ margin: '10px 12px' }}>
          {units.map((u, index) => (
            <div key={u.id} className="list-item">
              <span className="label">{u.name}</span>
              <span className="value">
                <span
                  className={`unit-sort-btn ${index === 0 ? 'disabled' : ''}`}
                  onClick={() => index > 0 && handleMove(u, 'up')}
                >
                  ↑
                </span>
                <span
                  className={`unit-sort-btn ${index === units.length - 1 ? 'disabled' : ''}`}
                  onClick={() => index < units.length - 1 && handleMove(u, 'down')}
                >
                  ↓
                </span>
                <span style={{ color: '#4f8cff', marginLeft: 8 }} onClick={() => openEdit(u)}>
                  编辑
                </span>
                <span style={{ color: '#ff5b5b', marginLeft: 12 }} onClick={() => handleDelete(u)}>
                  删除
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal visible={formVisible} title={formMode === 'add' ? '新增量词' : '编辑量词'} onClose={() => setFormVisible(false)}>
        <div className="form-item">
          <label>名称</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入量词名称" />
        </div>
        <div className="actions">
          <button className="btn" onClick={handleSubmit} disabled={submitLoading}>
            {submitLoading ? '提交中' : '确定'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
