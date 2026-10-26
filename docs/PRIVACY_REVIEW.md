# 隐私政策维护与发布检查

本次新增 `src/app/privacy/page.tsx`，构建输出为 `out/privacy.html`，目标公开地址为 `https://logicweaver.me/privacy`。页面是静态 HTML，不依赖登录或 API。首页页脚链接到该页面，使用现有明亮主题变量。

## 本次核对范围

依据本机 `tab-project-next` 当前源码，不代表对已上传 ZIP 的完整审计：

- `manifest.json`：浏览器权限、广泛的网站访问范围。
- `src/background/notifications.ts`：待办提醒、浏览器通知。
- `src/background/dnr.ts`：限定扩展发起的 Bilibili 资源请求的请求头规则。
- `src/background/index.ts`：YouTube Cookie 认证、账号状态诊断、下载及图片右键入口。
- `src/stickers/StickerStandalone.vue`：用户触发的页面图片提取。
- `src/services/calendar.service.ts`：Google 日历 OAuth 及本地会话令牌。
- `src/services/weather.service.ts`：城市设置、Open-Meteo 城市地理编码及经纬度天气查询。
- `src/firecrawl/firecrawl.service.ts`：向用户配置的解析节点发送目标网址。
- `src/services/sync.service.ts`、`sync-payload.ts`：当前备份键包括账号令牌、WebDAV 配置等，不能宣称凭据绝不进入备份。

仅根据字段名称和实现逻辑核对，不读取真实 Cookie、Token、环境配置或用户备份。

## 发布前仍需确认

1. 对照实际扩展发布 ZIP 的代码和启用功能审核政策及商店披露，不能把本页面当作完整安全或法律审计结论。
2. 确认 `support@logicweaver.me` 能收信。邮件路由的实际投递本次没有测试。
3. 远程代码申报另行审核：此前发现 `src/core/cli-bridge.ts` 的 `new Function` 入口及壁纸 sandbox，需追踪输入来源、发布包是否包含及可执行性，不能直接选择“无远程代码”。本次未修改扩展。
4. 账号信息、通信、位置及浏览相关信息的具体数据类型，按发布包行为与商店定义确认。不能因为功能默认关闭就不披露。
5. 核对网站及第三方服务的实际配置、使用条款；不读取 `.env`、`.env.local` 或 Cloudflare 凭据来做这项内容修改。
6. 明确授权后才提交、推送或部署。Cloudflare 部署后验证 `/privacy` 返回 200、内容为政策而非首页或 404，并检查移动端可读性、首页入口和支持链接。
7. 部署完成并验证前，不将目标 URL 当作已经上线的政策链接提交商店。

## 仓库与部署

用户授权将 GitHub 仓库由 `kongzhuww/kongzhuww.github.io` 改为 `kongzhuww/tab-project-website`，已告知旧 GitHub Pages 用户站地址可能受影响。Cloudflare Worker 名称和域名配置不随仓库改名自动变更；Cloudflare 控制台若连接了旧仓库，需要检查并视情况重新连接。本次不触发网站部署。

本地目录暂保留原路径，避免无关的工作区、虚拟环境或外部脚本路径失效；远端 origin 与项目包名对齐新名称。
