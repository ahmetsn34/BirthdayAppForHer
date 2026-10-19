import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { TEXT } from "../dist/content.js";
import { selectExperienceContent } from "../dist/experience-content.js";

const demo = selectExperienceContent(TEXT, "?demo=1");

test("portfolio entries have neutral first-paint copy even before JavaScript runs", async () => {
  const personalCopy = [
    TEXT.intro.name.replace(/\?$/, ""),
    TEXT.intro.date,
    TEXT.letter.signature,
    ...TEXT.letter.paragraphs,
  ];
  for (const entry of ["../portfolio.html", "../dist/portfolio.html"]) {
    const html = await readFile(new URL(entry, import.meta.url), "utf8");
    for (const personal of personalCopy) {
      assert.ok(!html.includes(personal), `${entry} must not include original personal copy`);
    }
    assert.ok(html.includes(`<title>${demo.page.title}</title>`), entry);
    assert.ok(html.includes(`content="${demo.page.description}"`), entry);
    assert.match(html, new RegExp(`data-text="intro.date">\\s*${demo.intro.date}\\s*<`), entry);
    assert.match(html, /data-text="intro.name"\s*>keşfetmeye\?<\/em/, entry);
    assert.match(html, /<noscript[\s\S]*JavaScript’i etkinleştir\./, entry);
  }
});

test("both portfolio entries resolve scene assets under the GitHub Pages project subpath", async () => {
  const expected = ["favicon.svg", "style.css", "takodachi-transparent.png", "app.js"];
  for (const [entry, pagePath] of [
    ["../portfolio.html", "/BirthdayAppForHer/portfolio.html?demo=1"],
    ["../dist/portfolio.html", "/BirthdayAppForHer/dist/portfolio.html?demo=1"],
  ]) {
    const html = await readFile(new URL(entry, import.meta.url), "utf8");
    const page = new URL(pagePath, "https://example.test");
    const baseHref = html.match(/<base\s+href="([^"]+)"/);
    const base = baseHref ? new URL(baseHref[1], page) : page;
    const assets = [...html.matchAll(/<(?:link|script|img)\b[^>]*\b(?:href|src)="([^"]+)"/g)]
      .map((match) => new URL(match[1], base));
    assert.equal(assets.length, expected.length, entry);
    for (let index = 0; index < expected.length; index++) {
      assert.equal(assets[index].origin, page.origin, entry);
      assert.equal(assets[index].pathname, `/BirthdayAppForHer/dist/${expected[index]}`, entry);
    }
    assert.match(html, /<script type="module" src="\.\/app\.js\?v=5\.0"><\/script>/, entry);
  }
});
