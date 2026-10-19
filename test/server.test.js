import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createStaticServer } from "../server.mjs";

test("the local demo serves modules, scene assets and query URLs with usable MIME types", async (context) => {
  const server = createStaticServer().listen(0, "127.0.0.1");
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [resource, type] of [
    ["/?demo=1", "text/html"], ["/portfolio.html?demo=1", "text/html"],
    ["/app.js", "text/javascript"],
    ["/experience-content.js", "text/javascript"], ["/vendor/three.module.js", "text/javascript"],
    ["/style.css?v=5.0", "text/css"], ["/favicon.svg", "image/svg+xml"],
    ["/takodachi-transparent.png", "image/png"],
  ]) {
    const response = await fetch(origin + resource);
    assert.equal(response.status, 200, resource);
    assert.ok(response.headers.get("content-type").startsWith(type), resource);
    assert.ok((await response.arrayBuffer()).byteLength > 0, resource);
  }
  for (const resource of ["/missing.js", "/%2e%2e%2fpackage.json", "/%zz"]) {
    const response = await fetch(origin + resource);
    assert.ok([403, 404].includes(response.status), resource);
    assert.ok(!(await response.text()).includes('"private"'));
  }
});
