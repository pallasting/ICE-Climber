# 🚀 Unity Migration Plan - Project Ice Breaker RE

**Version:** v1.0  
**Date:** 2025-11-21  
**Owner:** Tech Direction Team  
**Scope:** 从当前Python/Pygame原型迁移到Unity 2022.3 LTS，实现垂直切片并为最终发布奠定技术基础。

---

## 1. 迁移目标与成功标准

### 1.1 目标
- 保留当前原型验证过的核心玩法手感（滑行、跳跃、头撞破块）
- 在Unity中重建物理、渲染、关卡、敌人与Roguelite系统框架
- 为PC + 移动端 + 主机平台提供统一的技术栈
- 支持HDRP次世代画质效果，URP移动兼容

### 1.2 成功标准
- Unity垂直切片实现：1个Biome + 基础敌人 + 程序化生成 + 次世代视觉
- 60 FPS @ 1080p（PC），30 FPS @ 720p（移动端）
- Python原型与Unity版本的手感差异 < 5%，关键参数比对一致
- 代码结构模块化，便于后续扩展

---

## 2. 迁移范围与优先级

| 模块 | 范围 | 优先级 | 备注 |
| --- | --- | --- | --- |
| 核心物理 | 移动、跳跃、Coyote Time、角落辅助 | P0 | 必须保证手感一致 |
| 破坏系统 | 冰块破碎、粒子、碎片物理 | P0 | HDRP + VFX Graph |
| 关卡系统 | 程序化生成、卷轴、Biome配置 | P0 | ScriptableObject驱动 |
| 敌人与Boss | 基础敌人AI、Boss阶段化 | P1 | 阶段化迁移 |
| Roguelite系统 | 热量值、道具商店、升级 | P1 | 依赖关卡系统 |
| 多人系统 | 本地多人、幽灵机制、在线 | P2 | 手感+关卡之后 |
| 移动端适配 | 控制、性能、UI | P2 | 迁移完成后并行 |

---

## 3. 技术映射与设计

### 3.1 物理与输入

| Python实现 | Unity对应 | 备注 |
| --- | --- | --- |
| 自定义Vector2位置/速度/加速度 | Rigidbody2D / CharacterController | 采用Rigidbody2D + 自定义Force |
| 摩擦力 = -0.08 | Physics Material 2D (friction = 0.02) + 自定义阻尼 | 使用FixedUpdate控制 |
| 重力 = 0.8 | Rigidbody2D.gravityScale = 1.0（基于单位换算） | 参数可调 |
| Coyote Time计时器 | C# Coroutine + State Flag | 保持0.15秒窗口 |
| 角落辅助 | CapsuleCast + 边缘校正 | 使用Raycast检测边缘 |
| 输入系统 | pygame.key.get_pressed | Unity Input System (Action Map) | 支持键鼠+手柄+触控 |

### 3.2 破坏系统
- Python：IceBlock.break_ice()打印 + kill sprite + 简易粒子
- Unity：
  - 使用Fracture插件预计算Voronoi碎片
  - 碰撞触发脚本 IceBlockFracture.cs
  - 调用VFX Graph生成冰尘粒子
  - 碎片Rigidbody启用，衰减后回收（对象池）

### 3.3 关卡生成
- Python：手工摆放两层方块
- Unity：
  - 使用ScriptableObject定义BiomeConfig
  - LevelGenerator按种子生成平台、敌人、道具
  - 使用Addressables异步加载Prefab
  - 垂直卷轴通过Cinemachine Virtual Camera跟随

### 3.4 数据配置
- Python：硬编码参数
- Unity：
  - PlayerStats.asset、IceBlockConfig.asset等ScriptableObject
  - 使用Resources或Addressables统一加载
  - 支持在编辑器中实时调参

---

## 4. 迁移步骤

### 阶段A：准备（Week 0-1）
1. 搭建Unity 2022.3 LTS项目，启用HDRP + URP双管线
2. 配置Git LFS（存储大模型/贴图）
3. 建立基础目录结构（Scripts/Prefabs/Materials等）
4. 导入核心插件：
   - Cinemachine
   - Input System
   - Shader Graph / VFX Graph
   - DOTween
   - Fracture (Unity Experimental)

