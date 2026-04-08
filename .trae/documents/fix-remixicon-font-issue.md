# Remixicon 生产环境图标方框问题修复计划

## 问题根因

分析 webpack.config.js 后发现，字体文件处理规则 **排除了 node_modules**：

```js
{
  test: new RegExp('.(' + fileExtensions.join('|') + ')$'),
  type: 'asset/resource',
  exclude: /node_modules/,  // ❌ 这里导致 remixicon 字体无法处理
  generator: {
    filename: 'assets/img/[name][ext]'
  },
}
```

当 CSS 引用 remixicon 字体时，生产构建无法从 `node_modules` 正确提取字体文件，导致加载失败显示方框。

---

## 解决方案

采用 **手动复制字体文件到 assets 目录** 的方案，确保离线可用且不依赖 CDN。

---

## 实施步骤

### 步骤 1: 创建字体资源目录
在 `src/assets/` 下创建 `fonts/` 目录

### 步骤 2: 复制 remixicon 字体文件
从 npm 包的 node_modules 中复制以下文件到 `src/assets/fonts/`:
- `remixicon/fonts/remixicon.css`
- `remixicon/fonts/remixicon.woff2`
- `remixicon/fonts/remixicon.woff` (如果有)
- `remixicon/fonts/remixicon.ttf` (如果有)

### 步骤 3: 修改字体 CSS 路径
修改 `src/assets/fonts/remixicon.css`，将字体路径改为相对于 `assets/` 的正确路径：
```css
src: url("./remixicon.woff2")  // 改为 ./ 而不是 ../
```

### 步骤 4: 更新 webpack 配置
添加 CopyWebpackPlugin 规则，将 `src/assets/fonts/` 复制到构建输出目录

### 步骤 5: 更新组件导入路径
修改以下文件的 import 路径：
- `src/pages/Popup/Popup.tsx`
- `src/pages/Options/Options.tsx`

从：
```ts
import "remixicon/fonts/remixicon.css"
```
改为：
```ts
import "@/assets/fonts/remixicon.css"
```

### 步骤 6: 验证构建
运行 `npm run build` 并检查 `build/` 目录，确认字体文件被正确复制
