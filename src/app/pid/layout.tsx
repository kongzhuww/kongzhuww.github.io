import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PID 串口调试助手 · AI Auto-Tune",
  description: "连接单片机串口，实时绘制 PID 阶跃响应，并用你自己的 AI 接口自动整定 Kp/Ki/Kd。",
};

export default function PidLayout({ children }: { children: React.ReactNode }) {
  return children;
}
