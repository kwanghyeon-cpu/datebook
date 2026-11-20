// 앱의 DayPageParserTest와 같은 예시로, 웹으로 옮긴 파서가 앱과 똑같이 읽는지 확인한다.
// 실행: node --test web/test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, parsePageStats, withStats } from "../lib/parse.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// 앱의 테스트 자료(app/src/test/resources)를 복사해 둔 것. 웹 폴더만 따로 올려도 테스트가 돈다.
const resources = join(here, "fixtures");

// 실제 "3월 15일"·"1월 1일" 문서에서 모양이 다른 줄들을 골라 모았다(앱 테스트와 같은 글).
const sample = `'''3월 15일'''은 [[그레고리력]]으로 74번째 날에 해당한다.
{{3월달력}}
== 사건 ==
=== [[1600년]] 이전 ===
* [[기원전 44년]] - [[율리우스 카이사르]]가 폼페이우스 회랑에서 [[마르쿠스 브루투스]] 일당에게 암살당하다.<ref>{{서적 인용|제목=책|언어=en}}</ref>
* [[1960년]] - [[대한민국]] [[3·15 부정선거]]와, 마산에서 이로 인한 [[3·15 마산시위|시위가 발생]]하다.
== 문화 ==
* [[1990년]] - [[LG|럭키금성]]이 [[MBC 청룡]] 야구단을 인수하여 [[LG 트윈스]]로 이름을 변경하다.
== 탄생 ==
* [[1767년]] - 미국의 제7대 대통령 [[앤드루 잭슨]]. (~[[1845년]])
* [[1930년]]
** 대한민국의 국회의원 [[양창식]].  (~[[2018년]])
** 미국의 화학자 [[마르틴 카르플루스]]. (~[[2024년]])
* [[1974년]] - 대한민국의 가수 [[김동률]].
* [[1993년]]
** 대한민국의 전 가수 [[유경 (가수)|유경]] ([[AOA (음악 그룹)|AOA]]).
* [[2000년]] - 대한민국의 가수 혁. ([[오메가엑스]])
=== 미상 ===
* 대한민국의 가수 셀린.
== 사망 ==
* [[220년]] - 중국 후한말의 정치인, 시인 [[조조]]. ([[155년]]~)
== 기념일 ==
* [[3·15 마산 의거|3·15 의거]] 기념일: 대한민국
* [[:en:World Contact Day|월드 컨택트 데이]](World Contact Day)`;

const info = parse(3, 15, sample);

test("사건", () => {
    assert.equal(info.events.length, 3);
    assert.equal(info.events[0].year, -44);
    assert.equal(info.events[0].text, "율리우스 카이사르가 폼페이우스 회랑에서 마르쿠스 브루투스 일당에게 암살당하다.");
    assert.equal(info.events[1].title, "3·15 부정선거");
    assert.equal(info.events[2].isCulture, true);
    assert.equal(info.events[0].isCulture, false);
});

test("태어난 해와 떠난 해", () => {
    const jackson = info.births[0];
    assert.deepEqual(
        [jackson.name, jackson.title, jackson.description, jackson.birthYear, jackson.deathYear],
        ["앤드루 잭슨", "앤드루 잭슨", "미국의 제7대 대통령", 1767, 1845],
    );
});

test("연도만 있는 줄은 아래 줄에 이어진다", () => {
    const [yang, karplus] = info.births.filter((p) => p.birthYear === 1930);
    assert.equal(yang.name, "양창식");
    assert.equal(yang.deathYear, 2018);
    assert.equal(karplus.name, "마르틴 카르플루스");
});

test("링크 글자와 소속", () => {
    const yookyung = info.births.find((p) => p.birthYear === 1993);
    assert.deepEqual(
        [yookyung.name, yookyung.title, yookyung.note, yookyung.description],
        ["유경", "유경 (가수)", "AOA", "대한민국의 전 가수"],
    );
});

test("문서가 없는 사람", () => {
    const hyuk = info.births.find((p) => p.birthYear === 2000);
    assert.equal(hyuk.name, "혁");
    assert.equal(hyuk.title, null);
    assert.equal(hyuk.note, "오메가엑스");
    const unknown = info.births.at(-1);
    assert.equal(unknown.name, "셀린");
    assert.equal(unknown.birthYear, null);
});

test("떠난 사람은 태어난 사람에 섞이지 않는다", () => {
    assert.equal(info.births.length, 7);
    const [caocao] = info.deaths;
    assert.deepEqual(
        [caocao.name, caocao.description, caocao.birthYear, caocao.deathYear],
        ["조조", "중국 후한말의 정치인, 시인", 155, 220],
    );
});

test("기념일", () => {
    assert.deepEqual(info.holidays.map((h) => h.text), ["3·15 의거 기념일: 대한민국", "월드 컨택트 데이(World Contact Day)"]);
    assert.equal(info.holidays[0].title, "3·15 마산 의거");
    assert.equal(info.holidays[1].title, null);
});

test("실제 「3월 15일」 문서: 앱과 같은 개수", () => {
    const real = parse(3, 15, readFileSync(join(resources, "day_3_15.wikitext"), "utf8"));
    assert.deepEqual(
        [real.births.length, real.deaths.length, real.events.length, real.holidays.length],
        [149, 20, 16, 8],
    );
});

test("사진·분량을 붙이고 빨간 링크는 뗀다", () => {
    const stats = JSON.parse(readFileSync(join(resources, "stats_3_15.json"), "utf8"));
    const merged = stats.responses.reduce((all, r) => ({ ...all, ...parsePageStats(stats.titles, r) }), {});
    const real = withStats(parse(3, 15, readFileSync(join(resources, "day_3_15.wikitext"), "utf8")), merged);
    const top = [...real.births].sort((a, b) => b.fame - a.fame)[0];
    assert.equal(top.name, "루스 베이더 긴즈버그");
    assert.equal(real.births.find((p) => p.name === "박다솜").title, null);
});

test("문서 오타: 이름 앞뒤 |·[, 연도만 남은 줄, 외부 링크", () => {
    const text = `== 사건 ==
* [[2025년]] - 결승전[https://www.youtube.com/watch?v=x 영상]이 열리다.
== 탄생 ==
* [[1980년]] - 대한민국의 아나운서 [[문소리||문소리]].
* [[1981년]] - 대한민국의 아나운서 문소리 |
* [[1982년]] - 대한민국의 성우 [최석필
* [[1983년]] - [[1966년]]]`;
    const day = parse(1, 1, text);
    assert.equal(day.events[0].text, "결승전영상이 열리다.");
    assert.deepEqual(day.births.map((p) => p.name), ["문소리", "문소리", "최석필"]);
    assert.equal(day.births[0].title, "문소리");
    assert.equal(day.births[1].description, "대한민국의 아나운서");
});
