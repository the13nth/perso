export type Point = {
  x: number;
  y: number;
  z: number;
  cluster: number;
  label?: string;
  [key: string]: unknown;
};

export type PlotData = {
  points: Point[];
  categories?: string[];
}; 