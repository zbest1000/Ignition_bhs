const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CodeInterpreterService {
  constructor() {
    this.activeExecutions = new Map();
    this.executionHistory = [];
    this.sandboxDir = path.join(__dirname, '../../sandbox');
    this.initializeSandbox();
  }

  async initializeSandbox() {
    try {
      await fs.mkdir(this.sandboxDir, { recursive: true });

      // Create requirements.txt for Python dependencies
      const requirements = `
matplotlib>=3.5.0
pandas>=1.3.0
numpy>=1.21.0
pillow>=8.3.0
opencv-python>=4.5.0
scipy>=1.7.0
scikit-learn>=1.0.0
plotly>=5.0.0
seaborn>=0.11.0
openpyxl>=3.0.0
xlrd>=2.0.0
            `.trim();

      await fs.writeFile(path.join(this.sandboxDir, 'requirements.txt'), requirements);

      // Create a basic Python environment setup script
      const setupScript = `
import sys
import os
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
from PIL import Image
import json
import base64
from io import BytesIO

# Set up paths
sys.path.append('/app/sandbox')
os.chdir('/app/sandbox')

# Helper functions for Ignition component generation
def create_ignition_component(component_type, properties=None):
    """Create a basic Ignition component structure"""
    if properties is None:
        properties = {}
    
    component = {
        'type': f'perspective.{component_type}',
        'position': properties.get('position', {'x': 0, 'y': 0}),
        'size': properties.get('size', {'width': 100, 'height': 50}),
        'props': properties.get('props', {}),
        'meta': {
            'name': properties.get('name', f'{component_type}_component'),
            'generated': True,
            'timestamp': pd.Timestamp.now().isoformat()
        }
    }
    
    return component

def save_plot_as_base64():
    """Save current matplotlib plot as base64 string"""
    buffer = BytesIO()
    plt.savefig(buffer, format='png', dpi=150, bbox_inches='tight')
    buffer.seek(0)
    image_base64 = base64.b64encode(buffer.read()).decode('utf-8')
    buffer.close()
    plt.close()
    return f'data:image/png;base64,{image_base64}'

def analyze_industrial_data(data):
    """Analyze industrial data and suggest components"""
    if isinstance(data, dict):
        data = pd.DataFrame([data])
    elif isinstance(data, list):
        data = pd.DataFrame(data)
    
    analysis = {
        'summary': data.describe().to_dict() if hasattr(data, 'describe') else {},
        'suggestions': [],
        'components': []
    }
    
    # Basic analysis logic
    numeric_cols = data.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        if 'temp' in col.lower():
            analysis['suggestions'].append(f'Temperature monitoring component for {col}')
            analysis['components'].append(create_ignition_component('display', {
                'name': f'{col}_display',
                'props': {
                    'text': f'{{[default]Equipment/{col}/value}}',
                    'style': {'color': 'blue'}
                }
            }))
        elif 'pressure' in col.lower():
            analysis['suggestions'].append(f'Pressure gauge component for {col}')
            analysis['components'].append(create_ignition_component('gauge', {
                'name': f'{col}_gauge',
                'props': {
                    'value': f'{{[default]Equipment/{col}/value}}',
                    'min': 0,
                    'max': 100
                }
            }))
    
    return analysis

print("Code interpreter environment initialized successfully")
            `.trim();

      await fs.writeFile(path.join(this.sandboxDir, 'setup.py'), setupScript);

      console.log('Code interpreter sandbox initialized');
    } catch (error) {
      console.error('Error initializing sandbox:', error);
    }
  }

  async executeCode(code, context = {}) {
    const executionId = uuidv4();
    const startTime = Date.now();

    try {
      // Prepare code with context
      const preparedCode = this.prepareCodeWithContext(code, context);

      // Create temporary file for execution
      const tempFile = path.join(this.sandboxDir, `execution_${executionId}.py`);
      await fs.writeFile(tempFile, preparedCode);

      // Execute Python code
      const result = await this.executePython(tempFile, executionId);

      // Clean up temporary file
      await fs.unlink(tempFile).catch(() => {}); // Ignore errors

      const executionTime = Date.now() - startTime;

      // Store execution in history
      this.executionHistory.push({
        id: executionId,
        code: code,
        context: context,
        result: result,
        executionTime: executionTime,
        timestamp: new Date().toISOString()
      });

      // Keep only last 100 executions
      if (this.executionHistory.length > 100) {
        this.executionHistory = this.executionHistory.slice(-100);
      }

      return {
        success: true,
        executionId,
        result,
        executionTime
      };
    } catch (error) {
      console.error('Code execution error:', error);
      return {
        success: false,
        executionId,
        error: error.message,
        executionTime: Date.now() - startTime
      };
    }
  }

  prepareCodeWithContext(code, context) {
    let preparedCode = `
# Import setup
exec(open('/app/sandbox/setup.py').read())

# Context variables
context = ${JSON.stringify(context)}
`;

    // Add context-specific data
    if (context.ocrResults) {
      preparedCode += `
# OCR Results
ocr_results = ${JSON.stringify(context.ocrResults)}
`;
    }

    if (context.fileData) {
      preparedCode += `
# File Data
file_data = ${JSON.stringify(context.fileData)}
`;
    }

    if (context.components) {
      preparedCode += `
# Existing Components
existing_components = ${JSON.stringify(context.components)}
`;
    }

    // Add the user's code
    preparedCode += `
# User Code
${code}

# Capture any plots
try:
    if plt.get_fignums():
        plot_data = save_plot_as_base64()
        print(f"PLOT_DATA:{plot_data}")
except Exception as e:
    print(f"Plot capture error: {e}")
`;

    return preparedCode;
  }

  async executePython(scriptPath, executionId) {
    return new Promise((resolve, reject) => {
      const python = spawn('python3', [scriptPath], {
        cwd: this.sandboxDir,
        timeout: 30000, // 30 second timeout
        env: {
          ...process.env,
          PYTHONPATH: this.sandboxDir,
          MPLBACKEND: 'Agg'
        }
      });

      let stdout = '';
      let stderr = '';
      let plots = [];

      python.stdout.on('data', data => {
        const output = data.toString();
        stdout += output;

        // Extract plot data
        const plotMatches = output.match(/PLOT_DATA:(data:image\/png;base64,[A-Za-z0-9+/=]+)/g);
        if (plotMatches) {
          plotMatches.forEach(match => {
            const plotData = match.replace('PLOT_DATA:', '');
            plots.push(plotData);
          });
        }
      });

      python.stderr.on('data', data => {
        stderr += data.toString();
      });

      python.on('close', code => {
        this.activeExecutions.delete(executionId);

        if (code === 0) {
          // Parse output for structured data
          const result = this.parseExecutionOutput(stdout, stderr, plots);
          resolve(result);
        } else {
          reject(new Error(`Python execution failed with code ${code}: ${stderr}`));
        }
      });

      python.on('error', error => {
        this.activeExecutions.delete(executionId);
        reject(error);
      });

      // Track active execution
      this.activeExecutions.set(executionId, {
        process: python,
        startTime: Date.now()
      });
    });
  }

  parseExecutionOutput(stdout, stderr, plots) {
    const result = {
      output: stdout,
      error: stderr,
      plots: plots,
      components: [],
      analysis: null
    };

    try {
      // Try to extract JSON output
      const jsonMatches = stdout.match(/\{[\s\S]*\}/g);
      if (jsonMatches) {
        jsonMatches.forEach(match => {
          try {
            const parsed = JSON.parse(match);
            if (parsed.type && parsed.type.includes('perspective')) {
              result.components.push(parsed);
            } else if (parsed.summary || parsed.suggestions) {
              result.analysis = parsed;
            }
          } catch (e) {
            // Ignore invalid JSON
          }
        });
      }

      // Extract component suggestions from text
      const componentSuggestions = stdout.match(/COMPONENT_SUGGESTION:(.+)/g);
      if (componentSuggestions) {
        result.suggestions = componentSuggestions.map(s =>
          s.replace('COMPONENT_SUGGESTION:', '').trim()
        );
      }
    } catch (error) {
      console.error('Error parsing execution output:', error);
    }

    return result;
  }

  async analyzeComponentWithCode(component, analysisType = 'general') {
    const analysisCode = `
# Component Analysis
component = ${JSON.stringify(component)}
analysis_type = "${analysisType}"

print(f"Analyzing component: {component.get('meta', {}).get('name', 'Unknown')}")
print(f"Analysis type: {analysis_type}")

# Basic component analysis
analysis = {
    'component_type': component.get('type', 'unknown'),
    'properties': len(component.get('props', {})),
    'position': component.get('position', {}),
    'size': component.get('size', {}),
    'suggestions': [],
    'improvements': []
}

# Type-specific analysis
if 'display' in component.get('type', ''):
    analysis['suggestions'].append('Consider adding trend display for historical data')
    analysis['improvements'].append('Add alarm indicators for critical values')
elif 'gauge' in component.get('type', ''):
    analysis['suggestions'].append('Add setpoint indicators')
    analysis['improvements'].append('Consider logarithmic scale for wide ranges')
elif 'button' in component.get('type', ''):
    analysis['suggestions'].append('Add confirmation dialog for critical actions')
    analysis['improvements'].append('Include status feedback after action')

# Safety analysis
if analysis_type == 'safety':
    analysis['safety_considerations'] = [
        'Ensure proper alarm acknowledgment',
        'Add emergency stop functionality',
        'Implement user permission checks',
        'Consider fail-safe states'
    ]

# Performance analysis
if analysis_type == 'performance':
    analysis['performance_tips'] = [
        'Optimize tag binding frequency',
        'Consider data compression for trends',
        'Implement client-side caching',
        'Use appropriate data types'
    ]

print(json.dumps(analysis, indent=2))
`;

    return await this.executeCode(analysisCode, { component });
  }

  async generateComponentFromOCR(ocrResults, imageContext = {}) {
    const generationCode = `
# OCR-based Component Generation
ocr_data = ocr_results
image_context = ${JSON.stringify(imageContext)}

print("Processing OCR results for component generation...")

# Analyze OCR text for industrial equipment
equipment_keywords = {
    'pump': ['pump', 'motor', 'flow'],
    'valve': ['valve', 'control', 'actuator'],
    'tank': ['tank', 'vessel', 'storage'],
    'sensor': ['sensor', 'transmitter', 'indicator'],
    'gauge': ['gauge', 'meter', 'pressure', 'temperature']
}

detected_equipment = []
generated_components = []

# Process OCR results
for item in ocr_data:
    text = item.get('text', '').lower()
    confidence = item.get('confidence', 0)
    
    if confidence > 0.7:  # Only process high-confidence results
        for equipment_type, keywords in equipment_keywords.items():
            if any(keyword in text for keyword in keywords):
                detected_equipment.append({
                    'type': equipment_type,
                    'text': text,
                    'confidence': confidence,
                    'position': item.get('position', {})
                })

# Generate components based on detected equipment
for equipment in detected_equipment:
    if equipment['type'] == 'pump':
        component = create_ignition_component('motor', {
            'name': f"pump_{len(generated_components)}",
            'props': {
                'status': '{[default]Equipment/Pump/Status}',
                'speed': '{[default]Equipment/Pump/Speed}',
                'style': {'color': 'green'}
            }
        })
        generated_components.append(component)
    
    elif equipment['type'] == 'valve':
        component = create_ignition_component('valve', {
            'name': f"valve_{len(generated_components)}",
            'props': {
                'position': '{[default]Equipment/Valve/Position}',
                'command': '{[default]Equipment/Valve/Command}',
                'style': {'color': 'blue'}
            }
        })
        generated_components.append(component)
    
    elif equipment['type'] == 'tank':
        component = create_ignition_component('tank', {
            'name': f"tank_{len(generated_components)}",
            'props': {
                'level': '{[default]Equipment/Tank/Level}',
                'capacity': '{[default]Equipment/Tank/Capacity}',
                'style': {'color': 'gray'}
            }
        })
        generated_components.append(component)

# Generate summary
summary = {
    'detected_equipment': detected_equipment,
    'generated_components': generated_components,
    'total_components': len(generated_components),
    'confidence_average': sum(eq['confidence'] for eq in detected_equipment) / len(detected_equipment) if detected_equipment else 0
}

print(json.dumps(summary, indent=2))
`;

    return await this.executeCode(generationCode, { ocrResults, imageContext });
  }

  async processFileData(fileData, analysisType = 'general') {
    const processingCode = `
# File Data Processing
import pandas as pd
import numpy as np

# Load data
if isinstance(file_data, str):
    # Assume it's a file path
    if file_data.endswith('.csv'):
        df = pd.read_csv(file_data)
    elif file_data.endswith('.xlsx'):
        df = pd.read_excel(file_data)
    else:
        print("Unsupported file format")
        df = pd.DataFrame()
else:
    # Assume it's already processed data
    df = pd.DataFrame(file_data)

if not df.empty:
    print(f"Processing {len(df)} rows of data")
    
    # Basic analysis
    analysis = analyze_industrial_data(df)
    
    # Generate visualizations
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    if len(numeric_cols) > 0:
        # Create trend plot
        plt.figure(figsize=(12, 6))
        for col in numeric_cols[:5]:  # Limit to first 5 columns
            plt.plot(df.index, df[col], label=col)
        plt.legend()
        plt.title('Industrial Data Trends')
        plt.xlabel('Time/Index')
        plt.ylabel('Values')
        plt.grid(True)
        
        # Save plot
        plot_data = save_plot_as_base64()
        analysis['trend_plot'] = plot_data
    
    print(json.dumps(analysis, indent=2))
else:
    print("No data to process")
`;

    return await this.executeCode(processingCode, { fileData });
  }

  async terminateExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.process.kill('SIGTERM');
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  getExecutionHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  getActiveExecutions() {
    return Array.from(this.activeExecutions.keys());
  }

  async cleanupSandbox() {
    try {
      const files = await fs.readdir(this.sandboxDir);
      const tempFiles = files.filter(file => file.startsWith('execution_'));

      for (const file of tempFiles) {
        await fs.unlink(path.join(this.sandboxDir, file)).catch(() => {});
      }

      console.log(`Cleaned up ${tempFiles.length} temporary files`);
    } catch (error) {
      console.error('Error cleaning sandbox:', error);
    }
  }
}

module.exports = new CodeInterpreterService();
