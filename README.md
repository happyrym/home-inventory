# 어디뒀지

집 물건 위치 검색 PWA. GitHub Pages + Firebase(Firestore, Anonymous Auth). 집 와이파이(공인 IP)에서만 열린다.

## 개발
- 요구: node 24, JDK 21(에뮬레이터 — `scripts/with-java21.sh`가 npm 스크립트 안에서만 선택. `brew install openjdk@21`)
- `npm run emu` → `npm run emu:seed` → `npm run dev:emu` (dev 코드 `devdevdevdevdevdevdevdevde`)
- 테스트: `npm test`(단위), `npm run test:rules`(규칙·스토어, 에뮬레이터 자동 기동)

## 배포
- `main` push → GitHub Actions → Pages. Firestore 규칙: `npx firebase deploy --only firestore:rules`.
- `src/firebase.config.ts`에 Firebase 웹 config(공개값)를 넣고, Firestore `households/<가구코드>` 문서를 콘솔에서 1회 생성한다.
