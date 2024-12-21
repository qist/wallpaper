<?php
$folder = 'img'; // 图片文件夹相对于当前 PHP 文件的路径  

// 获取文件夹中的所有 .png 和 .jpg 文件  
$images = glob($folder . '/*.png');
$jpgFiles = glob($folder . '/*.jpg');
$jpegFiles = glob($folder . '/*.jpeg');

// 合并数组  
$allImages = array_merge($images, $jpgFiles, $jpegFiles);

// 从数组中随机选取一个键  
$randomKey = array_rand($allImages);

// 检查是否有图片可用  
if (isset($allImages[$randomKey])) {
    $imageData = file_get_contents($allImages[$randomKey]);
    $mimeType = mime_content_type($allImages[$randomKey]);
    header("Content-Type: $mimeType");
    echo $imageData;
    exit(); // 确保脚本终止
} else {
    echo '文件夹中没有图片。';
}
