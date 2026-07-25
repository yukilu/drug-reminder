import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();

  const handleSubmit = async () => {
    if (!username.trim()) {
      showToast('请输入用户名');
      return;
    }
    if (!password) {
      showToast('请输入密码');
      return;
    }
    if (password !== confirm) {
      showToast('两次密码不一致');
      return;
    }
    setLoading(true);
    try {
      const resp = await register(username.trim(), password);
      if (resp.code === 0 && resp.data) {
        authLogin(resp.data.token, resp.data.user);
        showToast('注册成功');
        nav('/', { replace: true });
      } else {
        showToast(resp.message || '注册失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="page">
        <div className="card" style={{ marginTop: 60 }}>
          <div className="form-item">
            <label>用户名（2-32位）</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" />
          </div>
          <div className="form-item">
            <label>密码（6-64位）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>
          <div className="form-item">
            <label>确认密码</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="请再次输入密码"
            />
          </div>
          <button className="btn" onClick={handleSubmit} disabled={loading}>
            {loading ? '注册中...' : '注册'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 14, color: '#4f8cff' }}>
            <Link to="/login">已有账号？去登录</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
