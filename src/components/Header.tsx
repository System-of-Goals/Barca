import { formatTime } from '../lib/format';
import { asset } from '../data/useSiteData';

export function Header({ updatedAt, crest }: { updatedAt: string; crest?: string }) {
  return (
    <header className="top">
      <div className="top-inner">
        <div>
          <div className="top-title">ברצלונה</div>
          <div className="top-sub">עודכן {formatTime(updatedAt)}</div>
        </div>
        <div className="crest">
          <img src={asset(crest) ?? `${import.meta.env.BASE_URL}icons/crest.svg`} alt="סמל המועדון" />
        </div>
      </div>
    </header>
  );
}
