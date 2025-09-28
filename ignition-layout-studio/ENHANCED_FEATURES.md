# Enhanced AI Features Integration

This document describes the enhanced AI features integrated from Open WebUI, providing advanced capabilities for component generation, analysis, and OCR processing.

## Overview

The Ignition Layout Studio now includes:

1. **Multi-Provider AI Pipeline System** - Support for OpenAI, Anthropic, Azure, and Google Gemini
2. **Advanced Code Interpreter** - Python-based component analysis and generation
3. **Enhanced OCR Processing** - Advanced filters and AI interpretation of PaddleOCR results
4. **Intelligent Prompt Management** - Industry-specific and contextual prompts
5. **Advanced Filtering System** - Pre/post processing filters for better results

## Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# AI Provider Configuration
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_DEPLOYMENT_NAME=your_deployment_name
GEMINI_API_KEY=your_gemini_api_key_here

# Pipeline Configuration
DEFAULT_PIPELINE=ignition-component
DEFAULT_PROVIDER=openai
PIPELINE_TIMEOUT=30000
MAX_TOKENS=2000

# Code Interpreter Configuration
PYTHON_PATH=python3
SANDBOX_TIMEOUT=30000
MAX_EXECUTIONS=10

# Security
SECRET_KEY=your_secret_key_for_encryption_here

# Industry-Specific Settings
DEFAULT_INDUSTRY=manufacturing
DEFAULT_SAFETY_LEVEL=standard
```

### Python Dependencies

For the code interpreter to work, install these Python packages:

```bash
pip install matplotlib pandas numpy pillow opencv-python scipy scikit-learn plotly seaborn openpyxl xlrd
```

## Features

### 1. Multi-Provider AI Pipeline System

The pipeline system provides intelligent fallback between AI providers:

- **Primary Provider**: OpenAI (GPT-4, GPT-3.5-turbo)
- **Fallback Providers**: Anthropic Claude, Azure OpenAI, Google Gemini
- **Automatic Failover**: If one provider fails, automatically tries the next
- **Provider-Specific Optimization**: Each provider is optimized for different use cases

#### Available Pipelines

1. **ignition-component**: Generate Ignition-compatible HMI components
2. **advanced-analysis**: Analyze and enhance existing components
3. **ocr-enhancement**: Enhance PaddleOCR results with AI interpretation

#### Usage Example

```typescript
// Generate component with pipeline
const result = await api.generateComponentWithPipeline(
  "Create a pump control component",
  "ignition-component",
  {
    industry: "oil-gas",
    safetyLevel: "critical",
    equipment: "centrifugal pump"
  }
);
```

### 2. Advanced Code Interpreter

Python-based analysis and generation system:

- **Component Analysis**: Analyze components for safety, performance, and compliance
- **OCR Processing**: Generate components from OCR results using Python logic
- **Data Visualization**: Create charts and graphs for component analysis
- **Industrial Calculations**: Perform engineering calculations and validations

#### Usage Example

```typescript
// Analyze component with code interpreter
const analysis = await api.analyzeComponentWithCode(component, "safety");

