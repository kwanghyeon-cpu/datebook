// 한국어 위키백과 날짜 문서 366개를 받아 web/data/MM-DD.json으로 저장한다(사진·문서 분량 포함).
// 사용법: node web/scripts/fetch.mjs            (1월 1일 ~ 12월 31일 전부, 2월 29일 포함)
//        node web/scripts/fetch.mjs 03-15 11-20 (지정한 날짜만)
// 위키백과에 부담을 주지 않도록 한 번에 하나씩, 사이를 두고 묻는다. 매주 한 번 GitHub Actions에서 돈다.
// 연락처는 환경 변수 WIKI_CONTACT, 없으면 저장소의 local.properties에서 읽는다(위키미디어 User-Agent 정책).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, parsePageStats, withStats } from "../lib/parse.mjs";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(web, "data");
mkdirSync(out, { recursive: true });

const API = "https://ko.wikipedia.org/w/api.php";
const contact = process.env.WIKI_CONTACT || readContact();
const USER_AGENT = `DateBookWeb/1.0 (https://play.google.com/store/apps/details?id=com.khcompany.birthdaytwin${contact ? "; " + contact : ""})`;
const GAP_MS = 200;

function readContact() {
    const file = join(web, "../local.properties");
    if (!existsSync(file)) return "";
    return readFileSync(file, "utf8").match(/^WIKI_CONTACT=(.*)$/m)?.[1]?.trim() ?? "";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 요청이 몰렸다는 응답(429·503)이나 maxlag에는 잠깐 기다렸다 다시 묻는다. */
async function get(params) {
    const url = API + "?" + new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params });
    for (let attempt = 0; ; attempt++) {
        await sleep(GAP_MS);
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Api-User-Agent": USER_AGENT } });
        const retry = Number(res.headers.get("retry-after")) || 5;
        if ((res.status === 429 || res.status === 503) && attempt < 4) { await sleep(retry * 1000); continue; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error?.code === "maxlag" && attempt < 4) { await sleep(retry * 1000); continue; }
        if (json.error) throw new Error(json.error.info ?? json.error.code);
        return json;
    }
}

async function fetchDay(month, day) {
    const page = `${month}월 ${day}일`;
    const wikitext = (await get({ action: "parse", prop: "wikitext", redirects: "1", page })).parse.wikitext;
    const info = parse(month, day, wikitext);
    const titles = [...new Set([...info.births, ...info.deaths].map((p) => p.title).filter(Boolean))];
    let stats = {};
    for (let i = 0; i < titles.length; i += 50) {
        const chunk = titles.slice(i, i + 50);
        const json = await get({
            action: "query", redirects: "1", prop: "info|pageimages", piprop: "thumbnail", pithumbsize: "160", pilimit: "50",
            titles: chunk.join("|"),
        });
        stats = { ...stats, ...parsePageStats(chunk, json) };
    }
    return { ...withStats(info, stats), fetchedAt: new Date().toISOString() };
}

export function allDates() {
    const dates = [];
    const lengths = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    lengths.forEach((n, m) => { for (let d = 1; d <= n; d++) dates.push([m + 1, d]); });
    return dates;
}

const key = (m, d) => `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

if (import.meta.url === `file:///${process.argv[1].replaceAll("\\", "/")}` || process.argv[1]?.endsWith("fetch.mjs")) {
    const only = process.argv.slice(2);
    const dates = only.length ? only.map((k) => k.split("-").map(Number)) : allDates();
    const failed = [];
    for (const [m, d] of dates) {
        try {
            const data = await fetchDay(m, d);
            writeFileSync(join(out, key(m, d) + ".json"), JSON.stringify(data));
            console.log(`${key(m, d)}  태어난 ${data.births.length} · 떠난 ${data.deaths.length} · 역사 ${data.events.length} · 기념일 ${data.holidays.length}`);
        } catch (e) {
            // 실패한 날은 지난번 파일을 그대로 둔다.
            failed.push(key(m, d));
            console.error(`${key(m, d)}  실패: ${e.message}`);
        }
    }
    if (failed.length) {
        console.error(`실패 ${failed.length}개: ${failed.join(" ")}`);
        process.exitCode = 1;
    }
}
