declare module "react-plotly.js" {
  import { Component, CSSProperties } from 'react';

  interface PlotData {
    x?: Array<number | string | Date>;
    y?: Array<number | string>;
    type?: string;
    mode?: string;
    name?: string;
    text?: string | string[];
    marker?: {
      color?: string | string[];
      size?: number | number[];
      symbol?: string | string[];
    };
  }

  interface PlotLayout {
    title?: string;
    width?: number;
    height?: number;
    showlegend?: boolean;
    xaxis?: {
      title?: string;
      type?: string;
    };
    yaxis?: {
      title?: string;
      type?: string;
    };
  }

  interface PlotConfig {
    responsive?: boolean;
    displayModeBar?: boolean | 'hover';
    modeBarButtonsToRemove?: string[];
    displaylogo?: boolean;
  }

  interface PlotProps {
    data?: Array<Partial<PlotData>>;
    layout?: Partial<PlotLayout>;
    config?: Partial<PlotConfig>;
    style?: CSSProperties;
    className?: string;
    onHover?: (event: { points: Array<{ x: number; y: number }> }) => void;
    onClick?: (event: { points: Array<{ x: number; y: number }> }) => void;
    onSelected?: (event: { points: Array<{ x: number; y: number }> }) => void;
    onRelayout?: (event: { xaxis: { range: number[] }; yaxis: { range: number[] } }) => void;
  }

  class Plot extends Component<PlotProps> {}
  export default Plot;
} 