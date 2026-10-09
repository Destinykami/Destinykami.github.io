---
title: Generative Agents: Interactive Simulacra of Human Behavior
description: A blog about Generative Agents: Interactive Simulacra of Human Behavior paper reading.
createdAt: 2026-10-9T12:00:00
tags:
  - LLM
  - Agent
authors:
  - destinykami
---

# Generative Agents: Interactive Simulacra of Human Behavior

论文地址：https://arxiv.org/abs/2304.03442

![alt text](image.png)

## 一、背景

本文介绍了生成式智能体——利用生成模型模拟可信的人类行为，并证明了它们能同时对个人和群体行为进行可信的模拟。生成式智能体会对它们自己、其它智能体以及所处环境进行各种推理；它们制定并执行反应它们个性和经验的每日计划，并在适当的时候调整计划；当终端用户改变它们的环境或者用自然语言给它们下令时，它们会针对性地做出反应。

比如，智能体会在看到早饭着火的时候关掉炉子、当浴室被占用时在外等候、遇到另一个更想要交流的智能体时停止正在进行的闲聊。一个充满生成式智能体的社会的特点是涌现出社会动态——新的人际关系的形成、信息的扩散、智能体之间的协作。

## 二、架构

![alt text](assets/image-1.png)

包含三个主要部分。第一个部分是**记忆流**（Memory Stream），这是一个用自然语言存储智能体完整经历的长时记忆模块。检索模型结合相关性、时近性（Recency）和重要性来挖掘指导智能体即时行为所需要的记忆记录。第二个部分是**反思**（Reflection），即随着时间推移将记忆合成更高层次的推理。这让智能体能够审视自己和它人，从而更好地指导自己的行为。第三个部分是**规划**（Planning），这一步将反思得到的推论和当前的环境转化成高级的行动规划，然后不断转化成具体的行动和反应。这些反思和规划会再被反馈到记忆流中，从而影响智能体未来的行为。

### 2.1 记忆和召回

**问题**：如何让 Agent 从大量历史经历中找到当前真正需要的记忆，而不是简单地把所有经历压缩成摘要。

**思想**：Agent 不需要每时每刻都知道自己过去发生的所有事情，但必须能在需要的时候回忆起与当前情境相关的经历。

#### 2.1.1 为什么不能总结所有记忆
假设 Isabella 是游戏中的一个 NPC，在咖啡馆工作。

随着游戏进行，她可能积累了几千条记忆，例如：

| 时间 | 记忆内容 |
| --- | --- |
| 2月10日 | Isabella 清理了咖啡馆的桌子 |
| 2月11日 | Isabella 与 Maria 讨论了情人节派对 |
| 2月11日 | Isabella 购买了咖啡豆 |
| 2月12日 | Isabella 邀请朋友参加派对 |
| 2月12日 | Isabella 觉得让大家聚在一起很开心 |
| 2月13日 | Isabella 为派对布置了装饰 |
| 2月13日 | Isabella 整理了咖啡馆的储物间 |

现在玩家问 Isabella：**"What are you passionate about these days?"**

最直接的方案是把所有记忆交给 LLM，要求生成一个摘要。

假设生成了：

> Isabella 最近一直忙于咖啡馆的工作，包括清洁、整理、与他人合作组织活动，以及完成一些项目。

然后把这个摘要加入 Prompt，让 LLM 回答玩家。

得到的回答可能是：

> 我最近很喜欢和大家合作完成各种项目，也很注重保持咖啡馆整洁。

这个回答没有明显的事实错误，但存在一个问题：

**它丢失了 Isabella 最有个性、最有意义的经历。**

因为总结所有记忆时，模型往往会把不同经历概括为抽象、宽泛的描述。

例如：

- 邀请朋友 → 与他人合作
- 策划情人节派对 → 组织活动
- 为派对布置咖啡馆 → 整理环境

最终，原本鲜活的个人经历变成了泛泛而谈的工作内容。

这是一种信息压缩导致的细节损失。

尤其要注意：**摘要不是根据当前问题生成的，而是面向整体历史经历生成的。**

因此，摘要可能保留了大量与当前问题无关的信息，却舍弃了回答问题所需的细节。

