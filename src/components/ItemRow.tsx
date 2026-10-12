import type { Item } from '../lib/types';
import { navigate } from '../router';

export function ItemRow({ item, path }: { item: Item; path: string }) {
  return (
    <li onClick={() => navigate(`/item/${item.id}`)} style="cursor:pointer">
      <div class="row" style="justify-content:space-between">
        <strong>{item.name}</strong>
        {item.qty !== 1 && <span class="muted">×{item.qty}</span>}
      </div>
      <div class="muted">{path || '위치 없음'}</div>
    </li>
  );
}
