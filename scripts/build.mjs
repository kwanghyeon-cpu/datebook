// web/data/*.json으로 정적 사이트(web/dist)를 만든다.
//   index.html          첫 화면: 생일 넣기, 오늘의 도감, 366일 달력
//   MM-DD/index.html    날짜 페이지 366개(검색 엔진이 읽을 수 있게 내용을 미리 다 넣는다)
//   summary.json        날짜마다 유명한 3명(첫 화면 "오늘의 도감"이 쓴다)
//   sitemap.xml         SITE_URL 환경 변수가 있을 때만(예: https://kwanghyeon-cpu.github.io/datebook)
// 사용법: node web/scripts/build.mjs  (--partial: 받은 날짜만으로 미리 보기. 빠진 날짜 링크는 깨진다)
// 링크는 모두 상대 경로라 어느 주소에 올려도 된다.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { wikiUrl, yearLabel } from "../lib/parse.mjs";
import { allDates } from "./fetch.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(web, "dist");
const SITE_URL = (process.env.SITE_URL || "").replace(/\/$/, "");
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.khcompany.birthdaytwin";
const PRIVACY_URL = "https://kwanghyeon-cpu.github.io/birthdaytwin-privacy/";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const key = (m, d) => `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const label = (m, d) => `${m}월 ${d}일`;

const icons = {};
for (const file of readdirSync(join(web, "site/icons"))) {
    icons[file.replace(".svg", "")] = readFileSync(join(web, "site/icons", file), "utf8")
        .replace(/ width="1em" height="1em"/, "")
        .replace("<svg ", '<svg class="icon" aria-hidden="true" focusable="false" ');
}
const icon = (name) => icons[name] ?? "";

function layout({ root, path, title, description, body, page, month, day }) {
    const canonical = SITE_URL ? `${SITE_URL}/${path}` : "";
    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="날짜도감">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${SITE_URL ? `<meta property="og:image" content="${SITE_URL}/assets/og.png">` : ""}
<meta name="theme-color" content="#D2503C">
<link rel="icon" href="${root}assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Noto+Sans+KR:wght@400;500;700&display=swap">
<link rel="stylesheet" href="${root}assets/style.css">
<script>document.documentElement.classList.add("js")</script>
</head>
<body data-page="${page}"${month ? ` data-month="${month}" data-day="${day}"` : ""}>
<header class="top"><div class="wrap">
  <a class="logo" href="${root}">${icon("mdi-calendar-star")}날짜도감</a>
  <span class="spacer"></span>
  <a class="btn small" href="${PLAY_URL}" rel="noopener">${icon("tabler-brand-google-play")}<span>앱 받기</span></a>
</div></header>
${body}
<footer><div class="wrap">
  <p>자료: 한국어 위키백과${month ? ` <a href="${wikiUrl(label(month, day))}" rel="noopener">「${label(month, day)}」</a>` : ""} 문서를 정리했습니다. 글은 <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ko" rel="noopener">CC BY-SA 4.0</a>, 인물 사진은 위키미디어 공용의 각 사진 라이선스를 따릅니다. 위키백과는 누구나 고칠 수 있어 내용이 정확하지 않을 수 있습니다.</p>
  <p>내 생일은 이 브라우저에만 저장되고 어디로도 보내지 않습니다. · <a href="${PRIVACY_URL}" rel="noopener">개인정보처리방침</a></p>
  <p>아이콘: Tabler Icons(MIT), Material Design Icons(Apache 2.0) · Iconify · 글꼴: 고운돋움, Noto Sans KR(SIL OFL)</p>
</div></footer>
<script type="module" src="${root}assets/app.mjs"></script>
</body>
</html>
`;
}

function appCta() {
    return `<aside class="card warm app-cta">
  <div class="appicon">${icon("mdi-calendar-star")}</div>
  <div>
    <h2>앱으로 받으면 더 편해요</h2>
    <p>생일 하루 전·당일 아침 알림, 홈 화면 위젯, 음력(윤달)·친구 생일까지. 회원가입 없이 무료.</p>
    <a class="btn" href="${PLAY_URL}" rel="noopener">${icon("tabler-brand-google-play")}Google Play에서 날짜도감 받기</a>
  </div>
</aside>`;
}

