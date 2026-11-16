import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { captureAnnotation } from "../server/annotate.ts";

const PAGE = `<!doctype html><html><body style="margin:0;height:3000px">
<button id="top" style="position:absolute;left:300px;top:300px;width:120px;height:40px">Top</button>
<button id="bottom" style="position:absolute;left:300px;top:1200px;width:120px;height:40px">Bottom</button>
</body></html>`;

test("annotation targets what the user sees after scrolling, not the top of the page", async () => {
	const server = createServer((_req, res) => res.end(PAGE));
	await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
	const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
	try {
		const circle = Array.from({ length: 24 }, (_, i) => {
			const a = (i / 24) * 2 * Math.PI;
			return [360 + 90 * Math.cos(a), 320 + 45 * Math.sin(a)] as [number, number];
		});
		const result = await captureAnnotation({
			url,
			scroll: { x: 0, y: 900 },
			viewport: { width: 800, height: 600 },
			stroke: circle,
			projectDir: await mkdtemp(join(tmpdir(), "s-ui-scroll-")),
		});
		assert.deepEqual(
			result.elements.map((e) => e.selector),
			["button#bottom"],
		);
	} finally {
		server.close();
	}
});
