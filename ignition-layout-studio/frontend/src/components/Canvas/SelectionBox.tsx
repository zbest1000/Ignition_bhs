import React from 'react';
import { Rect } from 'react-konva';

interface SelectionBoxProps {
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

const SelectionBox: React.FC<SelectionBoxProps> = ({ rect }) => {
  return (
    <Rect
      x={rect.x}
      y={rect.y}
      width={rect.width}
      height={rect.height}
      fill='rgba(0, 102, 255, 0.1)'
      stroke='rgba(0, 102, 255, 0.8)'
      strokeWidth={1}
      listening={false}
    />
  );
};

export default SelectionBox;
