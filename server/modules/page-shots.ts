// 给任意网页截图：打开、判断是不是能参考的真实页面、截首屏或整页，结果按 URL 缓存在 s-ui 自己的目录里。
// 截图来自第三方网站，只存在本机（APP_HOME），不进项目仓库。
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Browser, chromium, errors, type Locator, type Page } from "playwright";
import { APP_HOME } from "../app-home.ts";

/** 页面不能作为参考的原因；detail 是给人看的原始信息（状态码、页面标题、网络错误）。 */
export type RejectReason = "invalid" | "unreachable" | "http-error" | "error-page" | "login" | "blank";
export type Shot = { ok: true; url: string; title: string; image: string } | { ok: false; url: string; reason: RejectReason; detail: string };
type Rejection = { reason: RejectReason; detail: string };

const CACHE_DIR = join(APP_HOME, "reference-shots");
const CACHE_TTL_MS = 7 * 24 * 3600 * 1000;
const VIEWPORT = { width: 1280, height: 800 };
const MAX_PARALLEL = 6;
const NAVIGATION_TIMEOUT_MS = 20_000;
const LOAD_TIMEOUT_MS = 8_000;
const NETWORK_IDLE_TIMEOUT_MS = 3_000;
// Chromium 单张截图的高度上限约 16384px，再长的页面只截前面这一段。
const MAX_FULL_PAGE_HEIGHT = 12_000;
const ANIMATION_WAIT_MS = 3_000;
const HEADLINE_TIMEOUT_MS = 10_000;
const JPEG_QUALITY = 72;
const MIN_TEXT_LENGTH = 40;
const LOGIN_WALL_MAX_TEXT = 1500;

