import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { captureAnnotation } from "../server/annotate.ts";

const PAGE = `<!doctype html>
<html><body style="margin:0">
<h1 style="position:absolute;left:20px;top:20px;margin:0">Title far away</h1>
<button id="buy" style="position:absolute;left:300px;top:300px;width:120px;height:40px">Buy now</button>
</body></html>
`;

test("annotation shows the circled element with selector and source location, plus a PNG screenshot", async () => {
	const dir = await mkdtemp(join(tmpdir(), "s-ui-annotate-"));
	await writeFile(join(dir, "index.html"), PAGE);
	const server = createServer(async (_req, res) => res.end(await readFile(join(dir, "index.html"))));
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

	try {
		const circle = Array.from({ length: 24 }, (_, i) => {
			const a = (i / 24) * 2 * Math.PI;
			return [360 + 90 * Math.cos(a), 320 + 45 * Math.sin(a)] as [number, number];
		});
		const result = await captureAnnotation({ url, viewport: { width: 800, height: 600 }, stroke: circle, projectDir: dir });

		assert.deepEqual([...result.png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join(""), "PNG");
		const buy = result.elements.find((e) => e.selector.includes("#buy"));
		assert.ok(buy, JSON.stringify(result.elements));
		assert.match(buy.html, /Buy now/);
		assert.ok(buy.sources.includes("index.html:4"), JSON.stringify(buy.sources));
		assert.ok(!result.elements.some((e) => e.html.includes("Title far away")));
	} finally {
		server.close();
	}
});
