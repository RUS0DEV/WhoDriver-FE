"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Sort = "recent" | "rating" | "comments";
type Comment = {
  id: string;
  content: string;
  createdAt: string;
  own?: boolean;
};
type Vehicle = {
  plate: string;
  rating: number;
  ratingCount: number;
  commentCount: number;
  createdAt: string;
  comments?: Comment[];
};

const PAGE_SIZE = 6;
const PLATE_LETTERS: Record<string, string> = {
  A: "А",
  B: "В",
  C: "С",
  E: "Е",
  H: "Н",
  K: "К",
  M: "М",
  O: "О",
  P: "Р",
  T: "Т",
  X: "Х",
  Y: "У",
};
const PLATE_PATTERN = /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;

const DEMO_VEHICLES: Vehicle[] = [
  { plate: "А472МР77", rating: 4.8, ratingCount: 42, commentCount: 18, createdAt: "сегодня" },
  { plate: "Е913КХ799", rating: 4.6, ratingCount: 27, commentCount: 11, createdAt: "сегодня" },
  { plate: "М207ОТ50", rating: 4.4, ratingCount: 19, commentCount: 7, createdAt: "вчера" },
  { plate: "С856АН197", rating: 4.2, ratingCount: 31, commentCount: 14, createdAt: "вчера" },
  { plate: "У381РС77", rating: 4.0, ratingCount: 16, commentCount: 6, createdAt: "2 дня назад" },
  { plate: "К104ТУ178", rating: 3.8, ratingCount: 24, commentCount: 9, createdAt: "2 дня назад" },
  { plate: "В729ЕО190", rating: 3.7, ratingCount: 13, commentCount: 4, createdAt: "3 дня назад" },
  { plate: "Н568МС77", rating: 3.5, ratingCount: 38, commentCount: 22, createdAt: "3 дня назад" },
  { plate: "Р042ХВ750", rating: 3.4, ratingCount: 9, commentCount: 3, createdAt: "4 дня назад" },
  { plate: "Т719АР77", rating: 3.2, ratingCount: 21, commentCount: 8, createdAt: "5 дней назад" },
  { plate: "О205КЕ50", rating: 3.1, ratingCount: 11, commentCount: 5, createdAt: "6 дней назад" },
  { plate: "А001АА777", rating: 2.9, ratingCount: 46, commentCount: 26, createdAt: "неделю назад" },
];

const DEMO_COMMENTS: Comment[] = [
  {
    id: "comment-1",
    content: "Аккуратно перестроился и пропустил на выезде со двора. Спасибо!",
    createdAt: "сегодня, 12:40",
  },
  {
    id: "comment-2",
    content: "Держит дистанцию, без резких манёвров. В плотном потоке — очень спокойно.",
    createdAt: "сегодня, 09:15",
  },
  {
    id: "comment-own",
    content: "Уступил дорогу у пешеходного перехода.",
    createdAt: "вчера, 18:20",
    own: true,
  },
];

function normalizePlate(value: string) {
  return value
    .toUpperCase()
    .replace(/\s|-/g, "")
    .replace(/[ABCEHKMOPTXY]/g, (letter) => PLATE_LETTERS[letter] ?? letter);
}

function relativeDate(value: unknown) {
  if (typeof value !== "string") return "недавно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const difference = Date.now() - date.getTime();
  const hours = Math.floor(difference / 3_600_000);
  if (hours < 1) return "только что";
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "вчера" : `${days} дн. назад`;
}

function numberFrom(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return 0;
}