#### 2.1.2 记忆检索的优势

论文的思路是**保留原始记忆，在需要回答问题的时候，动态检索最相关的记忆。**

还是刚才的问题：

> What are you passionate about these days?

系统会把这个问题作为当前查询，从 Isabella 的 Memory Stream 中选择合适的记忆。

例如检索得到：

**Memory 1**

Isabella 最近正在组织一场情人节派对。

**Memory 2**

Isabella 非常喜欢邀请朋友参加活动，让每个人都有归属感。

**Memory 3**

Isabella 很期待大家在咖啡馆相聚，并为此精心准备装饰。

于是，LLM 得到的上下文不再是笼统的人物摘要，而是与问题高度相关的经历。

最终可能生成：

> 我最近特别热衷于组织活动，让大家能够聚在一起。我很喜欢营造温馨、友好的氛围，让每个人都感到被欢迎。比如，我最近就在忙着筹备情人节派对！

这个回答有三个明显优势：

1. **具体性（Specificity）**：提到了情人节派对。
2. **个性一致性（Character Consistency）**：反映了 Isabella 喜欢社交、关心他人的性格。
3. **经历支撑（Grounding）**：回答能够关联到她实际经历过的事情。

#### 2.1.3 记忆检索的实现

它不是简单地通过 Embedding 相似度检索，而是综合考虑三个因素：

**Recency（近期性）+ Importance（重要性）+ Relevance（相关性）**

##### 1. Recency：这段记忆有多新？

最近发生或最近被访问过的记忆，应当更容易被检索。

论文采用指数衰减：

$$
\text{Recency}(m)=0.995^{\Delta t}
$$

其中：

- $m$：某条记忆。
- $\Delta t$：距离这条记忆上次被检索经过的游戏内小时数。
- 0.995：衰减因子。

注意，论文使用的是**距离上次检索的时间**，不只是距离记忆创建的时间。

##### 2. Importance：这段记忆有多重要？

不是所有经历都值得同等程度地记住。

例如：

- 今天吃了什么早餐：重要性较低。
- 和朋友发生严重争执：重要性较高。
- 第一次向喜欢的人表白：重要性很高。

论文使用 LLM 给记忆打分，范围是 1～10，这个重要性分数在记忆创建时生成。

##### 3. Relevance：这段记忆与当前问题有多相关？

这是最接近传统 RAG 的部分。

把记忆和当前查询分别编码为 Embedding：

$$
e_m=\text{Embedding}(m)
$$

$$
e_q=\text{Embedding}(q)
$$

然后计算余弦相似度：

$$
\text{Relevance}(m,q)=\frac{e_m\cdot e_q}{\|e_m\|\|e_q\|}
$$

例如，玩家询问 Isabella：

> 你最近最期待什么？

那么“筹备情人节派对”的记忆会具有较高的相关性，而“清理咖啡馆桌子”的记忆则通常相关性较低。

##### 4. 综合评分

论文首先通过 Min-Max Scaling 将三种分数归一化到 $[0,1]$，然后加权求和：

$$
\boxed{\text{Score}(m,q)=\alpha_r R(m)+\alpha_i I(m)+\alpha_s S(m,q)}
$$

其中：

- $R(m)$：Recency
- $I(m)$：Importance
- $S(m,q)$：Relevance

论文实现中三个权重均设为 1。

最后按照综合分数排序，选择能够放进上下文窗口的高分记忆，加入 Prompt。

#### 2.1.4 和 RAG 的区别

从系统设计上看，可以把 Generative Agents 的 Memory Retrieval 理解为一种**面向角色行为模拟的增强检索机制**。

普通 RAG 通常更强调：

$$
\text{Score}(m,q)=\text{Similarity}(m,q)
$$

也就是语义相关性。

而 Generative Agents 额外考虑了：

$$
\text{Score}(m,q)=\text{Relevance}+\text{Recency}+\text{Importance}
$$

为什么？

因为游戏 NPC 的记忆检索不是单纯的信息查询，而是为了产生**符合角色经历和当前状态的行为**。

例如，Isabella 两年前参加过一场盛大的派对，昨天又开始筹备一场新派对。

