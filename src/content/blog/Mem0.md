---
title: Mem0 paper reading
description: A blog about Generative Agents_Interactive Simulacra of Human Behavior paper reading.
createdAt: 2026-10-11T12:00:00
tags:
  - LLM
  - Agent
  - Memory
authors:
  - destinykami
---
# Mem0

论文地址：https://arxiv.org/abs/2504.19413

# 一、背景

## 1.1 Mem0 究竟想解决什么问题？

论文认为，LLM 虽然能够生成连贯的回答，但受限于有限的上下文窗口，在跨越多个会话的长期交互中，难以保持一致性。

因此，作者提出 Mem0，通过三个操作维护长期记忆：

$$ \boxed{\text{Extraction} \rightarrow \text{Consolidation} \rightarrow \text{Retrieval}} $$

分别是：

1. **Extraction（提取）**：从对话中提取值得记住的信息。
2. **Consolidation（整合）**：将新信息与已有记忆进行比较、更新和去重。
3. **Retrieval（检索）**：在未来需要时，取出与当前问题相关的记忆。

作者还提出了 Mem0ᵍ，使用图结构存储实体及其关系，从而支持更复杂的关系推理。

### 一个游戏 NPC 的例子

假设你正在设计一个 RPG 游戏中的 NPC。

玩家第一天与 NPC 对话：

> 玩家：我其实很讨厌战斗，更喜欢探索地图。

第二天：

> 玩家：昨天我发现了一个隐藏洞穴。

第三天：

> 玩家：有什么任务推荐吗？

如果 NPC 没有长期记忆，它可能随机推荐：

> NPC：最近有一个讨伐魔物的任务，你可以试试。

但是如果使用 Mem0，NPC 在第一天就可能提取并保存：

```
{
  "user_id": "player_001",
  "memory": "玩家更喜欢探索地图，不喜欢战斗"
}
```

第三天，当玩家询问任务时：

```
玩家：有什么任务推荐吗？
           │
           ▼
      Memory Retrieval
           │
           ▼
玩家喜欢探索，不喜欢战斗
           │
           ▼
        LLM
           │
           ▼
NPC：听说北边森林里有一处尚未探索的遗迹，或许很适合你。
```

这就是 Mem0 最直接的使用方式。

不过这里需要明确：

**Mem0 本身不负责训练 NPC 的决策策略，它主要提供记忆的写入、维护和检索机制。**

NPC 如何利用检索到的记忆产生具体行为，仍然取决于外部 Agent 的决策模块。
## 1.2 为什么扩大上下文窗口不够

扩大上下文只是推迟了问题的发生，并未从根本上解决问题。

### 原因一：历史信息可能无限增长

随着玩家不断游戏，历史信息还会继续增加，如果每次生成 NPC 回复，都需要重新读取全部历史，会产生非常大的计算和存储开销。
固定容量的上下文不适合直接承担不断增长的持久记忆。

### 原因二：更多 Context 不代表更好的记忆能力

例如，一个玩家和 NPC 的历史记录是：

```
Day 1：
玩家告诉 NPC，自己最讨厌哥布林。

Day 2～Day 100：
玩家与 NPC 进行了几万轮对话，
包括任务、交易、战斗和剧情。

Day 101：
NPC 发现了一支哥布林军队。
```

此时 NPC 需要决定：

> 是否主动邀请玩家讨伐哥布林？

如果直接把 Day 1～Day 101 的对话全部放进 Context：

```
[几百万 tokens 的历史]

当前问题：
是否邀请玩家讨伐哥布林？
```

即使理论上上下文能够容纳，模型也未必能够有效利用 Day 1 的信息。

这就是长上下文中常见的相关信息定位和利用问题。

但使用 Memory Retrieval：

```
Query：
是否邀请玩家讨伐哥布林？

Retrieved Memory：
玩家非常讨厌哥布林。

Decision：
可以考虑邀请玩家参与讨伐。
```

