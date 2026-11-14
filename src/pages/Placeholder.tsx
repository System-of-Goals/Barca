import { Link } from 'react-router-dom';
import { Users, ScrollText, Wallet, Info, ChevronLeft } from 'lucide-react';

export function Placeholder({ title }: { title: string }) {
  return (
    <main className="page">
      <h1 className="page-title">{title}</h1>
      <div className="card soon">הדף הזה ייבנה בשלבים הבאים, לפי האפיון.</div>
    </main>
  );
}

const moreItems = [
  { to: '/squad', label: 'סגל', icon: Users },
  { to: '/history', label: 'היסטוריה', icon: ScrollText },
  { to: '/budget', label: 'תקציב', icon: Wallet },
  { to: '/about', label: 'אודות', icon: Info },
];

export function More() {
  return (
    <main className="page">
      <h1 className="page-title">עוד</h1>
      <div className="card" style={{ padding: '4px 14px' }}>
        {moreItems.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="menu-item">
            <Icon size={22} color="var(--gold)" />
            {label}
            <ChevronLeft size={20} className="chev" />
          </Link>
        ))}
      </div>
    </main>
  );
}
