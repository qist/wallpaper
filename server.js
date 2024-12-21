const http = require('http');
const fs = require('fs');
const path = require('path');

// 图片文件夹路径（相对于当前文件）
const folder = path.join(__dirname, 'img');

// 支持的文件扩展名
const supportedExtensions = ['.png', '.jpg', '.jpeg'];

// 获取文件夹中的所有图片文件
function getAllImages(folder) {
  return fs.readdirSync(folder)
    .filter(file => supportedExtensions.includes(path.extname(file).toLowerCase()))
    .map(file => path.join(folder, file));
}

// 创建 HTTP 服务器
http.createServer((req, res) => {
  const images = getAllImages(folder);

  if (images.length > 0) {
    // 从数组中随机选取一个文件
    const randomIndex = Math.floor(Math.random() * images.length);
    const selectedImage = images[randomIndex];

    // 获取文件的 MIME 类型
    const mimeType = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
    }[path.extname(selectedImage).toLowerCase()];

    // 读取图片并返回
    fs.readFile(selectedImage, (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('服务器错误: 无法读取文件。');
      } else {
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('文件夹中没有图片。');
  }
}).listen(3000, () => {
  console.log('服务器运行中，访问 http://localhost:3000 查看结果');
});