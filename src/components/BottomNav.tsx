import { NavLink } from 'react-router-dom';
import { Home, CalendarDays, Trophy, Newspaper, Menu } from 'lucide-react';

// Order is right-to-left on screen: "בית" is always the rightmost tab.
const tabs = [
  { to: '/', label: 'בית', icon: Home, end: true },
  { to: '/matches', label: 'משחקים', icon: CalendarDays },
  { to: '/tables', label: 'טבלאות', icon: Trophy },
  { to: '/news', label: 'חדשות', icon: Newspaper },
  { to: '/more', label: 'עוד', icon: Menu },
];

export function BottomNav() {
  return (
    <nav className="nav" aria-label="ניווט ראשי">
      <div className="nav-inner">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end}>
            <Icon size={24} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
