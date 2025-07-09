import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layout,
  Menu,
  Button,
  Space,
  Drawer,
  Tabs,
  List,
  Upload,
  message,
  Spin,
  Divider,
  Typography,
  Tooltip,
  Modal,
  Form,
  Input,
  Select,
  Radio,
} from 'antd';
import {
  ArrowLeftOutlined,
  UploadOutlined,
  FolderOpenOutlined,
  AppstoreOutlined,
  SettingOutlined,
  ExportOutlined,
  SelectOutlined,
  DragOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  BorderOutlined,
  PushpinOutlined,
  TagsOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { Project, Component, CanvasState, FileInfo, ExportOptions } from '../types';
import Canvas from '../components/Canvas/Canvas';
import api from '../services/api';
import socketService from '../services/socket';
import { v4 as uuidv4 } from 'uuid';

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
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    pan: { x: 0, y: 0 },
    selectedComponents: [],
    hoveredComponent: undefined,
    tool: 'select',
    showGrid: true,
    snapToGrid: true,
    showLabels: true,
  });

  useEffect(() => {
    if (projectId) {
      loadProject();
      socketService.joinProject(projectId);
      setupSocketListeners();
    }

    return () => {
      // Cleanup socket listeners
    };
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await api.getProject(projectId!);
      setProject(data);
    } catch (error) {
      message.error('Failed to load project');
      console.error(error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const setupSocketListeners = () => {
    socketService.on('component-created', (component) => {
      setProject(prev => prev ? {
        ...prev,
        components: [...prev.components, component]
      } : null);
    });

    socketService.on('component-updated', (component) => {
      setProject(prev => prev ? {
        ...prev,
        components: prev.components.map(c => c.id === component.id ? component : c)
      } : null);
    });

    socketService.on('component-deleted', (componentId) => {
      setProject(prev => prev ? {
        ...prev,
        components: prev.components.filter(c => c.id !== componentId)
      } : null);
    });

    socketService.on('files-uploaded', (files) => {
      setProject(prev => prev ? {
        ...prev,
        files: [...prev.files, ...files]
      } : null);
    });
  };

  const handleCanvasStateChange = (updates: Partial<CanvasState>) => {
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

  const handleFileUpload = async (file: File) => {
    try {
      const files = await api.uploadFiles(projectId!, [file]);
      message.success(`${file.name} uploaded successfully`);
      return false; // Prevent default upload behavior
    } catch (error) {
      message.error('Failed to upload file');
      console.error(error);
      return false;
    }
  };

  const handleOCRProcess = async (fileId: string) => {
    try {
      await api.processOCR(projectId!, fileId);
      message.success('OCR processing started');
    } catch (error) {
      message.error('Failed to start OCR processing');
      console.error(error);
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
    
    try {
      await Promise.all(
        canvasState.selectedComponents.map(id => 
          api.deleteComponent(projectId!, id)
        )
      );
      setCanvasState(prev => ({ ...prev, selectedComponents: [] }));
      message.success('Components deleted successfully');
    } catch (error) {
      message.error('Failed to delete components');
      console.error(error);
    }
  };

  if (loading || !project) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
            Back
          </Button>
          <Title level={4} style={{ margin: 0 }}>{project.name}</Title>
        </Space>
        
        <Space>
          <Radio.Group 
            value={canvasState.tool} 
            onChange={(e) => handleCanvasStateChange({ tool: e.target.value })}
          >
            <Radio.Button value="select"><SelectOutlined /> Select</Radio.Button>
            <Radio.Button value="pan"><DragOutlined /> Pan</Radio.Button>
            <Radio.Button value="delete"><DeleteOutlined /> Delete</Radio.Button>
          </Radio.Group>
          
          <Divider type="vertical" />
          
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
          
          <Divider type="vertical" />
          
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={() => setExportModalVisible(true)}
          >
            Export
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
            mode="inline"
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
            <div style={{ position: 'absolute', bottom: 20, left: 20, background: '#fff', padding: 10, borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <Space>
                <Text>{canvasState.selectedComponents.length} selected</Text>
                <Button size="small" danger onClick={handleDeleteSelected}>
                  Delete
                </Button>
              </Space>
            </div>
          )}
        </Content>
      </Layout>
      
      <Drawer
        title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
        placement="right"
        open={rightDrawerOpen}
        onClose={() => setRightDrawerOpen(false)}
        width={350}
      >
        {activeTab === 'files' && (
          <>
            <Upload
              beforeUpload={handleFileUpload}
              showUploadList={false}
              multiple
              accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.xlsx,.xls,.csv"
            >
              <Button icon={<UploadOutlined />} style={{ width: '100%', marginBottom: 16 }}>
                Upload Files
              </Button>
            </Upload>
            
            <List
              dataSource={project.files}
              renderItem={(file) => (
                <List.Item
                  actions={[
                    file.category === 'image' || file.category === 'pdf' ? (
                      <Tooltip title="Process with OCR">
                        <Button
                          size="small"
                          icon={<ScanOutlined />}
                          onClick={() => handleOCRProcess(file.id)}
                        />
                      </Tooltip>
                    ) : null,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<FolderOpenOutlined />}
                    title={file.originalName}
                    description={`${file.category} • ${(file.size / 1024 / 1024).toFixed(2)} MB`}
                  />
                </List.Item>
              )}
            />
          </>
        )}
        
        {activeTab === 'components' && (
          <List
            dataSource={project.components}
            renderItem={(component) => (
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
      </Drawer>
      
      <Modal
        title="Export Project"
        open={exportModalVisible}
        onCancel={() => {
          setExportModalVisible(false);
          exportForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={exportForm}
          layout="vertical"
          onFinish={handleExport}
          initialValues={{
            includeSVG: true,
            includePerspective: true,
            includeVision: true,
            includeTemplates: true,
            includeMetadata: true,
          }}
        >
          <Form.Item name="includeSVG" valuePropName="checked">
            <Space>
              <input type="checkbox" />
              <Text>Include SVG Layout</Text>
            </Space>
          </Form.Item>
          
          <Form.Item name="includePerspective" valuePropName="checked">
            <Space>
              <input type="checkbox" />
              <Text>Include Perspective Views</Text>
            </Space>
          </Form.Item>
          
          <Form.Item name="includeVision" valuePropName="checked">
            <Space>
              <input type="checkbox" />
              <Text>Include Vision Windows</Text>
            </Space>
          </Form.Item>
          
          <Form.Item name="includeTemplates" valuePropName="checked">
            <Space>
              <input type="checkbox" />
              <Text>Include Templates</Text>
            </Space>
          </Form.Item>
          
          <Form.Item name="includeMetadata" valuePropName="checked">
            <Space>
              <input type="checkbox" />
              <Text>Include Metadata</Text>
            </Space>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Export
              </Button>
              <Button onClick={() => {
                setExportModalVisible(false);
                exportForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default ProjectEditor;