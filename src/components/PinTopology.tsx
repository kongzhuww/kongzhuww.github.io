"use client";

import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: "dark",
  securityLevel: "loose",
  themeVariables: {
    fontFamily: "var(--font-geist-sans)",
    primaryColor: "#3b82f6",
    edgeLabelBackground: "#111827",
  }
});

interface Pin {
  pin_name: string;
  pin_number: string;
  peripheral: string;
}

export default function PinTopology({ pins, repoName }: { pins: Pin[], repoName: string }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pins.length === 0 || !chartRef.current) return;

    // 生成 Mermaid 语法
    // 格式: MCU[Project Name] -- Pin:Name --> Module[Peripheral]
    let definition = `graph LR\n`;
    definition += `  MCU(("${repoName}"))\n`;
    
    // 按外设分组，避免线条太乱
    const groups: Record<string, string[]> = {};
    pins.forEach(pin => {
      if (!groups[pin.peripheral]) groups[pin.peripheral] = [];
      groups[pin.peripheral].push(`${pin.pin_number}: ${pin.pin_name}`);
    });

    Object.entries(groups).forEach(([module, connections]) => {
      const label = connections.join("<br/>");
      definition += `  MCU -- "${label}" --> ${module.replace(/\s+/g, "_")}[["${module}"]]\n`;
    });

    // 渲染
    const renderChart = async () => {
      try {
        const { svg } = await mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, definition);
        if (chartRef.current) {
          chartRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
      }
    };

    renderChart();
  }, [pins, repoName]);

  if (pins.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center text-gray-500">
        Add some pin connections to see the visual topology.
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl overflow-hidden">
      <h2 className="text-xl font-semibold text-blue-400 mb-6">Hardware Topology</h2>
      <div className="flex justify-center bg-gray-950/50 rounded-xl p-4 overflow-auto">
        <div ref={chartRef} className="min-w-[300px]"></div>
      </div>
    </div>
  );
}
