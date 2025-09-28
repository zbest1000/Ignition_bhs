import React from 'react';
import { Button, Tooltip, Space, Divider, Switch, InputNumber, Dropdown } from 'antd';
import {
  SelectOutlined,
  DragOutlined,
  EditOutlined,
  DeleteOutlined,
  UndoOutlined,
  RedoOutlined,
  ExpandOutlined,
  CompressOutlined,
  RotateRightOutlined,
  ColumnWidthOutlined,
  ColumnHeightOutlined,
  BorderOutlined,
  NodeIndexOutlined,
  PushpinOutlined,
  RulerOutlined,
  CalculatorOutlined,
  SaveOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { EditMode } from '../../types';
import type { MenuProps } from 'antd';

interface EditToolbarProps {
  editMode: EditMode;
  onToolChange: (tool: EditMode['tool']) => void;
  onToggleEdit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onSnapToGridToggle: (enabled: boolean) => void;
  onSnapToPointsToggle: (enabled: boolean) => void;
  onSnapDistanceChange: (distance: number) => void;
  onShowDimensionsToggle: (enabled: boolean) => void;
  onShowAnglesToggle: (enabled: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
}

export const EditToolbar: React.FC<EditToolbarProps> = ({
  editMode,
  onToolChange,
  onToggleEdit,
  onUndo,
  onRedo,
  onDelete,
  onSnapToGridToggle,
  onSnapToPointsToggle,
  onSnapDistanceChange,
  onShowDimensionsToggle,
  onShowAnglesToggle,
  onSave,
  onCancel,
  canUndo,
  canRedo,
  hasSelection,
}) => {
  const transformMenu: MenuProps['items'] = [
    {
      key: 'rotate90',
      label: 'Rotate 90° CW',
      icon: <RotateRightOutlined />,
      onClick: () => console.log('Rotate 90'),
    },
    {
      key: 'rotate-90',
      label: 'Rotate 90° CCW',
      icon: <RotateRightOutlined style={{ transform: 'scaleX(-1)' }} />,
      onClick: () => console.log('Rotate -90'),
    },
    {
      key: 'flipH',
      label: 'Flip Horizontal',
      icon: <ColumnWidthOutlined />,
      onClick: () => console.log('Flip H'),
    },
    {
      key: 'flipV',
      label: 'Flip Vertical',
      icon: <ColumnHeightOutlined />,
      onClick: () => console.log('Flip V'),
    },
  ];

  const alignMenu: MenuProps['items'] = [
    {
      key: 'alignLeft',
      label: 'Align Left',
      onClick: () => console.log('Align Left'),
    },
    {
      key: 'alignCenter',
      label: 'Align Center',
      onClick: () => console.log('Align Center'),
    },
    {
      key: 'alignRight',
      label: 'Align Right',
      onClick: () => console.log('Align Right'),
    },
    { type: 'divider' },
    {
      key: 'alignTop',
      label: 'Align Top',
      onClick: () => console.log('Align Top'),
    },
    {
      key: 'alignMiddle',
      label: 'Align Middle',
      onClick: () => console.log('Align Middle'),
    },
    {
      key: 'alignBottom',
      label: 'Align Bottom',
      onClick: () => console.log('Align Bottom'),
    },
    { type: 'divider' },
    {
      key: 'distributeH',
      label: 'Distribute Horizontally',
      onClick: () => console.log('Distribute H'),
    },
    {
      key: 'distributeV',
      label: 'Distribute Vertically',
      onClick: () => console.log('Distribute V'),
    },
  ];

  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'white',
        padding: '8px 16px',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Main Tools */}
      <Space size="small">
        <Tooltip title="Select Tool (V)">
          <Button
            type={editMode.tool === 'select' ? 'primary' : 'default'}
            icon={<SelectOutlined />}
            onClick={() => onToolChange('select')}
          />
        </Tooltip>

        <Tooltip title="Move Tool (M)">
          <Button
            type={editMode.tool === 'move' ? 'primary' : 'default'}
            icon={<DragOutlined />}
            onClick={() => onToolChange('move')}
            disabled={!hasSelection}
          />
        </Tooltip>

        <Tooltip title="Edit Vertices (E)">
          <Button
            type={editMode.enabled ? 'primary' : 'default'}
            icon={<EditOutlined />}
            onClick={onToggleEdit}
            disabled={!hasSelection}
          />
        </Tooltip>

        <Tooltip title="Rotate Tool (R)">
          <Button
            type={editMode.tool === 'rotate' ? 'primary' : 'default'}
            icon={<RotateRightOutlined />}
            onClick={() => onToolChange('rotate')}
            disabled={!hasSelection}
          />
        </Tooltip>

        <Tooltip title="Scale Tool (S)">
          <Button
            type={editMode.tool === 'scale' ? 'primary' : 'default'}
            icon={<ExpandOutlined />}
            onClick={() => onToolChange('scale')}
            disabled={!hasSelection}
          />
        </Tooltip>

        <Tooltip title="Delete (Del)">
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={onDelete}
            disabled={!hasSelection}
          />
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      {/* Transform Tools */}
      <Space size="small">
        <Dropdown menu={{ items: transformMenu }} placement="bottomLeft">
          <Button icon={<BorderOutlined />}>Transform</Button>
        </Dropdown>

        <Dropdown menu={{ items: alignMenu }} placement="bottomLeft">
          <Button icon={<NodeIndexOutlined />}>Align</Button>
        </Dropdown>
      </Space>

      <Divider type="vertical" />

      {/* History */}
      <Space size="small">
        <Tooltip title="Undo (Ctrl+Z)">
          <Button
            icon={<UndoOutlined />}
            onClick={onUndo}
            disabled={!canUndo}
          />
        </Tooltip>

        <Tooltip title="Redo (Ctrl+Y)">
          <Button
            icon={<RedoOutlined />}
            onClick={onRedo}
            disabled={!canRedo}
          />
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      {/* Snap Options */}
      <Space size="small">
        <Tooltip title="Snap to Grid">
          <Switch
            checkedChildren={<PushpinOutlined />}
            unCheckedChildren={<PushpinOutlined />}
            checked={editMode.snapToGrid}
            onChange={onSnapToGridToggle}
            size="small"
          />
        </Tooltip>

        <Tooltip title="Snap to Points">
          <Switch
            checkedChildren={<NodeIndexOutlined />}
            unCheckedChildren={<NodeIndexOutlined />}
            checked={editMode.snapToPoints}
            onChange={onSnapToPointsToggle}
            size="small"
          />
        </Tooltip>

        <Tooltip title="Snap Distance">
          <InputNumber
            min={5}
            max={50}
            step={5}
            value={editMode.snapDistance}
            onChange={(value) => onSnapDistanceChange(value || 10)}
            size="small"
            style={{ width: 60 }}
            suffix="px"
          />
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      {/* Display Options */}
      <Space size="small">
        <Tooltip title="Show Dimensions">
          <Switch
            checkedChildren={<RulerOutlined />}
            unCheckedChildren={<RulerOutlined />}
            checked={editMode.showDimensions}
            onChange={onShowDimensionsToggle}
            size="small"
          />
        </Tooltip>

        <Tooltip title="Show Angles">
          <Switch
            checkedChildren={<CalculatorOutlined />}
            unCheckedChildren={<CalculatorOutlined />}
            checked={editMode.showAngles}
            onChange={onShowAnglesToggle}
            size="small"
          />
        </Tooltip>
      </Space>

      {/* Edit Mode Actions */}
      {editMode.enabled && (
        <>
          <Divider type="vertical" />
          <Space size="small">
            <Tooltip title="Save Changes">
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={onSave}
              >
                Save
              </Button>
            </Tooltip>

            <Tooltip title="Cancel Edit">
              <Button
                icon={<CloseOutlined />}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </Tooltip>
          </Space>
        </>
      )}
    </div>
  );
};
