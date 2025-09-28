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