export function projectName(dir: string) {
	return dir.split(/[\\/]/).filter(Boolean).at(-1) ?? dir;
}

/** 主目录开头的路径缩成 ~，与 IDEA 的最近项目列表一致。 */
export function shortenPath(dir: string, home?: string) {
	return home && (dir === home || dir.startsWith(`${home}/`) || dir.startsWith(`${home}\\`)) ? `~${dir.slice(home.length)}` : dir;
}
