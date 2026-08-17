import { useLocation, useNavigate } from 'react-router-dom';

export default function TabBar() {
  const nav = useNavigate();
  const loc = useLocation();

  const homeActive = loc.pathname === '/';
  const stockActive = loc.pathname === '/stock';
  const dispensingActive = loc.pathname === '/dispensing';
  const profileActive =
    loc.pathname === '/profile' ||
    loc.pathname === '/stock-records' ||
    loc.pathname === '/units';

  return (
    <div className="tabbar">
      <div
        className={`tabbar-item ${homeActive ? 'active' : ''}`}
        onClick={() => nav('/')}
      >
        <svg className="tabbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {homeActive ? (
            <path d="M3 12l9-9 9 9v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor" stroke="none" />
          ) : (
            <path d="M3 12l9-9 9 9v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
          )}
        </svg>
        <span>首页</span>
      </div>

      <div
        className={`tabbar-item ${stockActive ? 'active' : ''}`}
        onClick={() => nav('/stock')}
      >
        <svg className="tabbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {stockActive ? (
            <>
              <path d="M20 7H4v13h16V7z" fill="currentColor" stroke="none" />
              <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" fill="currentColor" stroke="none" />
              <path d="M9 11v6M12 11v6M15 11v6" stroke="#fff" strokeWidth="1.5" />
            </>
          ) : (
            <>
              <path d="M20 7H4v13h16V7z" />
              <path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2" />
              <path d="M9 11v6M12 11v6M15 11v6" />
            </>
          )}
        </svg>
        <span>库存</span>
      </div>

      <div
        className={`tabbar-item ${dispensingActive ? 'active' : ''}`}
        onClick={() => nav('/dispensing')}
      >
        <svg className="tabbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {dispensingActive ? (
            <>
              <rect x="3" y="5" width="18" height="16" rx="2" fill="currentColor" stroke="none" />
              <rect x="3" y="5" width="18" height="4" rx="2" fill="currentColor" stroke="none" />
              <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" />
              <path d="M8 13h8M8 16h5" stroke="#fff" strokeWidth="1.5" />
            </>
          ) : (
            <>
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 9h18" />
              <path d="M8 3v4M16 3v4" />
              <path d="M8 13h8M8 16h5" />
            </>
          )}
        </svg>
        <span>配药</span>
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
