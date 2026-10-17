import type { CSSProperties, ReactElement } from 'react';
import { rasterFor } from './manifest';

const INK = '#3A2C26';
const sw = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Filtro de textura tipo papel/acuarela compartido por todos los sprites SVG. */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <filter id="paper" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0 0.15  0 0 0 0.16 0" result="grain" />
          <feComposite in="grain" in2="SourceGraphic" operator="in" result="g2" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="g2" />
          </feMerge>
        </filter>
        <filter id="wobble">
          <feTurbulence type="turbulence" baseFrequency="0.02" numOctaves="2" seed="8" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="2.2" />
        </filter>
      </defs>
    </svg>
  );
}

type Art = (props: { variant?: string }) => ReactElement;

const Hut: Art = () => (
  <g filter="url(#paper)">
    <ellipse cx="60" cy="108" rx="44" ry="8" fill="#000" opacity=".12" />
    <path d="M18 62 Q16 100 24 106 L96 106 Q104 100 102 62 Z" fill="#C9966B" {...sw} />
    <path d="M52 106 L52 82 Q60 72 68 82 L68 106 Z" fill="#6B4A32" {...sw} />
    <path d="M6 64 Q60 -4 114 64 Q60 52 6 64 Z" fill="#D9A765" {...sw} />
    <path d="M24 56 L32 44 M44 48 L50 32 M66 46 L68 30 M86 50 L80 36" stroke={INK} strokeWidth="1.6" fill="none" />
  </g>
);

const Acacia: Art = () => (
  <g filter="url(#paper)">
    <ellipse cx="60" cy="112" rx="30" ry="6" fill="#000" opacity=".12" />
    <path d="M56 112 Q54 80 50 60 L66 60 Q64 84 66 112 Z" fill="#8A5A3A" {...sw} />
    <path d="M8 56 Q14 26 40 28 Q60 6 84 26 Q114 22 112 52 Q92 66 60 58 Q30 66 8 56 Z" fill="#6F9250" {...sw} />
    <path d="M30 40 Q40 34 52 40 M70 34 Q84 32 96 42" stroke="#4E6E36" strokeWidth="2" fill="none" />
  </g>
);

const Well: Art = ({ variant }) => (
  <g filter="url(#paper)">
    <ellipse cx="60" cy="108" rx="48" ry="9" fill="#000" opacity=".14" />
    {/* soportes y viga */}
    <path d="M18 90 L18 28 L28 28 L28 90 Z M92 90 L92 28 L102 28 L102 90 Z" fill="#8A5A3A" {...sw} />
    <path d="M10 26 L110 26 L110 36 L10 36 Z" fill="#9C6A44" {...sw} />
    {/* brocal de piedra */}
    <path d="M14 78 Q14 104 60 106 Q106 104 106 78 Q106 66 60 64 Q14 66 14 78 Z" fill="#B9B2A6" {...sw} />
    <ellipse cx="60" cy="72" rx="42" ry="9" fill={variant === 'no-water' ? '#5b5348' : '#55B5D8'} {...sw} />
    <path d="M30 80 L34 96 M52 84 L56 102 M74 84 L78 102 M92 80 L88 96" stroke={INK} strokeWidth="1.4" opacity=".55" />
    {/* cubo y cuerda */}
    <path d="M60 36 L60 58" stroke={INK} strokeWidth="2" />
    <path d="M50 58 L70 58 L67 72 L53 72 Z" fill="#7B7F86" {...sw} />
    {variant === 'no-water' && <path d="M40 64 Q60 70 80 64" stroke="#8a5a3a" strokeWidth="2" fill="none" />}
    {variant === 'valve-damage' && (
      <g>
        <path d="M84 48 L102 70" stroke="#8a2f2a" strokeWidth="5" strokeLinecap="round" />
        <path d="M92 40 L100 50 M100 40 L92 52" stroke={INK} strokeWidth="2.4" />
        <path d="M30 72 L44 100 M44 72 L36 104" stroke={INK} strokeWidth="2" opacity=".7" />
      </g>
    )}
    {variant === 'contaminated' && (
      <g>
        <rect x="42" y="82" width="36" height="22" rx="3" fill="#FFF3D6" {...sw} />
        <path d="M60 85 L72 102 L48 102 Z" fill="#D8483E" {...sw} />
        <path d="M60 90 L60 96 M60 98.6 L60 99" stroke="#fff" strokeWidth="2.2" />
      </g>
    )}
  </g>
);

const Semaphore: Art = () => (
  <g filter="url(#paper)">
    <ellipse cx="60" cy="236" rx="46" ry="9" fill="#000" opacity=".16" />
    <path d="M36 224 L84 224 L88 238 L32 238 Z" fill="#B9B2A6" {...sw} />
    <path d="M54 132 L66 132 L68 226 L52 226 Z" fill="#4a4a50" {...sw} />
    <path d="M28 20 Q60 4 92 20 L96 134 Q60 148 24 134 Z" fill="#3b3b42" {...sw} />
    {[44, 78, 112].map((cy) => (
      <circle key={cy} cx="60" cy={cy} r="17" fill="#1f1f24" {...sw} />
    ))}
  </g>
);

