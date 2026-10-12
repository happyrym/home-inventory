import { useEffect, useRef, useState } from 'preact/hooks';
import { PlacePicker } from '../components/PlacePicker';
import { db } from '../firebase';
import type { Item } from '../lib/types';
import { goBack, navigate } from '../router';
import { code, dataReady, items } from '../state';
import { deleteItem, moveItem, saveItem, type ItemInput } from '../store/data';

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const report = (e: unknown) => alert(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
const parseQty = (s: string) => Math.max(0, Math.floor(Number(s)) || 0);

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
  const [qty, setQty] = useState(String(existing?.qty ?? 1));
  const [note, setNote] = useState(existing?.note ?? '');
  const [toast, setToast] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  // HTML autofocus는 문서당 한 번만 동작해 SPA 화면 전환 뒤에는 무시된다. 직접 포커스한다.
  useEffect(() => { if (isNew) nameRef.current?.focus(); }, []);

  const input = (): ItemInput => ({ name: name.trim(), aliases: splitList(aliases), placeId, qty: parseQty(qty), note: note.trim() });

  const save = () => {
    if (!name.trim()) return;
    void saveItem(db, code.value!, input(), existing?.id).catch(report);
    goBack();
  };
  const saveAndContinue = () => {
    if (!name.trim()) return;
    void saveItem(db, code.value!, input()).catch(report);
    setToast(`추가됨: ${name.trim()}`);
    setName(''); setAliases(''); setQty('1'); setNote('');
    nameRef.current?.focus();
  };
  const moveTo = (id: string | null) => {
    if (!existing) return;
    void moveItem(db, code.value!, existing.id, id).catch(report);
    goBack();
  };
  const remove = () => {
    if (!existing || !confirm(`'${existing.name}' 삭제할까요? 되돌릴 수 없어요.`)) return;
    void deleteItem(db, code.value!, existing.id).catch(report);
    goBack();
  };

  return (
    <main class="page">
      <div class="topbar">
        <button class="ghost" onClick={goBack}>← 뒤로</button>
        <h2 style="margin:0;flex:1">{isNew ? '물건 추가' : '물건 수정'}</h2>
        {existing && <PlacePicker value={placeId} onChange={moveTo} label="위치 이동" />}
      </div>
      {toast && <p class="banner">{toast}</p>}
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div class="field"><label for="f-name">이름</label><input id="f-name" ref={nameRef} type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></div>
        <div class="field"><label>위치</label><PlacePicker value={placeId} onChange={setPlaceId} /></div>
        <div class="field"><label for="f-aliases">별칭·키워드 (쉼표로 구분)</label><input id="f-aliases" type="text" value={aliases} placeholder="c타입 선, 충전선, 전자기기" onInput={(e) => setAliases((e.target as HTMLInputElement).value)} /></div>
        <div class="field"><label for="f-qty">수량 (0 = 다 씀)</label><input id="f-qty" type="text" inputMode="numeric" pattern="[0-9]*" value={qty} onInput={(e) => setQty((e.target as HTMLInputElement).value)} /></div>
        <div class="field"><label for="f-note">메모</label><textarea id="f-note" rows={3} value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} /></div>
        <div class="row">
          <button type="submit" disabled={!name.trim()}>{isNew ? '추가' : '저장'}</button>
          {isNew && <button type="button" class="ghost" disabled={!name.trim()} onClick={saveAndContinue}>저장하고 계속 추가</button>}
          {existing && <button type="button" class="danger" onClick={remove}>삭제</button>}
        </div>
      </form>
      {existing && <p class="muted">마지막 수정 {new Date(existing.updatedAt).toLocaleString('ko-KR')}</p>}
    </main>
  );
}