function personItem(p, i, died) {
    const avatar = p.thumbnail
        ? `<img src="${esc(p.thumbnail)}" alt="" loading="lazy" decoding="async">`
        : esc(p.name.slice(0, 1));
    const name = p.title
        ? `<a class="name" href="${wikiUrl(p.title)}" rel="noopener">${esc(p.name)}</a>`
        : `<span class="name">${esc(p.name)}</span>`;
    const years = p.birthYear == null ? "태어난 해 미상"
        : p.deathYear != null ? `${yearLabel(p.birthYear)} ~ ${yearLabel(p.deathYear)}`
        : p.birthYear > 0 ? `${p.birthYear}년생` : `${yearLabel(p.birthYear)} 출생`;
    // data-*: 정렬·나이 계산·내 생일 강조에 쓴다(app.mjs).
    return `<li class="person" data-i="${i}" data-fame="${p.fame}" data-born="${p.birthYear ?? ""}" data-died="${p.deathYear ?? ""}">
  <span class="avatar">${avatar}</span>
  <div>${name}${p.note ? ` <span class="years">· ${esc(p.note)}</span>` : ""}
    ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
    <p class="years" data-years>${esc(years)}</p></div>
</li>`;
}

const byFame = (a, b) => b.fame - a.fame || (b.birthYear ?? -1e9) - (a.birthYear ?? -1e9);

function dayPage(info, prev, next) {
    const { month, day } = info;
    const births = [...info.births].sort(byFame);
    const deaths = [...info.deaths].sort((a, b) => b.fame - a.fame || (b.deathYear ?? -1e9) - (a.deathYear ?? -1e9));
    const top = births.slice(0, 3).map((p) => p.name);
    const title = `${label(month, day)}에 태어난 사람 · 그날의 역사 | 날짜도감`;
    const description = `${label(month, day)}에 태어난 사람 ${info.births.length}명${top.length ? `(${top.join(", ")} 등)` : ""}, 세상을 떠난 사람 ${info.deaths.length}명, 그날의 역사 ${info.events.length}가지와 기념일 ${info.holidays.length}개. 내 생일과 같은 날 태어난 사람을 찾아보세요.`;
    const tab = (id, iconName, text, count) =>
        `<a href="#${id}" role="tab" aria-controls="${id}">${icon(iconName)}<span>${text}</span><b>${count}</b></a>`;
    const events = info.events.map((e) => {
        const text = e.title ? `<a href="${wikiUrl(e.title)}" rel="noopener">${esc(e.text)}</a>` : esc(e.text);
        return `<li class="event" data-year="${e.year ?? ""}"><span class="year">${e.year == null ? "" : esc(yearLabel(e.year))}</span><span>${text}${e.isCulture ? '<span class="tag">문화</span>' : ""}</span></li>`;
    }).join("\n");
    const holidays = info.holidays.map((h) =>
        `<li>${h.title ? `<a href="${wikiUrl(h.title)}" rel="noopener">${esc(h.text)}</a>` : esc(h.text)}</li>`).join("\n");

    const body = `<main class="wrap">
<section class="day-hero">
  <nav class="daynav" aria-label="다른 날짜">
    <a href="../${key(prev.month, prev.day)}/">${icon("tabler-chevron-left")}${label(prev.month, prev.day)}</a>
    <a href="../${key(next.month, next.day)}/">${label(next.month, next.day)}${icon("tabler-chevron-right")}</a>
  </nav>
  <h1>${label(month, day)}</h1>
  <p class="lede">이날 태어난 사람 ${info.births.length}명 · 떠난 사람 ${info.deaths.length}명 · 역사 ${info.events.length}가지 · 기념일 ${info.holidays.length}개</p>
  <div class="card warm mine" id="mine" hidden></div>
  <form class="card ask" id="ask" hidden>
    <label class="field" for="ask-year">${label(month, day)}에 태어났다면, 태어난 해
      <input id="ask-year" name="year" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="1990" autocomplete="bday-year"></label>
    <button class="btn" type="submit">나와 같은 날 태어난 사람 보기</button>
    <p class="error" id="ask-error" hidden></p>
  </form>
  <div class="actions">
    <button class="btn ghost small" type="button" id="share">${icon("tabler-share")}이 날짜 공유</button>
    <a class="btn ghost small" href="../">${icon("tabler-calendar-search")}다른 날짜 찾아보기</a>
  </div>
</section>

<nav class="tabs" role="tablist" aria-label="내용">
  ${tab("births", "tabler-cake", "태어난", info.births.length)}
  ${tab("deaths", "tabler-flower", "떠난", info.deaths.length)}
  ${tab("events", "tabler-history", "역사", info.events.length)}
  ${tab("holidays", "tabler-calendar-heart", "기념일", info.holidays.length)}
</nav>

<section class="panel" id="births" role="tabpanel">
  <div id="twins" hidden><h2>${icon("tabler-sparkles")}나와 동갑, 생일도 같아요</h2><ol class="people"></ol></div>
  <h2>${icon("tabler-cake")}${label(month, day)}에 태어난 사람</h2>
  ${births.length ? `<div class="chips" role="group" aria-label="정렬">
    <button class="chip" type="button" data-sort="fame" aria-pressed="true">유명한 순</button>
    <button class="chip" type="button" data-sort="old" aria-pressed="false">오래된 순</button>
    <button class="chip" type="button" data-sort="new" aria-pressed="false">최근 순</button>
  </div>
  <ol class="people" id="birth-list">${births.map((p, i) => personItem(p, i, false)).join("\n")}</ol>` : '<p class="empty">이날 태어난 사람이 위키백과에 아직 없어요.</p>'}
</section>

<section class="panel" id="deaths" role="tabpanel">
  <div id="same-day-deaths" hidden><h2>${icon("tabler-sparkles")}내가 태어난 날 떠났어요</h2><ol class="people"></ol></div>
  <h2>${icon("tabler-flower")}${label(month, day)}에 세상을 떠난 사람</h2>
  ${deaths.length ? `<ol class="people">${deaths.map((p, i) => personItem(p, i, true)).join("\n")}</ol>` : '<p class="empty">이날 세상을 떠난 사람이 위키백과에 아직 없어요.</p>'}
</section>

<section class="panel" id="events" role="tabpanel">
  <div id="my-year" hidden><h2>${icon("tabler-sparkles")}내가 태어난 날에는</h2><ol class="events"></ol></div>
  <h2>${icon("tabler-history")}역사 속 ${label(month, day)}</h2>
  ${info.events.length ? `<ol class="events">${events}</ol>` : '<p class="empty">이날의 사건이 위키백과에 아직 없어요.</p>'}
</section>

<section class="panel" id="holidays" role="tabpanel">
  <h2>${icon("tabler-calendar-heart")}${label(month, day)}의 기념일</h2>
  ${info.holidays.length ? `<ul class="holidays">${holidays}</ul>` : '<p class="empty">이날의 기념일이 위키백과에 아직 없어요.</p>'}
</section>

${appCta()}
</main>`;
    return layout({ root: "../", path: `${key(month, day)}/`, title, description, body, page: "day", month, day });
}

