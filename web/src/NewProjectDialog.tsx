import { useState } from "react";
import { errorText, type T } from "./i18n.ts";
import { shortenPath } from "./paths.ts";
import { Button, Modal } from "./ui.tsx";
import type { RequestError } from "./useWorkspace.ts";

type Props = {
	t: T;
	parent: string;
	name: string;
	home?: string;
	onNameChange: (name: string) => void;
	onChangeParent: () => void;
	onCreate: (parent: string, name: string) => Promise<void>;
	onClose: () => void;
};

/** 新建项目：在选定位置下建一个空文件夹并打开。 */
export function NewProjectDialog({ t, parent, name, home, onNameChange, onChangeParent, onCreate, onClose }: Props) {
	const [error, setError] = useState("");
	const [creating, setCreating] = useState(false);

	const submit = async () => {
		setCreating(true);
		try {
			await onCreate(parent, name.trim());
		} catch (e) {
			setError(errorText(t, e as RequestError));
		} finally {
			setCreating(false);
		}
	};

	return (
		<Modal title={t.newProjectTitle} onClose={onClose} className="w-[min(480px,94vw)]">
			<form
				className="space-y-3 px-4 pt-1 pb-4"
				onSubmit={(e) => {
					e.preventDefault();
					if (name.trim()) submit();
				}}
			>
				<label className="block space-y-1">
					<span className="text-muted">{t.projectName}</span>
					<input
						autoFocus
						value={name}
						onChange={(e) => {
							onNameChange(e.target.value);
							setError("");
						}}
						aria-invalid={Boolean(error)}
						aria-describedby="new-project-hint"
						className="h-7 w-full rounded-md bg-panel px-2 ring-1 ring-line ring-inset focus:ring-accent focus:outline-none aria-invalid:ring-danger"
					/>
				</label>
				<div className="space-y-1">
					<span className="block text-muted">{t.location}</span>
					<div className="flex items-center gap-2">
						<span className="min-w-0 flex-1 truncate font-mono text-[12.5px]" title={parent}>
							{shortenPath(parent, home)}
						</span>
						<Button onClick={onChangeParent}>{t.change}</Button>
					</div>
				</div>
				<p id="new-project-hint" role={error ? "alert" : undefined} className={`text-[12.5px] ${error ? "text-danger" : "text-muted"}`}>
					{error || t.newProjectHint}
				</p>
				<div className="flex justify-end gap-2 pt-1">
					<Button onClick={onClose}>{t.cancel}</Button>
					<Button type="submit" variant="primary" disabled={!name.trim() || creating}>
						{t.create}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
