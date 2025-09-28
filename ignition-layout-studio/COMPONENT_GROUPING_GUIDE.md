# Component Grouping & Template Generation Guide

## Overview

This guide explains the enhanced component grouping and template generation features in Ignition Layout Studio. These features allow you to efficiently organize components by type and create reusable templates, with a focus on industrial components like straight conveyors.

## Key Features

### 🎯 **Intelligent Component Grouping**
- **Auto-grouping by type**: Automatically groups components of the same type (e.g., all straight conveyors)
- **Manual grouping**: Create custom groups based on your specific needs
- **Spatial analysis**: Identifies patterns and clusters in component placement
- **Type-based organization**: Organizes components by industrial categories

### 🏗️ **Template Generation**
- **Group-to-template conversion**: Generate templates from component groups
- **Parameter optimization**: Automatically identifies common properties for template parameters
- **Multi-format support**: Creates templates for Ignition Perspective, Vision, and SVG formats
- **Reusable assets**: Build a library of standardized components

### 📊 **Advanced Analysis**
- **Pattern detection**: Identifies repetition, alignment, and spatial patterns
- **Performance optimization**: Suggests improvements for better system performance
- **Quality metrics**: Analyzes component distribution and organization

## Getting Started

### Accessing Component Grouping

1. **Open Project Editor**: Navigate to your project in the Ignition Layout Studio
2. **Click "Component Groups"**: Find the button in the top toolbar
3. **Choose your approach**:
   - **Auto-Group**: Let the system automatically group components by type
   - **Manual Group**: Create custom groups based on your criteria
   - **Analyze**: Review grouping suggestions and patterns

### Using Auto-Grouping

```javascript
// API Example: Auto-group components with template generation
const result = await api.autoGroupComponentsByType(projectId, true);
console.log(`Created ${result.groupsCreated} groups and ${result.templatesCreated} templates`);
```

**Steps:**
1. Click **"Auto-Group by Type"** for basic grouping
2. Click **"Auto-Group + Templates"** to also generate templates
3. Review the created groups in the **Groups tab**
4. Customize templates in the **Template Library**

### Manual Grouping

**For Straight Conveyors (Example):**
1. Click **"Manual Group"**
2. Select **"straight_conveyor"** from the component type dropdown
3. Enter a descriptive group name: "Main Line Conveyors"
4. Enable **"Generate Template"** to create a reusable template
5. Click **"Create Group"**

## Component Categories

The system organizes components into these categories:

### 🏭 **Conveyor Systems**
- `straight_conveyor` - Straight belt conveyors
- `belt_conveyor` - Belt conveyor systems
- `roller_conveyor` - Roller conveyor systems
- `chain_conveyor` - Chain conveyor systems
- `accumulation_conveyor` - Accumulation zones
- `spiral_conveyor` - Spiral conveyor systems

### ⚙️ **Equipment**
- `motor` - Drive motors
- `diverter` - Diverter mechanisms
- `merge` - Merge points
- `sorter` - Sorting equipment
- `pusher` - Pusher mechanisms
- `lifter` - Lifting equipment
- `turntable` - Rotating tables

### 🔧 **Sensors & Safety**
- `sensor` - Generic sensors
- `photo_eye` - Photo-eye sensors
- `proximity_sensor` - Proximity sensors
- `emergency_stop` - Emergency stop buttons
- `safety_gate` - Safety gates

### 📦 **Packaging & Robotics**
- `scale` - Weighing systems
- `wrapper` - Wrapping equipment
- `palletizer` - Palletizing systems
- `robot_arm` - Robotic arms
- `agv_station` - AGV stations

## Template Generation Features

### Automatic Parameter Detection

The system analyzes your component groups and automatically creates template parameters:

