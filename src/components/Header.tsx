import { formatTime } from '../lib/format';
import { asset } from '../data/useSiteData';

// Crest on the right, title centred in the space next to it.
export function Header({ updatedAt, crest }: { updatedAt: string; crest?: string }) {
  return (
    <header className="top">
      <div className="top-inner">
        <div className="crest">
          <img src={asset(crest) ?? `${import.meta.env.BASE_URL}icons/crest.svg`} alt="סמל המועדון" />
        </div>
        <div className="top-text">
          <div className="top-title">ברצלונה</div>
          <div className="top-tagline">פינת האוהדים</div>
          <div className="top-sub">עודכן {formatTime(updatedAt)}</div>
        </div>
      </div>
    </header>
  );
}
