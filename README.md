# 法考冲刺备考站

为两个月法考冲刺量身定制的轻量学习网站。

## 快速开始

### 方式一：直接打开
双击 `index.html` 即可在浏览器中使用。

### 方式二：本地服务器（推荐）
```bash
# Python
python -m http.server 8080

# 或 Node.js
npx serve
```
然后访问 http://localhost:8080

### 方式三：部署到 Vercel（免费）
1. 注册 vercel.com 账号
2. 安装 Vercel CLI：`npm i -g vercel`
3. 在项目目录运行 `vercel`
4. 按提示操作，获得在线网址

## 功能说明

| 功能 | 说明 |
|------|------|
| 首页 | 考试倒计时、今日任务、进度环、打卡热力图 |
| 学习计划 | 8周详细计划，每天可打卡 |
| 知识笔记 | 按法考科目分目录，Markdown 编写 |
| 刷题练习 | 按科目筛选，即时解析，自动统计正确率 |
| 错题本 | 答错自动收录，可重做、移除 |
| 背诵卡片 | 翻面动画 + SM-2 间隔重复算法 |

## 数据说明

- 所有数据存储在浏览器 localStorage 中
- 支持「导出数据」和「导入数据」备份恢复
- 换设备前请先导出数据

## 自定义

- 修改 `js/data.js` 中的 `EXAM_DATE` 调整考试日期
- 在 `QUESTIONS` 数组中添加更多题目
- 在 `FLASHCARDS` 数组中添加更多卡片
- 在 `STUDY_PLAN` 数组中调整学习计划

## 技术栈

- Vue 3 (CDN)
- Marked.js (Markdown 渲染)
- 纯前端，无需后端，localStorage 存储