function indexPage(dates) {
    const months = Array.from({ length: 12 }, (_, i) => {
        const days = dates.filter(([m]) => m === i + 1);
        // 첫 줄 앞을 비워 요일을 맞추지는 않는다(해마다 달라서). 1일부터 차례로 둔다.
        return `<section class="month" aria-label="${i + 1}월"><h3>${i + 1}월</h3><div class="days">${days.map(([m, d]) =>
            `<a href="${key(m, d)}/" data-key="${key(m, d)}" aria-label="${label(m, d)}">${d}</a>`).join("")}</div></section>`;
    }).join("\n");
    const body = `<main class="wrap">
<section class="hero">
  <h1>내 생일엔<br>무슨 일이 있었을까?</h1>
  <p class="lede">생년월일을 넣으면 같은 날 태어난 사람, 같은 날 세상을 떠난 사람, 그날의 역사와 기념일을 한 권의 도감처럼 펼쳐 드려요.</p>
</section>

<form class="card warm" id="birthday">
  <h2>내 생일 넣기</h2>
  <div class="form">
    <div class="seg" role="radiogroup" aria-label="달력">
      <label><input type="radio" name="calendar" value="solar" checked><span>양력</span></label>
      <label><input type="radio" name="calendar" value="lunar"><span>음력</span></label>
    </div>
    <div class="fields">
      <label class="field" for="b-year">년<input id="b-year" name="year" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="1990" autocomplete="bday-year" required></label>
      <label class="field" for="b-month">월<input id="b-month" name="month" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="3" autocomplete="bday-month" required></label>
      <label class="field" for="b-day">일<input id="b-day" name="day" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="15" autocomplete="bday-day" required></label>
    </div>
    <label class="check" id="leap-row" hidden><input type="checkbox" id="b-leap" name="leap"> 윤달</label>
    <p class="error" id="b-error" hidden></p>
    <div><button class="btn" type="submit">같은 날 태어난 사람 보기</button></div>
    <p class="years">생일은 이 브라우저에만 저장되고 어디로도 보내지 않아요.</p>
  </div>
</form>

<div class="grid-2">
  <section class="card" id="today">
    <h2>${icon("tabler-sparkles")} 오늘의 도감</h2>
    <ol class="today-list" id="today-list"><li><span>오늘 태어난 사람을 불러오는 중…</span></li></ol>
    <a class="btn ghost small" id="today-link" href="./">오늘 날짜 펼쳐 보기</a>
  </section>
  <form class="card" id="other">
    <h2>${icon("tabler-calendar-search")} 다른 날짜 찾아보기</h2>
    <p class="years">결혼기념일, 첫 만남, 역사 속 그날까지.</p>
    <div class="form">
      <label class="field" for="other-date">날짜<input id="other-date" type="date" min="1900-01-01" max="2100-12-31" required></label>
      <div><button class="btn ghost" type="submit">그날 펼쳐 보기</button></div>
    </div>
  </form>
</div>

<h2 class="section-title">${icon("tabler-layout-grid")}366일 모두 보기</h2>
<div class="months">${months}</div>

${appCta()}
</main>`;
    return layout({
        root: "./", path: "", page: "home",
        title: "날짜도감 · 내 생일과 같은 날 태어난 사람, 그날의 역사",
        description: "생년월일을 넣으면 같은 날 태어난 유명인, 같은 날 세상을 떠난 사람, 그날의 역사와 기념일을 보여 드려요. 1월 1일부터 12월 31일까지 366일을 한국어 위키백과로 정리했습니다.",
        body,
    });
}

