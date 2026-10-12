import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'preact/hooks';
import { db } from '../firebase';
import { joinLink } from '../lib/household-code';
import { navigate } from '../router';
import { code, household, ips, items, leave, places } from '../state';
import { removeNetwork } from '../store/household';

export function Settings() {
  const c = code.value!;
  const link = joinLink(c);
  const [qr, setQr] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { void toDataURL(link, { width: 240, margin: 1 }).then(setQr); }, [link]);

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); setNote(`${label} 복사됨`); } catch { setNote('복사 실패 — 길게 눌러 복사하세요'); }
  };
  const share = async () => {
    if (navigator.share) { await navigator.share({ title: '어디뒀지 초대', url: link }).catch(() => {}); return; }
    await copy(link, '링크');
  };
  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), places: places.value, items: items.value }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `home-inventory-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const nets = household.value?.allowedNetworks ?? [];

  return (
    <main class="page">
      <div class="topbar">
        <button class="ghost" onClick={() => navigate('/')}>← 검색</button>
        <h2 style="margin:0">설정</h2>
      </div>
      {note && <p class="banner">{note}</p>}

      <h3>가족 초대</h3>
      <p class="muted">QR을 찍거나 링크를 보내면 바로 들어올 수 있어요. iPhone 홈 화면 앱에서는 아래 코드를 복사해 붙여넣어야 해요.</p>
      {qr && <img src={qr} alt="초대 QR" width={240} height={240} />}
      <p class="code">{c}</p>
      <div class="row">
        <button onClick={share}>링크 공유</button>
        <button class="ghost" onClick={() => copy(c, '코드')}>코드 복사</button>
      </div>

      <h3>등록된 집 네트워크</h3>
      <ul class="list">
        {nets.map((n) => (
          <li key={n.addr} class="row" style="justify-content:space-between">
            <span>{n.addr} <span class="muted">{n.kind} · {new Date(n.addedAt).toLocaleDateString('ko-KR')}</span></span>
            <button class="ghost" disabled={nets.length === 1} onClick={() => { if (confirm(`${n.addr} 삭제할까요?`)) void removeNetwork(db, c, n.addr).catch((e) => setNote(String(e))); }}>삭제</button>
          </li>
        ))}
      </ul>
      <p class="muted">현재 주소: {(ips.value ?? []).join(', ') || '-'}. 마지막 하나는 지울 수 없어요(차단 방지).</p>

      <h3>백업</h3>
      <p class="muted">공간·물건 전체를 JSON으로 내려받아요. 코드가 유출됐을 때 새 집으로 옮기는 용도이기도 해요.</p>
      <button class="ghost" onClick={exportJson}>JSON 내보내기</button>

      <h3>나가기</h3>
      <p class="muted">이 기기에서 가구 코드를 지워요. 데이터는 그대로 남아요.</p>
      <button class="danger" onClick={() => { if (confirm('이 기기에서 나갈까요?')) { leave(); navigate('/'); } }}>이 기기에서 나가기</button>
    </main>
  );
}
