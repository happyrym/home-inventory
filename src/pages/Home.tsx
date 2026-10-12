import { useMemo, useState } from 'preact/hooks';
import { ItemRow } from '../components/ItemRow';
import { searchItems } from '../lib/search';
import { navigate } from '../router';
import { gate, items, pathOf } from '../state';

export function Home() {
  const [q, setQ] = useState('');
  const hits = useMemo(() => searchItems(items.value, pathOf.value, q), [items.value, pathOf.value, q]);
  const g = gate.value;

  return (
    <main class="page">
      <div class="topbar">
        <input type="search" placeholder="물건 이름, 별칭, 초성(ㅊㅈㄱ)…" autofocus value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <button class="ghost" onClick={() => navigate('/places')}>공간</button>
        <button class="ghost" onClick={() => navigate('/settings')}>⚙︎</button>
      </div>
      {g.kind === 'allowed' && g.offlineGrace && <p class="banner">오프라인: 마지막 집 확인 기준으로 열렸어요. 변경은 연결되면 동기화돼요.</p>}
      {!q && <p class="muted">최근 수정한 물건</p>}
      {hits.length === 0 && <p class="center muted">{q ? '검색 결과가 없어요' : '아직 등록된 물건이 없어요. + 로 추가하세요.'}</p>}
      <ul class="list">{hits.map((h) => <ItemRow key={h.item.id} item={h.item} path={h.path} />)}</ul>
      <button class="fab" aria-label="물건 추가" onClick={() => navigate(`/item/new${q ? `?name=${encodeURIComponent(q)}` : ''}`)}>+</button>
    </main>
  );
}