**Long Context 尝试让模型直接从完整历史中寻找信息，而 Memory System 在模型推理之前，就主动完成了一部分信息筛选。**

# 二、架构
![[Pasted image 20261010190435.png]]

## 2.1 Memory Extraction

输入不只有当前的消息，还包括过去的m条消息、过去的摘要，这可以让模型理解上下文，减少孤立提取导致记忆错误，这个机制叫做Context-Aware Memory Extraction。

调用LLM得到候选记忆集合，作为第二阶段的输入。

这个设计存在一个特点：

**Memory Extraction 是由 LLM 根据当前已知的信息决定哪些事实值得提取的。**

它能够利用历史摘要和近期消息理解上下文，但不能预知未来哪些事件会变得重要。
## 2.2 Memory Update

对于提取出来的每条候选记忆，
1. 通过 Embedding 检索最相似的 s 条已有记忆。
2. 将候选记忆与这些已有记忆交给 LLM。
3. 让 LLM 决定执行 ADD、UPDATE、DELETE 或 NOOP。
4. 执行对应的数据库操作。
对于一个新事实 f ，系统主要执行以下判断：

$$ \operatorname{Operation}(f,M)= \begin{cases} \text{ADD}, & \text{没有语义相似的旧记忆}\\ \text{DELETE}, & \text{与旧记忆矛盾}\\ \text{UPDATE}, & \text{补充旧记忆的信息}\\ \text{NOOP}, & \text{不需要修改} \end{cases} $$
这里其实就出现了两个值得讨论的问题：

**问题 A：为什么不直接把所有已有记忆交给 LLM，而是先检索 Top-10？**

> 控制上下文长度和计算成本，并筛选出可能与新事实重复或冲突的旧记忆。

**问题 B：为什么只检索语义相似的记忆就可以解决冲突？**

这个问题没有那么简单。

因为语义相似不一定意味着两个事实互相矛盾。

例如：

```
Memory 1：
玩家喜欢骑士团。

Memory 2：
玩家讨厌骑士团团长。
```

这两条记忆具有语义关联，却并不矛盾。

反过来，有些真正冲突的事实，也未必能够仅靠向量相似度稳定检索出来。

这意味着 **Memory Update 的可靠性不仅取决于 LLM，还取决于候选旧记忆的召回率**。

# 三、Mem0ᵍ

对于Mem0的条目记忆，随着新记忆的不断更新，历史状态可能丢失，而且基础版 Mem0 没有显式维护可供遍历的实体关系结构，查询需要的记忆并不一定与原始查询具有很高的语义相似度，因此引入了图关系存储的Mem0ᵍ，知识图谱的优势在于能够利用关系结构找到间接相关的信息，而不是单纯依赖文本之间的相似度。

## 3.1 建立知识图谱

### 3.1.1 Entity Extraction：提取实体
   原始对话：
> 玩家加入了骑士团。骑士团的团长是亚瑟，亚瑟有一个妹妹叫艾莉丝。
首先由 LLM 提取实体：
```
[
  {"name": "Player", "type": "Person"},
  {"name": "Knights", "type": "Organization"},
  {"name": "Arthur", "type": "Person"},
  {"name": "Alice", "type": "Person"}
]
```
### 3.1.2 Relationship Generation：生成关系三元组
Mem0ᵍ 接下来将实体之间的关系表示为：
\[ (s,r,o) \]

例如：

```
triplets = [
    ("Player", "MEMBER_OF", "Knights"),
    ("Knights", "LEADER", "Arthur"),
    ("Arthur", "HAS_SISTER", "Alice")
]
```

然后将这些关系存入图数据库。

论文使用的是 **Neo4j**。
### 3.1.3 Entity Resolution：实体对齐
假设下一次对话是：

> 亚瑟昨天受伤了。

系统会提取：

```
(Arthur, INJURED_ON, Yesterday)
```

但数据库已经存在 Arthur 节点。

因此系统需要判断：

