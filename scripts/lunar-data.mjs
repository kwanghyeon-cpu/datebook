// 앱의 한국 음력 표(KoreanLunar.kt의 DATA)를 웹에서 쓸 수 있게 lib/lunar-data.mjs로 옮긴다.
// 표 자체는 tools/lunar-table.mjs로 만든다. 표가 바뀌면 이 스크립트를 다시 돌린다.
// 사용법: node web/scripts/lunar-data.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const kotlin = readFileSync(join(web, "../app/src/main/java/com/khcompany/birthdaytwin/data/KoreanLunar.kt"), "utf8");
const body = kotlin.slice(kotlin.indexOf("intArrayOf("), kotlin.indexOf(")", kotlin.indexOf("intArrayOf(")));
const values = body.match(/0x[0-9a-fA-F]+/g);
if (values.length !== 201) throw new Error(`1900~2100년 201개여야 하는데 ${values.length}개`);

const lines = [];
for (let i = 0; i < values.length; i += 10) lines.push("    " + values.slice(i, i + 10).join(", ") + ",");
writeFileSync(join(web, "lib/lunar-data.mjs"),
    "// 자동으로 만든 파일. web/scripts/lunar-data.mjs가 앱의 KoreanLunar.kt에서 옮긴다. 직접 고치지 않는다.\n" +
    "// 해마다 한 정수: 0~12번 비트 = 달 길이(1이면 30일, 윤달 포함 순서대로), 13~16번 비트 = 윤달(없으면 0).\n" +
    "export const LUNAR_DATA = [\n" + lines.join("\n") + "\n];\n");
console.log(`lunar-data.mjs: ${values.length}년`);
