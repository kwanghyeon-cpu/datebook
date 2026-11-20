// 한국어 위키백과 날짜 문서(예: "3월 15일")의 위키텍스트를 읽는다.
// 앱의 data/DayPageParser.kt를 그대로 옮긴 것이다. 한쪽을 고치면 다른 쪽도 고친다.
//
// 문서는 대체로 이렇게 생겼다.
//   == 사건 ==
//   * [[1909년]] - 독립운동가 [[안중근]]이 하얼빈역에서 ...
//   == 탄생 ==
//   * [[1767년]] - 미국의 제7대 대통령 [[앤드루 잭슨]]. (~[[1845년]])
//   * [[1930년]]
//   ** 대한민국의 국회의원 [[양창식]]. (~[[2018년]])
//   == 기념일 ==
//   * [[3·15 마산 의거|3·15 의거]] 기념일: 대한민국
// 날짜마다 소제목(=== 1601년~1900년 === 등)이 있거나 없으므로 소제목은 무시하고 큰 제목만 본다.
// 연도는 정수, 기원전은 음수(기원전 44년 → -44).

const HEADING = /^(=+)\s*(.*?)\s*=+$/;
const LINK_SOURCE = String.raw`\[\[([^\[\]|]+)(?:\|([^\[\]]*))?\]\]`;
const link = () => new RegExp(LINK_SOURCE, "g");
const YEAR_TITLE = /^(기원전\s*)?(\d{1,4})년$/;
const YEAR_PREFIX = /^(?:\[\[)?(기원전\s*)?(\d{1,4})년(?:\]\])?\s*(?:[-–—:]\s*(.*))?$/;
const DEATH = /\(\s*~\s*(?:\[\[)?(기원전\s*)?(\d{1,4})년(?:\]\])?\s*\)/;
// 사망 섹션의 "([[155년]]~)"
const BORN = /\(\s*(?:\[\[)?(기원전\s*)?(\d{1,4})년(?:\]\])?\s*~\s*\)/;
const PAREN = /\([^()]*\)/g;
const INTERWIKI = /^:[a-z-]+:/;

const yearOf = (bc, digits) => (bc && bc.trim() ? -Number(digits) : Number(digits));

export function yearLabel(year) {
    return year < 0 ? `기원전 ${-year}년` : `${year}년`;
}

/** 링크를 보이는 글자로 바꾸고 공백을 정리한다. */
export function plain(text) {
    return text
        // 외부 링크 "[https://… 설명]"은 설명만 남긴다.
        .replace(/\[(?:https?:)?\/\/[^\s\]]+(?:\s+([^\]]*))?\]/g, (_, label) => label ?? "")
        .replace(link(),(_, target, label) => (label ?? "").trim() || target.trim().replace(INTERWIKI, ""))
        .replaceAll("[[", "").replaceAll("]]", "")
        .replace(/\s+/g, " ")
        .replaceAll(" .", ".").replaceAll(" ,", ",")
        .trim();
}

/** 주석·각주·틀·HTML 태그·굵게/기울임을 걷어낸다. */
function clean(wikitext) {
    let text = wikitext
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<ref[^>]*\/>/g, "")
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "");
    // 틀 안에 틀이 들어 있을 수 있어 안쪽부터 여러 번 걷는다.
    const template = /\{\{[^{}]*\}\}/g;
    while (/\{\{[^{}]*\}\}/.test(text)) text = text.replace(template, "");
    return text
        .replace(/\[\[(?:파일|File|그림|Image|분류|Category):[^\[\]]*\]\]/gi, "")
        .replace(/<[^>]+>/g, "")
        .replaceAll("'''", "")
        .replaceAll("''", "");
}

/** 본문 링크 중 이름이 가장 긴 것을 대표 문서로 본다. 대개 사건 이름이 국가·인물 이름보다 길다. */
function mainTitle(text) {
    let best = null;
    for (const m of text.matchAll(link())) {
        const target = m[1].trim();
        if (target.startsWith(":") || YEAR_TITLE.test(target)) continue;
        const label = plain(m[0]);
        if (!best || label.length > best.label.length) best = { target, label };
    }
    return best?.target ?? null;
}

/**
 * 사람 한 줄. 탄생 섹션은 "미국의 제7대 대통령 [[앤드루 잭슨]]. (~[[1845년]])"이고 year가 태어난 해,
 * 사망 섹션(died)은 "로마의 정치인 [[율리우스 카이사르]]. ([[기원전 100년]]~)"이고 year가 세상을 떠난 해다.
 */
