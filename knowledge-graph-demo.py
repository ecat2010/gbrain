#!/usr/bin/env python3
"""
梁志亮案件 - 知识图谱关联遍历实现
演示 links 的存储和遍历算法
"""

import networkx as nx
from collections import deque

# 注释掉可视化部分（需要 matplotlib）
# import matplotlib.pyplot as plt

# ============================================
# 1. 知识图谱数据模型（邻接表存储）
# ============================================

# 节点定义
nodes = {
    "liang-zhi-liang": {
        "title": "梁志亮",
        "type": "当事人",
        "属性": "原告"
    },
    "jin-du-zhen-zhengfu": {
        "title": "金渡镇政府",
        "type": "机构",
        "属性": "被告"
    },
    "lao-dong-zhong-cai": {
        "title": "劳动仲裁",
        "type": "法律文书",
        "案号": "〔2024〕213号"
    },
    "yi-shen-pan-jue": {
        "title": "一审判决书",
        "type": "法律文书",
        "案号": "(2025)粤1204民初372号"
    },
    "er-shen-pan-jue": {
        "title": "二审判决书",
        "type": "法律文书",
        "案号": "(2025)粤12民终2790号"
    },
    "ye-jun-yi": {
        "title": "叶俊仪",
        "type": "人物",
        "职务": "原副书记"
    },
    "gao-yao-qu-ji-jian-wei": {
        "title": "高要区纪委监委",
        "type": "机构",
        "属性": "监督机关"
    },
    "zai-shen-shen-qing": {
        "title": "再审申请",
        "type": "法律文书",
        "截止日期": "2026-06-05"
    }
}

# 边定义（有向图）
edges = [
    ("liang-zhi-liang", "jin-du-zhen-zhengfu", "原告-被告"),
    ("liang-zhi-liang", "lao-dong-zhong-cai", "申请人-仲裁"),
    ("liang-zhi-liang", "zai-shen-shen-qing", "申请人-法律文书"),
    ("jin-du-zhen-zhengfu", "lao-dong-zhong-cai", "被申请方"),
    ("jin-du-zhen-zhengfu", "ye-jun-yi", "任职"),
    ("ye-jun-yi", "liang-zhi-liang", "打击报复"),
    ("lao-dong-zhong-cai", "yi-shen-pan-jue", "前置程序"),
    ("yi-shen-pan-jue", "er-shen-pan-jue", "上诉"),
    ("er-shen-pan-jue", "zai-shen-shen-qing", "生效判决"),
    ("gao-yao-qu-ji-jian-wei", "jin-du-zhen-zhengfu", "监督"),
    ("gao-yao-qu-ji-jian-wei", "ye-jun-yi", "调查")
]

# ============================================
# 2. 构建图结构
# ============================================

G = nx.DiGraph()

# 添加节点
for slug, attrs in nodes.items():
    G.add_node(slug, **attrs)

# 添加边
for src, dst, rel in edges:
    G.add_edge(src, dst, relationship=rel)

print(f"节点数: {G.number_of_nodes()}")
print(f"边数: {G.number_of_edges()}")

# ============================================
# 3. 关联遍历算法实现
# ============================================

def bfs_traverse(G, start_slug, max_depth=2):
    """
    BFS（广度优先搜索）遍历关联
    
    返回：所有在 max_depth 内的节点和路径
    """
    visited = set()
    queue = deque([(start_slug, 0, [start_slug])])  # (节点, 深度, 路径)
    results = []
    
    while queue:
        node, depth, path = queue.popleft()
        
        if node in visited:
            continue
        visited.add(node)
        
        if depth > 0:  # 排除起始节点自身
            results.append({
                "depth": depth,
                "node": node,
                "path": " → ".join(path),
                "title": G.nodes[node]["title"]
            })
        
        if depth < max_depth:
            # 遍历出边（从当前节点出发）
            for neighbor in G.successors(node):
                if neighbor not in visited:
                    queue.append((neighbor, depth + 1, path + [neighbor]))
            
            # 遍历入边（指向当前节点的）
            for neighbor in G.predecessors(node):
                if neighbor not in visited:
                    queue.append((neighbor, depth + 1, path + [neighbor]))
    
    return results

def dfs_traverse(G, start_slug, max_depth=2):
    """
    DFS（深度优先搜索）遍历关联
    
    返回：深度优先的所有路径
    """
    results = []
    
    def dfs(node, depth, path):
        if depth > max_depth:
            return
        
        if depth > 0:
            results.append({
                "depth": depth,
                "node": node,
                "path": " → ".join(path),
                "title": G.nodes[node]["title"]
            })
        
        # 出边
        for neighbor in G.successors(node):
            if neighbor not in path:  # 防止环
                dfs(neighbor, depth + 1, path + [neighbor])
        
        # 入边
        for neighbor in G.predecessors(node):
            if neighbor not in path:
                dfs(neighbor, depth + 1, path + [neighbor])
    
    dfs(start_slug, 0, [start_slug])
    return results

