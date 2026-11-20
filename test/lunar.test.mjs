// 웹으로 옮긴 음력 변환이 앱과 같고, Node의 한국 음력(ICU dangi)과도 맞는지 확인한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fromSolar, toSolar, nextLunarBirthday } from "../lib/lunar.mjs";

test("한국 음력은 중국 음력과 하루 다를 수 있다", () => {
    assert.deepEqual(fromSolar("2026-10-26"), { year: 2026, month: 9, day: 16, leap: false });
});

test("음력 → 양력(윤달 포함)", () => {
    assert.equal(toSolar({ year: 1947, month: 11, day: 24 }), "1948-01-04");
    assert.equal(toSolar({ year: 1993, month: 3, day: 19, leap: true }), "1993-05-10");
    assert.equal(toSolar({ year: 1993, month: 4, day: 19, leap: true }), null);
});

test("다음 음력 생일", () => {
    assert.equal(nextLunarBirthday({ year: 1947, month: 11, day: 24 }, "2026-11-20"), "2027-01-01");
});

test("1900~2100년 전체가 ICU 한국 음력과 같다", () => {
    const fmt = new Intl.DateTimeFormat("ko-u-ca-dangi", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
    for (let t = Date.UTC(1900, 1, 1); t < Date.UTC(2100, 11, 1); t += 86400000 * 7) {
        const date = new Date(t).toISOString().slice(0, 10);
        const parts = Object.fromEntries(fmt.formatToParts(new Date(t)).map((p) => [p.type, p.value]));
        const lunar = fromSolar(date);
        assert.equal(lunar.month, Number(parts.month.replace("윤", "").replace("월", "")), date);
        assert.equal(lunar.day, Number(parts.day), date);
        assert.equal(lunar.leap, parts.month.startsWith("윤"), date);
    }
});
