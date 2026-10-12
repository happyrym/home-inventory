import { useEffect, useState } from 'preact/hooks';
import { extractCode, isValidCode } from '../lib/household-code';
import { replaceHash } from '../router';
import { adoptCode, code } from '../state';

// iPad의 UA는 Macintosh라 UA 검사는 쓰지 않는다. navigator.standalone은 iOS 홈 화면 앱에서만 true.
const isStandaloneIOS = () => (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function Join({ params }: { params: URLSearchParams }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const submit = (raw: string) => {
    const c = extractCode(raw);
    if (!isValidCode(c)) { setError('코드는 영문 소문자·숫자 26자예요. 초대 링크를 통째로 붙여넣어도 돼요.'); return; }
    // 남이 보낸 가짜 초대 링크가 기존 가구를 조용히 바꿔치기하지 못하게, 다른 코드면 한 번 확인한다.
    if (code.value && code.value !== c && !confirm('이미 다른 집에 들어가 있어요. 이 코드의 집으로 바꿀까요?')) { replaceHash('/'); return; }
    adoptCode(c);
    replaceHash('/');
  };

  const fromLink = params.get('code');
  useEffect(() => { if (fromLink) submit(fromLink); }, [fromLink]);

  const paste = async () => {
    try { submit(await navigator.clipboard.readText()); } catch { setError('붙여넣기 권한이 없어요. 직접 입력해 주세요.'); }
  };

  return (
    <main class="page center">
      <h1>어디뒀지</h1>
      <p class="muted">가족에게 받은 가구 코드(또는 초대 링크)를 입력하세요. 기기당 한 번만 하면 돼요.</p>
      {isStandaloneIOS() && <p class="banner">iPhone 홈 화면 앱은 Safari와 저장소가 분리돼요. 가족에게 받은 초대 링크(또는 Safari 설정 화면의 코드)를 길게 눌러 복사한 뒤 '붙여넣기'를 누르세요.</p>}
      <form onSubmit={(e) => { e.preventDefault(); submit(input); }}>
        <div class="field">
          <input type="text" autocapitalize="none" spellcheck={false} aria-label="가구 코드" placeholder="가구 코드 26자 또는 초대 링크"
            value={input} onInput={(e) => setInput((e.target as HTMLInputElement).value)} />
        </div>
        {error && <p class="error">{error}</p>}
        <div class="row" style="justify-content:center">
          <button type="submit">들어가기</button>
          <button type="button" class="ghost" onClick={paste}>붙여넣기</button>
        </div>
      </form>
    </main>
  );
}
