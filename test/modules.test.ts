import { test } from "node:test";
import assert from "node:assert/strict";
import { defineModule, dispatchModule, type ModuleContext } from "../server/modules.ts";

type GreeterApi = { greet: { payload: { name: string }; result: string } };

test("module calls reach the named module's action, can report progress, and unknown targets are refused", async () => {
	const registry = {
		greeter: defineModule<GreeterApi>({
			greet: async ({ name }, ctx) => {
				ctx.progress({ step: "thinking" });
				return `hello ${name}`;
			},
		}),
	};
	const progress: unknown[] = [];
	const ctx = { progress: (data: unknown) => progress.push(data) } as unknown as ModuleContext;

	assert.equal(await dispatchModule(registry, { module: "greeter", action: "greet", payload: { name: "ann" } }, ctx), "hello ann");
	assert.deepEqual(progress, [{ step: "thinking" }]);
	await assert.rejects(dispatchModule(registry, { module: "nope", action: "greet", payload: {} }, ctx), /module/i);
	await assert.rejects(dispatchModule(registry, { module: "greeter", action: "nope", payload: {} }, ctx), /action/i);
});
