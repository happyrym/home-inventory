import { useState } from 'preact/hooks';
import { PlacePicker } from '../components/PlacePicker';
import { db } from '../firebase';
import { normalizeItem, normalizePlace } from '../lib/normalize';
import { canDeletePlace, isDescendant, mergeSeed, nextOrder, validateSeed, type PlaceNode } from '../lib/places';
import type { PlaceKind } from '../lib/types';
import { navigate } from '../router';
import { code, dataReady, items, places, tree } from '../state';
import { createItems, createPlace, createPlaces, deletePlace, newPlaceId, updatePlace } from '../store/data';

const KIND_LABEL: Record<PlaceKind, string> = { room: '방/구역', furniture: '가구', section: '칸/선반', container: '상자/파우치' };
const errMsg = (e: unknown) => `실패: ${e instanceof Error ? e.message : String(e)}`;

function Node({ node, onEdit }: { node: PlaceNode; onEdit: (n: PlaceNode) => void }) {
  const count = items.value.filter((i) => i.placeId === node.id).length;
  return (
    <li>
      <div class="row" style="justify-content:space-between">
        <button class="ghost" style="padding-left:0" onClick={() => navigate(`/place/${node.id}`)}>
          {node.name} {count > 0 && <span class="muted">({count})</span>}
        </button>
        <button class="ghost" onClick={() => onEdit(node)}>편집</button>
      </div>
      {node.children.length > 0 && <ul>{node.children.map((c) => <Node key={c.id} node={c} onEdit={onEdit} />)}</ul>}
    </li>
  );
}

export function Places() {
  const [editing, setEditing] = useState<PlaceNode | 'new' | null>(null);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PlaceKind>('room');
  const [parentId, setParentId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [modalMsg, setModalMsg] = useState('');

  const open = (target: PlaceNode | 'new') => {
    setEditing(target);
    setName(target === 'new' ? '' : target.name);
    setKind(target === 'new' ? 'room' : target.kind);
    setParentId(target === 'new' ? null : target.parentId);
    setModalMsg('');
  };

  const save = () => {
    if (!name.trim()) return;
    const c = code.value!;
    if (editing === 'new') {
      void createPlace(db, c, { name: name.trim(), kind, parentId, order: nextOrder(places.value, parentId) }).catch((e) => setMsg(errMsg(e)));
    } else if (editing) {
      if (parentId && (parentId === editing.id || isDescendant(places.value, editing.id, parentId))) { setModalMsg('자기 자신이나 하위 공간으로는 옮길 수 없어요.'); return; }
      const moved = parentId !== editing.parentId;
      void updatePlace(db, c, editing.id, { name: name.trim(), kind, parentId, ...(moved ? { order: nextOrder(places.value, parentId) } : {}) }).catch((e) => setMsg(errMsg(e)));
    }
    setEditing(null);
  };

  const remove = () => {
    if (editing === 'new' || !editing || !dataReady.value) return;
    if (!canDeletePlace(editing.id, places.value, items.value)) { setModalMsg('하위 공간이나 물건이 있으면 삭제할 수 없어요. 먼저 옮기세요.'); return; }
    if (!confirm(`'${editing.name}' 삭제할까요?`)) return;
    void deletePlace(db, code.value!, editing.id).catch((e) => setMsg(errMsg(e)));
    setEditing(null);
  };

  // 두 형식을 받는다: 공간 시드 배열 [{name,kind,children}] 과 설정의 백업 {places,items}.
  // 백업은 id를 보존해 set하므로 코드 유출 뒤 새 가구로 옮기거나 같은 파일을 다시 넣어도 중복이 없다.
  const importFile = async (file: File) => {
    if (!dataReady.value) { setMsg('아직 불러오는 중이에요. 잠시 후 다시 시도하세요.'); return; }
    try {
      const raw: unknown = JSON.parse(await file.text());
      const c = code.value!;
      if (raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray((raw as { places?: unknown }).places)) {
        const backup = raw as { places: Record<string, unknown>[]; items?: Record<string, unknown>[] };
        const ps = backup.places.filter((p) => typeof p.id === 'string').map((p) => normalizePlace(p.id as string, p));
        const is = (backup.items ?? []).filter((i) => typeof i.id === 'string').map((i) => normalizeItem(i.id as string, i));
        if (!confirm(`백업 복원: 공간 ${ps.length}개, 물건 ${is.length}개를 이 집에 넣을까요? (같은 id는 덮어써요)`)) return;
        void createPlaces(db, c, ps).then(() => createItems(db, c, is)).catch((e) => setMsg(errMsg(e)));
        setMsg(`백업 복원 요청: 공간 ${ps.length}, 물건 ${is.length}`);
        return;
      }
      const seed = validateSeed(raw);
      const created = mergeSeed(places.value, seed, () => newPlaceId(db, c), Date.now());
      if (created.length === 0) { setMsg('추가할 새 공간이 없어요(모두 이미 있음).'); return; }
      if (!confirm(`공간 ${created.length}개를 추가할까요?`)) return;
      void createPlaces(db, c, created).catch((e) => setMsg(errMsg(e)));
      setMsg(`공간 ${created.length}개 추가`);
    } catch (e) {
      setMsg(`가져오기 ${errMsg(e)}`);
    }
  };

  return (
    <main class="page tree">
      <div class="topbar">
        <button class="ghost" onClick={() => navigate('/')}>← 검색</button>
        <h2 style="margin:0;flex:1">공간</h2>
        <button onClick={() => open('new')}>+ 공간</button>
      </div>
      {msg && <p class="muted">{msg}</p>}
      {!dataReady.value && <p class="center muted">불러오는 중…</p>}
      {dataReady.value && tree.value.length === 0 && <p class="center muted">아직 공간이 없어요. '+ 공간' 또는 JSON 가져오기로 시작하세요.</p>}
      <ul>{tree.value.map((n) => <Node key={n.id} node={n} onEdit={open} />)}</ul>
      <p><label class="muted">공간 JSON·백업 가져오기 <input type="file" accept="application/json" onChange={(e) => { const el = e.target as HTMLInputElement; const f = el.files?.[0]; el.value = ''; if (f) void importFile(f); }} /></label></p>

      {editing && (
        <div class="modal" onClick={() => setEditing(null)}>
          <div class="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{editing === 'new' ? '공간 추가' : '공간 편집'}</h3>
            <div class="field"><label for="p-name">이름</label><input id="p-name" type="text" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} /></div>
            <div class="field"><label>종류</label>
              <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value as PlaceKind)}>
                {(Object.keys(KIND_LABEL) as PlaceKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </div>
            <div class="field"><label>상위 공간</label>
              <PlacePicker value={parentId} onChange={setParentId} excludeId={editing === 'new' ? null : editing.id} allowRoot={false} />
              <button class="ghost" style="padding-left:0" onClick={() => setParentId(null)}>최상위로</button>
            </div>
            {modalMsg && <p class="error">{modalMsg}</p>}
            <div class="row">
              <button disabled={!name.trim()} onClick={save}>저장</button>
              {editing !== 'new' && <button class="danger" onClick={remove}>삭제</button>}
              <button class="ghost" onClick={() => setEditing(null)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
