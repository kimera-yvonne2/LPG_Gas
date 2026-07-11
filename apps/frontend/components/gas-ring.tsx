export function GasRing({ value, size = 156 }: { value: number; size?: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return <div className="relative" style={{ width: size, height: size }}><svg viewBox="0 0 112 112" className="-rotate-90"><circle cx="56" cy="56" r={radius} fill="none" stroke="#dce5ed" strokeWidth="8" /><circle cx="56" cy="56" r={radius} fill="none" stroke="#16863a" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} /></svg><div className="absolute inset-0 grid place-items-center text-center"><div><strong className="block text-[25px] text-[#0f3d2c]">{value}%</strong><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Remaining</span></div></div></div>;
}
