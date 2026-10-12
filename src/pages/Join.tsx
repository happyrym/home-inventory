import { useEffect, useState } from 'preact/hooks';
import { extractCode, isValidCode } from '../lib/household-code';
import { replaceHash } from '../router';
import { code } from '../state';
import { storeCode } from '../store/session';

const isStandaloneIOS = () => /iP(hone|ad)/.test(navigator.userAgent) && (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function Join({ params }: { params: URLSearchParams }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const submit = (raw: string) => {
    const c = extractCode(raw);
    if (!isValidCode(c)) { setError('코드는 영문 소문자·숫자 26자예요. 초대 링크를 통째로 붙여넣어도 돼요.'); return; }
    storeCode(c);
    code.value = c;
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
      {isStandaloneIOS() && <p class="banner">iPhone 홈 화면 앱은 Safari와 저장소가 분리돼요. Safari 설정 화면에서 코드를 복사한 뒤 여기에 붙여넣으세요.</p>}
      <div class="field">
        <input type="text" autocapitalize="none" spellcheck={false} placeholder="가구 코드 26자 또는 초대 링크"
          value={input} onInput={(e) => setInput((e.target as HTMLInputElement).value)} />
      </div>
      {error && <p class="error">{error}</p>}
      <div class="row" style="justify-content:center">
        <button onClick={() => submit(input)}>들어가기</button>
        <button class="ghost" onClick={paste}>붙여넣기</button>
      </div>
    </main>
  );
}
