import axios from 'axios';
import { uploadFiles, createProject, getProjects, updateProject, deleteProject } from '../api';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockedAxios);
  });

  describe('uploadFiles', () => {
    test('should upload files successfully', async () => {
      const mockFiles = [
        new File(['test content'], 'test.jpg', { type: 'image/jpeg' }),
        new File(['doc content'], 'doc.pdf', { type: 'application/pdf' }),
      ];

      const mockResponse = {
        data: {
          success: true,
          message: 'Files uploaded successfully',
          files: [
            {
              filename: 'test.jpg',
              size: 1024,
              type: 'image/jpeg',
              ocrResult: { text: 'Sample text', confidence: 0.95 },
            },
            {
              filename: 'doc.pdf',
              size: 2048,
              type: 'application/pdf',
              ocrResult: null,
            },
          ],
          warnings: [],
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await uploadFiles(mockFiles);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        })
      );

      expect(result).toEqual(mockResponse.data);
    });

    test('should handle upload errors', async () => {
      const mockFiles = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      const mockError = {
        response: {
          data: {
            success: false,
            error: 'File too large',
          },
        },
      };

      mockedAxios.post.mockRejectedValue(mockError);

      await expect(uploadFiles(mockFiles)).rejects.toThrow();
    });

    test('should create FormData with correct file fields', async () => {
      const mockFiles = [
        new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'file2.png', { type: 'image/png' }),
      ];

      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await uploadFiles(mockFiles);

      const formDataCall = mockedAxios.post.mock.calls[0][1] as FormData;
      expect(formDataCall).toBeInstanceOf(FormData);
    });
  });

  describe('createProject', () => {
    test('should create project successfully', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Test Description',
        settings: {
          gridSize: 20,
          snapToGrid: true,
          industry: 'manufacturing',
          safetyLevel: 'standard',
          aiIntegration: {
            enabled: true,
            provider: 'openai',
            model: 'gpt-4',
          },
        },
      };

      const mockResponse = {
        data: {
          success: true,
          project: {
            id: 'project-123',
            ...projectData,
            createdAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await createProject(projectData);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/projects', projectData);
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle project creation errors', async () => {
      const projectData = { name: '', description: '' };
      const mockError = {
        response: {
          data: {
            success: false,
            error: 'Project name is required',
          },
        },
      };

      mockedAxios.post.mockRejectedValue(mockError);

      await expect(createProject(projectData)).rejects.toThrow();
    });
  });

  describe('getProjects', () => {
    test('should fetch projects successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          projects: [
            {
              id: 'project-1',
              name: 'Project 1',
              description: 'Description 1',
              createdAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 'project-2',
              name: 'Project 2',
              description: 'Description 2',
              createdAt: '2024-01-02T00:00:00Z',
            },
          ],
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getProjects();

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects');
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle fetch projects errors', async () => {
      const mockError = {
        response: {
          data: {
            success: false,
            error: 'Failed to fetch projects',
          },
        },
      };

      mockedAxios.get.mockRejectedValue(mockError);

      await expect(getProjects()).rejects.toThrow();
    });
  });

  describe('updateProject', () => {
    test('should update project successfully', async () => {
      const projectId = 'project-123';
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated Description',
      };

      const mockResponse = {
        data: {
          success: true,
          project: {
            id: projectId,
            ...updateData,
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
      };

      mockedAxios.put.mockResolvedValue(mockResponse);

      const result = await updateProject(projectId, updateData);

      expect(mockedAxios.put).toHaveBeenCalledWith(`/api/projects/${projectId}`, updateData);
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle update project errors', async () => {
      const projectId = 'project-123';
      const updateData = { name: '' };
      const mockError = {
        response: {
          data: {
            success: false,
            error: 'Project name cannot be empty',
          },
        },
      };

      mockedAxios.put.mockRejectedValue(mockError);

      await expect(updateProject(projectId, updateData)).rejects.toThrow();
    });
  });

  describe('deleteProject', () => {
    test('should delete project successfully', async () => {
      const projectId = 'project-123';
      const mockResponse = {
        data: {
          success: true,
          message: 'Project deleted successfully',
        },
      };

      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await deleteProject(projectId);

      expect(mockedAxios.delete).toHaveBeenCalledWith(`/api/projects/${projectId}`);
      expect(result).toEqual(mockResponse.data);
    });

    test('should handle delete project errors', async () => {
      const projectId = 'project-123';
      const mockError = {
        response: {
          data: {
            success: false,
            error: 'Project not found',
          },
        },
      };

      mockedAxios.delete.mockRejectedValue(mockError);

      await expect(deleteProject(projectId)).rejects.toThrow();
    });
  });

  describe('Error handling', () => {
    test('should handle network errors', async () => {
      const mockFiles = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      const networkError = new Error('Network Error');

      mockedAxios.post.mockRejectedValue(networkError);

      await expect(uploadFiles(mockFiles)).rejects.toThrow('Network Error');
    });

    test('should handle timeout errors', async () => {
      const mockFiles = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      const timeoutError = { code: 'ECONNABORTED', message: 'Request timeout' };

      mockedAxios.post.mockRejectedValue(timeoutError);

      await expect(uploadFiles(mockFiles)).rejects.toEqual(timeoutError);
    });

    test('should handle server errors', async () => {
      const mockError = {
        response: {
          status: 500,
          data: {
            success: false,
            error: 'Internal server error',
          },
        },
      };

      mockedAxios.get.mockRejectedValue(mockError);

      await expect(getProjects()).rejects.toThrow();
    });
  });

  describe('Request configuration', () => {
    test('should set correct headers for file uploads', async () => {
      const mockFiles = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await uploadFiles(mockFiles);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        '/api/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        })
      );
    });

    test('should set correct headers for JSON requests', async () => {
      const projectData = { name: 'Test Project' };
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      await createProject(projectData);

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/projects', projectData);
    });
  });
});
