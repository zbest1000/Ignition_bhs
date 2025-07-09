# Ignition Layout Studio User Guide

## Table of Contents
1. [Getting Started](#getting-started)
2. [Project Management](#project-management)
3. [File Upload and Processing](#file-upload-and-processing)
4. [Canvas Editor](#canvas-editor)
5. [Component Library](#component-library)
6. [Template System](#template-system)
7. [Export Options](#export-options)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Getting Started

### System Requirements
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Minimum 4GB RAM recommended
- 1920x1080 resolution or higher for best experience

### First Launch
1. Navigate to the application URL (e.g., http://localhost:3000)
2. The project list page will appear
3. Create your first project by clicking "New Project"

## Project Management

### Creating a Project
1. Click "New Project" button
2. Enter project details:
   - **Name**: Descriptive project name
   - **Description**: Optional project description
   - **Tags**: Add tags for organization (comma-separated)
3. Click "Create" to start

### Project Actions
- **Open**: Click on a project card to open it
- **Clone**: Duplicate an existing project with all components
- **Delete**: Remove a project (requires confirmation)
- **Search**: Use the search bar to filter projects

### Project Statistics
Each project card displays:
- Component count
- File count
- Last modified date
- Project tags

## File Upload and Processing

### Supported File Types
- **Drawings**: DWG, DXF (AutoCAD formats)
- **Images**: PNG, JPEG, TIFF, BMP
- **Documents**: PDF (multi-page support)
- **Data**: XLSX, CSV (equipment lists)

### Upload Process
1. Open a project
2. Click the "Files" tab in the sidebar
3. Drag and drop files or click "Upload Files"
4. Files are automatically categorized

### OCR Processing
For images and PDFs:
1. Select a file from the list
2. Click the "Process with OCR" button
3. Wait for processing to complete
4. Detected components appear on the canvas

### Batch Processing
1. Select multiple files (Ctrl/Cmd + Click)
2. Click "Batch Process"
3. All selected files are processed sequentially

## Canvas Editor

### Navigation Tools

#### Select Tool (V)
- Click to select single components
- Drag to create selection box
- Shift+Click to add to selection
- Ctrl/Cmd+Click for multi-select

#### Pan Tool (H)
- Click and drag to move around canvas
- Alternative: Hold Space + drag

#### Zoom Controls
- Mouse wheel to zoom in/out
- Ctrl/Cmd + Plus/Minus keys
- Zoom buttons in toolbar
- Double-click to zoom to fit

### Grid and Snapping
- **Toggle Grid**: Show/hide alignment grid
- **Snap to Grid**: Components snap to grid points
- **Grid Size**: Adjustable in settings

### Component Manipulation

#### Moving Components
1. Select component(s)
2. Drag to new position
3. Use arrow keys for precise movement
4. Shift + Arrow for larger steps

#### Rotating Components
1. Select component
2. Use rotation handle or press R
3. Enter rotation angle
4. Shift + drag for 15° increments

#### Resizing Components
1. Select component
2. Drag corner handles
3. Hold Shift to maintain aspect ratio
4. Enter exact dimensions in properties panel

### Layers
- **Show/Hide Layers**: Toggle visibility
- **Lock Layers**: Prevent editing
- **Reorder Layers**: Drag to rearrange
- **Layer Properties**: Color, opacity, name

## Component Library

### Component Categories

#### Conveyors
- **Straight Conveyor**: Basic belt/roller conveyor
- **Curve Conveyor**: 45°, 90°, 180° curves
- **Accumulation**: Zero-pressure accumulation
- **Spiral**: Vertical transport
- **Chain/Belt/Roller**: Specific conveyor types

#### Equipment
- **Motor**: Drive units
- **Diverter**: Route splitting
- **Merge**: Route combining
- **Sorter**: High-speed sorting
- **Scanner**: Barcode/RFID readers
- **Scale**: Weighing systems
- **EDS Machine**: Explosive detection

#### Packaging
- **Wrapper**: Stretch/shrink wrap
- **Palletizer**: Pallet building
- **Depalletizer**: Pallet breaking
- **Label Printer**: Print-and-apply

#### Robotics
- **Robot Arm**: Pick and place
- **AGV Station**: Automated guided vehicle
- **Turntable**: Rotation stations

#### Safety
- **Emergency Stop**: E-stop buttons
- **Safety Gate**: Access control
- **Light Curtain**: Area protection

#### Sensors
- **Photo Eye**: Presence detection
- **Proximity Sensor**: Metal detection
- **Limit Switch**: Position sensing

### Adding Components
1. Select component type from library
2. Click on canvas to place
3. Or drag from library to canvas
4. Configure properties immediately

### Component Properties
- **Equipment ID**: Unique identifier
- **Label**: Display name
- **Type**: Component category
- **Tags**: PLC/SCADA tags
- **Style**: Color, stroke, opacity
- **Metadata**: Custom properties

## Template System

### Creating Templates
1. Select one or more components
2. Right-click → "Create Template"
3. Configure template:
   - **Name**: Template identifier
   - **Parameters**: Dynamic values
   - **Bindings**: Tag mappings
   - **Animations**: State changes

### Template Parameters
- **Equipment ID**: ${equipmentId}
- **Tag Prefix**: ${tagPrefix}
- **Custom Values**: ${param1}, ${param2}

### Using Templates
1. Open Templates panel
2. Drag template to canvas
3. Fill in parameter values
4. Template expands to components

### Template Library
- **Save to Library**: Store for reuse
- **Import/Export**: Share templates
- **Version Control**: Track changes
- **Categories**: Organize templates

## Export Options

### Export Formats

#### SVG Layout
- Vector graphics format
- Scalable without quality loss
- Preserves all visual elements
- Compatible with web browsers

#### Ignition Perspective
- JSON view definition
- Component bindings included
- Responsive layout support
- Direct import to Ignition

#### Ignition Vision
- XML window format
- Legacy system support
- Component scripts included
- Template definitions

#### Complete Package
- All formats included
- Project metadata
- Component list (CSV)
- Documentation

### Export Settings
1. Click "Export" button
2. Select format(s)
3. Configure options:
   - **Scale**: Output dimensions
   - **Include**: Components, templates, metadata
   - **Tag Format**: OPC paths or relative
4. Download package

### Export Structure
```
project-export/
├── layouts/
│   └── layout.svg
├── perspective/
│   └── views.json
├── vision/
│   └── windows.xml
├── templates/
│   └── templates.json
├── metadata/
│   ├── components.csv
│   └── project.json
└── README.txt
```

## Keyboard Shortcuts

### General
- **Ctrl/Cmd + S**: Save project
- **Ctrl/Cmd + Z**: Undo
- **Ctrl/Cmd + Y**: Redo
- **Delete**: Delete selected
- **Escape**: Cancel operation

### Tools
- **V**: Select tool
- **H**: Hand/Pan tool
- **Space**: Temporary pan
- **G**: Toggle grid
- **L**: Toggle labels

### Selection
- **Ctrl/Cmd + A**: Select all
- **Ctrl/Cmd + D**: Duplicate
- **Ctrl/Cmd + G**: Group
- **Ctrl/Cmd + Shift + G**: Ungroup

### View
- **Ctrl/Cmd + 0**: Zoom to fit
- **Ctrl/Cmd + 1**: Zoom 100%
- **Ctrl/Cmd + Plus**: Zoom in
- **Ctrl/Cmd + Minus**: Zoom out

### Alignment
- **Alt + L**: Align left
- **Alt + R**: Align right
- **Alt + T**: Align top
- **Alt + B**: Align bottom
- **Alt + C**: Center

## Best Practices

### Drawing Preparation
1. Clean up AutoCAD drawings before import
2. Use consistent naming conventions
3. Organize components by layers
4. Include equipment IDs in text

### Component Organization
1. Use meaningful equipment IDs
2. Group related components
3. Apply consistent styling
4. Document special configurations

### Template Design
1. Make templates generic and reusable
2. Use parameters for all variable values
3. Include documentation
4. Test before saving to library

### Performance Tips
1. Limit components per project (<1000)
2. Use layers to organize complex layouts
3. Hide unnecessary components
4. Export only required formats

## Troubleshooting

### Common Issues

#### OCR Not Detecting Components
- Ensure text is clear and readable
- Check supported component patterns
- Try adjusting image quality
- Use manual classification

#### Canvas Performance
- Reduce visible components
- Disable grid when not needed
- Lower zoom level for overview
- Close other browser tabs

#### Export Problems
- Check file size limits
- Ensure all components have IDs
- Validate tag formats
- Try individual format exports

#### Connection Issues
- Check network connectivity
- Verify server is running
- Clear browser cache
- Try different browser

### Getting Help
1. Check console for errors (F12)
2. Review server logs
3. Consult documentation
4. Contact support with:
   - Browser version
   - Error messages
   - Steps to reproduce
   - Project export (if possible)

### Data Recovery
- Projects auto-save every 5 minutes
- Manual save recommended before major changes
- Export regularly for backup
- Server maintains revision history