```json
{
  "name": "straight_conveyor_template",
  "parameters": [
    {
      "name": "equipmentId",
      "type": "string",
      "required": true,
      "description": "Unique equipment identifier"
    },
    {
      "name": "fillColor",
      "type": "color",
      "defaultValue": "#90EE90",
      "description": "Conveyor belt color"
    },
    {
      "name": "runningTag",
      "type": "tag",
      "defaultValue": "",
      "description": "PLC tag for running status"
    },
    {
      "name": "speedTag",
      "type": "tag",
      "defaultValue": "",
      "description": "PLC tag for speed control"
    }
  ]
}
```

### Template Formats

**SVG Template Example:**
```svg
<g class="{{componentClass}} conveyor-component">
  <rect x="0" y="0" width="{{width}}" height="{{height}}" 
        fill="{{fillColor}}" stroke="{{strokeColor}}" stroke-width="{{strokeWidth}}"
        class="conveyor-belt"/>
  <rect x="5" y="5" width="{{width-10}}" height="{{height-10}}" 
        fill="none" stroke="{{strokeColor}}" stroke-width="1" stroke-dasharray="5,5"
        class="conveyor-direction"/>
  <text x="{{width/2}}" y="{{height/2}}" text-anchor="middle" 
        font-size="{{fontSize}}" fill="{{textColor}}">{{label}}</text>
</g>
```

**Ignition Perspective Template:**
```json
{
  "type": "drawing",
  "props": {
    "elements": [
      {
        "type": "rect",
        "rect": { "x": 0, "y": 0, "width": "{{width}}", "height": "{{height}}" },
        "style": {
          "fill": "{{fillColor}}",
          "stroke": "{{strokeColor}}",
          "strokeWidth": "{{strokeWidth}}"
        }
      }
    ]
  },
  "custom": {
    "equipmentId": "{{equipmentId}}",
    "componentType": "straight_conveyor"
  }
}
```

## Advanced Features

### Pattern Detection

The system identifies various patterns in your component layout:

#### **Linear Patterns**
```javascript
// Detects components arranged in straight lines
{
  "type": "linear",
  "direction": "horizontal",
  "components": ["comp1", "comp2", "comp3"],
  "strength": 0.95,
  "suggestion": "Components form a horizontal line - consider creating a linear template"
}
```

#### **Grid Patterns**
```javascript
// Detects components arranged in grids
{
  "type": "grid",
  "rows": 3,
  "cols": 4,
  "components": ["comp1", "comp2", ...],
  "suggestion": "Components form a 3x4 grid - consider creating a grid template"
}
```

#### **Spatial Clusters**
```javascript
// Detects groups of components in close proximity
{
  "components": [/* cluster components */],
  "center": { "x": 250, "y": 150 },
  "size": 5,
  "density": 0.02
}
```

### Performance Optimization

The system provides recommendations for better performance:

1. **High Component Count**: Suggests template usage when you have many similar components
2. **Spatial Distribution**: Recommends grouping for dense areas
3. **Template Efficiency**: Identifies underutilized templates
4. **Consolidation**: Suggests merging nearby similar components

## API Reference

### Component Grouping Endpoints

```javascript
// Analyze components for grouping opportunities
GET /api/components/:projectId/analyze-grouping

// Auto-group components by type
POST /api/components/:projectId/auto-group-by-type
{
  "generateTemplates": true
}

// Group components by specific type
POST /api/components/:projectId/group-by-type
{
  "componentType": "straight_conveyor",
  "groupName": "Main Line Conveyors",
  "generateTemplate": true
}

// Create template from existing group
POST /api/components/:projectId/group/:groupId/create-template
{
  "templateName": "Standard Conveyor",
  "description": "Standard straight conveyor template"
}

// Get component types and counts
GET /api/components/:projectId/types

// Get enhanced group information
GET /api/components/:projectId/groups
```

### Frontend Components

```javascript
// Component Grouping Manager
<ComponentGroupingManager
  projectId={projectId}
  components={components}
  onGroupsUpdate={handleGroupsUpdate}
  onTemplatesUpdate={handleTemplatesUpdate}
  visible={showGroupingManager}
  onClose={() => setShowGroupingManager(false)}
/>

// Template Library
<TemplateLibrary
  projectId={projectId}
  templates={templates}
  onTemplateApply={handleTemplateApply}
  onTemplateUpdate={handleTemplateUpdate}
  visible={showTemplateLibrary}
  onClose={() => setShowTemplateLibrary(false)}
/>
```

