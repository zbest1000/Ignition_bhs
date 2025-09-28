import React, { useState } from 'react';
import { Card, Button, Upload, Table, Tag, Progress, Statistic, Row, Col, Alert } from 'antd';
import { UploadOutlined, ScanOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { nativeOCRService } from '../services/nativeOCRService';

interface TestResult {
  text: string;
  expected: string;
  detected: boolean;
  confidence: number;
  accuracy: number;
}

interface OCRTestMetrics {
  totalTests: number;
  successfulDetections: number;
  averageConfidence: number;
  averageAccuracy: number;
  processingTime: number;
}

const OCRAccuracyTest: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [metrics, setMetrics] = useState<OCRTestMetrics | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  // Test patterns that should be detected
  const expectedComponents = [
    { pattern: 'CONV_01', type: 'Conveyor' },
    { pattern: 'MOTOR_M1', type: 'Motor' },
    { pattern: 'PUMP_P1', type: 'Pump' },
    { pattern: 'VALVE_V1', type: 'Valve' },
    { pattern: 'TANK_T1', type: 'Tank' },
    { pattern: 'SENSOR_S1', type: 'Sensor' },
    { pattern: 'PIPE_01', type: 'Pipe' },
    { pattern: 'HMI_01', type: 'HMI Panel' },
  ];

  const generateTestImage = (): string => {
    // Create a canvas with test text
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return '';

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add test components text
    ctx.fillStyle = 'black';
    ctx.font = 'bold 20px Arial';
    
    // Draw component labels
    const components = [
      { text: 'CONV_01', x: 100, y: 100 },
      { text: 'MOTOR_M1', x: 300, y: 100 },
      { text: 'PUMP_P1', x: 500, y: 100 },
      { text: 'VALVE_V1', x: 100, y: 200 },
      { text: 'TANK_T1', x: 300, y: 200 },
      { text: 'SENSOR_S1', x: 500, y: 200 },
      { text: 'PIPE_01', x: 100, y: 300 },
      { text: 'HMI_01', x: 300, y: 300 },
      { text: 'Flow: 100 GPM', x: 100, y: 400 },
      { text: 'Pressure: 50 PSI', x: 300, y: 400 },
      { text: 'Temperature: 75°F', x: 500, y: 400 },
    ];

    components.forEach(comp => {
      ctx.fillText(comp.text, comp.x, comp.y);
    });

    // Add some lines to simulate a drawing
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 2;
    
    // Draw some connecting lines
    ctx.beginPath();
    ctx.moveTo(180, 95);
    ctx.lineTo(280, 95);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(380, 95);
    ctx.lineTo(480, 95);
    ctx.stroke();

    return canvas.toDataURL('image/png');
  };

  const runAccuracyTest = async () => {
    setTesting(true);
    setResults([]);
    
    try {
      // Generate or use uploaded image
      const testImageUrl = imageUrl || generateTestImage();
      
      if (!imageUrl) {
        setImageUrl(testImageUrl);
      }

      const startTime = Date.now();
      
      // Process with OCR
      const ocrResult = await nativeOCRService.processImage(testImageUrl, {
        preprocessImage: true,
        detectComponents: true,
        jobId: 'accuracy-test'
      });

      const processingTime = Date.now() - startTime;
      
      // Extract all detected text
      const detectedText = ocrResult.textBlocks.map(block => block.text).join(' ');
      const detectedComponents = (ocrResult as any).components || [];
      
      // Check each expected component
      const testResults: TestResult[] = expectedComponents.map(expected => {
        const detected = detectedText.includes(expected.pattern) || 
                         detectedComponents.some((c: any) => c.name?.includes(expected.pattern));
        
        // Find confidence for this text
        const textBlock = ocrResult.textBlocks.find(block => 
          block.text.includes(expected.pattern)
        );
        
        const confidence = textBlock ? textBlock.confidence : 0;
        
        // Calculate character-level accuracy
        let accuracy = 0;
        if (detected && textBlock) {
          const detectedPattern = textBlock.text.match(/[A-Z]+_?\d+/)?.[0] || '';
          accuracy = calculateStringAccuracy(expected.pattern, detectedPattern);
        }
        
        return {
          text: expected.pattern,
          expected: expected.type,
          detected,
          confidence: confidence * 100,
          accuracy
        };
      });

      // Calculate metrics
      const successfulDetections = testResults.filter(r => r.detected).length;
      const avgConfidence = testResults.reduce((sum, r) => sum + r.confidence, 0) / testResults.length;
      const avgAccuracy = testResults.reduce((sum, r) => sum + r.accuracy, 0) / testResults.length;

      setResults(testResults);
      setMetrics({
        totalTests: testResults.length,
        successfulDetections,
        averageConfidence: avgConfidence,
        averageAccuracy: avgAccuracy,
        processingTime
      });

    } catch (error) {
      console.error('OCR test failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const calculateStringAccuracy = (expected: string, detected: string): number => {
    if (expected === detected) return 100;
    if (!detected) return 0;
    
    // Calculate Levenshtein distance
    const matrix: number[][] = [];
    
    for (let i = 0; i <= detected.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= expected.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= detected.length; i++) {
      for (let j = 1; j <= expected.length; j++) {
        if (detected[i - 1] === expected[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[detected.length][expected.length];
    const maxLength = Math.max(expected.length, detected.length);
    return Math.round((1 - distance / maxLength) * 100);
  };

  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target?.result as string);
      setResults([]);
      setMetrics(null);
    };
    reader.readAsDataURL(file);
    return false;
  };

  const columns = [
    {
      title: 'Expected Text',
      dataIndex: 'text',
      key: 'text',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Component Type',
      dataIndex: 'expected',
      key: 'expected',
    },
    {
      title: 'Detection Status',
      dataIndex: 'detected',
      key: 'detected',
      render: (detected: boolean) => (
        detected ? 
          <Tag icon={<CheckCircleOutlined />} color="success">Detected</Tag> :
          <Tag icon={<CloseCircleOutlined />} color="error">Not Detected</Tag>
      )
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      render: (confidence: number) => (
        <Progress 
          percent={Math.round(confidence)} 
          size="small"
          status={confidence > 80 ? 'success' : confidence > 60 ? 'normal' : 'exception'}
        />
      )
    },
    {
      title: 'Accuracy',
      dataIndex: 'accuracy',
      key: 'accuracy',
      render: (accuracy: number) => (
        <Progress 
          percent={accuracy} 
          size="small"
          status={accuracy > 90 ? 'success' : accuracy > 70 ? 'normal' : 'exception'}
        />
      )
    },
  ];

  return (
    <Card title="OCR Accuracy Test" extra={
      <Button 
        type="primary" 
        icon={<ScanOutlined />}
        onClick={runAccuracyTest}
        loading={testing}
      >
        Run Test
      </Button>
    }>
      <Alert
        message="OCR Quality Information"
        description="This test demonstrates the OCR accuracy on industrial component labels. Upload your own image or use the generated test image."
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Upload
            beforeUpload={handleImageUpload}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>Upload Test Image</Button>
          </Upload>
        </Col>
        <Col span={12}>
          <Button onClick={() => {
            const testImg = generateTestImage();
            setImageUrl(testImg);
          }}>
            Generate Test Image
          </Button>
        </Col>
      </Row>

      {imageUrl && (
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <img 
            src={imageUrl} 
            alt="Test" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: 300, 
              border: '1px solid #d9d9d9',
              borderRadius: 4
            }} 
          />
        </div>
      )}

      {metrics && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Detection Rate"
                value={`${metrics.successfulDetections}/${metrics.totalTests}`}
                suffix={`(${Math.round((metrics.successfulDetections / metrics.totalTests) * 100)}%)`}
                valueStyle={{ 
                  color: metrics.successfulDetections === metrics.totalTests ? '#52c41a' : '#faad14' 
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Avg Confidence"
                value={metrics.averageConfidence}
                suffix="%"
                precision={1}
                valueStyle={{ 
                  color: metrics.averageConfidence > 80 ? '#52c41a' : '#faad14' 
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Avg Accuracy"
                value={metrics.averageAccuracy}
                suffix="%"
                precision={1}
                valueStyle={{ 
                  color: metrics.averageAccuracy > 90 ? '#52c41a' : '#faad14' 
                }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Processing Time"
                value={metrics.processingTime / 1000}
                suffix="seconds"
                precision={2}
              />
            </Card>
          </Col>
        </Row>
      )}

      {results.length > 0 && (
        <Table
          columns={columns}
          dataSource={results}
          rowKey="text"
          pagination={false}
          size="small"
        />
      )}

      {results.length > 0 && (
        <Alert
          message="Test Results Summary"
          description={
            <div>
              <p><strong>Overall Performance:</strong></p>
              <ul>
                <li>Text Recognition: {metrics?.averageConfidence.toFixed(1)}% confidence</li>
                <li>Component Detection: {((metrics?.successfulDetections || 0) / (metrics?.totalTests || 1) * 100).toFixed(0)}% success rate</li>
                <li>Character Accuracy: {metrics?.averageAccuracy.toFixed(1)}% match</li>
                <li>Processing Speed: {(metrics?.processingTime || 0) / 1000} seconds</li>
              </ul>
              <p>
                <strong>Quality Assessment:</strong> {' '}
                {metrics && metrics.averageAccuracy > 90 ? 
                  '✅ Excellent - Production Ready' : 
                  metrics && metrics.averageAccuracy > 80 ? 
                    '⚠️ Good - Suitable for most uses' : 
                    '❌ Fair - May need image quality improvements'
                }
              </p>
            </div>
          }
          type={metrics && metrics.averageAccuracy > 90 ? "success" : 
                metrics && metrics.averageAccuracy > 80 ? "warning" : "error"}
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Card>
  );
};

export default OCRAccuracyTest;