// Generate components from OCR
const components = await api.generateComponentsFromOCR(ocrResults, {
  industry: "manufacturing",
  equipment: "conveyor system"
});
```

### 3. Enhanced OCR Processing

Advanced OCR processing combines PaddleOCR with AI interpretation:

- **PaddleOCR Integration**: High-accuracy text recognition
- **AI Enhancement**: Intelligent interpretation of OCR results
- **Equipment Recognition**: Automatic identification of industrial equipment
- **Component Suggestions**: AI-generated component recommendations

#### Processing Pipeline

1. **PaddleOCR**: Extract text from industrial drawings
2. **Advanced Filters**: Clean and group related text elements
3. **AI Interpretation**: Use pipeline to understand equipment context
4. **Code Analysis**: Generate components using Python logic
5. **Component Generation**: Create Ignition-compatible components

#### Usage Example

```typescript
// Enhanced OCR processing
const result = await api.enhanceOCRAdvanced(ocrResults, {
  drawingType: "P&ID",
  industry: "oil-gas",
  processArea: "separation unit"
});
```

### 4. Intelligent Prompt Management

Industry-specific and contextual prompts for better AI responses:

#### Industry Prompts
- **Oil & Gas**: Upstream, midstream, downstream operations
- **Manufacturing**: Discrete and continuous manufacturing
- **Water Treatment**: Municipal and industrial treatment processes

#### Contextual Prompts
- **Emergency Response**: Safety-critical operations
- **Maintenance Mode**: Maintenance and diagnostic operations
- **Operator Training**: Training and guidance systems

#### Usage Example

```typescript
// Generate with industry context
const result = await api.executePipeline("ignition-component", messages, {
  industry: "oil-gas",
  context: "emergency-response",
  safetyLevel: "critical"
});
```

### 5. Advanced Filtering System

Pre and post-processing filters for enhanced results:

#### Pre-Processing Filters
- **Ignition Validator**: Adds Ignition-specific context
- **Component Enhancer**: Adds safety and performance guidelines
- **Industrial Context**: Adds industry-specific requirements

#### Post-Processing Filters
- **Component Validation**: Validates against Ignition standards
- **OCR Enhancement**: Processes and groups OCR results
- **Safety Analysis**: Analyzes components for safety compliance
- **Performance Optimization**: Optimizes components for performance

## API Endpoints

### Pipeline Endpoints

- `GET /api/pipeline/pipelines` - Get available pipelines
- `GET /api/pipeline/providers` - Get available AI providers
- `POST /api/pipeline/execute` - Execute a pipeline
- `POST /api/pipeline/generate-component` - Generate component with pipeline
- `POST /api/pipeline/analyze-component` - Analyze component with pipeline
- `POST /api/pipeline/enhance-ocr` - Enhance OCR with pipeline
- `GET /api/pipeline/status` - Get pipeline system status

### Code Interpreter Endpoints

- `POST /api/code-interpreter/execute` - Execute Python code
- `POST /api/code-interpreter/analyze-component` - Analyze component with code
- `POST /api/code-interpreter/generate-from-ocr` - Generate components from OCR
- `POST /api/code-interpreter/enhance-ocr-advanced` - Advanced OCR enhancement
- `GET /api/code-interpreter/status` - Get code interpreter status
- `GET /api/code-interpreter/history` - Get execution history

## Frontend Integration

### Settings Panel Updates

The settings panel now includes:

1. **AI Provider Selection**: Choose primary and fallback providers
2. **Pipeline Configuration**: Select default pipelines for different operations
3. **Industry Settings**: Set industry context for better AI responses
4. **Code Interpreter Settings**: Configure Python execution environment
5. **Advanced Options**: Fine-tune AI parameters and filters

### Component Creation Enhancements

- **Enhanced AI Toggle**: Switch between basic AI and advanced pipeline processing
- **Industry Context**: Select industry-specific prompts and requirements
- **Safety Level**: Set safety requirements (standard, high, critical)
- **Analysis Tools**: Built-in component analysis and optimization suggestions

### OCR Processing Improvements

- **Multi-Stage Processing**: PaddleOCR + AI interpretation + code analysis
- **Equipment Recognition**: Automatic identification of industrial equipment
- **Batch Processing**: Process multiple drawings simultaneously
- **Advanced Visualization**: Charts and graphs showing OCR confidence and results

## Troubleshooting

### Common Issues

1. **No AI Providers Available**
   - Check API keys in environment variables
   - Verify provider endpoints are accessible
   - Check pipeline status endpoint

2. **Code Interpreter Fails**
   - Ensure Python 3 is installed and accessible
   - Install required Python packages
   - Check sandbox directory permissions

3. **OCR Enhancement Not Working**
   - Verify PaddleOCR MCP path is correct
   - Check if advanced filters are loaded
   - Ensure AI providers are configured

### Validation

Use the status endpoints to validate configuration:

```typescript
// Check pipeline status
const pipelineStatus = await api.getPipelineStatus();

// Check code interpreter status
const codeStatus = await api.getCodeInterpreterStatus();

