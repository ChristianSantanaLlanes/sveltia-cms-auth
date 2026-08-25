import type { CSSProperties, ReactElement } from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  w?: string | number;
  h?: string | number;
  radius?: string;
  className?: string;
}

const size = (value: string | number | undefined) =>
  typeof value === 'number' ? `${value}px` : value;

export function Skeleton({ w, h, radius, className }: SkeletonProps): ReactElement {
  const style: CSSProperties = {};
  if (w !== undefined) style.width = size(w);
  if (h !== undefined) style.height = size(h);
  if (radius !== undefined) style.borderRadius = radius;

  return (
    <span
      className={className ? `skeleton ${className}` : 'skeleton'}
      style={style}
      aria-hidden="true"
    />
  );
}

export default Skeleton;