export function parsePerson(year, text, died = false) {
    let rest = text;
    const other = died ? BORN : DEATH;
    const found = rest.match(other);
    const otherYear = found ? yearOf(found[1], found[2]) : null;
    rest = rest.replace(new RegExp(other.source, "g"), " ");
    // 이름 뒤 괄호는 소속(그룹 이름 등)이다. 이름을 찾기 전에 떼어 둔다.
    // "[[유경 (가수)|유경]]"처럼 링크 안에도 괄호가 있으므로 링크를 잠시 가려 두고 찾는다.
    const links = [];
    const masked = rest.replace(link(), (m) => { links.push(m); return `\u0000${links.length - 1}\u0000`; });
    const unmask = (s) => s.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
    const note = [...masked.matchAll(PAREN)]
        .map((m) => plain(unmask(m[0].slice(1, -1))))
        .filter((s) => s.trim())
        .join(", ") || null;
    rest = unmask(masked.replace(PAREN, " ")).trim().replace(/[., ]+$/, "");

    const names = [...rest.matchAll(link())].filter((m) => !YEAR_TITLE.test(m[1].trim()));
    const nameLink = names.at(-1);
    // 문서의 오타("[[이름||이름]]", "[[1966년]]]")로 이름 앞뒤에 남은 |·[·]는 걷어 낸다.
    const tidy = (s) => s.replace(/^[|\[\]\s]+|[|\[\]\s]+$/g, "");
    let name, title, description;
    const linkName = nameLink ? tidy(plain(nameLink[0])) : "";
    if (nameLink && linkName) {
        const target = nameLink[1].trim();
        name = linkName;
        title = target.startsWith(":") ? null : target;
        description = plain(rest.slice(0, nameLink.index));
    } else {
        // 문서가 없는 사람: "대한민국의 가수 혁" → 마지막 낱말이 이름이다.
        const words = tidy(plain(nameLink ? rest.replace(nameLink[0], " ") : rest));
        const space = words.lastIndexOf(" ");
        name = tidy(space < 0 ? words : words.slice(space + 1));
        title = null;
        description = space < 0 ? "" : words.slice(0, space);
    }
    // 이름 자리에 연도만 남았으면 사람이 아니다.
    if (!name.trim() || YEAR_TITLE.test(name)) return null;
    return {
        name,
        title,
        description: description.replace(/[, ]+$/, ""),
        birthYear: died ? otherYear : year,
        deathYear: died ? year : otherYear,
        note,
    };
}

function parseEvent(year, text, isCulture) {
    const plainText = plain(text);
    if (!plainText) return null;
    return { year, text: plainText, title: mainTitle(text), isCulture };
}

function parseHoliday(text) {
    // "2월 29일" 문서처럼 줄이 ": 윤년"으로 시작하기도 한다.
    const plainText = plain(text).replace(/^[:\- ]+/, "");
    if (!plainText) return null;
    return { text: plainText, title: mainTitle(text) };
}

export function parse(month, day, wikitext) {
    const events = [], births = [], deaths = [], holidays = [];
    let section = "";
    // "* [[1930년]]" 뒤에 "** 이름" 줄이 이어지면 그 해를 함께 쓴다.
    let pendingYear = null;

    const add = (year, text) => {
        let item = null;
        if (section.startsWith("사건")) (item = parseEvent(year, text, false)) && events.push(item);
        else if (section.startsWith("문화")) (item = parseEvent(year, text, true)) && events.push(item);
        else if (section.startsWith("탄생")) (item = parsePerson(year, text)) && births.push(item);
        else if (section.startsWith("사망")) (item = parsePerson(year, text, true)) && deaths.push(item);
        else if (section.startsWith("기념일")) (item = parseHoliday(text)) && holidays.push(item);
    };

    for (const rawLine of clean(wikitext).split("\n")) {
        const line = rawLine.trim();
        const heading = line.match(HEADING);
        if (heading) {
            if (heading[1].length === 2) section = plain(heading[2]);
            pendingYear = null;
            continue;
        }
        if (!line.startsWith("*")) continue;
        const depth = line.match(/^\*+/)[0].length;
        const body = line.slice(depth).trim();
        if (!body) continue;
        if (depth > 1) {
            add(pendingYear, body);
            continue;
        }
        const match = body.match(YEAR_PREFIX);
        if (!match) {
            pendingYear = null;
            add(null, body);
            continue;
        }
        const year = yearOf(match[1], match[2]);
        const rest = (match[3] ?? "").trim();
        if (!rest) pendingYear = year;
        else {
            pendingYear = null;
            add(year, rest);
        }
    }
    return { month, day, events, births, deaths, holidays };
}

/** action=query 응답을 요청한 제목별 {fame, thumbnail}로 묶는다(앱의 WikiRepository.parsePageStats). */
export function parsePageStats(titles, json) {
    const query = json?.query;
    if (!query) return {};
    // 요청한 제목 → 실제 문서 제목(띄어쓰기 정규화, 넘겨주기).
    const aliases = {};
    for (const key of ["normalized", "redirects"]) for (const item of query[key] ?? []) aliases[item.from] = item.to;
    const pages = {};
    for (const page of query.pages ?? []) {
        if (page.missing) continue;
        pages[page.title] = { fame: page.length ?? 0, thumbnail: page.thumbnail?.source || null };
    }
    const out = {};
    for (const requested of titles) {
        let title = requested;
        for (let i = 0; i < 3 && aliases[title]; i++) title = aliases[title];
        if (pages[title]) out[requested] = pages[title];
    }
    return out;
}

/**
 * 사람마다 문서 분량(유명한 정도)과 사진을 붙인다.
 * 정보를 받았는데 없는 제목은 아직 문서가 없는 빨간 링크라 링크를 뗀다.
 */
export function withStats(info, stats) {
    const known = Object.keys(stats).length > 0;
    const person = (p) => {
        if (!p.title) return { ...p, fame: 0, thumbnail: null };
        const stat = stats[p.title];
        if (!stat) return known ? { ...p, title: null, fame: 0, thumbnail: null } : { ...p, fame: 0, thumbnail: null };
        return { ...p, fame: stat.fame, thumbnail: stat.thumbnail };
    };
    return { ...info, births: info.births.map(person), deaths: info.deaths.map(person) };
}

export const wikiUrl = (title) => "https://ko.wikipedia.org/wiki/" + encodeURIComponent(title.replaceAll(" ", "_"));
