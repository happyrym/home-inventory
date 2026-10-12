import { useState } from 'preact/hooks';
import { PlacePicker } from '../components/PlacePicker';
import { db } from '../firebase';
import type { Item } from '../lib/types';
import { navigate } from '../router';
import { code, dataReady, items } from '../state';
import { deleteItem, saveItem, type ItemInput } from '../store/data';

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const report = (e: unknown) => alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);

export function ItemEdit({ id, params }: { id: string; params: URLSearchParams }) {
  if (!dataReady.value) return <main class="page center"><p class="muted">불러오는 중…</p></main>;
  const existing = id === 'new' ? undefined : items.value.find((i) => i.id === id);
  if (id !== 'new' && !existing) return <main class="page center"><p>물건을 찾을 수 없어요.</p><button onClick={() => navigate('/')}>홈으로</button></main>;
  return <ItemForm key={existing?.id ?? 'new'} existing={existing} params={params} />;
}

function ItemForm({ existing, params }: { existing?: Item; params: URLSearchParams }) {
  const isNew = !existing;
  const [name, setName] = useState(existing?.name ?? params.get('name') ?? '');
  const [aliases, setAliases] = useState(existing?.aliases.join(', ') ?? '');
  const [placeId, setPlaceId] = useState<string | null>(existing?.placeId ?? params.get('place') ?? null);
  const [qty, setQty] = useState(existing?.qty ?? 1);
  const [note, setNote] = useState(existing?.note ?? '');
  const [toast, setToast] = useState('');

  const input = (): ItemInput => ({ name: name.trim(), aliases: splitList(aliases), placeId, qty, note: note.trim() });

  const save = () => {
    if (!name.trim()) return;
    void saveItem(db, code.value!, input(), existing?.id).catch(report);
    navigate('/');
  };
  const saveAndContinue = () => {
    if (!name.trim()) return;
    void saveItem(db, code.value!, input()).catch(report);
    setToast(`추가됨: ${name.trim()}`);
    setName(''); setAliases(''); setQty(1); setNote('');
  };
  const moveTo = (id: string | null) => {
    if (!existing) return;
    void saveItem(db, code.value!, { ...input(), placeId: id }, existing.id).catch(report);
    navigate('/');
  };
  const remove = () => {
    if (!existing || !confirm(`'${existing.name}' 삭제할까요?`)) return;
    void deleteItem(db, code.value!, existing.id).catch(report);
    navigate('/');
  };

  return (
    <main class="page">
      <div class="topbar">
        <button class="ghost" onClick={() => history.back()}>← 뒤로</button>
        <h2 style="margin:0;flex:1">{isNew ? '물건 추가' : '물건 수정'}</h2>
        {existing && <PlacePicker value={placeId} onChange={moveTo} label="위치 이동" />}
      </div>
      {toast && <p class="banner">{toast}</p>}
      <div class="field"><label>이름</label><input type="text" value={name} autofocus={isNew} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></div>
      <div class="field"><label>위치</label><PlacePicker value={placeId} onChange={setPlaceId} /></div>
      <div class="field"><label>별칭·키워드 (쉼표로 구분)</label><input type="text" value={aliases} placeholder="c타입 선, 충전선, 전자기기" onInput={(e) => setAliases((e.target as HTMLInputElement).value)} /></div>
      <div class="field"><label>수량</label><input type="number" min={0} value={qty} onInput={(e) => setQty(Number((e.target as HTMLInputElement).value) || 0)} /></div>
      <div class="field"><label>메모</label><textarea rows={3} value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} /></div>
      <div class="row">
        <button disabled={!name.trim()} onClick={save}>{isNew ? '추가' : '저장'}</button>
        {isNew && <button class="ghost" disabled={!name.trim()} onClick={saveAndContinue}>저장하고 계속 추가</button>}
        {existing && <button class="danger" onClick={remove}>삭제</button>}
      </div>
      {existing && <p class="muted">마지막 수정 {new Date(existing.updatedAt).toLocaleString('ko-KR')}</p>}
    </main>
  );
}
