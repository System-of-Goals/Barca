import { formatTime } from '../lib/format';

export function Header({ updatedAt }: { updatedAt: string }) {
  return (
    <header className="top">
      <div className="top-inner">
        <div>
          <div className="top-title">ברצלונה</div>
          <div className="top-sub">עודכן {formatTime(updatedAt)}</div>
        </div>
        <div className="crest">
          <img src={`${import.meta.env.BASE_URL}icons/crest.svg`} alt="סמל המועדון" />
        </div>
      </div>
    </header>
  );
}
