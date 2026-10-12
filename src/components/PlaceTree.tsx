import type { PlaceNode } from '../lib/places';

interface Props { nodes: PlaceNode[]; onSelect: (id: string) => void; selectedId?: string | null; disabledId?: string | null; disabled?: boolean }

export function PlaceTree({ nodes, onSelect, selectedId, disabledId, disabled = false }: Props) {
  return (
    <ul>
      {nodes.map((n) => {
        const isDisabled = disabled || n.id === disabledId;
        return (
          <li key={n.id}>
            <button class="ghost" disabled={isDisabled} style={n.id === selectedId ? 'font-weight:700' : ''} onClick={() => onSelect(n.id)}>{n.name}</button>
            {n.children.length > 0 && <PlaceTree nodes={n.children} onSelect={onSelect} selectedId={selectedId} disabledId={disabledId} disabled={isDisabled} />}
          </li>
        );
      })}
    </ul>
  );
}