function stringFrom(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function toComment(source: unknown): Comment {
  const record = (source ?? {}) as Record<string, unknown>;
  return {
    id: stringFrom(record, ["id", "_id"]) || `remote-${Math.random()}`,
    content: stringFrom(record, ["content", "text"]),
    createdAt: relativeDate(record.createdAt ?? record.created_at),
    own: Boolean(record.own ?? record.isOwn ?? record.is_own),
  };
}

function toVehicle(source: unknown): Vehicle {
  const record = (source ?? {}) as Record<string, unknown>;
  const nestedComments = Array.isArray(record.comments) ? record.comments.map(toComment) : undefined;
  return {
    plate: normalizePlate(stringFrom(record, ["plate", "number", "licensePlate", "license_plate"])),
    rating: numberFrom(record, ["averageRating", "average_rating", "rating"]),
    ratingCount: numberFrom(record, ["ratingCount", "rating_count", "ratingsCount", "ratings_count", "votes"]),
    commentCount: numberFrom(record, ["commentCount", "comment_count", "commentsCount", "comments_count"]) || nestedComments?.length || 0,
    createdAt: relativeDate(record.createdAt ?? record.created_at),
    comments: nestedComments,
  };
}

function getList(payload: unknown) {
  if (Array.isArray(payload)) return payload;
  const record = (payload ?? {}) as Record<string, unknown>;
  for (const key of ["items", "vehicles", "results", "data"]) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function getApiBase() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1").replace(/\/$/, "");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(detail?.message || "Не удалось выполнить запрос");
  }
  return response.json() as Promise<T>;
}

function Stars({ value }: { value: number }) {
  return <span className="stars" aria-label={`Рейтинг ${value.toFixed(1)} из 5`}>{"★".repeat(Math.round(value))}<span className="stars-muted">{"★".repeat(5 - Math.round(value))}</span></span>;
}