// Check AI status
const aiStatus = await api.getAIStatus();
```

## Performance Considerations

1. **Provider Selection**: Choose providers based on your use case
   - OpenAI: General purpose, fast responses
   - Anthropic: Complex analysis, safety-critical applications
   - Azure: Enterprise integration, compliance requirements
   - Gemini: Cost-effective, good for batch processing

2. **Caching**: Enable caching for frequently used prompts and results

3. **Timeout Settings**: Adjust timeouts based on your network and processing requirements

4. **Concurrent Requests**: Limit concurrent requests to avoid rate limiting

## Security

1. **API Key Management**: Store API keys securely in environment variables
2. **Code Execution**: Code interpreter runs in a sandboxed environment
3. **Data Privacy**: No sensitive data is sent to AI providers without explicit consent
4. **Access Control**: Implement proper access controls for AI features

## Future Enhancements

Planned improvements include:

1. **Real-time Collaboration**: Multi-user AI-assisted design sessions
2. **Advanced Visualization**: 3D component previews and simulations
3. **Integration APIs**: Connect with PLCs and SCADA systems
4. **Machine Learning**: Learn from user preferences and improve suggestions
5. **Voice Interface**: Voice commands for component creation and analysis

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the API documentation
3. Check the console logs for detailed error messages
4. Verify your environment configuration

## File Validation System

### Overview

The enhanced file validation system provides comprehensive validation for uploaded files with detailed error messages and format guidance.

### Supported File Formats

#### CAD Files
- **Extensions**: `.dwg`, `.dxf`
- **Max Size**: 200MB
- **Description**: AutoCAD Drawing files for importing layout designs

#### Images (for OCR)
- **Extensions**: `.png`, `.jpg`, `.jpeg`, `.tiff`, `.tif`, `.bmp`, `.webp`, `.svg`
- **Max Size**: 50MB
- **Description**: Images containing HMI layouts for OCR processing and vector graphics

#### PDF Documents
- **Extensions**: `.pdf`
- **Max Size**: 100MB
- **Description**: PDF documents with layout diagrams or specifications

#### Data Files
- **Extensions**: `.xlsx`, `.xls`, `.csv`, `.json`
- **Max Size**: 25MB
- **Description**: Data files containing component specifications or tag lists

#### Document Files
- **Extensions**: `.doc`, `.docx`, `.rtf`, `.txt`
- **Max Size**: 50MB
- **Description**: Document files containing specifications, procedures, or technical documentation

#### Archive Files
- **Extensions**: `.zip`, `.rar`, `.7z`
- **Max Size**: 500MB
- **Description**: Compressed archives containing multiple project files

### Validation Features

#### Client-Side Validation
- Real-time file validation as you select files
- Visual feedback with file categories and status
- Detailed error messages with suggestions
- Support format guidance

#### Server-Side Validation
- File header/magic byte validation
- MIME type verification
- Size limit enforcement per category
- Security checks for dangerous file types

#### Error Handling
- Specific error messages for unsupported formats
- Suggestions for alternative formats
- Common file format mistakes detection
- Comprehensive format documentation

### API Endpoints

#### Get Supported Formats
```http
GET /api/upload/formats
```

Response:
```json
{
  "success": true,
  "supportedFormats": [
    {
      "category": "image",
      "extensions": [".png", ".jpg", ".jpeg"],
      "maxSize": "50 MB",
      "description": "Images containing HMI layouts for OCR processing"
    }
  ]
}
```

#### Validate Files (Preview)
```http
POST /api/upload/validate
Content-Type: multipart/form-data
```

Response:
```json
{
  "success": true,
  "validation": {
    "isValid": false,
    "errors": ["File format .doc is not supported."],
    "results": [
      {
        "fileName": "document.doc",
        "isValid": false,
        "errors": ["Word documents are not supported. Please convert to PDF."],
        "suggestedFormats": ".dwg, .dxf, .pdf, ..."
      }
    ]
  }
}
```

### Usage Examples

#### Frontend Integration
```typescript
import FileValidation from '../components/FileValidation';

const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [isValid, setIsValid] = useState(true);

const handleValidationComplete = (valid: boolean, results: any[]) => {
  setIsValid(valid);
};

<FileValidation
  files={selectedFiles}
  onValidationComplete={handleValidationComplete}
  showPreview={true}
/>
```

#### Backend Validation
```javascript
const fileValidationService = require('./services/fileValidationService');

const validation = fileValidationService.validateFile(file);
if (!validation.isValid) {
  return res.status(400).json({
    error: 'File validation failed',
    errors: validation.errors,
    supportedFormats: fileValidationService.getSupportedFormatsDetails()
  });
}
```

### Error Messages Examples

- **Unsupported Format**: "File format .ppt is not supported. Please export as PDF or images."
- **File Too Large**: "File size (75.5 MB) exceeds maximum allowed size for image files (50 MB)."
- **Security Warning**: "Executable files (.exe) are not allowed for security reasons."
- **MIME Type Mismatch**: "File MIME type doesn't match expected types. This might indicate a renamed file."

### Troubleshooting File Issues

1. **Unsupported Format**: Check the supported formats list and convert files if needed
2. **File Too Large**: Compress files or split large archives
3. **MIME Type Warnings**: Verify file integrity and rename if necessary
4. **Upload Failures**: Check network connection and server logs

### Common Solutions

- **PowerPoint Files**: Export slides as PDF or individual images
- **Large Files**: Use compression tools or split into smaller files  
- **Video Files**: Extract still frames as images for OCR processing
- **Unsupported Formats**: Check the supported formats list for alternatives

The enhanced AI features and comprehensive file validation system significantly improve the capability and intelligence of the Ignition Layout Studio, making it a powerful and user-friendly tool for industrial HMI design and automation. 