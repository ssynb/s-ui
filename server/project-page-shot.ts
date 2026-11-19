import { chromium } from "playwright";
import type { ProjectPageShot } from "./protocol.ts";

const SHOT_VIEWPORT = { width: 1280, height: 800 };
const PAGE_TIMEOUT_MS = 60_000;
const JPEG_QUALITY = 80;

/** 调用方只传已发现页面的预览地址；不复用接受外部 URL 的参考截图入口。 */
export async function captureProjectPage(url: string): Promise<ProjectPageShot> {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: SHOT_VIEWPORT });
		await page.route("**/*", (route) => {
			const request = route.request();
			if (request.isNavigationRequest() && request.frame() === page.mainFrame() && request.url() !== url) return route.abort();
			return route.continue();
		});
		const response = await page.goto(url, { waitUntil: "networkidle", timeout: PAGE_TIMEOUT_MS });
		if (!response?.ok() || !response.headers()["content-type"]?.includes("text/html")) throw new Error(`HTTP ${response?.status() ?? "no response"}`);
		await page.evaluate(() => document.fonts.ready);
		const image = await page.screenshot({ type: "jpeg", quality: JPEG_QUALITY, fullPage: true, animations: "disabled" });
		return { image: image.toString("base64") };
	} catch (error) {
		return { error: (error as Error).message };
	} finally {
		await browser.close();
	}
}
