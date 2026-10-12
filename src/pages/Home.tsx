import { useRef, useState } from 'preact/hooks';
import { ItemRow } from '../components/ItemRow';
import { searchItems, type SearchHit } from '../lib/search';
import { navigate } from '../router';
import { dataReady, gate, items, pathOf, searchQuery } from '../state';

const LIMIT = 50;

export function Home() {
  const q = searchQuery.value;
  const [composing, setComposing] = useState(false);
  const lastHits = useRef<SearchHit[]>([]);
  const fresh = searchItems(items.value, pathOf.value, q, LIMIT);
  // 한글 조합 중("충ㅈ", "충저")에는 일치가 0이 되어 결과가 번쩍인다. 조합 중이면 직전 결과를 유지한다.
  const hits = composing && fresh.length === 0 && q ? lastHits.current : fresh;
  if (!composing) lastHits.current = fresh;
  const g = gate.value;

  return (
    <main class="page has-fab">
      <div class="topbar">
        <input type="search" aria-label="물건 검색" placeholder="물건 이름, 별칭, 초성(ㅊㅈㄱ)…" value={q}
          onInput={(e) => { searchQuery.value = (e.target as HTMLInputElement).value; }}
          onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} />
        <button class="ghost" onClick={() => navigate('/places')}>공간</button>
        <button class="ghost" aria-label="설정" onClick={() => navigate('/settings')}>⚙︎</button>
      </div>
      {g.kind === 'allowed' && g.offlineGrace && <p class="banner">오프라인: 마지막 집 확인 기준으로 열렸어요. 변경은 연결되면 동기화돼요.</p>}
      {!dataReady.value && <p class="center muted">불러오는 중…</p>}
      {dataReady.value && !q && <p class="muted">최근 수정한 물건</p>}
      {dataReady.value && hits.length === 0 && <p class="center muted">{q ? '검색 결과가 없어요' : '아직 등록된 물건이 없어요. + 로 추가하세요.'}</p>}
      <ul class="list">{hits.map((h) => <ItemRow key={h.item.id} item={h.item} path={h.path} />)}</ul>
      {hits.length >= LIMIT && <p class="muted">결과가 더 있어요. 검색어를 좁히거나 '공간'에서 찾아보세요.</p>}
      <button class="fab" aria-label="물건 추가" onClick={() => navigate(`/item/new${q ? `?name=${encodeURIComponent(q)}` : ''}`)}>+</button>
    </main>
  );
}
