import { ItemRow } from '../components/ItemRow';
import { navigate } from '../router';
import { items, pathOf, places } from '../state';

export function PlaceItems({ id }: { id: string }) {
  const place = places.value.find((p) => p.id === id);
  if (!place) return <main class="page center"><p>공간을 찾을 수 없어요.</p><button onClick={() => navigate('/places')}>공간 목록</button></main>;

  const subtree = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of places.value) if (p.parentId && subtree.has(p.parentId) && !subtree.has(p.id)) { subtree.add(p.id); grew = true; }
  }
  const list = items.value.filter((i) => i.placeId && subtree.has(i.placeId)).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <main class="page has-fab">
      <div class="topbar">
        <button class="ghost" onClick={() => navigate('/places')}>← 공간</button>
        <h2 style="margin:0">{pathOf.value(id)}</h2>
      </div>
      {list.length === 0 && <p class="center muted">이 공간에 물건이 없어요.</p>}
      <ul class="list">{list.map((i) => <ItemRow key={i.id} item={i} path={pathOf.value(i.placeId)} />)}</ul>
      <button class="fab" aria-label="여기에 물건 추가" onClick={() => navigate(`/item/new?place=${id}`)}>+</button>
    </main>
  );
}
