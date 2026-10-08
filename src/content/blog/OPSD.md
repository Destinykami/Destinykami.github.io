---
title: OPSD paper reading
description: A blog about OPSD paper reading.
createdAt: 2026-10-8T12:00:00
tags:
  - LLM
  - Post-Training
  - OPD
authors:
  - destinykami
---

# OPSD

## 一、背景

 **OPD传统蒸馏**：

- **问题**：通常需要一个更强的外部教师模型（比如 GPT-6），这在很多场景下不现实或成本太高。

**SFT**：

- **问题**：Off-policy ——模型没见过自己犯错的样子，一旦推理跑偏就回不来了。

**RLVR (如 GRPO)**：

- **问题 1（稀疏信号）**：通常只在最终答案正确时给奖励（Reward = 1/0）。这忽略了中间推理步骤的好坏，反馈太稀疏。
- **问题 2（高昂成本）**：GRPO 需要对同一个 Prompt 采样很多次（比如 Group Size = 8~16）来计算 Baseline，计算开销巨大。而且如果所有采样都对或都错，梯度信号就消失了。

**OPSD 的灵感来源**： 人类学习时，如果做错了题，看一眼正确答案，往往就能反推理解自己错在哪，或者理顺解题思路。于是作者假设：**只要 LLM 足够强，给定正确答案后，它评估推理过程的能力要强于它直接生成答案的能力。**

## 二、方法

OPSD 不需要外部教师，它把同一个 LLM（参数 $\theta$）变成了两个角色：

### 2.1 角色定义

**学生策略 (Student Policy, p_s)：**

- 输入：仅题目 $x$。
- 行为：模拟真实推理场景，进行 On-policy 采样生成回复 $\hat{y} = (\hat{y}_1, \ldots, \hat{y}_{|\hat{y}|}) \sim p_s(\cdot \mid x)$。


**教师策略(Teacher Policy, p_t)：**

- 输入：题目 $x$ + 标准答案 $y^*$。
- 行为：利用答案作为辅助，计算每一个 Token 的概率分布，作为软标签指导学生。

![](https://pic1.zhimg.com/v2-76ae728b1d0a47d41f5158ec4f0b4c18_1440w.jpg)

左边是 Student 仅看题生成路径，右边是 Teacher 看了题和答案后，对 Student 的路径进行打分

### 2.2 训练流程

**采样**：让学生模型根据题目 $x$ 生成一个回答 $\hat{y} \sim p_s(\cdot \mid x)$。注意，这里是 On-policy的，也就是模型自己在探索。

**评估**：

- 让学生模型计算生成路径上每一步的 Token 概率分布：$p_s(y_n \mid x, \hat{y}_{<n})$。
- 让教师模型（带着答案 $y^*$）也去观察同一条学生生成的路径，并计算它认为的下一步 Token 分布：$p_t(y_n \mid x, y^*, \hat{y}_{<n})$。
- **关键点**：教师虽然拿到了答案，但它是在评估学生的路径。如果学生走歪了，教师因为知道答案，能给出如何走回正道的建议（概率分布）。

**优化目标：**最小化教师分布和学生分布之间的差异。论文使用的是 JSD (Jensen-Shannon Divergence)，因为它比 KL 散度更稳定。

整体训练目标（在学生自采样轨迹上做逐 Token 分布匹配）：

$$
\mathcal{L}_{\text{OPSD}}(\theta) = \mathbb{E}_{(x,\, y^*) \sim \mathcal{S}} \, \mathbb{E}_{\hat{y} \sim p_s(\cdot \mid x)} \left[ \frac{1}{|\hat{y}|} \sum_{n=1}^{|\hat{y}|} D\left( p_t(\cdot \mid x, y^*, \hat{y}_{<n}) \;\|\; p_s(\cdot \mid x, \hat{y}_{<n}) \right) \right]
$$

其中，Per-token 的散度 $D$ 计算为**广义 JSD**：

$$
\text{JSD}_\beta(p_t \| p_s) = \beta \, D_{\text{KL}}(p_t \| m) + (1 - \beta) \, D_{\text{KL}}(p_s \| m), \qquad m = \beta\, p_t + (1 - \beta)\, p_s, \quad \beta \in [0,\, 1]
$$

论文默认取 $\beta = 0.5$（即标准 JSD）。

梯度只回传给学生 $\theta$，教师 $p_t$ 在这里作为固定 Target（论文固定为初始模型，不随训练更新；官方代码另提供 EMA 移动平均选项）。

### 2.3 Prompt 设计

为了让教师更好地利用答案，作者设计了一个巧妙的 Prompt，让教师先消化一下答案，再指导学生：

> Here is a reference solution: [Solution]. After understanding the reference solution, please try to solve this problem using your own approach below:

![](https://pic1.zhimg.com/v2-045f37cbe1d38d249fd7edd293758bae_1440w.jpg)

## 三、训练数据

训练数据：OpenThoughts 的数学子集，约 3 万条。

官方放出的数据集是 siyanzhao/Openthoughts_math_30k_opsd，29,434 行，约 280 MB，字段是 problem / solution / COT_Reason / Answer（还有 chat 格式的 messages、conversations）。source 列可见 olympiads 等来源标签——是竞赛/奥林匹克风格的数学题。作者博客里明确说 SFT、GRPO、OPSD 三个方法用同一份 OpenThoughts 训练数据，所以方法间对比是控制住的。

特权信息的用法：teacher 分支看到 solution（verified reasoning trace），student 只看 problem，在 student 自己的 rollout 上做 token 级对齐。

评测：AIME24、AIME25、HMMT25，指标 Avg@12，单 seed，模型是 Qwen3 1.7B / 4B / 8B。