当玩家询问“你最近最期待什么”时，即使两件事在语义上都与派对有关，近期性也会帮助系统优先考虑昨天发生的事情。

另一方面，如果玩家问：

> 你人生中最难忘的经历是什么？

那么某段很久以前、但重要性很高的记忆，也应该有机会被检索出来。

因此三个维度各自解决不同的问题。

### 2.2 反思

**问题**：Agent即使能准确回忆过去发生的事情，也不代表它能够从这些经历中形成对自己、他人和世界的认识。

假设 Klaus 有两位熟人：

**Wolfgang**

- 是 Klaus 的大学宿舍邻居。
- 两人经常见面。
- 但大多数时候只是简单打招呼。
- 没有太多深入交流。

**Maria**

- 与 Klaus 见面的次数相对较少。
- Maria 一直在认真进行自己的研究。
- Klaus 同样对研究充满热情。
- 两人具有相似的兴趣。

现在用户问：

> If you had to choose one person of those you know to spend an hour with, who would it be?

如果只能从原始的 Observation 中寻找答案，系统可能更容易选出 Wolfgang。

因为 Wolfgang 与 Klaus 的互动记录更多。

例如：

```
Observation 1: Klaus met Wolfgang at the dormitory.
Observation 2: Klaus greeted Wolfgang in the hallway.
Observation 3: Klaus saw Wolfgang at breakfast.
Observation 4: Klaus talked briefly with Wolfgang.
Observation 5: Klaus discussed research with Maria.
Observation 6: Maria is working on her research project.
```

假设采用简单的记忆检索和问答，Wolfgang 的记忆在数量上占优势。

但问题在于：

**互动频率（Interaction Frequency）不等于关系质量（Relationship Quality）。**

如果想生成更合理的回答，Agent 应该理解：

$$
\text{频繁见面} \neq \text{关系亲密}
$$

同时：

$$
\text{共同兴趣} \rightarrow \text{可能更愿意相处}
$$

这需要从原始观察中进行推理。

论文因此引入了 Reflection。

需要注意，这并不是说 LLM 无法直接根据原始记忆做出推断，而是当记忆数量庞大、分散在不同时间时，仅依靠即时检索难以稳定地产生这些高层次判断。

通过提前生成 Reflection，系统能够将这些推断作为长期记忆保存下来。

这就是本节希望实现的能力：**从具体的事件记忆（Observations）中，归纳出抽象的认知（Reflections），再利用这些认知指导未来的行为。**

#### 2.2.1 记忆的两个层次

1. Observation：记录发生了什么

例如：
```
[Observation]
Klaus is reading a book about gentrification.

[Observation]
Klaus is writing a research paper.

[Observation]
Klaus is discussing his research with a librarian.

[Observation]
Klaus spent three hours reading research papers.
```
这些记忆记录了客观事件。

2. Reflection：归纳这些事件意味着什么

Agent 可以从上面的 Observation 中总结：

```
[Reflection]
Klaus is dedicated to his research.
```

进一步还可能得到：

```
[Reflection]
Research is an important part of Klaus's identity.
```

它不再只是记录行为，而是尝试形成对人物兴趣、性格、动机、关系等方面的认识。

**关键区别：Reflection 不是普通的 Summary，Summary 主要是在压缩信息，Reflection 则是在进行推断和抽象。**

#### 2.2.2 Reflection 的工作流程

论文主要通过 **LLM Prompting + Memory Retrieval** 实现 Reflection。

完整流程可以概括为：

```
              Memory Stream
                   │
                   ▼
          判断是否需要 Reflection
                   │
                   ▼
          读取最近 100 条记忆
                   │
                   ▼
           LLM 生成 3 个问题
                   │
                   ▼
          根据问题进行记忆检索
                   │
                   ▼
        LLM 根据检索结果生成 Insights
                   │
                   ▼
           记录 Supporting Evidence
                   │
                   ▼
         将 Reflection 存入 Memory
```

##### STEP1：什么时候触发 Reflection？

**Reflection 是事件重要性驱动的，而不是单纯按照固定时间间隔执行。**

在2.1节的记忆部分写到，每条记忆在创建的时候都会给出一个重要性评分，通过累积近期事件的重要性分数，超过阈值后触发Reflection。

