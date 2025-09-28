# AutoCAD-Style Edit Mode Documentation

## Overview

The Ignition Layout Studio now includes an AutoCAD-style edit mode that allows users to modify objects directly on the canvas by manipulating control points, similar to how CAD software works. This provides precise control over component geometry and positioning.

## Features

### 1. **Point-Based Editing**
- **Vertex Points**: Primary control points at corners/endpoints (blue squares)
- **Control Points**: Secondary points for curves and paths (green circles)
- **Midpoints**: Edge manipulation points (green circles)
- **Center Points**: Reference points for rotation/scaling

### 2. **Edit Tools**
- **Select Tool (V)**: Select and manipulate components
- **Move Tool (M)**: Move entire components
- **Edit Vertices (E)**: Enter/exit vertex editing mode
- **Rotate Tool (R)**: Rotate components around center
- **Scale Tool (S)**: Resize components proportionally
- **Delete (Del)**: Remove selected components

### 3. **Snapping System**
- **Grid Snapping**: Snap to grid points (10px default)
- **Point Snapping**: Snap to other component vertices
- **Adjustable Snap Distance**: 5-50px range
- **Visual Feedback**: Highlights when snapping occurs

### 4. **Visual Aids**
- **Dimensions Display**: Shows width/height in pixels
- **Angle Indicators**: Shows rotation angles
- **Connection Lines**: Shows relationships between points
- **Selection Outline**: Dashed border on selected items

### 5. **History Management**
- **Undo/Redo**: Full history tracking (50 actions)
- **Action Types**: Move, rotate, scale, vertex edits
- **Keyboard Shortcuts**: Ctrl+Z (undo), Ctrl+Y (redo)

## How to Use

### Entering Edit Mode

1. **Select a Component**: Click on any component on the canvas
2. **Press 'E' or Click Edit Button**: Enter vertex editing mode
3. **Edit Points Appear**: Blue squares (vertices) and green circles (control points)

### Manipulating Points

1. **Click and Drag**: Click on any edit point and drag to new position
2. **Snapping**: Points will snap to grid or nearby points automatically
3. **Constraints**: Some points have movement constraints (min/max bounds)

### Component-Specific Editing

#### Conveyors
- **Start/End Points**: Adjust conveyor length and angle
- **Control Point** (curved only): Adjust curve radius and shape
- **Maintains Belt Properties**: Width and other properties preserved

#### Pipes
- **Path Points**: Each segment point can be moved
- **Add Points**: Double-click on midpoints to add vertices
- **Custom Paths**: Create complex pipe routing

#### Tanks/Vessels
- **Corner Points**: Resize by dragging corners
- **Aspect Ratio**: Option to maintain proportions
- **Center Reference**: Used for rotation operations

#### Standard Components
- **8 Control Points**: 4 corners + 4 edge midpoints
- **Flexible Resizing**: Drag any point to reshape
- **Convert Midpoints**: Double-click to convert to vertex

## Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| **E** | Edit Mode | Toggle vertex editing mode |
| **V** | Select Tool | Switch to selection tool |
| **M** | Move Tool | Switch to move tool |
| **R** | Rotate Tool | Switch to rotation tool |
| **S** | Scale Tool | Switch to scale tool |
| **Delete/Backspace** | Delete | Delete selected components |
| **Ctrl+Z** | Undo | Undo last action |
| **Ctrl+Shift+Z** | Redo | Redo last undone action |
| **Ctrl+Y** | Redo | Alternative redo shortcut |
| **Escape** | Cancel/Deselect | Exit edit mode or clear selection |
| **Enter** | Save | Save changes and exit edit mode |
| **Ctrl+G** | Toggle Grid Snap | Enable/disable grid snapping |
| **Ctrl+Shift+D** | Show Dimensions | Toggle dimension display |
| **Ctrl+Shift+A** | Show Angles | Toggle angle display |

## Toolbar Controls

### Main Tools Section
- Select, Move, Edit, Rotate, Scale, Delete buttons
- Visual feedback shows active tool