$$ \text{Arthur}_{new} \stackrel{?}{=} \text{Arthur}_{existing} $$

Mem0ᵍ 会计算实体 Embedding，并检索相似度超过阈值 \(t\) 的已有节点。

如果确认是同一实体，就应该复用已有节点，而不是创建重复节点。

但有一个隐患：**实体名称相同不代表一定是同一个人。**

例如游戏中存在两个都叫「亚瑟」的 NPC，仅凭 Embedding 相似度可能造成错误合并。

这就需要进一步使用实体类型、所属组织、上下文等信息进行消歧。
### 3.1.4 Memory Retrieval：两种检索机制
Mem0ᵍ 并不是完全抛弃向量检索，而是采用两条检索路径。

|检索方式|工作原理|主要作用|
|---|---|---|
|Entity-Centric Retrieval|识别查询实体，找到图节点，再探索关联边|检索实体及其关系|
|Semantic Triplet Retrieval|对 Query 和三元组文本进行 Embedding 匹配|检索语义相关的关系|

比如查询：

> 亚瑟的妹妹是谁？

Entity-Centric Retrieval 可以找到 Arthur 节点，再沿关系获取 Alice。

而查询：

> 谁与骑士团的重要人物存在亲属关系？

Semantic Triplet Retrieval 可以帮助召回相关三元组。

两种方式结合，既能利用结构化关系，也保留语义检索的灵活性。

不过需要注意：**存储了知识图谱，不代表系统就能自动完成任意深度的多跳推理。**

## 3.2 更新知识图谱

论文明确指出，当新关系与已有关系发生冲突时，由 LLM 判断旧关系是否应当失效，并将其标记为 Invalid，而非直接从数据库中删除。这样可以保留历史信息，用于时序推理。
论文对 Graph Update 的描述可以概括为：

$$ \text{New Triplet} \rightarrow \text{Entity Resolution} \rightarrow \text{Conflict Detection} \rightarrow \text{Relationship Update} $$

其中最关键的是 Conflict Detection。

 Day 1：亚瑟是骑士团团长

图谱中存在：

```
(Knights) ──[LEADER]──> (Arthur)
```

 Day 30：贝拉成为新团长

新关系：

```
(Knights) ──[LEADER]──> (Bella)
```

系统检测到两条关系可能冲突。

在假设骑士团同时只能有一位团长的情况下，旧关系应当失效。

注意：**是否冲突取决于关系的语义约束。**

例如：

```
(Player) ──[FRIEND_OF]──> (Arthur)
(Player) ──[FRIEND_OF]──> (Bella)
```

这两条关系可以同时成立，不需要进行冲突处理。

而：

```
(Knights) ──[CURRENT_LEADER]──> (Arthur)
(Knights) ──[CURRENT_LEADER]──> (Bella)
```

如果 `CURRENT_LEADER` 具有唯一性约束，两者就不能在相同时间同时成立。

为了解决这个问题，可以进一步引入时间区间，这样不仅能回答现任团长是谁，还能回答某一天的团长是谁。

### 3.3 知识图谱还需要事件记忆

一个完整的游戏 Agent 长期记忆系统，最好至少区分：

|记忆类别|保存内容|示例|
|---|---|---|
|Semantic Memory|人物、组织和状态关系|亚瑟是骑士团前任团长|
|Episodic Memory|发生过的具体事件|玩家与亚瑟共同讨伐巨龙|
|Temporal Information|事实和事件的有效时间|亚瑟在 Day 1～30 担任团长|

# 四、实验

## 4.1 Mem0 与 Mem0ᵍ 的比较

在 LOCOMO 数据集上，Mem0 与 Mem0ᵍ 的结果如下：

|评测任务|Mem0|Mem0ᵍ|
|---|---|---|
|Single-hop|**67.13**|65.71|
|Multi-hop|**51.15**|47.19|
|Open-domain|72.93|**75.71**|
|Temporal Reasoning|55.51|**58.13**|
这说明一个重要问题：

