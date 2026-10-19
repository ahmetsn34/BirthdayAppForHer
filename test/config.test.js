import test from "node:test";
import assert from "node:assert/strict";
import { getEasterEggYouTubeUrl } from "../dist/config.js";

test("optional video links accept only HTTPS on the explicit YouTube host list", () => {
  for (const host of ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]) {
    const url = `https://${host}/watch?v=example`;
    assert.equal(getEasterEggYouTubeUrl(`  ${url}  `), url);
  }
  assert.equal(getEasterEggYouTubeUrl("https://YOUTUBE.COM/watch?v=example"), "https://youtube.com/watch?v=example");
});

test("video links reject lookalike hosts, insecure schemes, script URLs and absent configuration", () => {
  for (const value of [
    "", " ", null, 1, {}, "not a url", "//youtube.com/watch?v=x",
    "http://youtube.com/watch?v=x", "javascript:alert(1)",
    "https://youtube.com.example.org/watch?v=x", "https://notyoutube.com/watch?v=x",
    "https://youtube.com@example.org/watch?v=x", "https://www.youtu.be/watch?v=x",
  ]) assert.equal(getEasterEggYouTubeUrl(value), null, String(value));
  assert.equal(getEasterEggYouTubeUrl(), null);
});
