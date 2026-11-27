// 날짜도감 웹: 브라우저에서 하는 일.
// - 첫 화면: 생일(양력·음력) 넣기, 오늘의 도감, 다른 날짜로 가기
// - 날짜 페이지: 탭, 정렬, 나이 표시, 내 생일이면 요약·동갑·그해 사건 강조, 공유
// 생일은 이 브라우저의 localStorage에만 둔다. 주소나 서버로 보내지 않는다.
import { toSolar, nextLunarBirthday, leapMonthOf } from "./lunar.mjs";

const STORE_KEY = "datebook.birthday";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (m, d) => `${pad(m)}-${pad(d)}`;

function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
const TODAY = todayIso();
const ms = (iso) => Date.parse(iso + "T00:00:00Z");
const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);
const weekday = (iso) => WEEKDAYS[new Date(ms(iso)).getUTCDay()];
const longDate = (iso) => `${Number(iso.slice(0, 4))}년 ${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일 ${weekday(iso)}요일`;

function validSolar(y, m, d) {
    const iso = `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
    const t = new Date(ms(iso));
    return !Number.isNaN(t.getTime()) && t.getUTCFullYear() === y && t.getUTCMonth() + 1 === m && t.getUTCDate() === d ? iso : null;
}

function loadBirthday() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch { return null; }
}
function saveBirthday(value) {
    try {
        if (value) localStorage.setItem(STORE_KEY, JSON.stringify(value));
        else localStorage.removeItem(STORE_KEY);
    } catch { /* 저장이 막혀 있으면 이번 화면에서만 쓴다. */ }
}

/** 그해 생일이 지났는지까지 따진 만 나이. 2월 29일생은 평년에 2월 28일. */
function ageOn(birthYear, month, day, today = TODAY) {
    const y = Number(today.slice(0, 4));
    const birthday = validSolar(y, month, day) ?? `${y}-02-28`;
    return y - birthYear - (today < birthday ? 1 : 0);
}

function nextSolarBirthday(month, day, today = TODAY) {
    const y = Number(today.slice(0, 4));
    for (const year of [y, y + 1]) {
        const date = validSolar(year, month, day) ?? `${year}-02-28`;
        if (date >= today) return date;
    }
    return null;
}

// ── 첫 화면 ──
function initHome() {
    const form = document.getElementById("birthday");
    const year = form.elements.year, month = form.elements.month, day = form.elements.day;
    const leapRow = document.getElementById("leap-row"), leap = document.getElementById("b-leap");
    const error = document.getElementById("b-error");
    const isLunar = () => form.elements.calendar.value === "lunar";
    const syncLeap = () => {
        const y = Number(year.value), m = Number(month.value);
        leapRow.hidden = !(isLunar() && leapMonthOf(y) && leapMonthOf(y) === m);
        if (leapRow.hidden) leap.checked = false;
    };
    form.addEventListener("input", syncLeap);
    form.addEventListener("change", syncLeap);

    const saved = loadBirthday();
    if (saved) {
        const source = saved.lunar ?? { year: Number(saved.solar.slice(0, 4)), month: Number(saved.solar.slice(5, 7)), day: Number(saved.solar.slice(8, 10)) };
        if (saved.lunar) form.querySelector('input[value="lunar"]').checked = true;
        year.value = source.year; month.value = source.month; day.value = source.day;
        syncLeap();
        leap.checked = !!saved.lunar?.leap;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const y = Number(year.value), m = Number(month.value), d = Number(day.value);
        const thisYear = Number(TODAY.slice(0, 4));
        let solar = null, lunar = null;
        if (!(y >= 1900 && y <= thisYear)) {
            error.textContent = `태어난 해는 1900년부터 ${thisYear}년 사이로 넣어 주세요.`;
        } else if (isLunar()) {
            lunar = { year: y, month: m, day: d, leap: leap.checked };
            solar = toSolar(lunar);
            error.textContent = solar ? "" : "그해 음력에는 없는 날이에요. 윤달이나 날짜를 확인해 주세요.";
        } else {
            solar = validSolar(y, m, d);
            error.textContent = solar ? "" : "없는 날짜예요. 월과 일을 확인해 주세요.";
        }
        if (solar && solar > TODAY) { error.textContent = "아직 오지 않은 날짜예요."; solar = null; }
        error.hidden = !error.textContent;
        if (!solar) return;
        saveBirthday({ solar, lunar });
        location.href = `${keyOf(Number(solar.slice(5, 7)), Number(solar.slice(8, 10)))}/`;
    });

    const other = document.getElementById("other");
    other.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = other.elements[0].value; // YYYY-MM-DD
        if (value) location.href = `${value.slice(5, 7)}-${value.slice(8, 10)}/`;
    });

    // 오늘의 도감
    const todayKey = TODAY.slice(5);
    document.getElementById("today-link").href = `${todayKey}/`;
    document.querySelector(`.days a[data-key="${todayKey}"]`)?.classList.add("today");
    const list = document.getElementById("today-list");
    const heading = document.querySelector("#today h2");
    heading.lastChild.textContent = ` 오늘의 도감 · ${Number(todayKey.slice(0, 2))}월 ${Number(todayKey.slice(3))}일`;
    fetch("summary.json").then((r) => r.json()).then((summary) => {
        list.replaceChildren(...(summary[todayKey] ?? []).map(([name, desc, born]) => {
            const li = document.createElement("li");
            const b = document.createElement("b");
            b.textContent = name;
            const span = document.createElement("span");
            span.textContent = ` ${[born ? `${born}년생` : "", desc].filter(Boolean).join(" · ")}`;
            li.append(b, span);
            return li;
        }));
    }).catch(() => { list.innerHTML = "<li><span>오늘의 도감을 불러오지 못했어요.</span></li>"; });
}

// ── 날짜 페이지 ──
function initDay() {
    const month = Number(document.body.dataset.month), day = Number(document.body.dataset.day);

    // 탭: 주소의 #births 같은 표시로 기억한다.
    const tabs = [...document.querySelectorAll(".tabs a")];
    const show = (id) => {
        tabs.forEach((t) => {
            const on = t.getAttribute("aria-controls") === id;
            t.setAttribute("aria-selected", on);
            document.getElementById(t.getAttribute("aria-controls")).classList.toggle("active", on);
        });
    };
    tabs.forEach((t) => t.addEventListener("click", (event) => {
        event.preventDefault();
        show(t.getAttribute("aria-controls"));
        history.replaceState(null, "", "#" + t.getAttribute("aria-controls"));
    }));
    const fromHash = () => show(tabs.some((t) => "#" + t.getAttribute("aria-controls") === location.hash) ? location.hash.slice(1) : "births");
    fromHash();
    window.addEventListener("hashchange", fromHash);

    // 정렬
    const list = document.getElementById("birth-list");
    document.querySelectorAll(".chip[data-sort]").forEach((chip) => chip.addEventListener("click", () => {
        document.querySelectorAll(".chip[data-sort]").forEach((c) => c.setAttribute("aria-pressed", c === chip));
        const items = [...list.children];
        const born = (li) => (li.dataset.born === "" ? null : Number(li.dataset.born));
        const sorters = {
            fame: (a, b) => Number(a.dataset.i) - Number(b.dataset.i),
            old: (a, b) => (born(a) ?? 1e9) - (born(b) ?? 1e9),
            new: (a, b) => (born(b) ?? -1e9) - (born(a) ?? -1e9),
        };
        list.append(...items.sort(sorters[chip.dataset.sort]));
    }));

    // 살아 있는 사람에게 오늘 기준 만 나이를 붙인다(페이지는 일주일에 한 번 만들어서 미리 넣지 않는다).
    document.querySelectorAll("#births .person").forEach((li) => {
        const born = Number(li.dataset.born);
        if (!li.dataset.born || li.dataset.died || born <= 0) return;
        const age = ageOn(born, month, day);
        if (age >= 0 && age <= 110) li.querySelector("[data-years]").textContent += ` · 만 ${age}세`;
    });

    renderMine(month, day);

    document.getElementById("ask").addEventListener("submit", (event) => {
        event.preventDefault();
        const y = Number(event.target.elements.year.value);
        const error = document.getElementById("ask-error");
        const solar = validSolar(y, month, day);
        const ok = y >= 1900 && solar && solar <= TODAY;
        error.hidden = ok;
        error.textContent = ok ? "" : solar ? "1900년부터 올해까지의 해를 넣어 주세요." : `${y}년에는 ${month}월 ${day}일이 없어요.`;
        if (!ok) return;
        saveBirthday({ solar, lunar: null });
        renderMine(month, day);
    });

    const share = document.getElementById("share");
    share.addEventListener("click", async () => {
        const url = location.href.split("#")[0];
        try {
            if (navigator.share) await navigator.share({ title: document.title, url });
            else {
                await navigator.clipboard.writeText(url);
                share.lastChild.textContent = "주소를 복사했어요";
            }
        } catch { /* 공유 창을 닫거나 복사가 막히면 아무것도 하지 않는다. */ }
    });
}

/** 저장된 생일이 이 날짜면 앱처럼 요약 카드를 보여 주고 같은 해 사람·사건을 위로 올린다. */
function renderMine(month, day) {
    const mine = document.getElementById("mine"), ask = document.getElementById("ask");
    const saved = loadBirthday();
    const matches = saved && Number(saved.solar.slice(5, 7)) === month && Number(saved.solar.slice(8, 10)) === day;
    ask.hidden = !!matches;
    mine.hidden = !matches;
    // 생일 결과를 본 자리에서만 운세 앱으로 이어 준다(build.mjs fortuneLink).
    const fortune = document.getElementById("fortune");
    if (fortune) fortune.hidden = !matches;
    if (!matches) {
        if (saved) {
            const [m, d] = [Number(saved.solar.slice(5, 7)), Number(saved.solar.slice(8, 10))];
            const link = document.createElement("p");
            link.className = "years";
            link.innerHTML = `내 생일은 <a href="../${keyOf(m, d)}/">${m}월 ${d}일</a>이에요.`;
            if (!ask.querySelector(".years")) ask.append(link);
        }
        return;
    }

    const born = Number(saved.solar.slice(0, 4));
    const next = saved.lunar ? nextLunarBirthday(saved.lunar, TODAY) : nextSolarBirthday(month, day);
    const until = next ? daysBetween(TODAY, next) : null;
    const lived = daysBetween(saved.solar, TODAY) + 1;
    const births = document.querySelectorAll("#birth-list .person");
    const sameYear = [...births].filter((li) => Number(li.dataset.born) === born);
    const lunarLine = saved.lunar
        ? `<p class="sub">음력 ${saved.lunar.year}년 ${saved.lunar.leap ? "윤" : ""}${saved.lunar.month}월 ${saved.lunar.day}일생${next ? ` · 다음 생일 양력 ${Number(next.slice(5, 7))}월 ${Number(next.slice(8, 10))}일` : ""}</p>`
        : "";
    const dday = until === 0 ? "오늘이 생일이에요! 축하해요"
        : until == null ? "" : `${saved.lunar ? "음력 생일까지" : "다음 생일까지"} D-${until}`;
    mine.innerHTML = `
      <p class="sub">${longDate(saved.solar)}생</p>${lunarLine}
      <p class="big">만 ${ageOn(born, month, day)}세</p>
      <p class="line">${dday}</p>
      <p class="sub">태어난 지 ${lived.toLocaleString("ko-KR")}일째</p>
      <p class="line">같은 날 태어난 사람 ${births.length}명${sameYear.length ? ` · 같은 해 ${sameYear.length}명` : ""}</p>
      <div class="actions"><button class="btn ghost small" type="button" id="forget">이 브라우저에서 내 생일 지우기</button></div>`;
    document.getElementById("forget").addEventListener("click", () => {
        saveBirthday(null);
        location.reload();
    });

    // 같은 해 같은 날 태어난 사람(금색), 내가 태어난 날 떠난 사람, 그해 그날의 사건을 위로 모은다.
    const lift = (boxId, items, cls) => {
        const box = document.getElementById(boxId);
        if (!box || !items.length) return;
        box.hidden = false;
        box.querySelector("ol").replaceChildren(...items.map((el) => {
            const copy = el.cloneNode(true);
            copy.classList.add(cls);
            return copy;
        }));
    };
    lift("twins", sameYear, "twin");
    // 원래 목록만 본다(위로 모아 둔 복사본은 빼고).
    lift("same-day-deaths", [...document.querySelectorAll("#deaths > ol.people > .person")].filter((li) => Number(li.dataset.died) === born), "twin");
    lift("my-year", [...document.querySelectorAll("#events > ol.events > .event")].filter((li) => Number(li.dataset.year) === born), "mine-year");
}

if (document.body.dataset.page === "home") initHome();
if (document.body.dataset.page === "day") initDay();
