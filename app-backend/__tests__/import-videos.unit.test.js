const path = require('path');

// Mock Sequelize模型必须在require之前
jest.mock('../src/models/Video', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  belongsTo: jest.fn(),
}));

jest.mock('../src/models/Camera', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  hasMany: jest.fn(),
}));

const Video = require('../src/models/Video');
const Camera = require('../src/models/Camera');

describe('视频导入脚本测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('importVideos 函数', () => {
    it('应该成功导入视频文件到数据库', async () => {
      // Mock Camera.findOne
      const mockCamera = { id: 1, serialNumber: 'CAM_001' };
      Camera.findOne.mockResolvedValue(mockCamera);

      // Mock Video.create
      Video.create.mockResolvedValue({
        id: 1,
        cameraId: 1,
        filename: '20260410_121433.mp4',
        fileUrl: '/videos/CAM_001/20260410_121433.mp4',
        size: 77709691,
        duration: 60,
        resolution: '2k',
        hasMotion: false,
        startTime: new Date(),
        endTime: new Date(),
        expiresAt: new Date()
      });

      // Mock fs模块
      const fs = require('fs').promises;
      
      jest.spyOn(fs, 'readdir')
        .mockResolvedValueOnce(['CAM_001'])  // 第一次调用：读取摄像头目录
        .mockResolvedValueOnce(['20260410_121433.mp4', '20260410_183209.mp4']);  // 第二次调用：读取视频文件
      
      jest.spyOn(fs, 'stat').mockImplementation(async (path) => {
        // 如果是检查目录，返回isDirectory=true
        if (path.includes('videos') && !path.includes('.mp4')) {
          return {
            isDirectory: () => true,
            size: 0,
            mtime: new Date()
          };
        }
        // 如果是文件，返回文件信息
        return {
          isDirectory: () => false,
          size: 77709691,
          mtime: new Date('2026-04-10T12:14:33.000Z')
        };
      });
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      // 运行导入脚本
      const importScript = require('../src/scripts/import-videos');
      const result = await importScript.scanAndImportVideos();

      expect(result.success).toBe(true);
      expect(result.imported).toBeGreaterThan(0);  // 注意：返回的是imported，不是importedCount
      expect(Camera.findOne).toHaveBeenCalled();
      expect(Video.create).toHaveBeenCalled();

      // 恢复原始方法
      fs.readdir.mockRestore();
      fs.stat.mockRestore();
      fs.access.mockRestore();
    });

    it('应该在目录不存在时返回错误', async () => {
      const fs = require('fs').promises;
      jest.spyOn(fs, 'access').mockRejectedValue(new Error('目录不存在'));

      const importScript = require('../src/scripts/import-videos');
      const result = await importScript.scanAndImportVideos();

      expect(result.success).toBe(false);
      expect(result.message).toContain('NAS视频目录不存在');

      fs.access.mockRestore();
    });

    it('应该跳过已存在的视频文件', async () => {
      const mockCamera = { id: 1, serialNumber: 'CAM_001' };
      Camera.findOne.mockResolvedValue(mockCamera);

      // Mock Video.findOne 返回已存在的记录
      Video.findOne.mockResolvedValue({ id: 1 });

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readdir')
        .mockResolvedValueOnce(['CAM_001'])
        .mockResolvedValueOnce(['20260410_121433.mp4']);
      jest.spyOn(fs, 'stat').mockImplementation(async (path) => {
        if (path.includes('videos') && !path.includes('.mp4')) {
          return { isDirectory: () => true, size: 0, mtime: new Date() };
        }
        return {
          isDirectory: () => false,
          size: 77709691,
          mtime: new Date('2026-04-10T12:14:33.000Z')
        };
      });
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const importScript = require('../src/scripts/import-videos');
      const result = await importScript.scanAndImportVideos();

      expect(result.skipped).toBeGreaterThan(0);  // 返回的是skipped
      expect(Video.create).not.toHaveBeenCalled();

      fs.readdir.mockRestore();
      fs.stat.mockRestore();
      fs.access.mockRestore();
    });

    it('应该处理摄像头不存在的情况', async () => {
      Camera.findOne.mockResolvedValue(null);
      // Mock Camera.create返回新创建的摄像头
      Camera.create.mockResolvedValue({ id: 999, serialNumber: 'CAM_999', name: '摄像头-CAM_999' });

      const fs = require('fs').promises;
      jest.spyOn(fs, 'readdir')
        .mockResolvedValueOnce(['CAM_999'])
        .mockResolvedValueOnce([]);
      jest.spyOn(fs, 'stat').mockImplementation(async (path) => {
        if (path.includes('videos') && !path.includes('.mp4')) {
          return { isDirectory: () => true, size: 0, mtime: new Date() };
        }
        return {
          isDirectory: () => false,
          size: 77709691,
          mtime: new Date('2026-04-10T12:14:33.000Z')
        };
      });
      jest.spyOn(fs, 'access').mockResolvedValue(undefined);

      const importScript = require('../src/scripts/import-videos');
      const result = await importScript.scanAndImportVideos();

      expect(result.success).toBe(true);
      expect(Camera.create).toHaveBeenCalled();

      fs.readdir.mockRestore();
      fs.access.mockRestore();
    });
  });
});
