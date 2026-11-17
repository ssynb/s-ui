// 页面外观比较：同一视口下整页截图，逐像素比对（允许抗锯齿级别的微小差异）。
import { chromium } from "playwright";

const VIEWPORT = { width: 1280, height: 800 };
/** 单个像素任一通道差超过它才算不同。 */
const CHANNEL_TOLERANCE = 24;
/** 不同像素占比不超过它，视为外观一致。 */
const MAX_DIFFERENT_RATIO = 0.002;

export async function screenshotPage(url: string) {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
		await page.goto(url, { waitUntil: "networkidle" });
		await page.evaluate(() => document.fonts.ready);
		return await page.screenshot({ type: "png", fullPage: true });
	} finally {
		await browser.close();
	}
}

/** 两张截图尺寸相同、几乎每个像素都一样时为 true。 */
export async function sameAppearance(before: Buffer, after: Buffer) {
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		return await page.evaluate(
			async ({ a, b, tolerance, maxRatio }) => {
				const decode = async (base64: string) => {
					const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
					const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
					const ctx = canvas.getContext("2d")!;
					ctx.drawImage(bitmap, 0, 0);
					return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
				};
				const [x, y] = await Promise.all([decode(a), decode(b)]);
				if (x.width !== y.width || x.height !== y.height) return false;
				let different = 0;
				for (let i = 0; i < x.data.length; i += 4) {
					if (Math.abs(x.data[i]! - y.data[i]!) > tolerance || Math.abs(x.data[i + 1]! - y.data[i + 1]!) > tolerance || Math.abs(x.data[i + 2]! - y.data[i + 2]!) > tolerance) different++;
				}
				return different / (x.width * x.height) <= maxRatio;
			},
			{ a: before.toString("base64"), b: after.toString("base64"), tolerance: CHANNEL_TOLERANCE, maxRatio: MAX_DIFFERENT_RATIO },
		);
	} finally {
		await browser.close();
	}
}
