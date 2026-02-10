
export interface GradientLayer {
  type: 'radial' | 'linear' | 'conic';
  x: number;
  y: number;
  color: string;
  size: number;
  angle?: number;
  opacity: number;
}

export interface GradientConfig {
  layers: GradientLayer[];
  blurAmount: number;
  contrast: number;
  saturate: number;
  hueRotate: number;
  bgColor: string;
  blendMode: string;
  noiseOpacity: number;
}