// ── 만들기 ──
const dates = allDates();
const missing = dates.filter(([m, d]) => !existsSync(join(web, "data", key(m, d) + ".json")));
const partial = process.argv.includes("--partial");
if (missing.length && !partial) throw new Error(`자료가 없는 날짜 ${missing.length}개(먼저 node web/scripts/fetch.mjs): ${missing.slice(0, 5).map(([m, d]) => key(m, d)).join(" ")}…`);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "assets"), { recursive: true });
cpSync(join(web, "site/style.css"), join(dist, "assets/style.css"));
cpSync(join(web, "site/app.mjs"), join(dist, "assets/app.mjs"));
cpSync(join(web, "lib/lunar.mjs"), join(dist, "assets/lunar.mjs"));
cpSync(join(web, "lib/lunar-data.mjs"), join(dist, "assets/lunar-data.mjs"));
writeFileSync(join(dist, "assets/icon.svg"), readFileSync(join(web, "site/icons/mdi-calendar-star.svg"), "utf8").replace("currentColor", "#D2503C"));
cpSync(join(web, "site/og.png"), join(dist, "assets/og.png")); // 스토어 그래픽 이미지(1024×500)와 같은 그림

const summary = {};
dates.forEach(([m, d], i) => {
    if (!existsSync(join(web, "data", key(m, d) + ".json"))) return;
    const info = JSON.parse(readFileSync(join(web, "data", key(m, d) + ".json"), "utf8"));
    const [pm, pd] = dates[(i - 1 + dates.length) % dates.length];
    const [nm, nd] = dates[(i + 1) % dates.length];
    mkdirSync(join(dist, key(m, d)), { recursive: true });
    writeFileSync(join(dist, key(m, d), "index.html"), dayPage(info, { month: pm, day: pd }, { month: nm, day: nd }));
    summary[key(m, d)] = [...info.births].sort(byFame).slice(0, 3).map((p) => [p.name, p.description, p.birthYear]);
});
writeFileSync(join(dist, "summary.json"), JSON.stringify(summary));
writeFileSync(join(dist, "index.html"), indexPage(dates));
// 404는 어느 깊이의 주소에서든 보이므로 상대 경로 대신 사이트 주소를 쓴다.
const home404 = SITE_URL ? SITE_URL + "/" : "/";
writeFileSync(join(dist, "404.html"), layout({
    root: home404, path: "404.html", page: "missing", title: "찾는 날짜가 없어요 | 날짜도감", description: "",
    body: `<main class="wrap hero"><h1>찾는 날짜가 없어요</h1><p class="lede">주소가 바뀌었을 수 있어요.</p><p><a class="btn" href="${home404}">날짜도감 첫 화면으로</a></p></main>`,
}));
writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n${SITE_URL ? `Sitemap: ${SITE_URL}/sitemap.xml\n` : ""}`);
if (SITE_URL) {
    const today = new Date().toISOString().slice(0, 10);
    const urls = ["", ...dates.map(([m, d]) => key(m, d) + "/")]
        .map((p) => `<url><loc>${SITE_URL}/${p}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq></url>`);
    writeFileSync(join(dist, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
}
console.log(`dist: 날짜 페이지 ${dates.length}개${SITE_URL ? ` · ${SITE_URL}` : " · SITE_URL 없음(canonical·sitemap 생략)"}`);