## Best Practices

### 1. **Naming Conventions**
- Use descriptive names for groups: "Main Line Conveyors" vs "Group 1"
- Include component counts in group names: "Straight Conveyors (12)"
- Use consistent naming across templates

### 2. **Template Design**
- Include all necessary parameters for flexibility
- Use meaningful default values
- Add comprehensive descriptions for parameters
- Test templates before deploying

### 3. **Organization Strategy**
- Group by functional areas (e.g., "Inbound Conveyors", "Sorting Area")
- Consider maintenance zones in grouping
- Use categories to organize large numbers of components

### 4. **Performance Considerations**
- Create templates for components used 3+ times
- Group components in dense areas
- Remove unnecessary or duplicate components
- Use the analyzer recommendations

## Troubleshooting

### Common Issues

**Issue**: Auto-grouping doesn't find my components
**Solution**: Check that components have consistent type naming (e.g., `straight_conveyor` vs `straightConveyor`)

**Issue**: Template generation fails
**Solution**: Ensure grouped components have at least one common property (size, style, or tags)

**Issue**: Performance is slow with many components
**Solution**: Use the performance analyzer recommendations and consider component consolidation

**Issue**: Templates don't apply correctly
**Solution**: Verify all required parameters are provided and template syntax is correct

### Debug Mode

Enable debug logging to troubleshoot issues:

```javascript
// Backend debug logging
console.log('Component analysis:', analysis);
console.log('Grouping suggestions:', suggestions);

// Frontend debug logging
console.log('Template application:', template, parameters);
```

## Examples

### Example 1: Straight Conveyor Line

**Scenario**: You have 8 straight conveyors in a production line

**Steps**:
1. Select all straight conveyors
2. Use auto-grouping or manual grouping
3. Generate template with parameters:
   - Equipment ID
   - Running status tag
   - Speed control tag
   - Color scheme
4. Apply template to new conveyors

**Result**: Standardized conveyor components with consistent styling and tag bindings

### Example 2: Sorting Area Organization

**Scenario**: Complex sorting area with multiple component types

**Steps**:
1. Use spatial analysis to identify clusters
2. Group components by functional area
3. Create area-specific templates
4. Apply performance optimizations

**Result**: Organized, efficient sorting area with reusable templates

### Example 3: Template Library Management

**Scenario**: Building a company-wide template library

**Steps**:
1. Analyze existing projects for common patterns
2. Create standardized templates for each component type
3. Export templates for sharing
4. Import templates into new projects

**Result**: Consistent, reusable component library across all projects

## Integration with Ignition

### Perspective Integration
Templates generate valid Ignition Perspective JSON that can be imported directly into your Ignition projects.

### Vision Integration
Templates include Vision XML generation for legacy systems.

### Tag Binding
Templates automatically generate proper tag path formats following Ignition conventions:
- `[default]Equipment/AreaName/ComponentName/PropertyName`

### Security Integration
Templates support Ignition security roles and zones for access control.

## Future Enhancements

Planned features for future releases:

1. **AI-Powered Grouping**: Machine learning-based component grouping
2. **Real-time Collaboration**: Multi-user template editing
3. **Version Control**: Template versioning and change tracking
4. **Advanced Analytics**: Performance metrics and usage analytics
5. **Integration APIs**: Direct integration with Ignition Designer

## Support

For questions or issues:
- Check the troubleshooting section above
- Review the API documentation
- Contact the development team
- Submit feature requests through the project repository

---

This component grouping and template generation system significantly improves workflow efficiency for industrial HMI design, especially for repetitive components like straight conveyors. The intelligent analysis and automated template creation reduce manual work while ensuring consistency across your projects. 