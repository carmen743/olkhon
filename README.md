# 알혼커피 근무표 (PWA)

## 파일
- index.html — 화면
- app.js — 근무표 기능
- store.js — 저장소 (지금은 각 기기에만 저장 / 다음 단계에서 공유 DB 연결)
- manifest.webmanifest, icons/ — 앱 이름·아이콘
- sw.js — 오프라인 실행

## Vercel 배포 (드래그 앤 드롭)
1. vercel.com 가입 (GitHub 계정으로 로그인하면 편해요)
2. 터미널이 편하면: 이 폴더에서 `npx vercel --prod`
   또는 GitHub에 이 폴더를 올리고 Vercel에서 "Add New → Project → Import"
3. 생성된 주소(예: olkhon.vercel.app)를 폰에서 열고 "홈 화면에 추가"

## 로컬 미리보기
`npx serve .` 후 http://localhost:3000
