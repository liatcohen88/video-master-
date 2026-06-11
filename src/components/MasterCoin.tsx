/* eslint-disable @next/next/no-img-element */
/**
 * Brand currency coin — "מאסטר". Uses the real 3D-rendered gold coin asset
 * (public/master-coin.png) so the in-app currency looks premium everywhere
 * the old lucide <Coins/> icon used to appear.
 *
 * `size` controls width AND height in px (the asset is square). A soft golden
 * drop-shadow gives it a little lift on dark backgrounds.
 */
export default function MasterCoin({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/master-coin.png"
      alt="מאסטר"
      width={size}
      height={size}
      className={`inline-block object-contain align-[-0.15em] select-none pointer-events-none ${className}`}
      style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))" }}
      draggable={false}
    />
  );
}
