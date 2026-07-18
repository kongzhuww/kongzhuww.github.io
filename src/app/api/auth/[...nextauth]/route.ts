import NextAuth, { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { ProxyAgent, setGlobalDispatcher } from "undici";

// 仅在显式配置时启用代理，避免默认强制代理导致 OAuth 超时
const PROXY_URL = process.env.GITHUB_PROXY_URL;

if (PROXY_URL) {
  try {
    console.log("[NextAuth] Initializing with configured proxy");
    const proxyAgent = new ProxyAgent(PROXY_URL);
    setGlobalDispatcher(proxyAgent);
  } catch (e) {
    console.warn("[NextAuth] Failed to set proxy agent:", e);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      authorization: { params: { scope: "read:user user:email repo" } },
      // 进一步放宽超时限制到 30 秒，应对极差的网络环境
      httpOptions: {
        timeout: 30000,
      },
    }),
  ],
  pages: {
    signIn: "/", 
  },
  debug: process.env.NODE_ENV !== "production",
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        const user = session.user as typeof session.user & { id?: string };
        user.id = token.sub;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