const Person =
  (cloth: string, skin: string, scale: number, jerrycan: boolean, notebook: boolean): Art =>
  () => (
    <g filter="url(#paper)" transform={`translate(0 ${(1 - scale) * 120}) scale(${scale})`} style={{ transformOrigin: '30px 120px' }}>
      <ellipse cx="30" cy="116" rx="18" ry="4" fill="#000" opacity=".15" />
      <path d="M22 108 L22 80 M38 108 L38 80" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M14 82 Q14 46 24 40 L36 40 Q46 46 46 82 Z" fill={cloth} {...sw} />
      <circle cx="30" cy="28" r="12" fill={skin} {...sw} />
      <path d="M18 24 Q30 8 42 24 Q30 16 18 24 Z" fill="#2a1f1b" stroke={INK} strokeWidth="1.6" />
      <circle cx="26" cy="28" r="1.3" fill={INK} />
      <circle cx="34" cy="28" r="1.3" fill={INK} />
      <path d="M26 34 Q30 37 34 34" stroke={INK} strokeWidth="1.6" fill="none" />
      {jerrycan && (
        <g>
          <rect x="21" y="2" width="18" height="14" rx="3" fill="#F2C233" {...sw} />
          <path d="M33 2 L37 -3 L39 2" fill="#F2C233" stroke={INK} strokeWidth="1.8" />
        </g>
      )}
      {notebook && <rect x="40" y="58" width="12" height="16" rx="1.5" fill="#FFF9ED" {...sw} />}
    </g>
  );

/** Guardiana de la ONG: chaleco verde con franja reflectante, gorra y tablilla (no es del pueblo). */
const Guardian: Art = () => (
  <g filter="url(#paper)">
    <ellipse cx="30" cy="116" rx="18" ry="4" fill="#000" opacity=".15" />
    <path d="M22 108 L22 80 M38 108 L38 80" stroke="#2f3a4a" strokeWidth="5" strokeLinecap="round" />
    <path d="M18 108 L26 108 M34 108 L42 108" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    <path d="M14 84 Q13 46 24 40 L36 40 Q47 46 46 84 Z" fill="#f2efe6" {...sw} />
    <path d="M17 82 Q16 50 25 42 L28 42 L28 82 Z M43 82 Q44 50 35 42 L32 42 L32 82 Z" fill="#2B9B5A" {...sw} />
    <path d="M17 66 L28 66 M32 66 L43 66" stroke="#F2C233" strokeWidth="3" />
    <circle cx="30" cy="28" r="12" fill="#6b3f2b" {...sw} />
    <path d="M17 24 Q30 10 43 24 Z" fill="#2B9B5A" {...sw} />
    <path d="M40 23 L50 25" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    <circle cx="26" cy="29" r="1.3" fill={INK} />
    <circle cx="34" cy="29" r="1.3" fill={INK} />
    <path d="M26 34 Q30 37 34 34" stroke={INK} strokeWidth="1.6" fill="none" />
    <rect x="42" y="56" width="13" height="17" rx="1.5" fill="#FFF9ED" {...sw} />
    <path d="M45 61 L52 61 M45 65 L52 65 M45 69 L50 69" stroke={INK} strokeWidth="1.2" />
  </g>
);

/** Centro regional de la ONG: edificio encalado, techo azul, antena parabólica. */
const OngBuilding: Art = () => (
  <g filter="url(#paper)">
    <ellipse cx="80" cy="112" rx="72" ry="8" fill="#000" opacity=".14" />
    <path d="M14 58 L146 58 L146 108 L14 108 Z" fill="#f4f1e8" {...sw} />
    <path d="M6 60 L80 26 L154 60 Z" fill="#3186C7" {...sw} />
    <rect x="66" y="78" width="28" height="30" fill="#7a5236" {...sw} />
    <rect x="26" y="70" width="24" height="18" fill="#bfe3f2" {...sw} />
    <rect x="110" y="70" width="24" height="18" fill="#bfe3f2" {...sw} />
    <path d="M38 70 L38 88 M122 70 L122 88" stroke={INK} strokeWidth="1.6" />
    <rect x="52" y="44" width="56" height="14" rx="3" fill="#FFF9ED" {...sw} />
    <path d="M126 38 L126 18" stroke={INK} strokeWidth="2.4" />
    <path d="M114 22 Q126 6 140 20 Z" fill="#dcdcdc" {...sw} />
    <path d="M30 108 L30 98 M134 108 L134 98" stroke="#6F9250" strokeWidth="6" strokeLinecap="round" />
  </g>
);

/** Torre repetidora (backhaul) en un cerro. */
const RelayTower: Art = () => (
  <g filter="url(#paper)">
    <path d="M10 118 Q60 84 110 118 Z" fill="#c99b63" {...sw} />
    <path d="M48 104 L58 18 L62 18 L72 104 Z" fill="none" stroke={INK} strokeWidth="2.6" />
    <path d="M51 80 L69 80 M53 60 L67 60 M55 40 L65 40 M51 80 L67 60 M53 60 L65 40 M69 80 L53 60 M67 60 L55 40" stroke={INK} strokeWidth="1.6" />
    <circle cx="60" cy="14" r="5" fill="#D8483E" {...sw} />
    <path d="M44 8 Q36 16 44 24 M76 8 Q84 16 76 24" stroke="#3186C7" strokeWidth="2.2" fill="none" />
  </g>
);

