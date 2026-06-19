# 🤖 Agent Workflow & SOP (Standard Operating Procedure)

## 📦 打包与测试部署流程 (Packaging & Desktop Deployment)

**目标**：确保在每次构建扩展的新版本 ZIP 后，不仅生成了生产包，还能立即在宿主机的桌面上提供一个解压好的文件夹，以便用户在其他浏览器（如 Edge、Chrome Beta 等）中直接「加载已解压的扩展程序」进行多环境对比测试。

**触发条件**：
当用户要求「打包」、「生成 zip」、「更新版本并打包」时，必须执行本工作流。

**具体步骤**：
1. **更新版本号**：如果用户要求升级版本，首先修改 `manifest.json` 中的 `version` 字段。
2. **执行打包脚本**：在终端中运行项目根目录下的官方打包脚本，而不是手动执行 `zip` 命令：
   ```bash
   sh scripts/package.sh <版本号>
   # 例如：sh scripts/package.sh 1.5.6
   ```
3. **桌面端环境清理与部署**：
   * `scripts/package.sh` 脚本内部**已经集成**了自动清理旧版桌面测试文件夹（`~/Desktop/jyutping-extension-v*`）和解压最新 ZIP 到桌面（`~/Desktop/jyutping-extension-v<版本号>`）的逻辑。
   * **Agent 职责**：等待脚本执行完成。如果因任何原因脚本没有执行桌面清理与解压，AI (Agent) 必须**主动**在终端中运行以下命令作为兜底保障：
   ```bash
   rm -rf ~/Desktop/jyutping-extension-v*
   rm -rf ~/Desktop/jyutping-extension
   mkdir -p ~/Desktop/jyutping-extension-v<版本号>
   unzip -o jyutping-extension-v<版本号>.zip -d ~/Desktop/jyutping-extension-v<版本号>
   ```
4. **汇报结果**：明确告知用户 ZIP 已经生成，且**桌面上的测试文件夹已更新至最新版本**，旧版本已清理。

---
> **Agent 内部备忘录**：
> "这样你也不会忘记" —— 这份 SOP 文件旨在强化 AI 的长程记忆。在处理与发布、打包相关的请求时，请始终检查此工作流，确保在生成 ZIP 后，桌面测试环境得到了同步更新，避免开发环境与商店发布版本的行为不一致。
