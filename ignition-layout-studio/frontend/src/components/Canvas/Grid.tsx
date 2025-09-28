import React from 'react';
import { Line } from 'react-konva';

interface GridProps {
  width: number;
  height: number;
  gridSize: number;
  stroke?: string;
  strokeWidth?: number;
}

const Grid: React.FC<GridProps> = ({
  width,
  height,
  gridSize,
  stroke = '#e0e0e0',
  strokeWidth = 0.5,
}) => {
  const lines = [];

  // Vertical lines
  for (let x = 0; x <= width; x += gridSize) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, 0, x, height]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  }

  // Horizontal lines
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, y, width, y]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        listening={false}
      />
    );
  }

  return <>{lines}</>;
};

export default Grid;
