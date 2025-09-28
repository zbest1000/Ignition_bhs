import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Upload,
  message,
  Drawer,
  List,
  Tooltip,
  Divider,
  Spin,
  Typography,
  Space,
  Radio,
  Menu,
  Progress,
} from 'antd';
import {
  LeftOutlined,
  UploadOutlined,
  SettingOutlined,
  AppstoreOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  BulbOutlined,
  RobotOutlined,
  DeleteOutlined,
  SelectOutlined,
  DragOutlined,
  BorderOutlined,
  PushpinOutlined,
  TagsOutlined,
  ExportOutlined,
  FolderOpenOutlined,
  ScanOutlined,
  ExperimentOutlined,
  GroupOutlined,
  FileOutlined,
} from '@ant-design/icons';
import { Project, Component, Template, ExportOptions, ComponentType } from '../types';
import Canvas from '../components/Canvas/Canvas';
import FileValidation from '../components/FileValidation';
import api from '../services/api';
import socket from '../services/socket';
import ConveyorEngine from '../services/conveyorEngine';
import { nativeOCRService } from '../services/nativeOCRService';
import { v4 as uuidv4 } from 'uuid';
import './ProjectEditor.css';
import ComponentGroupingManager from '../components/ComponentGroupingManager';
import TemplateLibrary from '../components/TemplateLibrary';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