> **知识图谱能够表示多跳关系，不代表基于知识图谱的 Agent 一定具有更好的多跳推理能力。**

因为一个完整的多跳问答过程包含：

$$ \text{Query Understanding} \rightarrow \text{Memory Retrieval} \rightarrow \text{Evidence Integration} \rightarrow \text{Reasoning} $$

知识图谱主要改善的是信息的表示和潜在的关系遍历能力，但如果检索算法不能找到完整路径，最终结果仍然可能不如自然语言记忆，而且，将对话转换成三元组，也可能丢失原始叙述中的时间、因果关系和其他细节。

论文指出，实体提取器不仅可以提取人物、地点、物品，还可以提取 **Event（事件）**。

关系生成器也允许使用不同类型的关系标签。因此，Mem0ᵍ 在表示能力上并不排斥因果关系。

但它的实际流程是：

$$ \text{Conversation} \xrightarrow{\text{LLM}} \text{Entities} \xrightarrow{\text{LLM}} \text{Triplets} $$

论文没有针对因果关系设计专门的抽取与验证机制。能否保留因果关系主要取决于 LLM 是否正确识别并生成相关三元组。

因此我们可以得到一个重要结论：

> **记忆系统的最终推理能力，不仅取决于存储结构，还受限于 Memory Extraction 阶段的信息保真度。**

如果 Extraction 丢失了关键信息，那么后续无论使用多么复杂的 Graph Retrieval，都无法可靠地恢复它。

## 4.2 主实验

|方法|Overall Judge Score ↑|P95 总延迟 ↓|回答阶段上下文 Token|
|---|---|---|---|
|Full-Context|**72.90%**|17.117 s|26,031|
|Vanilla RAG（最佳配置）|60.97%|1.907 s|512|
|Mem0|66.88%|**1.440 s**|1,764|
|Mem0ᵍ|68.44%|2.590 s|3,616|
Mem0 的优势在于：通过提前提取和整理记忆，减少每次查询需要处理的信息量。

但是**减少回答阶段的 Token 消耗，不等于减少整个系统的总 Token 消耗。**

比较 Full-Context 和 Mem0：

**Full-Context：**

```
每次 Query
    ↓
读取完整历史（约 26K tokens）
    ↓
LLM Reasoning
    ↓
Answer
```

**Mem0：**

```
历史交互阶段
    ↓
Memory Extraction
    ↓
Memory Update
    ↓
Memory Database

---------------------------

每次 Query
    ↓
Memory Retrieval（约 1.8K tokens）
    ↓
LLM Reasoning
    ↓
Answer
```

假设玩家进行了 N 轮交互，系统累计执行了 Q 次记忆查询。

对于 Full-Context：

$$ C_{\text{full}} = \sum_{q=1}^{Q} C_{\text{LLM}}(H_q) $$

其中 H_q 是第 q 次查询时需要输入的完整历史。

对于 Mem0：

$$ C_{\text{Mem0}} = \underbrace{C_{\text{extract}}}_{记忆提取} + \underbrace{C_{\text{update}}}_{记忆更新} + \underbrace{C_{\text{embedding}}}_{向量化} + \underbrace{C_{\text{storage}}}_{存储} + \underbrace{C_{\text{retrieval}}}_{检索} + \underbrace{C_{\text{answer}}}_{回答生成} $$

这才是我们在生产环境中更关心的成本。

因为 Mem0 在每次写入时，可能需要：

1. 调用 LLM 提取记忆。
2. 检索相关旧记忆。
3. 再次调用 LLM 决定 ADD、UPDATE、DELETE 或 NOOP。

如果玩家频繁交互，但很少需要查询历史，那么提前维护记忆的成本可能无法摊薄。

反过来，如果一条历史记忆会被频繁复用，Mem0 的成本优势就可能非常明显。

**因此，Memory System 的经济性还取决于记忆的写入频率与查询频率。**

