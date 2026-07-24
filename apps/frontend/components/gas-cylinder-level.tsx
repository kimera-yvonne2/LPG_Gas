"use client";

import { useId } from "react";

type LevelTone = {
  color: string;
  label: string;
  textClass: string;
};

export function gasLevelTone(value: number): LevelTone {
  if (value > 60) {
    return { color: "#22c55e", label: "Good", textClass: "text-green-700" };
  }
  if (value >= 30) {
    return { color: "#f97316", label: "Running low", textClass: "text-orange-700" };
  }
  return { color: "#ef4444", label: "Refill soon", textClass: "text-red-700" };
}

export function GasCylinderLevel({ value }: { value: number }) {
  const percentage = Math.min(100, Math.max(0, value));
  const tone = gasLevelTone(percentage);
  const clipId = useId().replace(/:/g, "");
  const fillHeight = (percentage / 100) * 188;
  const fillY = 238 - fillHeight;

  return (
    <div
      className="flex items-center justify-center gap-6 sm:gap-9"
      role="img"
      aria-label={`Gas cylinder is ${percentage.toFixed(1)} percent full. Status: ${tone.label}.`}
    >
      <svg
        aria-hidden="true"
        className="h-[245px] w-[150px] drop-shadow-[0_18px_26px_rgba(0,0,0,.28)]"
        viewBox="0 0 150 270"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="28" y="50" width="94" height="188" rx="38" />
          </clipPath>
          <linearGradient id={`${clipId}-shell`} x1="0" x2="1">
            <stop offset="0" stopColor="#cbd5e1" />
            <stop offset=".22" stopColor="#f8fafc" />
            <stop offset=".62" stopColor="#94a3b8" />
            <stop offset="1" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id={`${clipId}-liquid`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={tone.color} stopOpacity=".78" />
            <stop offset="1" stopColor={tone.color} />
          </linearGradient>
        </defs>

        <path
          d="M54 36V18c0-7 5-12 12-12h18c7 0 12 5 12 12v18"
          fill="none"
          stroke="#94a3b8"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <rect x="65" y="22" width="20" height="18" rx="3" fill="#64748b" />
        <rect x="24" y="40" width="102" height="208" rx="44" fill={`url(#${clipId}-shell)`} />
        <rect x="28" y="50" width="94" height="188" rx="38" fill="#101d31" />
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="28"
            y={fillY}
            width="94"
            height={fillHeight + 4}
            fill={`url(#${clipId}-liquid)`}
            className="transition-all duration-700"
          />
          {percentage > 0 && (
            <path
              d={`M28 ${fillY + 3} Q51 ${fillY - 4} 75 ${fillY + 3} T122 ${fillY + 3} V${fillY + 12} H28Z`}
              fill={tone.color}
              opacity=".92"
            />
          )}
          <path d="M48 62V222" stroke="white" strokeOpacity=".12" strokeWidth="8" strokeLinecap="round" />
        </g>
        <rect x="28" y="50" width="94" height="188" rx="38" fill="none" stroke="white" strokeOpacity=".25" strokeWidth="2" />
        <path d="M35 249h80" stroke="#64748b" strokeWidth="8" strokeLinecap="round" />
      </svg>

      <div className="min-w-[104px]">
        <strong className={`block text-[42px] font-black leading-none tracking-[-0.05em] ${tone.textClass}`}>
          {percentage.toFixed(1)}%
        </strong>
        <span className={`mt-3 inline-flex rounded-full border border-current/20 px-3 py-1 text-[11px] font-extrabold ${tone.textClass}`}>
          {tone.label}
        </span>
        <p className="mt-2 text-[11px] text-slate-500">Gas remaining</p>
      </div>
    </div>
  );
}