def find_shortest_path(G, src, dst):
    """
    查找两个节点之间的最短路径（Dijkstra算法）
    """
    try:
        path = nx.shortest_path(G, src, dst)
        return {
            "src": G.nodes[src]["title"],
            "dst": G.nodes[dst]["title"],
            "path": " → ".join([G.nodes[n]["title"] for n in path]),
            "length": len(path) - 1
        }
    except nx.NetworkXNoPath:
        return None

# ============================================
# 4. 演示：遍历"梁志亮"的关联
# ============================================

print("\n" + "="*60)
print("BFS 遍历：梁志亮的 2-hop 关联")
print("="*60)

results_bfs = bfs_traverse(G, "liang-zhi-liang", max_depth=2)
for r in results_bfs:
    print(f"  [深度 {r['depth']}] {r['title']} ({r['node']})")
    print(f"          路径: {r['path']}\n")

print("\n" + "="*60)
print("DFS 遍历：梁志亮的关联（深度优先）")
print("="*60)

results_dfs = dfs_traverse(G, "liang-zhi-liang", max_depth=2)
for r in results_dfs:
    print(f"  [深度 {r['depth']}] {r['title']} ({r['node']})")

print("\n" + "="*60)
print("最短路径查询")
print("="*60)

path1 = find_shortest_path(G, "liang-zhi-liang", "er-shen-pan-jue")
if path1:
    print(f"  梁志亮 → 二审判决书:")
    print(f"    路径: {path1['path']}")
    print(f"    长度: {path1['length']} hop(s)")

path2 = find_shortest_path(G, "ye-jun-yi", "zai-shen-shen-qing")
if path2:
    print(f"\n  叶俊仪 → 再审申请:")
    print(f"    路径: {path2['path']}")
    print(f"    长度: {path2['length']} hop(s)")

# ============================================
# 5. 语义关联（向量相似度）模拟
# ============================================

print("\n" + "="*60)
print("语义关联模拟（基于 Embeddings 的相似度）")
print("="*60)

# 模拟 embeddings（实际应该从数据库读取）
embeddings_sim = {
    "liang-zhi-liang": {"jin-du-zhen-zhengfu": 0.89, "lao-dong-zhong-cai": 0.76, "zai-shen-shen-qing": 0.71},
    "jin-du-zhen-zhengfu": {"liang-zhi-liang": 0.89, "ye-jun-yi": 0.82, "lao-dong-zhong-cai": 0.68},
    "ye-jun-yi": {"jin-du-zhen-zhengfu": 0.82, "liang-zhi-liang": 0.75}
}

for node, sims in embeddings_sim.items():
    print(f"\n  {G.nodes[node]['title']} 的语义关联:")
    for other, score in sorted(sims.items(), key=lambda x: -x[1]):
        print(f"    → {G.nodes[other]['title']} (相似度: {score:.2f})")

# ============================================
# 6. 可视化
# ============================================

print("\n" + "="*60)
print("生成知识图谱可视化...")
print("="*60)

plt.figure(figsize=(14, 10))

# 设置节点颜色（按类型）
color_map = {
    "当事人": "#e1f5fe",
    "人物": "#f3e5f5",
    "机构": "#fff3e0",
    "法律文书": "#e8f5e9"
}

node_colors = [color_map.get(G.nodes[n]["type"], "#bdbdbd") for n in G.nodes]

# 绘制图
pos = nx.spring_layout(G, k=3, iterations=50, seed=42)
nx.draw_networkx_nodes(G, pos, node_color=node_colors, node_size=3000, alpha=0.9)
nx.draw_networkx_labels(G, pos, labels={n: G.nodes[n]["title"] for n in G.nodes}, font_size=10, font_weight="bold")
nx.draw_networkx_edges(G, pos, edge_color="gray", arrows=True, arrowsize=20, alpha=0.6)

# 添加边标签
edge_labels = {(u, v): G[u][v]["relationship"] for u, v in G.edges}
nx.draw_networkx_edge_labels(G, pos, edge_labels=edge_labels, font_size=8, font_color="red")

plt.title("梁志亮案件 - 知识图谱", fontsize=16, fontweight="bold")
plt.axis("off")
plt.tight_layout()
plt.savefig("D:/gbrain-master/knowledge-graph.png", dpi=150, bbox_inches="tight")
print("  已保存到: D:/gbrain-master/knowledge-graph.png")

# ============================================
# 7. 输出邻接表（存储格式）
# ============================================

print("\n" + "="*60)
print("邻接表存储格式（GBrain links 表结构）")
print("="*60)

adjacency_list = {}
for node in G.nodes:
    adjacency_list[node] = []
    for neighbor in G.successors(node):
        adjacency_list[node].append({
            "to": neighbor,
            "relationship": G[node][neighbor]["relationship"]
        })

for node, links in adjacency_list.items():
    if links:
        print(f"\n  {G.nodes[node]['title']} ({node}) →")
        for link in links:
            print(f"    → {G.nodes[link['to']]['title']} ({link['to']}) [{link['relationship']}]")

print("\n" + "="*60)
print("完成！")
print("="*60)
