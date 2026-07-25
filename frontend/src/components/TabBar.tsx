import { useLocation, useNavigate } from 'react-router-dom';

interface Props {
  onAdd?: () => void;
}

export default function TabBar() {
  const nav = useNavigate();
  const loc = useLocation();

  const handleAdd = () => {
    window.dispatchEvent(new CustomEvent('open-add-medicine'));
  };

  const homeActive = loc.pathname === '/';
  const profileActive = loc.pathname === '/profile' || loc.pathname === '/stock-records' || loc.pathname === '/units';

  return (
    <div className="tabbar">
      <div
        className={`tabbar-item ${homeActive ? 'active' : ''}`}
        onClick={() => nav('/')}
      >
        <svg className="tabbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {homeActive ? (
            <>
              <path d="M3 12l9-9 9 9v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor" stroke="none" />
            </>
          ) : (
            <>
              <path d="M3 12l9-9 9 9v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
            </>
          )}
        </svg>
        <span>首页</span>
      </div>
      <div className="tabbar-item" onClick={handleAdd} style={{ flex: 0.8 }}>
        <div className="tabbar-add">+</div>
      </div>
      <div
        className={`tabbar-item ${profileActive ? 'active' : ''}`}
        onClick={() => nav('/profile')}
      >
        <svg className="tabbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {profileActive ? (
            <>
              <circle cx="12" cy="8" r="4" fill="currentColor" stroke="none" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7v1H4z" fill="currentColor" stroke="none" />
            </>
          ) : (
            <>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7v1H4z" />
            </>
          )}
        </svg>
        <span>我的</span>
      </div>
    </div>
  );
}
