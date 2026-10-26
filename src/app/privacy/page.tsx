import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "隐私政策 | tab-project 新标签页",
  description: "tab-project 新标签页的数据处理、浏览器权限、第三方服务及数据删除说明。",
  alternates: { canonical: "https://logicweaver.me/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className={`landing ${styles.page}`} data-theme="light">
      <a className="skip-link" href="#privacy-content">跳到隐私政策正文</a>
      <header className={styles.header}>
        <Link href="/">tab-project 新标签页</Link>
        <Link href="/">返回首页</Link>
      </header>
      <main id="privacy-content" className={styles.content}>
        <article>
          <p className={styles.eyebrow}>PRIVACY POLICY</p>
          <h1>隐私政策</h1>
          <p className={styles.updated}>更新日期：2026 年 10 月 26 日</p>
          <p>本政策适用于 kongzhuww 开发的 tab-project 新标签页浏览器扩展（项目名 tab-project-next，部分界面沿用 LogicWeaver 名称），以及 logicweaver.me 介绍网站。不同版本、启用的组件及用户配置会影响实际处理的数据；本政策涵盖扩展提供的联网、同步和可选组件，不将“默认关闭”视为无需披露。</p>
          <aside className={styles.notice}>
            <strong>请先了解：</strong>新标签页设置和内容主要保存在浏览器本地，但这不意味着所有数据都不联网。连接第三方账号、使用 AI、天气、网页解析、聊天或同步服务时，相关服务会收到完成该功能所需的数据。备份还可能包含敏感凭据，请勿公开分享备份文件。
          </aside>

          <section aria-labelledby="data-heading">
            <h2 id="data-heading">1. 我们处理哪些数据，为什么处理</h2>
            <ul>
              <li><strong>设置与个人内容：</strong>主题、布局、工作区、常用网站、笔记、图片、待办、本地日历、通知记录及相关缓存，用于保存和呈现个人工作空间。</li>
              <li><strong>网页与浏览器信息：</strong>书签、常用网站、标签页标题、网址、图标，以及用户选择提取的图片、文本、字幕、音视频链接等，用于快捷访问、标签页管理、收藏和网页内容工具。这些数据可能反映浏览兴趣；不应因未申请 history 权限就认为不涉及浏览相关信息。</li>
              <li><strong>账号与认证信息：</strong>连接服务时可能处理账号标识、显示名称、头像、邮箱，以及用户配置的 API 密钥、访问令牌、OAuth 授权结果或浏览器中相应网站的 Cookie，用于认证和获取账号内容。扩展不要求用户向开发者提供账号密码；用户自行配置的同步服务可能需要其账号和密码。</li>
              <li><strong>城市与天气信息：</strong>读取保存的城市设置，向地理编码和天气服务发送城市名称或对应经纬度以查询天气。这里的经纬度可能来自城市查询，并不等同于设备的精确 GPS 定位。</li>
              <li><strong>通信与提交内容：</strong>使用聊天时处理昵称、用户标识、消息和附件等；使用 AI、翻译或网页解析时处理用户提交的提示词、文本、网页地址或选定内容。不要向不信任的服务提交秘密或他人的敏感信息。</li>
              <li><strong>网络请求信息：</strong>接收请求的网站及服务提供商能够获得来源 IP、请求时间、必要请求头和所请求的资源路径等网络信息，其日志与保留规则由相应服务决定。</li>
            </ul>
          </section>

          <section aria-labelledby="storage-heading">
            <h2 id="storage-heading">2. 本地存储、同步与备份</h2>
            <p>扩展使用浏览器扩展存储、localStorage、IndexedDB 和用户授权的文件位置保存配置、内容、缓存及部分凭据。本地保存不代表这些数据经过端到端加密，也不能防止拥有设备或浏览器配置访问权限的人读取。</p>
            <p>使用备份、浏览器同步、WebDAV 或其他配置的同步功能时，所选数据会写入备份文件、浏览器同步服务或用户配置的服务器。当前配置备份范围可能包含 GitHub／Todoist 令牌、Google 日历会话令牌、WebDAV 连接信息及聊天配置等敏感字段；请将备份按敏感文件保管，不要上传到公开仓库或发给他人。不能承诺所有备份都自动排除了凭据。</p>
            <p>同步目的地的访问控制、加密和保留策略由用户选择的服务决定。建议使用可信的 HTTPS 服务，并在操作前确认备份范围及目标地址。</p>
          </section>

          <section aria-labelledby="services-heading">
            <h2 id="services-heading">3. 第三方服务及数据传输</h2>
            <p>根据所使用的组件，扩展会访问 Bilibili、YouTube／Google、GitHub、Todoist、Open-Meteo、翻译服务、音乐与资讯来源、网站图标服务，以及用户配置的 AI、网页解析、聊天、WebDAV 和本机服务等。该列表为主要类型，并不代替实际配置的服务地址。</p>
            <ul>
              <li>登录或连接服务时，认证信息会用于向相应服务发起授权请求。例如 YouTube 使用相关登录 Cookie 构造认证，Bilibili 功能使用相应 Cookie 完成请求校验，Google 日历通过 OAuth 获取访问令牌。</li>
              <li>搜索、天气、翻译、AI 和网页解析等功能会向相关提供商发送查询内容、城市／经纬度、文本、提示词或目标网址；网站图标请求可能包含目标网站域名或网址。</li>
              <li>聊天消息会发送给所配置的通信服务，并可能由该服务保存、转发给会话参与者。未明确说明的聊天方案不应被视为端到端加密。</li>
              <li>部分服务位于用户所在国家或地区之外，请在连接前了解其隐私政策、数据处理地点和使用条款。关闭界面或隐藏组件不一定等于撤销账号授权或停止已配置的后台任务。</li>
            </ul>
            <p>数据用于提供相应功能，不用于出售个人数据、广告画像或与扩展用途无关的信用评估。第三方独立处理数据的方式受其自身政策约束；本政策不能代表这些第三方作出保证。</p>
          </section>

          <section aria-labelledby="permissions-heading">
            <h2 id="permissions-heading">4. 浏览器权限用途</h2>
            <ul>
              <li><strong>storage / unlimitedStorage：</strong>保存设置、内容与本地缓存，支持较大的本地数据量。</li>
              <li><strong>topSites / bookmarks / favicon：</strong>展示常用网站、读取与管理书签，并展示网站图标。</li>
              <li><strong>tabs / activeTab / scripting：</strong>管理标签页、获取当前网页信息，以及在用户触发网页工具时执行扩展内置的页面提取脚本。</li>
              <li><strong>cookies / identity：</strong>支持集成网站的登录状态、认证与 Google 日历 OAuth 授权。</li>
              <li><strong>declarativeNetRequest：</strong>对扩展发往指定 Bilibili 接口及资源域名的请求调整必要请求头，支持内容展示和播放。</li>
              <li><strong>alarms / notifications：</strong>安排待办提醒并展示系统通知。</li>
              <li><strong>sidePanel / contextMenus：</strong>提供侧边栏与右键菜单工具入口。</li>
              <li><strong>downloads / clipboardWrite：</strong>保存用户选择的资源，将用户选择复制的文本、链接或图片写入剪贴板。</li>
              <li><strong>网站访问权限：</strong>连接联网组件、自定义服务与用户指定网页资源。广泛的网站权限并不表示每个网站都会被访问，但允许的访问范围可能大于当前实际使用的范围。</li>
            </ul>
          </section>

          <section aria-labelledby="retention-heading">
            <h2 id="retention-heading">5. 保留、删除与撤销授权</h2>
            <p>不同数据的生命周期不同：设置和用户保存的内容通常保留到用户删除或清除扩展数据，缓存和通知记录按相应组件的清理规则处理。我们不对所有类别统一承诺固定的保留期限。</p>
            <ul>
              <li>通过相应组件删除笔记、图片、消息或配置；需要全面清理时，可在浏览器中清除扩展相关数据或卸载扩展。操作前请备份需要保留的内容。</li>
              <li>卸载扩展通常会移除扩展所属的浏览器本地数据，但不会自动删除已下载文件、用户授权文件夹中的内容、修改过的浏览器书签、第三方账号数据或服务器上的备份。</li>
              <li>停止同步后，还需在同步服务中删除备份和历史版本；删除本机副本并不保证远端副本被删除，重新同步也可能恢复数据。</li>
              <li>断开服务后，请在服务商后台撤销 OAuth 授权、吊销 API 令牌或清除对应网站登录会话。仅关闭组件不等于使已发放的凭据失效。</li>
              <li>如需处理第三方持有的消息、账号或日志，请联系该服务商；开发者无法直接替用户删除不受其控制的数据。</li>
            </ul>
          </section>

          <section aria-labelledby="website-heading">
            <h2 id="website-heading">6. 介绍网站与支持联系</h2>
            <p>logicweaver.me 是静态介绍网站，页面演示使用示例数据，不会直接读取浏览器扩展中的个人配置。本网站代码未接入广告、用户登录或行为统计 SDK；托管与网络基础设施（包括 Cloudflare）仍可能为内容交付、安全及故障诊断处理访问 IP、请求信息和日志。</p>
            <p>点击外部链接后适用目标网站的政策。联系支持时，邮件服务及开发者会接收用户提供的邮箱、问题描述与附件，用于回复和处理问题。请不要发送密码、Cookie、访问令牌、完整敏感备份或未遮盖的个人截图；公开 GitHub Issue 会让内容对公众可见。</p>
          </section>

          <section aria-labelledby="security-heading">
            <h2 id="security-heading">7. 安全与用户选择</h2>
            <p>浏览器权限和服务授权不能消除所有风险。请保护设备、浏览器配置、导出文件和服务密钥，谨慎配置第三方节点；服务在后台刷新时也可能继续发送必要请求。发现凭据泄露时，应立即在服务商处撤销或轮换凭据，并删除不应公开的副本。</p>
            <p>用户可以不连接第三方账号、不启用联网组件，并通过浏览器权限设置限制访问。部分功能会因此不可用。该产品不面向儿童提供专门服务；如发现不当处理儿童个人信息，请联系开发者。</p>
          </section>

          <section aria-labelledby="contact-heading">
            <h2 id="contact-heading">8. 联系与政策更新</h2>
            <p>开发者：kongzhuww。隐私问题、数据处理说明或删除请求可发送至 <a href="mailto:support@logicweaver.me">support@logicweaver.me</a>。我们会在可控制的范围内处理请求，不会要求用户通过公开问题区提交敏感数据。</p>
            <p>功能、服务或数据处理方式变化时，本页面将更新并标注日期。商店的数据披露应与实际发布版本及本政策保持一致；新功能不能仅凭这份政策推定已经获得用户授权。</p>
          </section>
        </article>
      </main>
      <footer className={styles.footer}>
        <Link href="/">返回首页</Link>
        <a href="mailto:support@logicweaver.me">联系支持</a>
      </footer>
    </div>
  );
}