这意味着 Agent 经历较多重要事件时，更容易进入反思过程。

##### STEP2：应该反思什么？

一般可能会认为：

既然要反思，直接把最近的记忆发送给 LLM，让它总结不就可以了吗？

但论文先让 LLM **提出值得思考的问题**，具体实现是取 Memory Stream 中最近的 100 条记录，将它们提供给 LLM，然后要求模型回答：根据上述信息，我们能够回答的三个最重要的高层次问题是什么？

例如，输入包含：

```
1. Klaus is reading a book about gentrification.

2. Klaus is discussing his research project with a librarian.

3. Klaus is writing a research paper.

4. Maria is working on her research project.

5. Klaus has talked with Maria about research.
```

LLM 可能生成：

```
Q1: What topic is Klaus passionate about?

Q2: What is the relationship between Klaus and Maria?

Q3: What motivates Klaus to spend so much time on academic research?
```

**为什么先生成问题，而不是直接生成反思？**

因为问题能够确定反思的方向。

如果只是说：

```
Summarize these memories.
```

模型可能生成：

```
Klaus has been busy studying recently.
```

但如果先提出：

```
What topic is Klaus passionate about?
```

模型就有了明确的推理目标：

它需要识别 Klaus 的兴趣，而不是简单描述近期发生了哪些事情。

因此，这一步可以理解为：

$$
\boxed{\text{Recent Memories} \rightarrow \text{Reflection Questions}}
$$

生成的问题实际上充当了后续检索的 Query。

##### STEP3：根据问题检索历史记忆

最近 100 条记忆只是用于生成反思问题，接下来，系统会针对每个问题，从**整个 Memory Stream** 中检索相关记忆。

从架构角度看，Reflection 实际上复用了 Retrieval。

##### STEP4：生成高层次 Insights

检索到相关记忆后，系统再次调用 LLM。

这次不再要求生成问题，而是要求从证据中推断出高层次结论。

论文给出的 Prompt 大致是：

```
Statements about Klaus Mueller

1. Klaus Mueller is writing a research paper.

2. Klaus Mueller enjoys reading a book
   on gentrification.

3. Klaus Mueller is conversing with Ayesha Khan
   about exercising.

...

What 5 high-level insights can you infer
from the above statements?

Example format:
insight (because of 1, 5, 3)
```

这里有两个关键点。

**第一，要求生成 5 个高层次 Insights。**

即要求 LLM 提取有意义的认识，而不是重复已有的观察。

**第二，要求给出 Supporting Evidence。**

例如：

```
Insight:
Klaus Mueller is dedicated to his research
on gentrification.

Evidence:
(1, 2, 8, 15)
```

这里的编号指向作为推断依据的记忆记录。

这相当于让每个 Reflection 都能够回答：

> 你为什么得出这个结论？

形式化表达：

$$
R_j=(r_j,E_j)
$$

其中：

$$
r_j=\text{Reflection Content}
$$

$$
E_j=\{m_{j1},m_{j2},\ldots\}
$$

是支持该 Reflection 的记忆集合。

例如：

```
Reflection ID: R001

Content:
Klaus is dedicated to academic research.

Evidence:
[M001, M012, M038, M057]
```

这里的证据引用不是为了让 Agent 在回答时向玩家展示参考文献，而是为了建立 Reflection 与原始记忆之间的关联。

这种关联还具有一个重要作用：**支持递归反思和记忆溯源。**

不过，必须明确区分：论文要求模型引用支撑证据，并不等于系统通过了严格的逻辑验证。模型仍然可能从真实事件中推导出不成立的结论。

---

##### STEP5：把 Reflection 保存到 Memory Stream

生成 Insight 后，论文没有直接丢弃结果，而是将其保存为新的记忆。

例如：

```
Memory Stream:

[Observation]
Klaus reads papers about gentrification.

[Observation]
Klaus discusses research with a librarian.

[Observation]
Klaus spends the afternoon writing his paper.

[Reflection]
Klaus is dedicated to his academic research.
```

这意味着 Reflection 与 Observation 都属于可检索的记忆。

以后玩家询问：

> What do you care about most?

