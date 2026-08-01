import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { backfillStock, changePassword } from '../api';
import Modal from '../components/Modal';

export default function Profile() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();
  const [showPwd, setShowPwd] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false);

  const handleLogout = () => {
    if (!window.confirm('确定要退出登录吗？')) return;
    logout();
    nav('/login', { replace: true });
  };

  const handleChangePwd = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) {
      showToast('请填写完整');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('两次新密码不一致');
      return;
    }
    setPwdLoading(true);
    try {
      const resp = await changePassword(oldPwd, newPwd);
      if (resp.code === 0) {
        showToast('修改成功');
        setShowPwd(false);
        setOldPwd('');
        setNewPwd('');
        setConfirmPwd('');
      } else {
        showToast(resp.message || '修改失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '修改失败');
    } finally {
      setPwdLoading(false);
    }
  };

  const handleBackfill = () => {
    setShowBackfillConfirm(true);
  };

  const confirmBackfill = async () => {
    setShowBackfillConfirm(false);
    setBackfillLoading(true);
    try {
      const resp = await backfillStock(30);
      if (resp.code === 0 && resp.data) {
        showToast(`补更完成，共补充 ${resp.data.backfilledCount} 条记录`);
      } else {
        showToast(resp.message || '补更失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '补更失败');
    } finally {
      setBackfillLoading(false);
    }
  };

  return (
    <>
      <div className="page">
        <div className="user-card">
          <div className="avatar">{user?.username?.slice(0, 1).toUpperCase() || 'U'}</div>
          <div className="info">
            <div className="name">{user?.username}</div>
            <div className="time">注册时间：{user?.createdAt?.slice(0, 10) || '-'}</div>
          </div>
        </div>

        <div className="card">
          <div className="list-item" onClick={() => nav('/medicine-sort')}>
            <span className="label">药品排序</span>
            <span className="value">›</span>
          </div>
          <div className="list-item" onClick={() => nav('/manual-stock-updates')}>
            <span className="label">库存手动更新</span>
            <span className="value">›</span>
          </div>
          <div className="list-item" onClick={() => nav('/stock-records')}>
            <span className="label">库存自动更新记录</span>
            <span className="value">›</span>
          </div>
          <div className="list-item" onClick={() => nav('/units')}>
            <span className="label">量词维护</span>
            <span className="value">›</span>
          </div>
          <div className="list-item" onClick={() => setShowPwd(true)}>
            <span className="label">重置密码</span>
            <span className="value">›</span>
          </div>
          <div className="list-item" onClick={handleBackfill}>
            <span className="label">更新库存（补更最近30天）</span>
            <span className="value">{backfillLoading ? '处理中' : '›'}</span>
          </div>
          <div className="list-item" onClick={() => nav('/stop-backfill-date')}>
            <span className="label">停止补更日期</span>
            <span className="value">
              {user?.stopBackfillDate || '未设置'} ›
            </span>
          </div>
          <div className="list-item" onClick={() => nav('/hospital-visits')}>
            <span className="label">配药时间</span>
            <span className="value">›</span>
          </div>
        </div>

        <div className="card">
          <button className="btn danger" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </div>

      <Modal visible={showPwd} title="重置密码" onClose={() => setShowPwd(false)}>
        <div className="form-item">
          <label>原密码</label>
          <input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
        </div>
        <div className="form-item">
          <label>新密码（6-64位）</label>
          <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
        </div>
        <div className="form-item">
          <label>确认新密码</label>
          <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
        </div>
        <div className="actions">
          <button className="btn" onClick={handleChangePwd} disabled={pwdLoading}>
            {pwdLoading ? '提交中' : '确定'}
          </button>
        </div>
      </Modal>

      <Modal visible={showBackfillConfirm} title="更新库存" onClose={() => setShowBackfillConfirm(false)}>
        <div style={{ padding: '8px 0 20px', fontSize: 14, color: '#333', lineHeight: 1.6 }}>
          将检查最近 30 天的库存更新记录，对缺失日期进行补充更新，是否继续？
        </div>
        <div className="actions actions-row">
          <button className="btn secondary" onClick={() => setShowBackfillConfirm(false)}>
            取消
          </button>
          <button className="btn" onClick={confirmBackfill} disabled={backfillLoading}>
            {backfillLoading ? '处理中' : '确定'}
          </button>
        </div>
      </Modal>
    </>
  );
}
