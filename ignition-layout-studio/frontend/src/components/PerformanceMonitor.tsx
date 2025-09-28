import React, { useState, useEffect } from 'react';
import { Card, Statistic, Row, Col, Button, Table, Tag, Alert, Spin } from 'antd';
import { ReloadOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import api from '../services/api';

interface PerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  endpointMetrics: Array<{
    endpoint: string;
    calls: number;
    totalTime: number;
    errors: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
}

interface PipelineMetrics {
  totalRequests: number;
  successfulRequests: number;
  averageResponseTime: number;
  providerPerformance: Array<{
    provider: string;
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    successRate: number;
  }>;
  cacheStats: {
    size: number;
    maxSize: number;
    hitRate: number;
  };
}

const PerformanceMonitor: React.FC = () => {
  const [apiMetrics, setApiMetrics] = useState<PerformanceMetrics | null>(null);
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get API metrics
      const apiPerformance = api.getPerformanceMetrics();
      setApiMetrics(apiPerformance);

      // Get pipeline metrics
      const pipelinePerformance = await api.getPipelineMetrics();
      setPipelineMetrics(pipelinePerformance.metrics);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      await api.clearPipelineCache();
      await fetchMetrics();
    } catch (err: any) {
      setError(err.message || 'Failed to clear cache');
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPerformanceColor = (responseTime: number) => {
    if (responseTime < 1000) return 'green';
    if (responseTime < 5000) return 'orange';
    return 'red';
  };

  const getErrorRateColor = (errorRate: number) => {
    if (errorRate < 0.1) return 'green';
    if (errorRate < 0.3) return 'orange';
    return 'red';
  };

  const endpointColumns = [
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (text: string) => <code>{text}</code>
    },
    {
      title: 'Calls',
      dataIndex: 'calls',
      key: 'calls',
      sorter: (a: any, b: any) => a.calls - b.calls,
    },
    {
      title: 'Avg Response Time',
      dataIndex: 'averageResponseTime',
      key: 'averageResponseTime',
      render: (time: number) => (
        <Tag color={getPerformanceColor(time)}>
          {Math.round(time)}ms
        </Tag>
      ),
      sorter: (a: any, b: any) => a.averageResponseTime - b.averageResponseTime,
    },
    {
      title: 'Error Rate',
      dataIndex: 'errorRate',
      key: 'errorRate',
      render: (rate: number) => (
        <Tag color={getErrorRateColor(rate)}>
          {(rate * 100).toFixed(1)}%
        </Tag>
      ),
      sorter: (a: any, b: any) => a.errorRate - b.errorRate,
    },
    {
      title: 'Total Errors',
      dataIndex: 'errors',
      key: 'errors',
      sorter: (a: any, b: any) => a.errors - b.errors,
    }
  ];

  const providerColumns = [
    {
      title: 'Provider',
      dataIndex: 'provider',
      key: 'provider',
      render: (text: string) => <strong>{text}</strong>
    },
    {
      title: 'Requests',
      dataIndex: 'totalRequests',
      key: 'totalRequests',
      sorter: (a: any, b: any) => a.totalRequests - b.totalRequests,
    },
    {
      title: 'Success Rate',
      dataIndex: 'successRate',
      key: 'successRate',
      render: (rate: number) => (
        <Tag color={rate > 0.9 ? 'green' : rate > 0.7 ? 'orange' : 'red'}>
          {(rate * 100).toFixed(1)}%
        </Tag>
      ),
      sorter: (a: any, b: any) => a.successRate - b.successRate,
    },
    {
      title: 'Avg Response Time',
      dataIndex: 'averageResponseTime',
      key: 'averageResponseTime',
      render: (time: number) => (
        <Tag color={getPerformanceColor(time)}>
          {Math.round(time)}ms
        </Tag>
      ),
      sorter: (a: any, b: any) => a.averageResponseTime - b.averageResponseTime,
    }
  ];

  if (loading && !apiMetrics) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <p>Loading performance metrics...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Performance Monitor</h2>
        <div>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchMetrics}
            loading={loading}
            style={{ marginRight: '10px' }}
          >
            Refresh
          </Button>
          <Button 
            icon={<DeleteOutlined />} 
            onClick={clearCache}
            type="primary"
            danger
          >
            Clear Cache
          </Button>
        </div>
      </div>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: '20px' }}
        />
      )}

      {/* API Performance Overview */}
      <Card title="API Performance Overview" style={{ marginBottom: '20px' }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="Total Requests"
              value={apiMetrics?.totalRequests || 0}
              prefix={<ArrowUpOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Average Response Time"
              value={Math.round(apiMetrics?.averageResponseTime || 0)}
              suffix="ms"
              valueStyle={{ color: getPerformanceColor(apiMetrics?.averageResponseTime || 0) }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Error Rate"
              value={((apiMetrics?.errorRate || 0) * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ color: getErrorRateColor(apiMetrics?.errorRate || 0) }}
                              prefix={<ArrowDownOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Cache Size"
              value={pipelineMetrics?.cacheStats?.size || 0}
              suffix={`/ ${pipelineMetrics?.cacheStats?.maxSize || 1000}`}
            />
          </Col>
        </Row>
      </Card>

      {/* Pipeline Performance Overview */}
      {pipelineMetrics && (
        <Card title="Pipeline Performance Overview" style={{ marginBottom: '20px' }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="Pipeline Requests"
                value={pipelineMetrics.totalRequests}
                prefix={<ArrowUpOutlined />}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Success Rate"
                value={((pipelineMetrics.successfulRequests / pipelineMetrics.totalRequests) * 100).toFixed(1)}
                suffix="%"
                valueStyle={{ color: getErrorRateColor(1 - (pipelineMetrics.successfulRequests / pipelineMetrics.totalRequests)) }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Pipeline Avg Time"
                value={Math.round(pipelineMetrics.averageResponseTime)}
                suffix="ms"
                valueStyle={{ color: getPerformanceColor(pipelineMetrics.averageResponseTime) }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Cache Hit Rate"
                value={pipelineMetrics.cacheStats.hitRate.toFixed(1)}
                suffix="%"
                valueStyle={{ color: pipelineMetrics.cacheStats.hitRate > 50 ? 'green' : 'orange' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* Performance Recommendations */}
      <Card title="Performance Recommendations" style={{ marginBottom: '20px' }}>
        <div>
          {apiMetrics && apiMetrics.averageResponseTime > 5000 && (
            <Alert
              message="High Response Times Detected"
              description="API responses are taking longer than 5 seconds. Consider optimizing AI provider settings or checking network connectivity."
              type="warning"
              showIcon
              style={{ marginBottom: '10px' }}
            />
          )}
          
          {apiMetrics && apiMetrics.errorRate > 0.1 && (
            <Alert
              message="High Error Rate"
              description="More than 10% of requests are failing. Check AI provider configuration and API keys."
              type="error"
              showIcon
              style={{ marginBottom: '10px' }}
            />
          )}
          
          {pipelineMetrics && pipelineMetrics.cacheStats.hitRate < 20 && (
            <Alert
              message="Low Cache Hit Rate"
              description="Cache is not being utilized effectively. Consider increasing cache size or duration."
              type="info"
              showIcon
              style={{ marginBottom: '10px' }}
            />
          )}
          
          {!apiMetrics?.totalRequests && (
            <Alert
              message="No Performance Data"
              description="Start generating components to see performance metrics."
              type="info"
              showIcon
            />
          )}
        </div>
      </Card>

      {/* Endpoint Performance Details */}
      {apiMetrics && apiMetrics.endpointMetrics.length > 0 && (
        <Card title="Endpoint Performance Details" style={{ marginBottom: '20px' }}>
          <Table
            dataSource={apiMetrics.endpointMetrics}
            columns={endpointColumns}
            pagination={false}
            rowKey="endpoint"
            size="small"
          />
        </Card>
      )}

      {/* AI Provider Performance */}
      {pipelineMetrics && pipelineMetrics.providerPerformance.length > 0 && (
        <Card title="AI Provider Performance">
          <Table
            dataSource={pipelineMetrics.providerPerformance}
            columns={providerColumns}
            pagination={false}
            rowKey="provider"
            size="small"
          />
        </Card>
      )}
    </div>
  );
};

export default PerformanceMonitor; 