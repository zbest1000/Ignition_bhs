# Conveyor System Specialization for BHS

## Core Focus: CONVEYORS
**The tool should excel at one thing: Converting conveyor drawings into Ignition components FAST**

## 🎯 Conveyor-Specific Enhancements

### 1. **Complete Conveyor Type Library**
```typescript
// Every type of BHS conveyor
conveyorTypes = {
  // Straight Conveyors
  'straight': { default_length: 3000, default_width: 600 },
  'incline': { default_angle: 15, max_angle: 30 },
  'decline': { default_angle: -15, max_angle: -30 },
  
  // Curved Conveyors
  'curve_45': { radius: 1000, angle: 45 },
  'curve_90': { radius: 1000, angle: 90 },
  'curve_180': { radius: 1000, angle: 180 },
  
  // Special Conveyors
  'merge': { angles: [30, 45], type: 'Y-merge' },
  'diverter': { angles: [30, 45], type: 'high-speed' },
  'transfer': { type: 'cross-belt' },
  'accumulation': { zones: 4, sensor_per_zone: true },
  'spiral': { turns: 3, direction: 'up' | 'down' },
  'telescopic': { extended_length: 5000, retracted: 2000 },
  
  // Sortation Conveyors
  'tilt_tray': { tray_count: 100, tray_pitch: 600 },
  'cross_belt': { carrier_count: 50, carrier_pitch: 800 },
  'pusher': { pusher_spacing: 2000, pusher_type: 'paddle' },
  'pop_up_wheel': { wheel_sections: 10 },
  'shoe_sorter': { shoe_pitch: 400 },
  
  // Specialized BHS
  'makeup_belt': { positions: 12, type: 'lateral' },
  'claim_carousel': { type: 'flat_plate', sections: 20 },
  'injection_belt': { angle: 30, merge_type: 'smooth' },
  'collector_belt': { width: 1200, heavy_duty: true },
  'recirc_line': { loop: true, bypass_points: 3 }
}
```

### 2. **Conveyor Connection Intelligence**
```typescript
// Auto-detect and maintain conveyor connections
interface ConveyorConnection {
  from: ConveyorID;
  to: ConveyorID;
  connectionType: 'direct' | 'merge' | 'divert' | 'transfer';
  angle: number;
  flowDirection: 'forward' | 'reverse' | 'bidirectional';
  priority: 'main' | 'secondary';
}

// Automatic connection detection
detectConnections(conveyors: Conveyor[]) {
  // Find touching endpoints
  // Detect merge/divert points
  // Identify flow direction
  // Create connection map
}
```

### 3. **Conveyor Flow Visualization**
```typescript
// Show material flow direction
flowVisualization: {
  arrows: 'animated' | 'static',
  flowSpeed: 'slow' | 'medium' | 'fast',
  flowColor: '#00ff00',
  blockages: 'highlight_red',
  mergePoints: 'show_priority'
}
```

### 4. **Smart Conveyor OCR**
```typescript
// Recognize all conveyor nomenclature
patterns: [
  /CV[_-]?\d{3,4}/,      // CV-001, CV_1234
  /CONV[_-]?\d{3,4}/,    // CONV-001
  /BC[_-]?\d{3,4}/,      // BC-001 (Belt Conveyor)
  /RC[_-]?\d{3,4}/,      // RC-001 (Roller Conveyor)
  /ACC[_-]?\d{3,4}/,     // ACC-001 (Accumulation)
  /DIV[_-]?\d{3,4}/,     // DIV-001 (Diverter)
  /MRG[_-]?\d{3,4}/,     // MRG-001 (Merge)
  /SORT[_-]?\d{3,4}/,    // SORT-001 (Sorter)
  /SPIRAL[_-]?\d{2}/,    // SPIRAL-01
  /CURVE[_-]?\d{3}/,     // CURVE-090 (90 degree)
  /XFER[_-]?\d{3}/,      // XFER-001 (Transfer)
  
  // Zone identifiers
  /Z\d{1,2}[_-]CV[_-]?\d{3}/, // Z1-CV-001 (Zone 1)
  /T\d[_-]CV[_-]?\d{3}/,      // T1-CV-001 (Terminal 1)
  /L\d[_-]CV[_-]?\d{3}/,      // L2-CV-001 (Level 2)
]
```

