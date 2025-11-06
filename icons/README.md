# 图标文件说明

## 图标要求

扩展需要三个不同尺寸的图标文件：

- `icon16.png` - 16x16 像素（用于浏览器工具栏）
- `icon48.png` - 48x48 像素（用于扩展管理页面）
- `icon128.png` - 128x128 像素（用于 Chrome Web Store）

## 使用自己的图片

### 方法 1: 直接替换（推荐）

1. **准备你的 PNG 图片**
   - 确保是 PNG 格式
   - 建议尺寸：至少 128x128 像素（可以更大）

2. **替换图标文件**
   ```bash
   # 将你的图片复制到 icons 目录
   cp /path/to/your/image.png icons/icon128.png
   ```

3. **调整尺寸（如果需要）**
   
   如果图片尺寸不对，可以使用 ImageMagick 调整：
   ```bash
   # 调整到指定尺寸
   magick your_image.png -resize 16x16 icons/icon16.png
   magick your_image.png -resize 48x48 icons/icon48.png
   magick your_image.png -resize 128x128 icons/icon128.png
   ```
   
   或者使用在线工具调整尺寸。

### 方法 2: 使用脚本自动调整

如果你有一个大尺寸的图片（比如 512x512 或更大），可以运行：

```bash
cd icons
# 假设你的图片叫 my_icon.png
magick my_icon.png -resize 16x16 icon16.png
magick my_icon.png -resize 48x48 icon48.png
magick my_icon.png -resize 128x128 icon128.png
```

### 方法 3: 使用在线工具

1. 访问在线图片调整工具（如 https://www.iloveimg.com/resize-image）
2. 上传你的图片
3. 分别调整为 16x16, 48x48, 128x128
4. 下载并重命名为对应的文件名
5. 复制到 `icons/` 目录

## 图片格式要求

- **格式**: PNG（推荐）或 JPG
- **颜色模式**: RGB
- **透明度**: 支持（PNG 可以带透明背景）
- **文件大小**: 建议每个图标小于 100KB

## 注意事项

1. **文件名必须完全匹配**: `icon16.png`, `icon48.png`, `icon128.png`
2. **尺寸建议**: 虽然 Chrome 会自动缩放，但使用精确尺寸效果最好
3. **重新加载扩展**: 替换图标后，需要在 `chrome://extensions/` 中重新加载扩展才能看到新图标

## 验证图标

替换后，检查文件：
```bash
cd icons
ls -lh *.png
file *.png  # 验证文件格式
```

然后重新加载扩展查看效果！

