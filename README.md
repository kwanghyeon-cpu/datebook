# 날짜도감 웹

생년월일을 넣으면 같은 날 태어난 사람, 같은 날 세상을 떠난 사람, 그날의 역사와 기념일을 보여 주는 [날짜도감](https://play.google.com/store/apps/details?id=com.khcompany.birthdaytwin) 앱의 웹 버전입니다.

- 1월 1일 ~ 12월 31일(2월 29일 포함) **366개 날짜 페이지**를 미리 만들어 두는 정적 사이트입니다. 검색 엔진이 날짜별 내용을 그대로 읽을 수 있습니다.
- 자료는 한국어 위키백과의 날짜 문서(예: 「3월 15일」)입니다. **일주일에 한 번** 새로 받아 다시 만들므로, 방문자가 많아도 위키백과에는 일주일에 366번만 묻습니다.
- 생년월일은 **브라우저에서만** 계산하고 그 브라우저의 저장소(localStorage)에만 둡니다. 주소나 서버로 보내지 않습니다.
- 외부 라이브러리 없이 Node(20 이상)만으로 돕니다.

## 폴더

| 경로 | 내용 |
|---|---|
| `lib/parse.mjs` | 위키 문법 읽기. 앱의 `DayPageParser.kt`를 옮긴 것(한쪽을 고치면 다른 쪽도) |
| `lib/lunar.mjs`, `lib/lunar-data.mjs` | 한국 음력 ↔ 양력(1900~2100년). 표는 앱의 `KoreanLunar.kt`에서 옮김 |
| `scripts/fetch.mjs` | 위키백과에서 366일 자료를 받아 `data/MM-DD.json`으로 저장 |
| `scripts/build.mjs` | `data/`로 `dist/`(첫 화면, 날짜 페이지 366개, summary.json, sitemap) 만들기 |
| `scripts/serve.mjs` | `dist/`를 http://localhost:4173 에서 미리 보기 |
| `site/` | 화면 스크립트(`app.mjs`), 스타일, 아이콘(Iconify: Tabler Icons MIT, Material Design Icons Apache 2.0) |
| `test/` | 앱 테스트와 같은 예시로 파서·음력 확인 |
| `.github/workflows/pages.yml` | 매주 다시 만들어 GitHub Pages에 올리기(웹 저장소 최상위로 옮겨서 씀) |

## 실행

```bash
npm test                     # 파서·음력 테스트
node scripts/fetch.mjs       # 366일 자료 받기(한 번에 하나씩, 20~40분)
node scripts/fetch.mjs 03-15 # 지정한 날짜만
node scripts/build.mjs       # dist/ 만들기 (SITE_URL=https://... 이면 canonical·sitemap 포함)
npm run preview              # 받은 날짜만으로 만들어 미리 보기
```

앱의 음력 표가 바뀌면 앱 저장소에서 `node web/scripts/lunar-data.mjs`로 `lib/lunar-data.mjs`를 다시 만듭니다.

## 출처

글: 한국어 위키백과 (CC BY-SA 4.0). 인물 사진: 위키미디어 공용(사진마다 라이선스가 다름).
