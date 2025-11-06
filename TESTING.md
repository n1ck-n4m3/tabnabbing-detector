# Tabnabbing Detector - 测试指南

## 安装扩展

1. 打开 Chrome 浏览器
2. 访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"（Developer mode）
4. 点击"加载已解压的扩展程序"（Load unpacked）
5. 选择 `tabnabbing-detector` 目录

## 测试步骤

### 测试 1: 基本功能测试

1. **打开一个网页**（例如：https://www.example.com）
2. **等待 2-3 秒**，让扩展捕获第一张截图
3. **切换到另一个标签页**
4. **等待 1-2 秒**
5. **切换回原标签页**
6. **观察结果**：
   - 如果页面没有变化，不应该有高亮
   - 如果页面有变化，应该看到红色高亮框

### 测试 2: Tabnabbing 攻击模拟

创建一个测试页面来模拟 tabnabbing 攻击：

1. **创建测试 HTML 文件** (`test-tabnabbing.html`):
```html
<!DOCTYPE html>
<html>
<head>
    <title>Test Page</title>
</head>
<body>
    <h1>Original Page</h1>
    <p>This is the original content.</p>
    <script>
        let changed = false;
        window.addEventListener('blur', function() {
            if (!changed) {
                setTimeout(function() {
                    document.body.innerHTML = `
                        <h1>Gmail Login</h1>
                        <form>
                            <input type="email" placeholder="Email">
                            <input type="password" placeholder="Password">
                            <button>Sign In</button>
                        </form>
                    `;
                    changed = true;
                }, 1000);
            }
        });
    </script>
</body>
</html>
```

2. **在 Chrome 中打开这个文件**
3. **等待 2-3 秒**（让扩展捕获截图）
4. **切换到另一个标签页**
5. **等待 2 秒**（让页面变化）
6. **切换回测试页面**
7. **应该看到**：
   - 红色高亮框标记变化区域
   - 扩展图标显示变化数量
   - 图标颜色根据严重程度变化

### 测试 3: 扩展图标和徽章

1. **执行测试 2 的步骤**
2. **查看扩展图标**（浏览器工具栏）：
   - 应该显示一个数字徽章（变化数量）
   - 颜色编码：
     - 🔴 红色：>20 个变化
     - 🟠 橙色：10-20 个变化
     - 🟡 黄色：<10 个变化

### 测试 4: 清除高亮

1. **在检测到变化后**
2. **点击扩展图标**
3. **点击"Clear Highlights"按钮**
4. **高亮应该消失**

### 测试 5: 多标签页测试

1. **打开多个标签页**
2. **在每个标签页中浏览不同网站**
3. **切换标签页**
4. **验证**：每个标签页独立监控，不会互相干扰

## 预期行为

### ✅ 正常行为

- 扩展在后台静默运行
- 每 2 秒自动捕获活动标签页截图
- 切换标签页时检测变化
- 变化区域用红色半透明框高亮
- 扩展图标显示变化数量

### ⚠️ 可能的问题

1. **没有检测到变化**：
   - 检查浏览器控制台（F12）是否有错误
   - 确认 Resemble.js 已正确加载
   - 检查 manifest.json 权限设置

2. **高亮位置不准确**：
   - 网格大小为 50x50 像素，可能不够精确
   - 这是预期的行为（简化实现）

3. **性能问题**：
   - 大页面可能比较慢
   - 这是正常的，因为需要处理大量图像数据

## 调试技巧

### 查看控制台日志

1. **打开开发者工具**（F12）
2. **切换到 Console 标签**
3. **查看扩展日志**：
   - Background script: 在 `chrome://extensions/` 中点击扩展的"service worker"链接
   - Content script: 在网页的控制台中查看

### 检查扩展状态

1. 访问 `chrome://extensions/`
2. 找到 "Tabnabbing Detector"
3. 点击"详细信息"
4. 查看权限和错误信息

### 测试截图功能

在 Background script 控制台中运行：
```javascript
chrome.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
  console.log('Screenshot captured:', dataUrl ? 'Success' : 'Failed');
});
```

## 常见问题

**Q: 扩展没有工作？**
A: 检查是否启用了开发者模式，并重新加载扩展

**Q: 没有检测到变化？**
A: 确保等待足够时间让扩展捕获截图（至少 2-3 秒）

**Q: 高亮位置不对？**
A: 这是网格方法的限制，50x50 像素的精度是预期的

**Q: 性能很慢？**
A: 图像比较是计算密集型操作，大页面会较慢

## 测试检查清单

- [ ] 扩展成功安装
- [ ] 基本截图功能正常
- [ ] 标签页切换检测正常
- [ ] 变化检测和高亮正常
- [ ] 扩展图标徽章显示正常
- [ ] 清除高亮功能正常
- [ ] 多标签页独立工作
- [ ] 没有控制台错误

## 报告问题

如果发现问题，请检查：
1. Chrome 版本（建议最新版本）
2. 扩展版本
3. 控制台错误信息
4. 复现步骤

