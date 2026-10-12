import { useState } from 'preact/hooks';
import { db } from '../firebase';
import type { GateState } from '../lib/gate';
import { toNetwork } from '../lib/ip';
import { code, leave, refreshIps, retryHousehold } from '../state';
import { addNetworks } from '../store/household';

const RELAY_HINT = 'iPhone에서 iCloud 비공개 릴레이·VPN·"IP 주소 추적 제한"이 켜져 있으면 집에서도 다른 주소로 보여요. 설정 → Wi-Fi → 집 네트워크(i) → "IP 주소 추적 제한" 끄기, iCloud 비공개 릴레이 끄기, 그리고 "Wi-Fi 지원"(셀룰러 폴백)도 끈 뒤 다시 확인하세요.';

export function Gate({ state }: { state: Exclude<GateState, { kind: 'allowed' | 'no-code' }> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const leaveWithConfirm = () => { if (confirm('이 기기에서 가구 코드를 지우고 다른 코드로 들어갈까요?')) void leave(); };

  if (state.kind === 'checking') return <main class="page center"><p class="muted">집 네트워크 확인 중…</p></main>;

  if (state.kind === 'error') {
    const msg: Record<typeof state.reason, string> = {
      'ip-lookup-failed': '네트워크 확인에 실패했어요. 인터넷 연결을 확인하고 다시 시도하세요.',
      'household-missing': '이 가구 코드로 등록된 집이 없어요. 코드를 다시 확인하세요.',
      'household-failed': '집 정보를 불러오지 못했어요(권한 또는 네트워크). 다시 시도하세요.',
      'auth-failed': '로그인에 실패했어요. 잠시 후 다시 시도하세요.',
    };
    const retry = () => {
      if (state.reason === 'auth-failed') { location.reload(); return; }
      if (state.reason === 'household-failed' || state.reason === 'household-missing') retryHousehold();
      void refreshIps(true);
    };
    return (
      <main class="page center">
        <p>{msg[state.reason]}</p>
        <div class="row" style="justify-content:center">
          <button onClick={retry}>다시 시도</button>
          {state.reason === 'household-missing' && <button class="ghost" onClick={leaveWithConfirm}>코드 다시 입력</button>}
        </div>
      </main>
    );
  }

  const register = async () => {
    if (!confirm(state.firstRun ? '지금 연결된 네트워크를 집으로 등록할까요?' : '지금 집에 있나요? 이 네트워크를 집으로 등록합니다.')) return;
    setBusy(true); setError('');
    try {
      const t = Date.now();
      await addNetworks(db, code.value!, state.ips.map((ip) => toNetwork(ip, '집', t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록 실패');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="page center">
      <h2>{state.firstRun ? '첫 설정: 집 네트워크 등록' : '집 와이파이에서만 열 수 있어요'}</h2>
      <p class="muted">{state.firstRun ? '지금 연결된 네트워크를 집으로 등록할게요.' : '지금 집이라면 이 네트워크를 집으로 등록하세요. 통신사가 주소를 바꿨을 때도 이렇게 복구해요.'}</p>
      <p class="muted">현재 주소: {state.ips.join(', ')}</p>
      {error && <p class="error">{error}</p>}
      <div class="row" style="justify-content:center">
        <button disabled={busy} onClick={register}>이 네트워크를 집으로 등록</button>
        <button class="ghost" onClick={() => void refreshIps(true)}>다시 확인</button>
      </div>
      <p class="muted" style="text-align:left">{RELAY_HINT}</p>
      <p><button class="ghost" onClick={leaveWithConfirm}>다른 코드로 들어가기</button></p>
    </main>
  );
}
