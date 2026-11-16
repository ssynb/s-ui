import { homedir } from "node:os";
import { join } from "node:path";

/** s-ui 自己的目录：配置与 agent 资源都放这里，不碰用户的 ~/.pi。可用环境变量 S_UI_HOME 改位置。 */
export const APP_HOME = process.env.S_UI_HOME || join(homedir(), ".s-ui");
