import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createServer, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";
import { startPreviewProxy } from "../server/preview-proxy.ts";
import { servePage } from "./page-fixture.ts";

test("style panel forgets a trial on SPA navigation and cannot resurrect it after leaving while unmounted", async (t) => {
 const site = await servePage();
 t.after(site.close);
 let previewUrl = "";
 const server = await createServer({ root: resolve("web"), plugins: [react(), {
  name: "style-acceptance",
  resolveId(id) { if (id === "virtual:style-test.tsx") return "\0style-test.tsx"; },
  async load(id) {
   if (id !== "\0style-test.tsx") return;
   const code = `import React,{useRef,useState} from 'react';import{createRoot}from'react-dom/client';
import{StylePanel}from'/src/polish/style/StylePanel.tsx';import{usePreviewControl}from'/src/usePreviewControl.ts';
const url=${JSON.stringify(previewUrl)};
const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2dAAAAABJRU5ErkJggg==';
const reference={name:'Reference',url:'https://example.com',image,why:''};
function App(){const frame=useRef(null);const preview=usePreviewControl(frame,url);const[visible,setVisible]=useState(true);const[sent,setSent]=useState(0);
const panel={locale:'en',project:{dir:'/test/style',name:'Test',previewUrl:url},preview,busy:false,showChat(){},submitToAi(){setSent(n=>n+1)},callModule:async(module,action,payload)=>action==='findSimilar'?{product:{kind:'Example',page:'Page',summary:''},references:[reference],dropped:[]}:action==='capture'?{ok:true,image}:{summary:'Larger heading',changes:[{target:payload.page.components.findIndex(c=>c.kind==='heading'),properties:{'font-size':'40px'}}]}};
return <><button onClick={()=>setVisible(v=>!v)}>{visible?'Unmount panel':'Mount panel'}</button><output aria-label="Submissions">{sent}</output>{visible&&<StylePanel panel={panel}/>}<iframe title="Preview" ref={frame} src={url}/></>};createRoot(document.getElementById('root')).render(<App/>);`;
   return (await transformWithOxc(code, "style-test.tsx", { jsx: { runtime: "automatic" } })).code;
  },
  configureServer(vite) { vite.middlewares.use(async (req, res, next) => {
   if (req.url !== "/") return next();
   res.setHeader("content-type", "text/html");
   res.end(await vite.transformIndexHtml("/", '<html><div id="root"></div><script type="module" src="/@id/virtual:style-test.tsx"></script></html>'));
  }); },
 }], server: { host: "127.0.0.1", port: 0 } });
 await server.listen();
 t.after(() => server.close());
 const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
 const proxy = await startPreviewProxy(site.url, [origin]);
 t.after(() => proxy.close());
 previewUrl = proxy.url;
 const browser = await chromium.launch();
 t.after(() => browser.close());
 const page = await browser.newPage();
 await page.goto(origin);
 await page.getByRole("button", { name: "Find similar products", exact: true }).click();
 await page.getByRole("button", { name: /Reference/ }).click();
 await page.getByRole("button", { name: "Choose for style preview" }).click();
 await page.getByRole("button", { name: "Preview on this page" }).click();
 const confirm = page.getByRole("button", { name: "Confirm and ask AI to edit source" });
 await confirm.waitFor();
 const frame = page.frames().find(f => f.url().startsWith(previewUrl))!;
 await frame.evaluate(() => history.pushState({}, "", "/next"));
 await confirm.waitFor({ state: "detached" });
 assert.equal(await frame.locator('style[data-sui-layer^="polish-style"]').count(), 0);
 assert.equal(await page.getByLabel("Submissions").textContent(), "0");
 await page.getByRole("button", { name: "Preview on this page" }).click();
 await confirm.waitFor();
 await frame.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
 await page.getByText("Open a running page to try a style.", { exact: true }).waitFor();
 await page.getByRole("button", { name: "Unmount panel", exact: true }).click();
 await frame.goto(previewUrl);
 assert.equal(await frame.locator('style[data-sui-layer^="polish-style"]').count(), 0);
 await page.getByRole("button", { name: "Mount panel", exact: true }).click();
 assert.equal(await confirm.count(), 0);
 assert.equal(await page.getByLabel("Submissions").textContent(), "0");
});
