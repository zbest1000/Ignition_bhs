import React, { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';
import './FileValidation.css';

interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  category?: string;
  metadata?: any;
  fileName: string;
  index: number;
}

interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  categories: { [key: string]: number };
  hasWarnings: boolean;
}

interface SupportedFormat {
  category: string;
  extensions: string[];
  maxSize: string;
  description: string;
}

interface FileValidationProps {
  files: File[];
  onValidationComplete: (isValid: boolean, results: FileValidationResult[]) => void;
  showPreview?: boolean;
}

const FileValidation: React.FC<FileValidationProps> = ({
  files,
  onValidationComplete,
  showPreview = true,
}) => {
  const [validationResults, setValidationResults] = useState<FileValidationResult[]>([]);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [supportedFormats, setSupportedFormats] = useState<SupportedFormat[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  // Load supported formats on component mount
  useEffect(() => {
    const loadSupportedFormats = async () => {
      try {
        const response = await apiService.getSupportedFormats();
        setSupportedFormats(response.supportedFormats);
      } catch (error) {
        console.error('Failed to load supported formats:', error);
      }
    };

    loadSupportedFormats();
  }, []);

  const validateFiles = useCallback(async () => {
    if (files.length === 0) return;

    setIsValidating(true);
    try {
      const response = await apiService.validateFiles(files);
      const { validation } = response;

      setValidationResults(validation.results);
      setSummary(validation.summary);
      onValidationComplete(validation.isValid, validation.results);
    } catch (error: any) {
      console.error('Validation error:', error);
      
      // Extract detailed error information from backend response
      let errorResults: FileValidationResult[] = [];
      
      if (error.response?.data) {
        const errorData = error.response.data;
        
        // If backend provided detailed validation results, use them
        if (errorData.results && Array.isArray(errorData.results)) {
          errorResults = errorData.results.map((result: any) => ({
            index: result.index,
            fileName: result.fileName,
            isValid: result.isValid,
            errors: result.errors || [],
            warnings: result.warnings || [],
            category: result.category,
            metadata: result.metadata
          }));
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          // If backend provided general errors, apply them to all files
          errorResults = files.map((file, index) => ({
            index,
            fileName: file.name,
            isValid: false,
            errors: errorData.errors,
            warnings: errorData.warnings || [],
          }));
        } else if (errorData.error || errorData.message) {
          // Single error message from backend
          const errorMessage = errorData.error || errorData.message;
          errorResults = files.map((file, index) => ({
            index,
            fileName: file.name,
            isValid: false,
            errors: [errorMessage],
            warnings: [],
          }));
        } else {
          // Fallback to generic error
          errorResults = files.map((file, index) => ({
            index,
            fileName: file.name,
            isValid: false,
            errors: ['File validation failed - please check the file format and size'],
            warnings: [],
          }));
        }
        
        // Store supported formats for display
        if (errorData.supportedFormats) {
          setSupportedFormats(errorData.supportedFormats);
        }
      } else {
        // Network or other errors
        const errorMessage = error.message || 'Network error - please check your connection and try again';
        errorResults = files.map((file, index) => ({
          index,
          fileName: file.name,
          isValid: false,
          errors: [errorMessage],
          warnings: [],
        }));
      }

      setValidationResults(errorResults);
      setSummary({
        total: files.length,
        valid: 0,
        invalid: files.length,
        categories: {},
        hasWarnings: false,
      });
      onValidationComplete(false, errorResults);
    } finally {
      setIsValidating(false);
    }
  }, [files, onValidationComplete]);

  // Validate files when they change
  useEffect(() => {
    if (files.length > 0) {
      validateFiles();
    } else {
      setValidationResults([]);
      setSummary(null);
      onValidationComplete(true, []);
    }
  }, [files, validateFiles, onValidationComplete]);

  const getFileIcon = (fileName: string, category?: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();

    if (category === 'image') return '🖼️';
    if (category === 'pdf') return '📄';
    if (category === 'cad') return '📐';
    if (category === 'data') return '📊';
    if (category === 'document') return '📝';
    if (category === 'archive') return '📦';

    // Fallback based on extension
    switch (extension) {
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'tiff':
      case 'bmp':
      case 'webp':
      case 'svg':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'dwg':
      case 'dxf':
        return '📐';
      case 'xlsx':
      case 'xls':
      case 'csv':
      case 'json':
        return '📊';
      case 'doc':
      case 'docx':
      case 'rtf':
      case 'txt':
        return '📝';
      case 'zip':
      case 'rar':
      case '7z':
        return '📦';
      default:
        return '📎';
    }
  };

  const getCategoryColor = (category?: string): string => {
    switch (category) {
      case 'image':
        return '#4CAF50';
      case 'pdf':
        return '#F44336';
      case 'cad':
        return '#2196F3';
      case 'data':
        return '#FF9800';
      case 'document':
        return '#673AB7';
      case 'archive':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  if (!showPreview && validationResults.length === 0) {
    return null;
  }

  return (
    <div className='file-validation'>
      {isValidating && (
        <div className='validation-loading'>
          <div className='spinner'></div>
          <span>Validating files...</span>
        </div>
      )}

      {summary && (
        <div className='validation-summary'>
          <div className='summary-stats'>
            <div className='stat'>
              <span className='stat-value'>{summary.total}</span>
              <span className='stat-label'>Total Files</span>
            </div>
            <div className='stat valid'>
              <span className='stat-value'>{summary.valid}</span>
              <span className='stat-label'>Valid</span>
            </div>
            {summary.invalid > 0 && (
              <div className='stat invalid'>
                <span className='stat-value'>{summary.invalid}</span>
                <span className='stat-label'>Invalid</span>
              </div>
            )}
          </div>

          {Object.keys(summary.categories).length > 0 && (
            <div className='category-breakdown'>
              <h4>File Categories:</h4>
              <div className='categories'>
                {Object.entries(summary.categories).map(([category, count]) => (
                  <div
                    key={category}
                    className='category-item'
                    style={{ borderColor: getCategoryColor(category) }}
                  >
                    <span className='category-name'>{category}</span>
                    <span className='category-count'>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {validationResults.length > 0 && (
        <div className='validation-results'>
          <h3>File Validation Results</h3>
          <div className='file-list'>
            {validationResults.map((result, index) => (
              <div key={index} className={`file-item ${result.isValid ? 'valid' : 'invalid'}`}>
                <div className='file-header'>
                  <div className='file-info'>
                    <span className='file-icon'>
                      {getFileIcon(result.fileName, result.category)}
                    </span>
                    <span className='file-name'>{result.fileName}</span>
                    {result.category && (
                      <span
                        className='file-category'
                        style={{ backgroundColor: getCategoryColor(result.category) }}
                      >
                        {result.category}
                      </span>
                    )}
                  </div>
                  <div className='file-status'>
                    {result.isValid ? (
                      <span className='status-valid'>✓ Valid</span>
                    ) : (
                      <span className='status-invalid'>✗ Invalid</span>
                    )}
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className='file-errors'>
                    <h5>Errors:</h5>
                    <ul>
                      {result.errors.map((error, errorIndex) => (
                        <li key={errorIndex} className='error-item'>
                          {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.warnings.length > 0 && (
                  <div className='file-warnings'>
                    <h5>Warnings:</h5>
                    <ul>
                      {result.warnings.map((warning, warningIndex) => (
                        <li key={warningIndex} className='warning-item'>
                          {warning}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.metadata && (
                  <div className='file-metadata'>
                    <small>
                      Max size: {result.metadata.maxAllowedSize} | Description:{' '}
                      {result.metadata.description}
                    </small>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {summary && summary.invalid > 0 && (
        <div className='supported-formats-section'>
          <button className='show-formats-btn' onClick={() => setShowFormats(!showFormats)}>
            {showFormats ? 'Hide' : 'Show'} Supported Formats
          </button>

          {showFormats && (
            <div className='supported-formats'>
              <h4>Supported File Formats</h4>
              <div className='format-categories'>
                {supportedFormats.map((format, index) => (
                  <div key={index} className='format-category'>
                    <h5 style={{ color: getCategoryColor(format.category) }}>
                      {format.category.toUpperCase()}
                    </h5>
                    <p className='format-description'>{format.description}</p>
                    <div className='format-details'>
                      <div className='extensions'>
                        <strong>Extensions:</strong> {format.extensions.join(', ')}
                      </div>
                      <div className='max-size'>
                        <strong>Max Size:</strong> {format.maxSize}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileValidation;
