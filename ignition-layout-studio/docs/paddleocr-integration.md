# PaddleOCR MCP Integration Guide

This guide explains how to integrate PaddleOCR with Ignition Layout Studio using the Model Context Protocol (MCP).

## Overview

Ignition Layout Studio supports PaddleOCR integration for extracting text and component information from engineering drawings. The integration is designed to work with PaddleOCR through the MCP interface.

## Configuration

### Environment Variables

Add the following to your `.env` file in the backend directory:

```env
# Path to PaddleOCR MCP executable
PADDLE_OCR_MCP_PATH=/path/to/paddleocr-mcp

# Optional: PaddleOCR model path
PADDLE_OCR_MODEL_PATH=/path/to/paddleocr/models
```

### Fallback Mode

If `PADDLE_OCR_MCP_PATH` is not set, the system will automatically use a mock OCR service for testing purposes.

## MCP Interface

The OCR service expects the PaddleOCR MCP to accept the following command format:

```bash
paddleocr-mcp ocr --image <image_path> --output-format json
```

### Expected Output Format

The MCP should return JSON in the following format:

```json
{
  "results": [
    {
      "text": "CONV_01",
      "confidence": 0.95,
      "bbox": [100, 200, 180, 230]
    },
    {
      "text": "Motor M1",
      "confidence": 0.92,
      "bbox": [300, 150, 370, 175]
    }
  ]
}
```

### Bounding Box Formats

The service supports two bbox formats:
- 4-point: `[x1, y1, x2, y2]` (top-left and bottom-right corners)
- 8-point: `[x1, y1, x2, y2, x3, y3, x4, y4]` (all four corners)

## Component Detection

The OCR service automatically detects the following component types from text:

| Pattern | Component Type | Category |
|---------|---------------|----------|
| CONV_XX, CV_XX | Straight Conveyor | conveyor |
| MOTOR_XX, MXX | Motor | equipment |
| EDS_XX | EDS Machine | equipment |
| DIVERTER_XX, DXX | Diverter | equipment |
| MERGE_XX | Merge | equipment |
| CURVE_XX | 90° Curve | conveyor |

## Usage

### Processing Single Images

```javascript
const ocrService = require('./services/ocrService');

const result = await ocrService.processImage('/path/to/image.png');
// Returns: { texts: [...], components: [...] }
```

### Processing via API

```bash
POST /api/ocr/process/:projectId/:fileId
Content-Type: application/json

{
  "options": {
    "language": "en",
    "detectRotation": true
  }
}
```

## Error Handling

The service includes automatic fallback to mock OCR if:
- PaddleOCR MCP is not configured
- MCP process fails to start
- Invalid output format is returned

## Performance Considerations

- Large images are automatically resized if needed
- Batch processing is available for multiple files
- Results are cached per project

## Troubleshooting

### Common Issues

1. **MCP not found**: Ensure `PADDLE_OCR_MCP_PATH` points to the correct executable
2. **Permission denied**: Make sure the MCP executable has execute permissions
3. **Invalid output**: Check that your MCP returns the expected JSON format

### Debug Mode

Enable debug logging by setting:
```env
DEBUG=ocr:*
```

## Future Enhancements

- Support for PDF page extraction
- DWG/DXF to image conversion
- Multi-language OCR support
- Custom component pattern configuration