### 5. **Rapid Conveyor Placement Tools**
```typescript
// Speed-focused conveyor tools
tools: {
  // Click-and-drag conveyor drawing
  'conveyor_pen': {
    autoConnect: true,
    snapAngle: [0, 15, 30, 45, 60, 90],
    defaultWidth: 600,
    defaultSpeed: 0.5 // m/s
  },
  
  // Multi-segment conveyor
  'conveyor_path': {
    points: Point[],
    autoGenerateCurves: true,
    optimizePath: true
  },
  
  // Pattern generation
  'conveyor_array': {
    count: number,
    spacing: number,
    pattern: 'linear' | 'radial' | 'grid'
  },
  
  // Quick duplicate
  'conveyor_clone': {
    offset: { x: 0, y: 1000 },
    maintainConnections: false,
    autoNumber: true
  }
}
```

### 6. **Conveyor Property Templates**
```typescript
// Pre-configured conveyor settings
templates: {
  'high_speed': {
    speed: 2.5, // m/s
    width: 600,
    type: 'belt',
    color: '#0066cc'
  },
  'accumulation': {
    speed: 0.5,
    width: 800,
    zones: 4,
    type: 'roller',
    color: '#009900'
  },
  'sortation': {
    speed: 2.0,
    width: 1000,
    type: 'cross_belt',
    color: '#cc6600'
  },
  'makeup': {
    speed: 0.3,
    width: 800,
    type: 'belt',
    indexing: true,
    color: '#6600cc'
  }
}
```

### 7. **Conveyor Numbering System**
```typescript
// Intelligent auto-numbering
autoNumber: {
  format: '{terminal}-{zone}-{type}-{sequence}',
  examples: [
    'T1-ARR-CV-001',  // Terminal 1, Arrivals, Conveyor 001
    'T2-DEP-DIV-005', // Terminal 2, Departures, Diverter 005
    'T1-SORT-CB-010', // Terminal 1, Sortation, Cross-belt 010
    'T3-MU-CV-001',   // Terminal 3, Makeup, Conveyor 001
  ],
  
  rules: {
    sequentialNumbering: true,
    gapFilling: true,  // Fill in missing numbers
    zonePrefix: true,
    padZeros: 3
  }
}
```

### 8. **Conveyor Length Calculation**
```typescript
// Accurate length measurements
lengthCalculation: {
  straight: (p1, p2) => distance(p1, p2),
  curved: (radius, angle) => (angle * Math.PI * radius) / 180,
  spiral: (radius, pitch, turns) => Math.sqrt((2*PI*radius*turns)² + (pitch*turns)²),
  
  // Total system length
  totalLength: () => conveyors.reduce((sum, c) => sum + c.length, 0),
  
  // Length report
  report: {
    byType: Map<ConveyorType, number>,
    byZone: Map<Zone, number>,
    total: number
  }
}
```

### 9. **Conveyor-Specific Validation**
```typescript
validation: {
  // Check for disconnected conveyors
  checkConnections: () => findDisconnected(),
  
  // Verify flow directions
  validateFlow: () => detectFlowConflicts(),
  
  // Check angles
  validateAngles: () => findInvalidAngles(),
  
  // Verify numbering
  checkNumbering: () => findDuplicates(),
  
  // Speed transitions
  checkSpeedTransitions: () => findAbruptSpeedChanges(),
  
  // Width transitions
  checkWidthTransitions: () => findWidthMismatches()
}
```