const ERROR_PAGE = /\b(404|403|not found|couldn'?t find|access denied|forbidden|just a moment|attention required|verify you are human|are you a robot|captcha)\b|找不到|不存在|访问被拒绝/i;
const DISMISS_BUTTON = new RegExp(String.raw`^(accept|agree|allow( all)?|i agree|got it|ok|okay|no,? thanks|close|dismiss)\b|^(×|✕|同意|接受|全部接受|关闭|知道了)$`, "i");
const DISMISS_CLICK_TIMEOUT_MS = 1_000;
const LOGIN_PATH = /\/(login|log-in|signin|sign-in|sso|auth)\b/i;
const LOGIN_TITLE = /\b(sign|log)\s?in(to)?\b|登录/i;

/** 同一时间最多 MAX_PARALLEL 个页面；浏览器按需启动，没有任务时关闭，不留常驻进程。 */
let browser: Promise<Browser> | undefined;
let active = 0;
const waiting: (() => void)[] = [];

async function openPage(current: Browser) {
	// 无头浏览器默认的 UA 带 HeadlessChrome，很多网站会因此拦截。
	const context = await current.newContext({
		viewport: VIEWPORT,
		deviceScaleFactor: 1,
		userAgent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${current.version()} Safari/537.36`,
	});
	return context.newPage();
}

async function withPage<T>(run: (page: Page) => Promise<T>): Promise<T> {
	if (active >= MAX_PARALLEL) await new Promise<void>((resolve) => waiting.push(resolve));
	active++;
	browser ??= chromium.launch();
	const current = browser;
	let page: Page | undefined;
	try {
		page = await openPage(await current);
		return await run(page);
	} finally {
		await page?.context().close();
		active--;
		const next = waiting.shift();
		if (next) next();
		else if (active === 0 && browser === current) {
			browser = undefined;
			await (await current).close();
		}
	}
}

/** 等页面尽量加载完；只有等待超时属于正常情况（很多网站一直有长连接或轮询）。 */
async function settle(wait: Promise<unknown>) {
	try {
		await wait;
	} catch (error) {
		if (!(error instanceof errors.TimeoutError)) throw error;
	}
}

/** 在浏览器里执行：取判断页面可用性需要的信号。 */
function inspectPage() {
	const inFirstScreen = (el: Element) => {
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0 && r.top < innerHeight;
	};
	return {
		title: document.title.trim(),
		heading: document.querySelector("h1")?.textContent?.trim() ?? "",
		textLength: document.body?.innerText.trim().length ?? 0,
		password: [...document.querySelectorAll("input[type=password]")].some(inFirstScreen),
	};
}

async function clickInFirstScreen(button: Locator) {
	const box = await button.boundingBox({ timeout: DISMISS_CLICK_TIMEOUT_MS });
	if (box && box.y < VIEWPORT.height) await button.click({ timeout: DISMISS_CLICK_TIMEOUT_MS });
}

/** 点掉首屏的 Cookie 同意条与促销弹窗，它们会盖住真正要参考的页面。按可访问名称找按钮，包括 iframe 和 Shadow DOM 里的。 */
async function dismissOverlays(page: Page) {
	await page.keyboard.press("Escape");
	for (const frame of page.frames()) {
		for (const button of await frame.getByRole("button", { name: DISMISS_BUTTON }).filter({ visible: true }).all()) {
			// 点掉一个弹窗时其他按钮可能随之消失，等不到就跳过。
			await settle(clickInFirstScreen(button));
		}
	}
}

/** 在浏览器里执行：等字体加载和入场动画、弹窗淡出播完（无限循环的动画不等），最多等 maxMs。
 * 动画播放中又会触发新的动画（逐个淡入），所以一轮轮等到没有为止。 */
async function animationsDone(maxMs: number) {
	const deadline = performance.now() + maxMs;
	const timeout = () => new Promise((resolve) => setTimeout(resolve, Math.max(0, deadline - performance.now())));
	const frame = () => new Promise(requestAnimationFrame);
	await Promise.race([document.fonts.ready, timeout()]);
	// 刚点过的按钮要过一两帧才开始关弹窗的过渡。
	await frame();
	await frame();
	while (performance.now() < deadline) {
		const running = document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getComputedTiming().endTime !== Infinity);
		if (!running.length) return;
		// 被取消的动画会让 finished 拒绝，对截图来说一样是播完了。
		await Promise.race([Promise.all(running.map((a) => a.finished.catch(() => undefined))), timeout()]);
		await frame();
	}
}

/** 在浏览器里执行：主标题已经可见（很多首页等脚本加载完才把首屏逐字淡入、去模糊）；没有主标题的页面直接通过。 */
function headlineShown() {
	const h1 = [...document.querySelectorAll("h1")].find((el) => el.getBoundingClientRect().top < innerHeight);
	if (!h1) return true;
	const hidden = (el: Element) => {
		const style = getComputedStyle(el);
		return style.visibility === "hidden" || Number(style.opacity) < 0.99 || style.filter.includes("blur");
	};
	for (let el: Element | null = h1; el; el = el.parentElement) if (hidden(el)) return false;
	// 只看真正渲染出来的子元素：响应式文案里另一断点的版本是 display:none，永远不会淡入。
	return ![...h1.querySelectorAll("*")].some((el) => el.getClientRects().length > 0 && hidden(el));
}

/** 在浏览器里执行：一屏一屏滚到底，触发懒加载的图片，再回到顶部。 */
async function scrollThrough(maxHeight: number) {
	const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
	for (let y = 0; y < Math.min(document.documentElement.scrollHeight, maxHeight); y += innerHeight) {
		scrollTo(0, y);
		await frame();
		await frame();
	}
	scrollTo(0, 0);
	await frame();
}

function reject(status: number | undefined, finalUrl: string, page: ReturnType<typeof inspectPage>): Rejection | undefined {
	const heading = `${page.title} ${page.heading}`.trim();
	if (status && status >= 400) return { reason: "http-error", detail: `HTTP ${status}` };
	if (ERROR_PAGE.test(heading)) return { reason: "error-page", detail: heading };
	const loginForm = page.password && page.textLength < LOGIN_WALL_MAX_TEXT;
	if (LOGIN_PATH.test(new URL(finalUrl).pathname) || LOGIN_TITLE.test(heading) || loginForm) return { reason: "login", detail: finalUrl };
	if (page.textLength < MIN_TEXT_LENGTH) return { reason: "blank", detail: finalUrl };
}

/** 等页面加载、关掉遮挡的弹窗，再取页面信号。 */
async function prepare(page: Page) {
	await settle(page.waitForLoadState("load", { timeout: LOAD_TIMEOUT_MS }));
	await settle(page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS }));
	await settle(page.waitForFunction(headlineShown, undefined, { timeout: HEADLINE_TIMEOUT_MS }));
	// 同意条和弹窗常在入场动画之后才出现：先等动画，再关弹窗，再等它淡出。
	await page.evaluate(animationsDone, ANIMATION_WAIT_MS);
	await dismissOverlays(page);
	await page.evaluate(animationsDone, ANIMATION_WAIT_MS);
	return page.evaluate(inspectPage);
}

async function capture(url: string, fullPage: boolean): Promise<Shot> {
	return withPage(async (page) => {
		const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAVIGATION_TIMEOUT_MS });
		let info;
		try {
			info = await prepare(page);
		} catch (error) {
			// 页面加载后又用脚本跳转（地区选择、语言跳转），等新页面再来一次。
			if (!/context was destroyed/.test((error as Error).message)) throw error;
			info = await prepare(page);
		}
		const rejection = reject(response?.status(), page.url(), info);
		if (rejection) return { ok: false, url, ...rejection };
		let clip;
		if (fullPage) {
			await page.evaluate(scrollThrough, MAX_FULL_PAGE_HEIGHT);
			await settle(page.waitForLoadState("networkidle", { timeout: NETWORK_IDLE_TIMEOUT_MS }));
			const height = await page.evaluate(() => document.documentElement.scrollHeight);
			clip = { x: 0, y: 0, width: VIEWPORT.width, height: Math.min(height, MAX_FULL_PAGE_HEIGHT) };
		}
		const jpeg = await page.screenshot({ type: "jpeg", quality: JPEG_QUALITY, fullPage, clip });
		return { ok: true, url, title: info.title || new URL(page.url()).hostname, image: jpeg.toString("base64") };
	});
}

function cachePath(url: string, fullPage: boolean) {
	const key = createHash("sha256").update(url).digest("hex").slice(0, 32);
	return join(CACHE_DIR, `${key}${fullPage ? "-full" : ""}.json`);
}

async function readCache(path: string): Promise<Shot | undefined> {
	try {
		if (Date.now() - (await stat(path)).mtimeMs > CACHE_TTL_MS) return undefined;
		return JSON.parse(await readFile(path, "utf8")) as Shot;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
		throw error;
	}
}

/** 补全用户粘贴的地址（缺协议时按 https）；不是 http(s) 网页地址时返回空。 */
export function normalizeUrl(input: string) {
	const text = input.trim();
	try {
		const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
		return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
	} catch {
		return undefined;
	}
}

/** 打开网页并截图（首屏或整页）。打不开、错误页、登录墙返回 ok:false 和原因；成功的截图按 URL 复用。 */
export async function shoot(input: string, { fullPage = false } = {}): Promise<Shot> {
	const url = normalizeUrl(input);
	if (!url) return { ok: false, url: input, reason: "invalid", detail: input };
	const path = cachePath(url, fullPage);
	const cached = await readCache(path);
	if (cached) return cached;
	let shot: Shot;
	try {
		shot = await capture(url, fullPage);
	} catch (error) {
		return { ok: false, url, reason: "unreachable", detail: (error as Error).message.split("\n")[0]! };
	}
	if (shot.ok) {
		await mkdir(CACHE_DIR, { recursive: true });
		await writeFile(path, JSON.stringify(shot));
	}
	return shot;
}
