// 页面外观比较：桌面与手机两种宽度下各截一张整页图，逐像素比对（允许抗锯齿级别的微小差异）。
import { chromium } from "playwright";

/** 桌面宽度与手机宽度：只有窄屏才出现的样式（媒体查询）也要核对。 */
const VIEWPORTS = [
	{ width: 1280, height: 800 },
	{ width: 390, height: 844 },
];
/** 单个像素任一通道差超过它才算不同。 */
const CHANNEL_TOLERANCE = 24;
/** 不同像素占比不超过它，视为外观一致。 */
const MAX_DIFFERENT_RATIO = 0.002;

/** 页面在每种宽度下的整页截图，顺序同 VIEWPORTS。 */
export async function screenshotPage(url: string) {
	const browser = await chromium.launch();
	try {
		const shots: Buffer[] = [];
		for (const viewport of VIEWPORTS) {
			const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
			await page.goto(url, { waitUntil: "networkidle" });
			await page.evaluate(() => document.fonts.ready);
			shots.push(await page.screenshot({ type: "png", fullPage: true }));
			await page.close();
		}
		return shots;
	} finally {
		await browser.close();
	}
}

/** 每种宽度下前后两张截图都尺寸相同、几乎每个像素都一样时为 true。 */
export async function sameAppearance(before: Buffer[], after: Buffer[]) {
	for (const [i, shot] of before.entries()) {
		if (!(await sameImage(shot, after[i]!))) return false;
	}
	return true;
}

async function sameImage(before: Buffer, after: Buffer) {
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
