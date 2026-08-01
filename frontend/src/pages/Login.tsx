import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login: authLogin } = useAuth();
  const { showToast } = useToast();
  const nav = useNavigate();

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      showToast('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      const resp = await login(username.trim(), password);
      if (resp.code === 0 && resp.data) {
        authLogin(resp.data.token, resp.data.user);
        showToast('登录成功');
        nav('/', { replace: true });
      } else {
        showToast(resp.message || '登录失败');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <div className="page">
        <div className="login-title">
          <div className="login-title-text">用药提醒</div>
        </div>
        <div className="card" style={{ marginTop: 20 }}>
          <div className="form-item">
            <label>用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              autoComplete="username"
            />
          </div>
          <div className="form-item">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              autoComplete="current-password"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
          <button className="btn" onClick={handleSubmit} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 14, color: '#4f8cff' }}>
            <Link to="/register">还没有账号？去注册</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
