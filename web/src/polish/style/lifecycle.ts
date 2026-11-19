const listeners = new Map<string, Set<() => void>>();

/** Called only after usePreviewControl verifies the iframe's source and origin. */
export function previewPageChanged(previewUrl: string) {
	for (const listener of listeners.get(previewUrl) ?? []) listener();
}

export function onPreviewPageChanged(previewUrl: string, listener: () => void) {
	const group = listeners.get(previewUrl) ?? new Set();
	group.add(listener);
	listeners.set(previewUrl, group);
	return () => {
		group.delete(listener);
		if (!group.size) listeners.delete(previewUrl);
	};
}
