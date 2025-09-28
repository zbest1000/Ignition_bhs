import React, { useState, useCallback } from 'react';
import { Button, Tooltip, Space, Dropdown, InputNumber, Select } from 'antd';
import {
  ToolOutlined,
  LineOutlined,
  NodeIndexOutlined,
  MergeCellsOutlined,
  ShareAltOutlined,
  SettingOutlined,
  CopyOutlined,
  DeleteOutlined,
  NumberOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

export type ConveyorTool = 
  | 'select' 
  | 'straight' 
  | 'curve' 
  | 'merge' 
  | 'divert' 
  | 'transfer' 
  | 'accumulation'
  | 'spiral'
  | 'clone'
  | 'number'
  | 'flow';

interface ConveyorToolbarProps {
  activeTool: ConveyorTool;
  onToolChange: (tool: ConveyorTool) => void;
  onConveyorCreate: (type: string, properties: any) => void;
  onAutoNumber: () => void;
  onShowFlow: () => void;
  onCloneSelected: () => void;
  selectedCount: number;
  conveyorTemplates: ConveyorTemplate[];
  onTemplateSelect: (template: ConveyorTemplate) => void;
}

interface ConveyorTemplate {
  id: string;
  name: string;
  type: string;
  properties: {
    width: number;
    speed: number;
    color: string;
    length?: number;
    angle?: number;
    curveRadius?: number;
  };
}

const CONVEYOR_TEMPLATES: ConveyorTemplate[] = [
  {
    id: 'high-speed',
    name: 'High Speed',
    type: 'straight',
    properties: { width: 600, speed: 2.5, color: '#0066cc', length: 3000 }
  },
  {
    id: 'accumulation',
    name: 'Accumulation',
    type: 'accumulation',
    properties: { width: 800, speed: 0.5, color: '#009900', length: 2000 }
  },
  {
    id: 'sortation',
    name: 'Sortation',
    type: 'cross-belt',
    properties: { width: 1000, speed: 2.0, color: '#cc6600', length: 1500 }
  },
  {
    id: 'makeup',
    name: 'Makeup',
    type: 'straight',
    properties: { width: 800, speed: 0.3, color: '#6600cc', length: 1000 }
  },
  {
    id: 'curve-90',
    name: '90° Curve',
    type: 'curve',
    properties: { width: 600, speed: 1.0, color: '#ff6600', curveRadius: 1000 }
  },
  {
    id: 'curve-45',
    name: '45° Curve',
    type: 'curve',
    properties: { width: 600, speed: 1.0, color: '#ff6600', curveRadius: 800 }
  }
];

export const ConveyorToolbar: React.FC<ConveyorToolbarProps> = ({
  activeTool,
  onToolChange,
  onConveyorCreate,
  onAutoNumber,
  onShowFlow,
  onCloneSelected,
  selectedCount,
  conveyorTemplates,
  onTemplateSelect,
}) => {
  const [drawingMode, setDrawingMode] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<ConveyorTemplate>(CONVEYOR_TEMPLATES[0]);

  const handleTemplateSelect = useCallback((template: ConveyorTemplate) => {
    setCurrentTemplate(template);
    onTemplateSelect(template);
  }, [onTemplateSelect]);

  const handleToolSelect = useCallback((tool: ConveyorTool) => {
    onToolChange(tool);
    setDrawingMode(tool !== 'select');
  }, [onToolChange]);

  const templateMenu: MenuProps['items'] = CONVEYOR_TEMPLATES.map(template => ({
    key: template.id,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div 
          style={{ 
            width: 12, 
            height: 12, 
            backgroundColor: template.properties.color,
            borderRadius: 2 
          }} 
        />
        <span>{template.name}</span>
        <span style={{ fontSize: '11px', color: '#666' }}>
          {template.properties.width}mm × {template.properties.speed}m/s
        </span>
      </div>
    ),
    onClick: () => handleTemplateSelect(template),
  }));

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1000,
        background: 'white',
        padding: '8px 12px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 400,
      }}
    >
      {/* Template Selector */}
      <Dropdown menu={{ items: templateMenu }} trigger={['click']}>
        <Button 
          style={{ 
            backgroundColor: currentTemplate.properties.color,
            borderColor: currentTemplate.properties.color,
            color: 'white',
            minWidth: 120
          }}
        >
          <SettingOutlined />
          {currentTemplate.name}
        </Button>
      </Dropdown>

      <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9' }} />

      {/* Drawing Tools */}
      <Space size="small">
        <Tooltip title="Select Tool (V)">
          <Button
            type={activeTool === 'select' ? 'primary' : 'default'}
            icon={<ToolOutlined />}
            onClick={() => handleToolSelect('select')}
          />
        </Tooltip>

        <Tooltip title="Straight Conveyor (S)">
          <Button
            type={activeTool === 'straight' ? 'primary' : 'default'}
            icon={<LineOutlined />}
            onClick={() => handleToolSelect('straight')}
          />
        </Tooltip>

        <Tooltip title="Curved Conveyor (C)">
          <Button
            type={activeTool === 'curve' ? 'primary' : 'default'}
            icon={<NodeIndexOutlined />}
            onClick={() => handleToolSelect('curve')}
          />
        </Tooltip>

        <Tooltip title="Merge Point (M)">
          <Button
            type={activeTool === 'merge' ? 'primary' : 'default'}
            icon={<MergeCellsOutlined />}
            onClick={() => handleToolSelect('merge')}
          />
        </Tooltip>

        <Tooltip title="Diverter (D)">
          <Button
            type={activeTool === 'divert' ? 'primary' : 'default'}
            icon={<ShareAltOutlined />}
            onClick={() => handleToolSelect('divert')}
          />
        </Tooltip>
      </Space>

      <div style={{ width: 1, height: 24, backgroundColor: '#d9d9d9' }} />

      {/* Action Tools */}
      <Space size="small">
        <Tooltip title="Auto Number Conveyors (N)">
          <Button
            icon={<NumberOutlined />}
            onClick={onAutoNumber}
            disabled={selectedCount === 0}
          >
            Number ({selectedCount})
          </Button>
        </Tooltip>

        <Tooltip title="Show Flow Direction (F)">
          <Button
            icon={<ArrowRightOutlined />}
            onClick={onShowFlow}
          />
        </Tooltip>

        <Tooltip title="Clone Selected (Ctrl+D)">
          <Button
            icon={<CopyOutlined />}
            onClick={onCloneSelected}
            disabled={selectedCount === 0}
          />
        </Tooltip>
      </Space>

      {/* Drawing Mode Indicator */}
      {drawingMode && (
        <div style={{ 
          marginLeft: 8, 
          padding: '4px 8px', 
          background: '#e6f7ff', 
          borderRadius: 4,
          fontSize: '12px',
          color: '#1890ff'
        }}>
          Click-drag to draw {activeTool} conveyor
        </div>
      )}
    </div>
  );
};

export default ConveyorToolbar;
