import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'preact/hooks';
import { db } from '../firebase';
import { joinLink } from '../lib/household-code';
import { navigate } from '../router';
import { matchesAny } from '../lib/ip';
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
  // iOS 홈 화면 앱은 a[download]를 조용히 무시할 수 있어 파일 공유 시트를 먼저 시도한다.
  // revokeObjectURL을 바로 부르면 Safari가 다운로드를 시작하기 전에 URL이 사라지므로 늦춘다.
  const exportJson = async () => {
    const name = `home-inventory-${new Date().toISOString().slice(0, 10)}.json`;
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), places: places.value, items: items.value }, null, 2);
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: '어디뒀지 백업' }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(file);
    Object.assign(document.createElement('a'), { href: url, download: name }).click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setNote('내려받기를 시작했어요');
  };

  const nets = household.value?.allowedNetworks ?? [];
  const current = ips.value ?? [];
  const isCurrent = (addr: string) => matchesAny(current, nets.filter((n) => n.addr === addr));

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
            <span>{n.addr} <span class="muted">{n.kind} · {new Date(n.addedAt).toLocaleDateString('ko-KR')}{isCurrent(n.addr) ? ' · 지금 연결됨' : ''}</span></span>
            <button class="ghost" disabled={nets.length === 1} onClick={() => { if (confirm(isCurrent(n.addr) ? `${n.addr}은(는) 지금 연결된 네트워크예요. 지우면 바로 차단돼요. 그래도 지울까요?` : `${n.addr} 삭제할까요?`)) void removeNetwork(db, c, n.addr).catch((e) => setNote(e instanceof Error ? e.message : String(e))); }}>삭제</button>
          </li>
        ))}
      </ul>
      <p class="muted">현재 주소: {current.join(', ') || '-'}. 마지막 하나는 지울 수 없어요(차단 방지).</p>

      <h3>백업</h3>
      <p class="muted">공간·물건 전체를 JSON으로 내려받아요. 코드가 유출되면 새 가구 코드로 들어간 뒤 '공간' 화면에서 이 파일을 가져오면 돼요.</p>
      <button class="ghost" onClick={() => void exportJson()}>JSON 내보내기</button>

      <h3>나가기</h3>
      <p class="muted">이 기기에서 가구 코드와 저장된 사본을 지워요. 집 데이터는 그대로 남아요.</p>
      <button class="danger" onClick={() => { if (confirm('이 기기에서 나갈까요?')) void leave(); }}>이 기기에서 나가기</button>
    </main>
  );
}
