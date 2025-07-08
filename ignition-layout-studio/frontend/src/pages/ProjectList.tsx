import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layout,
  Card,
  Button,
  List,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  message,
  Spin,
  Empty,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  CopyOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Project } from '../types';
import api from '../services/api';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const ProjectList: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await api.getProjects();
      setProjects(data);
    } catch (error) {
      message.error('Failed to load projects');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (values: { name: string; description?: string }) => {
    try {
      const newProject = await api.createProject(values);
      message.success('Project created successfully');
      setCreateModalVisible(false);
      form.resetFields();
      navigate(`/project/${newProject.id}`);
    } catch (error) {
      message.error('Failed to create project');
      console.error(error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await api.deleteProject(projectId);
      message.success('Project deleted successfully');
      loadProjects();
    } catch (error) {
      message.error('Failed to delete project');
      console.error(error);
    }
  };

  const handleCloneProject = async (projectId: string) => {
    try {
      const clonedProject = await api.cloneProject(projectId);
      message.success('Project cloned successfully');
      loadProjects();
    } catch (error) {
      message.error('Failed to clone project');
      console.error(error);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title level={2} style={{ margin: 0 }}>Ignition Layout Studio</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          New Project
        </Button>
      </Header>
      <Content style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: 50 }}>
            <Spin size="large" />
          </div>
        ) : projects.length === 0 ? (
          <Empty
            description="No projects yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create Your First Project
            </Button>
          </Empty>
        ) : (
          <List
            grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 6 }}
            dataSource={projects}
            renderItem={(project) => (
              <List.Item>
                <Card
                  hoverable
                  onClick={() => navigate(`/project/${project.id}`)}
                  actions={[
                    <EditOutlined key="edit" onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/project/${project.id}`);
                    }} />,
                    <CopyOutlined key="clone" onClick={(e) => {
                      e.stopPropagation();
                      handleCloneProject(project.id);
                    }} />,
                    <Popconfirm
                      title="Delete Project"
                      description="Are you sure you want to delete this project?"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="Yes"
                      cancelText="No"
                    >
                      <DeleteOutlined
                        key="delete"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: '#ff4d4f' }}
                      />
                    </Popconfirm>,
                  ]}
                >
                  <Card.Meta
                    avatar={<FolderOpenOutlined style={{ fontSize: 24 }} />}
                    title={project.name}
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary">{project.description || 'No description'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Created: {new Date(project.createdAt).toLocaleDateString()}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Updated: {new Date(project.updatedAt).toLocaleDateString()}
                        </Text>
                      </Space>
                    }
                  />
                </Card>
              </List.Item>
            )}
          />
        )}
      </Content>

      <Modal
        title="Create New Project"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateProject}
        >
          <Form.Item
            name="name"
            label="Project Name"
            rules={[{ required: true, message: 'Please enter project name' }]}
          >
            <Input placeholder="Enter project name" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea
              placeholder="Enter project description (optional)"
              rows={3}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create
              </Button>
              <Button onClick={() => {
                setCreateModalVisible(false);
                form.resetFields();
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

export default ProjectList;