### 10. **Quick Conveyor Fixes**
```typescript
quickFixes: {
  // Auto-connect nearby endpoints
  'autoConnect': {
    maxGap: 100, // mm
    autoInsertTransition: true
  },
  
  // Fix flow direction
  'fixFlow': {
    detectMainFlow: true,
    reverseIncorrect: true
  },
  
  // Align conveyors
  'snapToGrid': {
    gridSize: 100,
    maintainConnections: true
  },
  
  // Standardize properties
  'standardize': {
    width: 600,
    speed: 0.5,
    height: 1000
  }
}
```

## 🚀 Conveyor Workflow Optimization

### Super-Fast Conveyor Entry
1. **Draw mode**: Click-drag to create conveyor paths
2. **Auto-connect**: Automatically connects to nearby conveyors
3. **Smart curves**: Auto-insert curves at direction changes
4. **Instant numbering**: Sequential numbering as you draw
5. **Quick properties**: Single-key property changes (S=speed, W=width)

### Keyboard Shortcuts (Conveyor-Specific)
```
C: Conveyor draw mode
S: Straight conveyor
R: Curved conveyor (right)
L: Curved conveyor (left)
D: Diverter
M: Merge
A: Select all conveyors
1-9: Preset conveyor types
Arrow keys: Extend selected conveyor
Shift+Arrow: Adjust conveyor angle
Ctrl+Arrow: Move conveyor
Alt+Arrow: Adjust conveyor width
```

## 📊 Conveyor Metrics

### Performance Goals
| Task | Current | Target | 
|------|---------|--------|
| Place straight conveyor | 10 clicks | 2 clicks |
| Create curved section | 15 clicks | 3 clicks |
| Connect two conveyors | Manual | Automatic |
| Number 100 conveyors | 10 min | 10 seconds |
| Set flow direction | Each one | All at once |

### Accuracy Targets
- **95%** conveyor detection from drawings
- **100%** connection preservation
- **Zero** disconnected conveyors after import
- **Automatic** flow direction detection

## 🎨 Visual Enhancements

### Conveyor Appearance
```typescript
visualization: {
  // Belt texture
  beltPattern: 'chevron' | 'solid' | 'ribbed',
  
  // Roller representation
  rollerSpacing: 100, // mm
  rollerDiameter: 50,
  
  // Side rails
  railHeight: 200,
  railColor: '#808080',
  
  // Motor positions
  showMotors: true,
  motorSymbol: 'M',
  
  // Emergency stops
  showEStops: true,
  eStopSpacing: 10000 // mm
}
```

## 🔧 Ignition Export (Conveyor-Optimized)

### Conveyor-Specific Bindings
```python
# Ignition tag structure for conveyors
tags = {
  'CV_001': {
    'running': 'Boolean',
    'speed': 'Float4',
    'load': 'Float4',
    'fault': 'Boolean',
    'mode': 'Integer',  # 0=Off, 1=Manual, 2=Auto
    'direction': 'Integer',  # 0=Forward, 1=Reverse
    'accumulated': 'Boolean',
    'photoeye': 'Boolean'
  }
}
```

### Conveyor Templates
```json
{
  "BHS_Conveyor": {
    "parameters": [
      "tagPath",
      "length",
      "width",
      "speed"
    ],
    "components": {
      "belt": "animated based on speed",
      "motor": "color based on running",
      "sides": "static graphics"
    }
  }
}
```

## 📋 Implementation Priority

### Phase 1: Core Conveyor Tools (Week 1)
- ✅ Complete conveyor type library
- ✅ Click-and-drag drawing
- ✅ Auto-connection
- ✅ Smart numbering

### Phase 2: Intelligence (Week 2)
- ✅ Flow detection
- ✅ Connection validation
- ✅ Quick fixes
- ✅ Length calculation

### Phase 3: Polish (Week 3)
- ✅ Visual enhancements
- ✅ Keyboard shortcuts
- ✅ Templates
- ✅ Optimized export

## Conclusion

By focusing specifically on **conveyors**, the tool becomes the fastest way to convert BHS conveyor drawings into Ignition screens. Every feature is optimized for conveyor systems, making it possible to convert a complete baggage handling system in minutes instead of hours.