### 阶段B：核心系统迁移（Week 2-4）
1. **PlayerController.cs**：移动、跳跃、Coyote Time、角落辅助
2. **IceBlock.cs + IceBlockFracture.cs**：破坏机制
3. **Particle/VFX**：基础冰尘效果
4. **CameraRig**：Cinemachine垂直跟随
5. **UI-HUD**：基础调试信息（FPS、位置、状态）

### 阶段C：关卡 & Roguelite（Week 5-7）
1. **LevelGenerator.cs**：程序化平台生成
2. **BiomeConfig.asset**：定义颜色、敌人、天气
3. **HeatValueSystem.cs**：热量值收集
4. **ShopSystem.cs**：基础商店界面

### 阶段D：敌人与Boss（Week 8-10）
1. **EnemyBase.cs** + 状态机
2. **ThreatGradientSystem.cs**：威胁等级控制
3. **BossController.cs**：阶段化逻辑 + 反弹机制
4. 动画/音效整合

### 阶段E：多人 & 移动端（Week 11-14）
1. **LocalMultiplayerInput**：多输入映射
2. **GhostMode.cs**：幽灵协助/竞技
3. **NetcodePrototype**：可选在线测试
4. **MobileControls.cs**：虚拟摇杆 + UI适配

### 阶段F：优化与发布准备（Week 15-18）
1. 性能剖析（Profiler, Frame Debugger）
2. HDRP/URP质量预设（Quality Settings）
3. 打包管线（CI/CD）：PC + Android + iOS + 主机（Dev Kit）
4. 技术文档和知识转移

---

## 5. 工具链与CI/CD

### 5.1 开发工具
- Unity 2022.3 LTS + HDRP/URP
- Rider / Visual Studio
- Blender (自制模型)
- Substance Painter (材质)
- Figma (UI原型)

### 5.2 CI/CD流程
1. GitHub Actions / GitLab CI
2. 步骤：
   - Checkout + Submodule
   - Install Unity (via Unity Builder action)
   - Build PC + Android（smoke test）
   - Run PlayMode & EditMode tests
   - Upload Artifacts (builds + reports)
3. 每日构建（Nightly），关键分支合并触发

---

## 6. 验证与对齐

### 6.1 手感对齐
- 使用Input Recording录制Python原型操作
- 在Unity中重放输入，比较位置/速度曲线
- 指标：
  - 最大位移差 < 5px
  - 跳跃高度差 < 3%
  - 落地帧差 < 2帧

### 6.2 视觉验收
- HDRP场景截图对比设计稿
- Ray Tracing开关性能测试
- 粒子数量 vs FPS曲线

### 6.3 QA清单
- 物理碰撞误判率 < 1%
- 破坏系统崩溃率 = 0
- 关卡生成错误率 = 0（1000次测试）

---

## 7. 风险与对策

| 风险 | 概率 | 影响 | 对策 |
| --- | --- | --- | --- |
| HDRP性能不达标 | 中 | 高 | 提供URP fallback，分层渲染 |
| Fracture插件不稳定 | 中 | 中 | 使用预烘焙碎片 + 对象池 |
| Python/Unity手感差异 | 高 | 高 | 录制输入，对比数据，设立调参面板 |
| 多平台Shader兼容性 | 中 | 高 | Shader Graph + 平台分支，自动化测试 |
| 移动端触控手感 | 中 | 中 | 早期原型测试，收集玩家反馈 |

---

## 8. 交付物
- Unity项目仓库（含HDRP/URP配置）
- Player/Enemy/Level/Roguelite核心脚本
- Shader Graph与VFX Graph资产
- CI/CD配置文件
- 迁移对照表（Python参数 vs Unity参数）
- 验证报告（手感、性能、视觉）

---

## 9. 后续步骤
1. 召开迁移启动会，对齐技术路线
2. 指定模块负责人（物理、渲染、关卡、多人）
3. 建立周报机制，追踪迁移进度
4. 每两周评审一次垂直切片成果

---

**最后更新：** 2025-11-21  
**联系人：** @[TechLead] / @[Producer]