系统可以直接检索到：

```
[Reflection]
Klaus is dedicated to his academic research.
```

而不必每次都重新读取几十条 Observation，再推理一次 Klaus 是否热爱研究。

从计算角度理解：

**Reflection 相当于把部分复杂的在线推理提前执行，并将推理结果缓存到长期记忆中。**

这既能够降低后续的重复推理成本，也有助于保持角色在不同时间的行为一致性。

#### 2.2.3 递归反思

![alt text](assets/image-2.png)

Agent 可以从 Observation 中生成 Reflection，还说明**Reflection 本身也可以成为下一次 Reflection 的输入**。

##### 为什么递归反思有价值？

因为人的认知通常不是直接从几个事件跳跃到非常抽象的人格判断。

例如，一个游戏 NPC 经历：

```
玩家第一次帮助 NPC 完成任务。

玩家第二次帮助 NPC 寻找物品。

玩家第三次在危险时保护 NPC。
```

第一次反思可能形成：

```
R1: 玩家经常帮助我。
```

随着新的互动发生，又形成：

```
R2: 玩家似乎值得信任。
```

更长时间之后，Agent 可能形成：

```
R3: 玩家是我非常重要的朋友。
```

于是：

$$
\text{具体互动} \rightarrow \text{信任判断} \rightarrow \text{关系认知}
$$

这就是递归反思非常适合游戏 NPC 的原因。

它让角色对玩家的认识能够随着经历不断积累和发展，而不是每次交互都从一个固定的 Persona 出发。

如果没有 Reflection，系统可能需要检索大量历史事件：

```
几个月来的行为记录
与各种 NPC 的互动
做过的各种决策
完成过的任务
```

然后在一次推理中总结角色人格。

但是这样存在两个问题。

**首先，检索结果不一定完整。**

某些关键经历可能没有被召回。

**其次，每次回答都需要重复推理。**

同一个 NPC 今天可能被模型描述为外向，明天又被描述为内向。

Reflection 通过提前提炼和存储高层次认知，能够减少这种不一致。

#### 2.2.4 和游戏 Agent 的联系

传统 NPC 主要依赖静态设定：

```
Persona:
- Friendly
- Outgoing
- Helpful
```

在 Generative Agents 中，人物的行为还受到新生成的 Reflection 影响。

例如：

```
Initial Persona:
- Friendly
- Outgoing
- Helpful

Observation:
玩家连续多次欺骗 NPC。

Reflection:
这个玩家可能不值得信任。

Behavior:
NPC 对这个玩家变得更加警惕。
```

这并不意味着原始 Persona 被修改。

而是 Agent 在静态人设之上形成了额外的动态认知。

我们可以从系统设计的角度，将游戏 NPC 的行为表示为：

$$
\boxed{a_t=\pi(P,M_t,R_t,S_t)}
$$

其中：

- $P$：相对稳定的 Persona。
- $M_t$：历史事件记忆。
- $R_t$：通过反思得到的高层次认知。
- $S_t$：当前环境和交互状态。
- $a_t$：最终行为。

它的意义在于：

**同一个 NPC 面对不同玩家时，能够因为历史互动不同而表现出不同的行为。**

例如，一个原本友善的 NPC：

面对经常帮助自己的玩家，表现出高度信任。

面对多次欺骗自己的玩家，表现出警惕。

面对陌生玩家，保持一般程度的友善。

这就是 Reflection 在千人千面 Agent 中的一种直接应用。

#### 2.2.5 问题

Reflection 本质上是一种记忆抽象，但可能发生错误累积，**一个不可靠的低层推断，被后续多次反思不断放大。**

这与 LLM 的自我强化式幻觉有相似之处。

论文的证据引用机制能够提供一定的可追溯性，但并没有从根本上解决这个问题。

可优化点：给 Reflection 增加：

$$
R=(\text{content},\text{evidence},\text{confidence},\text{timestamp})
$$

其中：

- `content`：反思内容。
- `evidence`：支持该推断的原始记忆。
- `confidence`：推断置信度。
- `timestamp`：生成时间。

并在后续证据发生冲突时，对已有 Reflection 进行更新或者失效处理。

### 2.3 Planning and Reacting

