import { Route, Routes } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { Home } from './pages/Home';
import { Matches } from './pages/Matches';
import { MatchPage } from './pages/MatchPage';
import { Tables } from './pages/Tables';
import { PlayerPage, SquadPage } from './pages/Squad';
import { History, HistoryChapter } from './pages/History';
import { Budget } from './pages/Budget';
import { About } from './pages/About';
import { News, NewsArticle } from './pages/News';
import { More, Placeholder } from './pages/Placeholder';
import { useSiteData } from './data/useSiteData';

export function App() {
  const data = useSiteData();
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={data ? <Home data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="/matches" element={data ? <Matches data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="/matches/:id" element={data ? <MatchPage data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="/tables" element={data ? <Tables data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:id" element={<NewsArticle />} />
        <Route path="/more" element={<More />} />
        <Route path="/squad" element={<SquadPage />} />
        <Route path="/players/:id" element={<PlayerPage />} />
        <Route path="/history" element={<History />} />
        <Route path="/history/:chapter" element={<HistoryChapter />} />
        <Route path="/budget" element={data ? <Budget data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="/about" element={data ? <About data={data} /> : <div className="soon">טוען…</div>} />
        <Route path="*" element={<Placeholder title="הדף לא נמצא" />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
