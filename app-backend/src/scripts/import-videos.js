const Video = require('../models/Video');
const Camera = require('../models/Camera');
const fs = require('fs').promises;
const path = require('path');

/**
 * 扫描NAS目录中的视频文件并导入数据库
 */
async function scanAndImportVideos() {
  try {
    console.log('开始扫描NAS视频目录...');
    
    // NAS视频目录路径（相对于app-backend/src/scripts/）
    const nasVideosDir = path.join(__dirname, '../../../NAS/videos');
    
    // 检查目录是否存在
    try {
      await fs.access(nasVideosDir);
    } catch (err) {
      console.error(`NAS视频目录不存在: ${nasVideosDir}`);
      return { success: false, message: 'NAS视频目录不存在' };
    }
    
    // 读取所有摄像头目录
    const cameraDirs = await fs.readdir(nasVideosDir);
    console.log(`找到 ${cameraDirs.length} 个摄像头目录`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const cameraDir of cameraDirs) {
      const cameraPath = path.join(nasVideosDir, cameraDir);
      const stat = await fs.stat(cameraPath);
      
      if (!stat.isDirectory()) continue;
      
      console.log(`\n处理摄像头目录: ${cameraDir}`);
      
      // 查找或创建摄像头记录
      let camera = await Camera.findOne({ where: { serialNumber: cameraDir } });
      
      if (!camera) {
        // 尝试从文件名推断摄像头信息
        console.log(`  数据库中未找到摄像头，创建新记录...`);
        camera = await Camera.create({
          serialNumber: cameraDir,
          name: `摄像头-${cameraDir}`,
          status: 'offline' // 默认离线，需要心跳更新
        });
        console.log(`  创建摄像头: ${camera.name} (ID: ${camera.id})`);
      } else {
        console.log(`  找到摄像头: ${camera.name} (ID: ${camera.id})`);
      }
      
      // 读取视频文件
      const videoFiles = await fs.readdir(cameraPath);
      const mp4Files = videoFiles.filter(f => f.endsWith('.mp4'));
      
      console.log(`  找到 ${mp4Files.length} 个视频文件`);
      
      for (const filename of mp4Files) {
        try {
          const filePath = path.join(cameraPath, filename);
          const fileStat = await fs.stat(filePath);
          
          // 从文件名解析时间戳 (格式: 20260410_121433.mp4)
          const timeMatch = filename.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
          let recordedAt = new Date();
          
          if (timeMatch) {
            const [, year, month, day, hour, minute, second] = timeMatch;
            recordedAt = new Date(year, month - 1, day, hour, minute, second);
          }
          
          // 检查是否已存在
          const existing = await Video.findOne({
            where: {
              cameraId: camera.id,
              fileName: filename
            }
          });
          
          if (existing) {
            console.log(`    ⏭️  跳过已存在的视频: ${filename}`);
            skippedCount++;
            continue;
          }
          
          // 创建视频记录
          // 估算时长（假设每个文件约60秒）
          const estimatedDuration = 60;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30); // 30天后过期
          
          // 从文件名构建fileUrl
          const fileUrl = `/videos/${cameraDir}/${filename}`;
          
          await Video.create({
            cameraId: camera.id,
            filename: filename,
            fileUrl: fileUrl,
            duration: estimatedDuration,
            resolution: 'svga',  // ESP32实际分辨率: 800x600
            hasMotion: false,
            startTime: recordedAt,
            endTime: new Date(recordedAt.getTime() + estimatedDuration * 1000),
            size: fileStat.size,
            expiresAt: expiresAt
          });
          
          console.log(`    ✅ 导入: ${filename} (${(fileStat.size / 1024 / 1024).toFixed(2)} MB)`);
          importedCount++;
          
        } catch (err) {
          console.error(`    ❌ 导入失败 ${filename}:`, err.message);
          errorCount++;
        }
      }
    }
    
    console.log('\n========== 导入完成 ==========');
    console.log(`成功导入: ${importedCount} 个视频`);
    console.log(`跳过: ${skippedCount} 个视频`);
    console.log(`错误: ${errorCount} 个视频`);
    console.log('================================\n');
    
    return {
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      errors: errorCount
    };
    
  } catch (error) {
    console.error('扫描导入失败:', error);
    return { success: false, message: error.message };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  console.log('===== 视频文件导入脚本 =====\n');
  scanAndImportVideos().then(result => {
    console.log('脚本执行完成:', result);
    process.exit(0);
  }).catch(err => {
    console.error('脚本执行失败:', err);
    process.exit(1);
  });
}

module.exports = { scanAndImportVideos };