/** Caja del pozo: nodo LoRa + botones BIEN/MAL + LED local (el color lo pone el código). */
const DeviceBox: Art = () => (
  <g filter="url(#paper)">
    <path d="M28 96 L28 40" stroke="#8A5A3A" strokeWidth="6" />
    <path d="M28 20 L28 2" stroke={INK} strokeWidth="2.2" />
    <circle cx="28" cy="2" r="2.4" fill={INK} />
    <rect x="10" y="20" width="36" height="34" rx="4" fill="#cfd6dc" {...sw} />
    <circle cx="20" cy="44" r="5" fill="#2B9B5A" {...sw} />
    <circle cx="36" cy="44" r="5" fill="#D8483E" {...sw} />
    <rect x="14" y="88" width="28" height="8" rx="2" fill="#b9b2a6" {...sw} />
  </g>
);

const ART: Record<string, { Art: Art; box: string; variant?: string }> = {
  'ong-building': { Art: OngBuilding, box: '0 0 160 120' },
  'relay-tower': { Art: RelayTower, box: '0 0 120 120' },
  'device-box': { Art: DeviceBox, box: '0 -4 56 104' },
  'woman-blue': { Art: Person('#3F8FC9', '#7a4a32', 1, true, false), box: '0 -8 60 130' },
  'hut-a': { Art: Hut, box: '0 0 120 120' },
  'hut-b': { Art: Hut, box: '0 0 120 120' },
  acacia: { Art: Acacia, box: '0 0 120 120' },
  'well-enabled': { Art: Well, box: '0 0 120 120', variant: 'enabled' },
  'well-no-water': { Art: Well, box: '0 0 120 120', variant: 'no-water' },
  'well-contaminated': { Art: Well, box: '0 0 120 120', variant: 'contaminated' },
  'well-valve-damage': { Art: Well, box: '0 0 120 120', variant: 'valve-damage' },
  'semaphore-body': { Art: Semaphore, box: '0 0 120 250' },
  'woman-jerrycan': { Art: Person('#E0703A', '#7a4a32', 1, true, false), box: '0 -8 60 130' },
  'child-blue': { Art: Person('#3F8FC9', '#7a4a32', 0.78, false, false), box: '0 -8 60 130' },
  'child-orange': { Art: Person('#F29A38', '#6b3f2b', 0.74, false, false), box: '0 -8 60 130' },
  'field-worker': { Art: Guardian, box: '0 -8 60 130' },
};

interface SpriteProps {
  name: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}

/** Usa PNG/WebP real si existe en src/assets/png; si no, el SVG provisorio. */
export function Sprite({ name, alt, className, style }: SpriteProps) {
  const url = rasterFor(name);
  if (url) return <img src={url} alt={alt} className={className} style={style} draggable={false} />;
  const entry = ART[name];
  if (!entry) return null;
  const { Art, box, variant } = entry;
  return (
    <svg viewBox={box} className={className} style={style} role="img" aria-label={alt}>
      <Art variant={variant} />
    </svg>
  );
}

/** Fondo del paisaje: raster si existe; si no, un SVG de terreno provisorio. */
export function Landscape() {
  const url = rasterFor('landscape');
  if (url) return <img src={url} alt="" className="landscape" draggable={false} />;
  return (
    <svg className="landscape" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe3f2" />
          <stop offset="1" stopColor="#f4ead0" />
        </linearGradient>
      </defs>
      <rect width="160" height="90" fill="#F5D9A4" />
      <rect width="160" height="22" fill="url(#sky)" />
      <path d="M0 22 L26 10 L48 20 L78 8 L108 20 L134 9 L160 21 L160 24 L0 24 Z" fill="#9b8aa8" opacity=".75" />
      <circle cx="46" cy="7" r="3.6" fill="#F7C948" />
      {/* senderos de tierra */}
      <g fill="none" stroke="#C99B63" strokeWidth="5" strokeLinecap="round" opacity=".85">
        <path d="M78 54 Q62 52 50 40 Q36 36 28 33" />
        <path d="M78 54 Q96 52 108 40 Q116 36 120 33" />
        <path d="M78 54 Q74 66 70 72 Q70 76 75 82" />
      </g>
      <ellipse cx="78" cy="56" rx="34" ry="14" fill="#E4B87D" opacity=".7" />
      <g fill="#6F9250" opacity=".55">
        {Array.from({ length: 42 }).map((_, i) => (
          <ellipse key={i} cx={(i * 37) % 160} cy={26 + ((i * 53) % 62)} rx="2.4" ry="1" />
        ))}
      </g>
      <path d="M0 74 Q40 70 70 86 L0 90 Z" fill="#55B5D8" opacity=".85" />
    </svg>
  );
}
