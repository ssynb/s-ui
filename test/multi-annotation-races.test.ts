import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import { startFakeLlm } from "./fake-llm.ts";

async function circle(page: Page, name: string) {
 const target = page.frameLocator('iframe[title="Preview"]').getByRole('button', { name, exact: true });
 const box = (await target.boundingBox())!;
 await page.getByRole('button', { name: 'Circle to edit', exact: true }).click();
 await page.mouse.move(box.x - 8, box.y - 8); await page.mouse.down();
 for (const [x,y] of [[box.x+box.width+8,box.y-8],[box.x+box.width+8,box.y+box.height+8],[box.x-8,box.y+box.height+8],[box.x-8,box.y-8]]) await page.mouse.move(x!,y!, { steps: 5 });
 await page.mouse.up();
}

test('pending captures preserve edits and deletions, reference submissions include the whole set, and late captures cannot cross SPA navigation', { timeout: 90000 }, async t => {
 const root = await mkdtemp(join(tmpdir(), 's-ui-multi-'));
 const auth = join(root,'auth'); await mkdir(auth);
 const fake = await startFakeLlm(auth); t.after(() => fake.close());
 const dir = join(root,'project'); await mkdir(join(dir,'node_modules'), {recursive:true});
 await writeFile(join(dir,'package.json'), JSON.stringify({type:'module',scripts:{dev:'node serve.js'}}));
 const html = '<html><head><title>Reference fixture</title></head><body style="margin:24px;height:2400px"><button id="save">Save</button><button id="cancel" style="margin-left:100px">Cancel</button><h1>Reference controls for editing a complete project page</h1><button id="delete" style="display:block;margin-top:1000px">Delete</button><a href="/next" onclick="event.preventDefault();history.pushState({},\'\',this.href)">Next page</a></body></html>';
 await writeFile(join(dir,'serve.js'), `import {createServer} from 'node:http'; const s=createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html'});r.end(${JSON.stringify(html)})});s.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+s.address().port));`);
 const server = spawn(process.execPath,['server/main.ts','--no-open','--port','0'], {stdio:['ignore','pipe','inherit'],env:{...process.env, PI_CODING_AGENT_DIR:auth,S_UI_HOME:join(root,'home')}});
 t.after(async()=>{if(server.exitCode===null){const end=new Promise(r=>server.once('exit',r));server.kill('SIGTERM');await end;}});
 const url = await new Promise<string>(resolve=>server.stdout!.on('data',d=>{const m=String(d).match(/http:\/\/127\.0\.0\.1:\d+\//);if(m)resolve(m[0]);}));
 const browser=await chromium.launch();t.after(()=>browser.close());
 const page=await browser.newPage({locale:'en-US',viewport:{width:1400,height:900}});page.setDefaultTimeout(10000);
 await page.addInitScript(() => {
  const state = window as typeof window & { holdCapture?: boolean; heldCapture?: MessageEvent };
  addEventListener('message', event => {
   if (state.holdCapture && event.data?.type === 's-ui:page-capture') { state.heldCapture = event; event.stopImmediatePropagation(); }
  }, true);
 });
 await page.goto(url);await page.getByRole('button',{name:'Open folder…'}).click();
 const path=page.getByRole('textbox',{name:'Folder path'});await path.fill(dir);await path.press('Enter');await page.getByRole('tree',{name:dir,exact:true}).waitFor();await page.getByRole('button',{name:'Open',exact:true}).click();
 await page.frameLocator('iframe[title="Preview"]').getByRole('button',{name:'Save',exact:true}).waitFor();
 const live = page.frames().find(f => f.url() !== page.url() && f.url().startsWith('http'))!;
 const hold = () => live.evaluate(() => { (window as any).holdCapture = true; });
 const release = () => live.evaluate(() => { const w = window as any; w.holdCapture = false; dispatchEvent(new MessageEvent("message", { data: w.heldCapture.data, origin: w.heldCapture.origin, source: w.heldCapture.source })); delete w.heldCapture; });
 await circle(page,'Save');
 await page.getByRole('textbox',{name:'Note for circle 1',exact:true}).fill('Initial note');
 await page.getByRole('button',{name:'Exit circling',exact:true}).click();
 await hold(); await circle(page,'Cancel'); await live.waitForFunction(() => Boolean((window as any).heldCapture));
 await page.getByRole('textbox',{name:'Note for circle 1',exact:true}).fill('Edited while capturing');
 await release(); await page.getByRole('textbox',{name:'Note for circle 2',exact:true}).waitFor();
 assert.equal(await page.getByRole('textbox',{name:'Note for circle 1',exact:true}).inputValue(),'Edited while capturing');
 await page.getByRole('button',{name:'Exit circling',exact:true}).click();
 await hold(); await circle(page,'Save'); await live.waitForFunction(() => Boolean((window as any).heldCapture));
 await page.getByRole('button',{name:'Delete circle 1',exact:true}).click(); await release();
 await page.getByRole('textbox',{name:'Note for circle 3',exact:true}).fill('Keep save');
 assert.equal(await page.getByRole('textbox',{name:'Note for circle 1',exact:true}).count(),0);
 await page.getByRole('textbox',{name:'Note for circle 2',exact:true}).fill('Keep cancel');
 await page.getByRole('textbox',{name:'Overall request',exact:true}).fill('Keep the existing labels');
 await page.getByRole('button',{name:'Exit circling',exact:true}).click();
 await page.getByRole('tab',{name:'Reference pages',exact:true}).click();
 await page.getByRole('textbox',{name:'Paste a web address to add it as a reference'}).fill(live.url());
 await page.getByRole('button',{name:'Add',exact:true}).click();
 await page.getByRole('button',{name:'View Reference fixture',exact:true}).click();
 await page.getByText('Only the 2 elements you circled will change',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Use as reference',exact:true}).click();
 await page.getByText('ok',{exact:true}).waitFor();
 const content=JSON.stringify(fake.requests.at(-1)!.messages.at(-1)!.content);
 for (const expected of ['Circle 2','Circle 3','Keep cancel','Keep save','Keep the existing labels','button#save','button#cancel']) assert.ok(content.includes(expected),expected);
 assert.ok(!content.includes('Initial note'));
 await hold(); await circle(page,'Save'); await live.waitForFunction(() => Boolean((window as any).heldCapture));
 await page.getByRole('button',{name:'Exit circling',exact:true}).click();
 await page.frameLocator('iframe[title="Preview"]').getByRole('link',{name:'Next page'}).click();
 await page.waitForFunction(() => !document.querySelector('[inert]'));
 await release();
 // A message round trip settles the released capture response before inspecting the UI.
 await live.evaluate(() => new Promise<void>(resolve => { const channel=new MessageChannel();channel.port1.onmessage=()=>resolve();channel.port2.postMessage('settled'); }));
 assert.equal(await page.getByRole('textbox',{name:/Note for circle/}).count(),0);
});
