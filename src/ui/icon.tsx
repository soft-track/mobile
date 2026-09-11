import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * The subset of the web's icon set (`frontend/src/ui/Icon.tsx`) this app needs
 * so far, with the path geometry copied verbatim so the two clients draw the
 * same shapes. Same 24x24 viewBox, same 1.8 stroke, same round caps and joins.
 *
 * `home` has no web counterpart -- the web has no home destination -- and is
 * drawn to match the set's weight and corner treatment.
 */
export type IconName =
  | 'home'
  | 'board'
  | 'list'
  | 'search'
  | 'bell'
  | 'users'
  | 'settings'
  | 'chevron-right'
  | 'sun'
  | 'moon'
  | 'check'
  | 'logout';

export function Icon({
  name,
  size = 16,
  color,
  strokeWidth = 1.8,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'home' ? (
        <Path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z" {...stroke} />
      ) : null}

      {name === 'board' ? (
        <>
          <Rect x="3" y="4" width="5" height="16" rx="1.5" {...stroke} />
          <Rect x="9.5" y="4" width="5" height="11" rx="1.5" {...stroke} />
          <Rect x="16" y="4" width="5" height="8" rx="1.5" {...stroke} />
        </>
      ) : null}

      {name === 'list' ? (
        <Path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" {...stroke} />
      ) : null}

      {name === 'search' ? (
        <>
          <Circle cx="11" cy="11" r="6.5" {...stroke} />
          <Path d="m20 20-4.2-4.2" {...stroke} />
        </>
      ) : null}

      {name === 'bell' ? (
        <>
          <Path d="M18 9a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16S18 14 18 9Z" {...stroke} />
          <Path d="M13.7 19.5a2 2 0 0 1-3.4 0" {...stroke} />
        </>
      ) : null}

      {name === 'users' ? (
        <>
          <Circle cx="9" cy="8" r="3.5" {...stroke} />
          <Path
            d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3"
            {...stroke}
          />
        </>
      ) : null}

      {name === 'settings' ? (
        <>
          <Circle cx="12" cy="12" r="3" {...stroke} />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-3-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.1-3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 3 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z"
            {...stroke}
          />
        </>
      ) : null}

      {name === 'chevron-right' ? <Path d="m9 6 6 6-6 6" {...stroke} /> : null}

      {name === 'sun' ? (
        <>
          <Circle cx="12" cy="12" r="4" {...stroke} />
          <Path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            {...stroke}
          />
        </>
      ) : null}

      {name === 'moon' ? (
        <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" {...stroke} />
      ) : null}

      {name === 'check' ? <Path d="m5 12.5 4.5 4.5L19 7.5" {...stroke} /> : null}

      {name === 'logout' ? (
        <Path
          d="M10 17l5-5-5-5M15 12H3M13 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6"
          {...stroke}
        />
      ) : null}
    </Svg>
  );
}
