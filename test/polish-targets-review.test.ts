import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";
import { inspectPage } from "../server/page-inspect.ts";

const harness = `
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ComponentsSection } from '/web/src/polish/PageSections.tsx';
import { usePreviewControl } from '/web/src/usePreviewControl.ts';
import { useInspection } from '/web/src/polish/hooks.ts';
function App() {
 const frame = useRef(null);
 const preview = usePreviewControl(frame, location.origin + '/fixture');
 const page = useInspection(preview);
 const [requests, setRequests] = useState([]);
 const panel = { locale: 'en', project: { dir: '/review-fixture' }, preview, submitToAi: request => setRequests(previous => [...previous, request.text]), showChat: () => {}, busy: false };
 return <><iframe ref={frame} src="/fixture" title="Preview" /><ComponentsSection panel={panel} draft={{ shape: {}, components: {}, motions: [] }} setDraft={() => {}} {...page} onReinspect={page.run} disabled={!preview.ready} /><div role="log">{requests.map((request, i) => <pre key={i}>{request}</pre>)}</div></>;
}
createRoot(document.getElementById('root')).render(<App />);
`;

test("a button-role link is one instance, whether or not it also looks like a button", async t => {
 const browser = await chromium.launch();
 t.after(() => browser.close());
 const page = await browser.newPage();
 await page.setContent('<a href="#" role="button" style="background:blue;padding:8px">Save</a><a href="#" role="button">Cancel</a>');
 const inspection = await page.evaluate(inspectPage);
 const buttons = inspection.components.find(c => c.kind === "button")!;
 assert.equal(buttons.count, 2);
 assert.equal(buttons.instances!.length, 2);
 assert.equal(new Set(inspection.components.flatMap(c => c.instances!.map(i => i.selector))).size, 2, "button-role links must not also be listed as ordinary links");
 for (const instance of buttons.instances!) assert.equal(await page.locator(instance.selector).count(), 1);
});

test("an outlined badge can be applied through the real panel and bridge; a replaced target cannot", async t => {
 const root = process.cwd();
 const modulePath = `${root}/__polish-review.tsx`;
 const server = await createServer({
  root, configFile: false, server: { port: 0 },
  optimizeDeps: { include: ["react", "react-dom/client", "react/jsx-runtime", "lucide-react"] },
  plugins: [{ name: "polish-review-fixture",
   resolveId(id) { if (id === "/__polish-review.tsx") return modulePath; },
   load(id) { if (id === modulePath) return harness; },
   configureServer(vite) {
    vite.middlewares.use((req, res, next) => {
     res.setHeader("Content-Type", "text/html");
     if (req.url === "/") return res.end('<div id="root"></div><script type="module" src="/__polish-review.tsx"></script>');
     if (req.url !== "/fixture") return next();
     res.end(`<span id="badge" style="display:inline-block;background:blue;border-radius:8px;padding:2px 6px">Ready</span><button id="action">Action</button>
      <script type="module">
       import { installPreviewOps } from '/server/preview-ops.ts';
       import { inspectPage } from '/server/page-inspect.ts';
       import { PREVIEW_OP_MESSAGE } from '/server/protocol.ts';
       installPreviewOps({ allowed: [location.origin], type: PREVIEW_OP_MESSAGE, tokenNames: [], inspect: inspectPage });
      </script>`);
    });
   },
  }],
 });
 t.after(() => server.close());
 await server.listen();
 const browser = await chromium.launch();
 t.after(() => browser.close());
 const page = await browser.newPage();
 page.setDefaultTimeout(10_000);
 await page.goto(server.resolvedUrls!.local[0]!);
 const panel = page.getByRole("region", { name: "Components on this page" });
 await panel.locator("summary").filter({ hasText: "Badges" }).click();
 await panel.getByRole("button", { name: "Ready · 1", exact: true }).click();
 await panel.getByRole("button", { name: "Outline", exact: true }).click();
 const frame = page.frames().find(f => f.url().endsWith("/fixture"))!;
 await frame.waitForFunction(() => getComputedStyle(document.getElementById("badge")!).backgroundColor === "rgba(0, 0, 0, 0)");
 await panel.getByRole("button", { name: "Apply with AI", exact: true }).click();
 await page.getByRole("log").getByText("Only this instance", { exact: false }).waitFor();
 assert.match(await page.getByRole("log").innerText(), /#badge/);
 assert.equal(await panel.getByRole("alert").count(), 0);

 await panel.locator("summary").filter({ hasText: "Buttons" }).click();
 await panel.getByRole("button", { name: "Action · 1", exact: true }).click();
 await panel.getByRole("button", { name: "Solid", exact: true }).click();
 await frame.locator("#action").evaluate(button => button.replaceWith(button.cloneNode(true)));
 await panel.getByRole("button", { name: "Apply with AI", exact: true }).click();
 await panel.getByRole("alert").waitFor();
 assert.equal(await page.getByRole("log").locator("pre").count(), 1, "replacing a node must not reuse its old approval");
});
