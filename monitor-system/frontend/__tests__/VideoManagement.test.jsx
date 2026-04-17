/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import axios from 'axios';
import VideoManagement from '../src/pages/VideoManagement';

// Mock axios
jest.mock('axios');

// Mock antd 组件
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');
  return {
    ...actual,
    Table: ({ dataSource, columns }) => (
      <table data-testid="video-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataSource && dataSource.map((row, rowIndex) => (
            <tr key={rowIndex} data-testid={`video-row-${rowIndex}`}>
              {columns.map((col, colIndex) => (
                <td key={colIndex}>
                  {col.render ? col.render(row[col.dataIndex], row, rowIndex) : row[col.dataIndex]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    ),
    Modal: ({ children, visible, onCancel }) => 
      visible ? <div data-testid="modal">{children}<button onClick={onCancel}>Close</button></div> : null,
  };
});

// Mock antd message
jest.mock('antd/lib/message', () => ({
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
}));

describe('VideoManagement 组件测试', () => {
  const mockVideos = [
    {
      id: 1,
      cameraId: 1,
      filename: '20260410_121433.mp4',
      fileUrl: '/videos/CAM_001/20260410_121433.mp4',
      size: 77709691,
      duration: 60,
      resolution: '2k',
      hasMotion: false,
      startTime: '2026-04-10T04:14:33.000Z',
      endTime: '2026-04-10T04:15:33.000Z',
      createdAt: '2026-04-10T04:14:33.000Z',
    },
    {
      id: 2,
      cameraId: 1,
      filename: '20260410_183209.mp4',
      fileUrl: '/videos/CAM_001/20260410_183209.mp4',
      size: 1572912,
      duration: 60,
      resolution: '2k',
      hasMotion: true,
      startTime: '2026-04-10T10:32:09.000Z',
      endTime: '2026-04-10T10:33:09.000Z',
      createdAt: '2026-04-10T10:32:09.000Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage
    Storage.prototype.getItem = jest.fn(() => 'mock-token');
  });

  it('应该在加载时调用API获取视频列表', async () => {
    axios.get.mockResolvedValue({
      data: {
        videos: mockVideos,
        total: 2,
        page: 1,
        totalPages: 1,
      },
    });

    render(<VideoManagement />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        'http://192.168.1.10:5002/api/videos',
        expect.objectContaining({
          params: {},
          headers: {
            Authorization: 'Bearer mock-token',
          },
        })
      );
    });
  });

  it('应该正确显示视频列表', async () => {
    axios.get.mockResolvedValue({
      data: {
        videos: mockVideos,
        total: 2,
        page: 1,
        totalPages: 1,
      },
    });

    render(<VideoManagement />);

    await waitFor(() => {
      expect(screen.getByTestId('video-table')).toBeInTheDocument();
    });

    // 检查是否显示了视频文件名
    expect(screen.getByText('20260410_121433.mp4')).toBeInTheDocument();
    expect(screen.getByText('20260410_183209.mp4')).toBeInTheDocument();
  });

  it('应该在API调用失败时显示错误消息', async () => {
    const errorMessage = 'Network Error';
    axios.get.mockRejectedValue(new Error(errorMessage));

    render(<VideoManagement />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalled();
    });

    // 检查是否调用了message.error（通过mock）
    const message = require('antd/lib/message');
    expect(message.error).toHaveBeenCalled();
  });

  it('应该支持按摄像头ID筛选', async () => {
    axios.get.mockResolvedValue({
      data: {
        videos: [mockVideos[0]],
        total: 1,
        page: 1,
        totalPages: 1,
      },
    });

    render(<VideoManagement />);

    // 模拟选择摄像头
    const cameraSelect = screen.getByPlaceholderText('选择摄像头');
    if (cameraSelect) {
      fireEvent.change(cameraSelect, { target: { value: '1' } });
    }

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        'http://192.168.1.10:5002/api/videos',
        expect.objectContaining({
          params: expect.objectContaining({
            cameraId: '1',
          }),
        })
      );
    });
  });

  it('应该支持分页', async () => {
    axios.get.mockResolvedValue({
      data: {
        videos: mockVideos,
        total: 20,
        page: 1,
        totalPages: 2,
      },
    });

    render(<VideoManagement />);

    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        'http://192.168.1.10:5002/api/videos',
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            limit: 20,
          }),
        })
      );
    });
  });

  it('应该在加载时显示loading状态', () => {
    axios.get.mockImplementation(() => new Promise(() => {})); // 永远pending

    render(<VideoManagement />);

    // 检查是否有loading指示器
    expect(screen.getByText(/加载中/i)).toBeInTheDocument();
  });

  it('应该格式化文件大小显示', async () => {
    axios.get.mockResolvedValue({
      data: {
        videos: mockVideos,
        total: 2,
        page: 1,
        totalPages: 1,
      },
    });

    render(<VideoManagement />);

    await waitFor(() => {
      // 77709691 bytes ≈ 74.1 MB
      expect(screen.getByText(/74\.1\s*MB/i)).toBeInTheDocument();
    });
  });
});