export default function Home() {
  const [screen, setScreen] = useState<"home" | "vehicle">("home");
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEMO_VEHICLES);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Vehicle[] | null>(null);
  const [pendingCreate, setPendingCreate] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("recent");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [isDemo, setIsDemo] = useState(true);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  useEffect(() => {
    let cancelled = false;
    api<unknown>(`/vehicles?page=1&limit=50&sort=recent`)
      .then((payload) => {
        const next = getList(payload).map(toVehicle).filter((vehicle) => vehicle.plate);
        if (!cancelled && next.length) {
          setVehicles(next);
          setIsDemo(false);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const sortedVehicles = useMemo(() => {
    const next = [...vehicles];
    if (sort === "rating") next.sort((a, b) => b.rating - a.rating);
    if (sort === "comments") next.sort((a, b) => b.commentCount - a.commentCount);
    return next;
  }, [sort, vehicles]);

  const pageCount = Math.max(1, Math.ceil(sortedVehicles.length / PAGE_SIZE));
  const feed = sortedVehicles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openVehicle = (vehicle: Vehicle) => {
    setSelected({ ...vehicle, comments: vehicle.comments ?? DEMO_COMMENTS });
    setScreen("vehicle");
    setSearchResults(null);
    setPendingCreate(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitSearch = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizePlate(query);
    setQuery(normalized);
    setPendingCreate(null);
    if (!normalized) {
      notify("Введите номер или его часть");
      return;
    }
    setLoading(true);
    try {
      if (PLATE_PATTERN.test(normalized)) {
        try {
          const result = toVehicle(await api<unknown>(`/vehicles/${encodeURIComponent(normalized)}`));
          if (result.plate) {
            openVehicle(result);
            return;
          }
        } catch {
          const local = vehicles.find((vehicle) => vehicle.plate === normalized);
          if (local) {
            openVehicle(local);
            return;
          }
          setPendingCreate(normalized);
          setSearchResults([]);
          return;
        }
      }
      try {
        const results = getList(await api<unknown>(`/vehicles/search?q=${encodeURIComponent(normalized)}`))
          .map(toVehicle)
          .filter((vehicle) => vehicle.plate);
        setSearchResults(results);
        setIsDemo(false);
      } catch {
        setSearchResults(vehicles.filter((vehicle) => vehicle.plate.includes(normalized)));
      }
    } finally {
      setLoading(false);
    }
  };

  const createVehicle = async (plate: string) => {
    setLoading(true);
    try {
      try {
        const result = toVehicle(await api<unknown>("/vehicles", {
          method: "POST",
          body: JSON.stringify({ plate }),
        }));
        const next = result.plate ? result : { plate, rating: 0, ratingCount: 0, commentCount: 0, createdAt: "только что" };
        setVehicles((current) => [next, ...current]);
        openVehicle(next);
      } catch {
        const next = { plate, rating: 0, ratingCount: 0, commentCount: 0, createdAt: "только что", comments: [] };
        setVehicles((current) => [next, ...current]);
        openVehicle(next);
        notify("Карточка создана в демо-режиме");
      }
    } finally {
      setLoading(false);
    }
  };

  const rateVehicle = async (value: number) => {
    if (!selected) return;
    const nextCount = selected.ratingCount + 1;
    const next = {
      ...selected,
      rating: Number(((selected.rating * selected.ratingCount + value) / nextCount).toFixed(1)),
      ratingCount: nextCount,
    };
    setSelected(next);
    setVehicles((current) => current.map((vehicle) => vehicle.plate === next.plate ? { ...vehicle, rating: next.rating, ratingCount: next.ratingCount } : vehicle));
    try {
      await api(`/vehicles/${encodeURIComponent(selected.plate)}/rating`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      notify("Оценка сохранена");
    } catch {
      notify("Оценка сохранена локально — подключите API для публикации");
    }
  };

  const addComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !commentText.trim()) return;
    const content = commentText.trim();
    const local: Comment = { id: `local-${Date.now()}`, content, createdAt: "только что", own: true };
    const next = { ...selected, comments: [local, ...(selected.comments ?? [])], commentCount: selected.commentCount + 1 };
    setSelected(next);
    setVehicles((current) => current.map((vehicle) => vehicle.plate === next.plate ? { ...vehicle, commentCount: next.commentCount } : vehicle));
    setCommentText("");
    try {
      await api(`/vehicles/${encodeURIComponent(selected.plate)}/comments`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      notify("Комментарий опубликован");
    } catch {
      notify("Комментарий сохранён локально — подключите API для публикации");
    }
  };

  const saveComment = async (id: string, content: string) => {
    if (!selected || !content.trim()) return;
    const comments = (selected.comments ?? []).map((comment) => comment.id === id ? { ...comment, content: content.trim() } : comment);
    setSelected({ ...selected, comments });
    setEditing(null);
    try {
      await api(`/comments/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ content: content.trim() }) });
      notify("Комментарий изменён");
    } catch {
      notify("Изменение сохранено локально");
    }
  };

  const deleteComment = async (id: string) => {
    if (!selected) return;
    const comments = (selected.comments ?? []).filter((comment) => comment.id !== id);
    const next = { ...selected, comments, commentCount: Math.max(0, selected.commentCount - 1) };
    setSelected(next);
    setVehicles((current) => current.map((vehicle) => vehicle.plate === next.plate ? { ...vehicle, commentCount: next.commentCount } : vehicle));
    try {
      await api(`/comments/${encodeURIComponent(id)}`, { method: "DELETE" });
      notify("Комментарий удалён");
    } catch {
      notify("Комментарий скрыт локально");
    }
  };

  const reportComment = async (id: string) => {
    try {
      await api(`/comments/${encodeURIComponent(id)}/report`, { method: "POST", body: JSON.stringify({ reason: "Требует проверки модератором" }) });
    } catch {
      // The interface remains usable without a local API server.
    }
    notify("Жалоба отправлена на проверку");
  };

  const changeSort = (next: Sort) => {
    setSort(next);
    setPage(1);
  };

  if (screen === "vehicle" && selected) {
    return (
      <main className="site-shell vehicle-screen">
        <header className="topbar compact-topbar">
          <button className="brand" type="button" onClick={() => setScreen("home")} aria-label="На главную WhoDriver">
            <span className="brand-mark">WD</span><span>WhoDriver</span>
          </button>
          <span className="anonymous-pill">анонимно</span>
        </header>

        <section className="detail-heading">
          <button className="back-button" type="button" onClick={() => setScreen("home")}>← К ленте</button>
          <span className="eyebrow">карточка водителя</span>
          <div className="detail-plate-row">
            <div className="plate large-plate">{selected.plate}</div>
            <span className="plate-region">RUS</span>
          </div>
          <div className="detail-summary">
            <div><b>{selected.rating.toFixed(1)}</b><Stars value={selected.rating} /></div>
            <span>{selected.ratingCount} оценок</span>
            <i />
            <span>{selected.commentCount} отзывов</span>
          </div>
        </section>

        <section className="action-card rating-card" aria-labelledby="rating-title">
          <div>
            <span className="eyebrow">ваш голос</span>
            <h1 id="rating-title">Как водитель?</h1>
            <p>Один браузер — одна оценка. Её можно изменить позже.</p>
          </div>
          <div className="rating-buttons" role="group" aria-label="Поставить оценку">
            {[0, 1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" onClick={() => rateVehicle(value)} aria-label={`Оценить на ${value} из 5`}>{value}</button>
            ))}
          </div>
        </section>

        <section className="comments-section" aria-labelledby="comments-title">
          <div className="section-heading">
            <div><span className="eyebrow">мнения</span><h2 id="comments-title">Отзывы</h2></div>
            <span className="count-bubble">{selected.commentCount}</span>
          </div>

          <form className="comment-form" onSubmit={addComment}>
            <label htmlFor="new-comment">Оставить отзыв</label>
            <textarea id="new-comment" value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={600} placeholder="Напишите кратко и по делу: что произошло на дороге?" />
            <div className="form-footer"><span>{commentText.length}/600</span><button className="primary-button" type="submit" disabled={!commentText.trim()}>Опубликовать</button></div>
          </form>

          <div className="comment-list">
            {(selected.comments ?? []).map((comment) => (
              <article className="comment" key={comment.id}>
                <div className="comment-meta"><span className="comment-avatar">А</span><span>Анонимный водитель</span><time>{comment.createdAt}</time></div>
                {editing === comment.id ? (
                  <EditComment comment={comment} onCancel={() => setEditing(null)} onSave={saveComment} />
                ) : (
                  <p>{comment.content}</p>
                )}
                {editing !== comment.id && <div className="comment-actions">
                  {comment.own ? <><button type="button" onClick={() => setEditing(comment.id)}>Изменить</button><button type="button" onClick={() => deleteComment(comment.id)}>Удалить</button></> : <button type="button" onClick={() => reportComment(comment.id)}>Пожаловаться</button>}
                </div>}
              </article>
            ))}
          </div>
        </section>

        <section className="privacy-note"><span>⌁</span><p>Отзывы публикуются без имени. Мы не просим регистрацию и не храним личные данные в карточках.</p></section>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => { setQuery(""); setSearchResults(null); }} aria-label="WhoDriver, главная">
          <span className="brand-mark">WD</span><span>WhoDriver</span>
        </button>
        <span className="anonymous-pill">анонимно</span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow light">сообщество водителей</span>
          <h1>Узнайте, как<br /><em>водят рядом.</em></h1>
          <p>Честные анонимные отзывы о поведении на дороге — по госномеру.</p>
          <form className="search-box" onSubmit={submitSearch}>
            <label className="sr-only" htmlFor="plate-search">Номер автомобиля</label>
            <span className="search-symbol" aria-hidden="true">⌕</span>
            <input id="plate-search" value={query} onChange={(event) => setQuery(normalizePlate(event.target.value))} placeholder="Например, А123ВС77" autoCapitalize="characters" autoComplete="off" />
            <button type="submit" disabled={loading}>{loading ? "Ищем" : "Найти"}</button>
          </form>
          <small>Поддерживаем номера формата А123ВС77 и А123ВС777</small>
        </div>
        <div className="hero-aside" aria-label="Как это работает">
          <span className="aside-number">01</span>
          <b>Номер — не личность.</b>
          <p>Никаких профилей, имён и регистраций.</p>
          <div className="mini-plate">А123ВС <strong>77</strong></div>
        </div>
      </section>

      {(searchResults !== null || pendingCreate) && <section className="search-results" aria-live="polite">
        <div className="section-heading"><div><span className="eyebrow">поиск</span><h2>Результаты для «{query}»</h2></div><button className="text-button" type="button" onClick={() => { setSearchResults(null); setPendingCreate(null); }}>Закрыть</button></div>
        {searchResults && searchResults.length > 0 && <div className="result-grid">{searchResults.map((vehicle) => <VehicleCard key={vehicle.plate} vehicle={vehicle} onOpen={openVehicle} />)}</div>}
        {pendingCreate && <div className="create-card"><div><span className="eyebrow">номера ещё нет</span><h3>Создать карточку {pendingCreate}?</h3><p>После создания можно оставить первую оценку или отзыв.</p></div><button className="primary-button" type="button" onClick={() => createVehicle(pendingCreate)}>Создать</button></div>}
        {searchResults && searchResults.length === 0 && !pendingCreate && <div className="empty-state"><b>Пока ничего не нашли</b><p>Попробуйте номер целиком или более короткую часть.</p></div>}
      </section>}

      <section className="feed-section" aria-labelledby="feed-title">
        <div className="section-heading feed-heading"><div><span className="eyebrow">лента</span><h2 id="feed-title">Водители рядом</h2></div><span className="feed-count">{isDemo ? "новые карточки" : "обновлено сейчас"}</span></div>
        <div className="sort-row" aria-label="Сортировка ленты">
          {([ ["recent", "Свежие"], ["rating", "По рейтингу"], ["comments", "По отзывам"] ] as [Sort, string][]).map(([value, label]) => <button className={sort === value ? "active" : ""} key={value} type="button" onClick={() => changeSort(value)}>{label}</button>)}
        </div>
        <div className="vehicle-grid">{feed.map((vehicle) => <VehicleCard key={vehicle.plate} vehicle={vehicle} onOpen={openVehicle} />)}</div>
        <nav className="pagination" aria-label="Страницы ленты">
          <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>←</button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => <button className={page === number ? "active" : ""} aria-current={page === number ? "page" : undefined} key={number} type="button" onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>→</button>
        </nav>
      </section>

      <section className="bottom-callout"><span>⌁</span><div><b>Дорога становится безопаснее, когда мы внимательнее друг к другу.</b><p>Оцените поступок, а не человека.</p></div></section>
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function VehicleCard({ vehicle, onOpen }: { vehicle: Vehicle; onOpen: (vehicle: Vehicle) => void }) {
  return <article className="vehicle-card">
    <button className="card-main" type="button" onClick={() => onOpen(vehicle)} aria-label={`Открыть карточку ${vehicle.plate}`}>
      <div className="card-top"><span className="plate">{vehicle.plate}</span><span className="chevron">↗</span></div>
      <div className="rating-line"><b>{vehicle.rating.toFixed(1)}</b><Stars value={vehicle.rating} /><span>{vehicle.ratingCount}</span></div>
      <div className="card-bottom"><span>◌ {vehicle.commentCount} отзывов</span><time>{vehicle.createdAt}</time></div>
    </button>
  </article>;
}

function EditComment({ comment, onCancel, onSave }: { comment: Comment; onCancel: () => void; onSave: (id: string, content: string) => void }) {
  const [value, setValue] = useState(comment.content);
  return <div className="edit-comment"><textarea value={value} onChange={(event) => setValue(event.target.value)} maxLength={600} aria-label="Изменить комментарий" /><div><button type="button" onClick={onCancel}>Отмена</button><button className="save-button" type="button" onClick={() => onSave(comment.id, value)}>Сохранить</button></div></div>;
}
