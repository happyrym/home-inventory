import { useState } from 'preact/hooks';
import { pathOf, tree } from '../state';
import { PlaceTree } from './PlaceTree';

interface Props { value: string | null; onChange: (id: string | null) => void; excludeId?: string | null; allowRoot?: boolean; label?: string }

export function PlacePicker({ value, onChange, excludeId, allowRoot = true, label }: Props) {
  const [open, setOpen] = useState(false);
  const current = value ? pathOf.value(value) || '(삭제된 공간)' : allowRoot ? '위치 없음 — 선택하기' : '최상위';
  return (
    <>
      <button type="button" class="ghost" style="text-align:left;padding-left:0" onClick={() => setOpen(true)}>{label ?? current}</button>
      {open && (
        <div class="modal" onClick={() => setOpen(false)}>
          <div class="sheet tree" onClick={(e) => e.stopPropagation()}>
            <div class="row" style="justify-content:space-between">
              <strong>{label ?? '위치 선택'}</strong>
              <button class="ghost" onClick={() => setOpen(false)}>닫기</button>
            </div>
            {allowRoot && <button class="ghost" onClick={() => { onChange(null); setOpen(false); }}>위치 없음</button>}
            <PlaceTree nodes={tree.value} selectedId={value} disabledId={excludeId ?? null} onSelect={(id) => { onChange(id); setOpen(false); }} />
            {tree.value.length === 0 && <p class="muted">공간이 없어요. 상단 '공간'에서 먼저 만드세요.</p>}
          </div>
        </div>
      )}
    </>
  );
}
