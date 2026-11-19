import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright';

test('font roles and trials remain selected across exclusive tabs', async t => {
 const dir = await mkdtemp(join(resolve('.'), '.typography-tabs-'));
 t.after(() => rm(dir, {recursive:true,force:true}));
 const root = resolve('.');
 await writeFile(join(dir,'index.html'), '<div id="root"></div><script type="module" src="/entry.tsx"></script>');
 await writeFile(join(dir,'entry.tsx'), `
 import React from 'react';
 import {createRoot} from 'react-dom/client';
 import {PolishPanel} from '/@fs/${root}/web/src/polish/PolishPanel.tsx';
 const preview = {ready:true,inspect:async()=>({url:'http://localhost',fonts:[],colors:[],components:[{kind:'heading',count:1,selector:'h1',groupSelector:'h1',text:'真正的页面标题',styles:{}},{kind:'button',count:1,selector:'button',groupSelector:'button',text:'立即开始',styles:{}}]}),applyLayer:async()=>{},clearLayer:async()=>{},clearAll:async()=>{},loadFonts:async()=>{}};
 const panel={locale:'zh',project:{dir:'/typography-tabs',previewUrl:'http://localhost'},preview,callModule:async()=>({organized:true,values:{'--sui-font-sans':'sans-serif','--sui-font-heading':'sans-serif'},fontImports:[],missing:[]}),submitToAi:()=>{},showChat:()=>{}};
 createRoot(document.getElementById('root')).render(<PolishPanel {...panel}/>);
 `);
 const server = await createServer({root:dir,configFile:false,plugins:[react()],resolve:{dedupe:['react','react-dom']},server:{port:0,fs:{allow:[root,dir]}}});
 await server.listen(); t.after(()=>server.close());
 const browser = await chromium.launch({headless:true}); t.after(()=>browser.close());
 const page = await browser.newPage();
 await page.goto(server.resolvedUrls!.local[0]!);
 await page.getByRole('button',{name:'保存',exact:true}).waitFor();
 assert.equal(await page.getByRole('tab',{name:'字体',exact:true}).count(),1,'font navigation is a real tab');
 assert.equal(await page.getByRole('tab').count(),4);
 await page.getByRole('button',{name:'标题',exact:true}).click();
 await page.getByRole('button',{name:/系统默认/}).click();
 await page.getByRole('tab',{name:'组件',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'标题',exact:true}).count(),0);
 await page.getByRole('tab',{name:'字体',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:/系统默认/}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'正文',exact:true}).click();
 await page.getByRole('button',{name:/系统默认/}).click();
 await page.getByRole('button',{name:'界面控件',exact:true}).click();
 await page.getByRole('button',{name:/系统默认/}).click();
 await page.getByRole('tab',{name:'动效',exact:true}).click();
 await page.getByRole('tab',{name:'字体',exact:true}).click();
 for (const role of ['标题','正文','界面控件']) {
  await page.getByRole('button',{name:role,exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/系统默认/}).getAttribute('aria-pressed'),'true',role+' selection survives tab switches');
 }
 await page.getByRole('button',{name:'还原',exact:true}).click();
 await page.getByRole('button',{name:'标题',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:/系统默认/}).getAttribute('aria-pressed'),'true','resetting controls does not reset headings');
});
