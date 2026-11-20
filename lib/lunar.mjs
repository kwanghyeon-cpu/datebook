// 한국 음력 ↔ 양력 변환(1900~2100년). 앱의 data/KoreanLunar.kt를 옮긴 것이다.
// 브라우저와 Node 양쪽에서 쓴다. 날짜는 "YYYY-MM-DD" 문자열로 주고받는다(시간대 문제를 피하려고).
import { LUNAR_DATA } from "./lunar-data.mjs";

export const FIRST_YEAR = 1900;
export const LAST_YEAR = 2100;
const FIRST_NEW_YEAR = Date.UTC(1900, 0, 31); // 1900년 음력 1월 1일
const DAY = 86400000;

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const toMs = (date) => Date.parse(date + "T00:00:00Z");

function months(year) {
    const data = LUNAR_DATA[year - FIRST_YEAR];
    const leapMonth = data >> 13;
    const result = [];
    let index = 0;
    for (let month = 1; month <= 12; month++) {
        result.push({ month, leap: false, length: data & (1 << index++) ? 30 : 29 });
        if (month === leapMonth) result.push({ month, leap: true, length: data & (1 << index++) ? 30 : 29 });
    }
    return result;
}

/** 해마다 음력 1월 1일이 1900-01-31에서 며칠 뒤인지. */
const newYearOffsets = (() => {
    const offsets = [0];
    for (let i = 0; i < LUNAR_DATA.length; i++) offsets.push(offsets[i] + months(FIRST_YEAR + i).reduce((s, m) => s + m.length, 0));
    return offsets;
})();

export function leapMonthOf(year) {
    if (year < FIRST_YEAR || year > LAST_YEAR) return null;
    return LUNAR_DATA[year - FIRST_YEAR] >> 13 || null;
}

/** 음력 {year, month, day, leap} → 양력 "YYYY-MM-DD". 없는 날이면 null. */
export function toSolar({ year, month, day, leap = false }) {
    if (year < FIRST_YEAR || year > LAST_YEAR) return null;
    let offset = newYearOffsets[year - FIRST_YEAR];
    for (const m of months(year)) {
        if (m.month === month && m.leap === leap) {
            if (day < 1 || day > m.length) return null;
            return iso(FIRST_NEW_YEAR + (offset + day - 1) * DAY);
        }
        offset += m.length;
    }
    return null;
}

/** 양력 "YYYY-MM-DD" → 음력 {year, month, day, leap}. 범위 밖이면 null. */
export function fromSolar(date) {
    const days = Math.round((toMs(date) - FIRST_NEW_YEAR) / DAY);
    if (days < 0 || days >= newYearOffsets.at(-1)) return null;
    let yearIndex = 0;
    while (newYearOffsets[yearIndex + 1] <= days) yearIndex++;
    let rest = days - newYearOffsets[yearIndex];
    for (const m of months(FIRST_YEAR + yearIndex)) {
        if (rest < m.length) return { year: FIRST_YEAR + yearIndex, month: m.month, day: rest + 1, leap: m.leap };
        rest -= m.length;
    }
    return null;
}

/** 음력 lunarYear해의 음력 생일(양력). 그해에 윤달이 없으면 평달로, 그달이 29일까지면 29일로 친다. */
export function birthdayIn(birth, lunarYear) {
    const plainDay = { year: lunarYear, month: birth.month, day: birth.day, leap: false };
    return toSolar({ ...birth, year: lunarYear }) ?? toSolar(plainDay) ?? toSolar({ ...plainDay, day: 29 });
}

/** today("YYYY-MM-DD")나 그 뒤로 처음 오는 음력 생일(양력). */
export function nextLunarBirthday(birth, today) {
    const year = Number(today.slice(0, 4));
    for (const y of [year - 1, year, year + 1]) {
        const date = birthdayIn(birth, y);
        if (date && date >= today) return date;
    }
    return null;
}
