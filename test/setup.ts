// npm test 的全局准备：s-ui 自己的目录指向临时目录，测试不写用户真实的 ~/.s-ui。
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.S_UI_HOME ||= mkdtempSync(join(tmpdir(), "s-ui-test-home-"));
