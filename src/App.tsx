import { Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { More, Placeholder } from './pages/Placeholder';
import { sampleData } from './data/sample';

export function App() {
  const data = sampleData;
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home data={data} />} />
        <Route path="/matches" element={<Placeholder title="משחקים" />} />
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