const ProjectEditor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('files');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportForm] = Form.useForm();
  const [createComponentModalVisible, setCreateComponentModalVisible] = useState(false);
  const [createComponentForm] = Form.useForm();
  const [settingsForm] = Form.useForm();
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isValidationValid, setIsValidationValid] = useState(true);
  const [showGroupingManager, setShowGroupingManager] = useState(false);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);

  const [canvasState, setCanvasState] = useState({
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedComponents: [] as string[],
    hoveredComponent: undefined as string | undefined,
    tool: 'select',
    showGrid: true,
    snapToGrid: true,
    showLabels: true,
  });
  const [aiStatus, setAiStatus] = useState<any>(null);

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getProject(projectId!);
      setProject(data);

      // Initialize settings form with project settings
      settingsForm.setFieldsValue({
        gridSize: data.settings.gridSize,
        snapToGrid: data.settings.snapToGrid,
        showLabels: data.settings.showLabels,
        units: data.settings.units,
      });
    } catch (error) {
      message.error('Failed to load project');
      console.error(error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [projectId, navigate, settingsForm]);

  useEffect(() => {
    if (projectId) {
      loadProject();
      loadAIStatus();
      socket.joinProject(projectId);
      setupSocketListeners();
    }

    return () => {
      // Cleanup socket listeners
    };
  }, [projectId, loadProject]);

  const loadAIStatus = async () => {
    try {
      const status = await api.getAIStatus();
      setAiStatus(status);
    } catch (error) {
      console.error('Failed to load AI status:', error);
    }
  };

  const setupSocketListeners = () => {
    socket.on('component-created', component => {
      setProject(prev =>
        prev
          ? {
              ...prev,
              components: [...prev.components, component],
            }
          : null
      );
    });

    socket.on('component-updated', component => {
      setProject(prev =>
        prev
          ? {
              ...prev,
              components: prev.components.map(c => (c.id === component.id ? component : c)),
            }
          : null
      );
    });

    socket.on('component-deleted', componentId => {
      setProject(prev =>
        prev
          ? {
              ...prev,
              components: prev.components.filter(c => c.id !== componentId),
            }
          : null
      );
    });

    socket.on('components-deleted', (deletedIds: string[]) => {
      setProject(prev =>
        prev
          ? {
              ...prev,
              components: prev.components.filter(c => !deletedIds.includes(c.id)),
            }
          : null
      );
    });

    socket.on('files-uploaded', files => {
      setProject(prev =>
        prev
          ? {
              ...prev,
              files: [...prev.files, ...files],
            }
          : null
      );
    });
  };

  const handleCanvasStateChange = (updates: Partial<any>) => {
    setCanvasState(prev => ({ ...prev, ...updates }));
  };

  const handleComponentSelect = (componentIds: string[]) => {
    setCanvasState(prev => ({ ...prev, selectedComponents: componentIds }));
  };

  const handleComponentUpdate = async (componentId: string, updates: Partial<Component>) => {
    try {
      await api.updateComponent(projectId!, componentId, updates);
    } catch (error) {
      message.error('Failed to update component');
      console.error(error);
    }
  };

  const handleComponentCreate = async (componentData: Partial<Component>) => {
    try {
      const newComponent = {
        ...componentData,
        id: uuidv4(),
        equipmentId: `COMP_${Date.now()}`,
        label: 'New Component',
      };
      await api.createComponent(projectId!, newComponent);
    } catch (error) {
      message.error('Failed to create component');
      console.error(error);
    }
  };

  const handleFileSelect = (fileList: any) => {
    const files = Array.from(fileList.fileList || fileList).map(
      (file: any) => file.originFileObj || file
    );
    setSelectedFiles(files);
    return false; // Prevent default upload behavior
  };

  const handleValidationComplete = (isValid: boolean, results: any[]) => {
    setIsValidationValid(isValid);
    // setValidationResults(results); // This line was removed from the original file
  };

  const handleFileUpload = async () => {
    if (!isValidationValid || selectedFiles.length === 0) {
      message.error('Please select valid files before uploading');
      return;
    }

    try {
      setLoadingState('file-upload', true);
      const response = await api.uploadFiles(projectId!, selectedFiles);

      if (response.warnings && response.warnings.length > 0) {
        response.warnings.forEach((warning: string) => {
          message.warning(warning);
        });
      }

      message.success(`${selectedFiles.length} file(s) uploaded successfully`);
      setSelectedFiles([]);
      // setValidationResults([]); // This line was removed from the original file
      setIsValidationValid(true);

      // Refresh project data to show new files
      loadProject();
    } catch (error: any) {
      console.error('Upload error:', error);

      // Handle detailed error response
      if (error.response?.data) {
        const errorData = error.response.data;

        if (errorData.errors && Array.isArray(errorData.errors)) {
          errorData.errors.forEach((err: string) => {
            message.error(err);
          });
        } else {
          message.error(errorData.message || 'Failed to upload files');
        }

        if (errorData.supportedFormats) {
          console.log('Supported formats:', errorData.supportedFormats);
        }
      } else {
        message.error('Failed to upload files');
      }
    } finally {
      setLoadingState('file-upload', false);
    }
  };

  const handleOCRProcess = async (fileId: string, fileName: string) => {
    try {
      setLoadingState(`ocr-${fileId}`, true);
      
      // Find the file in the project
      const file = project?.files.find(f => f.id === fileId);
      if (!file) {
        throw new Error('File not found');
      }

      // Create image URL for OCR processing
      const imageUrl = `http://localhost:3001/uploads/${file.filename}`;
      
      // Show progress modal
      const modal = Modal.info({
        title: `Processing OCR for ${fileName}`,
        content: (
          <div>
            <Progress percent={0} status="active" />
            <p>Initializing OCR engine...</p>
          </div>
        ),
        okButtonProps: { style: { display: 'none' } },
        maskClosable: false,
      });

      let progressPercent = 0;
      
      // Set up progress listener
      nativeOCRService.onProgress(fileId, (progress) => {
        progressPercent = Math.round(progress.progress * 100);
        modal.update({
          content: (
            <div>
              <Progress percent={progressPercent} status="active" />
              <p>{progress.status}</p>
            </div>
          ),
        });
      });

      // Process the image with native OCR
      const startTime = Date.now();
      const ocrResult = await nativeOCRService.processImage(imageUrl, {
        jobId: fileId,
        preprocessImage: true,
        detectComponents: true,
      });
      
      const processingTime = Date.now() - startTime;
      ocrResult.metadata.processingTime = processingTime;

      // Close progress modal
      modal.destroy();

      // Show results summary
      const componentsDetected = (ocrResult as any).components || [];
      const textBlocksCount = ocrResult.textBlocks.length;
      
      Modal.success({
        title: 'OCR Processing Complete',
        content: (
          <div>
            <p><strong>File:</strong> {fileName}</p>
            <p><strong>Processing Time:</strong> {(processingTime / 1000).toFixed(2)} seconds</p>
            <p><strong>Text Blocks Found:</strong> {textBlocksCount}</p>
            <p><strong>Components Detected:</strong> {componentsDetected.length}</p>
            {componentsDetected.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p><strong>Detected Components:</strong></p>
                <ul style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {componentsDetected.slice(0, 10).map((comp: any, idx: number) => (
                    <li key={idx}>{comp.name} - {comp.componentType}</li>
                  ))}
                  {componentsDetected.length > 10 && (
                    <li>...and {componentsDetected.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ),
        onOk: async () => {
          // Add detected components to the canvas
          if (componentsDetected.length > 0) {
            const confirmAdd = await new Promise<boolean>((resolve) => {
              Modal.confirm({
                title: 'Add Detected Components?',
                content: `Would you like to add ${componentsDetected.length} detected component(s) to the canvas?`,
                onOk: () => resolve(true),
                onCancel: () => resolve(false),
              });
            });

            if (confirmAdd) {
              // Add components to the project
              for (const component of componentsDetected) {
                const newComponent: Component = {
                  ...component,
                  id: component.id || uuidv4(),
                  projectId: projectId!,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                } as Component;

                await handleComponentCreate(newComponent);
              }
              
              message.success(`Added ${componentsDetected.length} component(s) to the canvas`);
            }
          }
        },
      });

      // Store OCR results in backend for reference
      try {
        await api.processOCR(projectId!, fileId, { 
          nativeOCRResult: ocrResult,
          componentsDetected: componentsDetected.length 
        });
      } catch (error) {
        // Non-critical error, just log it
        console.error('Failed to store OCR results in backend:', error);
      }

    } catch (error: any) {
      console.error('OCR process error:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Unknown error occurred';
      message.error(`Failed to process OCR for "${fileName}": ${errorMessage}`);
    } finally {
      setLoadingState(`ocr-${fileId}`, false);
      nativeOCRService.removeProgressListener(fileId);
    }
  };

  const handleExport = async (values: ExportOptions) => {
    try {
      setExportModalVisible(false);

      if (values.includeSVG) {
        const svgBlob = await api.exportSVG(projectId!);
        const url = URL.createObjectURL(svgBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.name || 'layout'}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }

      if (values.includePerspective || values.includeVision || values.includeTemplates) {
        const result = await api.exportPackage(projectId!, values);
        await api.downloadExport(projectId!, result.exportId);
      }

      message.success('Export completed successfully');
    } catch (error) {
      message.error('Failed to export project');
      console.error(error);
    }
  };

  const handleDeleteSelected = async () => {
    if (canvasState.selectedComponents.length === 0) return;

    const idsToDelete = [...canvasState.selectedComponents];

    try {
      await api.bulkDeleteComponents(projectId!, idsToDelete);

      // Optimistically update local state
      setProject(prev =>
        prev
          ? {
              ...prev,
              components: prev.components.filter(c => !idsToDelete.includes(c.id)),
            }
          : null
      );

      setCanvasState(prev => ({ ...prev, selectedComponents: [] }));
      message.success('Components deleted successfully');
    } catch (error) {
      message.error('Failed to delete components');
      console.error(error);
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    Modal.confirm({
      title: 'Delete File',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setLoadingState(`delete-file-${fileId}`, true);
          await api.deleteFile(projectId!, fileId);
          setProject(prev =>
            prev
              ? {
                  ...prev,
                  files: prev.files.filter(f => f.id !== fileId),
                }
              : null
          );
          message.success(`File "${fileName}" deleted successfully`);
        } catch (error: any) {
          console.error('Delete file error:', error);
          const errorMessage =
            error.response?.data?.message || error.message || 'Unknown error occurred';
          message.error(`Failed to delete file: ${errorMessage}`);

          // Show detailed error in development
          if (process.env.NODE_ENV === 'development') {
            Modal.error({
              title: 'Delete File Error (Development)',
              content: (
                <div>
                  <p>
                    <strong>Error:</strong> {errorMessage}
                  </p>
                  <p>
                    <strong>Status:</strong> {error.response?.status || 'Unknown'}
                  </p>
                  <p>
                    <strong>Details:</strong> {JSON.stringify(error.response?.data, null, 2)}
                  </p>
                </div>
              ),
            });
          }
        } finally {
          setLoadingState(`delete-file-${fileId}`, false);
        }
      },
    });
  };

  const handleCreateCustomComponent = async (values: { description: string; useAI?: boolean }) => {
    if (!values.description.trim()) {
      message.error('Please provide a component description');
      return;
    }

    const startTime = Date.now();
    try {
      setLoadingState('create-component', true);

      if (values.useAI) {
        // Check if AI is available
        if (!aiStatus || (!aiStatus.availableProviders.length && !aiStatus.mockMode)) {
          message.warning(
            'AI service is not available. Please configure an AI provider in settings or use simple parsing.'
          );
          return;
        }

        let component = null;
        let usedPipeline = false;
        let performanceMetrics = null;

        try {
          // Use fast pipeline for quick generation by default
          const pipelineId = values.description.length > 100 ? 'ignition-component' : 'ignition-component-fast';
          
          console.log(`Using pipeline: ${pipelineId} for description length: ${values.description.length}`);
          
          const pipelineResult = await api.generateComponentWithPipeline(
            values.description,
            pipelineId,
            {
              industry: project?.settings?.industry || 'manufacturing',
              safetyLevel: project?.settings?.safetyLevel || 'standard',
              projectType: project?.description || 'industrial',
            },
            {
              provider: project?.settings?.aiIntegration?.provider || 'openai',
              temperature: 0.7,
              max_tokens: pipelineId === 'ignition-component-fast' ? 1500 : 2000,
              timeout: pipelineId === 'ignition-component-fast' ? 15000 : 30000
            }
          );

          if (pipelineResult.success && pipelineResult.component) {
            component =
              pipelineResult.component.extractedComponents?.[0] ||
              parseComponentFromAIResponse(pipelineResult.component.content);
            usedPipeline = true;
            performanceMetrics = pipelineResult.component.performanceMetrics;

            // Log performance information
            if (performanceMetrics) {
              console.log('Component generation performance:', {
                totalTime: performanceMetrics.totalTime,
                providerTime: performanceMetrics.providerTime,
                pipeline: pipelineId,
                provider: pipelineResult.component.provider
              });
            }
          }
        } catch (pipelineError: any) {
          console.warn('Pipeline generation failed, falling back to basic AI:', pipelineError);

          // Only fallback to basic AI if pipeline fails quickly (< 10 seconds)
          const pipelineTime = Date.now() - startTime;
          if (pipelineTime < 10000) {
            try {
              const basicResult = await api.generateComponentFromText(projectId!, values.description);
              component = basicResult;
            } catch (basicError: any) {
              console.error('Basic AI generation also failed:', basicError);
              throw basicError;
            }
          } else {
            throw pipelineError;
          }
        }

        if (component) {
          await handleComponentCreate(component);

          const totalTime = Date.now() - startTime;
          const successMessage = usedPipeline
            ? `Enhanced AI component created in ${(totalTime / 1000).toFixed(1)}s using ${performanceMetrics?.provider || 'AI'} pipeline!`
            : `AI-generated component created in ${(totalTime / 1000).toFixed(1)}s!`;
          
          message.success(successMessage);

          // Optional: Only run analysis for complex components or if specifically requested
          if (project?.settings?.aiIntegration?.enableSuggestions && usedPipeline && values.description.length > 50) {
            try {
              const analysis = await api.analyzeComponentWithPipeline(
                component,
                'general',
                'advanced-analysis',
                { industry: project?.settings?.industry }
              );

              if (analysis.success && analysis.analysis.suggestions?.length > 0) {
                message.info(`AI Suggestion: ${analysis.analysis.suggestions[0]}`, 5);
              }
            } catch (analysisError) {
              console.warn('Component analysis failed:', analysisError);
            }
          }
        } else {
          throw new Error('Failed to generate component with AI');
        }
      } else {
        // Use simple parser (fastest option)
        const parsedComponent = parseComponentDescription(values.description);
        await handleComponentCreate(parsedComponent);
        
        const totalTime = Date.now() - startTime;
        message.success(`Custom component created in ${(totalTime / 1000).toFixed(1)}s`);
      }

      setCreateComponentModalVisible(false);
      createComponentForm.resetFields();
    } catch (error: any) {
      console.error('Create component error:', error);
      const totalTime = Date.now() - startTime;
      const errorMessage =
        error.response?.data?.message || error.message || 'Unknown error occurred';

      // Enhanced error handling with specific messages and timing
      let userMessage = `Failed to create component after ${(totalTime / 1000).toFixed(1)}s. `;

      if (values.useAI) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          userMessage = 'AI service authentication failed. Please check your API key in settings.';
        } else if (error.response?.status === 429) {
          userMessage = 'AI service rate limit exceeded. Please try again in a few moments.';
        } else if (error.message?.includes('timeout') || totalTime > 30000) {
          userMessage = 'AI request timed out. Try using a shorter description or check your connection.';
        } else if (error.message?.includes('API key')) {
          userMessage = 'Invalid API key. Please check your AI provider configuration in settings.';
        } else if (error.message?.includes('quota')) {
          userMessage = 'AI service quota exceeded. Please check your account limits.';
        } else if (error.response?.status >= 500) {
          userMessage = 'AI service is temporarily unavailable. Please try again later.';
        } else {
          userMessage = `Failed to create AI component: ${errorMessage}`;
        }
      } else {
        userMessage = `Failed to create custom component: ${errorMessage}`;
      }

      message.error(userMessage);
    } finally {
      setLoadingState('create-component', false);
    }
  };

  // Helper function to parse AI response content
  const parseComponentFromAIResponse = (content: string): Partial<Component> => {
    try {
      // Try to extract JSON from the AI response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }

      // Fallback to simple parsing
      return parseComponentDescription(content);
    } catch (error) {
      console.warn('Failed to parse AI response, using fallback:', error);
      return parseComponentDescription(content);
    }
  };

  const parseComponentDescription = (description: string): Partial<Component> => {
    // Simple parsing logic - can be enhanced with AI later
    const lowerDesc = description.toLowerCase();

    // Default component properties
    let componentType: ComponentType = 'custom';
    let label = 'Custom Component';
    let width = 100;
    let height = 50;
    let color = '#1890ff';

    // Parse component type - use advanced conveyor engine for conveyors
    if (lowerDesc.includes('conveyor') || lowerDesc.includes('belt')) {
      // Use ConveyorEngine to create enhanced conveyor component
      const conveyorComponent = ConveyorEngine.createConveyorComponent(description, { x: 100, y: 100 });

      // Return the conveyor component with all properties
      return {
        type: conveyorComponent.type,
        label: conveyorComponent.label,
        equipmentId: conveyorComponent.equipmentId,
        geometry: conveyorComponent.geometry,
        style: conveyorComponent.style,
        properties: conveyorComponent.properties,
        conveyorProperties: conveyorComponent.conveyorProperties,
        conveyorRendering: conveyorComponent.conveyorRendering,
        metadata: conveyorComponent.metadata,
      };
    } else if (lowerDesc.includes('motor') || lowerDesc.includes('pump')) {
      componentType = 'motor';
      width = 60;
      height = 60;
      color = '#fa8c16';
    } else if (lowerDesc.includes('sensor') || lowerDesc.includes('detector')) {
      componentType = 'sensor';
      width = 40;
      height = 40;
      color = '#722ed1';
    } else if (lowerDesc.includes('valve') || lowerDesc.includes('gate')) {
      componentType = 'perspective.valve';
      width = 50;
      height = 80;
      color = '#eb2f96';
    } else if (lowerDesc.includes('tank') || lowerDesc.includes('container')) {
      componentType = 'perspective.cylindrical-tank';
      width = 120;
      height = 100;
      color = '#13c2c2';
    }

    // Extract label if provided
    const labelMatch = description.match(/(?:called|named|labeled)\s+["']([^"']+)["']/i);
    if (labelMatch) {
      label = labelMatch[1];
    }

    // Extract dimensions if provided
    const dimensionMatch = description.match(/(\d+)\s*x\s*(\d+)/i);
    if (dimensionMatch) {
      width = parseInt(dimensionMatch[1]);
      height = parseInt(dimensionMatch[2]);
    }

    return {
      type: componentType,
      label,
      equipmentId: `CUSTOM_${Date.now()}`,
      geometry: {
        x: 100,
        y: 100,
        width,
        height,
        rotation: 0,
        scale: 1,
      },
      style: {
        fill: color,
        stroke: '#000000',
        strokeWidth: 2,
        opacity: 1,
        visible: true,
        locked: false,
      },
      properties: {
        description: description,
        createdBy: 'text-parser',
      },
      metadata: {
        layer: 'default',
        source: 'text-description',
        originalDescription: description,
      },
    };
  };

  const handleSettingsUpdate = async (values: any) => {
    try {
      setLoadingState('update-settings', true);

      // Validate settings
      if (values.gridSize && (values.gridSize < 5 || values.gridSize > 100)) {
        message.error('Grid size must be between 5 and 100 pixels');
        return;
      }

      const updatedSettings = {
        ...project!.settings,
        ...values,
      };

      await api.updateProject(projectId!, { settings: updatedSettings });

      setProject(prev =>
        prev
          ? {
              ...prev,
              settings: updatedSettings,
            }
          : null
      );

      // Update canvas state if needed
      if (
        values.gridSize !== undefined ||
        values.snapToGrid !== undefined ||
        values.showLabels !== undefined
      ) {
        handleCanvasStateChange({
          showGrid: values.snapToGrid,
          snapToGrid: values.snapToGrid,
          showLabels: values.showLabels,
        });
      }

      message.success('Settings updated successfully');
    } catch (error: any) {
      console.error('Settings update error:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Unknown error occurred';
      message.error(`Failed to update settings: ${errorMessage}`);
    } finally {
      setLoadingState('update-settings', false);
    }
  };

  const handleGenerateExamples = async (category: string, count: number) => {
    try {
      setLoadingState(`generate-examples-${category}`, true);
      await api.generateExampleComponents(projectId!, count, category);
      message.success(`Generated ${count} example ${category} components`);
    } catch (error: any) {
      console.error('Generate examples error:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Unknown error occurred';
      message.error(`Failed to generate examples: ${errorMessage}`);
    } finally {
      setLoadingState(`generate-examples-${category}`, false);
    }
  };

  const handleGetAISuggestions = async () => {
    try {
      setLoadingState('ai-suggestions', true);

      // Check if AI is available
      if (!aiStatus || (!aiStatus.availableProviders.length && !aiStatus.mockMode)) {
        message.warning(
          'AI service is not available. Please configure an AI provider in settings.'
        );
        return;
      }

      const suggestions = await api.getSmartSuggestions(projectId!);

      if (!suggestions || suggestions.length === 0) {
        message.info('No AI suggestions available for this project at the moment.');
        return;
      }

      // Display suggestions in a modal
      const suggestionText = suggestions.map(s => `${s.title}: ${s.description}`).join('\n');
      Modal.info({
        title: 'AI Suggestions for Your Project',
        content: <div style={{ whiteSpace: 'pre-line' }}>{suggestionText}</div>,
        width: 600,
        okText: 'Got it',
      });
    } catch (error: any) {
      console.error('AI suggestions error:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Unknown error occurred';

      if (error.response?.status === 401 || error.response?.status === 403) {
        message.error('AI service authentication failed. Please check your API key in settings.');
      } else if (error.response?.status === 429) {
        message.error('AI service rate limit exceeded. Please try again later.');
      } else {
        message.error(`Failed to get AI suggestions: ${errorMessage}`);
      }
    } finally {
      setLoadingState('ai-suggestions', false);
    }
  };

  const handleGroupsUpdate = (newGroups: any) => {
    // Refresh project data to get updated groups
    if (project) {
      loadProject();
    }
  };

  const handleTemplatesUpdate = (newTemplates: any) => {
    // Refresh project data to get updated templates
    if (project) {
      loadProject();
    }
  };

  const handleTemplateApply = async (template: Template, parameters: any) => {
    try {
      setLoadingState('apply-template', true);
      
      // Create a new component based on the template
      const newComponent = {
        type: template.baseComponent?.type || 'custom',
        equipmentId: parameters.equipmentId || '',
        label: parameters.label || template.name,
        geometry: {
          x: 100,
          y: 100,
          width: parameters.width || template.baseComponent?.defaultWidth || 100,
          height: parameters.height || template.baseComponent?.defaultHeight || 50,
          rotation: 0,
          scale: 1
        },
        style: {
          fill: parameters.fillColor || '#cccccc',
          stroke: parameters.strokeColor || '#000000',
          strokeWidth: parameters.strokeWidth || 1,
          opacity: 1,
          visible: true,
          locked: false
        },
        tags: {},
        templateId: template.id,
        metadata: {
          layer: 'default',
          source: 'template',
          templateName: template.name,
          templateVersion: template.version
        }
      };

      // Apply template parameters to tags
      if (template.parameters) {
        template.parameters.forEach(param => {
          if (param.type === 'tag' && parameters[param.name]) {
            if (!newComponent.tags) {
              newComponent.tags = {};
            }
            (newComponent.tags as any)[param.name.replace('Tag', '')] = parameters[param.name];
          }
        });
      }

      // Create the component
      const createdComponent = await api.createComponent(project!.id, newComponent as any);
      
      // Update local state
      setProject(prev => prev ? {
        ...prev,
        components: [...prev.components, createdComponent as Component]
      } : null);

      message.success(`Component created from template "${template.name}"`);
    } catch (error) {
      console.error('Error applying template:', error);
      message.error('Failed to apply template');
    } finally {
      setLoadingState('apply-template', false);
    }
  };

  const setLoadingState = (key: string, loading: boolean) => {
    setLoadingStates(prev => ({ ...prev, [key]: loading }));
  };

  const loosenRateLimit = async () => {
    try {
      await api.updateRateLimitConfig({
        api: { max: 100000, windowMs: 60000 },
        upload: { max: 5000, windowMs: 60000 },
        auth: { max: 500, windowMs: 900000 }
      });
      message.success('Rate limits updated (development) – please reload backend to apply fully.');
    } catch (error) {
      message.error('Failed to update rate limits');
      console.error(error);
    }
  };

  if (loading || !project) {
    return (
      <div
        style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Spin size='large' />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Header
        style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => navigate('/')}>
            Back
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {project.name}
          </Title>
          <Button icon={<BulbOutlined />} onClick={() => setCreateComponentModalVisible(true)}>
            Create Component
          </Button>
        </Space>

        <Space>
          <Radio.Group
            value={canvasState.tool}
            onChange={e => handleCanvasStateChange({ tool: e.target.value })}
          >
            <Radio.Button value='select'>
              <SelectOutlined /> Select
            </Radio.Button>
            <Radio.Button value='pan'>
              <DragOutlined /> Pan
            </Radio.Button>
            <Radio.Button value='delete'>
              <DeleteOutlined /> Delete
            </Radio.Button>
          </Radio.Group>

          <Divider type='vertical' />

          <Tooltip title={canvasState.showGrid ? 'Hide Grid' : 'Show Grid'}>
            <Button
              icon={<BorderOutlined />}
              type={canvasState.showGrid ? 'primary' : 'default'}
              onClick={() => handleCanvasStateChange({ showGrid: !canvasState.showGrid })}
            />
          </Tooltip>

          <Tooltip title={canvasState.snapToGrid ? 'Disable Snap' : 'Enable Snap'}>
            <Button
              icon={<PushpinOutlined />}
              type={canvasState.snapToGrid ? 'primary' : 'default'}
              onClick={() => handleCanvasStateChange({ snapToGrid: !canvasState.snapToGrid })}
            />
          </Tooltip>

          <Tooltip title={canvasState.showLabels ? 'Hide Labels' : 'Show Labels'}>
            <Button
              icon={<TagsOutlined />}
              type={canvasState.showLabels ? 'primary' : 'default'}
              onClick={() => handleCanvasStateChange({ showLabels: !canvasState.showLabels })}
            />
          </Tooltip>

          <Divider type='vertical' />

          <Button
            type='primary'
            icon={<ExportOutlined />}
            onClick={() => setExportModalVisible(true)}
          >
            Export
          </Button>
          <Button
            icon={<GroupOutlined />}
            onClick={() => setShowGroupingManager(true)}
            type="default"
          >
            Component Groups
          </Button>
          <Button
                          icon={<FileOutlined />}
            onClick={() => setShowTemplateLibrary(true)}
            type="default"
          >
            Template Library
          </Button>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={250}
          collapsible
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          style={{ background: '#fff' }}
        >
          <Menu
            mode='inline'
            selectedKeys={[activeTab]}
            onClick={({ key }) => {
              setActiveTab(key);
              setRightDrawerOpen(true);
            }}
            items={[
              {
                key: 'files',
                icon: <FolderOpenOutlined />,
                label: 'Files',
              },
              {
                key: 'components',
                icon: <AppstoreOutlined />,
                label: 'Components',
              },
              {
                key: 'templates',
                icon: <AppstoreOutlined />,
                label: 'Templates',
              },
              {
                key: 'settings',
                icon: <SettingOutlined />,
                label: 'Settings',
              },
            ]}
          />
        </Sider>

        <Content style={{ position: 'relative', overflow: 'hidden' }}>
          <Canvas
            components={project.components}
            canvasState={canvasState}
            onCanvasStateChange={handleCanvasStateChange}
            onComponentSelect={handleComponentSelect}
            onComponentUpdate={handleComponentUpdate}
            onComponentCreate={handleComponentCreate}
            width={window.innerWidth - (sidebarCollapsed ? 80 : 250)}
            height={window.innerHeight - 64}
          />

          {canvasState.selectedComponents.length > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 20,
                left: 20,
                background: '#fff',
                padding: 10,
                borderRadius: 4,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}
            >
              <Space>
                <Text>{canvasState.selectedComponents.length} selected</Text>
                <Button size='small' danger onClick={handleDeleteSelected}>
                  Delete
                </Button>
              </Space>
            </div>
          )}
        </Content>
      </Layout>

      <Drawer
        title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        placement='right'
        open={rightDrawerOpen}
        onClose={() => setRightDrawerOpen(false)}
        width={350}
      >
        {activeTab === 'files' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Upload
                onChange={handleFileSelect}
                beforeUpload={() => false}
                showUploadList={false}
                multiple
                accept='.dwg,.dxf,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp,.svg,.xlsx,.xls,.csv,.json,.doc,.docx,.rtf,.txt,.zip,.rar,.7z'
              >
                <Button icon={<UploadOutlined />} style={{ width: '100%', marginBottom: 8 }}>
                  Select Files
                </Button>
              </Upload>

              {selectedFiles.length > 0 && (
                <FileValidation
                  files={selectedFiles}
                  onValidationComplete={handleValidationComplete}
                  showPreview={true}
                />
              )}

              {selectedFiles.length > 0 && (
                <Button
                  type='primary'
                  icon={loadingStates['file-upload'] ? <LoadingOutlined /> : <UploadOutlined />}
                  loading={loadingStates['file-upload']}
                  disabled={!isValidationValid}
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={handleFileUpload}
                >
                  {loadingStates['file-upload']
                    ? 'Uploading...'
                    : `Upload ${selectedFiles.length} File(s)`}
                </Button>
              )}
            </div>

            <List
              dataSource={project.files}
              renderItem={file => (
                <List.Item
                  actions={[
                    (file.category === 'image' || file.category === 'pdf') && (
                      <Tooltip title='Process with OCR'>
                        <Button
                          size='small'
                          icon={
                            loadingStates[`ocr-${file.id}`] ? <LoadingOutlined /> : <ScanOutlined />
                          }
                          loading={loadingStates[`ocr-${file.id}`]}
                          onClick={() => handleOCRProcess(file.id, file.originalName)}
                        />
                      </Tooltip>
                    ),
                    <Tooltip title='Delete File'>
                      <Button
                        size='small'
                        danger
                        icon={
                          loadingStates[`delete-file-${file.id}`] ? (
                            <LoadingOutlined />
                          ) : (
                            <DeleteOutlined />
                          )
                        }
                        loading={loadingStates[`delete-file-${file.id}`]}
                        onClick={() => handleDeleteFile(file.id, file.originalName)}
                      />
                    </Tooltip>,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<FolderOpenOutlined />}
                    title={file.originalName}
                    description={
                      <div>
                        <div>{`${file.category} • ${(file.size / 1024 / 1024).toFixed(2)} MB`}</div>
                        {file.validation?.warnings && file.validation.warnings.length > 0 && (
                          <div style={{ color: '#faad14', fontSize: '11px', marginTop: '2px' }}>
                            ⚡ {file.validation.warnings.length} warning(s)
                          </div>
                        )}
                        {file.validation?.detectedType &&
                          file.validation.detectedType !== file.category && (
                            <div style={{ color: '#1890ff', fontSize: '11px', marginTop: '2px' }}>
                              🔍 Detected as: {file.validation.detectedType}
                            </div>
                          )}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </>
        )}

        {activeTab === 'components' && (
          <List
            dataSource={project.components}
            renderItem={component => (
              <List.Item
                onClick={() => handleComponentSelect([component.id])}
                style={{ cursor: 'pointer' }}
              >
                <List.Item.Meta
                  title={component.equipmentId}
                  description={`${component.type} • ${component.label}`}
                />
              </List.Item>
            )}
          />
        )}

        {activeTab === 'settings' && (
          <div>
            <Form
              form={settingsForm}
              layout='vertical'
              onFinish={handleSettingsUpdate}
              initialValues={project?.settings}
            >
              <Divider orientation='left'>Canvas Settings</Divider>

              <Form.Item
                name='gridSize'
                label='Grid Size'
                rules={[{ required: true, type: 'number', min: 5, max: 100 }]}
              >
                <Input type='number' suffix='px' />
              </Form.Item>

              <Form.Item name='snapToGrid' valuePropName='checked'>
                <Space>
                  <input type='checkbox' />
                  <Text>Snap to Grid</Text>
                </Space>
              </Form.Item>

              <Form.Item name='showLabels' valuePropName='checked'>
                <Space>
                  <input type='checkbox' />
                  <Text>Show Component Labels</Text>
                </Space>
              </Form.Item>

              <Form.Item name='units' label='Measurement Units' rules={[{ required: true }]}>
                <Select>
                  <Select.Option value='meters'>Meters</Select.Option>
                  <Select.Option value='feet'>Feet</Select.Option>
                  <Select.Option value='inches'>Inches</Select.Option>
                  <Select.Option value='pixels'>Pixels</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item>
                <Button
                  type='primary'
                  htmlType='submit'
                  loading={loadingStates['update-settings']}
                  icon={loadingStates['update-settings'] ? <LoadingOutlined /> : undefined}
                >
                  {loadingStates['update-settings'] ? 'Updating...' : 'Update Canvas Settings'}
                </Button>
              </Form.Item>
            </Form>

            <Divider orientation='left'>OCR Configuration</Divider>

            <Space direction='vertical' style={{ width: '100%' }}>
              <Form.Item label='OCR Mode'>
                <Select defaultValue='mock' style={{ width: '100%' }}>
                  <Select.Option value='mock'>Mock OCR (for testing)</Select.Option>
                  <Select.Option value='paddleocr'>PaddleOCR</Select.Option>
                  <Select.Option value='tesseract'>Tesseract</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label='OCR Language'>
                <Select defaultValue='en' style={{ width: '100%' }}>
                  <Select.Option value='en'>English</Select.Option>
                  <Select.Option value='es'>Spanish</Select.Option>
                  <Select.Option value='fr'>French</Select.Option>
                  <Select.Option value='de'>German</Select.Option>
                </Select>
              </Form.Item>

              <Button type='default' style={{ width: '100%' }}>
                Update OCR Settings
              </Button>
            </Space>

            <Divider orientation='left'>AI Integration</Divider>

            <Space direction='vertical' style={{ width: '100%' }}>
              {aiStatus && (
                <div>
                  <Text strong>AI Status: </Text>
                  <Text type={aiStatus.mockMode ? 'warning' : 'success'}>
                    {aiStatus.mockMode ? 'Mock Mode' : 'Active'}
                  </Text>
                </div>
              )}

              <Form.Item label='AI Provider'>
                <Select
                  defaultValue={aiStatus?.defaultProvider || 'openai'}
                  style={{ width: '100%' }}
                >
                  <Select.Option value='openai'>OpenAI GPT</Select.Option>
                  <Select.Option value='huggingface'>Hugging Face</Select.Option>
                  <Select.Option value='claude'>Anthropic Claude</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item label='API Key'>
                <Input.Password
                  placeholder='Enter API key for selected provider'
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Space>
                <Button
                  type='default'
                  icon={loadingStates['ai-suggestions'] ? <LoadingOutlined /> : <RobotOutlined />}
                  loading={loadingStates['ai-suggestions']}
                  onClick={handleGetAISuggestions}
                >
                  {loadingStates['ai-suggestions']
                    ? 'Getting Suggestions...'
                    : 'Get AI Suggestions'}
                </Button>
                <Button type='default'>Update AI Settings</Button>
              </Space>
            </Space>

            <Divider orientation='left'>Mock Examples</Divider>

            <Space direction='vertical' style={{ width: '100%' }}>
              <Text type='secondary'>Generate example components for testing:</Text>

              <Space wrap>
                <Button
                  icon={
                    loadingStates[`generate-examples-conveyor`] ? (
                      <LoadingOutlined />
                    ) : (
                      <ExperimentOutlined />
                    )
                  }
                  loading={loadingStates[`generate-examples-conveyor`]}
                  onClick={() => handleGenerateExamples('conveyor', 3)}
                >
                  {loadingStates[`generate-examples-conveyor`]
                    ? 'Generating...'
                    : 'Conveyor Systems'}
                </Button>
                <Button
                  icon={
                    loadingStates[`generate-examples-motor`] ? (
                      <LoadingOutlined />
                    ) : (
                      <ExperimentOutlined />
                    )
                  }
                  loading={loadingStates[`generate-examples-motor`]}
                  onClick={() => handleGenerateExamples('motor', 3)}
                >
                  {loadingStates[`generate-examples-motor`] ? 'Generating...' : 'Motors & Pumps'}
                </Button>
                <Button
                  icon={
                    loadingStates[`generate-examples-sensor`] ? (
                      <LoadingOutlined />
                    ) : (
                      <ExperimentOutlined />
                    )
                  }
                  loading={loadingStates[`generate-examples-sensor`]}
                  onClick={() => handleGenerateExamples('sensor', 3)}
                >
                  {loadingStates[`generate-examples-sensor`] ? 'Generating...' : 'Sensors'}
                </Button>
              </Space>

              <Button
                type='primary'
                icon={
                  loadingStates[`generate-examples-mixed`] ? (
                    <LoadingOutlined />
                  ) : (
                    <ExperimentOutlined />
                  )
                }
                loading={loadingStates[`generate-examples-mixed`]}
                onClick={() => handleGenerateExamples('mixed', 15)}
                style={{ width: '100%', height: '60px', fontSize: '16px', fontWeight: 'bold' }}
              >
                {loadingStates[`generate-examples-mixed`]
                  ? 'Generating Professional Layout...'
                  : '🏭 Generate Complete Industrial System'}
              </Button>
              
              <Text type='secondary' style={{ fontSize: '12px', textAlign: 'center', display: 'block', marginTop: '8px' }}>
                Creates a complete professional SCADA layout like airport baggage systems or manufacturing lines with proper alignment and all conveyor types
              </Text>
            </Space>
            <Divider orientation='left'>Server Utilities</Divider>
            <Button type='default' onClick={loosenRateLimit}>Loosen Rate Limits (dev)</Button>
          </div>
        )}
      </Drawer>

      <Modal
        title='Export Project'
        open={exportModalVisible}
        onCancel={() => {
          setExportModalVisible(false);
          exportForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={exportForm}
          layout='vertical'
          onFinish={handleExport}
          initialValues={{
            includeSVG: true,
            includePerspective: true,
            includeVision: true,
            includeTemplates: true,
            includeMetadata: true,
          }}
        >
          <Form.Item name='includeSVG' valuePropName='checked'>
            <Space>
              <input type='checkbox' />
              <Text>Include SVG Layout</Text>
            </Space>
          </Form.Item>

          <Form.Item name='includePerspective' valuePropName='checked'>
            <Space>
              <input type='checkbox' />
              <Text>Include Perspective Views</Text>
            </Space>
          </Form.Item>

          <Form.Item name='includeVision' valuePropName='checked'>
            <Space>
              <input type='checkbox' />
              <Text>Include Vision Windows</Text>
            </Space>
          </Form.Item>

          <Form.Item name='includeTemplates' valuePropName='checked'>
            <Space>
              <input type='checkbox' />
              <Text>Include Templates</Text>
            </Space>
          </Form.Item>

          <Form.Item name='includeMetadata' valuePropName='checked'>
            <Space>
              <input type='checkbox' />
              <Text>Include Metadata</Text>
            </Space>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type='primary' htmlType='submit'>
                Export
              </Button>
              <Button
                onClick={() => {
                  setExportModalVisible(false);
                  exportForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title='Create Custom Component'
        open={createComponentModalVisible}
        onCancel={() => {
          setCreateComponentModalVisible(false);
          createComponentForm.resetFields();
        }}
        footer={null}
      >
        <Form form={createComponentForm} layout='vertical' onFinish={handleCreateCustomComponent}>
          <Form.Item
            name='description'
            label='Component Description'
            rules={[
              { required: true, message: 'Please describe the component you want to create' },
            ]}
          >
            <Input.TextArea
              placeholder="Describe the component you want to create (e.g., 'A conveyor belt 200x30 called Main Belt', 'A motor pump for water system', 'A sensor detector for baggage')"
              rows={4}
            />
          </Form.Item>

          <Form.Item name='useAI' valuePropName='checked' initialValue={false}>
            <Space>
              <input type='checkbox' />
              <Text>Use AI to generate component (requires AI provider configuration)</Text>
            </Space>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type='primary'
                htmlType='submit'
                loading={loadingStates['create-component']}
                icon={loadingStates['create-component'] ? <LoadingOutlined /> : undefined}
              >
                {loadingStates['create-component'] ? 'Creating...' : 'Create Component'}
              </Button>
              <Button
                onClick={() => {
                  setCreateComponentModalVisible(false);
                  createComponentForm.resetFields();
                }}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Component Grouping Manager */}
      {project && (
        <ComponentGroupingManager
          projectId={project.id}
          components={project.components}
          onGroupsUpdate={handleGroupsUpdate}
          onTemplatesUpdate={handleTemplatesUpdate}
          visible={showGroupingManager}
          onClose={() => setShowGroupingManager(false)}
        />
      )}

      {/* Template Library */}
      {project && (
        <TemplateLibrary
          projectId={project.id}
          templates={project.templates}
          onTemplateApply={handleTemplateApply}
          onTemplateUpdate={handleTemplatesUpdate}
          visible={showTemplateLibrary}
          onClose={() => setShowTemplateLibrary(false)}
        />
      )}
    </Layout>
  );
};

export default ProjectEditor;
