import React, { useState, useEffect } from 'react';
import {
  Card,
  Input,
  Select,
  Row,
  Col,
  Button,
  Tag,
  Space,
  Tooltip,
  Modal,
  Form,
  Typography,
  Badge,
  Divider,
  Empty,
  Collapse,
  List,
  Avatar,
  Spin,
  message,
  Tabs,
  Popconfirm,
  Upload,
  Alert
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  AppstoreOutlined,
  FileOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  DownloadOutlined,
  UploadOutlined,
  CopyOutlined,
  StarOutlined,
  StarFilled,
  TagsOutlined,
  CalendarOutlined,
  UserOutlined,
  BulbOutlined,
  GroupOutlined,
  BuildOutlined,
  ExportOutlined,
  ImportOutlined
} from '@ant-design/icons';
import { Template, Component } from '../types';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TabPane } = Tabs;
const { Option } = Select;
const { Search } = Input;

interface TemplateLibraryProps {
  projectId: string;
  templates: Template[];
  onTemplateApply: (template: Template, parameters: any) => void;
  onTemplateUpdate: (templates: Template[]) => void;
  visible: boolean;
  onClose: () => void;
}

interface TemplateCategory {
  name: string;
  count: number;
  templates: Template[];
  color: string;
}

const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  projectId,
  templates,
  onTemplateApply,
  onTemplateUpdate,
  visible,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [activeTab, setActiveTab] = useState('library');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [applyForm] = Form.useForm();

  // Get template categories
  const getTemplateCategories = (): TemplateCategory[] => {
    const categoryMap: Record<string, TemplateCategory> = {};
    const categoryColors: Record<string, string> = {
      conveyor: '#52c41a',
      equipment: '#1890ff',
      sensors: '#faad14',
      safety: '#ff4d4f',
      packaging: '#722ed1',
      robotics: '#13c2c2',
      custom: '#8c8c8c'
    };

    templates.forEach(template => {
      const category = template.category || 'custom';
      if (!categoryMap[category]) {
        categoryMap[category] = {
          name: category,
          count: 0,
          templates: [],
          color: categoryColors[category] || '#8c8c8c'
        };
      }
      categoryMap[category].count++;
      categoryMap[category].templates.push(template);
    });

    return Object.values(categoryMap).sort((a, b) => b.count - a.count);
  };

  // Filter templates based on search and category
  const getFilteredTemplates = (): Template[] => {
    let filtered = templates;

    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    return filtered;
  };

  // Toggle favorite
  const toggleFavorite = (templateId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId];
      
      // Save to localStorage
      localStorage.setItem(`template-favorites-${projectId}`, JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem(`template-favorites-${projectId}`);
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, [projectId]);

  // Apply template
  const handleApplyTemplate = async (values: any) => {
    if (!selectedTemplate) return;

    try {
      setLoading(true);
      await onTemplateApply(selectedTemplate, values);
      message.success(`Template "${selectedTemplate.name}" applied successfully`);
      setShowApplyModal(false);
      setSelectedTemplate(null);
      applyForm.resetFields();
    } catch (error) {
      console.error('Error applying template:', error);
      message.error('Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      await api.deleteTemplate(projectId, templateId);
      message.success('Template deleted successfully');
      onTemplateUpdate(templates.filter(t => t.id !== templateId));
    } catch (error) {
      console.error('Error deleting template:', error);
      message.error('Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  // Export template
  const handleExportTemplate = async (template: Template) => {
    try {
      const templateData = {
        ...template,
        exportedAt: new Date().toISOString(),
        version: template.version || '1.0.0'
      };
      
      const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, '_')}_template.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      message.success('Template exported successfully');
    } catch (error) {
      console.error('Error exporting template:', error);
      message.error('Failed to export template');
    }
  };

  // Render template card
  const renderTemplateCard = (template: Template) => (
    <Card
      key={template.id}
      size="small"
      className="template-card"
      style={{ marginBottom: 16 }}
      actions={[
        <Tooltip title="View Details">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedTemplate(template);
              setShowTemplateModal(true);
            }}
          />
        </Tooltip>,
        <Tooltip title="Apply Template">
          <Button
            size="small"
            icon={<AppstoreOutlined />}
            type="primary"
            onClick={() => {
              setSelectedTemplate(template);
              setShowApplyModal(true);
            }}
          />
        </Tooltip>,
        <Tooltip title="Export Template">
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleExportTemplate(template)}
          />
        </Tooltip>,
        <Tooltip title={favorites.includes(template.id) ? 'Remove from Favorites' : 'Add to Favorites'}>
          <Button
            size="small"
            icon={favorites.includes(template.id) ? <StarFilled /> : <StarOutlined />}
            onClick={() => toggleFavorite(template.id)}
          />
        </Tooltip>
      ]}
      extra={
        <Space>
          <Tag color={getTemplateCategories().find(c => c.name === template.category)?.color}>
            {template.category}
          </Tag>
          <Popconfirm
            title="Delete this template?"
            onConfirm={() => handleDeleteTemplate(template.id)}
          >
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      }
    >
      <Card.Meta
                        avatar={<Avatar icon={<FileOutlined />} />}
        title={
          <Space>
            <Text strong>{template.name}</Text>
            {template.metadata?.sourceGroup && (
              <Tag color="blue">Group-Generated</Tag>
            )}
          </Space>
        }
        description={
          <div>
            <Paragraph ellipsis={{ rows: 2, expandable: true }}>
              {template.description}
            </Paragraph>
            <div style={{ marginTop: 8 }}>
              <Space size="small">
                <Tag icon={<BuildOutlined />} color="processing">
                  {template.baseComponent?.type || 'Unknown'}
                </Tag>
                <Tag icon={<TagsOutlined />}>
                  {template.parameters?.length || 0} params
                </Tag>
                <Tag icon={<CalendarOutlined />}>
                  {template.version || '1.0.0'}
                </Tag>
              </Space>
            </div>
          </div>
        }
      />
    </Card>
  );

  // Render library tab
  const renderLibraryTab = () => {
    const categories = getTemplateCategories();
    const filteredTemplates = getFilteredTemplates();

    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Search
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col span={12}>
              <Select
                placeholder="Filter by category"
                value={selectedCategory}
                onChange={setSelectedCategory}
                style={{ width: '100%' }}
              >
                <Option value="all">All Categories</Option>
                {categories.map(category => (
                  <Option key={category.name} value={category.name}>
                    {category.name.toUpperCase()} ({category.count})
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        </div>

        {filteredTemplates.length === 0 ? (
          <Empty description="No templates found" />
        ) : (
          <Row gutter={[16, 16]}>
            {filteredTemplates.map(template => (
              <Col key={template.id} span={24}>
                {renderTemplateCard(template)}
              </Col>
            ))}
          </Row>
        )}
      </div>
    );
  };

  // Render categories tab
  const renderCategoriesTab = () => {
    const categories = getTemplateCategories();

    return (
      <div>
        <Row gutter={[16, 16]}>
          {categories.map(category => (
            <Col key={category.name} span={12}>
              <Card
                title={
                  <Space>
                    <Tag color={category.color}>{category.name.toUpperCase()}</Tag>
                    <Badge count={category.count} />
                  </Space>
                }
                extra={
                  <Button
                    size="small"
                    onClick={() => {
                      setSelectedCategory(category.name);
                      setActiveTab('library');
                    }}
                  >
                    View All
                  </Button>
                }
              >
                <List
                  size="small"
                  dataSource={category.templates.slice(0, 3)}
                  renderItem={(template) => (
                    <List.Item
                      actions={[
                        <Button
                          size="small"
                          icon={<AppstoreOutlined />}
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowApplyModal(true);
                          }}
                        />
                      ]}
                    >
                      <List.Item.Meta
                        title={template.name}
                        description={template.description}
                      />
                    </List.Item>
                  )}
                />
                {category.templates.length > 3 && (
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <Button
                      size="small"
                      type="link"
                      onClick={() => {
                        setSelectedCategory(category.name);
                        setActiveTab('library');
                      }}
                    >
                      View {category.templates.length - 3} more...
                    </Button>
                  </div>
                )}
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  // Render favorites tab
  const renderFavoritesTab = () => {
    const favoriteTemplates = templates.filter(t => favorites.includes(t.id));

    return (
      <div>
        {favoriteTemplates.length === 0 ? (
          <Empty description="No favorite templates" />
        ) : (
          <Row gutter={[16, 16]}>
            {favoriteTemplates.map(template => (
              <Col key={template.id} span={24}>
                {renderTemplateCard(template)}
              </Col>
            ))}
          </Row>
        )}
      </div>
    );
  };

  return (
    <Modal
      title="Template Library"
      visible={visible}
      onCancel={onClose}
      width={1000}
      footer={null}
      destroyOnClose
    >
      <Spin spinning={loading}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={
            <Space>
                              <FileOutlined />
              Library
              <Badge count={templates.length} />
            </Space>
          } key="library">
            {renderLibraryTab()}
          </TabPane>
          <TabPane tab={
            <Space>
              <GroupOutlined />
              Categories
              <Badge count={getTemplateCategories().length} />
            </Space>
          } key="categories">
            {renderCategoriesTab()}
          </TabPane>
          <TabPane tab={
            <Space>
              <StarOutlined />
              Favorites
              <Badge count={favorites.length} />
            </Space>
          } key="favorites">
            {renderFavoritesTab()}
          </TabPane>
        </Tabs>
      </Spin>

      {/* Template Details Modal */}
      <Modal
        title={selectedTemplate ? `Template: ${selectedTemplate.name}` : 'Template Details'}
        visible={showTemplateModal}
        onCancel={() => {
          setShowTemplateModal(false);
          setSelectedTemplate(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}>
            Close
          </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={() => {
              setShowTemplateModal(false);
              setShowApplyModal(true);
            }}
          >
            Apply Template
          </Button>
        ]}
      >
        {selectedTemplate && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Category: </Text>
                  <Tag color={getTemplateCategories().find(c => c.name === selectedTemplate.category)?.color}>
                    {selectedTemplate.category}
                  </Tag>
                </Col>
                <Col span={12}>
                  <Text strong>Type: </Text>
                  <Tag>{selectedTemplate.baseComponent?.type}</Tag>
                </Col>
                <Col span={12}>
                  <Text strong>Version: </Text>
                  <Text code>{selectedTemplate.version}</Text>
                </Col>
                <Col span={12}>
                  <Text strong>Parameters: </Text>
                  <Badge count={selectedTemplate.parameters?.length || 0} />
                </Col>
              </Row>
            </Card>

            <Card title="Description" size="small" style={{ marginBottom: 16 }}>
              <Paragraph>{selectedTemplate.description}</Paragraph>
            </Card>

            {selectedTemplate.parameters && selectedTemplate.parameters.length > 0 && (
              <Card title="Parameters" size="small">
                <List
                  size="small"
                  dataSource={selectedTemplate.parameters}
                  renderItem={(param) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{param.name}</Text>
                            <Tag color={param.required ? 'red' : 'blue'}>
                              {param.required ? 'Required' : 'Optional'}
                            </Tag>
                            <Tag>{param.type}</Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <Text>{param.description}</Text>
                            {param.defaultValue && (
                              <div>
                                <Text type="secondary">Default: </Text>
                                <Text code>{param.defaultValue}</Text>
                              </div>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* Apply Template Modal */}
      <Modal
        title={selectedTemplate ? `Apply Template: ${selectedTemplate.name}` : 'Apply Template'}
        visible={showApplyModal}
        onCancel={() => {
          setShowApplyModal(false);
          setSelectedTemplate(null);
          applyForm.resetFields();
        }}
        onOk={() => applyForm.submit()}
        confirmLoading={loading}
      >
        {selectedTemplate && (
          <Form form={applyForm} onFinish={handleApplyTemplate} layout="vertical">
            {selectedTemplate.parameters?.map(param => (
              <Form.Item
                key={param.name}
                name={param.name}
                label={
                  <Space>
                    <Text>{param.name}</Text>
                    <Tag color={param.required ? 'red' : 'blue'}>
                      {param.required ? 'Required' : 'Optional'}
                    </Tag>
                    <Tag>{param.type}</Tag>
                  </Space>
                }
                rules={param.required ? [{ required: true, message: `Please enter ${param.name}` }] : []}
                help={param.description}
                initialValue={param.defaultValue}
              >
                {param.type === 'boolean' ? (
                  <Select>
                    <Option value={true}>True</Option>
                    <Option value={false}>False</Option>
                  </Select>
                ) : param.type === 'color' ? (
                  <Input type="color" />
                ) : param.type === 'number' ? (
                  <Input type="number" />
                ) : (
                  <Input />
                )}
              </Form.Item>
            ))}
          </Form>
        )}
      </Modal>
    </Modal>
  );
};

export default TemplateLibrary; 