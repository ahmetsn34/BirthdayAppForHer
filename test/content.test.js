import test from "node:test";
import assert from "node:assert/strict";
import { TEXT } from "../dist/content.js";
import { selectExperienceContent } from "../dist/experience-content.js";

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function leafPaths(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object"
      ? leafPaths(child, path)
      : [path];
  });
}

test("the original experience requires no query and demo mode requires an explicit opt-in", () => {
  for (const search of ["", "?ref=portfolio", "?demo=0", "?demo=true", "?demo=01", "?demo=1x", "?DEMO=1"]) {
    assert.strictEqual(selectExperienceContent(TEXT, search), TEXT);
  }
  assert.notStrictEqual(selectExperienceContent(TEXT, "?ref=portfolio&demo=1"), TEXT);
});

test("demo replaces every personal presentation field without changing the gift", () => {
  const original = freeze(structuredClone(TEXT));
  const before = JSON.stringify(original);
  const demo = selectExperienceContent(original, "?demo=1");
  for (const [section, keys] of Object.entries({
    page: ["title", "description"],
    intro: ["date", "name"],
    letter: ["greeting", "paragraphs", "final", "signature"],
    objects: ["envelopeTo", "envelopeFrom"],
    messages: ["celebration"],
  })) {
    for (const key of keys) assert.notDeepEqual(demo[section][key], original[section][key], `${section}.${key}`);
  }
  const demoCopy = JSON.stringify(demo);
  for (const originalText of [
    original.intro.name.replace(/\?$/, ""),
    original.letter.signature,
    original.intro.date,
    ...original.letter.paragraphs,
  ]) assert.ok(!demoCopy.includes(originalText), "personal text must not appear in demo copy");
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(leafPaths(demo), leafPaths(original));
  assert.deepEqual(demo.controls, original.controls);
  assert.deepEqual(demo.help, original.help);
  assert.equal(demo.page.worldLabel, original.page.worldLabel);
  for (const path of leafPaths(demo)) {
    const value = path.split(".").reduce((current, key) => current[key], demo);
    assert.equal(typeof value, "string", path);
    assert.ok(value.trim(), path);
  }
});

test("demo changes cannot leak back into the original or another demo visit", () => {
  const demo = selectExperienceContent(TEXT, "?demo=1");
  demo.controls.musicOn = "changed";
  demo.letter.paragraphs.push("changed");
  assert.notEqual(TEXT.controls.musicOn, "changed");
  assert.ok(!TEXT.letter.paragraphs.includes("changed"));
  assert.ok(!selectExperienceContent(TEXT, "?demo=1").letter.paragraphs.includes("changed"));
});
