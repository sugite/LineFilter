const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

try {
    // 创建一个小画布
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');

    // 画一个简单的红色方块
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 128, 128);

    // 保存文件
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(__dirname, '../images/icon.png');
    fs.writeFileSync(outputPath, buffer);
    
    // 验证文件是否创建成功
    if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log('Icon generated successfully!');
        console.log('File size:', stats.size, 'bytes');
        console.log('File path:', outputPath);
    } else {
        console.error('File was not created!');
    }
} catch (error) {
    console.error('Error generating icon:', error);
}
