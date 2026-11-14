import { Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Matches } from './pages/Matches';
import { More, Placeholder } from './pages/Placeholder';
import { useSiteData } from './data/useSiteData';

export function App() {
  const data = useSiteData();
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={data ? <Home data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="/matches" element={data ? <Matches data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="/matches/:id" element={<Placeholder title="משחק" />} />
        <Route path="/tables" element={<Placeholder title="טבלאות" />} />
        <Route path="/news" element={<Placeholder title="חדשות" />} />
        <Route path="/more" element={<More />} />
        <Route path="/squad" element={<Placeholder title="סגל" />} />
        <Route path="/players/:id" element={<Placeholder title="שחקן" />} />
        <Route path="/history" element={<Placeholder title="היסטוריה" />} />
        <Route path="/budget" element={<Placeholder title="תקציב" />} />
        <Route path="/about" element={<Placeholder title="אודות" />} />
        <Route path="*" element={<Placeholder title="הדף לא נמצא" />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
