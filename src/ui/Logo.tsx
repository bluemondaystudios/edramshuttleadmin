// The EDRAM van and wordmark, as on edramshuttle.co.za.
export const VAN_PATH =
  'M4 6a4 4 0 0 1 4-4h34c1.5 0 2.8.8 3.5 2l8 12 6 3a4 4 0 0 1 2.5 3.7V30a3 3 0 0 1-3 3h-3a7 7 0 0 0-14 0H22a7 7 0 0 0-14 0H7a3 3 0 0 1-3-3V6zm6 2v9h12V8H10zm16 0v9h12V8H26zm16 0v9h9l-6-9h-3z';

export function VanMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 40" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={VAN_PATH} />
      <circle fill="currentColor" cx="15" cy="33" r="5" />
      <circle fill="currentColor" cx="47" cy="33" r="5" />
    </svg>
  );
}

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`logo logo-${size}`}>
      <VanMark className="logo-van" />
      <span className="logo-text">
        <span className="logo-name">EDRAM</span>
        <span className="logo-tag">ADMIN</span>
      </span>
    </span>
  );
}
