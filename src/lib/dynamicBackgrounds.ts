/**
 * Dynamic animated backgrounds for parallax depth mode.
 *
 * When the user enables "Background Depth", the original video gets cut into
 * foreground (person) and background. Normally the background = blurred copy
 * of the original. With a dynamic pattern, the background is REPLACED by a
 * generated animated pattern, giving a polished "studio shoot" feel.
 *
 * Each pattern has:
 *   - cssGradient + cssAnimation: live-preview rendering via CSS
 *   - lavfiSource(W, H, durationSec): FFmpeg expression that produces the
 *     same look, used during export.
 */

export type BgPatternId =
  | "original"
  | "sunset"
  | "cyber"
  | "bokeh"
  | "wave"
  | "particles"
  | "mesh-gradient";

export type DynamicBgPattern = {
  id: BgPatternId;
  name: string;
  description: string;
  emoji: string;
  /** CSS background for live preview */
  cssBackground: string;
  /** CSS animation property */
  cssAnimation: string;
  /**
   * FFmpeg lavfi source expression. Output is a SINGLE video stream
   * the renderer can use as the background layer.
   * Pass width/height/duration; returns full -f lavfi -t … args + filter graph.
   */
  lavfiSource: (w: number, h: number, dur: number) => string;
};

export const DYNAMIC_BACKGROUNDS: DynamicBgPattern[] = [
  {
    id: "original",
    name: "מקורי מטושטש",
    description: "רקע הסרטון המקורי + טשטוש",
    emoji: "🎬",
    cssBackground: "transparent",
    cssAnimation: "none",
    lavfiSource: (w, h, dur) =>
      `nullsrc=s=${w}x${h}:r=30:d=${dur.toFixed(2)}`,
  },
  {
    id: "sunset",
    name: "שקיעה",
    description: "כתום-ורוד שמתחלף",
    emoji: "🌅",
    cssBackground: "linear-gradient(135deg, #FF7E5F 0%, #FEB47B 50%, #FF6B9D 100%)",
    cssAnimation: "bg-sunset 12s ease-in-out infinite",
    lavfiSource: (w, h, dur) =>
      `color=c=0xFF7E5F:s=${w}x${h}:r=30:d=${dur.toFixed(2)},` +
      `hue='h=mod(t*20\\,360):s=1.4'`,
  },
  {
    id: "cyber",
    name: "סייבר",
    description: "סגול-תכלת ניאון",
    emoji: "🟣",
    cssBackground: "linear-gradient(135deg, #6A11CB 0%, #2575FC 50%, #00D4FF 100%)",
    cssAnimation: "bg-cyber 15s linear infinite",
    lavfiSource: (w, h, dur) =>
      `color=c=0x6A11CB:s=${w}x${h}:r=30:d=${dur.toFixed(2)},` +
      `hue='h=mod(180+t*15\\,360):s=1.5'`,
  },
  {
    id: "bokeh",
    name: "בוקה",
    description: "עיגולים מטושטשים",
    emoji: "✨",
    cssBackground:
      "radial-gradient(circle at 20% 30%, rgba(255,182,193,0.4), transparent 40%), " +
      "radial-gradient(circle at 70% 60%, rgba(135,206,235,0.4), transparent 40%), " +
      "radial-gradient(circle at 40% 80%, rgba(255,215,0,0.3), transparent 40%), " +
      "linear-gradient(135deg, #1a0033, #0a0a3a)",
    cssAnimation: "bg-bokeh 18s ease-in-out infinite",
    lavfiSource: (w, h, dur) =>
      // Bokeh = sparse random bright pixels on dark base + HEAVY blur.
      // (cellauto has no `d=` param — using color+geq+blur is more reliable.)
      `color=c=0x1a0033:s=${w}x${h}:r=30:d=${dur.toFixed(2)},` +
      `geq='r=if(gt(random(1)\\,0.997)\\,255\\,30):g=if(gt(random(1)\\,0.998)\\,255\\,40):b=if(gt(random(1)\\,0.997)\\,255\\,70)',` +
      `boxblur=luma_radius=40:luma_power=2,` +
      `colorbalance=rs=0.4:gs=-0.2:bs=0.4,` +
      `eq=brightness=-0.15:saturation=1.6`,
  },
  {
    id: "wave",
    name: "גלים",
    description: "גלי צבע סינוסואידיים",
    emoji: "🌊",
    cssBackground:
      "linear-gradient(45deg, #667EEA 0%, #764BA2 50%, #F093FB 100%)",
    cssAnimation: "bg-wave 8s ease-in-out infinite",
    lavfiSource: (w, h, dur) =>
      `nullsrc=s=${w}x${h}:r=30:d=${dur.toFixed(2)},` +
      `format=rgba,` +
      `geq='r=128+96*sin(X/60+T*1.5):g=128+96*sin(Y/60+T*1.8):b=200+55*sin((X+Y)/80+T*2)'`,
  },
  {
    id: "particles",
    name: "חלקיקים",
    description: "כוכבים זוהרים",
    emoji: "⭐",
    cssBackground:
      "radial-gradient(circle at 10% 20%, white 0.5px, transparent 1px), " +
      "radial-gradient(circle at 80% 40%, white 0.7px, transparent 1.4px), " +
      "radial-gradient(circle at 30% 70%, white 0.4px, transparent 0.8px), " +
      "linear-gradient(180deg, #0a0a2a, #1a1a4a, #0a0a2a)",
    cssAnimation: "bg-particles 20s linear infinite",
    lavfiSource: (w, h, dur) =>
      // Small noise points on dark background — feels like distant stars
      `nullsrc=s=${w}x${h}:r=30:d=${dur.toFixed(2)},` +
      `geq='r=if(gt(random(1)\\,0.997)\\,255\\,10):g=if(gt(random(1)\\,0.997)\\,255\\,10):b=if(gt(random(1)\\,0.998)\\,255\\,40)'`,
  },
  {
    id: "mesh-gradient",
    name: "מש גרדיאנט",
    description: "צבעים מתערבבים",
    emoji: "🎨",
    cssBackground:
      "linear-gradient(45deg, #FA8BFF 0%, #2BD2FF 50%, #2BFF88 100%)",
    cssAnimation: "bg-mesh 14s ease infinite",
    lavfiSource: (w, h, dur) =>
      `color=c=0xFA8BFF:s=${w}x${h}:r=30:d=${dur.toFixed(2)},` +
      `hue='h=mod(t*25\\,360):s=1.7',` +
      `boxblur=luma_radius=30:luma_power=1`,
  },
];

export const DYNAMIC_BG_MAP = Object.fromEntries(
  DYNAMIC_BACKGROUNDS.map((p) => [p.id, p]),
) as Record<BgPatternId, DynamicBgPattern>;
