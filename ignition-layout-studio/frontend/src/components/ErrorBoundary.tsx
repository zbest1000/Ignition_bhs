import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Typography, Alert } from 'antd';
import { BugOutlined, ReloadOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to external service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (Sentry, LogRocket, etc.)
      console.error('Production error:', {
        error: error.toString(),
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{ padding: '24px', minHeight: '400px' }}>
          <Result
            status='error'
            icon={<BugOutlined />}
            title='Something went wrong'
            subTitle='An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.'
            extra={[
              <Button
                key='reload'
                type='primary'
                icon={<ReloadOutlined />}
                onClick={this.handleReload}
              >
                Reload Page
              </Button>,
              <Button key='reset' onClick={this.handleReset}>
                Try Again
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Alert
                message='Development Error Details'
                description={
                  <div>
                    <Paragraph>
                      <Text strong>Error:</Text> {this.state.error.message}
                    </Paragraph>
                    <Paragraph>
                      <Text strong>Stack Trace:</Text>
                      <pre
                        style={{
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          overflow: 'auto',
                          maxHeight: '200px',
                        }}
                      >
                        {this.state.error.stack}
                      </pre>
                    </Paragraph>
                    {this.state.errorInfo && (
                      <Paragraph>
                        <Text strong>Component Stack:</Text>
                        <pre
                          style={{
                            background: '#f5f5f5',
                            padding: '8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            overflow: 'auto',
                            maxHeight: '200px',
                          }}
                        >
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </Paragraph>
                    )}
                  </div>
                }
                type='warning'
                showIcon
                style={{ marginTop: '16px', textAlign: 'left' }}
              />
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