### Transform Menu
- Rotate 90° CW/CCW
- Flip Horizontal/Vertical
- Quick transformation presets

### Align Menu
- Align Left/Center/Right
- Align Top/Middle/Bottom
- Distribute Horizontally/Vertically

### Snap Options
- Grid Snap Toggle
- Point Snap Toggle
- Snap Distance Adjustment (5-50px)

### Display Options
- Show/Hide Dimensions
- Show/Hide Angles
- Visual measurement aids

### Edit Actions
- Save Changes (commits edits)
- Cancel Edit (reverts changes)

## Advanced Features

### 1. **Constraint System**
Points can have constraints:
- **Position Limits**: Min/max X/Y bounds
- **Fixed Angle**: Maintain angle relationships
- **Fixed Distance**: Maintain distance from reference

### 2. **Smart Point Generation**
Edit points are generated based on component type:
- Rectangular components: 8 points (corners + edges)
- Conveyors: Start, end, and curve control
- Pipes: Path vertices with control points
- Tanks: 4 corners + center reference

### 3. **History Tracking**
Every action is recorded:
- Component ID
- Timestamp
- Action type
- Before/after states
- Limited to 50 entries (FIFO)

### 4. **Multi-Component Support**
Future enhancement for:
- Group selection editing
- Batch transformations
- Relative positioning

## Technical Implementation

### Architecture

```typescript
EditModeService (Singleton)
├── State Management
│   ├── Edit Mode State
│   ├── Selected Component
│   ├── Edit Points
│   └── History Stack
├── Point Manipulation
│   ├── Generate Points
│   ├── Update Geometry
│   ├── Apply Constraints
│   └── Snap Calculations
└── History Management
    ├── Add Entry
    ├── Undo/Redo
    └── Clear History

EditableShape (React Component)
├── Render Edit Handles
├── Handle Drag Events
├── Show Visual Aids
└── Update Component

EditToolbar (React Component)
├── Tool Selection
├── Snap Controls
├── Display Options
└── Action Buttons
```

### Data Flow

1. **User Action** → Canvas Mouse/Keyboard Event
2. **Edit Service** → Process action, update state
3. **Component Update** → Apply geometry changes
4. **Visual Feedback** → Render handles, dimensions
5. **History Entry** → Record for undo/redo

## Best Practices

1. **Use Grid Snapping** for aligned layouts
2. **Enable Dimensions** when precision matters
3. **Save Frequently** to commit changes
4. **Use Keyboard Shortcuts** for efficiency
5. **Check Constraints** before forcing moves

## Limitations

1. **Single Component Editing**: Currently one at a time
2. **No Bezier Curves**: Control points are linear
3. **Fixed Constraint Types**: Limited constraint options
4. **No Custom Grids**: 10px grid size only

## Future Enhancements

1. **Multi-Select Editing**: Edit multiple components
2. **Custom Constraints**: User-defined constraints
3. **Bezier Curves**: Smooth curve editing
4. **Measurement Tools**: Distance and angle tools
5. **Alignment Guides**: Smart guides for alignment
6. **Copy/Paste Points**: Duplicate point arrangements
7. **Point Templates**: Predefined point patterns
8. **3D Editing**: Z-axis manipulation

## Troubleshooting

### Points Not Appearing
- Ensure component is selected
- Press 'E' or click Edit button
- Check if component type supports editing

### Snapping Issues
- Verify snap settings in toolbar
- Adjust snap distance if needed
- Disable snapping for free movement

### Can't Move Points
- Check for locked components
- Verify point constraints
- Ensure edit mode is active

### Changes Not Saving
- Click Save button or press Enter
- Check for validation errors
- Ensure component isn't locked

## Conclusion

The AutoCAD-style edit mode brings professional CAD capabilities to the Ignition Layout Studio, enabling precise component manipulation through an intuitive point-based system. This dramatically improves the ability to create accurate industrial layouts and modify components with precision.
